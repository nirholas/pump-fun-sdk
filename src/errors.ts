/**
 * Custom error types for the Pump SDK
 */

import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

import pumpIdl from "./idl/pump.json";
import pumpAmmIdl from "./idl/pump_amm.json";
import pumpFeesIdl from "./idl/pump_fees.json";

/** `create_v2` no longer permits new cashback coins (Pump error 6082). */
export class CashbackDeprecatedError extends Error {
  constructor() {
    super(
      "Cashback launches are deprecated; create a holder-reward coin instead",
    );
    this.name = "CashbackDeprecatedError";
  }
}

/** Holder-reward creation is currently disabled in the Pump global state. */
export class HolderRewardDisabledError extends Error {
  constructor() {
    super("Holder-reward coin creation is disabled by the Pump program");
    this.name = "HolderRewardDisabledError";
  }
}

export class NoShareholdersError extends Error {
  constructor() {
    super("No shareholders provided");
    this.name = "NoShareholdersError";
  }
}

export class TooManyShareholdersError extends Error {
  constructor(
    public count: number,
    public max: number,
  ) {
    super(`Too many shareholders. Maximum allowed is ${max}, got ${count}`);
    this.name = "TooManyShareholdersError";
  }
}

export class ZeroShareError extends Error {
  constructor(public address: string) {
    super(`Zero or negative share not allowed for address ${address}`);
    this.name = "ZeroShareError";
  }
}

export class ShareCalculationOverflowError extends Error {
  constructor() {
    super("Share calculation overflow - total shares exceed maximum value");
    this.name = "ShareCalculationOverflowError";
  }
}

export class InvalidShareTotalError extends Error {
  constructor(public total: number) {
    super(
      `Invalid share total. Must equal 10,000 basis points (100%). Got ${total}`,
    );
    this.name = "InvalidShareTotalError";
  }
}

export class DuplicateShareholderError extends Error {
  constructor() {
    super("Duplicate shareholder addresses not allowed");
    this.name = "DuplicateShareholderError";
  }
}

export class PoolRequiredForGraduatedError extends Error {
  constructor() {
    super(
      "Pool parameter is required for graduated coins (bondingCurve.complete = true)",
    );
    this.name = "PoolRequiredForGraduatedError";
  }
}

/**
 * Thrown when a sell amount would overflow the pump program's on-chain u64 math.
 *
 * The deployed pump program computes `amount * virtualSolReserves` in u64 before
 * dividing. When the intermediate product exceeds `u64::MAX` (~1.84e19), the
 * program's `checked_mul` returns `None` and fails with AnchorError 6024 (Overflow)
 * at `programs/pump/src/lib.rs:764` — AFTER `TransferChecked` has already moved
 * tokens out of the user wallet, which then get refunded when the tx reverts.
 *
 * The SDK throws this BEFORE building the instruction so the transaction is never
 * broadcast. To recover, split the sell into smaller chunks using
 * `OnlinePumpSdk.sellChunked()` or cap individual sells at `maxSafeAmount`.
 */
export class SellOverflowError extends Error {
  readonly amount: BN;
  readonly virtualSolReserves: BN;
  readonly maxSafeAmount: BN;

  constructor(amount: BN, virtualSolReserves: BN, maxSafeAmount: BN) {
    super(
      `Sell amount ${amount.toString()} would overflow the on-chain u64 multiply ` +
        `(amount * virtualSolReserves > u64::MAX) for virtualSolReserves=${virtualSolReserves.toString()}. ` +
        `Max safe chunk is ${maxSafeAmount.toString()} raw token units. ` +
        `Use OnlinePumpSdk.sellChunked() or split the sell into ≤${maxSafeAmount.toString()} chunks.`,
    );
    this.name = "SellOverflowError";
    this.amount = amount;
    this.virtualSolReserves = virtualSolReserves;
    this.maxSafeAmount = maxSafeAmount;
  }
}

/**
 * Thrown when a curve is asked to quote in a mint the program does not accept.
 *
 * `create_v2` takes SOL or one of the mints listed in
 * `Global.whitelistedQuoteMints`; anything else is rejected on-chain. The SDK
 * throws before building the instruction because the alternative is silently
 * picking a starting price the program would never have used, which produces a
 * quote that disagrees with the chain rather than an error the caller can see.
 */
export class UnsupportedQuoteMintError extends Error {
  readonly quoteMint: PublicKey;

  constructor(quoteMint: PublicKey) {
    super(
      `Quote mint ${quoteMint.toBase58()} is not accepted by the pump program. ` +
        `Use SOL, or a mint listed in Global.whitelistedQuoteMints.`,
    );
    this.name = "UnsupportedQuoteMintError";
    this.quoteMint = quoteMint;
  }
}

/**
 * Mirrors pump error 6094: the v3 trades refuse cashback coins (they never
 * credit the buyer's volume accumulator). Trade those with the v1/v2
 * instructions.
 */
export class CashbackCoinNotSupportedError extends Error {
  readonly mint: PublicKey;

  constructor(mint: PublicKey) {
    super(
      `v3 trades do not support cashback coin ${mint.toBase58()}; use buyInstructions / sellInstructions`,
    );
    this.name = "CashbackCoinNotSupportedError";
    this.mint = mint;
  }
}

