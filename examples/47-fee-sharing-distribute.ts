/**
 * Example 47: Fee Sharing, Paying It Out
 *
 * Category: AMM & Advanced
 *
 * Finds a live token that already uses a fee sharing config, simulates
 * getMinimumDistributableFee to learn whether its vault has cleared the
 * payout floor, and builds the distribute instructions. Works out each
 * shareholder's cut in BN, including the dust that integer division leaves
 * behind.
 *
 * Run: npm run example 47
 */
import {
  OnlinePumpSdk,
  PUMP_SDK,
  getPumpProgram,
  bondingCurvePda,
  creatorVaultPda,
  feeSharingConfigPda,
  isSharingConfigEditable,
  type DistributeCreatorFeesEvent,
  type MinimumDistributableFeeEvent,
  type SharingConfig,
  type Shareholder,
} from "@nirholas/pump-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { collectStreamMints } from "./_lib/discovery";
import { formatSol, heading, row } from "./_lib/format";

/**
 * The Pump program's own Anchor coder. Constructing a Program performs no
 * I/O, so the encode calls below run offline.
 */
const pumpCoder = getPumpProgram(getConnection()).coder;

/** How a distributable balance divides across a split. */
export interface PayoutSplit {
  /** One payout per shareholder, in the order the config stores them. */
  payouts: BN[];
  /** Lamports left in the vault because bps did not divide evenly. */
  remainder: BN;
}

/**
 * Divide a distributable balance across shareholders.
 *
 * Each share is `distributed * shareBps / 10_000`, floored: the program can
 * only move lamports it holds, so it never rounds a payout up. What the
 * flooring leaves over stays in the creator vault and rolls into the next
 * distribution, which is why a vault is rarely at exactly zero afterwards.
 */
export function payoutSplit(
  distributed: BN,
  shareholders: Shareholder[],
): PayoutSplit {
  const payouts = shareholders.map((shareholder) =>
    distributed.muln(shareholder.shareBps).divn(10_000),
  );
  const paid = payouts.reduce((total, amount) => total.add(amount), new BN(0));
  return { payouts, remainder: distributed.sub(paid) };
}

/** Encode a DistributeCreatorFeesEvent with the Pump program's IDL coder. */
export function encodeDistributeCreatorFeesEvent(
  event: DistributeCreatorFeesEvent,
): Buffer {
  return pumpCoder.types.encode("distributeCreatorFeesEvent", event);
}

/** Encode a MinimumDistributableFeeEvent with the Pump program's IDL coder. */
export function encodeMinimumDistributableFeeEvent(
  event: MinimumDistributableFeeEvent,
): Buffer {
  return pumpCoder.types.encode("minimumDistributableFeeEvent", event);
}

/** A live token whose creator fees are already split across shareholders. */
export interface SharedFeeToken {
  mint: PublicKey;
  config: PublicKey;
  sharingConfig: SharingConfig;
}

/**
 * Scan the live Pump log stream for a token that has a sharing config.
 *
 * Most coins pay creator fees straight to a wallet, so this samples a batch
 * of freshly traded mints and keeps the first one whose config PDA exists.
 * Set MINT=<address> to skip the search and use a token you already know.
 */
export async function findSharedFeeToken(
  connection: Connection,
  rounds = 4,
  perRound = 16,
): Promise<SharedFeeToken> {
  const override = process.env.MINT;
  let sampled = 0;

  for (let round = 0; round < rounds; round += 1) {
    const candidates = override
      ? [new PublicKey(override)]
      : (
          await collectStreamMints(connection, ["trade", "create"], perRound)
        ).map((streamed) => streamed.mint);
    sampled += candidates.length;

    const configs = candidates.map((mint) => feeSharingConfigPda(mint));
    const infos = await connection.getMultipleAccountsInfo(configs);
    for (let i = 0; i < candidates.length; i += 1) {
      const info = infos[i];
      const mint = candidates[i];
      const config = configs[i];
      if (!info || !mint || !config) continue;
      return { mint, config, sharingConfig: PUMP_SDK.decodeSharingConfig(info) };
    }
    if (override) break;
  }

  throw new Error(
    `None of the ${sampled} sampled mints use a fee sharing config. ` +
      "Retry, or pass MINT=<address> for a token you know splits its fees.",
  );
}

