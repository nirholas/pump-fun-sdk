/**
 * Integration test: 2026-04-28 breaking fee-recipient upgrade
 *
 * Verifies that every buy/sell instruction built by the SDK carries the new
 * trailing account(s) required by the upgrade. Runs in two modes:
 *
 *   offline  (default) — only asserts account counts and trailing-account
 *                         shape. No RPC / keypair required.
 *
 *   devnet   (optional) — also sends a real buy/sell to devnet using
 *                          `@pump-fun`'s devnet programs, which already accept
 *                          the new accounts. Confirms end-to-end that the
 *                          program is happy with the new layout.
 *
 * Usage:
 *   # Offline (default — CI-safe):
 *   npx ts-node tests/integration/test-breaking-fee-recipient.ts
 *
 *   # Devnet end-to-end:
 *   MODE=devnet \
 *   WALLET_SECRET_KEY=<base58-devnet-key> \
 *   PUMP_TEST_MINT=<active-devnet-bonding-curve-mint> \
 *     npx ts-node tests/integration/test-breaking-fee-recipient.ts
 *
 * Env vars (devnet mode):
 *   WALLET_SECRET_KEY  - Base58-encoded private key of a devnet wallet with SOL
 *   PUMP_TEST_MINT     - Devnet mint with an active (non-graduated) bonding curve
 *   SOLANA_RPC_URL     - RPC endpoint (default: devnet public)
 *   SOL_AMOUNT         - Lamports to spend on the buy (default: 10_000_000 = 0.01 SOL)
 *
 * References:
 *   docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md
 *   https://github.com/pump-fun/pump-public-docs/blob/main/docs/BREAKING_FEE_RECIPIENT.md
 */

