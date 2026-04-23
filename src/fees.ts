import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { bondingCurveMarketCap } from "./bondingCurve";
import { FeeConfig, Global, Fees, BondingCurve, FeeTier } from "./state";

/** Constant: 1 billion token supply with 6 decimals (1,000,000,000 * 10^6). */
export const ONE_BILLION_SUPPLY = new BN(1_000_000_000_000_000);

export interface CalculatedFeesBps {
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}

/**
 * Calculate the total fee (protocol + creator) for a given trade amount.
 * Used internally by buy/sell quote functions.
 */
export function getFee({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
  isNewBondingCurve,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
  isNewBondingCurve: boolean;
}) {
  const { virtualSolReserves, virtualTokenReserves, isMayhemMode } =
    bondingCurve;
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply: isMayhemMode ? mintSupply : ONE_BILLION_SUPPLY,
    virtualSolReserves,
    virtualTokenReserves,
  });

  return fee(amount, protocolFeeBps).add(
    isNewBondingCurve || !PublicKey.default.equals(bondingCurve.creator)
      ? fee(amount, creatorFeeBps)
      : new BN(0),
  );
}

/**
 * Compute the protocol and creator fee rates in basis points.
 * Uses tiered fees from FeeConfig when available, otherwise falls back to global defaults.
 */
export function computeFeesBps({
  global,
  feeConfig,
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
}): CalculatedFeesBps {
  if (feeConfig != null) {
    const marketCap = bondingCurveMarketCap({
      mintSupply,
      virtualSolReserves,
      virtualTokenReserves,
    });

    return calculateFeeTier({
      feeTiers: feeConfig.feeTiers,
      marketCap,
    });
  }

  return {
    protocolFeeBps: global.feeBasisPoints,
    creatorFeeBps: global.creatorFeeBasisPoints,
  };
}

/**
 * Select the appropriate fee tier based on market cap.
 * Fee tiers are ordered by market cap threshold; the highest matching tier is used.
 *
 * @throws If feeTiers is empty
 */
/// rust reference: pump-fees-math::calculate_fee_tier()
export function calculateFeeTier({
  feeTiers,
  marketCap,
}: {
  feeTiers: FeeTier[];
  marketCap: BN;
}): Fees {
  const firstTier = feeTiers[0];
  if (!firstTier) {
    throw new Error("feeTiers must not be empty");
  }

  if (marketCap.lt(firstTier.marketCapLamportsThreshold)) {
    return firstTier.fees;
  }

  for (const tier of feeTiers.slice().reverse()) {
    if (marketCap.gte(tier.marketCapLamportsThreshold)) {
      return tier.fees;
    }
  }

  return firstTier.fees;
}

function fee(amount: BN, feeBasisPoints: BN): BN {
  return ceilDiv(amount.mul(feeBasisPoints), new BN(10_000));
}

function ceilDiv(a: BN, b: BN): BN {
  return a.add(b.subn(1)).div(b);
}

export function getFeeRecipient(
  global: Global,
  mayhemMode: boolean,
): PublicKey {
  if (mayhemMode) {
    const feeRecipients = [
      global.reservedFeeRecipient,
      ...global.reservedFeeRecipients,
    ];
    return feeRecipients[Math.floor(Math.random() * feeRecipients.length)]!;
  }
  const feeRecipients = [global.feeRecipient, ...global.feeRecipients];
  return feeRecipients[Math.floor(Math.random() * feeRecipients.length)]!;
}

/**
 * 8 new fee recipient pubkeys introduced by the 2026-04-28 breaking program
 * upgrade (pump-fun/pump-public-docs/docs/BREAKING_FEE_RECIPIENT.md).
 *
 * One must be appended to every bonding-curve buy/sell and every AMM buy/sell
 * instruction. The AMM side additionally requires the recipient's quote-mint
 * ATA. Shared across both programs.
 */
