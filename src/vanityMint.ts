/**
 * Vanity mint generation for Pump tokens.
 *
 * Pump.fun's UI launches tokens whose mint addresses end in `pump`. These are
 * regular Solana addresses — the suffix is purely cosmetic and produced by
 * grinding keypairs until the public key matches. This module exposes that
 * grind as a first-class SDK primitive so callers can produce a mint keypair
 * and feed it straight into `PumpSdk.createV2Instruction`.
 *
 * The grind is CPU-bound; for short patterns it finishes in seconds, but
 * longer patterns (5+ chars) are meaningfully faster in the Rust generator at
 * `rust/`. Use this module for prefixes up to ~4 chars or when staying in
 * Node. For anything larger, generate the keypair out-of-band and pass it in.
 */

import { Keypair } from "@solana/web3.js";

/**
 * Base58 alphabet used by Solana public keys. Excludes `0`, `O`, `I`, `l` to
 * avoid visual ambiguity — a pattern containing any of those can never match.
 */
export const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const BASE58_CHARS = new Set(BASE58_ALPHABET);

/** Hard cap on pattern length. 6 Base58 chars ≈ 38B expected attempts. */
export const MAX_VANITY_PATTERN_LENGTH = 6;

/** How often the grind yields to the event loop. */
const YIELD_EVERY = 5_000;

/** Options for `generateVanityMint`. */
export interface VanityMintOptions {
  /** Required substring at the start of the mint address (case-sensitive unless `caseInsensitive`). */
  prefix?: string;
  /** Required substring at the end of the mint address. `pump` to match pump.fun's convention. */
  suffix?: string;
  /** Match `prefix`/`suffix` case-insensitively. Defaults to `false`. */
  caseInsensitive?: boolean;
  /** Abort the grind when this signal fires. The returned promise rejects with the signal's reason. */
  signal?: AbortSignal;
  /**
   * Stop after this many attempts if no match is found. Throws
   * `VanityMintMaxAttemptsError`. Defaults to unlimited.
   */
  maxAttempts?: number;
  /** Invoked every ~5000 attempts with progress stats. */
  onProgress?: (progress: VanityMintProgress) => void;
}

/** Progress reported via `onProgress`. */
export interface VanityMintProgress {
  /** Attempts completed so far. */
  attempts: number;
  /** Milliseconds elapsed since grind started. */
  elapsedMs: number;
  /** Current attempts-per-second rate. */
  attemptsPerSecond: number;
}

/** Result of a successful grind. */
export interface VanityMintResult {
  /** The grinded mint keypair. Pass `keypair.publicKey` to `createV2Instruction` and include `keypair` as a signer. */
  keypair: Keypair;
  /** Number of keypairs generated before a match was found. */
  attempts: number;
  /** Wall-clock duration of the grind in milliseconds. */
  durationMs: number;
}

/** Discriminant enum for `VanityError`. */
export enum VanityErrorType {
  InvalidPrefix = "InvalidPrefix",
  InvalidSuffix = "InvalidSuffix",
  TooLong = "TooLong",
  Cancelled = "Cancelled",
  GenerationFailed = "GenerationFailed",
}

/** Base class for all vanity-mint errors. Check `err.type` to branch on cause. */
export class VanityError extends Error {
  public readonly type: VanityErrorType;
  constructor(type: VanityErrorType, message: string) {
    super(message);
    this.name = "VanityError";
    this.type = type;
  }
}

/** Thrown when `prefix`/`suffix` can never match (invalid Base58 or too long). */
export class VanityMintPatternError extends VanityError {
  constructor(message: string, kind: "prefix" | "suffix" | "length" = "prefix") {
    const type =
      kind === "suffix"
        ? VanityErrorType.InvalidSuffix
        : kind === "length"
          ? VanityErrorType.TooLong
          : VanityErrorType.InvalidPrefix;
    super(type, message);
    this.name = "VanityMintPatternError";
  }
}

/** Thrown when `maxAttempts` is reached without finding a match. */
export class VanityMintMaxAttemptsError extends VanityError {
  public readonly attempts: number;
  constructor(attempts: number) {
    super(
      VanityErrorType.GenerationFailed,
      `Vanity mint grind exhausted ${attempts.toLocaleString()} attempts without finding a match.`,
    );
    this.name = "VanityMintMaxAttemptsError";
    this.attempts = attempts;
  }
}

