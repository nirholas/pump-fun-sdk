/**
 * Transaction assembly, confirmation, and sending.
 *
 * Every write command routes through `submit()`. That guarantees three things
 * hold everywhere and cannot be forgotten in one command: a compute budget is
 * attached, the transaction is simulated before a lamport moves, and the user
 * sees exactly what is about to happen and has to agree to it.
 */

import { createInterface } from "node:readline/promises";
import {
  ComputeBudgetProgram,
  type Keypair,
  type PublicKey,
  Transaction,
  type TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";

import type { CliContext } from "./context";
import { CliError } from "./context";
import { c, failure, heading, info, keyValue, solscanTx, success } from "./format";
import type { Row } from "./format";

export interface SubmitOptions {
  /** Shown above the confirmation prompt, e.g. `Buy on bonding curve`. */
  action: string;
  /** The exact terms of the trade, rendered before the prompt. */
  summary: Row[];
  instructions: TransactionInstruction[];
  signer: Keypair;
  /** Extra signers such as a freshly ground mint keypair. */
  extraSigners?: Keypair[];
}

export interface SubmitResult {
  signature?: string;
  simulated: boolean;
  unitsConsumed?: number;
  logs?: string[];
}

/**
 * Attach a compute budget, simulate, confirm with the user, then send.
 *
 * Returns without sending when `--simulate` is set or the user declines.
 */
export async function submit(
  ctx: CliContext,
  options: SubmitOptions,
): Promise<SubmitResult> {
  const { action, summary, instructions, signer } = options;
  if (instructions.length === 0) {
    throw new CliError(
      `${action} produced no instructions`,
      "Nothing to do: the position is probably already empty.",
    );
  }

  const budget: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: ctx.computeUnitLimit }),
  ];
  if (ctx.priorityFee > 0) {
    budget.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: ctx.priorityFee,
      }),
    );
  }

  const all = [...budget, ...instructions];
  const { blockhash, lastValidBlockHeight } =
    await ctx.connection.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: signer.publicKey,
    recentBlockhash: blockhash,
    instructions: all,
  }).compileToV0Message();
  const transaction = new VersionedTransaction(message);
  transaction.sign([signer, ...(options.extraSigners ?? [])]);

  const simulation = await ctx.connection.simulateTransaction(transaction, {
    replaceRecentBlockhash: true,
    commitment: "confirmed",
  });

  if (simulation.value.err !== null) {
    throw new CliError(
      `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
      formatSimulationHint(simulation.value.logs ?? []),
    );
  }

  const unitsConsumed = simulation.value.unitsConsumed;

  // The terms go to stderr, so they never corrupt `--json` stdout. They are
  // shown whenever a person is about to be asked, JSON mode included: a
  // prompt must never ask someone to approve terms they have not seen.
  const willPrompt = !ctx.simulateOnly && !ctx.assumeYes;
  if (!ctx.json || willPrompt) {
    process.stderr.write(`${heading(action, "simulated OK")}\n`);
    process.stderr.write(
      `${keyValue([
        ...summary,
        { label: "Payer", value: signer.publicKey.toBase58() },
        {
          label: "Priority fee",
          value:
            ctx.priorityFee > 0
              ? `${ctx.priorityFee} micro-lamports/CU`
              : c.dim("none"),
        },
        {
          label: "Compute units",
          value: `${unitsConsumed ?? "?"} used of ${ctx.computeUnitLimit} requested`,
        },
      ])}\n\n`,
    );
  }

  if (ctx.simulateOnly) {
    if (!ctx.json) {
      process.stderr.write(
        `${info("--simulate set: nothing was sent.")}\n`,
      );
    }
    return {
      simulated: true,
      unitsConsumed: unitsConsumed ?? undefined,
      logs: simulation.value.logs ?? undefined,
    };
  }

  const approved = await confirm(ctx, `Send this transaction?`);
  if (!approved) {
    if (!ctx.json) process.stderr.write(`${failure("Aborted.")}\n`);
    return { simulated: true, unitsConsumed: unitsConsumed ?? undefined };
  }

  const signature = await ctx.connection.sendTransaction(transaction, {
    maxRetries: 3,
    skipPreflight: false,
  });

  if (!ctx.json) {
    process.stderr.write(`${info(`Sent ${signature}, confirming...`)}\n`);
  }

  const confirmation = await ctx.connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmation.value.err !== null) {
    throw new CliError(
      `Transaction ${signature} failed on chain: ${JSON.stringify(confirmation.value.err)}`,
      `Inspect it at ${solscanTx(signature)}`,
    );
  }

  if (!ctx.json) {
    process.stderr.write(`${success(`Confirmed: ${solscanTx(signature)}`)}\n`);
  }

  return {
    signature,
    simulated: false,
    unitsConsumed: unitsConsumed ?? undefined,
  };
}

/**
 * Ask the user a yes/no question.
 *
 * `--yes` skips the prompt for scripting. Without a TTY and without `--yes` the
 * answer is no: a piped invocation must never spend funds by default just
 * because nobody was there to say no.
 */
export async function confirm(
  ctx: CliContext,
  question: string,
): Promise<boolean> {
  if (ctx.assumeYes) return true;
  if (!process.stdin.isTTY) {
    throw new CliError(
      "Confirmation required but stdin is not a terminal",
      "Re-run with --yes to approve non-interactively, or --simulate to check the transaction without sending it.",
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${c.bold(question)} ${c.dim("[y/N]")} `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

/**
 * Turn a program error log into something a user can act on.
 *
 * The raw Anchor logs are the only place the real reason appears, and reading
 * 40 lines of `Program ... invoke [2]` to find it is the single most common
 * complaint about Solana tooling.
 */
function formatSimulationHint(logs: string[]): string {
  const anchorError = logs.find((line) => line.includes("Error Message:"));
  if (anchorError !== undefined) {
    return anchorError.slice(anchorError.indexOf("Error Message:")).trim();
  }
  const custom = logs.find((line) => line.includes("custom program error"));
  if (custom !== undefined) return custom.trim();
  const insufficient = logs.find((line) =>
    line.toLowerCase().includes("insufficient"),
  );
  if (insufficient !== undefined) {
    return `${insufficient.trim()} (fund the wallet or lower the amount)`;
  }
  return logs.slice(-3).join(" | ") || "No program logs were returned.";
}

/** Legacy-transaction escape hatch for tools that cannot handle v0 messages. */
export function toLegacyTransaction(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  blockhash: string,
): Transaction {
  const transaction = new Transaction();
  transaction.add(...instructions);
  transaction.feePayer = payer;
  transaction.recentBlockhash = blockhash;
  return transaction;
}
