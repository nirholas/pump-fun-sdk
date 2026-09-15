/**
 * Example 01: Create a Token
 *
 * Category: Token Lifecycle
 *
 * Builds the createV2 instruction that launches a new token on the Pump
 * bonding curve, then inspects what the instruction contains. This is the
 * first on-chain action of every token's life, and it costs nothing to
 * build: no network, no wallet, no funds.
 *
 * Run: npm run example 01
 */
import {
  PUMP_SDK,
  PUMP_PROGRAM_ID,
  bondingCurvePda,
  creatorVaultPda,
} from "@nirholas/pump-sdk";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";

import { heading, row } from "./_lib/format";
import { loadWallet } from "./_lib/wallet";

export interface TokenLaunchParams {
  name: string;
  symbol: string;
  /** Off-chain metadata JSON (image, description). */
  uri: string;
  mint: PublicKey;
  creator: PublicKey;
  /** Wallet paying rent and fees; usually the creator. */
  user: PublicKey;
  /** Opt the token into mayhem mode at launch. */
  mayhemMode?: boolean;
  /** @deprecated New cashback launches are rejected by the Pump program. */
  cashback?: boolean;
  /** Route creator fees to holders through Pump.fun-managed distributions. */
  holderReward?: boolean;
}

/**
 * Build the createV2 instruction for a new Pump token.
 *
 * The mint must be a fresh keypair that also signs the transaction.
 * createV2 targets Token-2022 and replaces the deprecated v1 create.
 */
export async function buildCreateTokenInstruction(
  params: TokenLaunchParams,
): Promise<TransactionInstruction> {
  return await PUMP_SDK.createV2Instruction({
    mint: params.mint,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri,
    creator: params.creator,
    user: params.user,
    mayhemMode: params.mayhemMode ?? false,
    cashback: params.cashback ?? false,
    holderReward: params.holderReward ?? false,
  });
}

export async function main(): Promise<void> {
  const wallet = loadWallet();
  const mint = Keypair.generate();

  heading("Launch parameters");
  row("Name", "Example Coin");
  row("Symbol", "XMPL");
  row("Mint (new keypair)", mint.publicKey.toBase58());
  row("Creator / payer", wallet.publicKey.toBase58());

  const ix = await buildCreateTokenInstruction({
    name: "Example Coin",
    symbol: "XMPL",
    uri: "https://example.com/metadata.json",
    mint: mint.publicKey,
    creator: wallet.publicKey,
    user: wallet.publicKey,
  });

  heading("createV2 instruction");
  row("Program", ix.programId.toBase58());
  row("Is Pump program", ix.programId.equals(PUMP_PROGRAM_ID));
  row("Accounts", ix.keys.length);
  row("Data bytes", ix.data.length);

  heading("Derived accounts this launch will create");
  row("Bonding curve PDA", bondingCurvePda(mint.publicKey).toBase58());
  row("Creator vault PDA", creatorVaultPda(wallet.publicKey).toBase58());

  heading("Next step (not performed here)");
  console.log(
    "Add this instruction to a Transaction, sign with BOTH the wallet and",
  );
  console.log(
    "the mint keypair, then send it. Example 02 shows create-and-buy in one.",
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
