/**
 * @pumpkit/core — Solana Program Constants
 *
 * Program IDs, known accounts, and instruction discriminators
 * for the Pump protocol ecosystem.
 */

/** Pump bonding curve program */
export const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/** PumpSwap AMM program */
export const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

/** PumpFees program */
export const PUMP_FEE_PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';

/** PumpFun fee recipient account */
export const PUMPFUN_FEE_ACCOUNT = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJ5GEFDM97zC';

/** PumpFun migration authority */
export const PUMPFUN_MIGRATION_AUTHORITY = '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg';

/** Wrapped SOL mint */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

/** All monitored program IDs */
export const MONITORED_PROGRAM_IDS = [
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
] as const;

// ── Instruction Discriminators (hex strings, first 8 bytes) ───────────

/** create_v2 instruction on Pump program */
export const CREATE_V2_DISCRIMINATOR = 'd6904cec5f8b31b4';

/** create (v1, deprecated) instruction on Pump program */
export const CREATE_DISCRIMINATOR = '181ec828051c0777';

// ── Event Discriminators (hex strings, first 8 bytes) ─────────────────

/** CompleteEvent — bonding curve graduation */
export const COMPLETE_EVENT_DISCRIMINATOR = '5f72619cd42e9808';

/** CompletePumpAmmMigrationEvent — AMM pool creation after graduation */
export const COMPLETE_AMM_MIGRATION_DISCRIMINATOR = 'bde95db95c94ea94';

/** TradeEvent — buy/sell on bonding curve */
export const TRADE_EVENT_DISCRIMINATOR = 'bddb7fd34ee661ee';

/** DistributeCreatorFeesEvent — fee distribution to shareholders */
export const DISTRIBUTE_FEES_EVENT_DISCRIMINATOR = 'a537817004b3ca28';

/** CollectCreatorFeeEvent — creator fee collection */
export const COLLECT_CREATOR_FEE_DISCRIMINATOR = '7a027f010ebf0caf';

/** ClaimCashbackEvent — cashback reward claim */
export const CLAIM_CASHBACK_DISCRIMINATOR = 'e2d6f62107f293e5';

/** CollectCoinCreatorFeeEvent — coin creator fee collection on AMM */
export const COLLECT_COIN_CREATOR_FEE_DISCRIMINATOR = 'e8f5c2eeeada3a59';

/** Well-known system programs to exclude when searching for mint addresses */
export const SYSTEM_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',   // SPL Token
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',   // Token-2022
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',  // ATA
  'SysvarRent111111111111111111111111111111111',
  'SysvarC1ock11111111111111111111111111111111',
  'ComputeBudget111111111111111111111111111111',
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',   // Token Metadata
  PUMP_PROGRAM_ID,
]);

/** Default token total supply (1B tokens with 6 decimals) */
export const DEFAULT_TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000;

/** Approximate SOL threshold for bonding curve graduation (~85 SOL) */
export const DEFAULT_GRADUATION_SOL_THRESHOLD = 85;
