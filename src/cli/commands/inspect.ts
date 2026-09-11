/**
 * Read-only chain inspection: `curve`, `price`, `pool`, `global`.
 *
 * None of these need a wallet. They are the commands a user runs within thirty
 * seconds of installing, so they have to work on the default public RPC with no
 * configuration at all.
 */

import type { Command } from "commander";
import BN from "bn.js";
import type { PublicKey } from "@solana/web3.js";

import { computeFeesBps } from "../../fees";
import { bondingCurvePda, canonicalPumpPoolPda, creatorVaultPda } from "../../pda";
import type { CliContext } from "../context";
import { CliError, parsePublicKey } from "../context";
import {
  c,
  formatBps,
  formatCompact,
  formatSol,
  formatTokens,
  heading,
  keyValue,
  lamportsToSol,
  meter,
  pumpFunUrl,
  rawToTokens,
  solscanAccount,
  solscanToken,
  toJson,
} from "../format";

export function registerInspectCommands(
  program: Command,
  getContext: () => CliContext,
): void {
  program
    .command("curve <mint>")
    .description("Full bonding curve snapshot: price, market cap, graduation progress")
    .action(async (mint: string) => {
      await runCurve(getContext(), mint);
    });

  program
    .command("price <mint>")
    .description("Current buy and sell price per token, plus market cap")
    .action(async (mint: string) => {
      await runPrice(getContext(), mint);
    });

  program
    .command("pool <mint>")
    .description("PumpAMM pool state for a graduated token")
    .action(async (mint: string) => {
      await runPool(getContext(), mint);
    });

  program
    .command("global")
    .description("Protocol-wide config: authorities, fee tiers, curve defaults")
    .action(async () => {
      await runGlobal(getContext());
    });
}

