/**
 * Example 21: Every PDA the SDK Derives
 *
 * Category: Accounts & Events
 *
 * Derives every program address the SDK exports, grouped by the subsystem
 * that owns it, with the seeds and owning program each one comes from. PDAs
 * are pure functions of their seeds, so this whole example is offline and
 * the addresses it prints are the real mainnet ones.
 *
 * Run: npm run example 21
 */
import {
  AMM_FEE_CONFIG_PDA,
  AMM_GLOBAL_CONFIG_PDA,
  AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
  CANONICAL_POOL_INDEX,
  GLOBAL_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  MAYHEM_PROGRAM_ID,
  PUMP_AMM_EVENT_AUTHORITY_PDA,
  PUMP_AMM_PROGRAM_ID,
  PUMP_EVENT_AUTHORITY_PDA,
  PUMP_FEE_CONFIG_PDA,
  PUMP_FEE_EVENT_AUTHORITY_PDA,
  PUMP_FEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  Platform,
  ammCreatorVaultPda,
  ammUserVolumeAccumulatorPda,
  bondingCurvePda,
  bondingCurveV2Pda,
  canonicalPumpPoolPda,
  creatorVaultPda,
  feeProgramGlobalPda,
  feeSharingConfigPda,
  getEventAuthorityPda,
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
  poolV2Pda,
  pumpPoolAuthorityPda,
  socialFeePda,
  userVolumeAccumulatorPda,
} from "@nirholas/pump-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";

import { heading, row } from "./_lib/format";

/** The subsystem a derived address belongs to. */
export type PdaGroup = "curve" | "amm" | "fees" | "mayhem" | "volume";

export interface PdaEntry {
  group: PdaGroup;
  /** The SDK export that produced it. */
  name: string;
  address: PublicKey;
  /** Seeds in order, as human-readable text. */
  seeds: string[];
  /** The program the address is derived under. */
  program: PublicKey;
}

export interface PdaInputs {
  mint: PublicKey;
  user: PublicKey;
  creator: PublicKey;
  /** Social handle for the fee program's per-user claim account. */
  socialUserId: string;
  platform: Platform;
}

/** Deterministic inputs so the table is reproducible run to run. */
export function exampleInputs(overrides: Partial<PdaInputs> = {}): PdaInputs {
  return {
    mint: new PublicKey("So11111111111111111111111111111111111111112"),
    user: new PublicKey("SysvarRent111111111111111111111111111111111"),
    creator: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
    socialUserId: "pump-sdk-example",
    platform: Platform.GitHub,
    ...overrides,
  };
}

/**
 * Every PDA helper the SDK exports, derived for one set of inputs.
 *
 * Grouped rather than alphabetical because the grouping is the useful part:
 * which program owns the account tells you which instruction needs it and
 * which decoder reads it.
 */
