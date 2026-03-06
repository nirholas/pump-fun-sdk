/**
 * Integration test: OnlinePumpSdk.buyInstructions() and sellInstructions()
 *
 * Performs a real buy followed by a real sell on mainnet using a funded wallet.
 * A small amount of SOL (configurable) is spent — roughly 0.01 SOL + fees.
 *
 * Usage:
 *   WALLET_SECRET_KEY=<base58-private-key> \
 *   PUMP_TEST_MINT=<mint-with-active-bonding-curve> \
 *     npx ts-node tests/integration/test-online-sdk-buy-sell.ts
 *
 * Env vars:
 *   WALLET_SECRET_KEY  - Base58-encoded private key of a funded mainnet wallet
 *   PUMP_TEST_MINT     - Token mint with an active (non-graduated) bonding curve
 *   SOLANA_RPC_URL     - RPC endpoint (default: mainnet public)
 *   SOL_AMOUNT         - Lamports to spend on the buy (default: 10_000_000 = 0.01 SOL)
 *
 * WARNING: This spends real SOL on mainnet. Use a wallet with only test funds.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import BN from "bn.js";

import {
  OnlinePumpSdk,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from "../../src/index";

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com";
const SOL_AMOUNT = new BN(process.env["SOL_AMOUNT"] ?? "10000000"); // 0.01 SOL default

const SECRET_KEY_RAW = process.env["WALLET_SECRET_KEY"];
if (!SECRET_KEY_RAW) {
  console.error("ERROR: Set WALLET_SECRET_KEY to a base58-encoded private key.");
  process.exit(1);
}

const MINT_RAW = process.env["PUMP_TEST_MINT"];
if (!MINT_RAW) {
  console.error("ERROR: Set PUMP_TEST_MINT to a token with an active bonding curve.");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function sendAndConfirm(
  connection: Connection,
  ixs: import("@solana/web3.js").TransactionInstruction[],
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
  console.log(`  ${label} tx: https://solscan.io/tx/${sig}`);
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  console.log(`  ${label} confirmed ✓`);
  return sig;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const wallet = Keypair.fromSecretKey(bs58.decode(SECRET_KEY_RAW!));
  const mint = new PublicKey(MINT_RAW!);

  console.log(`RPC:    ${RPC_URL}`);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Mint:   ${mint.toBase58()}`);
  console.log(`Buy:    ${SOL_AMOUNT.toNumber() / 1e9} SOL\n`);

  const connection = new Connection(RPC_URL, "confirmed");
  const sdk = new OnlinePumpSdk(connection);

  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / 1e9} SOL`);
  assert(
    balance >= SOL_AMOUNT.toNumber() + 10_000_000, // buy amount + 0.01 SOL for fees/rent
    `Wallet has insufficient SOL. Need at least ${(SOL_AMOUNT.toNumber() + 10_000_000) / 1e9} SOL.`,
  );

  // ── Fetch state ─────────────────────────────────────────────────────
  console.log("\nFetching on-chain state ...");
  const [global, feeConfig, buyState] = await Promise.all([
    sdk.fetchGlobal(),
    sdk.fetchFeeConfig(),
    sdk.fetchBuyState(mint, wallet.publicKey),
  ]);

  assert(!buyState.bondingCurve.complete, "Bonding curve is already complete — choose a different mint.");
  console.log(`  virtual SOL reserves:   ${buyState.bondingCurve.virtualSolReserves.toString()}`);
  console.log(`  virtual token reserves: ${buyState.bondingCurve.virtualTokenReserves.toString()}`);

  // ── BUY ─────────────────────────────────────────────────────────────
  const expectedTokens = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: buyState.bondingCurve.tokenTotalSupply,
    bondingCurve: buyState.bondingCurve,
    amount: SOL_AMOUNT,
  });
  assert(expectedTokens.gtn(0), "getBuyTokenAmountFromSolAmount returned 0 — SOL amount too small?");
  console.log(`\nBuying ${SOL_AMOUNT.toNumber() / 1e9} SOL → ~${expectedTokens.toString()} tokens`);

  const buyIxs = await sdk.buyInstructions({
    ...buyState,
    mint,
    user: wallet.publicKey,
    amount: expectedTokens,
    solAmount: SOL_AMOUNT,
    slippage: 0.05,
  });
  assert(buyIxs.length > 0, "buyInstructions returned empty array");

  await sendAndConfirm(connection, buyIxs, wallet, "BUY");

  // ── SELL ─────────────────────────────────────────────────────────────
  console.log("\nFetching post-buy sell state ...");
  const sellState = await sdk.fetchSellState(mint, wallet.publicKey);

  // Read actual token balance from the ATA
  const { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = await import("@solana/spl-token");
  const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey, true, TOKEN_PROGRAM_ID);
  const ataInfo = await connection.getAccountInfo(ata);
  assert(ataInfo !== null, "ATA does not exist after buy — buy may have failed");

  // SPL token account layout: 32 (mint) + 32 (owner) + 8 (amount)
  const tokenBalance = new BN(ataInfo.data.subarray(64, 72), "le");
  console.log(`  Token balance after buy: ${tokenBalance.toString()}`);
  assert(tokenBalance.gtn(0), "Token balance is 0 after buy");

  const expectedSol = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
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
  assert(sellIxs.length > 0, "sellInstructions returned empty array");

  await sendAndConfirm(connection, sellIxs, wallet, "SELL");

  // ── Summary ──────────────────────────────────────────────────────────
  const finalBalance = await connection.getBalance(wallet.publicKey);
  const spent = balance - finalBalance;
  console.log(`\nFinal wallet balance: ${finalBalance / 1e9} SOL`);
  console.log(`Net SOL spent (buy + sell fees): ${spent / 1e9} SOL`);
  console.log("\n✓ Buy and sell completed successfully.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
