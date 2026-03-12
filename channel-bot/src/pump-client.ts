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
    bannerUri: string;
    creator: string;
    createdTimestamp: number;
    complete: boolean;
    usdMarketCap: number;
    marketCapSol: number;
    priceSol: number;
    curveProgress: number;
    /** All-time high USD market cap */
    athMarketCap: number;
    /** Timestamp (seconds) when ATH was reached */
    athTimestamp: number;
    /** Timestamp (seconds) when token hit King of the Hill */
    kothTimestamp: number;
    /** Timestamp (seconds) of last trade */
    lastTradeTimestamp: number;
    /** Timestamp (seconds) of last community reply */
    lastReplyTimestamp: number;
    /** Number of community replies */
    replyCount: number;
    /** PumpSwap AMM pool address (if graduated) */
    pumpSwapPool: string;
    /** Which program: "pump" or "pumpswap" */
    program: string;
    /** Flags */
    isCashbackEnabled: boolean;
    isNsfw: boolean;
    isBanned: boolean;
    isHackathon: boolean;
    website?: string;
    twitter?: string;
    telegram?: string;
    githubUrls: string[];
}

export interface TokenHolderInfo {
    totalHolders: number;
}

export interface TokenTradeInfo {
    recentTradeCount: number;
    recentVolumeSol: number;
    buyCount: number;
    sellCount: number;
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
    /** Estimated scam/rug count — non-graduated coins with near-zero MC */
    scamEstimate: number;
    /** Names of recent coins created */
    recentCoins: Array<{ name: string; symbol: string; mint: string; complete: boolean; usdMarketCap: number }>;
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

/** Fetch token info: PumpFun API (primary) → DexScreener (fallback). */
export async function fetchTokenInfo(mint: string): Promise<TokenInfo | null> {
    const cached = getCached(tokenCache, mint);
    if (cached) return cached;

    const info = await fetchTokenInfoPump(mint) ?? await fetchTokenInfoDexScreener(mint);
    if (info) setCache(tokenCache, mint, info, TOKEN_CACHE_TTL);
    return info;
}

/** Primary: PumpFun public API. */
async function fetchTokenInfoPump(mint: string): Promise<TokenInfo | null> {
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

        // Bonding curve progress: realSolReserves / ~85 SOL threshold
        const realSolReserves = Number(raw.real_sol_reserves ?? 0) / LAMPORTS_PER_SOL;
        const curveProgress = complete ? 100 : Math.min(99, (realSolReserves / 85) * 100);

        const description = String(raw.description ?? '');
        const website = raw.website ? String(raw.website) : '';
        const twitter = raw.twitter ? String(raw.twitter) : '';
        const telegram = raw.telegram ? String(raw.telegram) : '';
        const metadataUri = String(raw.metadata_uri ?? raw.uri ?? '');

        // Extract GitHub URLs from ALL fields: description, website, socials, metadata
        const githubUrls = extractGithubUrls(
            [description, website, twitter, telegram, metadataUri].join(' '),
        );
        // Also check if the website itself is a GitHub URL
        if (website && /github\.com/i.test(website) && !githubUrls.some(u => u === website)) {
            githubUrls.push(website);
        }

        // Timestamps from API are ms — normalize to seconds
        const createdTs = Number(raw.created_timestamp ?? 0);
        const createdTimestamp = createdTs > 1e12 ? Math.floor(createdTs / 1000) : createdTs;
        const kothTs = Number(raw.king_of_the_hill_timestamp ?? 0);
        const kothTimestamp = kothTs > 1e12 ? Math.floor(kothTs / 1000) : kothTs;
        const athTs = Number(raw.ath_market_cap_timestamp ?? 0);
        const athTimestamp = athTs > 1e12 ? Math.floor(athTs / 1000) : athTs;
        const lastTradeTs = Number(raw.last_trade_timestamp ?? 0);
        const lastTradeTimestamp = lastTradeTs > 1e12 ? Math.floor(lastTradeTs / 1000) : lastTradeTs;
        const lastReplyTs = Number(raw.last_reply ?? 0);
        const lastReplyTimestamp = lastReplyTs > 1e12 ? Math.floor(lastReplyTs / 1000) : lastReplyTs;

        return {
            mint: String(raw.mint ?? mint),
            name: String(raw.name ?? 'Unknown'),
            symbol: String(raw.symbol ?? '???'),
            description,
            imageUri: String(raw.image_uri ?? ''),
            bannerUri: String(raw.banner_uri ?? ''),
            creator: String(raw.creator ?? ''),
            createdTimestamp,
            complete,
            usdMarketCap: Number(raw.usd_market_cap ?? 0),
            marketCapSol: Number(raw.market_cap ?? marketCapSol),
            priceSol,
            curveProgress,
            athMarketCap: Number(raw.ath_market_cap ?? 0),
            athTimestamp,
            kothTimestamp,
            lastTradeTimestamp,
            lastReplyTimestamp,
            replyCount: Number(raw.reply_count ?? 0),
            pumpSwapPool: String(raw.pump_swap_pool ?? ''),
            program: String(raw.program ?? 'pump'),
            isCashbackEnabled: Boolean(raw.is_cashback_enabled),
            isNsfw: Boolean(raw.nsfw),
            isBanned: Boolean(raw.is_banned),
            isHackathon: Boolean(raw.is_hackathon),
            website: website || undefined,
            twitter: twitter || undefined,
            telegram: telegram || undefined,
            githubUrls,
        };
    } catch (err) {
        log.warn('PumpFun fetch failed for %s: %s', mint.slice(0, 8), err);
        return null;
    }
}

