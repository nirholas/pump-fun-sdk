/**
 * Example 11: Buy Quotes, Fully Offline
 *
 * Category: Curve Math & Fees
 *
 * Quotes bonding curve buys in both directions with zero network access:
 * SOL in to tokens out, and tokens wanted to SOL cost. The same math the
 * on-chain program runs, so you can price trades, build UIs, or sanity
 * check fills without an RPC endpoint.
 *
 * Run: npm run example 11
 */
import {
  getBuySolAmountFromTokenAmount,
  getBuyTokenAmountFromSolAmount,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

import type { BondingCurve, Global } from "@nirholas/pump-sdk";

import { launchBondingCurve, mainnetGlobal } from "./_lib/curveState";
import { divToDecimalString, formatSol, formatTokens, heading, row } from "./_lib/format";

export interface QuoteContext {
  global: Global;
  bondingCurve: BondingCurve;
  mintSupply: BN;
}

/** A fresh mainnet-shaped launch state, the default for every quote here. */
export function launchContext(): QuoteContext {
  const global = mainnetGlobal();
  return {
    global,
    bondingCurve: launchBondingCurve(),
    mintSupply: global.tokenTotalSupply,
  };
}

/** How many tokens a given SOL spend buys (fees included in the spend). */
export function quoteTokensForSol(ctx: QuoteContext, solIn: BN): BN {
  return getBuyTokenAmountFromSolAmount({
    global: ctx.global,
    feeConfig: null,
    mintSupply: ctx.mintSupply,
    bondingCurve: ctx.bondingCurve,
    amount: solIn,
  });
}

/** How much SOL it costs to buy a given token amount (fees included). */
export function quoteSolForTokens(ctx: QuoteContext, tokenAmount: BN): BN {
  return getBuySolAmountFromTokenAmount({
    global: ctx.global,
    feeConfig: null,
    mintSupply: ctx.mintSupply,
    bondingCurve: ctx.bondingCurve,
    amount: tokenAmount,
  });
}

export interface RoundTrip {
  solIn: BN;
  tokensOut: BN;
  solToBuySameTokens: BN;
  /** |solToBuySameTokens - solIn| in basis points of solIn. */
  driftBps: BN;
}

/**
 * Quote SOL to tokens, then quote those tokens back to SOL. The two
 * directions share one fee model, so the reconstructed cost lands within
 * integer-rounding distance of the original spend.
 */
export function roundTrip(ctx: QuoteContext, solIn: BN): RoundTrip {
  const tokensOut = quoteTokensForSol(ctx, solIn);
  const solToBuySameTokens = quoteSolForTokens(ctx, tokensOut);
  const diff = solToBuySameTokens.sub(solIn).abs();
  return {
    solIn,
    tokensOut,
    solToBuySameTokens,
    driftBps: diff.muln(10_000).div(solIn),
  };
}

export interface QuoteRow {
  solIn: BN;
  tokensOut: BN;
  /** Lamports paid per 1,000,000 whole tokens received. */
  lamportsPerMillionTokens: BN;
}

/** Quote a list of buy sizes against the same curve state. */
export function buildBuyQuoteTable(ctx: QuoteContext, solAmounts: BN[]): QuoteRow[] {
  return solAmounts.map((solIn) => {
    const tokensOut = quoteTokensForSol(ctx, solIn);
    return {
      solIn,
      tokensOut,
      // 1M whole tokens = 1e12 base units; all-BN average execution price.
      lamportsPerMillionTokens: solIn.mul(new BN("1000000000000")).div(tokensOut),
    };
  });
}

export async function main(): Promise<void> {
  const ctx = launchContext();

  heading("Curve state (fresh mainnet launch)");
  row("Virtual SOL reserves", formatSol(ctx.bondingCurve.virtualQuoteReserves));
  row("Virtual token reserves", formatTokens(ctx.bondingCurve.virtualTokenReserves));
  row("Real token reserves", formatTokens(ctx.bondingCurve.realTokenReserves));
  row("Protocol fee", `${ctx.global.feeBasisPoints.toString()} bps`);

  heading("Buy quotes (SOL in, tokens out)");
  const sizes = [
    new BN("100000000"), // 0.1 SOL
    new BN("500000000"), // 0.5 SOL
    new BN("1000000000"), // 1 SOL
    new BN("5000000000"), // 5 SOL
  ];
  for (const line of buildBuyQuoteTable(ctx, sizes)) {
    row(
      formatSol(line.solIn),
      `${formatTokens(line.tokensOut)}  (avg ${formatSol(
        line.lamportsPerMillionTokens,
        6,
      )} per 1M tokens)`,
    );
  }

  heading("Reverse quote (tokens wanted, SOL cost)");
  const wanted = new BN("10000000000000"); // 10M tokens
  row("Tokens wanted", formatTokens(wanted));
  row("SOL cost (fees included)", formatSol(quoteSolForTokens(ctx, wanted), 6));

  heading("Round-trip consistency");
  for (const solIn of sizes) {
    const trip = roundTrip(ctx, solIn);
    row(
      formatSol(trip.solIn),
      `rebuilds to ${formatSol(trip.solToBuySameTokens, 6)}  drift ${divToDecimalString(
        trip.driftBps,
        new BN(1),
        0,
      )} bps`,
    );
  }
  console.log(
    "\nBoth directions price through the same constant-product pool and the",
  );
  console.log(
    "same fee schedule, so a quote and its reverse agree to rounding dust.",
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
