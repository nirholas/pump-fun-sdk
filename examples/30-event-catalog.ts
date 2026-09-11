/**
 * Example 30: The Event Catalog
 *
 * Category: Accounts & Events
 *
 * A single table mapping every event decoder on PumpSdk to the IDL event it
 * decodes, its program, and its typed union tag, plus decodeAny(): hand it a
 * raw log buffer and it routes on the 8-byte discriminator instead of on a
 * guess. Discriminators collide across the three programs, so the emitting
 * program is part of the routing key.
 *
 * Run: npm run example 30
 */
import {
  PUMP_SDK,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  PumpAmmIdl,
  PumpFeesIdl,
  PumpIdl,
  type PumpEvent,
} from "@nirholas/pump-sdk";

import { getConnection } from "./_lib/connection";
import { collectStreamSignatures } from "./_lib/discovery";
import { heading, row } from "./_lib/format";
import { withRpcRetry } from "./25-decode-pool";
import { EVENT_DISCRIMINATOR_BYTES, programDataBuffers } from "./27-decode-trade-events";

/** The three programs that emit Pump protocol events. */
export type EventProgram = "pump" | "amm" | "fees";

/** One decoder, and everything needed to route a buffer to it. */
export interface CatalogEntry {
  /** Method name on PumpSdk, e.g. "decodeTradeEvent". */
  method: string;
  program: EventProgram;
  /** Event name in that program's IDL, e.g. "TradeEvent". */
  idlEvent: string;
  /** Tag the SDK's PumpEvent union uses for this event. */
  eventType: PumpEvent["type"];
}

/**
 * Every decode*Event method on PumpSdk, mapped to its event.
 *
 * The test for this example introspects PumpSdk.prototype and fails if a
 * decoder is missing here, so a new decoder cannot land uncatalogued.
 */