/** Fallback: DexScreener API (partial data — no description/creator/GitHub URLs). */
async function fetchTokenInfoDexScreener(mint: string): Promise<TokenInfo | null> {
    try {
        const resp = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
            { signal: AbortSignal.timeout(8_000) },
        );
        if (!resp.ok) return null;

        const data = (await resp.json()) as { pairs?: Array<Record<string, unknown>> };
        const pair = data.pairs?.[0];
        if (!pair) return null;

        const base = pair.baseToken as Record<string, unknown> | undefined;
        const info = pair.info as Record<string, unknown> | undefined;
        const socials = Array.isArray(info?.socials)
            ? (info!.socials as Array<Record<string, string>>)
            : [];

        log.debug('DexScreener fallback used for %s', mint.slice(0, 8));

        return {
            mint,
            name: String(base?.name ?? 'Unknown'),
            symbol: String(base?.symbol ?? '???'),
            description: '',
            imageUri: String(info?.imageUrl ?? ''),
            bannerUri: '',
            creator: '',
            createdTimestamp: pair.pairCreatedAt
                ? Math.floor(Number(pair.pairCreatedAt) / 1000)
                : 0,
            complete: true,
            usdMarketCap: Number(pair.marketCap ?? pair.fdv ?? 0),
            marketCapSol: 0,
            priceSol: Number(pair.priceNative ?? 0),
            curveProgress: 100,
            athMarketCap: 0,
            athTimestamp: 0,
            kothTimestamp: 0,
            lastTradeTimestamp: 0,
            lastReplyTimestamp: 0,
            replyCount: 0,
            pumpSwapPool: '',
            program: 'pump',
            isCashbackEnabled: false,
            isNsfw: false,
            isBanned: false,
            isHackathon: false,
            website: (info?.websites as Array<Record<string, string>>)?.[0]?.url,
            twitter: socials.find((s) => s.type === 'twitter')?.url,
            telegram: socials.find((s) => s.type === 'telegram')?.url,
            githubUrls: [],
        };
    } catch (err) {
        log.debug('DexScreener fallback failed for %s: %s', mint.slice(0, 8), err);
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
        scamEstimate: 0,
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
            // Estimate scams/rugs: non-graduated coins with very low market cap
            profile.scamEstimate = coins.filter((c) => {
                const mc = Number(c.usd_market_cap ?? 0);
                return !Boolean(c.complete) && mc < 500;
            }).length;
            profile.recentCoins = coins.slice(0, 5).map((c) => ({
                mint: String(c.mint ?? ''),
                name: String(c.name ?? 'Unknown'),
                symbol: String(c.symbol ?? '???'),
                complete: Boolean(c.complete),
                usdMarketCap: Number(c.usd_market_cap ?? 0),
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

// ============================================================================
// GitHub URL Extraction
// ============================================================================

const GITHUB_RE = /https?:\/\/github\.com\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?/gi;

/** Extract GitHub URLs from token description or metadata. */
export function extractGithubUrls(text: string): string[] {
    if (!text) return [];
    const matches = text.match(GITHUB_RE);
    if (!matches) return [];
    // Deduplicate
    return [...new Set(matches)];
}

// ============================================================================
// Token Holder Count
// ============================================================================

/** Fetch approximate holder count for a token. */
export async function fetchTokenHolders(mint: string): Promise<TokenHolderInfo> {
    const result: TokenHolderInfo = { totalHolders: 0 };
    try {
        // PumpFun API doesn't directly expose holder count, but we can use
        // the getTokenLargestAccounts RPC as a proxy — limit 20 response
        // tells us there are at least 20 holders. For a better count,
        // use the getProgramAccounts approach or a third-party indexer.
        // For now, use the PumpFun trades API to estimate from unique traders.
        const resp = await fetch(
            `${PUMPFUN_API}/coins/${encodeURIComponent(mint)}/holders?limit=1&offset=0`,
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
        );
        if (resp.ok) {
            // The response may include a total field or be an array
            const data = await resp.json();
            if (typeof data === 'object' && data !== null && 'total' in data) {
                result.totalHolders = Number((data as Record<string, unknown>).total ?? 0);
            } else if (Array.isArray(data)) {
                // Fallback: if no total, just note we got some
                result.totalHolders = data.length;
            }
        }
    } catch (err) {
        log.debug('Holder count fetch failed for %s: %s', mint.slice(0, 8), err);
    }
    return result;
}

// ============================================================================
// Recent Trades / Volume
// ============================================================================

/** Fetch recent trade activity for a token. */
export async function fetchTokenTrades(mint: string): Promise<TokenTradeInfo> {
    const result: TokenTradeInfo = { recentTradeCount: 0, recentVolumeSol: 0, buyCount: 0, sellCount: 0 };
    try {
        const resp = await fetch(
            `${PUMPFUN_API}/coins/${encodeURIComponent(mint)}/trades?limit=50&offset=0`,
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
        );
        if (resp.ok) {
            const trades = (await resp.json()) as Array<Record<string, unknown>>;
            result.recentTradeCount = trades.length;
            for (const t of trades) {
                const sol = Number(t.sol_amount ?? 0) / LAMPORTS_PER_SOL;
                result.recentVolumeSol += sol;
                if (Boolean(t.is_buy)) result.buyCount++;
                else result.sellCount++;
            }
        }
    } catch (err) {
        log.debug('Trades fetch failed for %s: %s', mint.slice(0, 8), err);
    }
    return result;
}

// ============================================================================
// SOL/USD Price
// ============================================================================

let cachedSolPrice = 0;
let solPriceExpiresAt = 0;

/** Fetch SOL/USD price: Jupiter (primary) → CoinGecko → Binance. */
export async function fetchSolUsdPrice(): Promise<number> {
    if (cachedSolPrice > 0 && Date.now() < solPriceExpiresAt) return cachedSolPrice;

    const price =
        (await fetchSolPriceJupiter()) ||
        (await fetchSolPriceCoinGecko()) ||
        (await fetchSolPriceBinance());

    if (price > 0) {
        cachedSolPrice = price;
        solPriceExpiresAt = Date.now() + 60_000;
    }
    return cachedSolPrice;
}

/** Jupiter Price API v2 — primary SOL/USD source. */
async function fetchSolPriceJupiter(): Promise<number> {
    try {
        const resp = await fetch(
            'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112',
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5_000) },
        );
        if (!resp.ok) return 0;
        const data = (await resp.json()) as Record<string, Record<string, Record<string, unknown>>>;
        return Number(data?.data?.['So11111111111111111111111111111111111111112']?.price ?? 0);
    } catch {
        return 0;
    }
}

/** CoinGecko free API — first SOL/USD fallback. */
async function fetchSolPriceCoinGecko(): Promise<number> {
    try {
        const resp = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
            { signal: AbortSignal.timeout(5_000) },
        );
        if (!resp.ok) return 0;
        const data = (await resp.json()) as Record<string, Record<string, number>>;
        const price = data?.solana?.usd ?? 0;
        if (price > 0) log.debug('SOL price from CoinGecko fallback: $%d', price);
        return price;
    } catch {
        return 0;
    }
}

/** Binance public API — second SOL/USD fallback. */
async function fetchSolPriceBinance(): Promise<number> {
    try {
        const resp = await fetch(
            'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
            { signal: AbortSignal.timeout(5_000) },
        );
        if (!resp.ok) return 0;
        const data = (await resp.json()) as Record<string, string>;
        const price = Number(data?.price ?? 0);
        if (price > 0) log.debug('SOL price from Binance fallback: $%d', price);
        return price;
    } catch {
        return 0;
    }
}

// ============================================================================
// Top Holders
// ============================================================================

export interface TopHolder {
    address: string;
    /** Percentage of supply held (0-100) */
    pct: number;
    /** Whether this is the bonding curve / pool address */
    isPool: boolean;
}

export interface HolderDetails {
    totalHolders: number;
    topHolders: TopHolder[];
    /** Sum of top 10 holders' pct (excluding pool) */
    top10Pct: number;
}

/** Fetch top holders for a token from the PumpFun API. */
export async function fetchTopHolders(mint: string): Promise<HolderDetails> {
    const result: HolderDetails = { totalHolders: 0, topHolders: [], top10Pct: 0 };
    try {
        const resp = await fetch(
            `${PUMPFUN_API}/coins/${encodeURIComponent(mint)}/holders?limit=20&offset=0`,
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
        );
        if (!resp.ok) return result;

        const data = await resp.json();
        const holders = Array.isArray(data) ? data : (data as Record<string, unknown>).holders;
        if (!Array.isArray(holders)) return result;

        if (typeof data === 'object' && data !== null && 'total' in data) {
            result.totalHolders = Number((data as Record<string, unknown>).total ?? holders.length);
        } else {
            result.totalHolders = holders.length;
        }

        for (const h of holders.slice(0, 20)) {
            const raw = h as Record<string, unknown>;
            const address = String(raw.address ?? raw.owner ?? '');
            const pct = Number(raw.percentage ?? raw.pct ?? 0);
            const isPool = Boolean(raw.is_bonding_curve ?? raw.isPool ?? false);
            result.topHolders.push({ address, pct, isPool });
        }

        // top10 excluding pool
        const nonPool = result.topHolders.filter(h => !h.isPool);
        result.top10Pct = nonPool.slice(0, 10).reduce((sum, h) => sum + h.pct, 0);
    } catch (err) {
        log.debug('Top holders fetch failed for %s: %s', mint.slice(0, 8), err);
    }
    return result;
}

// ============================================================================
// Dev Wallet Balance (SOL + token holdings)
// ============================================================================

export interface DevWalletInfo {
    /** SOL balance in SOL (not lamports) */
    solBalance: number;
    /** Percentage of token supply held by dev */
    tokenSupplyPct: number;
}

/**
 * Fetch dev wallet SOL balance and token holdings via RPC.
 * Accepts a Connection to avoid creating new connections.
 */
export async function fetchDevWalletInfo(
    devWallet: string,
    mint: string,
    rpcUrl: string,
): Promise<DevWalletInfo> {
    const result: DevWalletInfo = { solBalance: 0, tokenSupplyPct: 0 };
    try {
        // SOL balance via standard JSON-RPC
        const balResp = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 1, method: 'getBalance',
                params: [devWallet, { commitment: 'confirmed' }],
            }),
            signal: AbortSignal.timeout(8_000),
        });
        if (balResp.ok) {
            const balData = (await balResp.json()) as { result?: { value?: number } };
            result.solBalance = (balData.result?.value ?? 0) / LAMPORTS_PER_SOL;
        }
    } catch (err) {
        log.debug('Dev SOL balance fetch failed for %s: %s', devWallet.slice(0, 8), err);
    }

    try {
        // Token holdings via getTokenAccountsByOwner
        const tokenResp = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 2, method: 'getTokenAccountsByOwner',
                params: [
                    devWallet,
                    { mint },
                    { encoding: 'jsonParsed', commitment: 'confirmed' },
                ],
            }),
            signal: AbortSignal.timeout(8_000),
        });
        if (tokenResp.ok) {
            const tokenData = (await tokenResp.json()) as {
                result?: { value?: Array<{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }> }
            };
            const accounts = tokenData.result?.value ?? [];
            let totalTokens = 0;
            for (const acct of accounts) {
                totalTokens += acct.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            }
            // Total supply is 1B tokens (1_000_000_000)
            const TOTAL_SUPPLY = 1_000_000_000;
            result.tokenSupplyPct = (totalTokens / TOTAL_SUPPLY) * 100;
        }
    } catch (err) {
        log.debug('Dev token balance fetch failed for %s: %s', devWallet.slice(0, 8), err);
    }

    return result;
}

