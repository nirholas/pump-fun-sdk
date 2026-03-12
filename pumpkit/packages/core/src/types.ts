/**
 * @pumpkit/core — Common Types
 *
 * Shared type definitions used across PumpKit packages.
 */

/** Base bot configuration all PumpKit bots share */
export interface BaseBotConfig {
    /** Telegram Bot API token from @BotFather */
    telegramBotToken: string;
    /** Solana RPC URL */
    solanaRpcUrl: string;
    /** Log verbosity level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** Graceful shutdown handler signature */
export type ShutdownHandler = () => Promise<void> | void;

/** Generic event emitted by Pump protocol */
export interface PumpEvent {
    /** Transaction signature */
    signature: string;
    /** Solana slot number */
    slot: number;
    /** Block timestamp (unix seconds) */
    blockTime: number | null;
    /** Event type discriminator */
    type: string;
}

/** Token metadata as returned by pump.fun API */
export interface TokenInfo {
    mint: string;
    name: string;
    symbol: string;
    uri: string;
    creator: string;
    complete: boolean;
}
