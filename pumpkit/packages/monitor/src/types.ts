/**
 * PumpFun Telegram Bot — Type Definitions
 *
 * All shared types for the PumpFun fee claim monitoring bot.
 * Program IDs and instruction discriminators sourced from the official
 * PumpFun IDL files (pump-fun/pump-public-docs).
 */

// ============================================================================
// PumpFun Program IDs (from official IDL)
// ============================================================================

/** Pump bonding-curve program (token launches, trading on curve, creator fee collection) */
export const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/** PumpSwap AMM program (post-graduation liquidity, LP trading, creator fee collection) */
export const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

/** Pump Fees config program (fee tiers, sharing config — no claim instructions) */
export const PUMP_FEES_PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';

/** All program IDs to monitor for claim transactions */
export const MONITORED_PROGRAM_IDS = [PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID] as const;

// ============================================================================
// Known Accounts
// ============================================================================

/** PumpFun global fee recipient / vault */
export const PUMPFUN_FEE_ACCOUNT = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJ5GEFDM97zC';

/** PumpFun migration authority (bonding-curve graduation) */
export const PUMPFUN_MIGRATION_AUTHORITY = '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg';

/** Wrapped SOL mint */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// ============================================================================
// Token Creation Instruction Discriminators
// ============================================================================

/** Anchor discriminator for createV2 instruction (first 8 bytes of sha256("global:create_v2")) */
export const CREATE_V2_DISCRIMINATOR = 'd6904cec5f8b31b4';

/** Anchor discriminator for create instruction (first 8 bytes of sha256("global:create")) */
export const CREATE_DISCRIMINATOR = '181ec828051c0777';

// ============================================================================
// Pump Event Discriminators (from official IDL)
// ============================================================================

/** Anchor event discriminator for CompleteEvent (bonding curve graduation) */
export const COMPLETE_EVENT_DISCRIMINATOR = '5f72619cd42e9808';

/** Anchor event discriminator for CompletePumpAmmMigrationEvent (AMM pool creation) */
export const COMPLETE_AMM_MIGRATION_DISCRIMINATOR = 'bde95db95c94ea94';

/** Anchor event discriminator for TradeEvent (buy/sell on bonding curve) */
export const TRADE_EVENT_DISCRIMINATOR = 'bddb7fd34ee661ee';

/** Approximate SOL threshold for bonding curve graduation (~85 SOL real reserves) */
export const DEFAULT_GRADUATION_SOL_THRESHOLD = 85;

// ============================================================================
// Instruction Discriminators (from official IDL, first 8 bytes as hex)
// ============================================================================

/** Claim type identifiers */
export type ClaimType =
    | 'collect_creator_fee'
    | 'claim_cashback'
    | 'claim_social_fee_pda'
    | 'collect_coin_creator_fee'
    | 'distribute_creator_fees'
    | 'transfer_creator_fees_to_pump';

export interface InstructionDef {
    /** Hex string of the 8-byte Anchor discriminator */
    discriminator: string;
    /** Human-readable label */
    label: string;
    /** Which claim type this instruction represents */
    claimType: ClaimType;
    /** Which program this instruction belongs to */
    programId: string;
    /** Whether the claimer is a creator (true) or trader getting cashback (false) */
    isCreatorClaim: boolean;
}

