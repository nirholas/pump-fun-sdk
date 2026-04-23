/**
 * verify-accounts.ts
 *
 * Verifies that @nirholas/pump-sdk@^1.32.0 is producing the correct account
 * layout for the 2026-04-28 breaking fee-recipient upgrade. Run this before
 * cutover to confirm your environment is ready. No RPC or keypair required.
 *
 * Usage:
 *   npx ts-node pumpkit/examples/breaking-fee-recipient/verify-accounts.ts
 *
 * Expected output: every line starts with ✓. Any ✗ means you need to upgrade.
 */

import {
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  BREAKING_FEE_RECIPIENTS,
  BREAKING_FEE_RECIPIENT_WSOL_ATAS,
  PUMP_SDK,
  bondingCurveV2Pda,
  buildAmmBreakingFeeRecipientAccounts,
  isBreakingFeeRecipient,
  pickBreakingFeeRecipient,
  poolV2Pda,
  validateBcInstruction,
  patchBcInstruction,
  patchAmmInstruction,
} from "../../../src/index";

// ── Setup ─────────────────────────────────────────────────────────────────────

const mint = new PublicKey("So11111111111111111111111111111111111111112");
const user = Keypair.generate().publicKey;
const creator = Keypair.generate().publicKey;
const feeRecipient = Keypair.generate().publicKey;

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

