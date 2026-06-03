import { NATIVE_MINT, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { USDC_MINT, QUOTE_MINTS, isNativeQuote } from "../quoteMints";

describe("quoteMints", () => {
  it("exposes the canonical mainnet USDC mint (6 decimals, SPL Token program)", () => {
    expect(USDC_MINT.toBase58()).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(QUOTE_MINTS.USDC.mint.equals(USDC_MINT)).toBe(true);
    expect(QUOTE_MINTS.USDC.decimals).toBe(6);
    expect(QUOTE_MINTS.USDC.tokenProgram.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(QUOTE_MINTS.USDC.tokenProgram.equals(TOKEN_2022_PROGRAM_ID)).toBe(false);
  });
  it("models wSOL with 9 decimals under the SPL Token program", () => {
    expect(QUOTE_MINTS.wSOL.mint.equals(NATIVE_MINT)).toBe(true);
    expect(QUOTE_MINTS.wSOL.decimals).toBe(9);
    expect(QUOTE_MINTS.wSOL.tokenProgram.equals(TOKEN_PROGRAM_ID)).toBe(true);
  });
  it("isNativeQuote distinguishes wSOL from USDC", () => {
    expect(isNativeQuote(NATIVE_MINT)).toBe(true);
    expect(isNativeQuote(USDC_MINT)).toBe(false);
  });
});