export async function runCurve(ctx: CliContext, mintArg: string): Promise<void> {
  const mint = parsePublicKey(mintArg, "mint");

  const [summary, progress, curve, global, feeConfig] = await Promise.all([
    ctx.sdk.fetchBondingCurveSummary(mint).catch(rethrowMissingCurve(mint.toBase58())),
    ctx.sdk.fetchGraduationProgress(mint),
    ctx.sdk.fetchBondingCurve(mint),
    ctx.sdk.fetchGlobal(),
    ctx.sdk.fetchFeeConfig(),
  ]);

  // Migration zeroes the curve's reserves, so a graduated token prices at zero
  // here and only the AMM pool knows what it is worth. Showing "0 SOL" would be
  // technically true and completely useless, so read the pool instead.
  const live = curve.complete ? await fetchPoolPricing(ctx, mint) : undefined;

  const fees = computeFeesBps({
    global,
    feeConfig,
    mintSupply: curve.tokenTotalSupply,
    virtualQuoteReserves: curve.virtualQuoteReserves,
    virtualTokenReserves: curve.virtualTokenReserves,
  });
  const totalFeeBps =
    fees.protocolFeeBps.toNumber() + fees.creatorFeeBps.toNumber();

  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        mint: mint.toBase58(),
        bondingCurve: bondingCurvePda(mint).toBase58(),
        creator: curve.creator.toBase58(),
        complete: curve.complete,
        mayhemMode: curve.isMayhemMode,
        cashbackCoin: curve.isCashbackCoin,
        marketCapLamports: summary.marketCap,
        marketCapSol: live?.marketCapSol ?? lamportsToSol(summary.marketCap),
        buyPricePerTokenLamports: summary.buyPricePerToken,
        sellPricePerTokenLamports: summary.sellPricePerToken,
        pool:
          live === undefined
            ? null
            : {
                address: live.pool,
                liquiditySol: live.liquiditySol,
                baseTokens: live.baseTokens,
                pricePerTokenSol: live.pricePerTokenSol,
              },
        graduation: {
          progressBps: progress.progressBps,
          isGraduated: progress.isGraduated,
          tokensRemaining: progress.tokensRemaining,
          tokensTotal: progress.tokensTotal,
          solAccumulatedLamports: progress.solAccumulated,
          solNeededToGraduateLamports: progress.solNeededToGraduate,
        },
        reserves: {
          virtualSol: curve.virtualQuoteReserves,
          virtualToken: curve.virtualTokenReserves,
          realSol: curve.realQuoteReserves,
          realToken: curve.realTokenReserves,
          tokenTotalSupply: curve.tokenTotalSupply,
        },
        fees: {
          protocolBps: fees.protocolFeeBps,
          creatorBps: fees.creatorFeeBps,
          totalBps: totalFeeBps,
        },
      })}\n`,
    );
    return;
  }

  const status = curve.complete
    ? c.green("graduated to PumpAMM")
    : c.cyan("live on the bonding curve");

  const priceRows =
    live === undefined
      ? [
          { label: "Market cap", value: c.bold(formatSol(summary.marketCap)) },
          { label: "Buy price", value: formatSol(summary.buyPricePerToken, 9), note: "per token" },
          { label: "Sell price", value: formatSol(summary.sellPricePerToken, 9), note: "per token" },
        ]
      : [
          {
            label: "Market cap",
            value: c.bold(`${formatCompact(live.marketCapSol)} SOL`),
            note: "from the AMM pool",
          },
          {
            label: "Price",
            value: `${live.pricePerTokenSol.toPrecision(6)} SOL`,
            note: "per token, pool spot",
          },
          {
            label: "Pool liquidity",
            value: `${formatCompact(live.liquiditySol)} SOL / ${formatCompact(live.baseTokens)} tokens`,
          },
        ];

  const lines = [
    heading(mintArg, status),
    "",
    keyValue([
      ...priceRows,
      { label: "Trading fee", value: formatBps(totalFeeBps), note: `${formatBps(fees.protocolFeeBps.toNumber())} protocol + ${formatBps(fees.creatorFeeBps.toNumber())} creator` },
    ]),
    "",
    ...(live === undefined
      ? [
          `  ${c.dim("Graduation")}  ${meter(progress.progressBps / 10_000)}`,
          "",
          keyValue([
            {
              label: "SOL to graduate",
              value: formatSol(progress.solNeededToGraduate),
            },
            { label: "SOL in curve", value: formatSol(progress.solAccumulated) },
            {
              label: "Tokens left",
              value: formatTokens(progress.tokensRemaining),
              note: `of ${formatTokens(progress.tokensTotal)}`,
            },
            {
              label: "Virtual reserves",
              value: `${formatSol(curve.virtualQuoteReserves)} / ${formatTokens(curve.virtualTokenReserves)} tokens`,
            },
            {
              label: "Real reserves",
              value: `${formatSol(curve.realQuoteReserves)} / ${formatTokens(curve.realTokenReserves)} tokens`,
            },
            { label: "Total supply", value: formatTokens(curve.tokenTotalSupply) },
          ]),
        ]
      : [
          keyValue([
            { label: "Total supply", value: formatTokens(curve.tokenTotalSupply) },
            { label: "Pool", value: live.pool },
          ]),
          "",
          `  ${c.dim(`The bonding curve is retired and reads zero on chain. Run \`pump pool ${mintArg}\` for the full pool state.`)}`,
        ]),
    "",
    keyValue([
      { label: "Creator", value: curve.creator.toBase58() },
      { label: "Curve PDA", value: bondingCurvePda(mint).toBase58() },
      ...(curve.isMayhemMode ? [{ label: "Mayhem mode", value: c.magenta("enabled") }] : []),
      ...(curve.isCashbackCoin ? [{ label: "Cashback", value: c.green("enabled") }] : []),
    ]),
    "",
    keyValue([
      { label: "pump.fun", value: c.dim(pumpFunUrl(mint.toBase58())) },
      { label: "Solscan", value: c.dim(solscanToken(mint.toBase58())) },
    ]),
    "",
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

async function runPrice(ctx: CliContext, mintArg: string): Promise<void> {
  const mint = parsePublicKey(mintArg, "mint");
  const price = await ctx.sdk
    .fetchTokenPrice(mint)
    .catch(rethrowMissingCurve(mint.toBase58()));

  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        mint: mint.toBase58(),
        buyPricePerTokenLamports: price.buyPricePerToken,
        sellPricePerTokenLamports: price.sellPricePerToken,
        buyPricePerTokenSol: lamportsToSol(price.buyPricePerToken),
        sellPricePerTokenSol: lamportsToSol(price.sellPricePerToken),
        marketCapLamports: price.marketCap,
        marketCapSol: lamportsToSol(price.marketCap),
        isGraduated: price.isGraduated,
      })}\n`,
    );
    return;
  }

  const spread =
    price.buyPricePerToken.isZero()
      ? 0
      : price.buyPricePerToken
          .sub(price.sellPricePerToken)
          .muln(10_000)
          .div(price.buyPricePerToken)
          .toNumber();

  process.stdout.write(
    `${[
      heading(mintArg, price.isGraduated ? "graduated" : "bonding curve"),
      "",
      keyValue([
        { label: "Buy", value: c.bold(formatSol(price.buyPricePerToken, 9)), note: "per token" },
        { label: "Sell", value: formatSol(price.sellPricePerToken, 9), note: "per token" },
        { label: "Spread", value: formatBps(spread), note: "fees included" },
        { label: "Market cap", value: c.bold(formatSol(price.marketCap)) },
      ]),
      "",
    ].join("\n")}\n`,
  );
}

