/**
 * Example 51: Holder-Reward Launch
 *
 * Builds a Pump SDK 2.0 holder-reward launch entirely offline, proves the
 * protocol-derived holder PDA is used for the first buy's creator vault, and
 * prints the accounts an app can show before asking a wallet to sign.
 *
 * Run: npm run example 51
 */
import {
  PUMP_SDK,
  creatorVaultPda,
  holderRewardsPda,
} from "@nirholas/pump-sdk";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import BN from "bn.js";

import { heading, row } from "./_lib/format";
import { mainnetGlobal } from "./_lib/curveState";

/** Build a deterministic, broadcast-free holder-reward launch demonstration. */
export async function buildHolderRewardLaunch() {
  const mint = Keypair.generate().publicKey;
  const user = Keypair.generate().publicKey;
  const global = mainnetGlobal({ isHolderRewardEnabled: true });

  const holderRewards = holderRewardsPda(mint);
  const creatorVault = creatorVaultPda(holderRewards);
  const instructions = await PUMP_SDK.createV2AndBuyInstructions({
    global,
    mint,
    name: "Holder Helper",
    symbol: "HOLD",
    uri: "https://example.com/holder-helper.json",
    creator: user,
    user,
    amount: new BN(1_000_000),
    solAmount: new BN(100_000),
    mayhemMode: false,
    holderReward: true,
  });

  return { mint, user, holderRewards, creatorVault, instructions };
}

export async function main(): Promise<void> {
  const launch = await buildHolderRewardLaunch();
  heading("Holder-reward launch (offline)");
  row("Mint", launch.mint.toBase58());
  row("Holder rewards PDA", launch.holderRewards.toBase58());
  row("Holder creator vault", launch.creatorVault.toBase58());
  row("Instructions", launch.instructions.length);
  row(
    "Token-2022 used",
    launch.instructions.some((ix) =>
      ix.keys.some((key) => key.pubkey.equals(TOKEN_2022_PROGRAM_ID)),
    ),
  );
  console.log("\nNothing was signed or broadcast.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