function assertValidPattern(
  pattern: string,
  kind: "prefix" | "suffix",
): void {
  if (pattern.length === 0) {
    throw new VanityMintPatternError(`${kind} must not be empty`, kind);
  }
  if (pattern.length > MAX_VANITY_PATTERN_LENGTH) {
    throw new VanityMintPatternError(
      `${kind} length ${pattern.length} exceeds MAX_VANITY_PATTERN_LENGTH (${MAX_VANITY_PATTERN_LENGTH}). ` +
        `Use the Rust generator at rust/ for longer patterns.`,
      "length",
    );
  }
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]!;
    if (!BASE58_CHARS.has(char)) {
      const hint =
        char === "0" ? "(digit zero — Base58 omits this)" :
        char === "O" ? "(uppercase O — Base58 omits this)" :
        char === "I" ? "(uppercase I — Base58 omits this)" :
        char === "l" ? "(lowercase L — Base58 omits this)" : "";
      throw new VanityMintPatternError(
        `${kind} contains invalid Base58 character '${char}' at position ${i} ${hint}`.trim(),
        kind,
      );
    }
  }
}

/**
 * Estimate the mean number of attempts needed to find a mint matching
 * `prefix`/`suffix`. Each Base58 character adds a factor of 58 (or ~34
 * case-insensitive). Use this to decide whether to grind in Node or shell
 * out to the Rust generator.
 */
export function estimateVanityMintAttempts(
  options: Pick<VanityMintOptions, "prefix" | "suffix" | "caseInsensitive">,
): number {
  const length = (options.prefix?.length ?? 0) + (options.suffix?.length ?? 0);
  if (length === 0) return 1;
  const alphabetSize = options.caseInsensitive === true ? 34 : 58;
  return Math.pow(alphabetSize, length);
}

/**
 * Grind Solana keypairs until one whose public key matches `prefix` and/or
 * `suffix` is found. Runs in the current thread — yields to the event loop
 * periodically so signals, timers, and `onProgress` fire on schedule.
 *
 * At least one of `prefix` or `suffix` must be provided. To replicate
 * pump.fun's convention, pass `{ suffix: "pump" }`.
 */
export async function generateVanityMint(
  options: VanityMintOptions,
): Promise<VanityMintResult> {
  const { prefix, suffix, caseInsensitive, signal, maxAttempts, onProgress } = options;

  if ((prefix === undefined || prefix === "") && (suffix === undefined || suffix === "")) {
    throw new VanityMintPatternError("At least one of prefix or suffix is required");
  }
  if (prefix !== undefined && prefix !== "") assertValidPattern(prefix, "prefix");
  if (suffix !== undefined && suffix !== "") assertValidPattern(suffix, "suffix");

  signal?.throwIfAborted();

  const normalizedPrefix =
    prefix !== undefined && prefix !== ""
      ? (caseInsensitive === true ? prefix.toLowerCase() : prefix)
      : undefined;
  const normalizedSuffix =
    suffix !== undefined && suffix !== ""
      ? (caseInsensitive === true ? suffix.toLowerCase() : suffix)
      : undefined;

  const start = Date.now();
  let attempts = 0;
  let lastProgressAt = start;

  while (true) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const compared = caseInsensitive === true ? address.toLowerCase() : address;
    attempts++;

    const prefixMatches =
      normalizedPrefix === undefined || compared.startsWith(normalizedPrefix);
    const suffixMatches =
      normalizedSuffix === undefined || compared.endsWith(normalizedSuffix);

    if (prefixMatches && suffixMatches) {
      return { keypair, attempts, durationMs: Date.now() - start };
    }

    if (maxAttempts !== undefined && attempts >= maxAttempts) {
      throw new VanityMintMaxAttemptsError(attempts);
    }

    if (attempts % YIELD_EVERY === 0) {
      signal?.throwIfAborted();
      if (onProgress !== undefined) {
        const now = Date.now();
        const elapsedMs = now - start;
        const intervalSeconds = (now - lastProgressAt) / 1000;
        const attemptsPerSecond =
          intervalSeconds > 0 ? YIELD_EVERY / intervalSeconds : 0;
        onProgress({ attempts, elapsedMs, attemptsPerSecond });
        lastProgressAt = now;
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }
}
