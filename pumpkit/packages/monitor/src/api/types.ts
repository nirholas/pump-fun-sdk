/**
 * Monitor Bot API — Type definitions
 *
 * Request/response types for the REST API with SSE + webhooks.
 */

import type { ClaimType, FeeClaimEvent, MonitorState, WatchEntry } from '../types.js';

// Re-export for convenience
export type { ClaimType, FeeClaimEvent, MonitorState, WatchEntry };

// ============================================================================
// API Config
// ============================================================================

export interface ApiConfig {
    /** Port to listen on */
    port: number;
    /** Bearer token for authentication (empty = no auth required) */
    bearerToken: string;
    /** Enable CORS */
    corsOrigins: string;
    /** Max watches per client */
    maxWatchesPerClient: number;
    /** Rate limit: requests per window */
    rateLimitMax: number;
    /** Rate limit: window duration in ms */
    rateLimitWindowMs: number;
    /** Max claim events to buffer in memory */
    claimBufferSize: number;
    /** Max launch events to buffer in memory */
    launchBufferSize: number;
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

export interface RegisterWebhookBody {
    /** URL to POST events to */
    url: string;
    /** Event types to subscribe to (default: all) */
    events?: string[];
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
    uptime: number;
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

export interface LaunchResponse {
    txSignature: string;
    slot: number;
    timestamp: string;
    mintAddress: string;
    creatorWallet: string;
    name: string;
    symbol: string;
    description: string;
    metadataUri: string;
    hasGithub: boolean;
    githubUrls: string[];
    mayhemMode: boolean;
    cashbackEnabled: boolean;
}

export interface StatusResponse {
    monitor: {
        running: boolean;
        mode: string;
        claimsDetected: number;
    };
    watches: {
        total: number;
        active: number;
    };
    claims: {
        buffered: number;
        total: number;
    };
    launches: {
        buffered: number;
        total: number;
    };
    uptime: number;
}

export interface WebhookRegistration {
    id: string;
    url: string;
    events: string[];
    createdAt: string;
    clientId: string;
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