export function buildPdaTable(inputs: PdaInputs): PdaEntry[] {
  const { mint, user, creator, socialUserId, platform } = inputs;

  return [
    {
      group: "curve",
      name: "GLOBAL_PDA",
      address: GLOBAL_PDA,
      seeds: ["global"],
      program: PUMP_PROGRAM_ID,
    },
    {
      group: "curve",
      name: "bondingCurvePda(mint)",
      address: bondingCurvePda(mint),
      seeds: ["bonding-curve", "mint"],
      program: PUMP_PROGRAM_ID,
    },
    {
      group: "curve",
      name: "bondingCurveV2Pda(mint)",
      address: bondingCurveV2Pda(mint),
      seeds: ["bonding-curve-v2", "mint"],
      program: PUMP_PROGRAM_ID,
    },
    {
      group: "curve",
      name: "creatorVaultPda(creator)",
      address: creatorVaultPda(creator),
      seeds: ["creator-vault", "creator"],
      program: PUMP_PROGRAM_ID,
    },
    {
      group: "curve",
      name: "PUMP_EVENT_AUTHORITY_PDA",
      address: PUMP_EVENT_AUTHORITY_PDA,
      seeds: ["__event_authority"],
      program: PUMP_PROGRAM_ID,
    },
    {
      group: "amm",
      name: "AMM_GLOBAL_CONFIG_PDA",
      address: AMM_GLOBAL_CONFIG_PDA,
      seeds: ["global_config"],
      program: PUMP_AMM_PROGRAM_ID,
    },
    {
      group: "amm",
      name: "pumpPoolAuthorityPda(mint)",
      address: pumpPoolAuthorityPda(mint),
      seeds: ["pool-authority", "mint"],
      program: PUMP_PROGRAM_ID,
    },
    {
      group: "amm",
      name: "canonicalPumpPoolPda(mint)",
      address: canonicalPumpPoolPda(mint),
      seeds: [
        "pool",
        `index ${CANONICAL_POOL_INDEX}`,
        "pool authority",
        "base mint",
        "quote mint (WSOL)",
      ],
      program: PUMP_AMM_PROGRAM_ID,
    },
    {
      group: "amm",
      name: "poolV2Pda(mint)",
      address: poolV2Pda(mint),
      seeds: ["pool-v2", "base mint"],
      program: PUMP_AMM_PROGRAM_ID,
    },
    {
      group: "amm",
      name: "ammCreatorVaultPda(creator)",
      address: ammCreatorVaultPda(creator),
      seeds: ["creator_vault", "creator"],
      program: PUMP_AMM_PROGRAM_ID,
    },
    {
      group: "amm",
      name: "PUMP_AMM_EVENT_AUTHORITY_PDA",
      address: PUMP_AMM_EVENT_AUTHORITY_PDA,
      seeds: ["__event_authority"],
      program: PUMP_AMM_PROGRAM_ID,
    },
    {
      group: "fees",
      name: "PUMP_FEE_CONFIG_PDA",
      address: PUMP_FEE_CONFIG_PDA,
      seeds: ["fee_config", "pump program id"],
      program: PUMP_FEE_PROGRAM_ID,
    },
    {
      group: "fees",
      name: "AMM_FEE_CONFIG_PDA",
      address: AMM_FEE_CONFIG_PDA,
      seeds: ["fee_config", "pump amm program id"],
      program: PUMP_FEE_PROGRAM_ID,
    },
    {
      group: "fees",
      name: "feeProgramGlobalPda()",
      address: feeProgramGlobalPda(),
      seeds: ["fee-program-global"],
      program: PUMP_FEE_PROGRAM_ID,
    },
    {
      group: "fees",
      name: "feeSharingConfigPda(mint)",
      address: feeSharingConfigPda(mint),
      seeds: ["sharing-config", "mint"],
      program: PUMP_FEE_PROGRAM_ID,
    },
    {
      group: "fees",
      name: "socialFeePda(userId, platform)",
      address: socialFeePda(socialUserId, platform),
      seeds: ["social-fee-pda", `"${socialUserId}"`, `platform ${platform}`],
      program: PUMP_FEE_PROGRAM_ID,
    },
    {
      group: "fees",
      name: "PUMP_FEE_EVENT_AUTHORITY_PDA",
      address: PUMP_FEE_EVENT_AUTHORITY_PDA,
      seeds: ["__event_authority"],
      program: PUMP_FEE_PROGRAM_ID,
    },
    {
      group: "mayhem",
      name: "getGlobalParamsPda()",
      address: getGlobalParamsPda(),
      seeds: ["global-params"],
      program: MAYHEM_PROGRAM_ID,
    },
    {
      group: "mayhem",
      name: "getMayhemStatePda(mint)",
      address: getMayhemStatePda(mint),
      seeds: ["mayhem-state", "mint"],
      program: MAYHEM_PROGRAM_ID,
    },
    {
      group: "mayhem",
      name: "getSolVaultPda()",
      address: getSolVaultPda(),
      seeds: ["sol-vault"],
      program: MAYHEM_PROGRAM_ID,
    },
    {
      group: "mayhem",
      name: "getTokenVaultPda(mint)",
      address: getTokenVaultPda(mint),
      seeds: ["ATA of the sol vault for mint (Token-2022)"],
      program: MAYHEM_PROGRAM_ID,
    },
    {
      group: "volume",
      name: "GLOBAL_VOLUME_ACCUMULATOR_PDA",
      address: GLOBAL_VOLUME_ACCUMULATOR_PDA,
      seeds: ["global_volume_accumulator"],
      program: PUMP_PROGRAM_ID,
    },
    {
      group: "volume",
      name: "userVolumeAccumulatorPda(user)",
      address: userVolumeAccumulatorPda(user),
      seeds: ["user_volume_accumulator", "user"],
      program: PUMP_PROGRAM_ID,
    },
    {
      group: "volume",
      name: "AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA",
      address: AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
      seeds: ["global_volume_accumulator"],
      program: PUMP_AMM_PROGRAM_ID,
    },
    {
      group: "volume",
      name: "ammUserVolumeAccumulatorPda(user)",
      address: ammUserVolumeAccumulatorPda(user),
      seeds: ["user_volume_accumulator", "user"],
      program: PUMP_AMM_PROGRAM_ID,
    },
  ];
}

