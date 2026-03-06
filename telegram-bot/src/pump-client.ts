/**
 * PumpFun Telegram Bot — Pump Client
 *
 * Lightweight client for PumpFun token data using the public HTTP API.
 * No SDK dependency required — uses built-in fetch() + simple math.
 *
 * Features:
 *   - Token info & price lookup
 *   - Bonding curve progress calculation
 *   - Buy/sell quote estimation (constant-product AMM math)
 *   - Fee tier estimation
 */

import { log } from './logger.js';

// ============================================================================
// Constants
// ============================================================================

const PUMPFUN_API = 'https://frontend-api-v3.pump.fun';

/** Pump tokens have 6 decimals */
const TOKEN_DECIMALS = 6;
const ONE_TOKEN = 10 ** TOKEN_DECIMALS;           // 1_000_000
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Initial virtual token reserves on a new bonding curve.
 * Source: Pump global state `initialVirtualTokenReserves`.
 */
const INITIAL_VIRTUAL_TOKEN_RESERVES = 1_073_000_000n * BigInt(ONE_TOKEN);

/**
 * Initial real token reserves (tokens available for purchase).
 * Source: Pump global state `initialRealTokenReserves`.
 */
const INITIAL_REAL_TOKEN_RESERVES = 793_100_000n * BigInt(ONE_TOKEN);

/** Cache TTL for token data (30 seconds) */
const CACHE_TTL_MS = 30_000;

// ============================================================================
// Types
// ============================================================================

/** Token data from the PumpFun public API. */
export interface PumpTokenInfo {
    mint: string;
    name: string;
    symbol: string;
    description: string;
    imageUri: string;
    creator: string;
    createdTimestamp: number;
    bondingCurve: string;
    /** Whether the token has graduated to AMM */
    complete: boolean;
    /** Virtual SOL reserves (lamports) */
    virtualSolReserves: bigint;
    /** Virtual token reserves (raw units) */
    virtualTokenReserves: bigint;
    /** Total token supply (raw units) */
    totalSupply: bigint;
    /** Market cap in USD (estimated) */
    usdMarketCap: number;
    /** Market cap in SOL (estimated from reserves) */
    marketCapSol: number;
    /** Spot price per token in SOL */
    priceSol: number;
    /** Bonding curve progress (0-100%) */
    curveProgress: number;
    /** Lifecycle stage */
    stage: 'new' | 'growing' | 'graduating' | 'graduated';
    /** Raydium/AMM pool address (only if graduated) */
    raydiumPool?: string;
    /** Social links */
    twitter?: string;
    telegram?: string;
    website?: string;
}

/** Buy/sell quote result. */
export interface QuoteResult {
    /** Direction */
    side: 'buy' | 'sell';
    /** Input amount (SOL lamports for buy, token raw units for sell) */
    inputAmount: bigint;
    /** Output amount (token raw units for buy, SOL lamports for sell) */
    outputAmount: bigint;
    /** Estimated fee (SOL lamports) */
    estimatedFee: bigint;
    /** Price per token before trade (SOL) */
    priceBefore: number;
    /** Price per token after trade (SOL) */
    priceAfter: number;
    /** Price impact in basis points */
    impactBps: number;
    /** Token info used */
    token: PumpTokenInfo;
}

/** Known PumpFun fee tier. */
export interface FeeTierInfo {
    /** Fee tier name */
    name: string;
    /** Market cap threshold in SOL */
    thresholdSol: number;
    /** Protocol fee in bps */
    protocolFeeBps: number;
    /** Creator fee in bps */
    creatorFeeBps: number;
    /** Total fee in bps */
    totalFeeBps: number;
}

// ============================================================================
// Simple cache
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry<PumpTokenInfo>>();