export const CLAIM_INSTRUCTIONS: InstructionDef[] = [
    // ── Pump Bonding Curve Program ──────────────────────────────────────
    {
        claimType: 'collect_creator_fee',
        discriminator: '1416567bc61cdb84',
        isCreatorClaim: true,
        label: 'Collect Creator Fee (Pump)',
        programId: PUMP_PROGRAM_ID,
    },
    {
        claimType: 'claim_cashback',
        discriminator: '253a237ebe35e4c5',
        isCreatorClaim: false,
        label: 'Claim Cashback (Pump)',
        programId: PUMP_PROGRAM_ID,
    },
    {
        claimType: 'distribute_creator_fees',
        discriminator: 'a572670079cef751',
        isCreatorClaim: true,
        label: 'Distribute Creator Fees (Pump)',
        programId: PUMP_PROGRAM_ID,
    },
    // ── PumpSwap AMM Program ────────────────────────────────────────────
    {
        claimType: 'collect_coin_creator_fee',
        discriminator: 'a039592ab58b2b42',
        isCreatorClaim: true,
        label: 'Collect Creator Fee (PumpSwap)',
        programId: PUMP_AMM_PROGRAM_ID,
    },
    {
        claimType: 'claim_cashback',
        discriminator: '253a237ebe35e4c5',
        isCreatorClaim: false,
        label: 'Claim Cashback (PumpSwap)',
        programId: PUMP_AMM_PROGRAM_ID,
    },
    {
        claimType: 'transfer_creator_fees_to_pump',
        discriminator: '8b348655e4e56cf1',
        isCreatorClaim: true,
        label: 'Transfer Creator Fees to Pump',
        programId: PUMP_AMM_PROGRAM_ID,
    },
];

// ============================================================================
// CTO (Creator Takeover) Instruction Discriminators
// ============================================================================

/** Creator change type identifiers */
export type CreatorChangeType =
    | 'set_creator'
    | 'admin_set_creator'
    | 'set_coin_creator'
    | 'admin_set_coin_creator'
    | 'migrate_pool_coin_creator';

export interface CreatorChangeInstructionDef {
    /** Hex string of the 8-byte Anchor discriminator */
    discriminator: string;
    /** Human-readable label */
    label: string;
    /** Which creator change type this instruction represents */
    changeType: CreatorChangeType;
    /** Which program this instruction belongs to */
    programId: string;
    /** Whether the new creator pubkey is in the instruction args (vs derived from metadata) */
    hasCreatorArg: boolean;
}

export const CTO_INSTRUCTIONS: CreatorChangeInstructionDef[] = [
    // ── Pump Bonding Curve Program ──────────────────────────────────────
    {
        changeType: 'admin_set_creator',
        discriminator: '4519ab8e39ef0d04',
        hasCreatorArg: true,
        label: 'Admin Set Creator (Pump)',
        programId: PUMP_PROGRAM_ID,
    },
    {
        changeType: 'set_creator',
        discriminator: 'fe94ff70cf8eaaa5',
        hasCreatorArg: true,
        label: 'Set Creator (Pump)',
        programId: PUMP_PROGRAM_ID,
    },
    // ── PumpSwap AMM Program ────────────────────────────────────────────
    {
        changeType: 'admin_set_coin_creator',
        discriminator: 'f228759149606968',
        hasCreatorArg: true,
        label: 'Admin Set Coin Creator (PumpSwap)',
        programId: PUMP_AMM_PROGRAM_ID,
    },
    {
        changeType: 'set_coin_creator',
        discriminator: 'd295802dbc3a4eaf',
        hasCreatorArg: false,
        label: 'Set Coin Creator (PumpSwap)',
        programId: PUMP_AMM_PROGRAM_ID,
    },
    {
        changeType: 'migrate_pool_coin_creator',
        discriminator: 'd0089f044aaf103a',
        hasCreatorArg: false,
        label: 'Migrate Pool Coin Creator (PumpSwap)',
        programId: PUMP_AMM_PROGRAM_ID,
    },
];

export const CLAIM_EVENT_DISCRIMINATORS: Record<string, { label: string; isCreatorClaim: boolean }> = {
    '7a027f010ebf0caf': { isCreatorClaim: true, label: 'CollectCreatorFeeEvent' },
    'a537817004b3ca28': { isCreatorClaim: true, label: 'DistributeCreatorFeesEvent' },
    'e2d6f62107f293e5': { isCreatorClaim: false, label: 'ClaimCashbackEvent' },
    'e8f5c2eeeada3a59': { isCreatorClaim: true, label: 'CollectCoinCreatorFeeEvent' },
};