export const EVENT_DECODERS: readonly CatalogEntry[] = [
  // Pump bonding curve program
  { method: "decodeTradeEvent", program: "pump", idlEvent: "TradeEvent", eventType: "trade" },
  { method: "decodeCreateEvent", program: "pump", idlEvent: "CreateEvent", eventType: "create" },
  { method: "decodeCompleteEvent", program: "pump", idlEvent: "CompleteEvent", eventType: "complete" },
  { method: "decodeCompletePumpAmmMigrationEvent", program: "pump", idlEvent: "CompletePumpAmmMigrationEvent", eventType: "completePumpAmmMigration" },
  { method: "decodeSetCreatorEvent", program: "pump", idlEvent: "SetCreatorEvent", eventType: "setCreator" },
  { method: "decodeCollectCreatorFeeEvent", program: "pump", idlEvent: "CollectCreatorFeeEvent", eventType: "collectCreatorFee" },
  { method: "decodeClaimCashbackEvent", program: "pump", idlEvent: "ClaimCashbackEvent", eventType: "claimCashback" },
  { method: "decodeClaimTokenIncentivesEvent", program: "pump", idlEvent: "ClaimTokenIncentivesEvent", eventType: "claimTokenIncentives" },
  { method: "decodeExtendAccountEvent", program: "pump", idlEvent: "ExtendAccountEvent", eventType: "extendAccount" },
  { method: "decodeInitUserVolumeAccumulatorEvent", program: "pump", idlEvent: "InitUserVolumeAccumulatorEvent", eventType: "initUserVolumeAccumulator" },
  { method: "decodeSyncUserVolumeAccumulatorEvent", program: "pump", idlEvent: "SyncUserVolumeAccumulatorEvent", eventType: "syncUserVolumeAccumulator" },
  { method: "decodeCloseUserVolumeAccumulatorEvent", program: "pump", idlEvent: "CloseUserVolumeAccumulatorEvent", eventType: "closeUserVolumeAccumulator" },
  { method: "decodeAdminSetCreatorEvent", program: "pump", idlEvent: "AdminSetCreatorEvent", eventType: "adminSetCreator" },
  { method: "decodeMigrateBondingCurveCreatorEvent", program: "pump", idlEvent: "MigrateBondingCurveCreatorEvent", eventType: "migrateBondingCurveCreator" },
  { method: "decodeDistributeCreatorFeesEvent", program: "pump", idlEvent: "DistributeCreatorFeesEvent", eventType: "distributeCreatorFees" },

  // PumpAMM program
  { method: "decodeAmmBuyEvent", program: "amm", idlEvent: "BuyEvent", eventType: "ammBuy" },
  { method: "decodeAmmSellEvent", program: "amm", idlEvent: "SellEvent", eventType: "ammSell" },
  { method: "decodeDepositEvent", program: "amm", idlEvent: "DepositEvent", eventType: "deposit" },
  { method: "decodeWithdrawEvent", program: "amm", idlEvent: "WithdrawEvent", eventType: "withdraw" },
  { method: "decodeCreatePoolEvent", program: "amm", idlEvent: "CreatePoolEvent", eventType: "createPool" },
  { method: "decodeAmmAdminSetCoinCreatorEvent", program: "amm", idlEvent: "AdminSetCoinCreatorEvent", eventType: "ammAdminSetCoinCreator" },
  { method: "decodeAmmAdminUpdateTokenIncentivesEvent", program: "amm", idlEvent: "AdminUpdateTokenIncentivesEvent", eventType: "ammAdminUpdateTokenIncentives" },
  { method: "decodeAmmClaimCashbackEvent", program: "amm", idlEvent: "ClaimCashbackEvent", eventType: "ammClaimCashback" },
  { method: "decodeAmmClaimTokenIncentivesEvent", program: "amm", idlEvent: "ClaimTokenIncentivesEvent", eventType: "ammClaimTokenIncentives" },
  { method: "decodeAmmCloseUserVolumeAccumulatorEvent", program: "amm", idlEvent: "CloseUserVolumeAccumulatorEvent", eventType: "ammCloseUserVolumeAccumulator" },
  { method: "decodeAmmCollectCoinCreatorFeeEvent", program: "amm", idlEvent: "CollectCoinCreatorFeeEvent", eventType: "ammCollectCoinCreatorFee" },
  { method: "decodeAmmCreateConfigEvent", program: "amm", idlEvent: "CreateConfigEvent", eventType: "ammCreateConfig" },
  { method: "decodeAmmDisableEvent", program: "amm", idlEvent: "DisableEvent", eventType: "ammDisable" },
  { method: "decodeAmmExtendAccountEvent", program: "amm", idlEvent: "ExtendAccountEvent", eventType: "ammExtendAccount" },
  { method: "decodeAmmInitUserVolumeAccumulatorEvent", program: "amm", idlEvent: "InitUserVolumeAccumulatorEvent", eventType: "ammInitUserVolumeAccumulator" },
  { method: "decodeAmmMigratePoolCoinCreatorEvent", program: "amm", idlEvent: "MigratePoolCoinCreatorEvent", eventType: "ammMigratePoolCoinCreator" },
  { method: "decodeAmmReservedFeeRecipientsEvent", program: "amm", idlEvent: "ReservedFeeRecipientsEvent", eventType: "ammReservedFeeRecipients" },
  { method: "decodeAmmSetBondingCurveCoinCreatorEvent", program: "amm", idlEvent: "SetBondingCurveCoinCreatorEvent", eventType: "ammSetBondingCurveCoinCreator" },
  { method: "decodeAmmSetMetaplexCoinCreatorEvent", program: "amm", idlEvent: "SetMetaplexCoinCreatorEvent", eventType: "ammSetMetaplexCoinCreator" },
  { method: "decodeAmmSyncUserVolumeAccumulatorEvent", program: "amm", idlEvent: "SyncUserVolumeAccumulatorEvent", eventType: "ammSyncUserVolumeAccumulator" },
  { method: "decodeAmmUpdateAdminEvent", program: "amm", idlEvent: "UpdateAdminEvent", eventType: "ammUpdateAdmin" },
  { method: "decodeAmmUpdateFeeConfigEvent", program: "amm", idlEvent: "UpdateFeeConfigEvent", eventType: "ammUpdateFeeConfig" },

  // PumpFees program
  { method: "decodeCreateFeeSharingConfigEvent", program: "fees", idlEvent: "CreateFeeSharingConfigEvent", eventType: "createFeeSharingConfig" },
  { method: "decodeUpdateFeeSharesEvent", program: "fees", idlEvent: "UpdateFeeSharesEvent", eventType: "updateFeeShares" },
  { method: "decodeResetFeeSharingConfigEvent", program: "fees", idlEvent: "ResetFeeSharingConfigEvent", eventType: "resetFeeSharingConfig" },
  { method: "decodeSocialFeePdaCreatedEvent", program: "fees", idlEvent: "SocialFeePdaCreated", eventType: "socialFeePdaCreated" },
  { method: "decodeSocialFeePdaClaimedEvent", program: "fees", idlEvent: "SocialFeePdaClaimed", eventType: "socialFeePdaClaimed" },
  { method: "decodeFeesInitializeFeeConfigEvent", program: "fees", idlEvent: "InitializeFeeConfigEvent", eventType: "feesInitializeFeeConfig" },
  { method: "decodeFeesInitializeFeeProgramGlobalEvent", program: "fees", idlEvent: "InitializeFeeProgramGlobalEvent", eventType: "feesInitializeFeeProgramGlobal" },
  { method: "decodeFeesSetAuthorityEvent", program: "fees", idlEvent: "SetAuthorityEvent", eventType: "feesSetAuthority" },
  { method: "decodeFeesSetClaimRateLimitEvent", program: "fees", idlEvent: "SetClaimRateLimitEvent", eventType: "feesSetClaimRateLimit" },
  { method: "decodeFeesSetDisableFlagsEvent", program: "fees", idlEvent: "SetDisableFlagsEvent", eventType: "feesSetDisableFlags" },
  { method: "decodeFeesSetSocialClaimAuthorityEvent", program: "fees", idlEvent: "SetSocialClaimAuthorityEvent", eventType: "feesSetSocialClaimAuthority" },
  { method: "decodeFeesUpdateAdminEvent", program: "fees", idlEvent: "UpdateAdminEvent", eventType: "feesUpdateAdmin" },
  { method: "decodeFeesUpdateFeeConfigEvent", program: "fees", idlEvent: "UpdateFeeConfigEvent", eventType: "feesUpdateFeeConfig" },
  { method: "decodeFeesUpsertFeeTiersEvent", program: "fees", idlEvent: "UpsertFeeTiersEvent", eventType: "feesUpsertFeeTiers" },
];

