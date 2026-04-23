/**
 * PumpFun Telegram Bot — Types & Constants
 */

// ── Program IDs ──────────────────────────────────────────────────────────────

export const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const PUMP_FEE_PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';
export const PUMPFUN_FEE_ACCOUNT = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJ5GEFDM97zC';
export const PUMPFUN_MIGRATION_AUTHORITY = '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg';

export const MONITORED_PROGRAM_IDS: string[] = [
    PUMP_PROGRAM_ID,
    PUMP_AMM_PROGRAM_ID,
    PUMP_FEE_PROGRAM_ID,
];

// ── Instruction Discriminators ───────────────────────────────────────────────

export const CREATE_V2_DISCRIMINATOR = 'd6904cec5f8b31b4';
export const CREATE_DISCRIMINATOR = '181ec828051c0777';

// ── Event Discriminators ─────────────────────────────────────────────────────

export const COMPLETE_EVENT_DISCRIMINATOR = '5f72619cd42e9808';
export const COMPLETE_AMM_MIGRATION_DISCRIMINATOR = 'bde95db95c94ea94';
export const TRADE_EVENT_DISCRIMINATOR = 'bddb7fd34ee661ee';
export const DISTRIBUTE_FEES_EVENT_DISCRIMINATOR = 'a537817004b3ca28';

// ── Claim Event Discriminator Map ────────────────────────────────────────────

export const CLAIM_EVENT_DISCRIMINATORS: Record<string, { label: string; isCreatorClaim: boolean }> = {
    '7a027f010ebf0caf': { isCreatorClaim: true, label: 'CollectCreatorFeeEvent' },
    'a537817004b3ca28': { isCreatorClaim: true, label: 'DistributeCreatorFeesEvent' },
    'e2d6f62107f293e5': { isCreatorClaim: false, label: 'ClaimCashbackEvent' },
    'e8f5c2eeeada3a59': { isCreatorClaim: true, label: 'CollectCoinCreatorFeeEvent' },
    '3212c141edd2eaec': { isCreatorClaim: true, label: 'SocialFeePdaClaimed' },
};

// ── Thresholds ───────────────────────────────────────────────────────────────

export const DEFAULT_GRADUATION_SOL_THRESHOLD = 85;
export const DEFAULT_TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000;

// ── Claim Instruction Types ──────────────────────────────────────────────────

export type ClaimType =
    | 'collect_creator_fee'
    | 'claim_cashback'
    | 'claim_social_fee_pda'
    | 'collect_coin_creator_fee'
    | 'distribute_creator_fees'
    | 'transfer_creator_fees_to_pump';

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
    { claimType: 'claim_social_fee_pda', discriminator: 'e115fb85a11ec7e2', isCreatorClaim: true, label: 'Claim Social Fee PDA (GitHub)', programId: PUMP_FEE_PROGRAM_ID },
];

// ── CTO Instruction Types ────────────────────────────────────────────────────

export type CreatorChangeType =
    | 'set_creator'
    | 'admin_set_creator'
    | 'set_coin_creator'
    | 'admin_set_coin_creator'
    | 'migrate_pool_coin_creator';

export interface CreatorChangeInstructionDef {
    discriminator: string;
    label: string;
    changeType: CreatorChangeType;
    programId: string;
    hasCreatorArg: boolean;
}