import {
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";

import {
  BREAKING_FEE_RECIPIENTS,
  OnlinePumpSdk,
  PUMP_SDK,
  bondingCurveV2Pda,
  buildAmmBreakingFeeRecipientAccounts,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  poolV2Pda,
} from "../../src/index";

// ── Config ────────────────────────────────────────────────────────────────────

const MODE = process.env["MODE"] ?? "offline";
const RPC_URL = process.env["SOLANA_RPC_URL"] ?? "https://api.devnet.solana.com";
const SOL_AMOUNT = new BN(process.env["SOL_AMOUNT"] ?? "10000000");

// ── Helpers ───────────────────────────────────────────────────────────────────

let failures = 0;
function check(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ ${message}`);
    failures++;
  }
}

function last<T>(xs: readonly T[]): T {
  const x = xs[xs.length - 1];
  if (x === undefined) throw new Error("empty array");
  return x;
}

const BREAKING_SET = new Set(BREAKING_FEE_RECIPIENTS.map((k) => k.toBase58()));

// ── Offline assertions ────────────────────────────────────────────────────────
//
// These exercise every instruction builder with synthetic args. AMM builders
// need fetched pool data for account auto-resolution, so we validate the helper
// they all end with instead — the helper is the single source of truth for the
// trailing two accounts.

async function runOfflineChecks() {
  console.log("── Offline account-count checks ──\n");

  const mint = new PublicKey("So11111111111111111111111111111111111111112");
  const user = Keypair.generate().publicKey;
  const creator = Keypair.generate().publicKey;
  const feeRecipient = Keypair.generate().publicKey;

  console.log("BC buy (getBuyInstructionRaw):");
  {
    const ix = await PUMP_SDK.getBuyInstructionRaw({
      user,
      mint,
      creator,
      amount: new BN(1),
      solAmount: new BN(1),
      feeRecipient,
    });
    check(ix.keys.length === 18, `18 accounts total (got ${ix.keys.length})`);
    const tail = last(ix.keys);
    check(BREAKING_SET.has(tail.pubkey.toBase58()), "last key is one of 8 breaking fee recipients");
    check(tail.isWritable, "last key is mutable");
    check(!tail.isSigner, "last key is not a signer");
    check(
      ix.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint)),
      "second-to-last key is bonding-curve-v2",
    );
  }

  console.log("\nBC buyExactSolIn:");
  {
    const ix = await PUMP_SDK.buyExactSolInInstruction({
      user,
      mint,
      creator,
      feeRecipient,
      solAmount: new BN(1),
      minTokenAmount: new BN(1),
    });
    check(ix.keys.length === 18, `18 accounts total (got ${ix.keys.length})`);
    const tail = last(ix.keys);
    check(BREAKING_SET.has(tail.pubkey.toBase58()), "last key is one of 8 breaking fee recipients");
    check(tail.isWritable, "last key is mutable");
    check(
      ix.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint)),
      "second-to-last key is bonding-curve-v2",
    );
  }

  console.log("\nBC sell (non-cashback):");
  {
    const ix = await PUMP_SDK.getSellInstructionRaw({
      user,
      mint,
      creator,
      amount: new BN(1),
      solAmount: new BN(1),
      feeRecipient,
      tokenProgram: TOKEN_PROGRAM_ID,
      cashback: false,
    });
    check(ix.keys.length === 16, `16 accounts total (got ${ix.keys.length})`);
    check(BREAKING_SET.has(last(ix.keys).pubkey.toBase58()), "last key is breaking fee recipient");
    check(last(ix.keys).isWritable, "last key is mutable");
    check(
      ix.keys[14]!.pubkey.equals(bondingCurveV2Pda(mint)),
      "second-to-last key is bonding-curve-v2",
    );
  }

  console.log("\nBC sell (cashback):");
  {
    const ix = await PUMP_SDK.getSellInstructionRaw({
      user,
      mint,
      creator,
      amount: new BN(1),
      solAmount: new BN(1),
      feeRecipient,
      tokenProgram: TOKEN_PROGRAM_ID,
      cashback: true,
    });
    check(ix.keys.length === 17, `17 accounts total (got ${ix.keys.length})`);
    check(BREAKING_SET.has(last(ix.keys).pubkey.toBase58()), "last key is breaking fee recipient");
    check(last(ix.keys).isWritable, "last key is mutable");
    check(
      ix.keys[15]!.pubkey.equals(bondingCurveV2Pda(mint)),
      "second-to-last key is bonding-curve-v2",
    );
  }

  console.log("\nAMM trailing-accounts helper (used by every AMM buy/sell):");
  {
    const [recipient, recipientAta] = buildAmmBreakingFeeRecipientAccounts();
    check(recipient !== undefined && recipientAta !== undefined, "helper returns exactly 2 accounts");
    check(
      BREAKING_SET.has(recipient!.pubkey.toBase58()),
      "first account is one of 8 breaking fee recipients (readonly)",
    );
    check(!recipient!.isWritable, "first account is readonly");
    check(!recipient!.isSigner, "first account is not a signer");
    check(
      recipientAta!.pubkey.equals(
        getAssociatedTokenAddressSync(NATIVE_MINT, recipient!.pubkey, true, TOKEN_PROGRAM_ID),
      ),
      "second account is recipient's WSOL ATA under classic SPL token program",
    );
    check(recipientAta!.isWritable, "second account is mutable");
    check(!recipientAta!.isSigner, "second account is not a signer");
  }

  console.log("\nPool-v2 PDA derivation (pre-upgrade tail in AMM remainingAccounts):");
  {
    const pda = poolV2Pda(mint);
    check(pda instanceof PublicKey, "poolV2Pda returns a PublicKey");
  }
}

// ── Devnet end-to-end ─────────────────────────────────────────────────────────

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
  console.log(`  ${label} tx: https://solscan.io/tx/${sig}?cluster=devnet`);
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  console.log(`  ${label} confirmed ✓`);
  return sig;
}

async function runDevnetE2E() {
  console.log("\n── Devnet end-to-end buy + sell ──\n");

  const secretKey = process.env["WALLET_SECRET_KEY"];
  const mintStr = process.env["PUMP_TEST_MINT"];
  if (!secretKey) throw new Error("WALLET_SECRET_KEY required for MODE=devnet");
  if (!mintStr) throw new Error("PUMP_TEST_MINT required for MODE=devnet");

  const bs58 = (await import("bs58")).default;
  const wallet = Keypair.fromSecretKey(bs58.decode(secretKey));
  const mint = new PublicKey(mintStr);

  console.log(`RPC:    ${RPC_URL}`);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Mint:   ${mint.toBase58()}`);
  console.log(`Buy:    ${SOL_AMOUNT.toNumber() / 1e9} SOL`);

  const connection = new Connection(RPC_URL, "confirmed");
  const sdk = new OnlinePumpSdk(connection);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`\nWallet balance: ${balance / 1e9} SOL`);
  if (balance < SOL_AMOUNT.toNumber() + 10_000_000) {
    throw new Error(
      `Insufficient SOL. Need ≥ ${(SOL_AMOUNT.toNumber() + 10_000_000) / 1e9} SOL. Try the devnet faucet: solana airdrop 1 ${wallet.publicKey.toBase58()} --url devnet`,
    );
  }

  const [global, feeConfig, buyState] = await Promise.all([
    sdk.fetchGlobal(),
    sdk.fetchFeeConfig(),
    sdk.fetchBuyState(mint, wallet.publicKey),
  ]);
  if (buyState.bondingCurve.complete) {
    throw new Error("Bonding curve is already complete — pick a different mint.");
  }

  const expectedTokens = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: buyState.bondingCurve.tokenTotalSupply,
    bondingCurve: buyState.bondingCurve,
    amount: SOL_AMOUNT,
  });

  const buyIxs = await sdk.buyInstructions({
    ...buyState,
    mint,
    user: wallet.publicKey,
    amount: expectedTokens,
    solAmount: SOL_AMOUNT,
    slippage: 0.05,
  });
  // The last ix is the buy itself; earlier ones are ATA creation / extend.
  const buyIx = buyIxs[buyIxs.length - 1]!;
  check(buyIx.keys.length === 18, `buy ix has 18 accounts (got ${buyIx.keys.length})`);
  check(
    BREAKING_SET.has(buyIx.keys[buyIx.keys.length - 1]!.pubkey.toBase58()),
    "buy ix ends with a breaking fee recipient",
  );

  await sendAndConfirm(connection, buyIxs, wallet, "BUY");

  // Read token balance
  const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey, true, buyState.tokenProgram);
  const ataInfo = await connection.getAccountInfo(ata);
  if (!ataInfo) throw new Error("ATA missing after buy");
  const tokenBalance = new BN(ataInfo.data.subarray(64, 72), "le");

  const sellState = await sdk.fetchSellState(mint, wallet.publicKey, buyState.tokenProgram);
  const expectedSol = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: sellState.bondingCurve.tokenTotalSupply,
    bondingCurve: sellState.bondingCurve,
    amount: tokenBalance,
  });

  const sellIxs = await sdk.sellInstructions({
    ...sellState,
    mint,
    user: wallet.publicKey,
    amount: tokenBalance,
    solAmount: expectedSol,
    slippage: 0.05,
  });
  const sellIx = sellIxs[sellIxs.length - 1]!;
  // 16 for non-cashback, 17 for cashback; either way the tail must be a
  // breaking fee recipient and mutable.
  check(
    sellIx.keys.length === 16 || sellIx.keys.length === 17,
    `sell ix has 16 or 17 accounts (got ${sellIx.keys.length})`,
  );
  const sellTail = sellIx.keys[sellIx.keys.length - 1]!;
  check(
    BREAKING_SET.has(sellTail.pubkey.toBase58()),
    "sell ix ends with a breaking fee recipient",
  );
  check(sellTail.isWritable, "sell ix last account is mutable");

  await sendAndConfirm(connection, sellIxs, wallet, "SELL");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await runOfflineChecks();
  if (MODE === "devnet") {
    await runDevnetE2E();
  } else {
    console.log("\n(Set MODE=devnet + WALLET_SECRET_KEY + PUMP_TEST_MINT to also run the end-to-end devnet test.)");
  }

  if (failures > 0) {
    console.error(`\nFAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\n✓ All assertions passed.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
