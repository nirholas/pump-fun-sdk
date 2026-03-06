/**
 * PumpFun Channel Bot — X/Twitter Profile Client
 *
 * Fetches X/Twitter profile data using Twitter's internal GraphQL API,
 * the same approach used by nirholas/xactions. Uses cookie-based auth
 * (X_AUTH_TOKEN env var). Degrades gracefully if credentials are missing.
 *
 * No external dependency needed — just fetch + public bearer token + auth cookie.
 */

import { log } from './logger.js';

const X_AUTH_TOKEN = process.env.X_AUTH_TOKEN ?? '';
const X_CT0_TOKEN = process.env.X_CT0_TOKEN ?? '';

// Public bearer token from Twitter's web client JS (same as xactions uses)
const BEARER_TOKEN =
    'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// GraphQL query ID for UserByScreenName (from Twitter's JS bundle, same as xactions)
const USER_BY_SCREEN_NAME_QUERY_ID = 'xc8f1g7BYqr6VTzTbvNLGg';

const DEFAULT_FEATURES: Record<string, boolean> = {
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    hidden_profile_subscriptions_enabled: true,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
};

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
    /** Account creation date (ISO string from Twitter) */
    createdAt: string | null;
    /** Tweet count */
    tweetCount: number;
}

export type InfluencerTier = 'mega' | 'influencer' | 'notable' | null;

// ============================================================================
// Cache (10 min TTL)
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const profileCache = new Map<string, CacheEntry<XProfile | null>>();
const CACHE_TTL = 10 * 60 * 1000;

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
// GraphQL URL builder (same as xactions buildGraphQLUrl)
// ============================================================================

function buildGraphQLUrl(username: string): string {
    const base = `https://x.com/i/api/graphql/${USER_BY_SCREEN_NAME_QUERY_ID}/UserByScreenName`;
    const variables = JSON.stringify({
        screen_name: username,
        withSafetyModeUserFields: true,
    });
    const features = JSON.stringify(DEFAULT_FEATURES);
    const params = new URLSearchParams({ variables, features });
    return `${base}?${params.toString()}`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch an X/Twitter profile by username using Twitter's internal GraphQL API.
 * Same approach as nirholas/xactions Scraper.getProfile().
 * Requires X_AUTH_TOKEN env var (auth_token cookie from x.com).
 */
export async function fetchXProfile(username: string): Promise<XProfile | null> {
    if (!X_AUTH_TOKEN) return null;

    const cached = getCached(username);
    if (cached !== undefined) return cached;

    try {
        const url = buildGraphQLUrl(username);
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
            'Cookie': `auth_token=${X_AUTH_TOKEN}${X_CT0_TOKEN ? `; ct0=${X_CT0_TOKEN}` : ''}`,
            'x-twitter-active-user': 'yes',
            'x-twitter-auth-type': 'OAuth2Session',
        };

        if (X_CT0_TOKEN) {
            headers['x-csrf-token'] = X_CT0_TOKEN;
        }

        const resp = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(8000),
        });

        if (!resp.ok) {
            if (resp.status === 404) {
                setCache(username, null);
                return null;
            }
            if (resp.status === 429) {
                log.warn('X GraphQL rate limited for @%s', username);
                setCache(username, null, 60_000);
                return null;
            }
            log.warn('X GraphQL error %d for @%s', resp.status, username);
            return null;
        }

        /* eslint-disable @typescript-eslint/no-explicit-any */
        const body = (await resp.json()) as any;
        const userResult = body?.data?.user?.result;
        if (!userResult || userResult.__typename === 'UserUnavailable') {
            setCache(username, null);
            return null;
        }

        const legacy = userResult.legacy as Record<string, any> | undefined;
        /* eslint-enable @typescript-eslint/no-explicit-any */
        if (!legacy) {
            setCache(username, null);
            return null;
        }

        const profile: XProfile = {
            username: String(legacy.screen_name ?? username),
            name: String(legacy.name ?? ''),
            followers: parseInt(String(legacy.followers_count ?? '0'), 10) || 0,
            following: parseInt(String(legacy.friends_count ?? '0'), 10) || 0,
            verified: Boolean(legacy.verified || userResult.is_blue_verified),
            description: legacy.description ? String(legacy.description) : null,
            url: `https://x.com/${encodeURIComponent(String(legacy.screen_name ?? username))}`,
            createdAt: legacy.created_at ? String(legacy.created_at) : null,
            tweetCount: parseInt(String(legacy.statuses_count ?? '0'), 10) || 0,
        };

        setCache(username, profile);
        log.info('Fetched X profile @%s — %d followers', profile.username, profile.followers);
        return profile;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn('X profile fetch failed for @%s: %s', username, msg);
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
