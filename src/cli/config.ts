/**
 * Persistent CLI configuration.
 *
 * Stored as JSON at `~/.pump/config.json` (override the directory with
 * `PUMP_CONFIG_DIR`). Every value is also settable per-invocation via a flag or
 * an environment variable, so the config file is a convenience, never a
 * requirement: a fresh install with zero config still runs every read command.
 *
 * Precedence, highest first: command flag, environment variable, config file,
 * built-in default.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Public mainnet RPC. Rate limited, fine for reads, replace it for anything real. */
export const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

/** Where `solana-keygen` puts a wallet by default. */
export const DEFAULT_KEYPAIR_PATH = join(
  homedir(),
  ".config",
  "solana",
  "id.json",
);

export interface CliConfig {
  /** Primary JSON-RPC endpoint. */
  rpcUrl?: string;
  /** Additional endpoints tried in order when the primary fails. */
  fallbackRpcUrls?: string[];
  /** Path to a signer keypair (JSON byte array or base58 secret key). */
  keypair?: string;
  /** Default slippage tolerance in percent, e.g. `1` for 1%. */
  slippage?: number;
  /** Default priority fee in micro-lamports per compute unit. */
  priorityFee?: number;
  /** Default compute unit limit for trade transactions. */
  computeUnitLimit?: number;
}

/** Solana's per-transaction compute ceiling. */
export const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;

/**
 * Slippage tolerance in percent, `0..100`. Past 100 a sell's minimum output is
 * clamped to zero, so a larger number can only be a unit mistake (bps typed
 * as percent, say), and it would remove the price guard entirely.
 */
export function validateSlippage(value: unknown, source: string): number {
  const parsed = Number(value);
  if (
    typeof value === "boolean" ||
    value === "" ||
    value === null ||
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > 100
  ) {
    throw new Error(
      `${source}: slippage must be a percent between 0 and 100, got ${JSON.stringify(value)}`,
    );
  }
  return parsed;
}

/** Priority fee in micro-lamports per compute unit: a non-negative integer. */
export function validatePriorityFee(value: unknown, source: string): number {
  const parsed = Number(value);
  if (
    typeof value === "boolean" ||
    value === "" ||
    value === null ||
    !Number.isSafeInteger(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${source}: priority fee must be a whole number of micro-lamports per compute unit, got ${JSON.stringify(value)}`,
    );
  }
  return parsed;
}

/** Compute unit limit: an integer in `1..1_400_000`. */
export function validateComputeUnitLimit(value: unknown, source: string): number {
  const parsed = Number(value);
  if (
    typeof value === "boolean" ||
    value === "" ||
    value === null ||
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_COMPUTE_UNIT_LIMIT
  ) {
    throw new Error(
      `${source}: compute unit limit must be a whole number between 1 and ${MAX_COMPUTE_UNIT_LIMIT}, got ${JSON.stringify(value)}`,
    );
  }
  return parsed;
}

/** Keys a user may set with `pump config set`, with their parsers. */
export const CONFIG_KEYS: Record<keyof CliConfig, (value: string) => unknown> =
  {
    rpcUrl: (v) => v,
    fallbackRpcUrls: (v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    keypair: (v) => v,
    slippage: (v) => validateSlippage(v, "slippage"),
    priorityFee: (v) => validatePriorityFee(v, "priorityFee"),
    computeUnitLimit: (v) => validateComputeUnitLimit(v, "computeUnitLimit"),
  };

export function configDir(): string {
  return process.env.PUMP_CONFIG_DIR ?? join(homedir(), ".pump");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

/** Read the config file. A missing or unreadable file is an empty config. */
export function loadConfig(): CliConfig {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (parsed === null || typeof parsed !== "object") return {};
    return parsed as CliConfig;
  } catch {
    return {};
  }
}

/**
 * Write the config file owner-only. `mode` on `writeFileSync` applies only when
 * the file is created, so an existing file is tightened explicitly: the config
 * can hold a keypair path or an inline secret key.
 */
export function saveConfig(config: CliConfig): string {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

/**
 * Resolve the RPC endpoint list, primary first.
 *
 * `--rpc` accepts a comma-separated list so a one-liner can carry its own
 * failover chain without touching the config file.
 */
export function resolveRpcUrls(flagValue?: string): string[] {
  const config = loadConfig();
  const primaries = flagValue
    ? flagValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [
        process.env.PUMP_RPC_URL ??
          process.env.SOLANA_RPC_URL ??
          config.rpcUrl ??
          DEFAULT_RPC_URL,
      ];

  const fallbacks = flagValue ? [] : (config.fallbackRpcUrls ?? []);
  return [...new Set([...primaries, ...fallbacks])];
}

/** Resolve the signer keypair path without reading it. */
export function resolveKeypairPath(flagValue?: string): string {
  const config = loadConfig();
  return (
    flagValue ??
    process.env.PUMP_KEYPAIR ??
    process.env.SOLANA_KEYPAIR ??
    config.keypair ??
    DEFAULT_KEYPAIR_PATH
  );
}

/**
 * The resolvers below validate whichever source wins, so a bad flag, env var
 * or hand-edited config value fails loudly instead of being sent as NaN or
 * silently replaced by a default.
 */
export function resolveSlippage(flagValue?: number): number {
  if (flagValue !== undefined) return validateSlippage(flagValue, "--slippage");
  const fromEnv = process.env.PUMP_SLIPPAGE;
  if (fromEnv !== undefined) return validateSlippage(fromEnv, "PUMP_SLIPPAGE");
  const saved = loadConfig().slippage;
  return saved === undefined ? 1 : validateSlippage(saved, configPath());
}

export function resolvePriorityFee(flagValue?: number): number {
  if (flagValue !== undefined) {
    return validatePriorityFee(flagValue, "--priority-fee");
  }
  const fromEnv = process.env.PUMP_PRIORITY_FEE;
  if (fromEnv !== undefined) {
    return validatePriorityFee(fromEnv, "PUMP_PRIORITY_FEE");
  }
  const saved = loadConfig().priorityFee;
  return saved === undefined ? 0 : validatePriorityFee(saved, configPath());
}

export function resolveComputeUnitLimit(flagValue?: number): number {
  if (flagValue !== undefined) {
    return validateComputeUnitLimit(flagValue, "--compute-unit-limit");
  }
  const saved = loadConfig().computeUnitLimit;
  return saved === undefined
    ? 300_000
    : validateComputeUnitLimit(saved, configPath());
}