function getCached(key: string): PumpTokenInfo | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key: string, data: PumpTokenInfo): void {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    // Evict old entries periodically
    if (cache.size > 200) {
        const now = Date.now();
        for (const [k, v] of cache) {
            if (now > v.expiresAt) cache.delete(k);
        }
    }
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Fetch token info from the PumpFun public API.
 *
 * @param mint - Token mint address (base58)
 * @returns Token info or null if not found
 */
export async function fetchTokenInfo(mint: string): Promise<PumpTokenInfo | null> {
    // Check cache first
    const cached = getCached(mint);
    if (cached) return cached;

    try {
        const resp = await fetch(`${PUMPFUN_API}/coins/${mint}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10_000),
        });

        if (!resp.ok) {
            if (resp.status === 404) return null;
            log.warn('PumpFun API returned %d for mint %s', resp.status, mint.slice(0, 8));
            return null;
        }

        const raw = await resp.json() as Record<string, unknown>;

        const virtualSolReserves = BigInt(Math.floor(Number(raw.virtual_sol_reserves ?? 0)));
        const virtualTokenReserves = BigInt(Math.floor(Number(raw.virtual_token_reserves ?? 0)));
        const totalSupply = BigInt(Math.floor(Number(raw.total_supply ?? 0)));
        const complete = Boolean(raw.complete);

        // Calculate derived values
        const priceSol = virtualTokenReserves > 0n
            ? Number(virtualSolReserves) / Number(virtualTokenReserves)
            : 0;
        const marketCapSol = virtualTokenReserves > 0n
            ? (Number(virtualSolReserves) * Number(totalSupply)) /
              (Number(virtualTokenReserves) * LAMPORTS_PER_SOL)
            : 0;
        const curveProgress = getCurveProgress(virtualTokenReserves, complete);
        const stage = getStage(curveProgress, complete);

        const info: PumpTokenInfo = {
            mint: String(raw.mint ?? mint),
            name: String(raw.name ?? 'Unknown'),
            symbol: String(raw.symbol ?? '???'),
            description: String(raw.description ?? ''),
            imageUri: String(raw.image_uri ?? ''),
            creator: String(raw.creator ?? ''),
            createdTimestamp: Number(raw.created_timestamp ?? 0),
            bondingCurve: String(raw.bonding_curve ?? ''),
            complete,
            virtualSolReserves,
            virtualTokenReserves,
            totalSupply,
            usdMarketCap: Number(raw.usd_market_cap ?? 0),
            marketCapSol,
            priceSol,
            curveProgress,
            stage,
            raydiumPool: raw.raydium_pool ? String(raw.raydium_pool) : undefined,
            twitter: raw.twitter ? String(raw.twitter) : undefined,
            telegram: raw.telegram ? String(raw.telegram) : undefined,
            website: raw.website ? String(raw.website) : undefined,
        };

        setCache(mint, info);
        return info;
    } catch (err) {
        log.error('Failed to fetch token info for %s: %s', mint.slice(0, 8), err);
        return null;
    }
}

// ============================================================================
// Buy/Sell Quotes
// ============================================================================

/**
 * Default protocol fee in basis points (1%).
 * This is the standard PumpFun protocol fee.
 */
const DEFAULT_PROTOCOL_FEE_BPS = 100n;

/**
 * Default creator fee in basis points (1%).
 * Applied when the token has a non-default creator.
 */
const DEFAULT_CREATOR_FEE_BPS = 100n;

/**
 * Estimate how many tokens you receive for a given SOL amount (buy quote).
 * Uses constant-product AMM formula: tokens_out = sol_in * vTokenRes / (vSolRes + sol_in)
 *
 * @param token - Token info (must not be graduated)
 * @param solAmount - SOL amount in lamports
 * @returns Quote result
 */
export function getBuyQuote(token: PumpTokenInfo, solAmount: bigint): QuoteResult {
    const totalFeeBps = DEFAULT_PROTOCOL_FEE_BPS + DEFAULT_CREATOR_FEE_BPS;
    const feeAmount = (solAmount * totalFeeBps) / 10_000n;
    const netSolAmount = solAmount - feeAmount;

    const vSol = token.virtualSolReserves;
    const vToken = token.virtualTokenReserves;

    // Constant product: tokens_out = netSol * vToken / (vSol + netSol)
    const tokensOut = vSol + netSolAmount > 0n
        ? (netSolAmount * vToken) / (vSol + netSolAmount)
        : 0n;

    // Price before
    const priceBefore = vToken > 0n ? Number(vSol) / Number(vToken) : 0;

    // Price after
    const newVSol = vSol + netSolAmount;
    const newVToken = vToken - tokensOut;
    const priceAfter = newVToken > 0n ? Number(newVSol) / Number(newVToken) : 0;

    // Impact
    const impactBps = priceBefore > 0
        ? Math.round(((priceAfter - priceBefore) / priceBefore) * 10_000)
        : 0;

    return {
        side: 'buy',
        inputAmount: solAmount,
        outputAmount: tokensOut,
        estimatedFee: feeAmount,
        priceBefore,
        priceAfter,
        impactBps,
        token,
    };
}

/**
 * Estimate how much SOL you receive for selling a given token amount (sell quote).
 * Uses constant-product AMM formula: sol_out = tokenAmount * vSolRes / (vTokenRes + tokenAmount)
 *
 * @param token - Token info (must not be graduated)
 * @param tokenAmount - Token amount in raw units (× 10^6)
 * @returns Quote result
 */
export function getSellQuote(token: PumpTokenInfo, tokenAmount: bigint): QuoteResult {
    const vSol = token.virtualSolReserves;
    const vToken = token.virtualTokenReserves;

    // Constant product: sol_out = tokenAmount * vSol / (vToken + tokenAmount)
    const grossSolOut = vToken + tokenAmount > 0n
        ? (tokenAmount * vSol) / (vToken + tokenAmount)
        : 0n;

    const totalFeeBps = DEFAULT_PROTOCOL_FEE_BPS + DEFAULT_CREATOR_FEE_BPS;
    const feeAmount = (grossSolOut * totalFeeBps) / 10_000n;
    const netSolOut = grossSolOut - feeAmount;

    // Price before
    const priceBefore = vToken > 0n ? Number(vSol) / Number(vToken) : 0;

    // Price after
    const newVSol = vSol - grossSolOut;
    const newVToken = vToken + tokenAmount;
    const priceAfter = newVToken > 0n ? Number(newVSol) / Number(newVToken) : 0;

    // Impact
    const impactBps = priceBefore > 0
        ? Math.round(((priceBefore - priceAfter) / priceBefore) * 10_000)
        : 0;

    return {
        side: 'sell',
        inputAmount: tokenAmount,
        outputAmount: netSolOut > 0n ? netSolOut : 0n,
        estimatedFee: feeAmount,
        priceBefore,
        priceAfter,
        impactBps,
        token,
    };
}

// ============================================================================
// Fee Tiers
// ============================================================================

/**
 * Well-known PumpFun fee tiers (as of June 2025).
 * These are sourced from on-chain FeeConfig. They change infrequently.
 *
 * Note: Actual fees may differ slightly if the on-chain config has been updated.
 * Use /fees to see the estimated tier for a specific token.
 */
const FEE_TIERS: FeeTierInfo[] = [
    { name: 'Micro',    thresholdSol: 0,    protocolFeeBps: 100, creatorFeeBps: 100, totalFeeBps: 200 },
    { name: 'Small',    thresholdSol: 28,   protocolFeeBps: 100, creatorFeeBps: 100, totalFeeBps: 200 },
    { name: 'Medium',   thresholdSol: 56,   protocolFeeBps: 100, creatorFeeBps: 100, totalFeeBps: 200 },
    { name: 'Large',    thresholdSol: 112,  protocolFeeBps: 100, creatorFeeBps: 50,  totalFeeBps: 150 },
    { name: 'Whale',    thresholdSol: 280,  protocolFeeBps: 100, creatorFeeBps: 50,  totalFeeBps: 150 },
];

/**
 * Get the applicable fee tier for a given market cap.
 *
 * @param marketCapSol - Market cap in SOL
 * @returns The matching fee tier
 */
export function getFeeTier(marketCapSol: number): FeeTierInfo {
    let tier = FEE_TIERS[0]!;
    for (const t of FEE_TIERS) {
        if (marketCapSol >= t.thresholdSol) {
            tier = t;
        }
    }
    return tier;
}

/**
 * Get all fee tiers with the current token's tier highlighted.
 *
 * @param token - Token info
 * @returns Array of tiers with `isCurrent` flag
 */
export function getFeeTiersForToken(token: PumpTokenInfo): Array<FeeTierInfo & { isCurrent: boolean }> {
    const currentTier = getFeeTier(token.marketCapSol);
    return FEE_TIERS.map((t) => ({
        ...t,
        isCurrent: t.name === currentTier.name,
    }));
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate bonding curve progress (0-100%).
 */
function getCurveProgress(virtualTokenReserves: bigint, complete: boolean): number {
    if (complete) return 100;
    if (virtualTokenReserves >= INITIAL_VIRTUAL_TOKEN_RESERVES) return 0;
    const progress =
        Number(INITIAL_VIRTUAL_TOKEN_RESERVES - virtualTokenReserves) /
        Number(INITIAL_VIRTUAL_TOKEN_RESERVES) * 100;
    return Math.min(100, Math.max(0, Math.round(progress * 100) / 100));
}

/**
 * Determine token lifecycle stage.
 */
function getStage(progress: number, complete: boolean): PumpTokenInfo['stage'] {
    if (complete) return 'graduated';
    if (progress >= 90) return 'graduating';
    if (progress >= 30) return 'growing';
    return 'new';
}

/**
 * Format SOL amount from lamports to human-readable string.
 */
export function formatSol(lamports: bigint | number): string {
    const val = Number(lamports) / LAMPORTS_PER_SOL;
    if (val >= 1000) return val.toFixed(0);
    if (val >= 1) return val.toFixed(4);
    if (val >= 0.001) return val.toFixed(6);
    return val.toFixed(9);
}

/**
 * Format token amount from raw units to human-readable string.
 */
export function formatTokenAmount(raw: bigint | number): string {
    const val = Number(raw) / ONE_TOKEN;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
    if (val >= 1) return val.toFixed(2);
    return val.toFixed(6);
}

/**
 * Parse a SOL amount string to lamports.
 * Supports: "1.5", "0.001", "1500000000" (if > 1B, treat as lamports)
 */
export function parseSolToLamports(input: string): bigint | null {
    const num = Number(input);
    if (Number.isNaN(num) || num < 0) return null;
    // If the number looks like it's already in lamports (> 10 billion)
    if (num > 10_000_000_000) return BigInt(Math.floor(num));
    // Otherwise treat as SOL
    return BigInt(Math.round(num * LAMPORTS_PER_SOL));
}

/**
 * Parse a token amount string to raw units.
 * Supports: "1000", "1.5M", "500K", "0.5"
 */
export function parseTokenAmount(input: string): bigint | null {
    let num: number;
    const upper = input.toUpperCase();
    if (upper.endsWith('M')) {
        num = Number(upper.slice(0, -1)) * 1_000_000;
    } else if (upper.endsWith('K')) {
        num = Number(upper.slice(0, -1)) * 1_000;
    } else {
        num = Number(input);
    }
    if (Number.isNaN(num) || num < 0) return null;
    return BigInt(Math.round(num * ONE_TOKEN));
}
