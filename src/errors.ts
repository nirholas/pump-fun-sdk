/**
 * Custom error types for the Pump SDK
 */

import type BN from "bn.js";

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
