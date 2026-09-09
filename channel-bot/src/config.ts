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
    /** Solana RPC HTTP URL (primary) */
    solanaRpcUrl: string;
    /** All Solana RPC HTTP URLs for fallback (primary + backups) */
    solanaRpcUrls: string[];
    /** Solana WebSocket URL (optional). First entry of solanaWsUrls. */
    solanaWsUrl?: string;
    /**
     * Every WebSocket URL the monitor may subscribe through, in preference
     * order. One endpoint is not enough: when magicblock went key-gated on
     * 2026-09-09 it answered 401 forever, and the sibling all-claims feed sat
     * silent on it for four days because it had nowhere else to go.
     */
    solanaWsUrls: string[];
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
    /** Only post claims for tokens that have GitHub URLs in their description */
    requireGithub: boolean;
    /** Minimum SOL for whale alerts */
    whaleThresholdSol: number;
    /** Affiliate ref codes for trading links */
    affiliates: {
        axiom: string;
        gmgn: string;
        padre: string;
        fomo: string;
    };
    /** Telegram user IDs allowed to run admin commands (empty = disabled) */
    adminUserIds: number[];
    /** Webhook endpoints that receive every feed event as a signed JSON POST */
    webhookUrls: string[];
    /** HMAC-SHA256 secret for webhook signatures (optional) */
    webhookSecret?: string;
    /** Follow-up performance updates on posted calls */
    performance: {
        enabled: boolean;
        windowHours: number;
        milestones: number[];
        collapsePct: number;
    };
}

/** Convert an http(s) RPC URL to its ws(s) equivalent, or null if it is not a URL. */
function toWsUrl(httpUrl: string): string | null {
    try {
        const url = new URL(httpUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return url.toString();
    } catch {
        return null;
    }
}

/**
 * Build the WebSocket preference list.
 *
 * SOLANA_WS_URLS (comma-separated) wins, then SOLANA_WS_URL, and whatever the
 * RPC endpoints imply is always appended so a single explicit endpoint going
 * dark still has somewhere to fail over to. Order is preserved and duplicates
 * are dropped.
 */
export function resolveWsUrls(rpcUrls: string[]): string[] {
    const explicit = [
        ...(process.env.SOLANA_WS_URLS ?? '').split(','),
        process.env.SOLANA_WS_URL ?? '',
    ]
        .map((s) => s.trim())
        .filter(Boolean);

    const derived = rpcUrls.map(toWsUrl).filter((u): u is string => u !== null);

    const out: string[] = [];
    for (const url of [...explicit, ...derived]) {
        if (!/^wss?:\/\//i.test(url)) continue;
        if (!out.includes(url)) out.push(url);
    }
    return out;
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

    // Validate primary RPC URL
    try { new URL(solanaRpcUrl); } catch {
        throw new Error(`Invalid SOLANA_RPC_URL: ${solanaRpcUrl}`);
    }

    // Support comma-separated fallback RPC URLs — always include primary first
    const extraUrls = process.env.SOLANA_RPC_URLS
        ? process.env.SOLANA_RPC_URLS.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const solanaRpcUrls = [solanaRpcUrl, ...extraUrls.filter((u) => u !== solanaRpcUrl)];

    const solanaWsUrls = resolveWsUrls(solanaRpcUrls);
    const solanaWsUrl = solanaWsUrls[0];

    const pollIntervalSeconds = Number.parseInt(
        process.env.POLL_INTERVAL_SECONDS || '30',
        10,
    );

    const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
    const rawLogLevel = process.env.LOG_LEVEL || 'info';
    const logLevel: ChannelBotConfig['logLevel'] = VALID_LOG_LEVELS.includes(rawLogLevel as typeof VALID_LOG_LEVELS[number])
        ? (rawLogLevel as ChannelBotConfig['logLevel'])
        : 'info';

    const feed = {
        claims: (process.env.FEED_CLAIMS || 'true').toLowerCase() === 'true',
        feeDistributions: (process.env.FEED_FEE_DISTRIBUTIONS || 'false').toLowerCase() === 'true',
        graduations: (process.env.FEED_GRADUATIONS || 'false').toLowerCase() === 'true',
        launches: (process.env.FEED_LAUNCHES || 'false').toLowerCase() === 'true',
        whales: (process.env.FEED_WHALES || 'false').toLowerCase() === 'true',
    };

    const requireGithub = (process.env.REQUIRE_GITHUB || 'true').toLowerCase() === 'true';

    const whaleThresholdSol = Number.parseFloat(
        process.env.WHALE_THRESHOLD_SOL || '10',
    );

    const affiliates = {
        axiom: process.env.AXIOM_REF ?? 'nich',
        gmgn:  process.env.GMGN_REF  ?? 'nichxbt',
        padre: process.env.PADRE_REF  ?? 'nichxbt',
        fomo:  process.env.FOMO_REF  ?? 'nichxbt',
    };

    const adminUserIds = (process.env.ADMIN_USER_IDS ?? '')
        .split(',')
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);

    const webhookUrls = (process.env.WEBHOOK_URLS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => {
            if (!s) return false;
            try { new URL(s); return true; } catch { return false; }
        });

    const milestones = (process.env.PERFORMANCE_MILESTONES ?? '2,5,10,25,50,100')
        .split(',')
        .map((s) => Number.parseFloat(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 1)
        .sort((a, b) => a - b);

    const performance = {
        collapsePct: Number.parseFloat(process.env.PERFORMANCE_COLLAPSE_PCT || '80'),
        enabled: (process.env.PERFORMANCE_UPDATES || 'true').toLowerCase() === 'true',
        milestones: milestones.length > 0 ? milestones : [2, 5, 10, 25, 50, 100],
        windowHours: Number.parseFloat(process.env.PERFORMANCE_WINDOW_HOURS || '24'),
    };

    return {
        adminUserIds,
        affiliates,
        channelId,
        performance,
        feed,
        logLevel,
        pollIntervalSeconds,
        requireGithub,
        solanaRpcUrl,
        solanaRpcUrls,
        solanaWsUrl,
        solanaWsUrls,
        telegramToken,
        webhookSecret: process.env.WEBHOOK_SECRET || undefined,
        webhookUrls,
        whaleThresholdSol,
    };
}

