import { PublicKey } from "@solana/web3.js";

import {
  NoShareholdersError,
  TooManyShareholdersError,
  ZeroShareError,
  ShareCalculationOverflowError,
  InvalidShareTotalError,
  DuplicateShareholderError,
  PoolRequiredForGraduatedError,
  UnsupportedQuoteMintError,
} from "../errors";

describe("errors", () => {
  it("NoShareholdersError has correct name and message", () => {
    const err = new NoShareholdersError();
    expect(err.name).toBe("NoShareholdersError");
    expect(err.message).toBe("No shareholders provided");
    expect(err).toBeInstanceOf(Error);
  });

  it("TooManyShareholdersError includes count and max", () => {
    const err = new TooManyShareholdersError(12, 10);
    expect(err.name).toBe("TooManyShareholdersError");
    expect(err.count).toBe(12);
    expect(err.max).toBe(10);
    expect(err.message).toContain("12");
    expect(err.message).toContain("10");
  });

  it("ZeroShareError includes address", () => {
    const addr = "11111111111111111111111111111111";
    const err = new ZeroShareError(addr);
    expect(err.name).toBe("ZeroShareError");
    expect(err.address).toBe(addr);
    expect(err.message).toContain(addr);
  });

  it("ShareCalculationOverflowError has correct name", () => {
    const err = new ShareCalculationOverflowError();
    expect(err.name).toBe("ShareCalculationOverflowError");
    expect(err).toBeInstanceOf(Error);
  });

  it("InvalidShareTotalError includes total", () => {
    const err = new InvalidShareTotalError(9500);
    expect(err.name).toBe("InvalidShareTotalError");
    expect(err.total).toBe(9500);
    expect(err.message).toContain("10,000");
    expect(err.message).toContain("9500");
  });

  it("DuplicateShareholderError has correct name", () => {
    const err = new DuplicateShareholderError();
    expect(err.name).toBe("DuplicateShareholderError");
    expect(err.message).toContain("Duplicate");
  });

  it("PoolRequiredForGraduatedError has correct name", () => {
    const err = new PoolRequiredForGraduatedError();
    expect(err.name).toBe("PoolRequiredForGraduatedError");
    expect(err.message).toContain("graduated");
  });

  it("UnsupportedQuoteMintError carries the rejected mint and names the way out", () => {
    const quoteMint = new PublicKey(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    );
    const err = new UnsupportedQuoteMintError(quoteMint);
    expect(err.name).toBe("UnsupportedQuoteMintError");
    expect(err).toBeInstanceOf(Error);
    // The caller recovers by reading the accepted set, so the mint has to
    // survive on the error rather than only inside the message string.
    expect(err.quoteMint.equals(quoteMint)).toBe(true);
    expect(err.message).toContain(quoteMint.toBase58());
    expect(err.message).toContain("whitelistedQuoteMints");
  });
});