interface IdlEvents {
  events: Array<{ name: string; discriminator: number[] }>;
}

const IDLS: Record<EventProgram, IdlEvents> = {
  pump: PumpIdl as IdlEvents,
  amm: PumpAmmIdl as IdlEvents,
  fees: PumpFeesIdl as IdlEvents,
};

/** Program ids, in the order decodeAny tries them without a hint. */
export const PROGRAM_IDS: Record<EventProgram, string> = {
  pump: PUMP_PROGRAM_ID.toBase58(),
  amm: PUMP_AMM_PROGRAM_ID.toBase58(),
  fees: PUMP_FEE_PROGRAM_ID.toBase58(),
};

/** The 8-byte anchor discriminator of a catalog entry, as hex. */
export function discriminatorOf(entry: CatalogEntry): string {
  const event = IDLS[entry.program].events.find(
    (e) => e.name === entry.idlEvent,
  );
  if (!event) {
    throw new Error(
      `The ${entry.program} IDL has no event named "${entry.idlEvent}"`,
    );
  }
  return Buffer.from(event.discriminator).toString("hex");
}

/**
 * Discriminator to catalog entries, built once from the IDLs.
 *
 * A discriminator is the first 8 bytes of sha256("event:<Name>"), so two
 * programs that name an event identically produce the same key. That is not
 * a hash collision, it is the same name: ClaimCashbackEvent exists on both
 * the bonding curve and the AMM with different layouts. The value is a list
 * for exactly that reason.
 */
export const DISCRIMINATOR_INDEX: ReadonlyMap<string, CatalogEntry[]> = (() => {
  const index = new Map<string, CatalogEntry[]>();
  for (const entry of EVENT_DECODERS) {
    const key = discriminatorOf(entry);
    const bucket = index.get(key);
    if (bucket) bucket.push(entry);
    else index.set(key, [entry]);
  }
  return index;
})();

export interface DecodedEvent {
  entry: CatalogEntry;
  event: PumpEvent;
}

