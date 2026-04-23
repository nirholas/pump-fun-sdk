/**
 * patch-legacy.ts
 *
 * Demonstrates the migration utilities introduced alongside the 2026-04-28
 * breaking fee-recipient upgrade:
 *
 *   isBreakingFeeRecipient  — predicate: is this pubkey one of the 8?
 *   validateBcInstruction   — structured validator for BC buy/sell instructions
 *   validateAmmInstruction  — structured validator for AMM buy/sell instructions
 *   patchBcInstruction      — append the trailing account to a legacy BC ix
 *   patchAmmInstruction     — append the two trailing accounts to a legacy AMM ix
 *
 * No RPC or keypair required — all checks are offline.
 *
 * Usage:
 *   npx ts-node pumpkit/examples/breaking-fee-recipient/patch-legacy.ts
 */

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import {
  BREAKING_FEE_RECIPIENTS,
  BREAKING_FEE_RECIPIENT_WSOL_ATAS,
  PUMP_SDK,
  bondingCurveV2Pda,
  buildAmmBreakingFeeRecipientAccounts,
  isBreakingFeeRecipient,
  patchAmmInstruction,
  patchBcInstruction,
  poolV2Pda,
  validateAmmInstruction,
  validateBcInstruction,
} from "../../../src/index";

// ── Setup ─────────────────────────────────────────────────────────────────────

const mint = new PublicKey("So11111111111111111111111111111111111111112");
const user = new PublicKey("11111111111111111111111111111111");
const creator = new PublicKey("22222222222222222222222222222222222222222222");
const feeRecipient = new PublicKey("33333333333333333333333333333333333333333333");

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fake = () => ({ pubkey: Keypair.generate().publicKey, isWritable: false, isSigner: false });

/** Simulate a pre-upgrade BC buy instruction (17 accounts, no trailing recipient). */
function makeLegacyBcBuyIx(): TransactionInstruction {
  return new TransactionInstruction({
    keys: Array.from({ length: 17 }, () => fake()),
    programId: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
    data: Buffer.alloc(8),
  });
}

/** Simulate a pre-upgrade AMM buy instruction (24 accounts, no trailing pair). */
function makeLegacyAmmBuyIx(): TransactionInstruction {
  return new TransactionInstruction({
    keys: Array.from({ length: 24 }, () => fake()),
    programId: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
    data: Buffer.alloc(8),
  });
}

// ── isBreakingFeeRecipient ─────────────────────────────────────────────────────

async function demonstrateIsBreakingFeeRecipient() {
  section("1. isBreakingFeeRecipient — on-chain transaction parsing");

  // Imagine you're parsing a confirmed transaction and want to detect if one of
  // the accounts is a breaking fee recipient (e.g. for analytics or fee tracking).
  const parsed = {
    accounts: [
      user,
      mint,
      BREAKING_FEE_RECIPIENTS[3]!, // one of the 8 — would appear in real txs
      creator,
    ],
  };

  const detected = parsed.accounts.filter(isBreakingFeeRecipient);
  ok(`Detected ${detected.length} breaking fee recipient(s) in parsed tx`, detected.length === 1);
  ok(
    `Detected recipient is the expected one`,
    detected[0]!.equals(BREAKING_FEE_RECIPIENTS[3]!),
  );

  // Non-recipients return false
  ok("user is not a breaking fee recipient", !isBreakingFeeRecipient(user));
  ok("mint is not a breaking fee recipient", !isBreakingFeeRecipient(mint));
}

// ── BREAKING_FEE_RECIPIENT_WSOL_ATAS ──────────────────────────────────────────

async function demonstrateWsolAtaMap() {
  section("2. BREAKING_FEE_RECIPIENT_WSOL_ATAS — hot-path AMM performance");

  // In a trading bot calling ammBuyInstruction thousands of times, you avoid
  // re-deriving the WSOL ATA on each call by reading the pre-computed map.
  ok("Map has 8 entries (one per recipient)", BREAKING_FEE_RECIPIENT_WSOL_ATAS.size === 8);

  for (const r of BREAKING_FEE_RECIPIENTS) {
    const ata = BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(r.toBase58());
    ok(`ATA exists for ${r.toBase58().slice(0, 8)}...`, ata !== undefined);
  }

  // Usage pattern in a hot path:
  const recipient = BREAKING_FEE_RECIPIENTS[0]!;
  const wsolAta = BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(recipient.toBase58())!;
  ok("Direct map lookup returns a PublicKey-like object", typeof wsolAta?.toBase58() === "string");
}

