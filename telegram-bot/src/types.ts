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
    | 'collect_creator_fee'        // Pump: creator collects from creator_vault (native SOL)
    | 'claim_cashback'             // Pump + AMM: user claims cashback
    | 'collect_coin_creator_fee'   // AMM: creator collects WSOL from vault ATA
    | 'distribute_creator_fees'    // Pump: distribute fees to creator
    | 'transfer_creator_fees_to_pump'; // AMM: transfer fees to Pump program

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

/**
 * All claim/collect instructions we monitor across Pump and PumpSwap programs.
 * Discriminators extracted from official IDL files at:
 * vendor/pump-public-docs/idl/pump.json and pump_amm.json
 */
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
    | 'set_creator'                  // Pump: set creator from metadata
    | 'admin_set_creator'            // Pump: admin override creator
    | 'set_coin_creator'             // AMM: set coin creator from metadata/bonding curve
    | 'admin_set_coin_creator'       // AMM: admin override coin creator
    | 'migrate_pool_coin_creator';   // AMM: migrate pool coin creator to sharing config

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

/**
 * All set_creator / admin_set_creator instructions across Pump and PumpSwap.
 * These change who receives future creator fees for a token (CTO).
 * Discriminators extracted from official IDL files.
 */
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

/**
 * Event discriminators emitted by Anchor CPI self-invoke (logged in program data).
 * These can be used to detect claims from transaction logs.
 */
export const CLAIM_EVENT_DISCRIMINATORS: Record<string, { label: string; isCreatorClaim: boolean }> = {
    '7a027f010ebf0caf': { isCreatorClaim: true, label: 'CollectCreatorFeeEvent' },
    'a537817004b3ca28': { isCreatorClaim: true, label: 'DistributeCreatorFeesEvent' },
    'e2d6f62107f293e5': { isCreatorClaim: false, label: 'ClaimCashbackEvent' },
    'e8f5c2eeeada3a59': { isCreatorClaim: true, label: 'CollectCoinCreatorFeeEvent' },
};

// ============================================================================
// Fee Claim Event
// ============================================================================

/** Represents a detected PumpFun creator fee or cashback claim event */
export interface FeeClaimEvent {
    /** Transaction signature on Solana */
    txSignature: string;
    /** Solana slot number */
    slot: number;
    /** Block timestamp (unix seconds) */
    timestamp: number;
    /** The wallet that claimed the fees */
    claimerWallet: string;
    /** The token mint address the fees were generated from (if identifiable) */
    tokenMint: string;
    /** Token name (resolved if possible) */
    tokenName?: string;
    /** Token symbol/ticker (resolved if possible) */
    tokenSymbol?: string;
    /** Amount claimed in SOL (or WSOL equivalent) */
    amountSol: number;
    /** Amount claimed in lamports */
    amountLamports: number;
    /** Specific claim type detected */
    claimType: ClaimType;
    /** Whether this is a cashback claim (vs creator fee claim) */
    isCashback: boolean;
    /** Which program processed this claim */
    programId: string;
    /** Human-readable label for the claim type */
    claimLabel: string;
}

// ============================================================================
// Creator Change Event (CTO)
// ============================================================================

/** Represents a detected creator takeover / fee redirection event */
export interface CreatorChangeEvent {
    /** Transaction signature on Solana */
    txSignature: string;
    /** Solana slot number */
    slot: number;
    /** Block timestamp (unix seconds) */
    timestamp: number;
    /** The wallet that signed/initiated the creator change (authority) */
    signerWallet: string;
    /** The new creator wallet (fees will go here) — may be empty if derived from metadata */
    newCreatorWallet: string;
    /** The token mint address affected */
    tokenMint: string;
    /** Specific creator change type detected */
    changeType: CreatorChangeType;
    /** Which program processed this change */
    programId: string;
    /** Human-readable label for the change type */
    changeLabel: string;
}

// ============================================================================
// Watch Entry
// ============================================================================

