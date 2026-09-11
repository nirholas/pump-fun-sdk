/**
 * Example 34: Live Token Price
 *
 * Category: Live Data
 *
 * Fetches what one whole token costs to buy and what it returns on a sell
 * with fetchTokenPrice, then derives the fee-free spot price straight from
 * the curve's reserves. The spread between the three numbers is exactly the
 * protocol and creator fee load.
 *
 * Run: npm run example 34
 */
import { OnlinePumpSdk, type BondingCurve } from "@nirholas/pump-sdk";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { findActiveCurveMint } from "./_lib/discovery";
import { divToDecimalString, formatSol, heading, row } from "./_lib/format";

/** 1 whole Pump token = 1e6 raw units (6 decimals). */
const TOKEN_UNITS = new BN(1_000_000);

/**
 * Fee-free spot price of one whole token, in lamports.
 *
 * The bonding curve is a constant product over its virtual reserves, so the
 * marginal price is `virtualSolReserves / virtualTokenReserves` per raw
 * unit. Multiplying by 1e6 first (never dividing first) keeps the whole
 * computation in integers: on a fresh curve the per-raw-unit price is a
 * small fraction of a lamport and would round to zero.
 *
 * A migrated curve has zeroed reserves and no price at all; it returns 0,
 * matching what the SDK's own analytics report for that state.
 */
export function priceFromReserves(bondingCurve: BondingCurve): BN {
  if (bondingCurve.virtualTokenReserves.isZero()) return new BN(0);
  return bondingCurve.virtualQuoteReserves
    .mul(TOKEN_UNITS)
    .div(bondingCurve.virtualTokenReserves);
}

/** Spread between two prices in basis points of the lower one. */
export function spreadBps(low: BN, high: BN): BN {
  if (low.isZero()) return new BN(0);
  return high.sub(low).muln(10_000).div(low);
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
  const { mint, bondingCurve } = await findActiveCurveMint(connection);
  row("Mint", mint.toBase58());
  row("Virtual SOL reserves", formatSol(bondingCurve.virtualQuoteReserves));
  row("Virtual token reserves", bondingCurve.virtualTokenReserves.toString());

  const price = await rpc("fetchTokenPrice", () => online.fetchTokenPrice(mint));

  heading("fetchTokenPrice (1 whole token)");
  row("Buy price", `${price.buyPricePerToken.toString()} lamports`);
  row("Sell price", `${price.sellPricePerToken.toString()} lamports`);
  row("Market cap", formatSol(price.marketCap, 2));
  row("Graduated", price.isGraduated);

  heading("Spot price from reserves (no fees, no RPC)");
  const spot = priceFromReserves(bondingCurve);
  row("Spot price", `${spot.toString()} lamports`);
  console.log("spot = virtualSolReserves * 1e6 / virtualTokenReserves");
  console.log(
    "The reserves came back with the curve account, so this costs nothing",
  );
  console.log("extra to compute and needs no second RPC round trip.");

  heading("Why the three numbers differ");
  row("Buy over spot", `${spreadBps(spot, price.buyPricePerToken).toString()} bps`);
  row("Spot over sell", `${spreadBps(price.sellPricePerToken, spot).toString()} bps`);
  row(
    "Round-trip cost",
    `${divToDecimalString(spreadBps(price.sellPricePerToken, price.buyPricePerToken), new BN(100), 2)}%`,
  );
  console.log(
    "Buying pays the protocol and creator fees on the way in and selling pays",
  );
  console.log(
    "them again on the way out, so the fee-free spot price sits between the",
  );
  console.log(
    "two. Buy immediately followed by sell loses that round-trip spread.",
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
