/**
 * Per-invocation runtime: the RPC connection, the online SDK, and the optional
 * signer.
 *
 * Read commands never touch a keypair. Only the commands that build and send a
 * transaction call `requireSigner()`, so a machine with no wallet on it can
 * still run the entire read surface.
 */

import { existsSync, readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

import { createFallbackConnection } from "../fallback";
import { OnlinePumpSdk } from "../onlineSdk";
import {
  DEFAULT_RPC_URL,
  resolveComputeUnitLimit,
  resolveKeypairPath,
  resolvePriorityFee,
  resolveRpcUrls,
  resolveSlippage,
} from "./config";
import { setColorEnabled } from "./format";

/** Options every command inherits from the root program. */
export interface GlobalOptions {
  rpc?: string;
  keypair?: string;
  json?: boolean;
  color?: boolean;
  slippage?: number;
  priorityFee?: number;
  computeUnitLimit?: number;
  yes?: boolean;
  simulate?: boolean;
}

export class CliError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "CliError";
    this.hint = hint;
  }
}

export class CliContext {
  readonly endpoints: string[];
  /** The endpoint every command reports as "the" RPC. Never undefined. */
  readonly primaryEndpoint: string;
  readonly connection: Connection;
  readonly sdk: OnlinePumpSdk;
  readonly json: boolean;
  readonly assumeYes: boolean;
  readonly simulateOnly: boolean;
  readonly slippage: number;
  readonly priorityFee: number;
  readonly computeUnitLimit: number;

  private readonly keypairPath: string;
  private signer: Keypair | undefined;

  constructor(options: GlobalOptions) {
    this.endpoints = resolveRpcUrls(options.rpc);
    this.primaryEndpoint = this.endpoints[0] ?? DEFAULT_RPC_URL;
    this.connection =
      this.endpoints.length > 1
        ? createFallbackConnection(this.endpoints, { commitment: "confirmed" })
        : new Connection(this.primaryEndpoint, "confirmed");
    this.sdk = new OnlinePumpSdk(this.connection);
    this.json = options.json === true;
    this.assumeYes = options.yes === true;
    this.simulateOnly = options.simulate === true;
    this.slippage = resolveSlippage(options.slippage);
    this.priorityFee = resolvePriorityFee(options.priorityFee);
    this.computeUnitLimit = resolveComputeUnitLimit(options.computeUnitLimit);
    this.keypairPath = resolveKeypairPath(options.keypair);

    // JSON mode must stay parseable, so colour codes are stripped even on a TTY.
    const colorOff =
      options.color === false ||
      this.json ||
      process.env.NO_COLOR !== undefined ||
      !process.stdout.isTTY;
    setColorEnabled(!colorOff);
  }

  /**
   * The configured keypair path, whether or not it exists, or a redacted
   * placeholder when the value is an inline secret key. Safe to print.
   */
  get walletPath(): string {
    return describeKeypairSource(this.keypairPath);
  }

  /** Load the signer, or explain precisely how to provide one. */
  requireSigner(): Keypair {
    if (this.signer !== undefined) return this.signer;
    this.signer = loadKeypair(this.keypairPath);
    return this.signer;
  }

  /** The signer's public key if one is available, otherwise undefined. */
  maybeSignerPublicKey(): PublicKey | undefined {
    try {
      return this.requireSigner().publicKey;
    } catch {
      return undefined;
    }
  }
}

/**
 * Load a keypair from a path or an inline base58 secret key.
 *
 * Accepts the three shapes people actually have on disk: the `solana-keygen`
 * JSON byte array, a file holding a base58 secret key (what most wallet exports
 * produce), and a raw base58 secret key passed through `PUMP_KEYPAIR` for CI
 * where writing a key file is worse than an env var.
 */
export function loadKeypair(pathOrSecret: string): Keypair {
  const trimmed = pathOrSecret.trim();

  if (!existsSync(trimmed)) {
    // Not a path: the only other thing it can be is an inline secret key.
    const inline = tryBase58Secret(trimmed);
    if (inline !== undefined) return inline;
    // Never echo a value that may be (part of) a secret key: this message
    // reaches the terminal, CI logs, and stdout in `--json` mode.
    throw new CliError(
      looksLikeInlineSecret(trimmed)
        ? "The configured keypair is neither an existing file nor a valid base58 secret key (value not shown)"
        : `No keypair found at ${trimmed}`,
      "Point the CLI at one with --keypair <path>, PUMP_KEYPAIR=<path or base58 secret>, or `pump config set keypair <path>`. Inline values must be a base58 secret key; JSON byte arrays have to be in a file. Create one with `solana-keygen new`.",
    );
  }

  let raw: string;
  try {
    raw = readFileSync(trimmed, "utf8").trim();
  } catch (error) {
    throw new CliError(
      `Cannot read keypair at ${trimmed}: ${(error as Error).message}`,
      "Check the file permissions.",
    );
  }

  if (raw.startsWith("[")) {
    let bytes: number[];
    try {
      bytes = JSON.parse(raw) as number[];
    } catch {
      throw new CliError(`Keypair at ${trimmed} is not valid JSON`);
    }
    try {
      return Keypair.fromSecretKey(Uint8Array.from(bytes));
    } catch (error) {
      throw new CliError(
        `Keypair at ${trimmed} is not a valid secret key: ${(error as Error).message}`,
      );
    }
  }

  const fromBase58 = tryBase58Secret(raw);
  if (fromBase58 !== undefined) return fromBase58;

  throw new CliError(
    `Keypair at ${trimmed} is neither a JSON byte array nor a base58 secret key`,
    "Export it with `solana-keygen` or paste the base58 secret key into the file.",
  );
}

/**
 * Whether a keypair setting that is not an existing file should be treated as
 * secret material rather than a mistyped path: a JSON byte array, or a long run
 * of base58 characters with no path separator. A base58 secret key is 87-88
 * characters, so anything from 64 up is redacted even when it fails to decode.
 */
function looksLikeInlineSecret(value: string): boolean {
  return value.startsWith("[") || /^[1-9A-HJ-NP-Za-km-z]{64,}$/.test(value);
}

/**
 * Printable description of a keypair setting: the path itself, or a redacted
 * placeholder when the setting holds an inline secret key.
 */
export function describeKeypairSource(pathOrSecret: string): string {
  const trimmed = pathOrSecret.trim();
  if (!existsSync(trimmed) && looksLikeInlineSecret(trimmed)) {
    return "<inline secret key, redacted>";
  }
  return trimmed;
}

function tryBase58Secret(value: string): Keypair | undefined {
  if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(value)) return undefined;
  try {
    return Keypair.fromSecretKey(bs58.decode(value));
  } catch {
    return undefined;
  }
}

/** Parse a base58 address, failing with a message that names the argument. */
export function parsePublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new CliError(
      `${label} is not a valid Solana address: ${value}`,
      "Addresses are 32-44 base58 characters. Pump mints usually end in `pump`.",
    );
  }
}
