/**
 * PumpFun Channel Bot — RPC Connection Manager with Fallback
 *
 * Manages multiple Solana RPC endpoints and automatically rotates
 * to the next URL when the current one fails (429, 5xx, timeout).
 */

import { Connection, type ConnectionConfig } from '@solana/web3.js';
import { log } from './logger.js';

const MAX_CONSECUTIVE_FAILS = 3;
const COOLDOWN_MS = 60_000;

export class RpcFallback {
    private readonly urls: string[];
    private currentIndex = 0;
    private connections = new Map<number, Connection>();
    private failCounts = new Map<number, number>();
    private cooldownUntil = new Map<number, number>();
    private readonly connectionConfig: ConnectionConfig;

    constructor(urls: string[], config: ConnectionConfig = { commitment: 'confirmed' }) {
        if (urls.length === 0) throw new Error('At least one RPC URL is required');
        this.urls = [...urls];
        this.connectionConfig = config;
    }

    /** Number of configured RPC endpoints */
    get size(): number {
        return this.urls.length;
    }

    /** Current active RPC URL */
    get currentUrl(): string {
        return this.urls[this.currentIndex]!;
    }

    /** Get (or create) a Connection for the current RPC URL */
    getConnection(): Connection {
        let conn = this.connections.get(this.currentIndex);
        if (!conn) {
            conn = new Connection(this.urls[this.currentIndex]!, this.connectionConfig);
            this.connections.set(this.currentIndex, conn);
        }
        return conn;
    }

    /** Report a successful call — resets the fail counter for the current endpoint */
    reportSuccess(): void {
        this.failCounts.set(this.currentIndex, 0);
    }

    /** Report a failed call — rotates after MAX_CONSECUTIVE_FAILS */
    reportFailure(): boolean {
        const count = (this.failCounts.get(this.currentIndex) ?? 0) + 1;
        this.failCounts.set(this.currentIndex, count);

        if (count >= MAX_CONSECUTIVE_FAILS && this.urls.length > 1) {
            this.cooldownUntil.set(this.currentIndex, Date.now() + COOLDOWN_MS);
            this.rotate();
            return true; // rotated
        }
        return false;
    }

    /** Rotate to the next available endpoint */
    private rotate(): void {
        const prev = this.currentIndex;
        const now = Date.now();

        for (let i = 1; i < this.urls.length; i++) {
            const candidate = (this.currentIndex + i) % this.urls.length;
            const until = this.cooldownUntil.get(candidate) ?? 0;
            if (now >= until) {
                this.currentIndex = candidate;
                break;
            }
        }

        // If all endpoints are in cooldown, pick the one with the earliest expiry
        if (this.currentIndex === prev && this.urls.length > 1) {
            let earliest = Infinity;
            let best = (prev + 1) % this.urls.length;
            for (let i = 0; i < this.urls.length; i++) {
                if (i === prev) continue;
                const until = this.cooldownUntil.get(i) ?? 0;
                if (until < earliest) {
                    earliest = until;
                    best = i;
                }
            }
            this.currentIndex = best;
        }

        if (this.currentIndex !== prev) {
            log.warn(
                'RPC fallback: %s → %s',
                maskUrl(this.urls[prev]!),
                maskUrl(this.urls[this.currentIndex]!),
            );
        }
    }

    /**
     * Execute an RPC call with automatic fallback across all endpoints.
     * Tries each endpoint once before giving up.
     */
    async withFallback<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
        let lastErr: unknown;

        for (let attempt = 0; attempt < this.urls.length; attempt++) {
            try {
                const result = await fn(this.getConnection());
                this.reportSuccess();
                return result;
            } catch (err) {
                lastErr = err;
                const msg = String(err);
                const isRetryable =
                    (msg.includes('429') ||
                    msg.includes('502') ||
                    msg.includes('503') ||
                    msg.includes('504') ||
                    msg.includes('ETIMEDOUT') ||
                    msg.includes('ECONNREFUSED') ||
                    msg.includes('ECONNRESET') ||
                    msg.includes('fetch failed')) &&
                    !msg.includes('403');

                if (isRetryable && attempt < this.urls.length - 1) {
                    log.warn(
                        'RPC call failed on %s (%s), trying next endpoint',
                        maskUrl(this.currentUrl),
                        msg.slice(0, 80),
                    );
                    this.reportFailure();
                    continue;
                }

                // Non-retryable or last attempt — propagate
                if (isRetryable) this.reportFailure();
                throw err;
            }
        }

        throw lastErr;
    }
}

export function maskUrl(url: string): string {
    try {
        const u = new URL(url);
        const path = u.pathname.length > 1 ? u.pathname.slice(0, 12) + '…' : '';
        return `${u.hostname}${path}`;
    } catch {
        return url.slice(0, 30) + '…';
    }
}
