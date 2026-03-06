/**
 * PumpFun Channel Bot — X/Twitter Profile Client
 *
 * Fetches X/Twitter profile data (follower counts) via nirholas/xactions.
 * Uses cookie-based auth (X_AUTH_TOKEN + X_CT0_TOKEN env vars).
 * Degrades gracefully if credentials are missing.
 */

import { Scraper } from 'xactions/client';
import { log } from './logger.js';

const X_AUTH_TOKEN = process.env.X_AUTH_TOKEN ?? '';
const X_CT0_TOKEN = process.env.X_CT0_TOKEN ?? '';

// ============================================================================
// Types
// ============================================================================

export interface XProfile {
    /** X/Twitter username (without @) */
    username: string;
    /** Display name */
    name: string;
    /** Follower count */
    followers: number;
    /** Following count */
    following: number;
    /** Whether the account is verified (legacy or Blue) */
    verified: boolean;
    /** Profile description/bio */
    description: string | null;
    /** Profile URL */
    url: string;
}

export type InfluencerTier = 'mega' | 'influencer' | 'notable' | null;

// ============================================================================
// Singleton Scraper (lazy init)
// ============================================================================

let scraper: Scraper | null = null;

async function getScraper(): Promise<Scraper | null> {
    if (!X_AUTH_TOKEN) return null;
    if (scraper) return scraper;

    const s = new Scraper();
    const cookies = [
        { name: 'auth_token', value: X_AUTH_TOKEN },
    ];
    if (X_CT0_TOKEN) {
        cookies.push({ name: 'ct0', value: X_CT0_TOKEN });
    }
    await s.setCookies(cookies);
    scraper = s;
    log.info('xactions Scraper initialized with cookie auth');
    return scraper;
}

// ============================================================================
// Cache (10 min TTL, same pattern as github-client)
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const profileCache = new Map<string, CacheEntry<XProfile | null>>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached(username: string): XProfile | null | undefined {
    const entry = profileCache.get(username.toLowerCase());
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        profileCache.delete(username.toLowerCase());
        return undefined;
    }
    return entry.data;
}

function setCache(username: string, data: XProfile | null, ttl: number = CACHE_TTL): void {
    profileCache.set(username.toLowerCase(), { data, expiresAt: Date.now() + ttl });
    if (profileCache.size > 300) {
        const now = Date.now();
        for (const [k, v] of profileCache) {
            if (now > v.expiresAt) profileCache.delete(k);
        }
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch an X/Twitter profile by username using xactions Scraper.
 * Returns null if credentials are missing, user not found, or error.
 */
export async function fetchXProfile(username: string): Promise<XProfile | null> {
    const cached = getCached(username);
    if (cached !== undefined) return cached;

    const s = await getScraper();
    if (!s) return null;

    try {
        const p = await s.getProfile(username);

        const profile: XProfile = {
            username: p.username ?? username,
            name: p.name ?? '',
            followers: p.followersCount ?? 0,
            following: p.followingCount ?? 0,
            verified: Boolean(p.verified || p.isBlueVerified),
            description: p.bio ?? null,
            url: `https://x.com/${encodeURIComponent(p.username ?? username)}`,
        };

        setCache(username, profile);
        log.info('Fetched X profile @%s — %d followers', profile.username, profile.followers);
        return profile;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not found') || msg.includes('404')) {
            setCache(username, null);
        } else {
            log.warn('X profile fetch failed for @%s: %s', username, msg);
        }
        return null;
    }
}

/**
 * Determine influencer tier from combined GitHub + X signals.
 *
 * - mega:       X >= 100K or GitHub >= 10K
 * - influencer: X >= 10K  or GitHub >= 1K
 * - notable:    X >= 1K   or GitHub >= 100
 * - null:       below thresholds or no data
 */
export function getInfluencerTier(
    githubFollowers: number,
    xFollowers: number | null,
): InfluencerTier {
    const xf = xFollowers ?? 0;
    if (xf >= 100_000 || githubFollowers >= 10_000) return 'mega';
    if (xf >= 10_000 || githubFollowers >= 1_000) return 'influencer';
    if (xf >= 1_000 || githubFollowers >= 100) return 'notable';
    return null;
}

/**
 * Format follower count with K/M suffix.
 */
export function formatFollowerCount(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
}

/**
 * Get display label for influencer tier.
 */
export function influencerLabel(tier: InfluencerTier): string {
    switch (tier) {
        case 'mega': return '🔥🔥 MEGA INFLUENCER';
        case 'influencer': return '🔥 Influencer';
        case 'notable': return '⭐ Notable';
        default: return '';
    }
}