export const BREAKING_FEE_RECIPIENTS: PublicKey[] = [
  new PublicKey("5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD"),
  new PublicKey("9M4giFFMxmFGXtc3feFzRai56WbBqehoSeRE5GK7gf7"),
  new PublicKey("GXPFM2caqTtQYC2cJ5yJRi9VDkpsYZXzYdwYpGnLmtDL"),
  new PublicKey("3BpXnfJaUTiwXnJNe7Ej1rcbzqTTQUvLShZaWazebsVR"),
  new PublicKey("5cjcW9wExnJJiqgLjq7DEG75Pm6JBgE1hNv4B2vHXUW6"),
  new PublicKey("EHAAiTxcdDwQ3U4bU6YcMsQGaekdzLS3B5SmYo46kJtL"),
  new PublicKey("5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD"),
  new PublicKey("A7hAgCzFw14fejgCp387JUJRMNyz4j89JKnhtKU8piqW"),
];

/** Returns true if pubkey is one of the 8 breaking fee recipients. */
export function isBreakingFeeRecipient(pubkey: PublicKey): boolean {
  const b58 = pubkey.toBase58();
  return BREAKING_FEE_RECIPIENTS.some((r) => r.toBase58() === b58);
}

/** Pick one of the 8 breaking fee recipients at random. */
export function pickBreakingFeeRecipient(): PublicKey {
  return BREAKING_FEE_RECIPIENTS[
    Math.floor(Math.random() * BREAKING_FEE_RECIPIENTS.length)
  ]!;
}

/**
 * Pre-computed WSOL ATAs for each of the 8 breaking fee recipients, keyed by
 * recipient base58 address. Use this in high-throughput paths (e.g. AMM trading
 * bots) to avoid re-deriving the ATA on every instruction.
 *
 * @example
 * const recipient = pickBreakingFeeRecipient();
 * const wsol = BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(recipient.toBase58())!;
 */
export const BREAKING_FEE_RECIPIENT_WSOL_ATAS: ReadonlyMap<string, PublicKey> =
  new Map(
    BREAKING_FEE_RECIPIENTS.map((r) => [
      r.toBase58(),
      getAssociatedTokenAddressSync(NATIVE_MINT, r, true, TOKEN_PROGRAM_ID),
    ]),
  );

/**
 * The two trailing accounts every PumpAMM buy/sell must carry after the 2026-04-28
 * upgrade: one of 8 breaking fee recipients (readonly), then that recipient's
 * quote-mint (WSOL) ATA under the classic SPL token program (mutable).
 *
 * Exported so the AMM instruction builders and tests share a single source of truth.
 */
export function buildAmmBreakingFeeRecipientAccounts(
  feeRecipient: PublicKey = pickBreakingFeeRecipient(),
): {
  pubkey: PublicKey;
  isWritable: boolean;
  isSigner: boolean;
}[] {
  return [
    {
      pubkey: feeRecipient,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(feeRecipient.toBase58()) ??
        getAssociatedTokenAddressSync(
          NATIVE_MINT,
          feeRecipient,
          true,
          TOKEN_PROGRAM_ID,
        ),
      isWritable: true,
      isSigner: false,
    },
  ];
}

export interface BreakingFeeValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate the account layout of a bonding curve buy or sell instruction
 * produced after the 2026-04-28 upgrade.
 *
 * @param ix   The TransactionInstruction to inspect.
 * @param kind "buy" (18 accounts) | "sell" (16) | "sell-cashback" (17)
 */
