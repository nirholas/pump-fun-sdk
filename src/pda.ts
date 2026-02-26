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

export const GLOBAL_PDA = pumpPda([Buffer.from("global")]);

export const AMM_GLOBAL_PDA = pumpAmmPda([Buffer.from("amm_global")]);

export const PUMP_FEE_CONFIG_PDA = pumpFeePda([
  Buffer.from("fee_config"),
  PUMP_PROGRAM_ID.toBuffer(),
]);

export const GLOBAL_VOLUME_ACCUMULATOR_PDA = pumpPda([
  Buffer.from("global_volume_accumulator"),
]);

export const AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA = pumpAmmPda([
  Buffer.from("global_volume_accumulator"),
]);

export const PUMP_EVENT_AUTHORITY_PDA = getEventAuthorityPda(PUMP_PROGRAM_ID);
export const PUMP_AMM_EVENT_AUTHORITY_PDA =
  getEventAuthorityPda(PUMP_AMM_PROGRAM_ID);
export const PUMP_FEE_EVENT_AUTHORITY_PDA =
  getEventAuthorityPda(PUMP_FEE_PROGRAM_ID);

export function getEventAuthorityPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId,
  )[0];
}

export function bondingCurvePda(mint: PublicKeyInitData): PublicKey {
  return pumpPda([
    Buffer.from("bonding-curve"),
    new PublicKey(mint).toBuffer(),
  ]);
}

export function creatorVaultPda(creator: PublicKey) {
  return pumpPda([Buffer.from("creator-vault"), creator.toBuffer()]);
}

export function pumpPoolAuthorityPda(mint: PublicKey): PublicKey {
  return pumpPda([Buffer.from("pool-authority"), mint.toBuffer()]);
}

export const CANONICAL_POOL_INDEX = 0;

export function canonicalPumpPoolPda(mint: PublicKey): PublicKey {
  return poolPda(
    CANONICAL_POOL_INDEX,
    pumpPoolAuthorityPda(mint),
    mint,
    NATIVE_MINT,
  );
}

export function userVolumeAccumulatorPda(user: PublicKey): PublicKey {
  return pumpPda([Buffer.from("user_volume_accumulator"), user.toBuffer()]);
}

/// Mayhem mode pdas

export const getGlobalParamsPda = (): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global-params")],
    MAYHEM_PROGRAM_ID,
  )[0];
};

export const getMayhemStatePda = (mint: PublicKey): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mayhem-state"), mint.toBuffer()],
    MAYHEM_PROGRAM_ID,
  )[0];
};

export const getSolVaultPda = (): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sol-vault")],
    MAYHEM_PROGRAM_ID,
  )[0];
};

export const getTokenVaultPda = (mintPubkey: PublicKey): PublicKey => {
  return getAssociatedTokenAddressSync(
    mintPubkey,
    getSolVaultPda(),
    true,
    TOKEN_2022_PROGRAM_ID,
  );
};

export const feeSharingConfigPda = (mint: PublicKey): PublicKey => {
  return pumpFeePda([Buffer.from("sharing-config"), mint.toBuffer()]);
};

export const ammCreatorVaultPda = (creator: PublicKey): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), creator.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  )[0];
};

