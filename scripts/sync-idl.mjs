#!/usr/bin/env node
/**
 * Refresh `src/idl/*.json` and `src/idl/*.ts` from the Anchor IDL accounts the
 * pump programs publish on Solana mainnet.
 *
 * The on-chain IDL is the only source that describes the program as it is
 * actually deployed. Vendor packages run ahead of it (they ship types for
 * instructions that are written but not yet live), and a hand-edited copy runs
 * behind it, which is how this repo ended up unable to build `buy_v2` /
 * `sell_v2` while roughly a third of live pump trades used them.
 *
 * Usage:
 *   node scripts/sync-idl.mjs            # rewrite the IDL files in place
 *   node scripts/sync-idl.mjs --check    # exit 1 if the checked-in files drifted
 *   node scripts/sync-idl.mjs --rpc URL  # override the RPC endpoint
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PublicKey } from "@solana/web3.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IDL_DIR = join(ROOT, "src", "idl");

/** The three pump programs this SDK wraps, and the TS type each IDL exports. */
const PROGRAMS = [
  { file: "pump", typeName: "Pump", programId: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" },
  { file: "pump_amm", typeName: "PumpAmm", programId: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA" },
  { file: "pump_fees", typeName: "PumpFees", programId: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ" },
];

/**
 * Public endpoints first: this script issues three `getAccountInfo` calls and
 * needs no key, so it should not spend a metered credit to run in CI.
 */
const DEFAULT_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://solana.leorpc.com/?api_key=FREE",
];

function endpoints() {
  const flagIndex = process.argv.indexOf("--rpc");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) return [process.argv[flagIndex + 1]];
  const fromEnv = [process.env.SOLANA_RPC_URL, ...(process.env.SOLANA_RPC_URLS ?? "").split(",")]
    .map((url) => url?.trim())
    .filter(Boolean);
  return [...fromEnv, ...DEFAULT_ENDPOINTS];
}

/** Anchor stores a program's IDL at `createWithSeed(basePda, "anchor:idl", programId)`. */
function idlAddress(programId) {
  const base = PublicKey.findProgramAddressSync([], programId)[0];
  return PublicKey.createWithSeed(base, "anchor:idl", programId);
}

async function fetchAccount(address, urls) {
  const errors = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [address.toBase58(), { encoding: "base64" }],
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error));
      const value = body.result?.value;
      if (!value) throw new Error(`no account at ${address.toBase58()}`);
      return Buffer.from(value.data[0], "base64");
    } catch (error) {
      errors.push(`${new URL(url).host}: ${error.message}`);
    }
  }
  throw new Error(`every RPC endpoint failed\n  ${errors.join("\n  ")}`);
}

/**
 * Anchor IDL account layout: an 8-byte discriminator, a 32-byte authority, a
 * u32 length, then that many bytes of zlib-deflated JSON.
 */
function decodeIdlAccount(raw) {
  const length = raw.readUInt32LE(40);
  return JSON.parse(inflateSync(raw.subarray(44, 44 + length)).toString("utf8"));
}

/**
 * Anchor's TS type helper renders every IDL name in lowerCamelCase: snake_case
 * segments are joined up and the leading character is lowered, so the JSON's
 * `admin_set_creator` and `BondingCurve` become `adminSetCreator` and
 * `bondingCurve`. `Program`'s account namespace is keyed off exactly that, so
 * getting the leading character wrong breaks every `program.account.*` lookup.
 */
const camel = (name) =>
  name.replace(/_([a-zA-Z0-9])/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, (c) => c.toLowerCase());

/**
 * Anchor's TS type helper names every field in camelCase while the JSON keeps
 * the program's snake_case. Only `name` fields and the strings inside
 * `relations` are identifiers; every other string is data and is left alone.
 */
function toTsIdl(node) {
  if (Array.isArray(node)) return node.map(toTsIdl);
  if (node === null || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "name" && typeof value === "string") out[key] = camel(value);
    else if (key === "relations" && Array.isArray(value)) out[key] = value.map(camel);
    else out[key] = toTsIdl(value);
  }
  return out;
}

/** Renders a JSON value as a TypeScript type literal body. */
function renderType(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const padInner = "  ".repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => `${padInner}${renderType(v, indent + 1)},`).join("\n")}\n${pad}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const body = entries
      .map(([k, v]) => `${padInner}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${renderType(v, indent + 1)};`)
      .join("\n");
    return `{\n${body}\n${pad}}`;
  }
  return JSON.stringify(value);
}

function renderTsFile(idl, typeName, file) {
  return `/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at \`target/idl/${file}.json\`.
 */
export interface ${typeName} ${renderType(toTsIdl(idl), 0)}
`;
}

function prettify(source, filepath) {
  return execFileSync(join(ROOT, "node_modules", ".bin", "prettier"), ["--stdin-filepath", filepath], {
    input: source,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readIfPresent(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function instructionNames(idl) {
  return new Set((idl.instructions ?? []).map((instruction) => instruction.name));
}

async function main() {
  const check = process.argv.includes("--check");
  const urls = endpoints();
  let drifted = 0;

  for (const { file, typeName, programId } of PROGRAMS) {
    const address = await idlAddress(new PublicKey(programId));
    const idl = decodeIdlAccount(await fetchAccount(address, urls));

    const jsonPath = join(IDL_DIR, `${file}.json`);
    const tsPath = join(IDL_DIR, `${file}.ts`);
    const nextJson = `${JSON.stringify(idl, null, 2)}\n`;
    const nextTs = prettify(renderTsFile(idl, typeName, file), tsPath);

    const previousJson = readIfPresent(jsonPath);
    const gained = previousJson
      ? [...instructionNames(idl)].filter((name) => !instructionNames(JSON.parse(previousJson)).has(name))
      : [];
    const changed = previousJson !== nextJson || readIfPresent(tsPath) !== nextTs;

    if (!changed) {
      console.log(`${file}: up to date (${idl.instructions.length} instructions)`);
      continue;
    }
    drifted += 1;
    const summary = gained.length ? ` new instructions: ${gained.join(", ")}` : "";
    if (check) {
      console.error(`${file}: DRIFT against on-chain IDL ${address.toBase58()}.${summary}`);
      continue;
    }
    writeFileSync(jsonPath, nextJson);
    writeFileSync(tsPath, nextTs);
    console.log(`${file}: updated to ${idl.instructions.length} instructions.${summary}`);
  }

  if (check && drifted > 0) {
    console.error(`\n${drifted} IDL file set(s) drifted. Run: node scripts/sync-idl.mjs`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
