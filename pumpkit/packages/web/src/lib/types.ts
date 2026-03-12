/**
 * @pumpkit/web — API Types
 *
 * TypeScript types matching the @pumpkit/monitor REST API responses.
 * These mirror packages/monitor/src/api/types.ts for frontend consumption.
 */

// ── Event Types ─────────────────────────────────────────────────────

export type EventType = 'claim' | 'launch' | 'graduation' | 'whale' | 'cto' | 'distribution';

export interface BaseEvent {
    type: EventType;
    txSignature: string;
    slot: number;
    timestamp: string;
}

export interface ClaimEvent extends BaseEvent {
    type: 'claim';
    claimerWallet: string;
    tokenMint: string;
    tokenName?: string;
    tokenSymbol?: string;
    amountSol: number;
    claimType: 'creator_fee' | 'cashback' | 'social_fee';
    isCashback: boolean;
}

export interface LaunchEvent extends BaseEvent {
    type: 'launch';
    tokenMint: string;
    name: string;
    symbol: string;
    creator: string;
    isCashback: boolean;
}

export interface GraduationEvent extends BaseEvent {
    type: 'graduation';
    tokenMint: string;
    tokenName?: string;
    pool?: string;
}

export interface WhaleEvent extends BaseEvent {
    type: 'whale';
    direction: 'buy' | 'sell';
    amountSol: number;
    tokenMint: string;
    wallet: string;
}

export interface CTOEvent extends BaseEvent {
    type: 'cto';
    tokenMint: string;
    oldCreator: string;
    newCreator: string;
}

export interface DistributionEvent extends BaseEvent {
    type: 'distribution';
    tokenMint: string;
    shareholders: Array<{ address: string; amountSol: number }>;
}

export type PumpEvent = ClaimEvent | LaunchEvent | GraduationEvent | WhaleEvent | CTOEvent | DistributionEvent;

// ── API Responses ───────────────────────────────────────────────────

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
    createdAt: string;
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