// ============================================================================
// Pool Liquidity (DexScreener)
// ============================================================================

export interface PoolLiquidityInfo {
    liquidityUsd: number;
    /** marketCap / liquidity multiplier */
    liquidityMultiplier: number;
}

/** Fetch pool liquidity from DexScreener. */
export async function fetchPoolLiquidity(mint: string, usdMarketCap: number): Promise<PoolLiquidityInfo | null> {
    try {
        const resp = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
            { signal: AbortSignal.timeout(8_000) },
        );
        if (!resp.ok) return null;
        const data = (await resp.json()) as { pairs?: Array<Record<string, unknown>> };
        const pair = data.pairs?.[0];
        if (!pair) return null;
        const liqObj = pair.liquidity as Record<string, number> | undefined;
        const liquidityUsd = liqObj?.usd ?? 0;
        if (liquidityUsd <= 0) return null;
        const liquidityMultiplier = usdMarketCap > 0 ? Math.round(usdMarketCap / liquidityUsd) : 0;
        return { liquidityUsd, liquidityMultiplier };
    } catch (err) {
        log.debug('Pool liquidity fetch failed for %s: %s', mint.slice(0, 8), err);
        return null;
    }
}

// ============================================================================
// Bundle Detection
// ============================================================================

export interface BundleInfo {
    /** Approximate % of total supply bought in the first Solana slot */
    bundlePct: number;
    /** Number of distinct wallets in the bundle */
    bundleWallets: number;
}

