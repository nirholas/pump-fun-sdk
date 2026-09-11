/**
 * `pump quote buy|sell` — price a trade without a wallet and without sending
 * anything.
 *
 * Deliberately wallet-free. The SDK's `quoteBuy`/`quoteSell` need a user
 * pubkey because they fetch the associated token account alongside the curve;
 * for a pure quote that account is irrelevant, so this reads global + fee
 * config + curve directly and runs the same math. The result is a command that
 * works on a machine with no key on it.
 */

import type { Command } from "commander";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

import { calculateBuyPriceImpact, calculateSellPriceImpact } from "../../analytics";
import { maxSafeSellAmount } from "../../bondingCurve";
import { computeFeesBps } from "../../fees";
import type { BondingCurve, FeeConfig, Global } from "../../state";
import type { CliContext } from "../context";
import { CliError, parsePublicKey } from "../context";
import {
  c,
  formatBps,
  formatImpact,
  formatScaledPrice,
  formatSol,
  formatTokens,
  heading,
  keyValue,
  lamportsToSol,
  rawToTokens,
  solToLamports,
  tokensToRaw,
  toJson,
  warn,
} from "../format";

export function registerQuoteCommand(
  program: Command,
  getContext: () => CliContext,
): void {
  const quote = program
    .command("quote")
    .description("Price a trade offline: tokens out, fees, and price impact");

  quote
    .command("buy <mint>")
    .description("Quote a buy for a given SOL amount")
    .requiredOption("-s, --sol <amount>", "SOL to spend", parseAmount)
    .action(async (mint: string, options: { sol: number }) => {
      await runBuyQuote(getContext(), mint, options.sol);
    });

  quote
    .command("sell <mint>")
    .description("Quote a sell for a token amount or a percent of a balance")
    .option("-t, --tokens <amount>", "Whole tokens to sell", parseAmount)
    .option(
      "-p, --percent <percent>",
      "Percent of the wallet's balance to sell (needs a wallet)",
      parseAmount,
    )
    .action(
      async (mint: string, options: { tokens?: number; percent?: number }) => {
        await runSellQuote(getContext(), mint, options);
      },
    );
}

function parseAmount(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`Amount must be a positive number, got "${value}"`);
  }
  return parsed;
}

interface CurveState {
  global: Global;
  feeConfig: FeeConfig;
  bondingCurve: BondingCurve;
}

async function fetchCurveState(
  ctx: CliContext,
  mint: string,
): Promise<CurveState> {
  const [global, feeConfig, bondingCurve] = await Promise.all([
    ctx.sdk.fetchGlobal(),
    ctx.sdk.fetchFeeConfig(),
    ctx.sdk.fetchBondingCurve(mint).catch((error: Error) => {
      throw new CliError(
        `No pump bonding curve exists for ${mint}`,
        `Check the mint address. (${error.message})`,
      );
    }),
  ]);
  return { global, feeConfig, bondingCurve };
}

