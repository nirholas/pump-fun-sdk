import { z } from "zod";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";
import { publicKeySchema } from "../utils/validation.js";
import { success, error, getErrorMessage } from "../types.js";
import type { ToolResult } from "../types.js";

// ── generate_keypair ──
export const generateKeypairSchema = z.object({});

export async function generateKeypair(
  _params: z.infer<typeof generateKeypairSchema>
): Promise<ToolResult> {
  let keypair: Keypair | null = null;
  try {
    keypair = Keypair.generate();
    const result = {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: Array.from(keypair.secretKey),
    };

    return success({
      ...result,
      warning: "Store the secret key securely. It will not be shown again.",
    });
  } finally {
    // Zeroize key material
    if (keypair) {
      keypair.secretKey.fill(0);
    }
  }
}

// ── generate_vanity_address ──
export const generateVanityAddressSchema = z.object({
  prefix: z.string().max(5).optional().describe("Desired prefix (case-insensitive, max 5 chars)"),
  suffix: z.string().max(5).optional().describe("Desired suffix (case-insensitive, max 5 chars)"),
  maxAttempts: z
    .number()
    .int()
    .min(1000)
    .max(10_000_000)
    .default(1_000_000)
    .describe("Maximum generation attempts"),
});

export async function generateVanityAddress(
  params: z.infer<typeof generateVanityAddressSchema>
): Promise<ToolResult> {
  if (!params.prefix && !params.suffix) {
    return error("Provide at least one of: prefix, suffix");
  }

  const prefix = params.prefix?.toLowerCase();
  const suffix = params.suffix?.toLowerCase();

  let keypair: Keypair | null = null;
  try {
    for (let i = 0; i < params.maxAttempts; i++) {
      const candidate = Keypair.generate();
      const address = candidate.publicKey.toBase58().toLowerCase();

      const prefixMatch = !prefix || address.startsWith(prefix);
      const suffixMatch = !suffix || address.endsWith(suffix);

      if (prefixMatch && suffixMatch) {
        keypair = candidate;
        const result = {
          publicKey: keypair.publicKey.toBase58(),
          secretKey: Array.from(keypair.secretKey),
          attemptsUsed: i + 1,
        };

        return success({
          ...result,
          warning: "Store the secret key securely. It will not be shown again.",
        });
      }
      candidate.secretKey.fill(0);
    }

    return error(
      `Could not find a vanity address matching prefix="${prefix ?? ""}" suffix="${suffix ?? ""}" in ${params.maxAttempts} attempts. Try a shorter pattern or increase maxAttempts.`
    );
  } finally {
    if (keypair) {
      keypair.secretKey.fill(0);
    }
  }
}

// ── validate_address ──
export const validateAddressSchema = z.object({
  address: z.string().describe("Address to validate"),
});

export async function validateAddress(
  params: z.infer<typeof validateAddressSchema>
): Promise<ToolResult> {
  try {
    const pubkey = new PublicKey(params.address);
    const isOnCurve = PublicKey.isOnCurve(pubkey.toBytes());

    return success({
      valid: true,
      address: pubkey.toBase58(),
      isOnCurve,
      isPda: !isOnCurve,
    });
  } catch {
    return success({
      valid: false,
      address: params.address,
      reason: "Not a valid base58-encoded Solana public key",
    });
  }
}

// ── estimate_vanity_time ──
export const estimateVanityTimeSchema = z.object({
  prefix: z.string().max(8).optional().describe("Desired prefix"),
  suffix: z.string().max(8).optional().describe("Desired suffix"),
  keysPerSecond: z.number().default(1000).describe("Generation speed (keys/sec, default 1000 for TS, 100000 for Rust)"),
});

