/**
 * Example 36: Live Quotes Beside Offline Math
 *
 * Category: Live Data
 *
 * Runs quoteBuy and quoteSell against a live curve and puts the buy quote
 * next to the same trade computed offline with getBuyTokenAmountFromSolAmount.
 * Both print, and the drift between them is measured in basis points: the
 * SDK's online path is the offline formula plus a state fetch, nothing more.
 *
 * Run: npm run example 36
 */
import {
  OnlinePumpSdk,
  bondingCurvePda,
  getBuyTokenAmountFromSolAmount,
  type BondingCurve,
  type FeeConfig,
  type Global,
} from "@nirholas/pump-sdk";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { findActiveCurveMint } from "./_lib/discovery";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

/** Result of holding the online quote against the offline formula. */
export interface QuoteComparison {
  /** Tokens the online quoteBuy returned. */
  online: BN;
  /** Tokens the offline curve math returned for the same state. */
  offline: BN;
  /** Absolute difference in basis points of the online figure. */
  driftBps: BN;
  /** True when the drift is inside the tolerance. */
  agree: boolean;
}

/**
 * Compare an online quote against the offline computation of the same trade.
 *
 * On identical curve state the two are bit-for-bit equal, because quoteBuy
 * calls the same integer math this compares it to. Any drift on a live run
 * is the curve moving between the two reads, so the tolerance is expressed
 * in basis points rather than demanding exact equality.
 */
export function compareBuyQuotes(
  online: BN,
  offline: BN,
  toleranceBps: BN = new BN(50),
): QuoteComparison {
  if (online.isZero()) {
    throw new Error("Online quote returned zero tokens; nothing to compare");
  }
  const driftBps = online.sub(offline).abs().muln(10_000).div(online);
  return { online, offline, driftBps, agree: driftBps.lte(toleranceBps) };
}

/** The offline half of the comparison: pure curve math, no RPC. */
export function offlineBuyQuote({
  global,
  feeConfig,
  bondingCurve,
  solAmount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  bondingCurve: BondingCurve;
  solAmount: BN;
}): BN {
  return getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: solAmount,
  });
}

/**
 * An account that certainly holds the token, so a sell can be quoted.
 *
 * quoteSell reads the seller's associated token account and refuses to
 * quote a position that does not exist. The bonding curve's own vault is
 * the one account guaranteed to hold an unsold token, and it costs nothing
 * to derive. The seller's identity never enters the pricing math: it only
 * has to exist, so quoting against the vault gives the same numbers any
 * holder would see.
 */
export function quoteSeller(mint: PublicKey): PublicKey {
  return bondingCurvePda(mint);
}

/** One paced retry when the public RPC rate limits the run. */
async function rpc<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/429|rate limit|Too Many Requests/i.test(message)) throw error;
    console.log(
      `${label}: public RPC rate limited. Retrying once in 2s (set PUMP_RPC_URL for a dedicated endpoint).`,
    );
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    return await run();
  }
}

export async function main(): Promise<void> {
  const connection = getConnection();
  const online = new OnlinePumpSdk(connection);

  heading("Live token");
  const { mint } = await findActiveCurveMint(connection);
  row("Mint", mint.toBase58());

  const solAmount = new BN(100_000_000); // 0.1 SOL
  const quoteUser = PublicKey.default;

  heading("Online: quoteBuy");
  const buy = await rpc("quoteBuy", () =>
    online.quoteBuy({ mint, user: quoteUser, solAmount }),
  );
  row("Spend", formatSol(solAmount));
  row("Tokens out", formatTokens(buy.tokensOut));
  row("Fees", formatSol(buy.feesLamports, 6));
  row("Price impact", `${buy.priceImpactBps} bps`);

  heading("Offline: getBuyTokenAmountFromSolAmount");
  const [global, feeConfig, bondingCurve] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
    online.fetchBondingCurve(mint),
  ]);
  const offline = offlineBuyQuote({ global, feeConfig, bondingCurve, solAmount });
  row("Tokens out", formatTokens(offline));
  row("Virtual SOL reserves", formatSol(bondingCurve.virtualQuoteReserves));

  heading("Agreement");
  const comparison = compareBuyQuotes(buy.tokensOut, offline);
  row("Online", comparison.online.toString());
  row("Offline", comparison.offline.toString());
  row("Drift", `${comparison.driftBps.toString()} bps`);
  row("Within tolerance", comparison.agree);
  console.log(
    "Zero drift means both reads saw the same curve. Nonzero drift is other",
  );
  console.log(
    "traders moving the reserves between the two fetches, not a difference",
  );
  console.log(
    "in the math: quoteBuy runs this exact formula on the state it fetched.",
  );

  heading("Online: quoteSell");
  const seller = quoteSeller(mint);
  const sellAmount = buy.tokensOut;
  const sell = await rpc("quoteSell", () =>
    online.quoteSell({ mint, user: seller, amount: sellAmount }),
  );
  row("Seller", `${seller.toBase58()} (curve vault)`);
  row("Tokens in", formatTokens(sellAmount));
  row("SOL out", formatSol(sell.solOut));
  row("Fees", formatSol(sell.feesLamports, 6));
  row("Price impact", `${sell.priceImpactBps} bps`);
  row("Max safe single sell", formatTokens(sell.maxSafeAmount, 0));
  row("Would overflow", sell.willOverflow);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
