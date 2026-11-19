/**
 * `pump vanity` — grind a mint address with a chosen prefix or suffix.
 *
 * pump.fun mints conventionally end in `pump`, which is a four-character
 * base58 suffix and therefore about 11 million attempts on average. The command
 * shows a live rate and an honest estimate up front, because the difference
 * between a four and a six character pattern is the difference between seconds
 * and days and users deserve to know which one they just asked for.
 */

import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import type { Keypair } from "@solana/web3.js";

import {
  estimateVanityMintAttempts,
  generateVanityMint,
  VanityError,
} from "../../vanityMint";
import { configDir } from "../config";
import type { CliContext } from "../context";
import { CliError } from "../context";
import { c, heading, info, keyValue, success, toJson, warn } from "../format";

export function registerVanityCommand(
  program: Command,
  getContext: () => CliContext,
): void {
  program
    .command("vanity")
    .description("Grind a mint keypair whose address matches a prefix or suffix")
    .option("-s, --suffix <suffix>", "Required ending, e.g. `pump`")
    .option("-p, --prefix <prefix>", "Required beginning")
    .option("-i, --case-insensitive", "Match without regard to case (much faster)")
    .option("-o, --out <path>", "Where to write the keypair JSON")
    .option("--max-attempts <n>", "Give up after this many attempts", Number)
    .action(async (options: VanityOptions) => {
      await runVanity(getContext(), options);
    });
}

interface VanityOptions {
  suffix?: string;
  prefix?: string;
  caseInsensitive?: boolean;
  out?: string;
  maxAttempts?: number;
}

async function runVanity(
  ctx: CliContext,
  options: VanityOptions,
): Promise<void> {
  if (options.suffix === undefined && options.prefix === undefined) {
    throw new CliError(
      "A vanity grind needs a pattern",
      "Pass --suffix pump to match the pump.fun convention, or --prefix <chars>.",
    );
  }

  // Checked before grinding, so a taken path fails in a second rather than
  // after hours of work. `writeKeypairFile` refuses to overwrite as well.
  if (options.out !== undefined && existsSync(options.out)) {
    throw new CliError(
      `${options.out} already exists`,
      "Choose a new --out path. Overwriting it could destroy a wallet keypair.",
    );
  }

  const expected = estimateVanityMintAttempts({
    prefix: options.prefix,
    suffix: options.suffix,
    caseInsensitive: options.caseInsensitive,
  });

  if (!ctx.json) {
    process.stderr.write(
      `${[
        heading("Vanity mint grind"),
        "",
        keyValue([
          { label: "Prefix", value: options.prefix ?? c.dim("any") },
          { label: "Suffix", value: options.suffix ?? c.dim("any") },
          {
            label: "Case",
            value: options.caseInsensitive === true ? "insensitive" : "sensitive",
          },
          {
            label: "Expected",
            value: `${expected.toLocaleString()} attempts on average`,
          },
        ]),
        "",
        ...(expected > 500_000_000
          ? [
              `  ${warn("That pattern is long enough to take hours or days on one core. Shorten it, or add --case-insensitive.")}`,
              "",
            ]
          : []),
      ].join("\n")}`,
    );
  }

  const controller = new AbortController();
  const onInterrupt = (): void => controller.abort(new Error("Cancelled"));
  process.once("SIGINT", onInterrupt);

  let result;
  try {
    result = await generateVanityMint({
      prefix: options.prefix,
      suffix: options.suffix,
      caseInsensitive: options.caseInsensitive,
      maxAttempts: options.maxAttempts,
      signal: controller.signal,
      onProgress: ({ attempts, attemptsPerSecond }) => {
        // Carriage-return progress only makes sense on a terminal. Piped to a
        // file or a log it just concatenates every update into one long line.
        if (ctx.json || process.stderr.isTTY !== true) return;
        const percent = Math.min(99, (attempts / expected) * 100);
        process.stderr.write(
          `\r  ${c.dim(`${attempts.toLocaleString()} attempts · ${Math.round(attemptsPerSecond).toLocaleString()}/s · ~${percent.toFixed(0)}% of expected`)}   `,
        );
      },
    });
  } catch (error) {
    if (error instanceof VanityError) {
      throw new CliError(error.message, "Try a shorter pattern.");
    }
    throw error;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    if (!ctx.json) process.stderr.write(`\r${" ".repeat(78)}\r`);
  }

  const path = writeKeypairFile(result.keypair, options.out);

  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        mint: result.keypair.publicKey.toBase58(),
        keypairPath: path,
        attempts: result.attempts,
        durationMs: result.durationMs,
        attemptsPerSecond: Math.round(
          result.attempts / Math.max(1, result.durationMs / 1000),
        ),
      })}\n`,
    );
    return;
  }

  process.stdout.write(
    `${[
      success(`Found ${c.bold(result.keypair.publicKey.toBase58())}`),
      "",
      keyValue([
        { label: "Attempts", value: result.attempts.toLocaleString() },
        { label: "Duration", value: `${(result.durationMs / 1000).toFixed(1)}s` },
        {
          label: "Rate",
          value: `${Math.round(result.attempts / Math.max(1, result.durationMs / 1000)).toLocaleString()}/s`,
        },
        { label: "Saved to", value: path, note: "mode 0600" },
      ]),
      "",
      info(
        `Launch with it: pump create --name "..." --symbol "..." --uri "https://..." --mint-keypair ${path}`,
      ),
      "",
    ].join("\n")}\n`,
  );
}

/**
 * Persist a ground keypair as a `solana-keygen` compatible JSON byte array.
 *
 * Written 0600 and never printed. A mint keypair that only exists in process
 * memory is one crash away from an address you can never launch. An existing
 * file is never overwritten: `--out ~/.config/solana/id.json` would otherwise
 * replace a wallet.
 */
export function writeKeypairFile(keypair: Keypair, outPath?: string): string {
  const path =
    outPath ?? join(configDir(), "mints", `${keypair.publicKey.toBase58()}.json`);
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  try {
    writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)), {
      mode: 0o600,
      flag: "wx",
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new CliError(
        `${path} already exists; the new keypair was not written`,
        "Choose a new --out path. Overwriting it could destroy a wallet keypair.",
      );
    }
    throw error;
  }
  chmodSync(path, 0o600);
  return path;
}
