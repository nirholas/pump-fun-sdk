/**
 * `pump config` and `pump doctor` — the two commands people run when something
 * is wrong.
 *
 * `doctor` exists because the failure modes of a Solana CLI are boring and
 * identical every time: a dead RPC, a rate-limited public endpoint, a missing
 * keypair, an unfunded wallet, or a clock-skewed node. Diagnosing those by
 * reading a stack trace is a waste of everyone's afternoon.
 */

import type { Command } from "commander";
import BN from "bn.js";

import { GLOBAL_PDA } from "../../pda";
import {
  CONFIG_KEYS,
  configPath,
  loadConfig,
  saveConfig,
  type CliConfig,
} from "../config";
import type { CliContext } from "../context";
import { CliError, describeKeypairSource } from "../context";
import {
  c,
  failure,
  formatSol,
  heading,
  info,
  keyValue,
  success,
  toJson,
  warn,
} from "../format";

export function registerSetupCommands(
  program: Command,
  getContext: () => CliContext,
): void {
  const config = program
    .command("config")
    .description("Read and write the saved CLI configuration");

  config
    .command("list", { isDefault: true })
    .description("Show the current configuration and where it came from")
    .action(() => {
      runConfigList(getContext());
    });

  config
    .command("get <key>")
    .description("Print a single configuration value")
    .action((key: string) => {
      runConfigGet(wantsJson(program), key);
    });

  config
    .command("set <key> <value>")
    .description(`Set a value (${Object.keys(CONFIG_KEYS).join(", ")})`)
    .action((key: string, value: string) => {
      runConfigSet(wantsJson(program), key, value);
    });

  config
    .command("unset <key>")
    .description("Remove a value and fall back to the default")
    .action((key: string) => {
      runConfigUnset(wantsJson(program), key);
    });

  config
    .command("path")
    .description("Print the config file path")
    .action(() => {
      process.stdout.write(`${configPath()}\n`);
    });

  program
    .command("doctor")
    .description("Check the RPC endpoint, the wallet, and protocol reachability")
    .action(async () => {
      await runDoctor(getContext());
    });
}

/**
 * `config get/set/unset` deliberately do not build a `CliContext`: that
 * validates the saved values, and these commands are how a bad saved value
 * gets fixed.
 */
function wantsJson(program: Command): boolean {
  return program.opts<{ json?: boolean }>().json === true;
}

function assertKnownKey(key: string): keyof CliConfig {
  if (!(key in CONFIG_KEYS)) {
    throw new CliError(
      `Unknown config key "${key}"`,
      `Valid keys: ${Object.keys(CONFIG_KEYS).join(", ")}`,
    );
  }
  return key as keyof CliConfig;
}

