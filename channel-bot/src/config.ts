/**
 * PumpFun Channel Bot — Configuration
 *
 * Loads and validates environment variables for the read-only channel feed.
 */

import 'dotenv/config';

export interface ChannelBotConfig {
    /** Telegram Bot API token (separate bot from @pfclaimsbot) */
    telegramToken: string;
    /** Channel ID to post to (@channelname or -100xxx) */
    channelId: string;
    /** Solana RPC HTTP URL */
    solanaRpcUrl: string;
    /** Solana WebSocket URL (optional) */
    solanaWsUrl?: string;
    /** Polling interval in seconds */
    pollIntervalSeconds: number;
    /** Log level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** Feed toggles */
    feed: {
        claims: boolean;
        launches: boolean;
        graduations: boolean;
        whales: boolean;
        feeDistributions: boolean;
    };
    /** Minimum SOL for whale alerts */
    whaleThresholdSol: number;
}

export function loadConfig(): ChannelBotConfig {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
        throw new Error(
            'TELEGRAM_BOT_TOKEN is required. Create a bot via @BotFather and set the env var.',
        );
    }

    const channelId = process.env.CHANNEL_ID;
    if (!channelId) {
        throw new Error(
            'CHANNEL_ID is required. Set it to @your_channel_name or the numeric chat ID.',
        );
    }

    const solanaRpcUrl =
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    let solanaWsUrl = process.env.SOLANA_WS_URL;
    if (!solanaWsUrl) {
        try {
            const url = new URL(solanaRpcUrl);
            url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            solanaWsUrl = url.toString();
        } catch {
            // leave undefined — monitor will use polling
        }
    }

    const pollIntervalSeconds = Number.parseInt(
        process.env.POLL_INTERVAL_SECONDS || '30',
        10,
    );

    const logLevel = (process.env.LOG_LEVEL || 'info') as ChannelBotConfig['logLevel'];

    const feed = {
        claims: (process.env.FEED_CLAIMS || 'true').toLowerCase() === 'true',
        feeDistributions: (process.env.FEED_FEE_DISTRIBUTIONS || 'true').toLowerCase() === 'true',
        graduations: (process.env.FEED_GRADUATIONS || 'true').toLowerCase() === 'true',
        launches: (process.env.FEED_LAUNCHES || 'true').toLowerCase() === 'true',
        whales: (process.env.FEED_WHALES || 'true').toLowerCase() === 'true',
    };

    const whaleThresholdSol = Number.parseFloat(
        process.env.WHALE_THRESHOLD_SOL || '10',
    );

    return {
        channelId,
        feed,
        logLevel,
        pollIntervalSeconds,
        solanaRpcUrl,
        solanaWsUrl,
        telegramToken,
        whaleThresholdSol,
    };
}