/** A single watch configuration — monitors a specific fee recipient */
export interface WatchEntry {
    /** Unique ID for this watch */
    id: string;
    /** Telegram chat ID to notify (user or group) */
    chatId: number;
    /** Who added this watch */
    addedBy: number;
    /** The fee-recipient wallet to monitor */
    recipientWallet: string;
    /** Optional label/nickname for display */
    label?: string;
    /** Optional filter: only notify for these token mints */
    tokenFilter?: string[];
    /** Whether this watch is active */
    active: boolean;
    /** When this watch was created (unix ms) */
    createdAt: number;
}

// ============================================================================
// Bot Config
// ============================================================================

export interface BotConfig {
    /** Telegram Bot API token */
    telegramToken: string;
    /** Solana RPC HTTP URL */
    solanaRpcUrl: string;
    /** Solana WebSocket URL (optional) */
    solanaWsUrl?: string;
    /** Polling interval in seconds (fallback when WS unavailable) */
    pollIntervalSeconds: number;
    /** Allowed Telegram user IDs (empty = allow all) */
    allowedUserIds: number[];
    /** Log level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** Whether to enable the token launch monitor */
    enableLaunchMonitor: boolean;
    /** Only notify for tokens with GitHub links (default: false = notify all) */
    githubOnlyFilter: boolean;
    /** IPFS gateway base URL for metadata fetching */
    ipfsGateway: string;
    /** Enable graduation/migration alerts (default: true) */
    enableGraduationAlerts: boolean;
    /** Enable whale trade alerts (default: false) */
    enableTradeAlerts: boolean;
    /** Minimum SOL amount for a trade to trigger a whale alert (default: 10) */
    whaleThresholdSol: number;
    /** Enable creator fee distribution alerts (default: false) */
    enableFeeDistributionAlerts: boolean;
}

// ============================================================================
// Monitor State
// ============================================================================

export interface MonitorState {
    /** Whether the monitor is currently running */
    isRunning: boolean;
    /** Connection mode */
    mode: 'websocket' | 'polling';
    /** Last processed slot */
    lastSlot: number;
    /** Total claims detected since start */
    claimsDetected: number;
    /** Breakdown: creator fee claims detected */
    creatorFeeClaims: number;
    /** Breakdown: cashback claims detected */
    cashbackClaims: number;
    /** Breakdown: creator change (CTO) events detected */
    creatorChanges: number;
    /** Uptime start (unix ms) */
    startedAt: number;
    /** Programs being monitored */
    monitoredPrograms: string[];
}

// ============================================================================
// Token Launch Event
// ============================================================================