// ── validateBcInstruction ──────────────────────────────────────────────────────

async function demonstrateValidateBcInstruction() {
  section("3. validateBcInstruction — CI validation for BC buy/sell");

  // A. Valid post-upgrade instruction from the SDK
  const validBuyIx = await PUMP_SDK.getBuyInstructionRaw({
    user, mint, creator, feeRecipient,
    amount: new BN(1_000_000), solAmount: new BN(10_000_000),
  });
  const buyResult = validateBcInstruction(validBuyIx, "buy");
  ok("Valid SDK BC buy passes", buyResult.valid);
  ok("No errors reported", buyResult.errors.length === 0);

  // B. Legacy instruction (missing trailing account) — fails validation
  const legacyBuyIx = makeLegacyBcBuyIx();
  const legacyResult = validateBcInstruction(legacyBuyIx, "buy");
  ok("Legacy BC buy (17 accounts) fails validation", !legacyResult.valid);
  ok(
    `Error mentions account count (got: "${legacyResult.errors[0]?.slice(0, 40)}...")`,
    legacyResult.errors.some((e) => e.includes("expected 18")),
  );

  // C. Validate sell shapes
  const sellIx = await PUMP_SDK.getSellInstructionRaw({
    user, mint, creator, feeRecipient,
    amount: new BN(1_000_000), solAmount: new BN(0),
    tokenProgram: TOKEN_PROGRAM_ID, cashback: false,
  });
  ok("Valid SDK BC sell (non-cashback) passes", validateBcInstruction(sellIx, "sell").valid);

  const sellCbIx = await PUMP_SDK.getSellInstructionRaw({
    user, mint, creator, feeRecipient,
    amount: new BN(1_000_000), solAmount: new BN(0),
    tokenProgram: TOKEN_PROGRAM_ID, cashback: true,
  });
  ok("Valid SDK BC sell (cashback) passes", validateBcInstruction(sellCbIx, "sell-cashback").valid);
}

// ── validateAmmInstruction ─────────────────────────────────────────────────────

async function demonstrateValidateAmmInstruction() {
  section("4. validateAmmInstruction — CI validation for AMM buy/sell");

  // Build a correctly shaped AMM buy instruction using the helper
  const [recipient, ata] = buildAmmBreakingFeeRecipientAccounts();
  const poolV2 = poolV2Pda(mint);
  const baseFakeAccounts = Array.from({ length: 23 }, () => fake());
  const ammBuyIx = new TransactionInstruction({
    keys: [
      ...baseFakeAccounts,
      { pubkey: poolV2, isWritable: false, isSigner: false },
      recipient!,
      ata!,
    ],
    programId: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
    data: Buffer.alloc(8),
  });

  const ammResult = validateAmmInstruction(ammBuyIx, "buy");
  ok("Correctly shaped AMM buy (26 accounts) passes", ammResult.valid);
  ok("No errors reported", ammResult.errors.length === 0);

  // A legacy AMM instruction (missing both trailing accounts)
  const legacyAmmIx = makeLegacyAmmBuyIx();
  const legacyAmmResult = validateAmmInstruction(legacyAmmIx, "buy");
  ok("Legacy AMM buy (24 accounts) fails validation", !legacyAmmResult.valid);
  ok(
    "Error mentions count or non-recipient",
    legacyAmmResult.errors.length > 0,
  );
}

// ── patchBcInstruction ─────────────────────────────────────────────────────────

async function demonstratePatchBcInstruction() {
  section("5. patchBcInstruction — migrate pre-upgrade BC instructions");

  // Your codebase builds a BC buy instruction via Anchor directly, without the SDK.
  // Before the cutover it has 17 accounts. patchBcInstruction adds the 18th.
  const legacyIx = makeLegacyBcBuyIx();
  ok("Legacy BC ix has 17 accounts", legacyIx.keys.length === 17);

  const patched = patchBcInstruction(legacyIx);
  ok("Patched BC ix has 18 accounts", patched.keys.length === 18);
  ok(
    "Last account is a breaking fee recipient",
    isBreakingFeeRecipient(patched.keys[patched.keys.length - 1]!.pubkey),
  );
  ok("Last account is mutable", patched.keys[patched.keys.length - 1]!.isWritable);
  ok("Original instruction unchanged (17 accounts)", legacyIx.keys.length === 17);

  // Idempotency: patching an already-patched ix is a no-op
  const doublePatched = patchBcInstruction(patched);
  ok("Double-patch is idempotent (same reference)", doublePatched === patched);
  ok("Double-patched ix still has 18 accounts", doublePatched.keys.length === 18);

  // The validation now passes
  ok(
    "Patched instruction passes validateBcInstruction",
    validateBcInstruction(patched, "buy").valid,
  );
}

