/**
 * `pump pda` — derive any Pump program address from the command line.
 *
 * Deriving a PDA by hand means knowing the seed bytes and the program id, and
 * getting either wrong yields a valid-looking address that simply does not
 * exist. This exposes the SDK's derivations directly so a shell script, an
 * explorer search, or a bug report can name the exact account.
 */

import type { Command } from "commander";

import {
  AMM_FEE_CONFIG_PDA,
  AMM_GLOBAL_CONFIG_PDA,
  AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
  GLOBAL_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  PUMP_EVENT_AUTHORITY_PDA,
  PUMP_FEE_CONFIG_PDA,
  QUOTE_CONTROL_PDA,
  ammCreatorVaultPda,
  ammUserVolumeAccumulatorPda,
  bondingCurvePda,
  canonicalPumpPoolPda,
  creatorVaultPda,
  feeSharingConfigPda,
  pumpPoolAuthorityPda,
  userVolumeAccumulatorPda,
} from "../../pda";
import { PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID, PUMP_PROGRAM_ID } from "../../sdk";
import type { CliContext } from "../context";
import { CliError, parsePublicKey } from "../context";
import { c, heading, keyValue, solscanAccount, toJson } from "../format";

/** Derivations that take a single address argument. */
const WITH_ARGUMENT: Record<string, { describe: string; derive: (key: string) => string }> = {
  "bonding-curve": {
    describe: "Bonding curve account for a mint",
    derive: (mint) => bondingCurvePda(parsePublicKey(mint, "mint")).toBase58(),
  },
  pool: {
    describe: "Canonical PumpAMM pool for a mint",
    derive: (mint) => canonicalPumpPoolPda(parsePublicKey(mint, "mint")).toBase58(),
  },
  "pool-authority": {
    describe: "Pool authority for a mint",
    derive: (mint) => pumpPoolAuthorityPda(parsePublicKey(mint, "mint")).toBase58(),
  },
  "creator-vault": {
    describe: "Bonding-curve creator fee vault",
    derive: (creator) => creatorVaultPda(parsePublicKey(creator, "creator")).toBase58(),
  },
  "amm-creator-vault": {
    describe: "PumpAMM creator fee vault",
    derive: (creator) => ammCreatorVaultPda(parsePublicKey(creator, "creator")).toBase58(),
  },
  "user-volume": {
    describe: "Volume accumulator for a user",
    derive: (user) => userVolumeAccumulatorPda(parsePublicKey(user, "user")).toBase58(),
  },
  "amm-user-volume": {
    describe: "PumpAMM volume accumulator for a user",
    derive: (user) => ammUserVolumeAccumulatorPda(parsePublicKey(user, "user")).toBase58(),
  },
  "fee-sharing": {
    describe: "Fee sharing config for a mint",
    derive: (mint) => feeSharingConfigPda(parsePublicKey(mint, "mint")).toBase58(),
  },
};

/** Fixed protocol accounts, no argument needed. */
const CONSTANTS: Record<string, { describe: string; address: string }> = {
  global: { describe: "Pump global config", address: GLOBAL_PDA.toBase58() },
  "quote-control": { describe: "Pump quote control (admitted quote mints)", address: QUOTE_CONTROL_PDA.toBase58() },
  "amm-global-config": {
    describe: "PumpAMM global config",
    address: AMM_GLOBAL_CONFIG_PDA.toBase58(),
  },
  "fee-config": { describe: "Fee program config", address: PUMP_FEE_CONFIG_PDA.toBase58() },
  "amm-fee-config": { describe: "PumpAMM fee config", address: AMM_FEE_CONFIG_PDA.toBase58() },
  "global-volume": {
    describe: "Global volume accumulator",
    address: GLOBAL_VOLUME_ACCUMULATOR_PDA.toBase58(),
  },
  "amm-global-volume": {
    describe: "PumpAMM global volume accumulator",
    address: AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA.toBase58(),
  },
  "event-authority": {
    describe: "Pump event authority",
    address: PUMP_EVENT_AUTHORITY_PDA.toBase58(),
  },
  "program-pump": { describe: "Pump program id", address: PUMP_PROGRAM_ID.toBase58() },
  "program-amm": { describe: "PumpAMM program id", address: PUMP_AMM_PROGRAM_ID.toBase58() },
  "program-fees": { describe: "Fee program id", address: PUMP_FEE_PROGRAM_ID.toBase58() },
};

export function registerPdaCommand(
  program: Command,
  getContext: () => CliContext,
): void {
  program
    .command("pda [kind] [address]")
    .description("Derive a Pump program address (run with no arguments to list every kind)")
    .action((kind: string | undefined, address: string | undefined) => {
      runPda(getContext(), kind, address);
    });
}

function runPda(
  ctx: CliContext,
  kind: string | undefined,
  address: string | undefined,
): void {
  if (kind === undefined) {
    listKinds(ctx);
    return;
  }

  const constant = CONSTANTS[kind];
  if (constant !== undefined) {
    emit(ctx, kind, constant.address, constant.describe);
    return;
  }

  const derivation = WITH_ARGUMENT[kind];
  if (derivation === undefined) {
    throw new CliError(
      `Unknown PDA kind "${kind}"`,
      `Run \`pump pda\` with no arguments to list them. Closest matches: ${suggest(kind).join(", ")}`,
    );
  }
  if (address === undefined) {
    throw new CliError(
      `\`pump pda ${kind}\` needs an address`,
      `${derivation.describe}. Usage: pump pda ${kind} <address>`,
    );
  }

  emit(ctx, kind, derivation.derive(address), derivation.describe);
}

function emit(
  ctx: CliContext,
  kind: string,
  address: string,
  describe: string,
): void {
  if (ctx.json) {
    process.stdout.write(`${toJson({ kind, address, description: describe })}\n`);
    return;
  }
  process.stdout.write(
    `${[
      "",
      keyValue([
        { label: describe, value: c.bold(address) },
        { label: "Solscan", value: c.dim(solscanAccount(address)) },
      ]),
      "",
    ].join("\n")}\n`,
  );
}

function listKinds(ctx: CliContext): void {
  if (ctx.json) {
    process.stdout.write(
      `${toJson({
        constants: Object.entries(CONSTANTS).map(([kind, value]) => ({
          kind,
          description: value.describe,
          address: value.address,
        })),
        derived: Object.entries(WITH_ARGUMENT).map(([kind, value]) => ({
          kind,
          description: value.describe,
          usage: `pump pda ${kind} <address>`,
        })),
      })}\n`,
    );
    return;
  }

  process.stdout.write(
    `${[
      heading("Derived from an address"),
      "",
      keyValue(
        Object.entries(WITH_ARGUMENT).map(([kind, value]) => ({
          label: kind,
          value: value.describe,
        })),
      ),
      heading("Fixed protocol accounts"),
      "",
      keyValue(
        Object.entries(CONSTANTS).map(([kind, value]) => ({
          label: kind,
          value: value.describe,
        })),
      ),
      "",
      c.dim("  Example: pump pda bonding-curve <mint>"),
      "",
    ].join("\n")}\n`,
  );
}

/** Cheap edit-distance-free suggestion: shared prefix or substring. */
function suggest(input: string): string[] {
  const all = [...Object.keys(WITH_ARGUMENT), ...Object.keys(CONSTANTS)];
  const matches = all.filter(
    (kind) => kind.includes(input) || input.includes(kind.split("-")[0] ?? kind),
  );
  return matches.length > 0 ? matches.slice(0, 3) : all.slice(0, 3);
}
