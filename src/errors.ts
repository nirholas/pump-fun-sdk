/**
 * Custom error types for the Pump SDK
 */

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
