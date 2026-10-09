/**
 * Example 26: Parse Transaction Events
 *
 * Category: Accounts & Events
 *
 * Turns one confirmed signature into strongly-typed protocol events with
 * OnlinePumpSdk.parseTransactionEvents, then classifies them: which of the
 * three programs emitted what, which mints the transaction touched, and
 * how much SOL actually moved. The classification step is pure, so it is
 * testable without a network.
 *
 * Run: npm run example 26
 */
import { OnlinePumpSdk, type PumpEvent } from "@nirholas/pump-sdk";
import { PUMP_PROGRAM_ID } from "@nirholas/pump-sdk";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { collectStreamSignatures, mintFromEvent } from "./_lib/discovery";
import { formatSol, formatTokens, heading, row } from "./_lib/format";
import { withRpcRetry } from "./25-decode-pool";

/** Which of the three Pump programs an event type belongs to. */
export type EventProgramFamily = "pump" | "amm" | "fees";

/**
 * PumpAMM event types that do not carry the `amm` name prefix. Every other
 * AMM type is prefixed, so prefix plus this set covers the union exactly.
 */
const AMM_UNPREFIXED: ReadonlySet<string> = new Set([
  "deposit",
  "withdraw",
  "createPool",
  "sweepPoolFee",
]);

/** PumpFees event types that do not carry the `fees` name prefix. */
const FEES_UNPREFIXED: ReadonlySet<string> = new Set([
  "createFeeSharingConfig",
  "updateFeeShares",
  "resetFeeSharingConfig",
  "revokeFeeSharingAuthority",
  "transferFeeSharingAuthority",
  "socialFeePdaCreated",
  "socialFeePdaClaimed",
]);

/**
 * Route an event type back to the program that emitted it.
 *
 * This matters because the three programs share event NAMES: a
 * `claimCashback` from the bonding curve and an `ammClaimCashback` from the
 * AMM have the same anchor discriminator and different layouts. The SDK
 * disambiguates them while parsing, using the invoke stack in the logs, and
 * encodes the answer in the union's type tag. Reading the tag back is all
 * the classification a consumer needs.
 */
export function programFamilyOf(type: PumpEvent["type"]): EventProgramFamily {
  if (type.startsWith("amm") || AMM_UNPREFIXED.has(type)) return "amm";
  if (type.startsWith("fees") || FEES_UNPREFIXED.has(type)) return "fees";
  return "pump";
}

export interface TradeTotals {
  buys: number;
  sells: number;
  /** SOL legs summed in lamports. */
  solVolume: BN;
  /** Token legs summed in base units. */
  tokenVolume: BN;
  /** Protocol plus creator fees, in lamports (bonding curve trades only). */
  feesPaid: BN;
}

export interface TransactionEventSummary {
  total: number;
  /** Event counts by type, most frequent first, then alphabetical. */
  byType: Array<{ type: PumpEvent["type"]; count: number }>;
  byProgram: Record<EventProgramFamily, number>;
  /** Mints named by the events, in first-seen order. */
  mints: string[];
  /** Bonding curve trades. */
  curveTrades: TradeTotals;
  /** PumpAMM swaps; volumes are the quote (SOL) leg. */
  ammSwaps: TradeTotals;
}

function emptyTotals(): TradeTotals {
  return {
    buys: 0,
    sells: 0,
    solVolume: new BN(0),
    tokenVolume: new BN(0),
    feesPaid: new BN(0),
  };
}

/**
 * Classify and total a list of protocol events. Pure: every amount stays a
 * BN, and nothing here touches the network.
 */
