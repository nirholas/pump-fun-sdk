/**
 * PumpFun API — Claim Event Buffer
 *
 * Ring buffer for recent claim events. Supports:
 * - Capped memory usage (configurable max size)
 * - Pagination & filtering for the GET /claims endpoint
 * - SSE subscriber broadcasting for real-time streaming
 *
 * For horizontal scaling, replace with Redis Streams or a message queue.
 */

import { log } from '../logger.js';
import type { FeeClaimEvent } from '../types.js';
import type { ClaimResponse } from './types.js';

/** SSE subscriber callback */
type ClaimSubscriber = (event: ClaimResponse) => void;

export class ClaimBuffer {
    private buffer: ClaimResponse[] = [];
    private maxSize: number;
    private subscribers = new Map<string, ClaimSubscriber>();
    private totalProcessed = 0;

    constructor(maxSize: number = 10_000) {
        this.maxSize = maxSize;
    }

    /** Add a new claim event to the buffer and notify subscribers. */
    push(event: FeeClaimEvent): void {
        const claim = this.toClaimResponse(event);
        this.buffer.push(claim);
        this.totalProcessed++;

        // Evict oldest when buffer is full (ring buffer behavior)
        if (this.buffer.length > this.maxSize) {
            this.buffer.splice(0, this.buffer.length - this.maxSize);
        }

        // Notify all SSE subscribers
        for (const [id, callback] of this.subscribers) {
            try {
                callback(claim);
            } catch (err) {
                log.error('SSE subscriber %s error:', id, err);
                this.subscribers.delete(id);
            }
        }
    }

    /**
     * Query claims with filtering & pagination.
     */
    query(opts: {
        wallet?: string;
        tokenMint?: string;
        claimType?: string;
        isCashback?: boolean;
        minAmountSol?: number;
        maxAmountSol?: number;
        since?: string;
        until?: string;
        page?: number;
        limit?: number;
    }): { data: ClaimResponse[]; total: number } {
        let results = [...this.buffer];

        // Apply filters
        if (opts.wallet) {
            const w = opts.wallet.toLowerCase();
            results = results.filter(
                (c) => c.claimerWallet.toLowerCase() === w,
            );
        }
        if (opts.tokenMint) {
            const m = opts.tokenMint.toLowerCase();
            results = results.filter(
                (c) => c.tokenMint.toLowerCase() === m,
            );
        }
        if (opts.claimType) {
            results = results.filter((c) => c.claimType === opts.claimType);
        }
        if (opts.isCashback !== undefined) {
            results = results.filter((c) => c.isCashback === opts.isCashback);
        }
        if (opts.minAmountSol !== undefined) {
            results = results.filter((c) => c.amountSol >= opts.minAmountSol!);
        }
        if (opts.maxAmountSol !== undefined) {
            results = results.filter((c) => c.amountSol <= opts.maxAmountSol!);
        }
        if (opts.since) {
            const sinceTs = new Date(opts.since).toISOString();
            results = results.filter((c) => c.timestamp >= sinceTs);
        }
        if (opts.until) {
            const untilTs = new Date(opts.until).toISOString();
            results = results.filter((c) => c.timestamp <= untilTs);
        }

        // Sort newest first
        results.reverse();

        const total = results.length;
        const page = opts.page ?? 1;
        const limit = Math.min(opts.limit ?? 50, 100);
        const offset = (page - 1) * limit;

        return {
            data: results.slice(offset, offset + limit),
            total,
        };
    }

    /** Subscribe to real-time claim events (for SSE). Returns unsubscribe function. */
    subscribe(id: string, callback: ClaimSubscriber): () => void {
        this.subscribers.set(id, callback);
        log.debug('SSE subscriber added: %s (total: %d)', id, this.subscribers.size);
        return () => {
            this.subscribers.delete(id);
            log.debug('SSE subscriber removed: %s (total: %d)', id, this.subscribers.size);
        };
    }

    /** Number of buffered claims. */
    get size(): number {
        return this.buffer.length;
    }

    /** Total claims processed since start. */
    get total(): number {
        return this.totalProcessed;
    }

    /** Number of active SSE subscribers. */
    get subscriberCount(): number {
        return this.subscribers.size;
    }

    private toClaimResponse(event: FeeClaimEvent): ClaimResponse {
        return {
            amountLamports: event.amountLamports,
            amountSol: event.amountSol,
            claimLabel: event.claimLabel,
            claimType: event.claimType,
            claimerWallet: event.claimerWallet,
            isCashback: event.isCashback,
            programId: event.programId,
            slot: event.slot,
            timestamp: new Date(event.timestamp * 1000).toISOString(),
            tokenMint: event.tokenMint,
            tokenName: event.tokenName,
            tokenSymbol: event.tokenSymbol,
            txSignature: event.txSignature,
        };
    }
}
