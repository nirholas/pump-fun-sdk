/**
 * Integration test: grind a vanity mint and create a Pump token with it.
 *
 * End-to-end flow:
 *   1. Grind a keypair whose public key ends in `pump` (or a shorter suffix
 *      for quicker testing).
 *   2. Build a `createV2Instruction` with the grinded mint.
 *   3. Sign with both the payer wallet and the mint keypair and submit.
 *   4. Fetch the bonding curve to confirm the token exists on-chain.
 *
 * Usage:
 *   WALLET_SECRET_KEY=<base58-private-key> \
 *     npx ts-node tests/integration/test-vanity-mint-create.ts
 *
 * Env vars:
 *   WALLET_SECRET_KEY    Base58-encoded funded devnet wallet. Required.
 *   SOLANA_RPC_URL       RPC endpoint. Defaults to devnet public RPC.
 *   VANITY_SUFFIX        Suffix to grind for. Defaults to "pump". Set to a
 *                        shorter value (e.g. "p" or "pu") when iterating —
 *                        4 chars can take several minutes in Node.
 *   TOKEN_NAME           Token name. Defaults to "Vanity Test".
 *   TOKEN_SYMBOL         Token symbol. Defaults to "VTEST".
 *   TOKEN_URI            Metaplex metadata URI. Defaults to a placeholder.
 *
 * WARNING: Spends real SOL. Use devnet for testing. Roughly 0.02 SOL covers
 * account rent and fees.
 */

import {
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

import {
  OnlinePumpSdk,
  PUMP_SDK,
  estimateVanityMintAttempts,
  generateVanityMint,
} from "../../src/index";

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env["SOLANA_RPC_URL"] ?? "https://api.devnet.solana.com";
const VANITY_SUFFIX = process.env["VANITY_SUFFIX"] ?? "pump";
const TOKEN_NAME = process.env["TOKEN_NAME"] ?? "Vanity Test";
const TOKEN_SYMBOL = process.env["TOKEN_SYMBOL"] ?? "VTEST";
const TOKEN_URI =
  process.env["TOKEN_URI"] ?? "https://example.com/metadata.json";

const SECRET_KEY_RAW = process.env["WALLET_SECRET_KEY"];
if (!SECRET_KEY_RAW) {
  console.error("ERROR: Set WALLET_SECRET_KEY to a base58-encoded private key.");
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const wallet = Keypair.fromSecretKey(bs58.decode(SECRET_KEY_RAW!));

  console.log(`RPC:    ${RPC_URL}`);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Suffix: "${VANITY_SUFFIX}"\n`);

  const connection = new Connection(RPC_URL, "confirmed");

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / 1e9} SOL`);
  if (balance < 20_000_000) {
    console.error("ERROR: Wallet needs at least ~0.02 SOL for rent and fees.");
    process.exit(1);
  }

  // ── Step 1: grind the vanity mint ─────────────────────────────────────
  const expected = estimateVanityMintAttempts({ suffix: VANITY_SUFFIX });
  console.log(
    `\nGrinding mint ending in "${VANITY_SUFFIX}" (~${expected.toLocaleString()} expected attempts) ...`,
  );

  const vanity = await generateVanityMint({
    suffix: VANITY_SUFFIX,
    onProgress: ({ attempts, attemptsPerSecond }) => {
      process.stdout.write(
        `\r  ${attempts.toLocaleString()} attempts | ${attemptsPerSecond.toFixed(0)}/sec   `,
      );
    },
  });
  process.stdout.write("\r" + " ".repeat(60) + "\r");

  console.log(`✓ Found mint: ${vanity.keypair.publicKey.toBase58()}`);
  console.log(
    `  attempts: ${vanity.attempts.toLocaleString()} | duration: ${(vanity.durationMs / 1000).toFixed(2)}s`,
  );

  // ── Step 2: build the createV2 instruction ────────────────────────────
  const createIx = await PUMP_SDK.createV2Instruction({
    mint: vanity.keypair.publicKey,
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    uri: TOKEN_URI,
    creator: wallet.publicKey,
    user: wallet.publicKey,
    mayhemMode: false,
    cashback: false,
  });

  // ── Step 3: sign with both payer and mint, and submit ─────────────────
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([wallet, vanity.keypair]);

  const sig = await connection.sendTransaction(tx, { skipPreflight: false });
  console.log(`\nCREATE tx: https://solscan.io/tx/${sig}?cluster=devnet`);
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  console.log("CREATE confirmed ✓");

  // ── Step 4: verify on-chain state ─────────────────────────────────────
  const online = new OnlinePumpSdk(connection);
  const bondingCurve = await online.fetchBondingCurve(vanity.keypair.publicKey);
  console.log(
    `\nBonding curve creator: ${bondingCurve.creator.toBase58()}`,
  );
  console.log(
    `Bonding curve complete: ${bondingCurve.complete} (false = trading active)`,
  );

  if (!vanity.keypair.publicKey.toBase58().endsWith(VANITY_SUFFIX)) {
    throw new Error(
      `Mint address ${vanity.keypair.publicKey.toBase58()} does not end in "${VANITY_SUFFIX}"`,
    );
  }
  if (!bondingCurve.creator.equals(wallet.publicKey)) {
    throw new Error(
      "On-chain creator does not match wallet — token creation may not have succeeded",
    );
  }

  console.log("\n✓ Vanity mint token creation succeeded end-to-end.");
}

main().catch((err) => {
  console.error("\nIntegration test failed:", err);
  process.exit(1);
});
