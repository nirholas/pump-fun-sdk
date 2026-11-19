/**
 * Terminal rendering primitives shared by every command.
 *
 * Two output modes exist and every command supports both: human mode (aligned
 * key/value blocks, colour, unicode meters) and `--json` (a single machine
 * readable object on stdout, nothing else). Anything the CLI says to a human
 * goes through this module so the two modes never drift.
 */

import BN from "bn.js";
import pc from "picocolors";

const LAMPORTS_PER_SOL = 1_000_000_000;

/** Pump tokens are minted with 6 decimals. */
export const TOKEN_DECIMALS = 6;

let colorEnabled = true;

export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
}

type Colorizer = (input: string) => string;

function paint(fn: Colorizer): Colorizer {
  return (input: string) => (colorEnabled ? fn(input) : input);
}

export const c = {
  bold: paint(pc.bold),
  dim: paint(pc.dim),
  red: paint(pc.red),
  green: paint(pc.green),
  yellow: paint(pc.yellow),
  blue: paint(pc.blue),
  cyan: paint(pc.cyan),
  magenta: paint(pc.magenta),
  gray: paint(pc.gray),
};

/** Convert a lamport amount to SOL, keeping full precision as a JS number. */
export function lamportsToSol(lamports: BN | number | bigint): number {
  const asBn = BN.isBN(lamports) ? lamports : new BN(lamports.toString());
  const whole = asBn.div(new BN(LAMPORTS_PER_SOL)).toNumber();
  const remainder = asBn.mod(new BN(LAMPORTS_PER_SOL)).toNumber();
  return whole + remainder / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): BN {
  return new BN(Math.round(sol * LAMPORTS_PER_SOL));
}

/** Raw token units to whole tokens. */
export function rawToTokens(raw: BN, decimals = TOKEN_DECIMALS): number {
  const scale = new BN(10).pow(new BN(decimals));
  return raw.div(scale).toNumber() + raw.mod(scale).toNumber() / 10 ** decimals;
}

export function tokensToRaw(tokens: number, decimals = TOKEN_DECIMALS): BN {
  return new BN(Math.round(tokens * 10 ** decimals));
}

/** `1.2345 SOL`, trimmed to a sane number of significant digits. */
export function formatSol(lamports: BN | number, digits = 6): string {
  const sol = lamportsToSol(lamports);
  if (sol !== 0 && Math.abs(sol) < 10 ** -digits) {
    return `${sol.toExponential(2)} SOL`;
  }
  return `${trimZeros(sol.toFixed(digits))} SOL`;
}

/**
 * Render one of the SDK's scaled spot prices as SOL per whole token.
 *
 * `PriceImpactResult.priceBefore` / `priceAfter` are lamports per *raw* token
 * unit multiplied by 1e9 for integer precision. A whole token is 1e6 raw units,
 * so SOL per token is `scaled * 1e6 / 1e9 / 1e9`, i.e. `scaled / 1e12`. Passing
 * one of these straight to `formatSol` reports a price 1000x too high, which is
 * exactly the kind of quiet unit bug that makes a quote untrustworthy.
 */
export function formatScaledPrice(scaled: BN, digits = 12): string {
  const sol = Number(scaled.toString()) / 1e12;
  if (sol !== 0 && Math.abs(sol) < 10 ** -digits) {
    return `${sol.toExponential(2)} SOL`;
  }
  return `${trimZeros(sol.toFixed(digits))} SOL`;
}

/** `12.4M` style compact numbers for supply and token counts. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${trimZeros((value / 1e12).toFixed(2))}T`;
  if (abs >= 1e9) return `${trimZeros((value / 1e9).toFixed(2))}B`;
  if (abs >= 1e6) return `${trimZeros((value / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `${trimZeros((value / 1e3).toFixed(2))}K`;
  return trimZeros(value.toFixed(abs < 1 ? 6 : 2));
}

export function formatTokens(raw: BN, decimals = TOKEN_DECIMALS): string {
  return formatCompact(rawToTokens(raw, decimals));
}

export function formatBps(bps: number): string {
  return `${trimZeros((bps / 100).toFixed(2))}%`;
}

/** Colour a price impact by how much it should worry the user. */
export function formatImpact(bps: number): string {
  const text = formatBps(bps);
  if (bps >= 1000) return c.red(text);
  if (bps >= 300) return c.yellow(text);
  return c.green(text);
}

function trimZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

/** Shorten a base58 address for dense views: `FeMbDo…JpumP`. */
/**
 * Make an untrusted string (a token name, symbol or URI read from chain) safe
 * to write to a terminal. Anyone can launch a coin whose name carries ANSI or
 * OSC escape sequences, which could recolour, rewrite or hide lines of the
 * trade summary, or set the window title. Control characters (C0, DEL and C1,
 * which includes the 8-bit CSI) are replaced with U+FFFD.
 */
export function plainText(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    out += code < 0x20 || (code >= 0x7f && code <= 0x9f) ? "\ufffd" : char;
  }
  return out;
}

export function shortAddress(address: string, edge = 6): string {
  if (address.length <= edge * 2 + 1) return address;
  return `${address.slice(0, edge)}…${address.slice(-edge)}`;
}

/** A unicode meter, e.g. `████████░░░░░░░░  48.2%`. */
export function meter(fraction: number, width = 24): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = Math.round(clamped * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const colored =
    clamped >= 0.9 ? c.green(bar) : clamped >= 0.5 ? c.cyan(bar) : c.blue(bar);
  return `${colored} ${(clamped * 100).toFixed(2)}%`;
}

export interface Row {
  label: string;
  value: string;
  /** Rendered dim underneath the value, for units or context. */
  note?: string;
}

/** Aligned `label   value` block. The workhorse of every human-mode command. */
export function keyValue(rows: Row[], indent = "  "): string {
  const width = rows.reduce((max, row) => Math.max(max, row.label.length), 0);
  return rows
    .map((row) => {
      const label = c.dim(row.label.padEnd(width));
      const note = row.note === undefined ? "" : ` ${c.dim(row.note)}`;
      return `${indent}${label}  ${row.value}${note}`;
    })
    .join("\n");
}

/** Section heading with a rule under it. */
export function heading(title: string, subtitle?: string): string {
  const line = c.bold(c.cyan(title));
  const sub = subtitle === undefined ? "" : ` ${c.dim(subtitle)}`;
  return `\n${line}${sub}\n${c.dim("─".repeat(Math.min(60, title.length + 20)))}`;
}

export function success(message: string): string {
  return `${c.green("✔")} ${message}`;
}

export function warn(message: string): string {
  return `${c.yellow("!")} ${message}`;
}

export function failure(message: string): string {
  return `${c.red("✖")} ${message}`;
}

export function info(message: string): string {
  return `${c.blue("›")} ${message}`;
}

/**
 * Serialize for `--json`.
 *
 * BN and PublicKey both serialize to something useless by default, which is
 * exactly the kind of output that makes a CLI unusable from a script. Worse, a
 * `JSON.stringify` replacer cannot fix it: `BN.prototype.toJSON` runs first and
 * hands the replacer a zero-padded *hexadecimal* string, so `new BN(0)` arrives
 * as `"00"` and a market cap comes out in base 16. The values must therefore be
 * converted by walking the structure before stringify ever sees it.
 */
export function toJson(value: unknown): string {
  return JSON.stringify(normalizeForJson(value), null, 2);
}

/** Recursively replace BN, PublicKey, bigint, and Buffer with plain values. */
export function normalizeForJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (BN.isBN(value)) return value.toString(10);
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (typeof value === "object") {
    if (
      "toBase58" in value &&
      typeof (value as { toBase58: unknown }).toBase58 === "function"
    ) {
      return (value as { toBase58: () => string }).toBase58();
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        normalizeForJson(inner),
      ]),
    );
  }
  return value;
}

/** Solscan links, because a bare base58 string is a dead end in a terminal. */
export function solscanToken(mint: string): string {
  return `https://solscan.io/token/${mint}`;
}

export function solscanTx(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function solscanAccount(address: string): string {
  return `https://solscan.io/account/${address}`;
}

export function pumpFunUrl(mint: string): string {
  return `https://pump.fun/coin/${mint}`;
}