export async function main(): Promise<void> {
  const connection = getConnection();
  const sdk = new OnlinePumpSdk(connection);

  heading("Finding a token that splits its creator fees");
  const { mint, config, sharingConfig } = await findSharedFeeToken(connection);
  row("Mint", mint.toBase58());
  row("Sharing config PDA", config.toBase58());
  row("Config version", sharingConfig.version);
  row("Admin", sharingConfig.admin.toBase58());
  row("Admin revoked", sharingConfig.adminRevoked);
  row("Split editable", isSharingConfigEditable({ sharingConfig }));
  row("Shareholders", sharingConfig.shareholders.length);
  for (const shareholder of sharingConfig.shareholders) {
    row(`  ${shareholder.address.toBase58()}`, `${shareholder.shareBps} bps`);
  }

  heading("The vault the split pays out of");
  const vault = creatorVaultPda(config);
  row("Creator vault PDA", vault.toBase58());
  row("Vault balance", formatSol(await sdk.getCreatorVaultBalance(config), 6));
  console.log(
    "\nThe vault is derived from the config PDA, not from a wallet: that is",
  );
  console.log("what makes the fees shared rather than the creator's.");

  heading("Is it above the floor? getMinimumDistributableFee");
  const minimum = await sdk.getMinimumDistributableFee(mint);
  row("Distributable fees", formatSol(minimum.distributableFees, 6));
  row("Minimum required", formatSol(minimum.minimumRequired, 6));
  row("Can distribute", minimum.canDistribute);
  row("Graduated", minimum.isGraduated);
  console.log(
    "\nThis runs as a transaction simulation and reads the return data, so it",
  );
  console.log(
    "costs nothing and needs no signer. The floor exists because paying ten",
  );
  console.log("shareholders a few lamports each is worth less than the fee.");

  heading("Who gets what");
  const split = payoutSplit(
    minimum.distributableFees,
    sharingConfig.shareholders,
  );
  for (const [i, shareholder] of sharingConfig.shareholders.entries()) {
    row(
      `  ${shareholder.address.toBase58().slice(0, 20)} (${shareholder.shareBps} bps)`,
      formatSol(split.payouts[i] ?? new BN(0), 9),
    );
  }
  row("Dust left in vault", formatSol(split.remainder, 9));

  heading("Instructions: buildDistributeCreatorFeesInstructions (not sent)");
  const distribute = await sdk.buildDistributeCreatorFeesInstructions(mint);
  row("Instruction count", distribute.instructions.length);
  row("Graduated", distribute.isGraduated);
  for (const [i, ix] of distribute.instructions.entries()) {
    row(
      `  ix[${i}]`,
      `${ix.programId.toBase58()} keys=${ix.keys.length} data=${ix.data.length}B`,
    );
  }
  console.log(
    "\nFor a graduated token the list leads with a transfer that sweeps AMM",
  );
  console.log(
    "creator fees back to the Pump program, because the split is paid from",
  );
  console.log("one vault and the fees arrive in two.");

  heading("Changing the split: updateFeeShares (not sent)");
  const currentShareholders = sharingConfig.shareholders.map((s) => s.address);
  const updateIx = await PUMP_SDK.updateFeeShares({
    authority: sharingConfig.admin,
    mint,
    currentShareholders,
    newShareholders: sharingConfig.shareholders,
  });
  row("Accounts", updateIx.keys.length);
  row("Remaining accounts", currentShareholders.length);
  row("Data bytes", updateIx.data.length);
  console.log(
    "\nRebuilding the current split is a no-op on purpose: it shows the shape",
  );
  console.log(
    "of the call without proposing a change to somebody else's token. Only",
  );
  console.log("the admin can sign it, and only while the split stays editable.");

  heading("Decoding the events the payout emits");
  const distributed = new BN(2_500_000);
  const feesEvent = PUMP_SDK.decodeDistributeCreatorFeesEvent(
    encodeDistributeCreatorFeesEvent({
      timestamp: new BN(Math.floor(Date.now() / 1000)),
      mint,
      sharingConfig: config,
      admin: sharingConfig.admin,
      shareholders: sharingConfig.shareholders,
      distributed,
      bondingCurve: bondingCurvePda(mint),
      // The zero key is how the program records a SOL-quoted curve.
      quoteMint: PublicKey.default,
    }),
  );
  const holderCount = feesEvent.shareholders.length;
  row(
    "distributeCreatorFeesEvent",
    `${holderCount} shareholder${holderCount === 1 ? "" : "s"}`,
  );
  row("  distributed", formatSol(feesEvent.distributed, 6));
  const floorEvent = PUMP_SDK.decodeMinimumDistributableFee(
    encodeMinimumDistributableFeeEvent({
      minimumRequired: minimum.minimumRequired,
      distributableFees: minimum.distributableFees,
      canDistribute: minimum.canDistribute,
    }),
  );
  row("minimumDistributableFeeEvent", `canDistribute=${floorEvent.canDistribute}`);
  row("  minimum required", formatSol(floorEvent.minimumRequired, 6));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
