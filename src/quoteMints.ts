import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

/** Canonical mainnet USDC mint (legacy SPL Token, 6 decimals). */
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export interface QuoteMintInfo {
  mint: PublicKey;
  decimals: number;
  /** Token program that owns the quote mint. Both wSOL and USDC use the legacy SPL Token program. */
  tokenProgram: PublicKey;
  ticker: string;
}

/** Supported quote mints. The SDK's `quoteMint`/`quoteTokenProgram` params default to wSOL. */
export const QUOTE_MINTS: Record<"wSOL" | "USDC", QuoteMintInfo> = {
  wSOL: { mint: NATIVE_MINT, decimals: 9, tokenProgram: TOKEN_PROGRAM_ID, ticker: "SOL" },
  USDC: { mint: USDC_MINT, decimals: 6, tokenProgram: TOKEN_PROGRAM_ID, ticker: "USDC" },
};

/** True when a quote mint is native SOL (wrapped SOL), i.e. the legacy/default path. */
export function isNativeQuote(quoteMint: PublicKey): boolean {
  return quoteMint.equals(NATIVE_MINT);
}
