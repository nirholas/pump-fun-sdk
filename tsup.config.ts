import { readFileSync } from "node:fs";

import { defineConfig } from "tsup";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

// None of the three builds cleans: they run concurrently and share `dist`, so
// a clean inside one could delete another's output. `npm run build` empties
// `dist` first instead.
export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    outDir: "dist",
    dts: true,
    clean: false,
    sourcemap: true,
    splitting: false,
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    outDir: "dist/esm",
    dts: true,
    clean: false,
    sourcemap: true,
    splitting: false,
  },
  {
    // The `pump` binary. CJS only: a shebang entry has to run under plain
    // `node` on every install, and an ESM bin inside a CJS package resolves
    // inconsistently across Node versions and package managers.
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["cjs"],
    outDir: "dist",
    dts: false,
    clean: false,
    sourcemap: false,
    splitting: false,
    // No `banner` here: src/cli/index.ts already carries the shebang and tsup
    // preserves it. Adding one too emits a second `#!` on line 2, which Node
    // rejects outright as a syntax error.
    //
    // The version is inlined at build time rather than read from the manifest
    // at runtime, so `pump --version` cannot drift from the published package
    // and the binary never touches the filesystem to answer it.
    define: { __PUMP_CLI_VERSION__: JSON.stringify(version) },
  },
]);

