import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import type BN from "bn.js";

// ── MCP Protocol ──

export const MCP_VERSION = "2024-11-05";

// ── Tool Result ──

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

/** Extract a human-readable message from an unknown error value. */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}

// ── Resource / Prompt Results ──

export interface ResourceResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
  }>;
}

export interface PromptResult {
  description?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: {
      type: "text";
      text: string;
    };
  }>;
}

// ── Server State ──

export interface ServerState {
  initialized: boolean;
  generatedKeypairs: Map<string, { publicKey: string; secretKey: Uint8Array }>;
}

// ── Serialization ──

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
