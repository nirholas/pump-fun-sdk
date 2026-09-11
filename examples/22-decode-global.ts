/**
 * Example 22: Decoding the Global Account
 *
 * Category: Accounts & Events
 *
 * One account decides how every Pump token launches: reserves, supply,
 * default fees, migration and mayhem switches, and the fee recipient pools.
 * This example fetches it from mainnet, decodes it with decodeGlobal, and
 * turns the raw fields into the numbers a launch actually cares about.
 *
 * Run: npm run example 22
 */
import {
  GLOBAL_PDA,
  ONE_BILLION_SUPPLY,
  PUMP_SDK,
  bondingCurveMarketCap,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

import type { Global } from "@nirholas/pump-sdk";

import { getConnection } from "./_lib/connection";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

/** Everything Global implies, derived rather than read off a field. */
export interface GlobalReport {
  /** Curve reserves every new token starts with. */
  launchVirtualSolReserves: BN;
  launchVirtualTokenReserves: BN;
  /** Tokens actually purchasable on the curve before it completes. */
  saleableTokens: BN;
  /** Tokens held back for the AMM pool at migration. */
  reservedForMigration: BN;
  /** Market cap in lamports the moment a token launches. */
  launchMarketCap: BN;
  /** Virtual SOL level at which the curve runs dry and graduates. */
  graduationVirtualSol: BN;
  /** SOL a curve raises between launch and graduation. */
  solRaisedAtGraduation: BN;
  /** Market cap in lamports at the graduation edge. */
  graduationMarketCap: BN;
  /** Default protocol and creator rates, used when no fee config exists. */
  flatProtocolFeeBps: BN;
  flatCreatorFeeBps: BN;
  flatTotalFeeBps: BN;
  /** How many addresses each recipient draw can return. */
  standardFeeRecipientCount: number;
  mayhemFeeRecipientCount: number;
  /** Feature switches that gate whole instruction families. */
  createV2Enabled: boolean;
  migrationEnabled: boolean;
  mayhemModeEnabled: boolean;
  /** Lamports skimmed by the program when a curve migrates. */
  poolMigrationFee: BN;
}

/**
 * Interpret a decoded Global account.
 *
 * The stored fields are launch parameters; what a caller usually wants is
 * their consequences. The constant product invariant k = vSol * vTok is
 * fixed at launch, so the graduation point and both market caps follow
 * directly from the initial reserves, with no chain reads and no floats.
 */
export function interpretGlobal(global: Global): GlobalReport {
  const k = global.initialVirtualSolReserves.mul(
    global.initialVirtualTokenReserves,
  );
  const finalVirtualTokenReserves = global.initialVirtualTokenReserves.sub(
    global.initialRealTokenReserves,
  );
  const graduationVirtualSol = finalVirtualTokenReserves.isZero()
    ? new BN(0)
    : k.div(finalVirtualTokenReserves);

  const launchMarketCap = global.initialVirtualTokenReserves.isZero()
    ? new BN(0)
    : bondingCurveMarketCap({
        mintSupply: ONE_BILLION_SUPPLY,
        virtualQuoteReserves: global.initialVirtualSolReserves,
        virtualTokenReserves: global.initialVirtualTokenReserves,
      });

  const graduationMarketCap = finalVirtualTokenReserves.isZero()
    ? new BN(0)
    : bondingCurveMarketCap({
        mintSupply: ONE_BILLION_SUPPLY,
        virtualQuoteReserves: graduationVirtualSol,
        virtualTokenReserves: finalVirtualTokenReserves,
      });

  return {
    launchVirtualSolReserves: global.initialVirtualSolReserves,
    launchVirtualTokenReserves: global.initialVirtualTokenReserves,
    saleableTokens: global.initialRealTokenReserves,
    reservedForMigration: global.tokenTotalSupply.sub(
      global.initialRealTokenReserves,
    ),
    launchMarketCap,
    graduationVirtualSol,
    solRaisedAtGraduation: graduationVirtualSol.sub(
      global.initialVirtualSolReserves,
    ),
    graduationMarketCap,
    flatProtocolFeeBps: global.feeBasisPoints,
    flatCreatorFeeBps: global.creatorFeeBasisPoints,
    flatTotalFeeBps: global.feeBasisPoints.add(global.creatorFeeBasisPoints),
    standardFeeRecipientCount: 1 + global.feeRecipients.length,
    mayhemFeeRecipientCount: 1 + global.reservedFeeRecipients.length,
    createV2Enabled: global.createV2Enabled,
    migrationEnabled: global.enableMigrate,
    mayhemModeEnabled: global.mayhemModeEnabled,
    poolMigrationFee: global.poolMigrationFee,
  };
}

export async function main(): Promise<void> {
  const connection = getConnection();

  heading("Fetching Global");
  row("Address", GLOBAL_PDA.toBase58());
  const accountInfo = await connection.getAccountInfo(GLOBAL_PDA);
  if (!accountInfo) {
    throw new Error(
      `No account at ${GLOBAL_PDA.toBase58()}. Check the RPC endpoint (PUMP_RPC_URL) is mainnet.`,
    );
  }
  row("Owner", accountInfo.owner.toBase58());
  row("Data size", `${accountInfo.data.length} bytes`);

  const global = PUMP_SDK.decodeGlobal(accountInfo);

  heading("Authorities");
  row("Authority", global.authority.toBase58());
  row("Withdraw authority", global.withdrawAuthority.toBase58());
  row("Set creator authority", global.setCreatorAuthority.toBase58());
  row("Admin set creator", global.adminSetCreatorAuthority.toBase58());
  row("Whitelist PDA", global.whitelistPda.toBase58());

  const report = interpretGlobal(global);

  heading("Launch parameters");
  row("Virtual SOL reserves", formatSol(report.launchVirtualSolReserves, 2));
  row("Virtual token reserves", formatTokens(report.launchVirtualTokenReserves, 0));
  row("Saleable on the curve", formatTokens(report.saleableTokens, 0));
  row("Held for the pool", formatTokens(report.reservedForMigration, 0));
  row("Total supply", formatTokens(global.tokenTotalSupply, 0));

  heading("Where a curve ends");
  row("Launch market cap", formatSol(report.launchMarketCap, 2));
  row("Graduation virtual SOL", formatSol(report.graduationVirtualSol, 2));
  row("SOL raised to graduate", formatSol(report.solRaisedAtGraduation, 2));
  row("Graduation market cap", formatSol(report.graduationMarketCap, 2));
  row("Pool migration fee", formatSol(report.poolMigrationFee, 6));
  console.log("\nThese are properties of Global, not of any one token: every coin");
  console.log("launched under this account graduates at the same cap.");

  heading("Default fee rates");
  row("Protocol", `${report.flatProtocolFeeBps.toString()} bps`);
  row("Creator", `${report.flatCreatorFeeBps.toString()} bps`);
  row("All-in", `${report.flatTotalFeeBps.toString()} bps`);
  console.log("\nThese apply only when no fee config account is passed. When one is,");
  console.log("its tiers win; see example 24 for the live tier table.");

  heading("Fee recipient pools");
  row("Standard pool", report.standardFeeRecipientCount);
  row("  primary", global.feeRecipient.toBase58());
  row("Mayhem pool", report.mayhemFeeRecipientCount);
  row("  primary", global.reservedFeeRecipient.toBase58());

  heading("Feature switches");
  row("create_v2 enabled", report.createV2Enabled);
  row("Migration enabled", report.migrationEnabled);
  row("Mayhem mode enabled", report.mayhemModeEnabled);
  console.log("\nA disabled switch is a hard program-level stop, so reading them");
  console.log("first turns an unexplained instruction failure into a known state.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
