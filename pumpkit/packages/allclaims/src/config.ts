/**
 * PumpFun All-Claims Bot — Configuration
 *
 * Loads and validates environment variables for the all-claims channel feed.
 * Unlike the first-claims channel bot, this bot broadcasts EVERY fee claim,
 * so its config centers on flood control: an instant-post threshold, a
 * digest interval for everything below it, and a Telegram post budget.
 */

import 'dotenv/config';

export interface AllClaimsConfig {
    /** Telegram Bot API token (its own bot — never reuse the first-claims bot token) */
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
     * order. A single endpoint is not enough: an RPC that starts refusing the
     * upgrade (magicblock began answering 401 once it went key-gated) leaves a
     * one-endpoint monitor reconnecting into the same wall forever.
     */
    solanaWsUrls: string[];
    /** Polling interval in seconds (fallback mode) */
    pollIntervalSeconds: number;
    /** Log level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** Claims at or above this USD value post immediately as individual messages */
    instantThresholdUsd: number;
    /** Claims below this USD value are dropped entirely (0 = keep everything) */
    minClaimUsd: number;
    /** Seconds between digest posts that batch all sub-threshold claims */
    digestIntervalSeconds: number;
    /** Hard ceiling on Telegram posts per minute (channel cap is ~20/min) */
    maxPostsPerMinute: number;
    /** Max digest lines shown per digest message (rest are summarized) */
    digestMaxLines: number;
    /**
     * How many of a window's biggest claims are promoted to full cards.
     *
     * Without this the feed is digest-only whenever claims run small, which is
     * most of the time: a $100 instant threshold never fires on a chain whose
     * typical claim is a few dollars. Promoting the top of each window keeps
     * the channel made of readable cards regardless of claim sizes.
     */
    cardsPerWindow: number;
    /** Include cashback claims (user refunds, not creator activity) */
    includeCashback: boolean;
    /** Include distribute_creator_fees payouts */
    includeDistributions: boolean;
    /** Referral handles for the trade links on an instant card. Empty values render plain links. */
    affiliates: { axiom: string; gmgn: string; padre: string; fomo: string };
}

function parseNumber(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got: ${raw}`);
    if (n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}, got: ${n}`);
    return n;
}

function parseBool(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;
    return raw.toLowerCase() === 'true';
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

export function loadConfig(): AllClaimsConfig {
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
    try { new URL(solanaRpcUrl); } catch {
        throw new Error(`Invalid SOLANA_RPC_URL: ${solanaRpcUrl}`);
    }

    const extraUrls = process.env.SOLANA_RPC_URLS
        ? process.env.SOLANA_RPC_URLS.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const solanaRpcUrls = [solanaRpcUrl, ...extraUrls.filter((u) => u !== solanaRpcUrl)];

    const solanaWsUrls = resolveWsUrls(solanaRpcUrls);
    const solanaWsUrl = solanaWsUrls[0];

    const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
    const rawLogLevel = process.env.LOG_LEVEL || 'info';
    const logLevel: AllClaimsConfig['logLevel'] = VALID_LOG_LEVELS.includes(rawLogLevel as typeof VALID_LOG_LEVELS[number])
        ? (rawLogLevel as AllClaimsConfig['logLevel'])
        : 'info';

    return {
        affiliates: {
            axiom: process.env.AXIOM_REF ?? 'nich',
            gmgn: process.env.GMGN_REF ?? 'nichxbt',
            padre: process.env.PADRE_REF ?? 'nichxbt',
            fomo: process.env.FOMO_REF ?? 'nichxbt',
        },
        cardsPerWindow: parseNumber('CARDS_PER_WINDOW', 6, 0, 18),
        channelId,
        digestIntervalSeconds: parseNumber('DIGEST_INTERVAL_SECONDS', 60, 10, 3600),
        digestMaxLines: parseNumber('DIGEST_MAX_LINES', 12, 1, 40),
        includeCashback: parseBool('INCLUDE_CASHBACK', false),
        includeDistributions: parseBool('INCLUDE_DISTRIBUTIONS', true),
        instantThresholdUsd: parseNumber('INSTANT_THRESHOLD_USD', 100, 0, 1_000_000),
        logLevel,
        maxPostsPerMinute: parseNumber('MAX_POSTS_PER_MINUTE', 15, 1, 19),
        minClaimUsd: parseNumber('MIN_CLAIM_USD', 0, 0, 1_000_000),
        pollIntervalSeconds: Number.parseInt(process.env.POLL_INTERVAL_SECONDS || '30', 10),
        solanaRpcUrl,
        solanaRpcUrls,
        solanaWsUrl,
        solanaWsUrls,
        telegramToken,
    };
}