/** The entries in one group, in table order. */
export function pdasInGroup(entries: PdaEntry[], group: PdaGroup): PdaEntry[] {
  return entries.filter((entry) => entry.group === group);
}

const GROUP_TITLES: Record<PdaGroup, string> = {
  curve: "Bonding curve (Pump program)",
  amm: "AMM pools (PumpSwap)",
  fees: "Fee program (config, sharing, social)",
  mayhem: "Mayhem mode",
  volume: "Volume accumulators (cashback and incentives)",
};

export async function main(): Promise<void> {
  const inputs = exampleInputs();
  const table = buildPdaTable(inputs);

  heading("Inputs");
  row("Mint", inputs.mint.toBase58());
  row("User", inputs.user.toBase58());
  row("Creator", inputs.creator.toBase58());
  row("Social handle", `${inputs.socialUserId} on platform ${inputs.platform}`);
  console.log("\nFixed, well-known addresses are used so the output is identical on");
  console.log("every run. Swap in your own mint and wallet to derive the accounts a");
  console.log("real trade touches.");

  for (const group of Object.keys(GROUP_TITLES) as PdaGroup[]) {
    heading(GROUP_TITLES[group]);
    for (const entry of pdasInGroup(table, group)) {
      row(entry.name, entry.address.toBase58());
      row("  seeds", entry.seeds.join(" + "));
    }
  }

  heading("Deriving one yourself");
  const scratch = Keypair.generate().publicKey;
  const [manual, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), scratch.toBuffer()],
    PUMP_PROGRAM_ID,
  );
  row("Random mint", scratch.toBase58());
  row("findProgramAddressSync", manual.toBase58());
  row("bondingCurvePda", bondingCurvePda(scratch).toBase58());
  row("Matches", manual.equals(bondingCurvePda(scratch)));
  row("Bump", bump);
  console.log("\nEvery helper here is that call with the seeds filled in. The value");
  console.log("of the helper is that the seed strings are written down once: a typo");
  console.log("in a seed produces a perfectly valid address that no program owns,");
  console.log("and the transaction fails with an account constraint error rather");
  console.log("than anything that names the seed.");

  heading("Event authorities");
  row("Derived under Pump", getEventAuthorityPda(PUMP_PROGRAM_ID).toBase58());
  row("Derived under AMM", getEventAuthorityPda(PUMP_AMM_PROGRAM_ID).toBase58());
  row("Derived under Fees", getEventAuthorityPda(PUMP_FEE_PROGRAM_ID).toBase58());
  console.log("\nSame seed, three different programs, three different addresses.");
  console.log("Anchor requires the matching one on every instruction that emits an");
  console.log("event, which is every trade.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
