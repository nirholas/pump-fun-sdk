import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import type BN from "bn.js";

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export function success(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function error(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export interface SerializedInstruction {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
}

export interface QuoteResult {
  inputAmount: string;
  outputAmount: string;
  inputUnit: string;
  outputUnit: string;
}

export interface PriceImpactInfo {
  impactPercentage: string;
  preBuyPrice: string;
  postBuyPrice: string;
}