// ── patchAmmInstruction ────────────────────────────────────────────────────────

async function demonstratePatchAmmInstruction() {
  section("6. patchAmmInstruction — migrate pre-upgrade AMM instructions");

  const legacyIx = makeLegacyAmmBuyIx();
  ok("Legacy AMM ix has 24 accounts", legacyIx.keys.length === 24);

  const patched = patchAmmInstruction(legacyIx);
  ok("Patched AMM ix has 26 accounts", patched.keys.length === 26);

  const secondToLast = patched.keys[patched.keys.length - 2]!;
  const last = patched.keys[patched.keys.length - 1]!;
  ok(
    "Second-to-last account is a breaking fee recipient (readonly)",
    isBreakingFeeRecipient(secondToLast.pubkey) && !secondToLast.isWritable,
  );
  ok("Last account (WSOL ATA) is mutable", last.isWritable);
  ok("Original instruction unchanged (24 accounts)", legacyIx.keys.length === 24);

  // Idempotency
  const doublePatched = patchAmmInstruction(patched);
  ok("Double-patch is idempotent (same reference)", doublePatched === patched);
  ok("Double-patched AMM ix still has 26 accounts", doublePatched.keys.length === 26);
}

// ── Bonus: detect-and-patch pattern ───────────────────────────────────────────

async function demonstrateDetectAndPatch() {
  section("7. Detect-and-patch pattern — bulk migration");

  // In a real migration scenario you might have a collection of instructions
  // (some already upgraded, some not) and want to ensure all are compliant.
  const instructions: TransactionInstruction[] = [
    makeLegacyBcBuyIx(),                            // 17 accounts — needs patch
    await PUMP_SDK.getBuyInstructionRaw({            // 18 accounts — already compliant
      user, mint, creator, feeRecipient,
      amount: new BN(1), solAmount: new BN(1),
    }),
    makeLegacyBcBuyIx(),                            // 17 accounts — needs patch
  ];

  const ensured = instructions.map((ix) => {
    const tail = ix.keys[ix.keys.length - 1];
    const needsPatch = !tail || !isBreakingFeeRecipient(tail.pubkey);
    return needsPatch ? patchBcInstruction(ix) : ix;
  });

  ok("All 3 instructions are now compliant (18 accounts)", ensured.every((ix) => ix.keys.length === 18));
  ok(
    "All tails are breaking fee recipients",
    ensured.every((ix) => isBreakingFeeRecipient(ix.keys[ix.keys.length - 1]!.pubkey)),
  );

  // Verify with the structured validator
  const validations = ensured.map((ix) => validateBcInstruction(ix, "buy"));
  ok("All validateBcInstruction calls return valid=true", validations.every((r) => r.valid));
}

// ── Bonus: bondingCurveV2Pda in account verification ──────────────────────────

async function demonstrateBcV2PdaPosition() {
  section("8. Verifying bonding-curve-v2 PDA position in a BC buy ix");

  const ix = await PUMP_SDK.getBuyInstructionRaw({
    user, mint, creator, feeRecipient,
    amount: new BN(1), solAmount: new BN(1),
  });

  // bonding-curve-v2 sits at index 16 (second-to-last before the breaking recipient)
  ok(
    "Index 16 = bondingCurveV2Pda(mint)",
    ix.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint)),
  );
  ok("Index 17 (last) = breaking fee recipient", isBreakingFeeRecipient(ix.keys[17]!.pubkey));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Breaking Fee Recipient — Migration Utilities Demo");
  console.log("=".repeat(52));

  await demonstrateIsBreakingFeeRecipient();
  await demonstrateWsolAtaMap();
  await demonstrateValidateBcInstruction();
  await demonstrateValidateAmmInstruction();
  await demonstratePatchBcInstruction();
  await demonstratePatchAmmInstruction();
  await demonstrateDetectAndPatch();
  await demonstrateBcV2PdaPosition();

  console.log(`\n${"─".repeat(52)}`);
  if (failed === 0) {
    console.log(`✓ All ${passed} checks passed.`);
  } else {
    console.error(`✗ ${failed} check(s) failed out of ${passed + failed}.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
