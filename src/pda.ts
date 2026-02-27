import {
  poolPda,
  pumpFeePda,
  pumpPda,
  pumpAmmPda,
} from "@pump-fun/pump-swap-sdk";
import {
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, PublicKeyInitData } from "@solana/web3.js";
import { Buffer } from "buffer";

import {
  MAYHEM_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
} from "./sdk";

/** PDA for the Pump program global state account. */
export const GLOBAL_PDA = pumpPda([Buffer.from("global")]);

/** PDA for the PumpAMM program global state account. */
export const AMM_GLOBAL_PDA = pumpAmmPda([Buffer.from("amm_global")]);

/** PDA for the PumpFees program fee configuration account. */
export const PUMP_FEE_CONFIG_PDA = pumpFeePda([
  Buffer.from("fee_config"),
  PUMP_PROGRAM_ID.toBuffer(),
]);

/** PDA for the global volume accumulator (Pump program). */
export const GLOBAL_VOLUME_ACCUMULATOR_PDA = pumpPda([
  Buffer.from("global_volume_accumulator"),
]);

/** PDA for the global volume accumulator (PumpAMM program). */
export const AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA = pumpAmmPda([
  Buffer.from("global_volume_accumulator"),
]);

/** Anchor event authority PDA for the Pump program. */
export const PUMP_EVENT_AUTHORITY_PDA = getEventAuthorityPda(PUMP_PROGRAM_ID);
/** Anchor event authority PDA for the PumpAMM program. */
export const PUMP_AMM_EVENT_AUTHORITY_PDA =
  getEventAuthorityPda(PUMP_AMM_PROGRAM_ID);
/** Anchor event authority PDA for the PumpFees program. */
export const PUMP_FEE_EVENT_AUTHORITY_PDA =
  getEventAuthorityPda(PUMP_FEE_PROGRAM_ID);

/** Derive the `__event_authority` PDA for a given Anchor program. */
export function getEventAuthorityPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId,
  )[0];
}

/** Derive the bonding curve PDA for a given token mint. */
export function bondingCurvePda(mint: PublicKeyInitData): PublicKey {
  return pumpPda([
    Buffer.from("bonding-curve"),
    new PublicKey(mint).toBuffer(),
  ]);
}

/** Derive the creator vault PDA that holds creator fee SOL. */
export function creatorVaultPda(creator: PublicKey) {
  return pumpPda([Buffer.from("creator-vault"), creator.toBuffer()]);
}

/** Derive the pool authority PDA used during AMM graduation. */
export function pumpPoolAuthorityPda(mint: PublicKey): PublicKey {
  return pumpPda([Buffer.from("pool-authority"), mint.toBuffer()]);
}

/** Canonical pool index (always 0 for the primary liquidity pool). */
export const CANONICAL_POOL_INDEX = 0;

/** Derive the canonical PumpAMM pool PDA for a given token mint. */
export function canonicalPumpPoolPda(mint: PublicKey): PublicKey {
  return poolPda(
    CANONICAL_POOL_INDEX,
    pumpPoolAuthorityPda(mint),
    mint,
    NATIVE_MINT,
  );
}

/** Derive the user volume accumulator PDA for token incentive tracking. */
export function userVolumeAccumulatorPda(user: PublicKey): PublicKey {
  return pumpPda([Buffer.from("user_volume_accumulator"), user.toBuffer()]);
}

/// Mayhem mode pdas

/** Derive the Mayhem global params PDA. */
export const getGlobalParamsPda = (): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global-params")],
    MAYHEM_PROGRAM_ID,
  )[0];
};

/** Derive the Mayhem state PDA for a given token mint. */
export const getMayhemStatePda = (mint: PublicKey): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mayhem-state"), mint.toBuffer()],
    MAYHEM_PROGRAM_ID,
  )[0];
};

/** Derive the Mayhem SOL vault PDA. */
export const getSolVaultPda = (): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sol-vault")],
    MAYHEM_PROGRAM_ID,
  )[0];
};

/** Derive the Mayhem token vault ATA for a given mint. */
export const getTokenVaultPda = (mintPubkey: PublicKey): PublicKey => {
  return getAssociatedTokenAddressSync(
    mintPubkey,
    getSolVaultPda(),
    true,
    TOKEN_2022_PROGRAM_ID,
  );
};

/** Derive the fee-sharing config PDA for a given token mint. */
export const feeSharingConfigPda = (mint: PublicKey): PublicKey => {
  return pumpFeePda([Buffer.from("sharing-config"), mint.toBuffer()]);
};

/** Derive the AMM creator vault PDA for a graduated token's creator. */
export const ammCreatorVaultPda = (creator: PublicKey): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), creator.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  )[0];
};

