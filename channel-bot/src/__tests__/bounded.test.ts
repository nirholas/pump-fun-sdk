/**
 * mapBounded is what stands between one prolific dev and a stalled claim
 * handler, so these pin the three properties that matter: the cap holds, the
 * deadline returns partial results instead of waiting, and failures are absorbed.
 */

import { describe, it, expect } from 'vitest';

import { mapBounded } from '../bounded.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const never = <T>() => new Promise<T>(() => {});

describe('mapBounded', () => {
    it('never has more tasks in flight than the cap', async () => {
        let inFlight = 0;
        let peak = 0;
        const out = await mapBounded(Array.from({ length: 40 }, (_, i) => i), async (n) => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await sleep(2);
            inFlight--;
            return n;
        }, { concurrency: 6, deadlineMs: 5_000 });

        expect(peak).toBeLessThanOrEqual(6);
        expect(out.results).toHaveLength(40);
        expect(out.settled).toBe(40);
        expect(out.timedOut).toBe(false);
    });

    it('returns what finished at the deadline instead of waiting on the rest', async () => {
        // The 354-linked-coin case from 2026-09-12: a few lookups answer, the
        // rest hang on a throttled API.
        const started = Date.now();
        const out = await mapBounded(Array.from({ length: 354 }, (_, i) => i), async (n) => {
            if (n < 5) return n;
            return never<number>();
        }, { concurrency: 6, deadlineMs: 80 });

        expect(Date.now() - started).toBeLessThan(1_000);
        expect(out.timedOut).toBe(true);
        expect(out.results).toEqual([0, 1, 2, 3, 4]);
    });

    it('counts a rejected task as settled and keeps going', async () => {
        const out = await mapBounded([1, 2, 3, 4], async (n) => {
            if (n % 2 === 0) throw new Error('throttled');
            return n;
        }, { concurrency: 2, deadlineMs: 1_000 });

        expect([...out.results].sort()).toEqual([1, 3]);
        expect(out.settled).toBe(4);
        expect(out.timedOut).toBe(false);
    });

    it('resolves at once for an empty batch', async () => {
        const out = await mapBounded([], async (n: number) => n, { concurrency: 6, deadlineMs: 10_000 });
        expect(out).toEqual({ results: [], settled: 0, timedOut: false });
    });

    it('runs a nonsensical concurrency as one lane rather than hanging', async () => {
        const out = await mapBounded([1, 2, 3], async (n) => n, { concurrency: Number.NaN, deadlineMs: 500 });
        expect(out.results).toEqual([1, 2, 3]);
        expect(out.timedOut).toBe(false);
    });
});
