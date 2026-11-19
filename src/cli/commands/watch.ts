/**
 * `pump watch <mint>` — a live bonding-curve dashboard in the terminal.
 *
 * Polls rather than subscribing on purpose: a WebSocket subscription needs an
 * endpoint that allows `accountSubscribe`, and most free RPC lanes do not.
 * Polling works on every endpoint, including the default public one, which is
 * the difference between a command that always works and a command that works
 * on the author's machine.
 */

import type { Command } from "commander";

import type { BondingCurveSummary } from "../../analytics";
import type { CliContext } from "../context";
import { CliError, parsePublicKey } from "../context";
import {
  c,
  formatSol,
  formatTokens,
  keyValue,
  lamportsToSol,
  meter,
} from "../format";

export function registerWatchCommand(
  program: Command,
  getContext: () => CliContext,
): void {
  program
    .command("watch <mint>")
    .description("Live-refreshing price and graduation progress for a token")
    .option("-i, --interval <seconds>", "Seconds between refreshes", parseInterval, 5)
    .option("-n, --count <n>", "Stop after this many refreshes", parseCount)
    .action(
      async (mint: string, options: { interval: number; count?: number }) => {
        await runWatch(getContext(), mint, options);
      },
    );
}

function parseInterval(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new CliError(
      `--interval must be at least 1 second, got "${value}"`,
      "Anything faster gets rate limited by public RPC endpoints.",
    );
  }
  return parsed;
}

function parseCount(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new CliError(`--count must be a whole number of at least 1, got "${value}"`);
  }
  return parsed;
}

async function runWatch(
  ctx: CliContext,
  mintArg: string,
  options: { interval: number; count?: number },
): Promise<void> {
  const mint = parsePublicKey(mintArg, "mint");

  let running = true;
  const stop = (): void => {
    running = false;
  };
  process.once("SIGINT", stop);

  let iteration = 0;
  let previous: BondingCurveSummary | undefined;
  const startedAt = Date.now();

  // JSON mode streams one object per poll so `pump watch --json | jq` works as
  // a feed rather than blocking until the command is interrupted.
  while (running) {
    iteration += 1;

    let summary: BondingCurveSummary;
    try {
      summary = await ctx.sdk.fetchBondingCurveSummary(mint);
    } catch (error) {
      if (iteration === 1) {
        throw new CliError(
          `Cannot read the bonding curve for ${mintArg}`,
          (error as Error).message,
        );
      }
      // A transient RPC failure mid-watch should not end the session.
      if (!ctx.json) {
        process.stderr.write(
          `${c.yellow(`  RPC error, retrying: ${(error as Error).message}`)}\n`,
        );
      }
      await sleep(options.interval * 1000);
      continue;
    }

    if (ctx.json) {
      process.stdout.write(
        `${JSON.stringify({
          mint: mint.toBase58(),
          at: new Date().toISOString(),
          marketCapLamports: summary.marketCap.toString(),
          marketCapSol: lamportsToSol(summary.marketCap),
          buyPricePerTokenLamports: summary.buyPricePerToken.toString(),
          sellPricePerTokenLamports: summary.sellPricePerToken.toString(),
          progressBps: summary.progressBps,
          isGraduated: summary.isGraduated,
          realSolReserves: summary.realSolReserves.toString(),
        })}\n`,
      );
    } else {
      render(mintArg, summary, previous, iteration, startedAt, options.interval);
    }

    previous = summary;

    if (options.count !== undefined && iteration >= options.count) break;
    if (summary.isGraduated) {
      if (!ctx.json) {
        process.stdout.write(
          `\n  ${c.green("Graduated. Run `pump pool " + mintArg + "` for the AMM pool.")}\n`,
        );
      }
      break;
    }
    await sleep(options.interval * 1000);
  }

  process.removeListener("SIGINT", stop);
  if (!ctx.json && !running) {
    process.stdout.write(`\n  ${c.dim("Stopped.")}\n`);
  }
}

function render(
  mintArg: string,
  summary: BondingCurveSummary,
  previous: BondingCurveSummary | undefined,
  iteration: number,
  startedAt: number,
  interval: number,
): void {
  const clear = "\u001b[2J\u001b[H";
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const delta = previous === undefined ? undefined : summary.marketCap.sub(previous.marketCap);

  const trend =
    delta === undefined || delta.isZero()
      ? c.dim("flat")
      : delta.isNeg()
        ? c.red(`▼ ${formatSol(delta.neg())}`)
        : c.green(`▲ ${formatSol(delta)}`);

  const progressDelta =
    previous === undefined
      ? ""
      : ` ${c.dim(`(${signed(summary.progressBps - previous.progressBps)} bps)`)}`;

  process.stdout.write(
    `${clear}${[
      `${c.bold(c.cyan("pump watch"))} ${c.dim(mintArg)}`,
      c.dim(`refresh ${iteration} · every ${interval}s · ${elapsed}s elapsed · ctrl-c to stop`),
      "",
      keyValue([
        { label: "Market cap", value: `${c.bold(formatSol(summary.marketCap))}  ${trend}` },
        { label: "Buy", value: formatSol(summary.buyPricePerToken, 9), note: "per token" },
        { label: "Sell", value: formatSol(summary.sellPricePerToken, 9), note: "per token" },
        { label: "SOL in curve", value: formatSol(summary.realSolReserves) },
        { label: "Tokens left", value: formatTokens(summary.realTokenReserves) },
        {
          label: "To graduate",
          value: summary.isGraduated
            ? c.green("done")
            : formatSol(summary.solNeededToGraduate),
        },
      ]),
      "",
      `  ${c.dim("Graduation")}  ${meter(summary.progressBps / 10_000)}${progressDelta}`,
      "",
    ].join("\n")}\n`,
  );
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
