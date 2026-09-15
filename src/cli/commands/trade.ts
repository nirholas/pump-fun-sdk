/**
 * `pump buy`, `pump sell`, `pump create` — the commands that move funds.
 *
 * All three route through `submit()`, which simulates first and then requires
 * an explicit yes before anything is broadcast. `--simulate` stops after the
 * simulation; `--yes` is the scripting escape hatch. There is no code path here
 * that sends a transaction the user has not seen the terms of.
 *
 * Buys and sells use the SDK's routed builders, so a token that graduated
 * mid-session fills against the AMM pool instead of failing on a dead curve.
 */

import type { Command } from "commander";
import BN from "bn.js";
import { Keypair, type PublicKey } from "@solana/web3.js";

import { calculateBuyPriceImpact, calculateSellPriceImpact } from "../../analytics";
import { getBuyTokenAmountFromSolAmount, newBondingCurve } from "../../bondingCurve";
import { PUMP_SDK } from "../../sdk";
import { generateVanityMint } from "../../vanityMint";
import type { CliContext } from "../context";
import { CliError, parsePublicKey } from "../context";
import {
  c,
  formatImpact,
  formatSol,
  formatTokens,
  info,
  lamportsToSol,
  pumpFunUrl,
  rawToTokens,
  solToLamports,
  tokensToRaw,
  toJson,
} from "../format";
import { submit } from "../tx";
import { fetchTokenBalance } from "./quote";

export function registerTradeCommands(
  program: Command,
  getContext: () => CliContext,
): void {
  program
    .command("buy <mint>")
    .description("Buy a token, routing to the bonding curve or the AMM pool")
    .requiredOption("-s, --sol <amount>", "SOL to spend", parsePositive)
    .action(async (mint: string, options: { sol: number }) => {
      await runBuy(getContext(), mint, options.sol);
    });

  program
    .command("sell <mint>")
    .description("Sell a token by amount, by percent, or the whole position")
    .option("-t, --tokens <amount>", "Whole tokens to sell", parsePositive)
    .option("-p, --percent <percent>", "Percent of the balance to sell", parsePositive)
    .option("-a, --all", "Sell the entire balance and close the token account")
    .action(
      async (
        mint: string,
        options: { tokens?: number; percent?: number; all?: boolean },
      ) => {
        await runSell(getContext(), mint, options);
      },
    );

  program
    .command("create")
    .description("Launch a new token on the bonding curve")
    .requiredOption("-n, --name <name>", "Token name")
    .requiredOption("-s, --symbol <symbol>", "Token symbol")
    .requiredOption("-u, --uri <uri>", "Metadata URI (the JSON, not the image)")
    .option("--mint-keypair <path>", "Use a prepared mint keypair from `pump vanity`")
    .option("--vanity-suffix <suffix>", "Grind a mint ending in this suffix first")
    .option("--buy <sol>", "SOL of the first buy, in the same transaction", parsePositive)
    .option("--creator <address>", "Creator that earns the creator fee (default: signer)")
    .option("--mayhem", "Launch with mayhem mode enabled")
    .option("--holder-reward", "Distribute creator fees to token holders")
    .action(async (options: CreateOptions) => {
      await runCreate(getContext(), options);
    });
}

interface CreateOptions {
  name: string;
  symbol: string;
  uri: string;
  mintKeypair?: string;
  vanitySuffix?: string;
  buy?: number;
  creator?: string;
  mayhem?: boolean;
  holderReward?: boolean;
}

function parsePositive(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`Expected a positive number, got "${value}"`);
  }
  return parsed;
}

async function runBuy(
  ctx: CliContext,
  mintArg: string,
  sol: number,
): Promise<void> {
  const mint = parsePublicKey(mintArg, "mint");
  const signer = ctx.requireSigner();
  const solAmount = solToLamports(sol);

  await assertFunded(ctx, signer.publicKey, solAmount);

  const [global, feeConfig, bondingCurve] = await Promise.all([
    ctx.sdk.fetchGlobal(),
    ctx.sdk.fetchFeeConfig(),
    ctx.sdk.fetchBondingCurve(mint),
  ]);
  const impact = calculateBuyPriceImpact({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    solAmount,
  });

  const instructions = await ctx.sdk.routedBuyInstructions({
    mint,
    user: signer.publicKey,
    quoteAmountIn: solAmount,
    slippage: ctx.slippage / 100,
  });

  const result = await submit(ctx, {
    action: bondingCurve.complete ? "Buy on PumpAMM" : "Buy on bonding curve",
    summary: [
      { label: "Token", value: mint.toBase58() },
      { label: "Spending", value: c.bold(formatSol(solAmount)) },
      { label: "Expected", value: `${formatTokens(impact.outputAmount)} tokens` },
      { label: "Price impact", value: formatImpact(impact.impactBps) },
      { label: "Slippage", value: `${ctx.slippage}%` },
    ],
    instructions,
    signer,
  });

  emitTradeResult(ctx, {
    side: "buy",
    mint: mint.toBase58(),
    solIn: sol,
    expectedTokens: impact.outputAmount,
    result,
  });
}

