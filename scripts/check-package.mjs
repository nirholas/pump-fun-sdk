#!/usr/bin/env node
/**
 * Verify the npm tarball the way a consumer meets it.
 *
 * Packs the built package, checks the file list, installs the tarball into a
 * throwaway project, and then loads it through every door `package.json`
 * claims: `require`, `import`, the `pump` bin, and the TypeScript declarations
 * under CommonJS, Node16 ESM and bundler resolution.
 *
 * Run after `npm run build`:  node scripts/check-package.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function fail(message) {
  console.error(`check-package: ${message}`);
  process.exitCode = 1;
}

const work = mkdtempSync(join(tmpdir(), "pump-sdk-package-"));
try {
  // 1. Pack and inspect the file list.
  const [packed] = JSON.parse(run(npm, ["pack", "--json", "--pack-destination", work], ROOT));
  const files = packed.files.map((f) => f.path);
  const required = [
    "package.json",
    "LICENSE",
    "README.md",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/esm/index.mjs",
    "dist/esm/index.d.mts",
    "dist/cli/index.js",
  ];
  for (const path of required) {
    if (!files.includes(path)) fail(`tarball is missing ${path}`);
  }
  const forbidden = files.filter((path) =>
    /(^|\/)__tests__\/|\.test\.ts$|(^|\/)\.env|\.keypair$|(^|\/)id_[^/]*\.json$/.test(path),
  );
  if (forbidden.length > 0) fail(`tarball ships files it must not: ${forbidden.join(", ")}`);
  console.log(`check-package: ${files.length} files, ${(packed.size / 1024).toFixed(0)} kB packed`);

  // 2. Install it into a fresh project.
  const app = join(work, "app");
  run("node", ["-e", `require("node:fs").mkdirSync(${JSON.stringify(app)})`], work);
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "consumer", private: true }));
  run(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(work, packed.filename), "typescript@5"],
    app,
  );

  // 3. Runtime: CommonJS, ESM and the bin must all load and agree.
  const probe = `sdk.bondingCurvePda(new web3.PublicKey("So11111111111111111111111111111111111111112")).toBase58()`;
  writeFileSync(
    join(app, "cjs.cjs"),
    `const sdk = require("@nirholas/pump-sdk"); const web3 = require("@solana/web3.js");\nconsole.log(${probe});\n`,
  );
  writeFileSync(
    join(app, "esm.mjs"),
    `import * as sdk from "@nirholas/pump-sdk"; import * as web3 from "@solana/web3.js";\nconsole.log(${probe});\n`,
  );
  const cjs = run("node", ["cjs.cjs"], app).trim();
  const esm = run("node", ["esm.mjs"], app).trim();
  if (cjs !== esm) fail(`require and import disagree: ${cjs} vs ${esm}`);
  const version = run("node", [join(app, "node_modules/@nirholas/pump-sdk/dist/cli/index.js"), "--version"], app).trim();
  const expected = JSON.parse(run("node", ["-p", "JSON.stringify(require('./package.json').version)"], ROOT));
  if (version !== expected) fail(`pump --version printed ${version}, expected ${expected}`);

  // 4. Types: BN must be a real type (a string assignment has to fail), and
  //    the declarations must resolve under each module mode.
  writeFileSync(
    join(app, "types.ts"),
    [
      `import { PUMP_SDK, getBuyTokenAmountFromSolAmount, PumpIdl, type BondingCurve, type Pump } from "@nirholas/pump-sdk";`,
      `declare const curve: BondingCurve;`,
      `// @ts-expect-error BN must not degrade to any`,
      `const notAString: string = curve.virtualTokenReserves;`,
      `const address: Pump["address"] = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";`,
      `export { PUMP_SDK, getBuyTokenAmountFromSolAmount, PumpIdl, notAString, address };`,
      ``,
    ].join("\n"),
  );
  run("node", ["-e", `require("node:fs").copyFileSync("types.ts", "types.mts")`], app);
  const tsc = join(app, "node_modules/typescript/bin/tsc");
  // skipLibCheck: @pump-fun/pump-swap-sdk ships declarations that do not
  // type-check on their own; this checks ours, not theirs.
  const common = ["--noEmit", "--strict", "--skipLibCheck", "--esModuleInterop"];
  const modes = [
    ["types.ts", "--module", "commonjs", "--moduleResolution", "node10"],
    ["types.ts", "--module", "node16", "--moduleResolution", "node16"],
    ["types.mts", "--module", "node16", "--moduleResolution", "node16"],
    ["types.ts", "--module", "esnext", "--moduleResolution", "bundler"],
  ];
  for (const [file, ...flags] of modes) {
    try {
      run("node", [tsc, ...common, ...flags, file], app);
    } catch (error) {
      fail(`types do not resolve for ${file} ${flags.join(" ")}:\n${error.stdout ?? error.message}`);
    }
  }

  if (!process.exitCode) {
    console.log(`check-package: require, import, bin (${version}) and types (node10, node16 cjs/esm, bundler) OK`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
