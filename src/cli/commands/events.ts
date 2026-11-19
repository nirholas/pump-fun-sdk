/**
 * `pump events <signature>` — decode every Pump event in a transaction.
 *
 * Explorers show Pump transactions as opaque base64 `Program data:` lines. The
 * SDK already knows all 60-odd event layouts across the three programs, so this
 * turns a signature into readable trade, launch, migration, and fee records.
 */

import type { Command } from "commander";
import BN from "bn.js";

import type { PumpEvent } from "../../onlineSdk";
import type { CliContext } from "../context";
import { CliError } from "../context";
import {
  c,
  formatSol,
  formatTokens,
  heading,
  keyValue,
  plainText,
  shortAddress,
  solscanTx,
  toJson,
} from "../format";

export function registerEventsCommand(
  program: Command,
  getContext: () => CliContext,
): void {
  program
    .command("events <signature>")
    .description("Decode the Pump events emitted by a transaction")
    .option(
      "--finalized",
      "Read at the finalized commitment instead of confirmed",
    )
    .action(async (signature: string, options: { finalized?: boolean }) => {
      await runEvents(getContext(), signature, options.finalized === true);
    });
}

async function runEvents(
  ctx: CliContext,
  signature: string,
  finalized: boolean,
): Promise<void> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(signature)) {
    throw new CliError(
      `"${signature}" is not a transaction signature`,
      "Signatures are 87 or 88 base58 characters. Copy it from an explorer or from a `pump buy` result.",
    );
  }

  const events = await ctx.sdk.parseTransactionEvents(
    signature,
    finalized ? "finalized" : "confirmed",
  );

  if (ctx.json) {
    process.stdout.write(`${toJson({ signature, events })}\n`);
    return;
  }

  if (events.length === 0) {
    process.stdout.write(
      `${[
        heading(shortAddress(signature, 8), "no Pump events"),
        "",
        `  ${c.dim("Either the transaction touched no Pump program, or it is not yet visible at this commitment. Retry with --finalized.")}`,
        "",
        `  ${c.dim(solscanTx(signature))}`,
        "",
      ].join("\n")}\n`,
    );
    return;
  }

  const blocks = events.map((event, index) => {
    const rows = describeEvent(event);
    return [
      `  ${c.bold(`${index + 1}. ${c.cyan(event.type)}`)}`,
      keyValue(rows, "     "),
    ].join("\n");
  });

  process.stdout.write(
    `${[
      heading(shortAddress(signature, 8), `${events.length} event${events.length === 1 ? "" : "s"}`),
      "",
      blocks.join("\n\n"),
      "",
      `  ${c.dim(solscanTx(signature))}`,
      "",
    ].join("\n")}\n`,
  );
}

/**
 * Render the fields that matter per event type.
 *
 * Dumping every field of a 20-field trade event is as unreadable as the base64
 * it came from, so the common types get a curated view and everything else
 * falls back to a generic scalar dump.
 */
function describeEvent(event: PumpEvent): { label: string; value: string }[] {
  switch (event.type) {
    case "trade": {
      const trade = event.data;
      return [
        { label: "Side", value: trade.isBuy ? c.green("buy") : c.red("sell") },
        { label: "Mint", value: trade.mint.toBase58() },
        { label: "User", value: trade.user.toBase58() },
        { label: "SOL", value: formatSol(trade.solAmount) },
        { label: "Tokens", value: formatTokens(trade.tokenAmount) },
        {
          label: "Fees",
          value: `${formatSol(trade.fee)} protocol + ${formatSol(trade.creatorFee)} creator`,
        },
        { label: "Instruction", value: plainText(trade.ixName) },
      ];
    }
    case "create": {
      const created = event.data;
      return [
        { label: "Name", value: plainText(created.name) },
        { label: "Symbol", value: plainText(created.symbol) },
        { label: "Mint", value: created.mint.toBase58() },
        { label: "Creator", value: created.creator.toBase58() },
        { label: "URI", value: plainText(created.uri) },
      ];
    }
    case "complete": {
      return [
        { label: "Mint", value: event.data.mint.toBase58() },
        { label: "Status", value: c.green("graduated to PumpAMM") },
      ];
    }
    case "collectCreatorFee": {
      return [
        { label: "Creator", value: event.data.creator.toBase58() },
        { label: "Amount", value: formatSol(event.data.creatorFee) },
      ];
    }
    default:
      return genericRows(event.data as unknown as Record<string, unknown>);
  }
}

function genericRows(
  data: Record<string, unknown>,
): { label: string; value: string }[] {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined && !Array.isArray(value))
    .slice(0, 10)
    .map(([key, value]) => ({
      label: key,
      value: renderScalar(value),
    }));
}

function renderScalar(value: unknown): string {
  if (BN.isBN(value)) return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (
    typeof value === "object" &&
    value !== null &&
    "toBase58" in value &&
    typeof (value as { toBase58: unknown }).toBase58 === "function"
  ) {
    return (value as { toBase58: () => string }).toBase58();
  }
  return plainText(String(value));
}