/**
 * Decode any protocol event buffer by its discriminator.
 *
 * Pass the emitting program when you know it (the invoke stack in the logs
 * tells you); without it the candidates are tried in catalog order and the
 * first layout that parses wins, which is what the SDK's own log parser
 * does. Returns null for a buffer this protocol did not emit.
 */
export function decodeAny(
  buffer: Buffer,
  program?: EventProgram,
): DecodedEvent | null {
  if (buffer.length < EVENT_DISCRIMINATOR_BYTES) return null;
  const key = buffer.subarray(0, EVENT_DISCRIMINATOR_BYTES).toString("hex");
  const payload = buffer.subarray(EVENT_DISCRIMINATOR_BYTES);
  const candidates = (DISCRIMINATOR_INDEX.get(key) ?? []).filter(
    (entry) => !program || entry.program === program,
  );

  for (const entry of candidates) {
    const decode = (
      PUMP_SDK as unknown as Record<string, (data: Buffer) => unknown>
    )[entry.method];
    if (!decode) continue;
    try {
      const data = decode.call(PUMP_SDK, payload);
      // The catalog pairs each eventType tag with the decoder that produces
      // that variant's data, which is precisely the union's shape.
      return { entry, event: { type: entry.eventType, data } as unknown as PumpEvent };
    } catch {
      // Right discriminator, wrong program: try the next candidate.
    }
  }
  return null;
}

/** Catalog entries for one program. */
export function decodersFor(program: EventProgram): CatalogEntry[] {
  return EVENT_DECODERS.filter((entry) => entry.program === program);
}

/** Event names that more than one program emits. */
export function sharedEventNames(): Array<{
  discriminator: string;
  entries: CatalogEntry[];
}> {
  return [...DISCRIMINATOR_INDEX.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([discriminator, entries]) => ({ discriminator, entries }));
}

export async function main(): Promise<void> {
  heading("Catalog");
  row("Decoders catalogued", EVENT_DECODERS.length);
  for (const program of ["pump", "amm", "fees"] as const) {
    row(`  ${program} (${PROGRAM_IDS[program]})`, decodersFor(program).length);
  }

  heading("Shared event names");
  const shared = sharedEventNames();
  row("Colliding discriminators", shared.length);
  for (const { discriminator, entries } of shared) {
    row(
      discriminator,
      entries.map((e) => `${e.program}:${e.eventType}`).join(", "),
    );
  }
  console.log(
    "\nSame name, same discriminator, different layout. Decoding one of these",
  );
  console.log(
    "without knowing the emitting program is a coin flip, which is why",
  );
  console.log("decodeAny takes the program as an optional second argument.");

  heading("Every decoder");
  for (const entry of EVENT_DECODERS) {
    row(
      `${entry.program}:${entry.idlEvent}`,
      `${discriminatorOf(entry).slice(0, 16)}... -> ${entry.method}`,
    );
  }

  heading("Routing a live transaction");
  const override = process.env.SIGNATURE;
  const signatures = override
    ? [override]
    : await collectStreamSignatures(connectionFor(), PUMP_PROGRAM_ID, 3);

  let decoded: DecodedEvent[] = [];
  let unknown = 0;
  let signature = "";
  for (const candidate of signatures) {
    const tx = await withRpcRetry(`fetch ${candidate.slice(0, 8)}`, () =>
      connectionFor().getTransaction(candidate, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }),
    );
    const buffers = programDataBuffers(tx?.meta?.logMessages ?? []);
    if (buffers.length === 0) continue;
    signature = candidate;
    decoded = [];
    unknown = 0;
    for (const buffer of buffers) {
      const result = decodeAny(buffer, "pump");
      if (result) decoded.push(result);
      else unknown += 1;
    }
    break;
  }

  if (!signature) {
    throw new Error(
      "No transaction with event logs was sampled. Retry, set PUMP_RPC_URL, " +
        "or pass SIGNATURE=<signature>.",
    );
  }

  row("Signature", signature);
  row("Buffers decoded", decoded.length);
  row("Buffers not from the Pump program", unknown);
  for (const { entry } of decoded) {
    row(`  ${entry.idlEvent}`, entry.method);
  }
}

/** One connection, created lazily so importing this module stays offline. */
let connection: ReturnType<typeof getConnection> | null = null;
function connectionFor(): ReturnType<typeof getConnection> {
  if (!connection) connection = getConnection();
  return connection;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
