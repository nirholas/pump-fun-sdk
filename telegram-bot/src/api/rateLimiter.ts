/**
 * PumpFun API — Rate Limiter
 *
 * Sliding-window rate limiter using in-memory Map.
 * Scales per-client (API key or IP) for fair usage.
 *
 * For horizontal scaling beyond a single process, swap this
 * for a Redis-backed limiter (e.g. @hono/rate-limiter with ioredis).
 */

import type { ApiConfig } from './types.js';

interface RateBucket {
    /** Timestamps of requests within the current window */
    timestamps: number[];
    /** When this bucket was last cleaned */
    lastClean: number;
}

export class RateLimiter {
    private buckets = new Map<string, RateBucket>();
    private maxRequests: number;
    private windowMs: number;
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor(config: ApiConfig) {
        this.maxRequests = config.rateLimitMax;
        this.windowMs = config.rateLimitWindowMs;

        // Periodic cleanup of stale buckets (every 60s)
        this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    }

    /**
     * Check if a request is allowed for the given client key.
     * Returns { allowed, remaining, resetMs }.
     */
    check(clientKey: string): {
        allowed: boolean;
        remaining: number;
        resetMs: number;
        limit: number;
    } {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        let bucket = this.buckets.get(clientKey);
        if (!bucket) {
            bucket = { timestamps: [], lastClean: now };
            this.buckets.set(clientKey, bucket);
        }

        // Remove timestamps outside the window
        bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
        bucket.lastClean = now;

        const count = bucket.timestamps.length;
        const allowed = count < this.maxRequests;
        const remaining = Math.max(0, this.maxRequests - count - (allowed ? 1 : 0));

        // Earliest expiring timestamp determines reset time
        const resetMs =
            bucket.timestamps.length > 0
                ? bucket.timestamps[0] + this.windowMs - now
                : this.windowMs;

        if (allowed) {
            bucket.timestamps.push(now);
        }

        return {
            allowed,
            limit: this.maxRequests,
            remaining,
            resetMs: Math.max(0, Math.ceil(resetMs)),
        };
    }

    /** Remove stale buckets (no activity for 2x the window). */
    private cleanup(): void {
        const cutoff = Date.now() - this.windowMs * 2;
        for (const [key, bucket] of this.buckets) {
            if (bucket.lastClean < cutoff) {
                this.buckets.delete(key);
            }
        }
    }

    /** Total number of tracked clients. */
    get clientCount(): number {
        return this.buckets.size;
    }

    stop(): void {
        clearInterval(this.cleanupInterval);
    }
}