/**
 * Detect coordinated early buys (bundles) by looking at trades within the
 * first ~2 seconds of the token's life. Works best for tokens with < 200
 * lifetime trades — accuracy degrades for high-volume tokens.
 */
export async function fetchBundleInfo(mint: string): Promise<BundleInfo | null> {
    try {
        const resp = await fetch(
            `${PUMPFUN_API}/coins/${encodeURIComponent(mint)}/trades?limit=200&offset=0`,
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) },
        );
        if (!resp.ok) return null;
        const raw = await resp.json();
        const trades = Array.isArray(raw) ? raw : ((raw as Record<string, unknown>).trades as Array<Record<string, unknown>> ?? []);
        if (!trades.length) return null;

        // Normalize timestamp to seconds
        const ts = (t: Record<string, unknown>) => {
            const v = Number(t.timestamp ?? 0);
            return v > 1e12 ? Math.floor(v / 1000) : v;
        };

        // Sort chronologically, buy-only
        const buys = trades
            .filter(t => Boolean(t.is_buy))
            .sort((a, b) => ts(a) - ts(b));
        if (buys.length < 2) return null;

        const firstTs = ts(buys[0]!);
        // One Solana slot ≈ 400ms; use a 2-second window to catch same-block bundles
        const slotBuys = buys.filter(t => ts(t) <= firstTs + 2);
        if (slotBuys.length < 2) return null;

        const wallets = new Set(slotBuys.map(t => String(t.user ?? '')));
        if (wallets.size < 2) return null;

        // 1B tokens × 10^6 decimals = total raw supply
        const TOTAL_SUPPLY_RAW = 1_000_000_000_000_000;
        const bundleTokens = slotBuys.reduce((sum, t) => sum + Number(t.token_amount ?? 0), 0);
        const bundlePct = Math.min(100, (bundleTokens / TOTAL_SUPPLY_RAW) * 100);

        return { bundlePct, bundleWallets: wallets.size };
    } catch (err) {
        log.debug('Bundle detection failed for %s: %s', mint.slice(0, 8), err);
        return null;
    }
}

