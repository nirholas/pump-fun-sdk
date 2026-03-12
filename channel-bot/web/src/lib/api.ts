/**
 * @pumpkit/web — API Client
 *
 * Functions for interacting with the @pumpkit/monitor REST API.
 */

import type { ClaimEvent, HealthResponse, PaginatedResponse, WatchResponse } from './types.js';

const DEFAULT_BASE_URL = 'http://localhost:3000';

function getBaseUrl(): string {
    return import.meta.env.VITE_API_URL || DEFAULT_BASE_URL;
}

// ── Health ──────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<HealthResponse> {
    const res = await fetch(`${getBaseUrl()}/api/v1/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
}

// ── Watches ─────────────────────────────────────────────────────────

export async function fetchWatches(): Promise<WatchResponse[]> {
    const res = await fetch(`${getBaseUrl()}/api/v1/watches`);
    if (!res.ok) throw new Error(`Failed to fetch watches: ${res.status}`);
    return res.json();
}

export async function addWatch(address: string, label?: string): Promise<WatchResponse> {
    const res = await fetch(`${getBaseUrl()}/api/v1/watches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, label }),
    });
    if (!res.ok) throw new Error(`Failed to add watch: ${res.status}`);
    return res.json();
}

export async function removeWatch(address: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/v1/watches/${encodeURIComponent(address)}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to remove watch: ${res.status}`);
}

// ── Claims ──────────────────────────────────────────────────────────

export async function fetchClaims(page = 1, limit = 50): Promise<PaginatedResponse<ClaimEvent>> {
    const url = new URL(`${getBaseUrl()}/api/v1/claims`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch claims: ${res.status}`);
    return res.json();
}

// ── SSE Stream ──────────────────────────────────────────────────────

export function createClaimStream(onEvent: (event: ClaimEvent) => void): EventSource {
    const source = new EventSource(`${getBaseUrl()}/api/v1/claims/stream`);

    source.onmessage = (msg) => {
        try {
            const event = JSON.parse(msg.data) as ClaimEvent;
            onEvent(event);
        } catch {
            console.warn('Failed to parse SSE event:', msg.data);
        }
    };

    source.onerror = () => {
        console.warn('SSE connection error — will auto-reconnect');
    };

    return source;
}