export const CTO_INSTRUCTIONS: CreatorChangeInstructionDef[] = [
    { changeType: 'admin_set_creator', discriminator: '4519ab8e39ef0d04', hasCreatorArg: true, label: 'Admin Set Creator (Pump)', programId: PUMP_PROGRAM_ID },
    { changeType: 'set_creator', discriminator: 'fe94ff70cf8eaaa5', hasCreatorArg: true, label: 'Set Creator (Pump)', programId: PUMP_PROGRAM_ID },
    { changeType: 'admin_set_coin_creator', discriminator: 'f228759149606968', hasCreatorArg: true, label: 'Admin Set Coin Creator (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
    { changeType: 'set_coin_creator', discriminator: 'd295802dbc3a4eaf', hasCreatorArg: false, label: 'Set Coin Creator (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
    { changeType: 'migrate_pool_coin_creator', discriminator: 'd0089f044aaf103a', hasCreatorArg: false, label: 'Migrate Pool Coin Creator (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
];

// ── Bot Config ───────────────────────────────────────────────────────────────

export interface BotConfig {
    allowedUserIds: number[];
    enableFeeDistributionAlerts: boolean;
    enableGraduationAlerts: boolean;
    enableLaunchMonitor: boolean;
    enableTradeAlerts: boolean;
    githubOnlyFilter: boolean;
    ipfsGateway: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    pollIntervalSeconds: number;
    solanaRpcUrl: string;
    solanaRpcUrls: string[];
    solanaWsUrl: string | undefined;
    telegramToken: string;
    whaleThresholdSol: number;
}

// ── Watch Entry ──────────────────────────────────────────────────────────────

export interface WatchEntry {
    id: string;
    active: boolean;
    addedBy: number;
    chatId: number;
    createdAt: number;
    label?: string;
    recipientWallet: string;
    /** Optional token mint filter — only notify for these mints */
    tokenFilter?: string[];
}

// ── Fee Claim Event ──────────────────────────────────────────────────────────

export interface FeeClaimEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    claimerWallet: string;
    tokenMint: string;
    amountSol: number;
    amountLamports: number;
    claimType: ClaimType;
    isCashback: boolean;
    programId: string;
    claimLabel: string;
    /** Enriched after fetch */
    tokenName?: string;
    tokenSymbol?: string;
    socialFeePda?: string;
}

// ── Creator Change (CTO) Event ───────────────────────────────────────────────

export interface CreatorChangeEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    signerWallet: string;
    newCreatorWallet?: string;
    tokenMint?: string;
    tokenSymbol?: string;
    tokenName?: string;
    changeLabel: string;
    changeType: CreatorChangeType;
    programId: string;
}

// ── Token Launch Event ───────────────────────────────────────────────────────

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, unknown>;
}

// ── Graduation Event ─────────────────────────────────────────────────────────

export interface GraduationEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    mintAddress: string;
    user: string;
    isMigration: boolean;
    bondingCurve?: string;
    solAmount?: number;
    mintAmount?: number;
    poolMigrationFee?: number;
    poolAddress?: string;
}

// ── Whale Trade Alert Event ──────────────────────────────────────────────────

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
    marketCapSol: number;
    bondingCurveProgress: number;
    fee: number;
    creatorFee: number;
    mayhemMode: boolean;
    realSolReserves: number;
    realTokenReserves: number;
    virtualSolReserves: number;
    virtualTokenReserves: number;
}

// ── Fee Distribution Event ───────────────────────────────────────────────────

export interface FeeDistributionEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    mintAddress: string;
    admin: string;
    bondingCurve?: string;
    distributedSol: number;
    shareholders: Array<{ address: string; shareBps: number }>;
}

// ── Monitor State ────────────────────────────────────────────────────────────

export interface MonitorState {
    isRunning: boolean;
    mode: 'websocket' | 'polling' | 'idle';
    monitoredPrograms: string[];
    claimsDetected: number;
    creatorFeeClaims: number;
    cashbackClaims: number;
    creatorChanges: number;
    lastSlot?: number;
    startedAt?: number;
}

export interface TokenLaunchMonitorState {
    isRunning: boolean;
    mode: 'websocket' | 'polling' | 'idle';
    tokensDetected: number;
    tokensWithGithub: number;
    githubOnly: boolean;
    errorsEncountered: number;
    lastSlot?: number;
    startedAt?: number;
}

export interface PumpEventMonitorState {
    isRunning: boolean;
    mode: 'websocket' | 'polling' | 'idle';
    graduationsDetected: number;
    whaleTradesDetected: number;
    tradesDetected: number;
    feeDistributionsDetected: number;
    errorsEncountered: number;
    lastSlot?: number;
    startedAt?: number;
}