async function runBuyQuote(
  ctx: CliContext,
  mintArg: string,
  sol: number,
): Promise<void> {
  const mint = parsePublicKey(mintArg, "mint");
  const solAmount = solToLamports(sol);
  const { global, feeConfig, bondingCurve } = await fetchCurveState(
    ctx,
    mint.toBase58(),
  );

  const impact = calculateBuyPriceImpact({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    solAmount,
  });

  const feesLamports = estimateBuyFee({
    global,
    feeConfig,
    bondingCurve,
    solAmount,
  });
  const effectivePrice = impact.outputAmount.isZero()
    ? new BN(0)
    : solAmount.mul(new BN(1_000_000)).div(impact.outputAmount);

  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        side: "buy",
        mint: mint.toBase58(),
        graduated: bondingCurve.complete,
        solIn: sol,
        solInLamports: solAmount,
        tokensOut: impact.outputAmount,
        tokensOutUi: rawToTokens(impact.outputAmount),
        feesLamports,
        feesSol: lamportsToSol(feesLamports),
        priceImpactBps: impact.impactBps,
        priceBeforeLamports: impact.priceBefore,
        priceAfterLamports: impact.priceAfter,
        effectivePricePerTokenLamports: effectivePrice,
      })}\n`,
    );
    return;
  }

  process.stdout.write(
    `${[
      heading(`Buy quote`, mintArg),
      "",
      keyValue([
        { label: "You spend", value: c.bold(formatSol(solAmount)) },
        { label: "You receive", value: c.bold(`${formatTokens(impact.outputAmount)} tokens`) },
        { label: "Effective price", value: formatSol(effectivePrice, 9), note: "per token" },
        { label: "Fees", value: formatSol(feesLamports), note: "included in the spend" },
        { label: "Price impact", value: formatImpact(impact.impactBps) },
        { label: "Price before", value: formatScaledPrice(impact.priceBefore), note: "per token" },
        { label: "Price after", value: formatScaledPrice(impact.priceAfter), note: "per token" },
      ]),
      ...(impact.impactBps >= 500
        ? ["", `  ${warn(`This trade moves the price by ${formatBps(impact.impactBps)}. Split it into smaller buys to pay less.`)}`]
        : []),
      ...(bondingCurve.complete
        ? ["", `  ${warn("This token has graduated. The real fill routes through the PumpAMM pool, so the AMM quote applies. Run `pump pool <mint>` for the pool state.")}`]
        : []),
      "",
      c.dim(`  Execute with: pump buy ${mintArg} --sol ${sol}`),
      "",
    ].join("\n")}\n`,
  );
}

async function runSellQuote(
  ctx: CliContext,
  mintArg: string,
  options: { tokens?: number; percent?: number },
): Promise<void> {
  const mint = parsePublicKey(mintArg, "mint");
  if (options.tokens === undefined && options.percent === undefined) {
    throw new CliError(
      "A sell quote needs an amount",
      "Pass --tokens <amount> for an exact amount, or --percent <n> to quote a share of the configured wallet's balance.",
    );
  }

  const { global, feeConfig, bondingCurve } = await fetchCurveState(
    ctx,
    mint.toBase58(),
  );

  let tokenAmount: BN;
  let balanceNote: string | undefined;

  if (options.percent !== undefined) {
    const owner = ctx.requireSigner().publicKey;
    const balance = await fetchTokenBalance(ctx, mint.toBase58(), owner.toBase58());
    if (balance.isZero()) {
      throw new CliError(
        `${owner.toBase58()} holds none of ${mintArg}`,
        "Use --tokens <amount> to quote a hypothetical sell instead.",
      );
    }
    tokenAmount = balance.muln(Math.round(options.percent * 100)).divn(10_000);
    balanceNote = `${formatBps(options.percent * 100)} of ${formatTokens(balance)} held`;
  } else {
    tokenAmount = tokensToRaw(options.tokens as number);
  }

  const impact = calculateSellPriceImpact({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    tokenAmount,
  });

  const grossSol = bondingCurve.virtualTokenReserves.add(tokenAmount).isZero()
    ? new BN(0)
    : tokenAmount
        .mul(bondingCurve.virtualQuoteReserves)
        .div(bondingCurve.virtualTokenReserves.add(tokenAmount));
  const feesLamports = BN.max(new BN(0), grossSol.sub(impact.outputAmount));
  const maxSafe = maxSafeSellAmount(bondingCurve.virtualQuoteReserves);
  const willOverflow = tokenAmount.gt(maxSafe);

  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        side: "sell",
        mint: mint.toBase58(),
        graduated: bondingCurve.complete,
        tokensIn: tokenAmount,
        tokensInUi: rawToTokens(tokenAmount),
        solOut: impact.outputAmount,
        solOutUi: lamportsToSol(impact.outputAmount),
        feesLamports,
        feesSol: lamportsToSol(feesLamports),
        priceImpactBps: impact.impactBps,
        priceBeforeLamports: impact.priceBefore,
        priceAfterLamports: impact.priceAfter,
        maxSafeAmount: maxSafe,
        willOverflow,
      })}\n`,
    );
    return;
  }

  process.stdout.write(
    `${[
      heading(`Sell quote`, mintArg),
      "",
      keyValue([
        {
          label: "You sell",
          value: c.bold(`${formatTokens(tokenAmount)} tokens`),
          note: balanceNote,
        },
        { label: "You receive", value: c.bold(formatSol(impact.outputAmount)) },
        { label: "Fees", value: formatSol(feesLamports), note: "deducted from proceeds" },
        { label: "Price impact", value: formatImpact(impact.impactBps) },
        { label: "Price before", value: formatScaledPrice(impact.priceBefore), note: "per token" },
        { label: "Price after", value: formatScaledPrice(impact.priceAfter), note: "per token" },
      ]),
      ...(willOverflow
        ? [
            "",
            `  ${warn(`Above the safe sell ceiling of ${formatTokens(maxSafe)} tokens: the curve math overflows and the chain will reject it. Sell in chunks (\`pump sell ${mintArg} --percent 25\` four times).`)}`,
          ]
        : []),
      ...(impact.impactBps >= 500
        ? ["", `  ${warn(`This trade moves the price by ${formatBps(impact.impactBps)}.`)}`]
        : []),
      "",
    ].join("\n")}\n`,
  );
}

/** Fee = sol * totalFeeBps / (totalFeeBps + 10_000), matching `quoteBuy`. */
function estimateBuyFee({
  global,
  feeConfig,
  bondingCurve,
  solAmount,
}: {
  global: Global;
  feeConfig: FeeConfig;
  bondingCurve: BondingCurve;
  solAmount: BN;
}): BN {
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    virtualQuoteReserves: bondingCurve.virtualQuoteReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });
  // An unset creator means no creator fee is charged, matching `quoteBuy`.
  const creatorSet = !bondingCurve.creator.equals(PublicKey.default);
  const totalFeeBps = protocolFeeBps.add(creatorSet ? creatorFeeBps : new BN(0));
  return totalFeeBps.isZero()
    ? new BN(0)
    : solAmount.mul(totalFeeBps).div(totalFeeBps.addn(10_000));
}

/** Read a wallet's raw token balance for a mint, zero when the ATA is absent. */
export async function fetchTokenBalance(
  ctx: CliContext,
  mint: string,
  owner: string,
): Promise<BN> {
  const accounts = await ctx.connection.getParsedTokenAccountsByOwner(
    new PublicKey(owner),
    { mint: new PublicKey(mint) },
  );
  return accounts.value.reduce((total, account) => {
    const amount = account.account.data.parsed?.info?.tokenAmount?.amount;
    return typeof amount === "string" ? total.add(new BN(amount)) : total;
  }, new BN(0));
}
