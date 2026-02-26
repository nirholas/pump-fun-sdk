/**
 * PumpFun Telegram Bot — Configuration
 *
 * Loads and validates environment variables.
 */

import 'dotenv/config';

import type { BotConfig } from './types.js';

export function loadConfig(): BotConfig {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
        throw new Error(
            'TELEGRAM_BOT_TOKEN is required. Create a bot via @BotFather and set the env var.',
        );
    }

    const solanaRpcUrl =
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    // Derive WebSocket URL from RPC if not explicitly set
    let solanaWsUrl = process.env.SOLANA_WS_URL;
    if (!solanaWsUrl) {
        try {
            const url = new URL(solanaRpcUrl);
            url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            solanaWsUrl = url.toString();
        } catch {
            // If URL parsing fails, leave it undefined — monitor will use polling
        }
    }

    const pollIntervalSeconds = Number.parseInt(
        process.env.POLL_INTERVAL_SECONDS || '15',
        10,
    );

    const allowedUserIds = process.env.ALLOWED_USER_IDS
        ? process.env.ALLOWED_USER_IDS.split(',')
            .map((id) => Number.parseInt(id.trim(), 10))
            .filter((id) => !Number.isNaN(id))
        : [];

    const logLevel = (process.env.LOG_LEVEL || 'info') as BotConfig['logLevel'];

    return {
        allowedUserIds,
        logLevel,
        pollIntervalSeconds,
        solanaRpcUrl,
        solanaWsUrl,
        telegramToken,
    };
}