async function runPool(ctx: CliContext, mintArg: string): Promise<void> {
  const mint = parsePublicKey(mintArg, "mint");
  const poolAddress = canonicalPumpPoolPda(mint);

  let pool;
  try {
    pool = await ctx.sdk.fetchPool(mint);
  } catch {
    throw new CliError(
      `No PumpAMM pool exists for ${mintArg}`,
      "The token has not graduated yet. Run `pump curve <mint>` to see how far it is from graduation.",
    );
  }

  const [baseBalance, quoteBalance] = await Promise.all([
    ctx.connection
      .getTokenAccountBalance(pool.poolBaseTokenAccount)
      .catch(() => null),
    ctx.connection
      .getTokenAccountBalance(pool.poolQuoteTokenAccount)
      .catch(() => null),
  ]);

  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        mint: mint.toBase58(),
        pool: poolAddress.toBase58(),
        index: pool.index,
        creator: pool.creator.toBase58(),
        coinCreator: pool.coinCreator.toBase58(),
        baseMint: pool.baseMint.toBase58(),
        quoteMint: pool.quoteMint.toBase58(),
        lpMint: pool.lpMint.toBase58(),
        lpSupply: pool.lpSupply,
        baseReserve: baseBalance?.value.amount ?? null,
        quoteReserve: quoteBalance?.value.amount ?? null,
        mayhemMode: pool.isMayhemMode,
        cashbackCoin: pool.isCashbackCoin,
      })}\n`,
    );
    return;
  }

  const quoteSol =
    quoteBalance === null ? null : Number(quoteBalance.value.uiAmountString);
  const baseTokens =
    baseBalance === null ? null : Number(baseBalance.value.uiAmountString);
  const impliedPrice =
    quoteSol !== null && baseTokens !== null && baseTokens > 0
      ? quoteSol / baseTokens
      : null;

  process.stdout.write(
    `${[
      heading(mintArg, "PumpAMM pool"),
      "",
      keyValue([
        {
          label: "Liquidity",
          value:
            quoteSol === null
              ? c.dim("unavailable")
              : `${c.bold(`${quoteSol.toFixed(4)} SOL`)} / ${baseTokens === null ? "?" : formatCompact(baseTokens)} tokens`,
        },
        {
          label: "Implied price",
          value:
            impliedPrice === null
              ? c.dim("unavailable")
              : `${impliedPrice.toPrecision(6)} SOL per token`,
        },
        { label: "LP supply", value: formatCompact(rawToTokens(pool.lpSupply, 9)) },
        { label: "Pool index", value: String(pool.index) },
      ]),
      "",
      keyValue([
        { label: "Pool", value: poolAddress.toBase58() },
        { label: "LP mint", value: pool.lpMint.toBase58() },
        { label: "Coin creator", value: pool.coinCreator.toBase58() },
        { label: "Creator vault", value: creatorVaultPda(pool.coinCreator).toBase58() },
        { label: "Solscan", value: c.dim(solscanAccount(poolAddress.toBase58())) },
      ]),
      "",
    ].join("\n")}\n`,
  );
}

async function runGlobal(ctx: CliContext): Promise<void> {
  const [global, feeConfig] = await Promise.all([
    ctx.sdk.fetchGlobal(),
    ctx.sdk.fetchFeeConfig(),
  ]);

  if (ctx.json) {
    process.stdout.write(`${toJson({ global, feeConfig })}\n`);
    return;
  }

  const tiers = feeConfig.feeTiers ?? [];
  const tierLines = tiers.slice(0, 8).map((tier, index) => ({
    label: `Tier ${index + 1}`,
    value: `${formatBps(
      Number(tier.fees.protocolFeeBps) + Number(tier.fees.creatorFeeBps),
    )} above ${formatSol(new BN(tier.marketCapLamportsThreshold.toString()))} cap`,
  }));

  process.stdout.write(
    `${[
      heading("Pump protocol", "global config"),
      "",
      keyValue([
        { label: "Initialized", value: global.initialized ? c.green("yes") : c.red("no") },
        { label: "Authority", value: global.authority.toBase58() },
        { label: "Withdraw authority", value: global.withdrawAuthority.toBase58() },
        { label: "Fee recipient", value: global.feeRecipient.toBase58() },
      ]),
      "",
      keyValue([
        { label: "Initial virtual SOL", value: formatSol(global.initialVirtualSolReserves) },
        { label: "Initial virtual tokens", value: formatTokens(global.initialVirtualTokenReserves) },
        { label: "Initial real tokens", value: formatTokens(global.initialRealTokenReserves) },
        { label: "Token total supply", value: formatTokens(global.tokenTotalSupply) },
      ]),
      ...(tierLines.length > 0
        ? ["", c.dim("  Fee tiers"), keyValue(tierLines, "  ")]
        : []),
      "",
    ].join("\n")}\n`,
  );
}

interface PoolPricing {
  pool: string;
  liquiditySol: number;
  baseTokens: number;
  pricePerTokenSol: number;
  marketCapSol: number;
}

/**
 * Spot-price a graduated token from its AMM pool reserves.
 *
 * Returns undefined rather than throwing when the pool is unreadable: a curve
 * flagged complete whose pool has not been created yet is a real, transient
 * state during migration, and it should degrade to the curve view rather than
 * failing the whole command.
 */
async function fetchPoolPricing(
  ctx: CliContext,
  mint: PublicKey,
): Promise<PoolPricing | undefined> {
  try {
    const pool = await ctx.sdk.fetchPool(mint);
    const [baseBalance, quoteBalance] = await Promise.all([
      ctx.connection.getTokenAccountBalance(pool.poolBaseTokenAccount),
      ctx.connection.getTokenAccountBalance(pool.poolQuoteTokenAccount),
    ]);

    const baseTokens = Number(baseBalance.value.uiAmountString ?? 0);
    const liquiditySol = Number(quoteBalance.value.uiAmountString ?? 0);
    if (baseTokens <= 0) return undefined;

    const pricePerTokenSol = liquiditySol / baseTokens;
    // Pump mints a fixed one billion supply, so market cap is price * supply.
    const supply = rawToTokens(await fetchMintSupply(ctx, mint));

    return {
      pool: canonicalPumpPoolPda(mint).toBase58(),
      liquiditySol,
      baseTokens,
      pricePerTokenSol,
      marketCapSol: pricePerTokenSol * supply,
    };
  } catch {
    return undefined;
  }
}

async function fetchMintSupply(ctx: CliContext, mint: PublicKey): Promise<BN> {
  const supply = await ctx.connection.getTokenSupply(mint);
  return new BN(supply.value.amount);
}

/** Turn the raw Anchor "account does not exist" into an actionable message. */
function rethrowMissingCurve(mint: string) {
  return (error: unknown): never => {
    const message = (error as Error).message ?? String(error);
    if (/does not exist|not found|Unable to find/i.test(message)) {
      throw new CliError(
        `No pump bonding curve exists for ${mint}`,
        "Check the mint address. Tokens launched outside pump.fun have no bonding curve, and graduated tokens keep theirs, so this usually means a typo or the wrong network.",
      );
    }
    throw error;
  };
}
