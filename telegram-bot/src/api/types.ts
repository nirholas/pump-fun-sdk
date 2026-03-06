/**
 * PumpFun API — Type definitions
 *
 * Request/response types for the scalable REST API.
 */

import type { ClaimType, FeeClaimEvent, MonitorState, WatchEntry } from '../types.js';

// ============================================================================
// API Config
// ============================================================================

export interface ApiConfig {
    /** Port to listen on */
    port: number;
    /** API key(s) for authentication (empty = no auth required) */
    apiKeys: string[];
    /** Enable CORS */
    corsOrigins: string;
    /** Max watches per API key / client */
    maxWatchesPerClient: number;
    /** Rate limit: requests per window */
    rateLimitMax: number;
    /** Rate limit: window duration in ms */
    rateLimitWindowMs: number;
    /** Max claim events to buffer in memory */
    claimBufferSize: number;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationParams {
    page: number;
    limit: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// ============================================================================
// Request Bodies
// ============================================================================

export interface CreateWatchBody {
    /** Solana wallet address to watch */
    wallet: string;
    /** Optional label for the watch */
    label?: string;
    /** Optional: only notify for these token mints */
    tokenFilter?: string[];
    /** Optional: webhook URL to POST claim events to */
    webhookUrl?: string;
}

export interface UpdateWatchBody {
    /** Update label */
    label?: string;
    /** Update active status */
    active?: boolean;
    /** Update token filter */
    tokenFilter?: string[];
    /** Update webhook URL */
    webhookUrl?: string;
}

// ============================================================================
// Response Bodies
// ============================================================================

export interface ApiError {
    error: string;
    code: string;
    statusCode: number;
    details?: unknown;
}

export interface HealthResponse {
    status: 'ok' | 'degraded' | 'down';
    version: string;
    uptime: number;
    monitor: {
        running: boolean;
        mode: string;
        claimsDetected: number;
    };
    watches: {
        total: number;
        active: number;
    };
    timestamp: string;
}

export interface WatchResponse {
    id: string;
    wallet: string;
    label?: string;
    active: boolean;
    tokenFilter?: string[];
    webhookUrl?: string;
    createdAt: string;
    clientId: string;
}

export interface ClaimResponse {
    txSignature: string;
    slot: number;
    timestamp: string;
    claimerWallet: string;
    tokenMint: string;
    tokenName?: string;
    tokenSymbol?: string;
    amountSol: number;
    amountLamports: number;
    claimType: ClaimType;
    isCashback: boolean;
    programId: string;
    claimLabel: string;
}

export interface StatusResponse {
    monitor: MonitorState;
    watches: {
        total: number;
        active: number;
    };
    claims: {
        buffered: number;
        total: number;
    };
    uptime: number;
}

// ============================================================================
// Extended Watch Entry for API (adds client/webhook support)
// ============================================================================

export interface ApiWatchEntry extends WatchEntry {
    /** Which API client/key created this watch */
    clientId: string;
    /** Optional webhook URL to POST events to */
    webhookUrl?: string;
}
