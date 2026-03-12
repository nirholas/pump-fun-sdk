/**
 * @pumpkit/core — Shared Logger
 *
 * Leveled logger wrapping console with ISO timestamps.
 * Used by all PumpKit bots.
 */

import { format } from 'node:util';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
    currentLevel = level;
}

export function getLogLevel(): LogLevel {
    return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[currentLevel];
}

function stamp(): string {
    return new Date().toISOString();
}

export const log = {
    debug: (msg: string, ...args: unknown[]) => {
        if (shouldLog('debug')) console.debug(`[${stamp()}] [DEBUG] ${format(msg, ...args)}`);
    },
    info: (msg: string, ...args: unknown[]) => {
        if (shouldLog('info')) console.info(`[${stamp()}] [INFO] ${format(msg, ...args)}`);
    },
    warn: (msg: string, ...args: unknown[]) => {
        if (shouldLog('warn')) console.warn(`[${stamp()}] [WARN] ${format(msg, ...args)}`);
    },
    error: (msg: string, ...args: unknown[]) => {
        if (shouldLog('error')) console.error(`[${stamp()}] [ERROR] ${format(msg, ...args)}`);
    },
};