/**
 * Mirrors pump error 6105: a coin quoted in pump coin Q would sit at depth
 * `Q.depth + 1`, above `Global.maxCurveDepth` (0 disables pump-coin quotes).
 */
export class CurveDepthExceededError extends Error {
  readonly depth: number;
  readonly maxCurveDepth: number;

  constructor(depth: number, maxCurveDepth: number) {
    super(`Curve depth ${depth} exceeds Global.maxCurveDepth ${maxCurveDepth}`);
    this.name = "CurveDepthExceededError";
    this.depth = depth;
    this.maxCurveDepth = maxCurveDepth;
  }
}

/**
 * Mirrors pump error 6100: pump coin Q cannot quote a new coin (its curve is
 * mayhem mode, or it is a depth-0 coin whose own quote no list admits).
 */
export class QuoteBondingCurveNotEligibleError extends Error {
  readonly quoteMint: PublicKey;

  constructor(quoteMint: PublicKey) {
    super(
      `Pump coin ${quoteMint.toBase58()} is not eligible as a quote: mayhem mode, or its own quote is not listed`,
    );
    this.name = "QuoteBondingCurveNotEligibleError";
    this.quoteMint = quoteMint;
  }
}

/**
 * Mirrors pump error 6107: pump coin Q's curve is complete but not migrated
 * yet, so it has no price. Retry once `migrate` creates its pool.
 */
export class QuoteCurveAwaitingMigrationError extends Error {
  readonly quoteMint: PublicKey;

  constructor(quoteMint: PublicKey) {
    super(
      `Pump coin ${quoteMint.toBase58()} has completed its curve but is not migrated yet`,
    );
    this.name = "QuoteCurveAwaitingMigrationError";
    this.quoteMint = quoteMint;
  }
}

/** Mirrors pump error 6104: the reserves derived from pump coin Q are zero. */
export class QuoteReservesOutOfRangeError extends Error {
  readonly quoteMint: PublicKey;
  readonly derived: BN;

  constructor(quoteMint: PublicKey, derived: BN) {
    super(
      `Reserves ${derived.toString()} derived from pump coin ${quoteMint.toBase58()} are out of range`,
    );
    this.name = "QuoteReservesOutOfRangeError";
    this.quoteMint = quoteMint;
    this.derived = derived;
  }
}

/**
 * Mirrors pump error 6102: pump coin Q's curve migrated but its canonical
 * PumpSwap pool does not exist, so Q has no price the program can read.
 */
export class QuotePoolNotFoundError extends Error {
  readonly quoteMint: PublicKey;
  readonly pool: PublicKey;

  constructor(quoteMint: PublicKey, pool: PublicKey) {
    super(
      `Pump coin ${quoteMint.toBase58()} migrated but has no PumpSwap pool at ${pool.toBase58()}`,
    );
    this.name = "QuotePoolNotFoundError";
    this.quoteMint = quoteMint;
    this.pool = pool;
  }
}

/**
 * Mirrors pump 6098 / pump-amm 6084 (`MultiHopDiscontinuousPath`): each hop
 * of a multi-hop route must start in the mint the previous hop ended in.
 */
export class MultiHopDiscontinuousPathError extends Error {
  readonly hopIndex: number;

  constructor(hopIndex: number, expected: PublicKey, actual: PublicKey) {
    super(
      `Multi-hop route is discontinuous at hop ${hopIndex}: expected ${expected.toBase58()}, got ${actual.toBase58()}`,
    );
    this.name = "MultiHopDiscontinuousPathError";
    this.hopIndex = hopIndex;
  }
}

/** A custom error a Pump program can return, as its IDL declares it. */
export interface PumpProgramError {
  program: "pump" | "pumpAmm" | "pumpFees";
  code: number;
  name: string;
  msg?: string;
}

const PROGRAM_ERROR_TABLES: Record<
  PumpProgramError["program"],
  { id: string; errors: { code: number; name: string; msg?: string }[] }
> = {
  pump: { id: pumpIdl.address, errors: pumpIdl.errors },
  pumpAmm: { id: pumpAmmIdl.address, errors: pumpAmmIdl.errors },
  pumpFees: { id: pumpFeesIdl.address, errors: pumpFeesIdl.errors },
};

/**
 * Resolve a failed transaction's `InstructionError: Custom(code)` to the
 * named error the program declares, from the bundled IDLs. Covers every code,
 * including the ones the October 2026 upgrade added (pump 6094 to 6108,
 * pump-amm 6059 to 6087, pump-fees 6031 to 6034).
 *
 * @param program - `"pump"`, `"pumpAmm"`, `"pumpFees"`, or the program id.
 * @returns The error, or `undefined` for a code the program does not declare
 *   (Anchor framework codes below 6000, for instance).
 */
export function getPumpProgramError(
  program: PumpProgramError["program"] | PublicKey,
  code: number,
): PumpProgramError | undefined {
  const key =
    typeof program === "string"
      ? program
      : (
          Object.keys(PROGRAM_ERROR_TABLES) as PumpProgramError["program"][]
        ).find((name) => PROGRAM_ERROR_TABLES[name].id === program.toBase58());
  if (key === undefined) return undefined;
  const found = PROGRAM_ERROR_TABLES[key].errors.find((e) => e.code === code);
  return found
    ? { program: key, code: found.code, name: found.name, msg: found.msg }
    : undefined;
}
