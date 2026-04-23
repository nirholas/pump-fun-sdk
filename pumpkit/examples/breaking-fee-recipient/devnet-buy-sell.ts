/**
 * devnet-buy-sell.ts
 *
 * End-to-end devnet test for the 2026-04-28 breaking fee-recipient upgrade.
 * Sends a real buy + sell to the devnet programs (which already accept the
 * new trailing accounts) and confirms both transactions.
 *
 * Prerequisites:
 *   - A devnet keypair with SOL (get some: solana airdrop 2 <pubkey> --url devnet)
 *   - An active (non-graduated) devnet bonding curve mint
 *
 * Usage:
 *   WALLET_SECRET_KEY=<base58-private-key> \
 *   PUMP_TEST_MINT=<active-devnet-mint> \
 *     npx ts-node pumpkit/examples/breaking-fee-recipient/devnet-buy-sell.ts
 *
 * Optional env:
 *   SOLANA_RPC_URL   - RPC endpoint (default: https://api.devnet.solana.com)
 *   SOL_AMOUNT       - Lamports to spend on the buy (default: 10_000_000 = 0.01 SOL)
 */

import {
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";

import {
  BREAKING_FEE_RECIPIENTS,
  OnlinePumpSdk,
  bondingCurveV2Pda,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from "../../../src/index";

// ── Config ────────────────────────────────────────────────────────────────────

const RPC = process.env["SOLANA_RPC_URL"] ?? "https://api.devnet.solana.com";
const SOL_AMOUNT = new BN(process.env["SOL_AMOUNT"] ?? "10000000");
const SECRET = process.env["WALLET_SECRET_KEY"];
const MINT_STR = process.env["PUMP_TEST_MINT"];

if (!SECRET) {
  console.error("Set WALLET_SECRET_KEY to a base58-encoded devnet private key.");
  console.error("Create one: solana-keygen new --outfile /tmp/devnet.json && cat /tmp/devnet.json");
  process.exit(1);
}
if (!MINT_STR) {
  console.error("Set PUMP_TEST_MINT to an active (non-graduated) devnet bonding curve mint.");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BREAKING_SET = new Set(BREAKING_FEE_RECIPIENTS.map((k) => k.toBase58()));

function assertAccountCount(ix: TransactionInstruction, expected: number, label: string) {
  if (ix.keys.length !== expected) {
    throw new Error(`${label}: expected ${expected} accounts, got ${ix.keys.length}`);
  }
}

function assertBreakingFeeRecipientTail(ix: TransactionInstruction, label: string) {
  const tail = ix.keys[ix.keys.length - 1]!;
  if (!BREAKING_SET.has(tail.pubkey.toBase58())) {
    throw new Error(`${label}: last account ${tail.pubkey.toBase58()} is not a breaking fee recipient`);
  }
  if (!tail.isWritable) {
    throw new Error(`${label}: last account is not mutable`);
  }
}

async function sendAndConfirm(
  connection: Connection,
  ixs: TransactionInstruction[],
  payer: Keypair,
  label: string,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([payer]);
  const sig = await connection.sendTransaction(tx, { skipPreflight: false });
  const url = `https://solscan.io/tx/${sig}?cluster=devnet`;
  console.log(`  ${label} sent → ${url}`);
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  console.log(`  ${label} confirmed ✓`);
  return sig;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const wallet = Keypair.fromSecretKey(bs58.decode(SECRET!));
  const mint = new PublicKey(MINT_STR!);

  console.log(`RPC:    ${RPC}`);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Mint:   ${mint.toBase58()}`);
  console.log(`Buy:    ${SOL_AMOUNT.toNumber() / 1e9} SOL\n`);

  const connection = new Connection(RPC, "confirmed");
  const sdk = new OnlinePumpSdk(connection);

  // ── Balance check ──────────────────────────────────────────────────────────
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / 1e9} SOL`);
  const needed = SOL_AMOUNT.toNumber() + 15_000_000;
  if (balance < needed) {
    throw new Error(
      `Need ≥ ${needed / 1e9} SOL. Run: solana airdrop 2 ${wallet.publicKey.toBase58()} --url devnet`,
    );
  }

  // ── Fetch state ────────────────────────────────────────────────────────────
  console.log("\nFetching on-chain state ...");
  const [global, feeConfig, buyState] = await Promise.all([
    sdk.fetchGlobal(),
    sdk.fetchFeeConfig(),
    sdk.fetchBuyState(mint, wallet.publicKey),
  ]);

  if (buyState.bondingCurve.complete) {
    throw new Error("Bonding curve is complete — pick a different mint (must not be graduated).");
  }

  // ── Buy ────────────────────────────────────────────────────────────────────
  const expectedTokens = getBuyTokenAmountFromSolAmount({
    global, feeConfig,
    mintSupply: buyState.bondingCurve.tokenTotalSupply,
    bondingCurve: buyState.bondingCurve,
    amount: SOL_AMOUNT,
  });

  if (expectedTokens.isZero()) {
    throw new Error("getBuyTokenAmountFromSolAmount returned 0 — increase SOL_AMOUNT.");
  }

  console.log(`\nBuying ${SOL_AMOUNT.toNumber() / 1e9} SOL → ~${expectedTokens.toString()} tokens`);

  const buyIxs = await sdk.buyInstructions({
    ...buyState,
    mint,
    user: wallet.publicKey,
    amount: expectedTokens,
    solAmount: SOL_AMOUNT,
    slippage: 0.05,
  });

  // Validate buy instruction shape
  const buyIx = buyIxs[buyIxs.length - 1]!;
  assertAccountCount(buyIx, 18, "BC buy");
  assertBreakingFeeRecipientTail(buyIx, "BC buy");
  console.log("  ✓ buy ix: 18 accounts, breaking fee recipient at tail");
  console.log("  ✓ buy ix: bonding-curve-v2 at index 16:", buyIx.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint)));

  await sendAndConfirm(connection, buyIxs, wallet, "BUY");

  // ── Read post-buy balance ──────────────────────────────────────────────────
  const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey, true, buyState.tokenProgram);
  const ataInfo = await connection.getAccountInfo(ata);
  if (!ataInfo) throw new Error("ATA missing after buy — buy may have failed silently.");
  const tokenBalance = new BN(ataInfo.data.subarray(64, 72), "le");
  console.log(`\nToken balance after buy: ${tokenBalance.toString()}`);

  // ── Sell ───────────────────────────────────────────────────────────────────
  const sellState = await sdk.fetchSellState(mint, wallet.publicKey, buyState.tokenProgram);
  const expectedSol = getSellSolAmountFromTokenAmount({
    global, feeConfig,
    mintSupply: sellState.bondingCurve.tokenTotalSupply,
    bondingCurve: sellState.bondingCurve,
    amount: tokenBalance,
  });

  console.log(`\nSelling ${tokenBalance.toString()} tokens → ~${expectedSol.toNumber() / 1e9} SOL`);

  const sellIxs = await sdk.sellInstructions({
    ...sellState,
    mint,
    user: wallet.publicKey,
    amount: tokenBalance,
    solAmount: expectedSol,
    slippage: 0.05,
  });

  // Validate sell instruction shape
  const sellIx = sellIxs[sellIxs.length - 1]!;
  const expectedSellCount = 16; // non-cashback path (cashback=false is the default)
  assertAccountCount(sellIx, expectedSellCount, "BC sell");
  assertBreakingFeeRecipientTail(sellIx, "BC sell");
  console.log(`  ✓ sell ix: ${expectedSellCount} accounts, breaking fee recipient at tail`);

  await sendAndConfirm(connection, sellIxs, wallet, "SELL");

  // ── Summary ────────────────────────────────────────────────────────────────
  const finalBalance = await connection.getBalance(wallet.publicKey);
  console.log(`\nFinal wallet balance: ${finalBalance / 1e9} SOL`);
  console.log(`Net SOL cost (fees only): ${(balance - finalBalance) / 1e9} SOL`);
  console.log("\n✓ Devnet buy + sell completed. Your SDK is ready for the 2026-04-28 cutover.");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message ?? err);
  process.exit(1);
});