export function summarizeEvents(
  events: readonly PumpEvent[],
): TransactionEventSummary {
  const counts = new Map<PumpEvent["type"], number>();
  const byProgram: Record<EventProgramFamily, number> = {
    pump: 0,
    amm: 0,
    fees: 0,
  };
  const mints: string[] = [];
  const seenMints = new Set<string>();
  const curveTrades = emptyTotals();
  const ammSwaps = emptyTotals();

  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    byProgram[programFamilyOf(event.type)] += 1;

    const mint = mintFromEvent(event);
    if (mint && !seenMints.has(mint.toBase58())) {
      seenMints.add(mint.toBase58());
      mints.push(mint.toBase58());
    }

    if (event.type === "trade") {
      const { solAmount, tokenAmount, isBuy, fee, creatorFee } = event.data;
      if (isBuy) curveTrades.buys += 1;
      else curveTrades.sells += 1;
      curveTrades.solVolume = curveTrades.solVolume.add(solAmount);
      curveTrades.tokenVolume = curveTrades.tokenVolume.add(tokenAmount);
      curveTrades.feesPaid = curveTrades.feesPaid.add(fee).add(creatorFee);
    } else if (event.type === "ammBuy") {
      const d = event.data;
      ammSwaps.buys += 1;
      ammSwaps.solVolume = ammSwaps.solVolume.add(d.quoteAmountIn);
      ammSwaps.tokenVolume = ammSwaps.tokenVolume.add(d.baseAmountOut);
      ammSwaps.feesPaid = ammSwaps.feesPaid
        .add(d.lpFee)
        .add(d.protocolFee)
        .add(d.coinCreatorFee);
    } else if (event.type === "ammSell") {
      const d = event.data;
      ammSwaps.sells += 1;
      ammSwaps.solVolume = ammSwaps.solVolume.add(d.quoteAmountOut);
      ammSwaps.tokenVolume = ammSwaps.tokenVolume.add(d.baseAmountIn);
      ammSwaps.feesPaid = ammSwaps.feesPaid
        .add(d.lpFee)
        .add(d.protocolFee)
        .add(d.coinCreatorFee);
    }
  }

  const byType = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  return {
    total: events.length,
    byType,
    byProgram,
    mints,
    curveTrades,
    ammSwaps,
  };
}

export async function main(): Promise<void> {
  const connection = getConnection();
  const online = new OnlinePumpSdk(connection);

  heading("Finding a recent Pump transaction");
  const override = process.env.SIGNATURE;
  const signatures = override
    ? [override]
    : await collectStreamSignatures(connection, PUMP_PROGRAM_ID, 3);
  console.log(
    override
      ? "Using the signature from the SIGNATURE environment variable."
      : `Captured ${signatures.length} signatures from the live Pump log stream.`,
  );

  let signature = "";
  let events: PumpEvent[] = [];
  for (const candidate of signatures) {
    const parsed = await withRpcRetry(`parse ${candidate.slice(0, 8)}`, () =>
      online.parseTransactionEvents(candidate),
    );
    if (parsed.length > 0) {
      signature = candidate;
      events = parsed;
      break;
    }
  }

  if (events.length === 0) {
    throw new Error(
      "No Pump events decoded from the sampled transactions. The RPC may not " +
        "have served the transaction yet; retry, set PUMP_RPC_URL, or pass " +
        "SIGNATURE=<signature>.",
    );
  }

  row("Signature", signature);
  row("Events decoded", events.length);

  heading("Events in log order");
  events.forEach((event, i) => {
    row(`${i + 1}. ${event.type}`, programFamilyOf(event.type));
  });

  heading("Summary");
  const summary = summarizeEvents(events);
  for (const { type, count } of summary.byType) {
    row(type, count);
  }
  row("Pump / AMM / Fees", `${summary.byProgram.pump} / ${summary.byProgram.amm} / ${summary.byProgram.fees}`);
  row("Mints touched", summary.mints.length);
  for (const mint of summary.mints) row("  mint", mint);

  heading("Trade totals");
  row("Curve buys / sells", `${summary.curveTrades.buys} / ${summary.curveTrades.sells}`);
  row("Curve SOL volume", formatSol(summary.curveTrades.solVolume));
  row("Curve token volume", formatTokens(summary.curveTrades.tokenVolume));
  row("Curve fees paid", formatSol(summary.curveTrades.feesPaid, 6));
  row("AMM buys / sells", `${summary.ammSwaps.buys} / ${summary.ammSwaps.sells}`);
  row("AMM quote volume", formatSol(summary.ammSwaps.solVolume));
  row("AMM fees paid", formatSol(summary.ammSwaps.feesPaid, 6));

  heading("Why the program matters");
  console.log(
    "parseTransactionEvents tracks the `Program ... invoke` lines while it",
  );
  console.log(
    "walks the logs, so a `Program data:` entry is decoded with the table of",
  );
  console.log(
    "the program that emitted it. Without that context a shared event name",
  );
  console.log(
    "such as ClaimCashbackEvent would decode with the wrong layout.",
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