async function main() {
  // ── Bonding curve buy ───────────────────────────────────────────────────────

  console.log("\nBonding curve buy (getBuyInstructionRaw):");
  {
    const ix = await PUMP_SDK.getBuyInstructionRaw({
      user, mint, creator, feeRecipient,
      amount: new BN(1), solAmount: new BN(1),
    });
    ok(`Total accounts = 18 (got ${ix.keys.length})`, ix.keys.length === 18);
    ok("Index 16 = bonding-curve-v2", ix.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint)));
    ok("Index 17 (last) = breaking fee recipient", isBreakingFeeRecipient(ix.keys[17]!.pubkey));
    ok("Index 17 is mutable", ix.keys[17]!.isWritable);
    ok("Index 17 is not a signer", !ix.keys[17]!.isSigner);
  }

  // ── Bonding curve buyExactSolIn ─────────────────────────────────────────────

  console.log("\nBonding curve buyExactSolIn:");
  {
    const ix = await PUMP_SDK.buyExactSolInInstruction({
      user, mint, creator, feeRecipient,
      solAmount: new BN(1), minTokenAmount: new BN(1),
    });
    ok(`Total accounts = 18 (got ${ix.keys.length})`, ix.keys.length === 18);
    ok("Index 16 = bonding-curve-v2", ix.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint)));
    ok("Index 17 (last) = breaking fee recipient", isBreakingFeeRecipient(ix.keys[17]!.pubkey));
    ok("Index 17 is mutable", ix.keys[17]!.isWritable);
  }

  // ── Bonding curve sell — non-cashback ───────────────────────────────────────

  console.log("\nBonding curve sell (non-cashback):");
  {
    const ix = await PUMP_SDK.getSellInstructionRaw({
      user, mint, creator, feeRecipient,
      amount: new BN(1), solAmount: new BN(1),
      tokenProgram: TOKEN_PROGRAM_ID, cashback: false,
    });
    ok(`Total accounts = 16 (got ${ix.keys.length})`, ix.keys.length === 16);
    ok("Index 14 = bonding-curve-v2", ix.keys[14]!.pubkey.equals(bondingCurveV2Pda(mint)));
    ok("Index 15 (last) = breaking fee recipient", isBreakingFeeRecipient(ix.keys[15]!.pubkey));
    ok("Index 15 is mutable", ix.keys[15]!.isWritable);
  }

  // ── Bonding curve sell — cashback ───────────────────────────────────────────

  console.log("\nBonding curve sell (cashback):");
  {
    const ix = await PUMP_SDK.getSellInstructionRaw({
      user, mint, creator, feeRecipient,
      amount: new BN(1), solAmount: new BN(1),
      tokenProgram: TOKEN_PROGRAM_ID, cashback: true,
    });
    ok(`Total accounts = 17 (got ${ix.keys.length})`, ix.keys.length === 17);
    ok("Index 15 = bonding-curve-v2", ix.keys[15]!.pubkey.equals(bondingCurveV2Pda(mint)));
    ok("Index 16 (last) = breaking fee recipient", isBreakingFeeRecipient(ix.keys[16]!.pubkey));
    ok("Index 16 is mutable", ix.keys[16]!.isWritable);
  }

  // ── AMM trailing-accounts helper ────────────────────────────────────────────

  console.log("\nbuildAmmBreakingFeeRecipientAccounts() helper:");
  {
    const [recipientAccount, ataAccount] = buildAmmBreakingFeeRecipientAccounts();
    ok("Returns 2 accounts", recipientAccount !== undefined && ataAccount !== undefined);
    ok("Account[0] pubkey = one of 8 breaking fee recipients", isBreakingFeeRecipient(recipientAccount!.pubkey));
    ok("Account[0] isWritable = false (readonly)", !recipientAccount!.isWritable);
    ok("Account[0] isSigner = false", !recipientAccount!.isSigner);
    ok(
      "Account[1] pubkey = recipient's WSOL ATA under TOKEN_PROGRAM_ID",
      ataAccount!.pubkey.equals(
        getAssociatedTokenAddressSync(NATIVE_MINT, recipientAccount!.pubkey, true, TOKEN_PROGRAM_ID),
      ),
    );
    ok("Account[1] isWritable = true (mutable)", ataAccount!.isWritable);
    ok("Account[1] isSigner = false", !ataAccount!.isSigner);
  }

  // ── Manual construction ─────────────────────────────────────────────────────

  console.log("\nManual construction (pickBreakingFeeRecipient + getAssociatedTokenAddressSync):");
  {
    const recipient = pickBreakingFeeRecipient();
    ok("pickBreakingFeeRecipient returns one of 8", isBreakingFeeRecipient(recipient));
    const wsol = getAssociatedTokenAddressSync(NATIVE_MINT, recipient, true, TOKEN_PROGRAM_ID);
    const [, fromHelperAta] = buildAmmBreakingFeeRecipientAccounts(recipient);
    ok("Manual WSOL ATA matches helper output when same recipient is passed", wsol.equals(fromHelperAta!.pubkey));
  }

  // ── BREAKING_FEE_RECIPIENTS constant ───────────────────────────────────────

  console.log("\nBREAKING_FEE_RECIPIENTS constant:");
  {
    ok("Exports exactly 8 recipients", BREAKING_FEE_RECIPIENTS.length === 8);
    const expected = [
      "5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD",
      "9M4giFFMxmFGXtc3feFzRai56WbBqehoSeRE5GK7gf7",
      "GXPFM2caqTtQYC2cJ5yJRi9VDkpsYZXzYdwYpGnLmtDL",
      "3BpXnfJaUTiwXnJNe7Ej1rcbzqTTQUvLShZaWazebsVR",
      "5cjcW9wExnJJiqgLjq7DEG75Pm6JBgE1hNv4B2vHXUW6",
      "EHAAiTxcdDwQ3U4bU6YcMsQGaekdzLS3B5SmYo46kJtL",
      "5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD",
      "A7hAgCzFw14fejgCp387JUJRMNyz4j89JKnhtKU8piqW",
    ];
    for (const [i, addr] of expected.entries()) {
      ok(`Recipient[${i}] = ${addr}`, BREAKING_FEE_RECIPIENTS[i]!.toBase58() === addr);
    }
  }

  // ── BREAKING_FEE_RECIPIENT_WSOL_ATAS ──────────────────────────────────────

  console.log("\nBREAKING_FEE_RECIPIENT_WSOL_ATAS pre-computed map:");
  {
    ok("Contains exactly 8 entries", BREAKING_FEE_RECIPIENT_WSOL_ATAS.size === 8);
    for (const r of BREAKING_FEE_RECIPIENTS) {
      const stored = BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(r.toBase58());
      const expected = getAssociatedTokenAddressSync(NATIVE_MINT, r, true, TOKEN_PROGRAM_ID);
      ok(`WSOL ATA for ${r.toBase58().slice(0, 8)}… is correct`, stored?.equals(expected) ?? false);
    }
  }

  // ── validateBcInstruction ──────────────────────────────────────────────────

  console.log("\nvalidateBcInstruction:");
  {
    const buyIx = await PUMP_SDK.getBuyInstructionRaw({ user, mint, creator, feeRecipient, amount: new BN(1), solAmount: new BN(1) });
    const buyResult = validateBcInstruction(buyIx, "buy");
    ok("buy ix passes validation", buyResult.valid);
    if (!buyResult.valid) console.error("    errors:", buyResult.errors);

    const sellIx = await PUMP_SDK.getSellInstructionRaw({ user, mint, creator, feeRecipient, amount: new BN(1), solAmount: new BN(1), tokenProgram: TOKEN_PROGRAM_ID, cashback: false });
    ok("sell (non-cashback) ix passes validation", validateBcInstruction(sellIx, "sell").valid);

    const sellCbIx = await PUMP_SDK.getSellInstructionRaw({ user, mint, creator, feeRecipient, amount: new BN(1), solAmount: new BN(1), tokenProgram: TOKEN_PROGRAM_ID, cashback: true });
    ok("sell (cashback) ix passes validation", validateBcInstruction(sellCbIx, "sell-cashback").valid);
  }

  // ── patchBcInstruction — idempotency ──────────────────────────────────────

  console.log("\npatchBcInstruction (idempotency on already-correct instructions):");
  {
    const ix = await PUMP_SDK.getBuyInstructionRaw({ user, mint, creator, feeRecipient, amount: new BN(1), solAmount: new BN(1) });
    const patched = patchBcInstruction(ix);
    ok("patchBcInstruction is idempotent on already-correct ix", patched === ix);
  }

  // ── patchAmmInstruction — smoke ────────────────────────────────────────────

  console.log("\npatchAmmInstruction (smoke — patches a synthetic old-format ix):");
  {
    const { TransactionInstruction: TxIx, PublicKey: PK } = await import("@solana/web3.js");
    const fakeKey = () => ({ pubkey: new PK(Keypair.generate().publicKey.toBytes()), isWritable: false, isSigner: false });
    const oldIx = new TxIx({
      keys: Array(22).fill(null).map(() => fakeKey()),
      programId: new PK("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
      data: Buffer.alloc(0),
    });
    const patched = patchAmmInstruction(oldIx);
    ok("patched ix has 24 accounts (22 + 2 new)", patched.keys.length === 24);
    ok("second-to-last is a breaking fee recipient (readonly)", isBreakingFeeRecipient(patched.keys[22]!.pubkey) && !patched.keys[22]!.isWritable);
    ok("last is mutable WSOL ATA", patched.keys[23]!.isWritable && !!BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(patched.keys[22]!.pubkey.toBase58()));
    ok("patchAmmInstruction is idempotent on already-patched ix", patchAmmInstruction(patched) === patched);
  }

  // ── poolV2Pda — pre-upgrade AMM tail ───────────────────────────────────────

  console.log("\npoolV2Pda (pre-upgrade AMM remaining-account):");
  {
    const pda = poolV2Pda(mint);
    ok("Derives deterministically from mint", pda.equals(poolV2Pda(mint)));
    ok("Different mint → different PDA", !pda.equals(poolV2Pda(Keypair.generate().publicKey)));
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log(`\n${"─".repeat(60)}`);
  if (failed === 0) {
    console.log(`✓ All ${passed} checks passed. You are ready for the 2026-04-28 cutover.`);
  } else {
    console.error(`✗ ${failed} check(s) failed. Upgrade to @nirholas/pump-sdk@^1.32.0 and rerun.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