async function runSell(
  ctx: CliContext,
  mintArg: string,
  options: { tokens?: number; percent?: number; all?: boolean },
): Promise<void> {
  const mint = parsePublicKey(mintArg, "mint");
  const signer = ctx.requireSigner();

  const selectors = [options.tokens, options.percent, options.all].filter(
    (value) => value !== undefined,
  );
  if (selectors.length === 0) {
    throw new CliError(
      "A sell needs an amount",
      "Pass --tokens <amount>, --percent <n>, or --all.",
    );
  }
  if (selectors.length > 1) {
    throw new CliError(
      "--tokens, --percent, and --all are mutually exclusive",
      "Pick one.",
    );
  }

  const balance = await fetchTokenBalance(
    ctx,
    mint.toBase58(),
    signer.publicKey.toBase58(),
  );
  if (balance.isZero()) {
    throw new CliError(
      `${signer.publicKey.toBase58()} holds none of ${mintArg}`,
      "Nothing to sell.",
    );
  }

  const amount =
    options.all === true
      ? balance
      : options.percent !== undefined
        ? balance.muln(Math.round(options.percent * 100)).divn(10_000)
        : tokensToRaw(options.tokens as number);

  if (amount.gt(balance)) {
    throw new CliError(
      `Cannot sell ${formatTokens(amount)} tokens: the wallet holds ${formatTokens(balance)}`,
      "Use --all to sell the whole position.",
    );
  }
  if (amount.isZero()) {
    throw new CliError("The computed sell amount rounds to zero");
  }

  const [global, feeConfig, bondingCurve] = await Promise.all([
    ctx.sdk.fetchGlobal(),
    ctx.sdk.fetchFeeConfig(),
    ctx.sdk.fetchBondingCurve(mint),
  ]);
  const impact = calculateSellPriceImpact({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    tokenAmount: amount,
  });

  // `sellAllInstructions` also closes the ATA and reclaims its rent, which a
  // plain routed sell leaves behind.
  const instructions =
    options.all === true && !bondingCurve.complete
      ? await ctx.sdk.sellAllInstructions({
          mint,
          user: signer.publicKey,
          slippage: ctx.slippage,
        })
      : await ctx.sdk.routedSellInstructions({
          mint,
          user: signer.publicKey,
          baseAmountIn: amount,
          slippage: ctx.slippage / 100,
        });

  const result = await submit(ctx, {
    action: bondingCurve.complete ? "Sell on PumpAMM" : "Sell on bonding curve",
    summary: [
      { label: "Token", value: mint.toBase58() },
      {
        label: "Selling",
        value: c.bold(`${formatTokens(amount)} tokens`),
        note: `of ${formatTokens(balance)} held`,
      },
      { label: "Expected", value: formatSol(impact.outputAmount) },
      { label: "Price impact", value: formatImpact(impact.impactBps) },
      { label: "Slippage", value: `${ctx.slippage}%` },
      ...(options.all === true
        ? [{ label: "Token account", value: "closed, rent reclaimed" }]
        : []),
    ],
    instructions,
    signer,
  });

  emitTradeResult(ctx, {
    side: "sell",
    mint: mint.toBase58(),
    tokensIn: amount,
    expectedSol: impact.outputAmount,
    result,
  });
}

