/**
 * Safety properties of the `pump` CLI that do not need an RPC: secret keys
 * are never echoed, numeric trade settings are validated wherever they come
 * from, and files holding key material are owner-only and never clobbered.
 */
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { writeKeypairFile } from "../cli/commands/vanity";
import {
  resolveComputeUnitLimit,
  resolvePriorityFee,
  resolveSlippage,
  saveConfig,
  validateComputeUnitLimit,
  validatePriorityFee,
  validateSlippage,
} from "../cli/config";
import { describeKeypairSource, loadKeypair } from "../cli/context";

const ENV_KEYS = ["PUMP_CONFIG_DIR", "PUMP_SLIPPAGE", "PUMP_PRIORITY_FEE"];
let dir: string;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pump-cli-"));
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.PUMP_CONFIG_DIR = dir;
  delete process.env.PUMP_SLIPPAGE;
  delete process.env.PUMP_PRIORITY_FEE;
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dir, { recursive: true, force: true });
});

describe("keypair secrets are never echoed", () => {
  const secret = bs58.encode(Keypair.generate().secretKey);

  it("describes an inline secret as redacted", () => {
    expect(describeKeypairSource(secret)).not.toContain(secret.slice(0, 20));
    expect(describeKeypairSource(secret)).toMatch(/redacted/);
  });

  it("describes a path as the path", () => {
    const path = join(dir, "id.json");
    expect(describeKeypairSource(path)).toBe(path);
  });

  it("redacts an inline JSON byte array", () => {
    const json = JSON.stringify(Array.from(Keypair.generate().secretKey));
    expect(describeKeypairSource(json)).toMatch(/redacted/);
  });

  it("loads a valid inline base58 secret", () => {
    const keypair = Keypair.generate();
    expect(
      loadKeypair(bs58.encode(keypair.secretKey)).publicKey.equals(
        keypair.publicKey,
      ),
    ).toBe(true);
  });

  it("does not repeat a malformed secret in the error", () => {
    // One character short: fails to decode, still clearly secret material.
    const malformed = secret.slice(0, -1);
    let message = "";
    try {
      loadKeypair(malformed);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(malformed.slice(0, 20));
  });

  it("does not repeat an inline JSON array in the error", () => {
    const json = JSON.stringify(Array.from(Keypair.generate().secretKey));
    expect(() => loadKeypair(json)).toThrow(/value not shown/);
  });

  it("still names a missing path", () => {
    const path = join(dir, "missing.json");
    expect(() => loadKeypair(path)).toThrow(path);
  });
});

describe("numeric trade settings", () => {
  it.each([0, 0.5, 1, 100, "2.5"])("accepts slippage %p", (value) => {
    expect(validateSlippage(value, "test")).toBe(Number(value));
  });

  it.each([-1, 100.01, 150, Number.NaN, "1%", "", "abc", true, null])(
    "rejects slippage %p",
    (value) => {
      expect(() => validateSlippage(value, "test")).toThrow(/slippage/);
    },
  );

  it.each([0, 1, 50_000, "1000"])("accepts priority fee %p", (value) => {
    expect(validatePriorityFee(value, "test")).toBe(Number(value));
  });

  it.each([-1, 0.5, Number.NaN, "1e400", "x"])(
    "rejects priority fee %p",
    (value) => {
      expect(() => validatePriorityFee(value, "test")).toThrow(/priority fee/);
    },
  );

  it.each([1, 200_000, 1_400_000])("accepts compute unit limit %p", (value) => {
    expect(validateComputeUnitLimit(value, "test")).toBe(value);
  });

  it.each([0, 1_400_001, 1.5, Number.NaN])(
    "rejects compute unit limit %p",
    (value) => {
      expect(() => validateComputeUnitLimit(value, "test")).toThrow(
        /compute unit limit/,
      );
    },
  );

  it("rejects a bad PUMP_SLIPPAGE instead of silently using the default", () => {
    process.env.PUMP_SLIPPAGE = "1%";
    expect(() => resolveSlippage()).toThrow(/PUMP_SLIPPAGE/);
  });

  it("rejects a NaN --slippage flag", () => {
    expect(() => resolveSlippage(Number.NaN)).toThrow(/--slippage/);
  });

  it("rejects a bad saved value and names the config file", () => {
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({ slippage: "high", priorityFee: -5, computeUnitLimit: 0 }),
    );
    expect(() => resolveSlippage()).toThrow(dir);
    expect(() => resolvePriorityFee()).toThrow(/priority fee/);
    expect(() => resolveComputeUnitLimit()).toThrow(/compute unit limit/);
  });

  it("uses the defaults when nothing is set", () => {
    expect(resolveSlippage()).toBe(1);
    expect(resolvePriorityFee()).toBe(0);
    expect(resolveComputeUnitLimit()).toBe(300_000);
  });

  it("lets the flag win over env and config", () => {
    process.env.PUMP_SLIPPAGE = "3";
    saveConfig({ slippage: 4 });
    expect(resolveSlippage(2)).toBe(2);
    expect(resolveSlippage()).toBe(3);
  });
});

describe("key material on disk", () => {
  it("saveConfig tightens an existing world-readable config to 0600", () => {
    const path = join(dir, "config.json");
    writeFileSync(path, "{}\n", { mode: 0o644 });
    chmodSync(path, 0o644);
    saveConfig({ keypair: "/tmp/id.json" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("writeKeypairFile refuses to overwrite an existing file", () => {
    const path = join(dir, "id.json");
    writeFileSync(path, "existing wallet");
    expect(() => writeKeypairFile(Keypair.generate(), path)).toThrow(
      /already exists/,
    );
    expect(readFileSync(path, "utf8")).toBe("existing wallet");
  });

  it("writeKeypairFile writes a loadable keypair", () => {
    const keypair = Keypair.generate();
    const path = writeKeypairFile(keypair, join(dir, "mint.json"));
    expect(loadKeypair(path).publicKey.equals(keypair.publicKey)).toBe(true);
  });
});
