import js from "@eslint/js";
import eslintConfigFlatGitignore from "eslint-config-flat-gitignore";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginJest from "eslint-plugin-jest";
import globals from "globals";
import typescriptEslint from "typescript-eslint";

/**
 * Two tiers, on purpose.
 *
 * `src/` is the published `@nirholas/pump-sdk` package. It is held to the
 * strict bar: no implicit `any`, no unused symbols, type-only imports marked
 * as such so `verbatimModuleSyntax` consumers do not pull runtime deps.
 *
 * Everything else in this monorepo (bots, demos, one-off scripts) is support
 * code. It still gets linted, but style-level findings there are warnings so a
 * demo script cannot turn the SDK's CI red.
 */
export default typescriptEslint.config(
  eslintConfigFlatGitignore(),
  {
    ignores: [
      "dist/",
      "coverage/",
      "node_modules/",
      "rust/",
      "site/",
      "website/",
      "live/",
      "packages/",
      "mcp-server/",
      "channel-bot/",
      "websocket-server/",
      "telegram-bot/",
      "x402/",
      // Vendored upstream sources. Not ours to restyle; see DECODERS.md.
      "pump-fun-repos/",
      "**/*.json",
    ],
  },
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    // Node and browser globals. Without this every `process`, `console` and
    // `fetch` in the repo reads as `no-undef`.
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["src/__tests__/**/*.ts"],
    ...eslintPluginJest.configs["flat/recommended"],
  },
  {
    // Support code: bots, demos, scripts, examples.
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    ignores: ["src/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
  eslintConfigPrettier,
);
