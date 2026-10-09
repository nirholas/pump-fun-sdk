/**
 * Example 02: Create and Buy in One Transaction
 *
 * Category: Token Lifecycle
 *
 * Builds the three-instruction bundle that launches a token AND makes the
 * creator's first buy atomically: createV2, create the buyer's token
 * account, then buy. The dev-buy quote is pure
 * math on a brand-new curve, so you know your token allocation before
 * spending anything.
 *
 * Run: npm run example 02
 */
import {
  PUMP_SDK,
  PUMP_PROGRAM_ID,
  getBuyTokenAmountFromSolAmount,
  newBondingCurve,
  OnlinePumpSdk,
  type FeeConfig,
  type Global,
} from "@nirholas/pump-sdk";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { formatSol, formatTokens, heading, row } from "./_lib/format";
import { loadWallet } from "./_lib/wallet";

/**
 * Quote the creator's dev buy against a brand-new bonding curve.
 *
 * `newBondingCurve(global)` produces the exact reserve state every token
 * starts with, so this is the same quote the on-chain program will honor
 * in the create-and-buy transaction. The creator is set on the simulated
 * curve because the creator fee applies to the dev buy.
 */
export function quoteDevBuy({
  global,
  feeConfig,
  creator,
  solAmount,
  mayhemMode = false,
  cashback = false,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  creator: PublicKey;
  solAmount: BN;
  mayhemMode?: boolean;
  cashback?: boolean;
}): BN {
  const bondingCurve = {
    ...newBondingCurve(global),
    creator,
    isMayhemMode: mayhemMode,
    isCashbackCoin: cashback,
  };
  return getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: global.tokenTotalSupply,
    bondingCurve,
    amount: solAmount,
  });
}

/**
 * Build the full create-and-buy instruction list.
 *
 * Wraps `PUMP_SDK.createV2AndBuyInstructions`, which returns exactly:
 * [createV2, createAssociatedTokenAccountIdempotent, buy]. createV2 already
 * allocates the curve at its full size, so no extendAccount is needed.
 * `devBuyTokens` is the token amount the buy expects (from `quoteDevBuy`).
 */
export async function buildCreateAndBuyInstructions({
  global,
  mint,
  name,
  symbol,
  uri,
  creator,
  user,
  solAmount,
  devBuyTokens,
  mayhemMode = false,
  cashback = false,
}: {
  global: Global;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  creator: PublicKey;
  user: PublicKey;
  solAmount: BN;
  devBuyTokens: BN;
  mayhemMode?: boolean;
  cashback?: boolean;
}): Promise<TransactionInstruction[]> {
  return await PUMP_SDK.createV2AndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount: devBuyTokens,
    solAmount,
    mayhemMode,
    cashback,
  });
}

export async function main(): Promise<void> {
  const online = new OnlinePumpSdk(getConnection());
  const wallet = loadWallet();
  const mint = Keypair.generate();
  const devBuySol = new BN(500_000_000); // 0.5 SOL

  heading("Launch parameters");
  row("Name", "Example Coin");
  row("Symbol", "XMPL");
  row("Mint (new keypair)", mint.publicKey.toBase58());
  row("Creator / buyer", wallet.publicKey.toBase58());
  row("Dev buy", formatSol(devBuySol));

  const [global, feeConfig] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
  ]);

  heading("Dev-buy quote (offline math, live global state)");
  const devBuyTokens = quoteDevBuy({
    global,
    feeConfig,
    creator: wallet.publicKey,
    solAmount: devBuySol,
  });
  row("Initial virtual SOL", formatSol(global.initialVirtualSolReserves));
  row("Initial virtual tokens", formatTokens(global.initialVirtualTokenReserves));
  row("Tokens received", formatTokens(devBuyTokens));

  const ixs = await buildCreateAndBuyInstructions({
    global,
    mint: mint.publicKey,
    name: "Example Coin",
    symbol: "XMPL",
    uri: "https://example.com/metadata.json",
    creator: wallet.publicKey,
    user: wallet.publicKey,
    solAmount: devBuySol,
    devBuyTokens,
  });

  heading("Instruction bundle");
  const labels = [
    "createV2 (launch the token)",
    "createAssociatedTokenAccount (buyer ATA)",
    "buy (the dev buy)",
  ];
  ixs.forEach((ix, i) => {
    row(`${i + 1}. ${labels[i] ?? "instruction"}`, "");
    row("   Program", ix.programId.toBase58());
    row("   Accounts / data bytes", `${ix.keys.length} / ${ix.data.length}`);
  });
  row("Pump program instructions", ixs.filter((ix) => ix.programId.equals(PUMP_PROGRAM_ID)).length);

  heading("Next step (not performed here)");
  console.log(
    "Put all three instructions in ONE transaction, sign with the wallet AND",
  );
  console.log(
    "the mint keypair, then send. Atomicity means nobody can buy before you.",
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
