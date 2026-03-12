/**
 * @pumpkit/core — Barrel Export
 *
 * Re-exports all shared utilities for convenience.
 */

export { log, setLogLevel, getLogLevel, type LogLevel } from './logger.js';
export { startHealthServer, stopHealthServer, type HealthStats } from './health.js';
export { requireEnv, optionalEnv, parseListEnv, parseIntEnv } from './config.js';
export { onShutdown, installShutdownHandlers } from './shutdown.js';
export { createBot, broadcast, type BotOptions, type CommandHandler } from './bot/index.js';
export type { BaseBotConfig, ShutdownHandler, PumpEvent, TokenInfo } from './types.js';

// Formatter — link helpers + notification templates
export {
    link, solscanTx, solscanAccount, pumpFunToken, dexScreenerToken,
    bold, code, italic, shortenAddress, formatSol, formatNumber,
    formatClaim, formatLaunch, formatGraduation, formatWhaleTrade, formatCTO, formatFeeDistribution,
} from './formatter/index.js';
export type {
    ClaimEventData, LaunchEventData, GraduationEventData,
    WhaleTradeEventData, CTOEventData, FeeDistEventData,
} from './formatter/index.js';

// Solana — program IDs, RPC fallback, SDK bridge
export {
    PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID,
    PUMPFUN_FEE_ACCOUNT, PUMPFUN_MIGRATION_AUTHORITY, WSOL_MINT,
    MONITORED_PROGRAM_IDS,
    CREATE_V2_DISCRIMINATOR, CREATE_DISCRIMINATOR,
    COMPLETE_EVENT_DISCRIMINATOR, TRADE_EVENT_DISCRIMINATOR,
} from './solana/programs.js';
export {
    createRpcConnection, deriveWsUrl, RpcFallback, type RpcOptions,
} from './solana/rpc.js';
export {
    getTokenPrice, getGraduationProgress,
    getBuyQuote, getSellQuote, getBondingCurveState,
} from './solana/sdk-bridge.js';
export type { BondingCurveInfo } from './solana/sdk-bridge.js';

// Event types
export type {
    ClaimEvent, LaunchEvent, GraduationEvent,
    WhaleTradeEvent, CTOEvent, FeeDistEvent,
    PumpEventUnion, PumpEventType,
} from './types/events.js';

// Storage
export type { Store } from './storage/types.js';
export { FileStore } from './storage/FileStore.js';
export { SqliteStore } from './storage/SqliteStore.js';

// Monitors
export {
    BaseMonitor, type MonitorStatus,
    ClaimMonitor, type ClaimMonitorOptions,
    LaunchMonitor, type LaunchMonitorOptions,
    GraduationMonitor, type GraduationMonitorOptions,
    WhaleMonitor, type WhaleMonitorOptions,
    CTOMonitor, type CTOMonitorOptions,
    FeeDistMonitor, type FeeDistMonitorOptions,
} from './monitor/index.js';