export function validateBcInstruction(
  ix: TransactionInstruction,
  kind: "buy" | "sell" | "sell-cashback",
): BreakingFeeValidation {
  const expected = kind === "buy" ? 18 : kind === "sell-cashback" ? 17 : 16;
  const errors: string[] = [];

  if (ix.keys.length !== expected) {
    errors.push(
      `expected ${expected} accounts for BC ${kind}, got ${ix.keys.length}`,
    );
  }

  const tail = ix.keys[ix.keys.length - 1];
  if (!tail) {
    errors.push("instruction has no accounts");
    return { valid: false, errors };
  }

  if (!isBreakingFeeRecipient(tail.pubkey)) {
    errors.push(
      `last account (${tail.pubkey.toBase58()}) is not a breaking fee recipient`,
    );
  }
  if (!tail.isWritable) {
    errors.push("last account (breaking fee recipient) must be mutable");
  }
  if (tail.isSigner) {
    errors.push("last account (breaking fee recipient) must not be a signer");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the account layout of a PumpAMM buy or sell instruction produced
 * after the 2026-04-28 upgrade.
 *
 * @param ix   The TransactionInstruction to inspect.
 * @param kind "buy" (26) | "buy-cashback" (27) | "sell" (24) | "sell-cashback" (26)
 */
export function validateAmmInstruction(
  ix: TransactionInstruction,
  kind: "buy" | "buy-cashback" | "sell" | "sell-cashback",
): BreakingFeeValidation {
  const expected =
    kind === "buy"
      ? 26
      : kind === "buy-cashback"
        ? 27
        : kind === "sell"
          ? 24
          : 26; // sell-cashback
  const errors: string[] = [];

  if (ix.keys.length !== expected) {
    errors.push(
      `expected ${expected} accounts for AMM ${kind}, got ${ix.keys.length}`,
    );
  }

  const ataAccount = ix.keys[ix.keys.length - 1];
  const recipientAccount = ix.keys[ix.keys.length - 2];

  if (!recipientAccount || !ataAccount) {
    errors.push("instruction has fewer than 2 accounts");
    return { valid: false, errors };
  }

  if (!isBreakingFeeRecipient(recipientAccount.pubkey)) {
    errors.push(
      `second-to-last account (${recipientAccount.pubkey.toBase58()}) is not a breaking fee recipient`,
    );
  }
  if (recipientAccount.isWritable) {
    errors.push("AMM fee recipient (second-to-last) must be readonly");
  }
  if (recipientAccount.isSigner) {
    errors.push("AMM fee recipient must not be a signer");
  }

  if (isBreakingFeeRecipient(recipientAccount.pubkey)) {
    const expectedAta = BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(
      recipientAccount.pubkey.toBase58(),
    )!;
    if (!ataAccount.pubkey.equals(expectedAta)) {
      errors.push(
        `last account (WSOL ATA) does not match expected ATA for recipient ${recipientAccount.pubkey.toBase58()}`,
      );
    }
  }
  if (!ataAccount.isWritable) {
    errors.push("AMM WSOL ATA (last account) must be mutable");
  }
  if (ataAccount.isSigner) {
    errors.push("AMM WSOL ATA must not be a signer");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Append the breaking fee recipient trailing account to a bonding curve buy or
 * sell instruction that was built without it (pre-upgrade code). Returns a new
 * instruction — the original is not mutated.
 *
 * Idempotent: if the tail is already a breaking fee recipient, the instruction
 * is returned unchanged.
 */
export function patchBcInstruction(
  ix: TransactionInstruction,
): TransactionInstruction {
  const tail = ix.keys[ix.keys.length - 1];
  if (tail && isBreakingFeeRecipient(tail.pubkey)) return ix;

  return new TransactionInstruction({
    keys: [
      ...ix.keys,
      { pubkey: pickBreakingFeeRecipient(), isWritable: true, isSigner: false },
    ],
    programId: ix.programId,
    data: ix.data,
  });
}

/**
 * Append the two breaking fee recipient trailing accounts to a PumpAMM buy or
 * sell instruction built without them (pre-upgrade code). Returns a new
 * instruction — the original is not mutated.
 *
 * Idempotent: if the second-to-last account is already a breaking fee
 * recipient, the instruction is returned unchanged.
 */
export function patchAmmInstruction(
  ix: TransactionInstruction,
): TransactionInstruction {
  const secondToLast = ix.keys[ix.keys.length - 2];
  if (secondToLast && isBreakingFeeRecipient(secondToLast.pubkey)) return ix;

  return new TransactionInstruction({
    keys: [...ix.keys, ...buildAmmBreakingFeeRecipientAccounts()],
    programId: ix.programId,
    data: ix.data,
  });
}
