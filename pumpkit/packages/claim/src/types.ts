/**
 * PumpFun Claim Bot — Type Definitions
 *
 * Program IDs, instruction discriminators, and event types for
 * the interactive fee claim tracker bot.
 */

// ============================================================================
// Program IDs
// ============================================================================

export const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const PUMP_FEE_PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';
export const MONITORED_PROGRAM_IDS = [PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID] as const;

export const PUMPFUN_FEE_ACCOUNT = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJ5GEFDM97zC';

// ============================================================================
// Claim Instruction Discriminators
// ============================================================================

export type ClaimType =
    | 'collect_creator_fee'
    | 'claim_cashback'
    | 'collect_coin_creator_fee'
    | 'distribute_creator_fees'
    | 'transfer_creator_fees_to_pump'
    | 'claim_social_fee_pda';

export interface InstructionDef {
    discriminator: string;
    label: string;
    claimType: ClaimType;
    programId: string;
    isCreatorClaim: boolean;
}

export const CLAIM_INSTRUCTIONS: InstructionDef[] = [
    { claimType: 'collect_creator_fee', discriminator: '1416567bc61cdb84', isCreatorClaim: true, label: 'Collect Creator Fee (Pump)', programId: PUMP_PROGRAM_ID },
    { claimType: 'claim_cashback', discriminator: '253a237ebe35e4c5', isCreatorClaim: false, label: 'Claim Cashback (Pump)', programId: PUMP_PROGRAM_ID },
    { claimType: 'distribute_creator_fees', discriminator: 'a572670079cef751', isCreatorClaim: true, label: 'Distribute Creator Fees (Pump)', programId: PUMP_PROGRAM_ID },
    { claimType: 'collect_coin_creator_fee', discriminator: 'a039592ab58b2b42', isCreatorClaim: true, label: 'Collect Creator Fee (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
    { claimType: 'claim_cashback', discriminator: '253a237ebe35e4c5', isCreatorClaim: false, label: 'Claim Cashback (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
    { claimType: 'transfer_creator_fees_to_pump', discriminator: '8b348655e4e56cf1', isCreatorClaim: true, label: 'Transfer Creator Fees to Pump', programId: PUMP_AMM_PROGRAM_ID },
    { claimType: 'claim_social_fee_pda', discriminator: 'e115fb85a11ec7e2', isCreatorClaim: true, label: 'Claim Social Fee PDA', programId: PUMP_FEE_PROGRAM_ID },
];

export const CLAIM_EVENT_DISCRIMINATORS: Record<string, { label: string; isCreatorClaim: boolean }> = {
    '7a027f010ebf0caf': { isCreatorClaim: true, label: 'CollectCreatorFeeEvent' },
    'a537817004b3ca28': { isCreatorClaim: true, label: 'DistributeCreatorFeesEvent' },
    'e2d6f62107f293e5': { isCreatorClaim: false, label: 'ClaimCashbackEvent' },
    'e8f5c2eeeada3a59': { isCreatorClaim: true, label: 'CollectCoinCreatorFeeEvent' },
    '3212c141edd2eaec': { isCreatorClaim: true, label: 'SocialFeePdaClaimed' },
};

// ============================================================================
// Events
// ============================================================================

export interface FeeClaimEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    claimerWallet: string;
    tokenMint: string;
    tokenName?: string;
    tokenSymbol?: string;
    amountSol: number;
    amountLamports: number;
    claimType: ClaimType;
    isCashback: boolean;
    programId: string;
    claimLabel: string;
    /** GitHub numeric user ID (only for claim_social_fee_pda events) */
    githubUserId?: string;
    /** Platform enum (2 = GitHub) — only for claim_social_fee_pda events */
    socialPlatform?: number;
    /** Recipient wallet for social fee claims (may differ from signer) */
    recipientWallet?: string;
    /** Social fee PDA account for social claims */
    socialFeePda?: string;
}

// ============================================================================
// Tracking Types
// ============================================================================

/** A tracked item — either a token CA or an X handle */
export type TrackType = 'token' | 'xhandle';

export interface TrackedItem {
    /** Unique ID */
    id: string;
    /** Chat that added this item */
    chatId: number;
    /** User who added it */
    addedBy: number;
    /** What type of tracking */
    type: TrackType;
    /** The value: a mint address (token) or X handle (xhandle) */
    value: string;
    /** Optional user-given label */
    label?: string;
    /** When added */
    createdAt: number;
}

// ============================================================================
// Bot Config
// ============================================================================

export interface BotConfig {
    telegramToken: string;
    /** WebSocket relay URL (e.g. ws://localhost:3099/ws) */
    relayWsUrl: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    twitterBearerToken?: string;
    twitterInfluencerIds: string[];
    /** Primary Solana RPC endpoint */
    solanaRpcUrl?: string;
    /** WebSocket endpoint for real-time logs (optional — derived from RPC if omitted) */
    solanaWsUrl?: string;
    /** Polling interval in seconds when WebSocket is unavailable (default: 15) */
    pollIntervalSeconds?: number;
}

// ============================================================================
// Twitter/X API Types
// ============================================================================

export interface TwitterUserInfo {
    id: string;
    username: string;
    name: string;
    followersCount: number;
    followedByInfluencers: string[];
}
