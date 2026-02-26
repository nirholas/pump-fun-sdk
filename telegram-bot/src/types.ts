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
    /** Uptime start (unix ms) */
    startedAt: number;
    /** Programs being monitored */
    monitoredPrograms: string[];
}