function runConfigList(ctx: CliContext): void {
  const config = loadConfig();

  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        path: configPath(),
        saved: printableConfig(config),
        effective: {
          rpcUrls: ctx.endpoints,
          keypair: ctx.walletPath,
          slippage: ctx.slippage,
          priorityFee: ctx.priorityFee,
          computeUnitLimit: ctx.computeUnitLimit,
        },
      })}\n`,
    );
    return;
  }

  process.stdout.write(
    `${[
      heading("Effective configuration", configPath()),
      "",
      keyValue([
        { label: "RPC", value: ctx.primaryEndpoint },
        ...(ctx.endpoints.length > 1
          ? [{ label: "Fallbacks", value: ctx.endpoints.slice(1).join(", ") }]
          : []),
        { label: "Keypair", value: ctx.walletPath },
        { label: "Slippage", value: `${ctx.slippage}%` },
        {
          label: "Priority fee",
          value:
            ctx.priorityFee > 0
              ? `${ctx.priorityFee} micro-lamports/CU`
              : c.dim("none"),
        },
        { label: "Compute limit", value: String(ctx.computeUnitLimit) },
      ]),
      "",
      Object.keys(config).length === 0
        ? `  ${c.dim("Nothing is saved yet, everything above is a default. Set one with `pump config set rpcUrl <url>`.")}`
        : `  ${c.dim(`Saved keys: ${Object.keys(config).join(", ")}`)}`,
      "",
    ].join("\n")}\n`,
  );
}

/** A saved value as it may be printed: an inline keypair secret is redacted. */
function printable(key: keyof CliConfig, value: unknown): unknown {
  return key === "keypair" && typeof value === "string"
    ? describeKeypairSource(value)
    : value;
}

/** The saved config with secret values redacted, for display. */
function printableConfig(config: CliConfig): CliConfig {
  return config.keypair === undefined
    ? config
    : { ...config, keypair: describeKeypairSource(config.keypair) };
}

function runConfigGet(asJson: boolean, key: string): void {
  const typed = assertKnownKey(key);
  const value = printable(typed, loadConfig()[typed]);
  if (asJson) {
    process.stdout.write(`${toJson({ key, value: value ?? null })}\n`);
    return;
  }
  process.stdout.write(`${value === undefined ? "" : String(value)}\n`);
}

function runConfigSet(asJson: boolean, key: string, value: string): void {
  const typed = assertKnownKey(key);
  const config = loadConfig();
  const parsed = CONFIG_KEYS[typed](value);
  const next = { ...config, [typed]: parsed };
  const path = saveConfig(next);
  const shown = printable(typed, parsed);

  if (asJson) {
    process.stdout.write(`${toJson({ key, value: shown, path })}\n`);
    return;
  }
  process.stdout.write(`${success(`${key} = ${JSON.stringify(shown)}`)}\n`);
}

function runConfigUnset(asJson: boolean, key: string): void {
  const typed = assertKnownKey(key);
  const config = loadConfig();
  delete config[typed];
  const path = saveConfig(config);

  if (asJson) {
    process.stdout.write(`${toJson({ key, value: null, path })}\n`);
    return;
  }
  process.stdout.write(`${success(`${key} unset`)}\n`);
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
}

async function runDoctor(ctx: CliContext): Promise<void> {
  const checks: Check[] = [];

  checks.push(await checkRpc(ctx));
  checks.push(await checkProtocol(ctx));
  const walletCheck = checkWallet(ctx);
  checks.push(walletCheck);
  if (walletCheck.ok) checks.push(await checkBalance(ctx));

  const failures = checks.filter((check) => !check.ok);

  if (ctx.json) {
    process.stdout.write(`${toJson({ checks, healthy: failures.length === 0 })}\n`);
    process.exitCode = failures.length === 0 ? 0 : 1;
    return;
  }

  const lines = checks.map((check) => {
    const status = check.ok ? success(check.name) : failure(check.name);
    const hint =
      check.hint === undefined ? "" : `\n      ${c.yellow(check.hint)}`;
    return `  ${status}\n      ${c.dim(check.detail)}${hint}`;
  });

  process.stdout.write(
    `${[
      heading("pump doctor"),
      "",
      lines.join("\n\n"),
      "",
      failures.length === 0
        ? `  ${success("Everything checks out.")}`
        : `  ${warn(`${failures.length} check${failures.length === 1 ? "" : "s"} failed.`)}`,
      "",
    ].join("\n")}\n`,
  );

  process.exitCode = failures.length === 0 ? 0 : 1;
}

async function checkRpc(ctx: CliContext): Promise<Check> {
  const started = Date.now();
  try {
    const slot = await ctx.connection.getSlot("confirmed");
    const latency = Date.now() - started;
    return {
      name: `RPC reachable (${latency} ms)`,
      ok: true,
      detail: `${ctx.primaryEndpoint} at slot ${slot.toLocaleString()}`,
      hint:
        latency > 2000
          ? "That endpoint is slow. A dedicated RPC makes every command noticeably faster."
          : undefined,
    };
  } catch (error) {
    return {
      name: "RPC reachable",
      ok: false,
      detail: `${ctx.primaryEndpoint}: ${(error as Error).message}`,
      hint: "Set a working endpoint with `pump config set rpcUrl <url>`, or export PUMP_RPC_URL.",
    };
  }
}

async function checkProtocol(ctx: CliContext): Promise<Check> {
  try {
    const global = await ctx.sdk.fetchGlobal();
    return {
      name: "Pump protocol readable",
      ok: true,
      detail: `global ${GLOBAL_PDA.toBase58()} decoded, authority ${global.authority.toBase58()}`,
    };
  } catch (error) {
    return {
      name: "Pump protocol readable",
      ok: false,
      detail: (error as Error).message,
      hint: "The endpoint answered but could not serve the Pump global account. Devnet and testnet endpoints do not host the Pump programs: use a mainnet RPC.",
    };
  }
}

function checkWallet(ctx: CliContext): Check {
  try {
    const signer = ctx.requireSigner();
    return {
      name: "Wallet loaded",
      ok: true,
      detail: `${signer.publicKey.toBase58()} from ${ctx.walletPath}`,
    };
  } catch (error) {
    return {
      name: "Wallet loaded",
      ok: false,
      detail: (error as Error).message,
      hint: "Read commands work without a wallet. To trade, run `solana-keygen new` and then `pump config set keypair ~/.config/solana/id.json`.",
    };
  }
}

async function checkBalance(ctx: CliContext): Promise<Check> {
  const signer = ctx.requireSigner();
  try {
    const lamports = await ctx.connection.getBalance(signer.publicKey, "confirmed");
    const funded = lamports > 5_000_000;
    return {
      name: funded ? "Wallet funded" : "Wallet nearly empty",
      ok: funded,
      detail: `${formatSol(new BN(lamports))} available`,
      hint: funded
        ? undefined
        : "Trades need SOL for the buy, the network fee, and rent for a new token account. Around 0.02 SOL is a workable floor.",
    };
  } catch (error) {
    return {
      name: "Wallet funded",
      ok: false,
      detail: (error as Error).message,
    };
  }
}

/** Shown by `pump` with no arguments: the shortest path to a first result. */
export function quickstart(): string {
  return [
    heading("pump", "the Pump protocol from your terminal"),
    "",
    `  ${c.dim("Inspect a token (no wallet needed)")}`,
    `    ${c.cyan("pump curve")} <mint>              price, market cap, graduation progress`,
    `    ${c.cyan("pump quote buy")} <mint> --sol 1  what 1 SOL buys, fees and impact included`,
    `    ${c.cyan("pump watch")} <mint>              live dashboard, refreshes every 5s`,
    "",
    `  ${c.dim("Trade (needs a wallet, always asks before sending)")}`,
    `    ${c.cyan("pump buy")} <mint> --sol 0.5`,
    `    ${c.cyan("pump sell")} <mint> --percent 50`,
    `    ${c.cyan("pump sell")} <mint> --all         sells out and reclaims the rent`,
    "",
    `  ${c.dim("Launch")}`,
    `    ${c.cyan("pump vanity")} --suffix pump      grind a ...pump mint address`,
    `    ${c.cyan("pump create")} --name "My Token" --symbol MTK --uri https://...`,
    "",
    `  ${c.dim("Earnings")}`,
    `    ${c.cyan("pump fees")}                      unclaimed creator fees`,
    `    ${c.cyan("pump incentives")}                unclaimed volume rewards`,
    "",
    `  ${info("First run? `pump doctor` checks your RPC and wallet in one shot.")}`,
    `  ${c.dim("Every command takes --json. Full list: pump --help")}`,
    "",
  ].join("\n");
}