async function runCreate(ctx: CliContext, options: CreateOptions): Promise<void> {
  const signer = ctx.requireSigner();

  if (options.symbol.length > 10) {
    throw new CliError(
      `Symbol "${options.symbol}" is ${options.symbol.length} characters`,
      "Pump symbols are capped at 10 characters.",
    );
  }
  if (!/^https?:\/\//.test(options.uri)) {
    throw new CliError(
      `Metadata URI must be an http(s) URL, got "${options.uri}"`,
      "Upload the metadata JSON first (IPFS, Arweave, or any host) and pass its URL. The JSON holds the image URL, not the other way round.",
    );
  }

  const mintKeypair = await resolveMintKeypair(ctx, options);
  const creator =
    options.creator === undefined
      ? signer.publicKey
      : parsePublicKey(options.creator, "--creator");

  const buyLamports =
    options.buy === undefined ? undefined : solToLamports(options.buy);

  const common = {
    mint: mintKeypair.publicKey,
    name: options.name,
    symbol: options.symbol,
    uri: options.uri,
    creator,
    user: signer.publicKey,
    mayhemMode: options.mayhem === true,
    holderReward: options.holderReward === true,
  };

  let instructions;
  let expectedTokens: BN | undefined;

  if (buyLamports === undefined) {
    instructions = [await PUMP_SDK.createV2Instruction(common)];
  } else {
    // The curve does not exist on chain yet, so the first buy is priced against
    // a fresh curve seeded from the protocol's global defaults.
    const [global, feeConfig] = await Promise.all([
      ctx.sdk.fetchGlobal(),
      ctx.sdk.fetchFeeConfig(),
    ]);
    const freshCurve = newBondingCurve(global);
    expectedTokens = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: global.tokenTotalSupply,
      bondingCurve: freshCurve,
      amount: buyLamports,
    });
    await assertFunded(ctx, signer.publicKey, buyLamports);
    instructions = await PUMP_SDK.createV2AndBuyInstructions({
      ...common,
      global,
      amount: expectedTokens,
      solAmount: buyLamports,
    });
  }

  const result = await submit(ctx, {
    action: "Launch a new token",
    summary: [
      { label: "Name", value: c.bold(options.name) },
      { label: "Symbol", value: c.bold(options.symbol) },
      { label: "Mint", value: mintKeypair.publicKey.toBase58() },
      { label: "Metadata", value: options.uri },
      { label: "Creator", value: creator.toBase58() },
      {
        label: "Initial buy",
        value: buyLamports === undefined ? c.dim("none") : formatSol(buyLamports),
        note:
          expectedTokens === undefined
            ? undefined
            : `about ${formatTokens(expectedTokens)} tokens`,
      },
      ...(options.mayhem === true
        ? [{ label: "Mayhem mode", value: c.magenta("enabled") }]
        : []),
      ...(options.holderReward === true
        ? [{ label: "Holder rewards", value: c.green("enabled") }]
        : []),
    ],
    instructions,
    signer,
    extraSigners: [mintKeypair],
  });

  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        action: "create",
        mint: mintKeypair.publicKey.toBase58(),
        name: options.name,
        symbol: options.symbol,
        uri: options.uri,
        creator: creator.toBase58(),
        holderReward: options.holderReward === true,
        signature: result.signature ?? null,
        simulatedOnly: result.simulated,
      })}\n`,
    );
    return;
  }

  if (result.signature !== undefined) {
    process.stdout.write(
      `\n${info(`Live at ${pumpFunUrl(mintKeypair.publicKey.toBase58())}`)}\n`,
    );
  }
}

/**
 * Resolve the mint keypair for a launch.
 *
 * A mint address is permanent, so a launch either reuses a keypair the user
 * already ground with `pump vanity` (saved to disk, reviewable) or grinds one
 * inline. Grinding inline is convenient but the keypair only exists in memory
 * until the transaction lands, so the key is written to disk before submission.
 */
async function resolveMintKeypair(
  ctx: CliContext,
  options: CreateOptions,
): Promise<Keypair> {
  if (options.mintKeypair !== undefined) {
    const { loadKeypair } = await import("../context");
    return loadKeypair(options.mintKeypair);
  }

  if (options.vanitySuffix !== undefined) {
    if (!ctx.json) {
      process.stderr.write(
        `${info(`Grinding a mint ending in "${options.vanitySuffix}"...`)}\n`,
      );
    }
    const { keypair, attempts, durationMs } = await generateVanityMint({
      suffix: options.vanitySuffix,
      onProgress: ({ attempts: tried, attemptsPerSecond }) => {
        if (ctx.json) return;
        process.stderr.write(
          `\r  ${c.dim(`${tried.toLocaleString()} tried, ${Math.round(attemptsPerSecond).toLocaleString()}/s`)}`,
        );
      },
    });
    if (!ctx.json) {
      process.stderr.write(
        `\r${" ".repeat(60)}\r${info(`Found ${keypair.publicKey.toBase58()} in ${attempts.toLocaleString()} attempts (${(durationMs / 1000).toFixed(1)}s)`)}\n`,
      );
    }
    const { writeKeypairFile } = await import("./vanity");
    const path = writeKeypairFile(keypair);
    if (!ctx.json) {
      process.stderr.write(`${info(`Mint keypair saved to ${path}`)}\n`);
    }
    return keypair;
  }

  return Keypair.generate();
}

/** Fail before building anything if the wallet cannot cover the trade. */
async function assertFunded(
  ctx: CliContext,
  wallet: PublicKey,
  needed: BN,
): Promise<void> {
  const balance = await ctx.connection.getBalance(wallet, "confirmed");
  // Leave headroom for the transaction fee and any rent-exempt ATA creation.
  const headroom = 3_000_000;
  if (new BN(balance).lt(needed.addn(headroom))) {
    throw new CliError(
      `${wallet.toBase58()} holds ${formatSol(new BN(balance))}, which does not cover ${formatSol(needed)} plus fees`,
      "Fund the wallet, or lower --sol.",
    );
  }
}

function emitTradeResult(
  ctx: CliContext,
  payload: {
    side: "buy" | "sell";
    mint: string;
    solIn?: number;
    tokensIn?: BN;
    expectedTokens?: BN;
    expectedSol?: BN;
    result: { signature?: string; simulated: boolean };
  },
): void {
  if (!ctx.json) return;
  process.stdout.write(
    `${toJson({
      action: payload.side,
      mint: payload.mint,
      solIn: payload.solIn ?? null,
      tokensIn: payload.tokensIn ?? null,
      tokensInUi:
        payload.tokensIn === undefined ? null : rawToTokens(payload.tokensIn),
      expectedTokens: payload.expectedTokens ?? null,
      expectedSol:
        payload.expectedSol === undefined
          ? null
          : lamportsToSol(payload.expectedSol),
      signature: payload.result.signature ?? null,
      simulatedOnly: payload.result.simulated,
    })}\n`,
  );
}