// ============================================================================
// Same-Name Token Search (DexScreener)
// ============================================================================

export interface SameNameToken {
    /** Token mint / contract address */
    mint: string;
    name: string;
    symbol: string;
    usdMarketCap: number;
    /** Pair URL on DexScreener */
    url: string;
    /** Age label, e.g. "3d", "1mo" */
    age: string;
}

/**
 * Search DexScreener for other Solana tokens with the same name/symbol.
 * Returns up to 5 results sorted by market cap (descending), excluding
 * the provided `excludeMint`.
 */
export async function fetchSameNameTokens(
    name: string,
    symbol: string,
    excludeMint: string,
): Promise<SameNameToken[]> {
    const query = symbol || name;
    if (!query) return [];
    try {
        const resp = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
            { signal: AbortSignal.timeout(8_000) },
        );
        if (!resp.ok) return [];
        const data = (await resp.json()) as { pairs?: Array<Record<string, unknown>> };
        if (!data.pairs) return [];

        const nameLower = name.toLowerCase();
        const symbolLower = symbol.toLowerCase();
        const excludeLower = excludeMint.toLowerCase();

        const seen = new Set<string>();
        const results: SameNameToken[] = [];

        for (const pair of data.pairs) {
            if (pair.chainId !== 'solana') continue;
            const base = pair.baseToken as Record<string, unknown> | undefined;
            if (!base) continue;
            const pairName = String(base.name ?? '').toLowerCase();
            const pairSymbol = String(base.symbol ?? '').toLowerCase();
            const pairMint = String(base.address ?? '');
            if (pairMint.toLowerCase() === excludeLower) continue;
            if (seen.has(pairMint)) continue;

            // Match on exact name or symbol (case-insensitive)
            if (pairName !== nameLower && pairSymbol !== symbolLower) continue;

            const mc = Number(pair.marketCap ?? pair.fdv ?? 0);
            if (mc <= 0) continue;

            seen.add(pairMint);
            const createdAt = Number(pair.pairCreatedAt ?? 0);
            results.push({
                mint: pairMint,
                name: String(base.name ?? ''),
                symbol: String(base.symbol ?? ''),
                usdMarketCap: mc,
                url: String(pair.url ?? ''),
                age: createdAt > 0 ? formatAge(createdAt) : '',
            });
        }

        results.sort((a, b) => b.usdMarketCap - a.usdMarketCap);
        return results.slice(0, 5);
    } catch (err) {
        log.debug('Same-name token search failed for %s: %s', query, err);
        return [];
    }
}

/** Format millisecond timestamp to compact age string. */
function formatAge(msTimestamp: number): string {
    const sec = (Date.now() - msTimestamp) / 1000;
    if (sec < 60) return `${Math.floor(sec)}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    if (sec < 2_592_000) return `${Math.floor(sec / 86400)}d`;
    return `${Math.floor(sec / 2_592_000)}mo`;
}

