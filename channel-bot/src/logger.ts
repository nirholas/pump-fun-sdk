/**
 * PumpFun Channel Bot — Logger
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: Level = 'info';

export function setLogLevel(level: Level): void {
    currentLevel = level;
}

function shouldLog(level: Level): boolean {
    return LEVELS[level] >= LEVELS[currentLevel];
}

function stamp(): string {
    return new Date().toISOString();
}

export const log = {
    debug: (msg: string, ...args: unknown[]) => {
        if (shouldLog('debug')) console.debug(`[${stamp()}] [DEBUG]`, msg, ...args);
    },
    info: (msg: string, ...args: unknown[]) => {
        if (shouldLog('info')) console.info(`[${stamp()}] [INFO]`, msg, ...args);
    },
    warn: (msg: string, ...args: unknown[]) => {
        if (shouldLog('warn')) console.warn(`[${stamp()}] [WARN]`, msg, ...args);
    },
    error: (msg: string, ...args: unknown[]) => {
        if (shouldLog('error')) console.error(`[${stamp()}] [ERROR]`, msg, ...args);
    },
};