/** Represents a detected PumpFun new token creation event */
export interface TokenLaunchEvent {
    /** Transaction signature */
    txSignature: string;
    /** Solana slot */
    slot: number;
    /** Block timestamp (unix seconds) */
    timestamp: number;
    /** The new token's mint address */
    mintAddress: string;
    /** Token creator wallet */
    creatorWallet: string;
    /** Token name (from tx data or metadata) */
    name: string;
    /** Token symbol/ticker */
    symbol: string;
    /** Token description (from metadata) */
    description: string;
    /** Metadata URI */
    metadataUri: string;
    /** Whether this token has a GitHub link */
    hasGithub: boolean;
    /** Extracted GitHub URL(s) */
    githubUrls: string[];
    /** Whether mayhem mode is enabled */
    mayhemMode: boolean;
    /** Whether cashback is enabled for this token */
    cashbackEnabled: boolean;
    /** Full metadata JSON (if fetched successfully) */
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Token Launch Monitor State
// ============================================================================

export interface TokenLaunchMonitorState {
    /** Whether the monitor is currently running */
    isRunning: boolean;
    /** Connection mode */
    mode: 'websocket' | 'polling';
    /** Total tokens detected since start */
    tokensDetected: number;
    /** Tokens with GitHub links detected */
    tokensWithGithub: number;
    /** Last processed slot */
    lastSlot: number;
    /** Uptime start (unix ms) */
    startedAt: number;
    /** Whether to only notify for GitHub-linked tokens */
    githubOnly: boolean;
    /** Total errors encountered (metadata fetches, tx parsing, etc.) */
    errorsEncountered: number;
}

// ============================================================================
// Graduation Event
// ============================================================================

/** Emitted when a token's bonding curve completes and/or migrates to PumpSwap AMM */
export interface GraduationEvent {
    /** Transaction signature */
    txSignature: string;
    /** Solana slot */
    slot: number;
    /** Block timestamp (unix seconds) */
    timestamp: number;
    /** The graduated token's mint address */
    mintAddress: string;
    /** User who triggered graduation */
    user: string;
    /** Bonding curve account */
    bondingCurve: string;
    /** true if CompletePumpAmmMigrationEvent, false if just CompleteEvent */
    isMigration: boolean;
    /** SOL amount migrated to AMM pool (migration only) */
    solAmount?: number;
    /** Token amount migrated (migration only) */
    mintAmount?: number;
    /** Migration fee paid in SOL (migration only) */
    poolMigrationFee?: number;
    /** PumpSwap AMM pool address (migration only) */
    poolAddress?: string;
}

// ============================================================================
// Trade Alert Event
// ============================================================================

/** Emitted for significant trades (whale alerts) on the bonding curve */
export interface TradeAlertEvent {
    /** Transaction signature */
    txSignature: string;
    /** Solana slot */
    slot: number;
    /** Block timestamp (unix seconds) */
    timestamp: number;
    /** Token mint address */
    mintAddress: string;
    /** Trader wallet */
    user: string;
    /** Token creator wallet */
    creator: string;
    /** true=buy, false=sell */
    isBuy: boolean;
    /** Trade amount in SOL */
    solAmount: number;
    /** Trade amount in tokens (raw lamport units) */
    tokenAmount: number;
    /** Platform fee in SOL */
    fee: number;
    /** Creator fee in SOL */
    creatorFee: number;
    /** Virtual SOL reserves (for price calculation) */
    virtualSolReserves: number;
    /** Virtual token reserves (for price calculation) */
    virtualTokenReserves: number;
    /** Real SOL reserves (for graduation progress) */
    realSolReserves: number;
    /** Real token reserves */
    realTokenReserves: number;
    /** Whether mayhem mode was active */
    mayhemMode: boolean;
    /** Approximate market cap in SOL */
    marketCapSol: number;
    /** Bonding curve progress toward graduation (0-100) */
    bondingCurveProgress: number;
}

// ============================================================================
// Fee Distribution Event
// ============================================================================

/** Emitted when creator fees are distributed among shareholders */
export interface FeeDistributionEvent {
    /** Transaction signature */
    txSignature: string;
    /** Solana slot */
    slot: number;
    /** Block timestamp (unix seconds) */
    timestamp: number;
    /** Token mint address */
    mintAddress: string;
    /** Bonding curve account */
    bondingCurve: string;
    /** Admin who triggered distribution */
    admin: string;
    /** Total SOL distributed */
    distributedSol: number;
    /** Distribution recipients and their shares */
    shareholders: Array<{ address: string; shareBps: number }>;
}

// ============================================================================
// Pump Event Monitor State
// ============================================================================

export interface PumpEventMonitorState {
    /** Whether the monitor is currently running */
    isRunning: boolean;
    /** Connection mode */
    mode: 'websocket' | 'polling';
    /** Graduation events detected */
    graduationsDetected: number;
    /** All trades detected (above threshold) */
    tradesDetected: number;
    /** Whale trades detected (above whale threshold) */
    whaleTradesDetected: number;
    /** Fee distribution events detected */
    feeDistributionsDetected: number;
    /** Last processed slot */
    lastSlot: number;
    /** Uptime start (unix ms) */
    startedAt: number;
    /** Total errors encountered */
    errorsEncountered: number;
}