export async function estimateVanityTime(
  params: z.infer<typeof estimateVanityTimeSchema>
): Promise<ToolResult> {
  const BASE58_CHARS = 58;
  const prefixLen = params.prefix?.length ?? 0;
  const suffixLen = params.suffix?.length ?? 0;
  const totalLen = prefixLen + suffixLen;

  if (totalLen === 0) {
    return error("Provide at least one of: prefix, suffix");
  }

  // Expected attempts = 58^N (case-insensitive matching halves the alphabet for some chars)
  // Simplified: 58^N for base58 matching
  const expectedAttempts = Math.pow(BASE58_CHARS, totalLen);
  const estimatedSeconds = expectedAttempts / params.keysPerSecond;

  let humanReadable: string;
  if (estimatedSeconds < 60) {
    humanReadable = `${estimatedSeconds.toFixed(1)} seconds`;
  } else if (estimatedSeconds < 3600) {
    humanReadable = `${(estimatedSeconds / 60).toFixed(1)} minutes`;
  } else if (estimatedSeconds < 86400) {
    humanReadable = `${(estimatedSeconds / 3600).toFixed(1)} hours`;
  } else if (estimatedSeconds < 31536000) {
    humanReadable = `${(estimatedSeconds / 86400).toFixed(1)} days`;
  } else {
    humanReadable = `${(estimatedSeconds / 31536000).toFixed(1)} years`;
  }

  return success({
    pattern: `prefix="${params.prefix ?? ""}" suffix="${params.suffix ?? ""}"`,
    expectedAttempts: expectedAttempts.toExponential(2),
    estimatedTime: humanReadable,
    keysPerSecond: params.keysPerSecond,
    recommendation:
      totalLen > 4
        ? "Use the Rust vanity generator for patterns longer than 4 characters."
        : "TypeScript generator should handle this quickly.",
  });
}

// ── restore_keypair ──
export const restoreKeypairSchema = z.object({
  secretKey: z
    .array(z.number().int().min(0).max(255))
    .length(64)
    .describe("64-byte secret key as array of numbers"),
});

export async function restoreKeypair(
  params: z.infer<typeof restoreKeypairSchema>
): Promise<ToolResult> {
  let keypair: Keypair | null = null;
  try {
    keypair = Keypair.fromSecretKey(Uint8Array.from(params.secretKey));

    return success({
      publicKey: keypair.publicKey.toBase58(),
      restored: true,
    });
  } catch (e: unknown) {
    return error(`Failed to restore keypair: ${getErrorMessage(e)}`);
  } finally {
    if (keypair) {
      keypair.secretKey.fill(0);
    }
  }
}

// ── sign_message ──
export const signMessageSchema = z.object({
  message: z.string().min(1).describe("The message to sign"),
  privateKey: z
    .string()
    .describe("Base58-encoded 64-byte private key"),
});

export async function signMessage(
  params: z.infer<typeof signMessageSchema>
): Promise<ToolResult> {
  let secretKey: Uint8Array | null = null;
  try {
    secretKey = bs58.decode(params.privateKey);
    if (secretKey.length !== 64) {
      return error(`Invalid private key length: expected 64 bytes, got ${secretKey.length}`);
    }

    const keypair = Keypair.fromSecretKey(secretKey);
    const publicKeyStr = keypair.publicKey.toBase58();
    const messageBytes = new TextEncoder().encode(params.message);
    const signature = ed25519.sign(messageBytes, secretKey.subarray(0, 32));
    const signatureBase58 = bs58.encode(signature);

    return success({
      publicKey: publicKeyStr,
      message: params.message,
      signature: signatureBase58,
      note: "Use verify_signature to verify this signature.",
    });
  } catch (e: unknown) {
    return error(`Signing failed: ${getErrorMessage(e)}`);
  } finally {
    if (secretKey) {
      secretKey.fill(0);
    }
  }
}

// ── verify_signature ──
export const verifySignatureSchema = z.object({
  message: z.string().min(1).describe("The original message"),
  signature: z.string().min(1).describe("Base58-encoded signature"),
  publicKey: publicKeySchema.describe("Signer's public key"),
});

export async function verifySignature(
  params: z.infer<typeof verifySignatureSchema>
): Promise<ToolResult> {
  try {
    const messageBytes = new TextEncoder().encode(params.message);
    const signatureBytes = bs58.decode(params.signature);
    const pubKeyBytes = new PublicKey(params.publicKey).toBytes();

    const isValid = ed25519.verify(signatureBytes, messageBytes, pubKeyBytes);

    return success({
      valid: isValid,
      publicKey: params.publicKey,
      message: params.message,
      signaturePrefix: params.signature.substring(0, 20) + "...",
    });
  } catch (e: unknown) {
    return error(`Verification failed: ${getErrorMessage(e)}`);
  }
}