// ============================================================================
// Fee Claim Event
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
    githubUserId?: string;
    socialPlatform?: number;
    recipientWallet?: string;
    socialFeePda?: string;
}

// ============================================================================
// Creator Change Event (CTO)
// ============================================================================

export interface CreatorChangeEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    signerWallet: string;
    newCreatorWallet: string;
    tokenMint: string;
    tokenSymbol?: string;
    tokenName?: string;
    changeType: CreatorChangeType;
    programId: string;
    changeLabel: string;
}

// ============================================================================
// Watch Entry
// ============================================================================

export interface WatchEntry {
    id: string;
    chatId: number;
    addedBy: number;
    recipientWallet: string;
    label?: string;
    tokenFilter?: string[];
    active: boolean;
    createdAt: number;
}

// ============================================================================
// Bot Config
// ============================================================================

export interface BotConfig {
    telegramToken: string;
    solanaRpcUrl: string;
    solanaRpcUrls: string[];
    solanaWsUrl?: string;
    pollIntervalSeconds: number;
    allowedUserIds: number[];
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableLaunchMonitor: boolean;
    githubOnlyFilter: boolean;
    ipfsGateway: string;
    enableGraduationAlerts: boolean;
    enableTradeAlerts: boolean;
    whaleThresholdSol: number;
    enableFeeDistributionAlerts: boolean;
}

// ============================================================================
// Monitor State
// ============================================================================

export interface MonitorState {
    isRunning: boolean;
    mode: 'websocket' | 'polling';
    lastSlot: number;
    claimsDetected: number;
    creatorFeeClaims: number;
    cashbackClaims: number;
    creatorChanges: number;
    startedAt: number;
    monitoredPrograms: string[];
}

// ============================================================================
// Token Launch Event
// ============================================================================

export interface TokenLaunchEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    mintAddress: string;
    creatorWallet: string;
    name: string;
    symbol: string;
    description: string;
    metadataUri: string;
    hasGithub: boolean;
    githubUrls: string[];
    mayhemMode: boolean;
    cashbackEnabled: boolean;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Token Launch Monitor State
// ============================================================================

export interface TokenLaunchMonitorState {
    isRunning: boolean;
    mode: 'websocket' | 'polling';
    tokensDetected: number;
    tokensWithGithub: number;
    lastSlot: number;
    startedAt: number;
    githubOnly: boolean;
    errorsEncountered: number;
}

// ============================================================================
// Graduation Event
// ============================================================================

export interface GraduationEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    mintAddress: string;
    user: string;
    bondingCurve: string;
    isMigration: boolean;
    solAmount?: number;
    mintAmount?: number;
    poolMigrationFee?: number;
    poolAddress?: string;
}

// ============================================================================
// Trade Alert Event
// ============================================================================

export interface TradeAlertEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    mintAddress: string;
    user: string;
    creator: string;
    isBuy: boolean;
    solAmount: number;
    tokenAmount: number;
    fee: number;
    creatorFee: number;
    virtualSolReserves: number;
    virtualTokenReserves: number;
    realSolReserves: number;
    realTokenReserves: number;
    mayhemMode: boolean;
    marketCapSol: number;
    bondingCurveProgress: number;
}

// ============================================================================
// Fee Distribution Event
// ============================================================================

export interface FeeDistributionEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    mintAddress: string;
    bondingCurve: string;
    admin: string;
    distributedSol: number;
    shareholders: Array<{ address: string; shareBps: number }>;
}

// ============================================================================
// Pump Event Monitor State
// ============================================================================

export interface PumpEventMonitorState {
    isRunning: boolean;
    mode: 'websocket' | 'polling';
    graduationsDetected: number;
    tradesDetected: number;
    whaleTradesDetected: number;
    feeDistributionsDetected: number;
    lastSlot: number;
    startedAt: number;
    errorsEncountered: number;
}
