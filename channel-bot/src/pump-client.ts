/**
 * PumpFun Channel Bot — Pump API Client
 *
 * Fetches token info, creator profiles, and past launches
 * from the PumpFun public HTTP API for rich channel feed messages.
 */

import { log } from './logger.js';

const PUMPFUN_API = 'https://frontend-api-v3.pump.fun';
const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 6;
const ONE_TOKEN = 10 ** TOKEN_DECIMALS;

// ============================================================================
// Types
// ============================================================================

export interface TokenInfo {
    mint: string;
    name: string;
    symbol: string;
    description: string;
    imageUri: string;
    creator: string;
    createdTimestamp: number;
    complete: boolean;
    usdMarketCap: number;
    marketCapSol: number;
    priceSol: number;
    curveProgress: number;
    website?: string;
    twitter?: string;
    telegram?: string;
}

export interface CreatorProfile {
    wallet: string;
    /** PumpFun display username (from /users/ endpoint) */
    username: string;
    /** Profile image URL */
    profileImage: string;
    /** Number of followers */
    followers: number;
    /** Number of tokens this creator has launched */
    totalLaunches: number;
    /** Names of recent coins created */
    recentCoins: Array<{ name: string; symbol: string; mint: string; complete: boolean }>;
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const TOKEN_CACHE_TTL = 30_000;
const CREATOR_CACHE_TTL = 120_000;

const tokenCache = new Map<string, CacheEntry<TokenInfo>>();
const creatorCache = new Map<string, CacheEntry<CreatorProfile>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
    cache.set(key, { data, expiresAt: Date.now() + ttl });
    if (cache.size > 500) {
        const now = Date.now();
        for (const [k, v] of cache) {
            if (now > v.expiresAt) cache.delete(k);
        }
    }
}

// ============================================================================
// API Calls
// ============================================================================

/** Fetch token info from the PumpFun public API. */
export async function fetchTokenInfo(mint: string): Promise<TokenInfo | null> {
    const cached = getCached(tokenCache, mint);
    if (cached) return cached;

    try {
        const resp = await fetch(`${PUMPFUN_API}/coins/${encodeURIComponent(mint)}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10_000),
        });

        if (!resp.ok) {
            if (resp.status === 404) return null;
            log.warn('PumpFun API %d for mint %s', resp.status, mint.slice(0, 8));
            return null;
        }

        const raw = (await resp.json()) as Record<string, unknown>;

        const virtualSolReserves = Number(raw.virtual_sol_reserves ?? 0);
        const virtualTokenReserves = Number(raw.virtual_token_reserves ?? 0);
        const totalSupply = Number(raw.total_supply ?? 0);
        const complete = Boolean(raw.complete);

        const priceSol =
            virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0;
        const marketCapSol =
            virtualTokenReserves > 0
                ? (virtualSolReserves * totalSupply) / (virtualTokenReserves * LAMPORTS_PER_SOL)
                : 0;

        const info: TokenInfo = {
            mint: String(raw.mint ?? mint),
            name: String(raw.name ?? 'Unknown'),
            symbol: String(raw.symbol ?? '???'),
            description: String(raw.description ?? ''),
            imageUri: String(raw.image_uri ?? ''),
            creator: String(raw.creator ?? ''),
            createdTimestamp: Number(raw.created_timestamp ?? 0),
            complete,
            usdMarketCap: Number(raw.usd_market_cap ?? 0),
            marketCapSol,
            priceSol,
            curveProgress: complete ? 100 : 0,
            website: raw.website ? String(raw.website) : undefined,
            twitter: raw.twitter ? String(raw.twitter) : undefined,
            telegram: raw.telegram ? String(raw.telegram) : undefined,
        };

        setCache(tokenCache, mint, info, TOKEN_CACHE_TTL);
        return info;
    } catch (err) {
        log.error('Failed to fetch token %s: %s', mint.slice(0, 8), err);
        return null;
    }
}

/**
 * Fetch creator profile — how many coins they've launched and recent ones.
 * Uses the PumpFun coins endpoint filtered by creator address.
 */
export async function fetchCreatorProfile(wallet: string): Promise<CreatorProfile> {
    const cached = getCached(creatorCache, wallet);
    if (cached) return cached;

    const profile: CreatorProfile = {
        wallet,
        username: '',
        profileImage: '',
        followers: 0,
        totalLaunches: 0,
        recentCoins: [],
    };

    // Fetch user profile (username, avatar, followers)
    try {
        const userResp = await fetch(
            `${PUMPFUN_API}/users/${encodeURIComponent(wallet)}`,
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
        );
        if (userResp.ok) {
            const user = (await userResp.json()) as Record<string, unknown>;
            profile.username = String(user.username ?? '');
            profile.profileImage = String(user.profile_image ?? '');
            profile.followers = Number(user.followers ?? 0);
        }
    } catch (err) {
        log.debug('User profile fetch failed for %s: %s', wallet.slice(0, 8), err);
    }

    // Fetch coins created by this wallet
    try {
        const coinsResp = await fetch(
            `${PUMPFUN_API}/coins?creator=${encodeURIComponent(wallet)}&limit=50&offset=0&includeNsfw=true`,
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) },
        );
        if (coinsResp.ok) {
            const coins = (await coinsResp.json()) as Array<Record<string, unknown>>;
            profile.totalLaunches = coins.length;
            profile.recentCoins = coins.slice(0, 5).map((c) => ({
                mint: String(c.mint ?? ''),
                name: String(c.name ?? 'Unknown'),
                symbol: String(c.symbol ?? '???'),
                complete: Boolean(c.complete),
            }));
        }
    } catch (err) {
        log.debug('Creator coins fetch failed for %s: %s', wallet.slice(0, 8), err);
    }

    setCache(creatorCache, wallet, profile, CREATOR_CACHE_TTL);
    return profile;
}

// ============================================================================
// Helpers
// ============================================================================

export function formatSol(lamports: number): string {
    const val = lamports / LAMPORTS_PER_SOL;
    if (val >= 1000) return val.toFixed(0);
    if (val >= 1) return val.toFixed(4);
    if (val >= 0.001) return val.toFixed(6);
    return val.toFixed(9);
}

export function formatTokenAmount(raw: number): string {
    const val = raw / ONE_TOKEN;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
    if (val >= 1) return val.toFixed(2);
    return val.toFixed(6);
}
