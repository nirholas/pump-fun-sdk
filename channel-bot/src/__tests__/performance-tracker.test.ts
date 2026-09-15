/**
 * Tests for the follow-up performance tracker: milestone selection, collapse
 * detection, one-shot announcements, and window expiry.
 */

import { describe, it, expect, vi } from 'vitest';

import {
    PerformanceTracker,
    nextMilestone,
    formatMilestoneUpdate,
    formatCollapseUpdate,
    type TrackedPost,
} from '../performance-tracker.js';

const MINT = 'MintSynthetic1111111111111111111111111111111';

function post(over: Partial<TrackedPost> = {}): TrackedPost {
    return {
        mint: MINT,
        messageId: 42,
        symbol: 'TEST',
        baselineMcapUsd: 10_000,
        postedAt: Date.now(),
        announced: [],
        peakMcapUsd: 10_000,
        closed: false,
        ...over,
    };
}

// Each tracker instance writes state under DATA_DIR; point it at a temp dir so
// tests never touch the real bot's data.
process.env.DATA_DIR = process.env.DATA_DIR ?? '/tmp/channel-bot-test-data';

describe('nextMilestone', () => {
    const milestones = [2, 5, 10, 25, 50, 100];

    it('returns null below the first milestone', () => {
        expect(nextMilestone(post(), 1.8, milestones)).toBeNull();
    });

    it('returns the milestone just crossed', () => {
        expect(nextMilestone(post(), 2.3, milestones)).toBe(2);
    });

    it('announces only the highest when several are crossed at once', () => {
        // A token that 12x'd between sweeps should not fire 2x, 5x and 10x.
        expect(nextMilestone(post(), 12, milestones)).toBe(10);
    });

    it('never repeats an announced milestone', () => {
        expect(nextMilestone(post({ announced: [2] }), 2.5, milestones)).toBeNull();
        expect(nextMilestone(post({ announced: [2] }), 5.1, milestones)).toBe(5);
    });
});

describe('update formatting', () => {
    it('states the multiple, both market caps, and the elapsed time', () => {
        const now = Date.now();
        const text = formatMilestoneUpdate(post({ postedAt: now - 25 * 60_000 }), 5, 50_000, now);
        expect(text).toContain('$TEST 5x since this call');
        expect(text).toContain('$10.0K');
        expect(text).toContain('$50.0K');
        expect(text).toContain('25m');
    });

    it('reports a collapse with the drawdown and prior peak', () => {
        const now = Date.now();
        const text = formatCollapseUpdate(
            post({ postedAt: now - 2 * 3_600_000, peakMcapUsd: 90_000 }),
            1_000,
            now,
        );
        expect(text).toContain('-90%');
        expect(text).toContain('2h');
        expect(text).toContain('Peak was $90.0K');
    });
});

describe('PerformanceTracker', () => {
    it('ignores dust baselines that would fake huge multiples', () => {
        const tracker = new PerformanceTracker({ statePath: null, postUpdate: async () => {}, minBaselineUsd: 1_000 });
        tracker.track({ mint: MINT, messageId: 1, symbol: 'A', mcapUsd: 50 });
        expect(tracker.activeCount).toBe(0);
    });

    it('ignores a post with no message id, since a reply would have no target', () => {
        const tracker = new PerformanceTracker({ statePath: null, postUpdate: async () => {} });
        tracker.track({ mint: MINT, messageId: 0, symbol: 'A', mcapUsd: 50_000 });
        expect(tracker.activeCount).toBe(0);
    });

    it('posts a milestone reply to the original message exactly once', async () => {
        const postUpdate = vi.fn(async (_text: string, _replyTo: number) => {});
        const tracker = new PerformanceTracker({ statePath: null,
            postUpdate,
            fetchMcap: async () => 30_000,
            milestones: [2, 5],
        });
        tracker.track({ mint: MINT, messageId: 99, symbol: 'A', mcapUsd: 10_000 });

        await tracker.sweep();
        expect(postUpdate).toHaveBeenCalledTimes(1);
        expect(postUpdate.mock.calls[0]![1]).toBe(99);
        expect(String(postUpdate.mock.calls[0]![0])).toContain('2x');

        // Same price on the next sweep must not re-announce.
        await tracker.sweep();
        expect(postUpdate).toHaveBeenCalledTimes(1);
        expect(tracker.stats.milestonesPosted).toBe(1);
    });

    it('never announces a lower milestone after a higher one', async () => {
        const postUpdate = vi.fn(async (_text: string, _replyTo: number) => {});
        let mcap = 60_000;
        const tracker = new PerformanceTracker({ statePath: null,
            postUpdate,
            fetchMcap: async () => mcap,
            milestones: [2, 5, 10],
        });
        tracker.track({ mint: MINT, messageId: 99, symbol: 'A', mcapUsd: 10_000 });

        await tracker.sweep();
        expect(String(postUpdate.mock.calls[0]![0])).toContain('5x');
        mcap = 70_000;
        await tracker.sweep();
        expect(postUpdate).toHaveBeenCalledTimes(1);
    });

    it('announces a collapse and then stops tracking the call', async () => {
        const postUpdate = vi.fn(async (_text: string, _replyTo: number) => {});
        const tracker = new PerformanceTracker({ statePath: null, postUpdate, fetchMcap: async () => 1_000, collapsePct: 80 });
        tracker.track({ mint: MINT, messageId: 7, symbol: 'A', mcapUsd: 50_000 });

        await tracker.sweep();
        expect(postUpdate).toHaveBeenCalledTimes(1);
        expect(String(postUpdate.mock.calls[0]![0])).toContain('💀');
        expect(tracker.stats.collapsesPosted).toBe(1);

        await tracker.sweep();
        expect(postUpdate).toHaveBeenCalledTimes(1);
        expect(tracker.activeCount).toBe(0);
    });

    it('drops calls once the tracking window closes', async () => {
        const tracker = new PerformanceTracker({ statePath: null,
            postUpdate: async () => {},
            fetchMcap: async () => 20_000,
            windowHours: 1,
        });
        tracker.track({ mint: MINT, messageId: 5, symbol: 'A', mcapUsd: 10_000 });
        await tracker.sweep(Date.now() + 2 * 3_600_000);
        expect(tracker.activeCount).toBe(0);
        expect(tracker.stats.expired).toBe(1);
    });

    it('survives a lookup failure without losing the call', async () => {
        const tracker = new PerformanceTracker({ statePath: null,
            postUpdate: async () => {},
            fetchMcap: async () => { throw new Error('rpc down'); },
        });
        tracker.track({ mint: MINT, messageId: 5, symbol: 'A', mcapUsd: 10_000 });
        await expect(tracker.sweep()).resolves.toBeUndefined();
        expect(tracker.activeCount).toBe(1);
    });

    it('ignores an unpriceable token rather than calling it a collapse', async () => {
        const postUpdate = vi.fn(async (_text: string, _replyTo: number) => {});
        const tracker = new PerformanceTracker({ statePath: null, postUpdate, fetchMcap: async () => null });
        tracker.track({ mint: MINT, messageId: 5, symbol: 'A', mcapUsd: 10_000 });
        await tracker.sweep();
        expect(postUpdate).not.toHaveBeenCalled();
        expect(tracker.activeCount).toBe(1);
    });

    it('evicts the oldest call past the cap', () => {
        const tracker = new PerformanceTracker({ statePath: null, postUpdate: async () => {}, maxTracked: 2 });
        tracker.track({ mint: 'MintA1111', messageId: 1, symbol: 'A', mcapUsd: 10_000 });
        tracker.track({ mint: 'MintB2222', messageId: 2, symbol: 'B', mcapUsd: 10_000 });
        tracker.track({ mint: 'MintC3333', messageId: 3, symbol: 'C', mcapUsd: 10_000 });
        expect(tracker.activeCount).toBe(2);
    });
});

describe('dev position monitoring', () => {
    it('announces a dev selling down their position, once', async () => {
        const postUpdate = vi.fn(async (_text: string, _replyTo: number) => {});
        const tracker = new PerformanceTracker({ statePath: null,
            postUpdate,
            fetchMcap: async () => 11_000,
            fetchDevPct: async () => 1,
            devDumpPct: 30,
        });
        tracker.track({
            mint: MINT, messageId: 33, symbol: 'A', mcapUsd: 10_000,
            devWallet: 'DevSynthetic1111', devPct: 8,
        });

        await tracker.sweep();
        expect(postUpdate).toHaveBeenCalledTimes(1);
        const text = String(postUpdate.mock.calls[0]![0]);
        expect(text).toContain('dev is selling');
        expect(text).toContain('8.0%');
        expect(text).toContain('1.0%');
        expect(tracker.stats.devDumpsPosted).toBe(1);

        await tracker.sweep();
        expect(postUpdate).toHaveBeenCalledTimes(1);
    });

    it('stays quiet when the dev trims a little', async () => {
        const postUpdate = vi.fn(async (_text: string, _replyTo: number) => {});
        const tracker = new PerformanceTracker({ statePath: null,
            postUpdate,
            fetchMcap: async () => 11_000,
            fetchDevPct: async () => 7.5,
            devDumpPct: 30,
        });
        tracker.track({
            mint: MINT, messageId: 33, symbol: 'A', mcapUsd: 10_000,
            devWallet: 'DevSynthetic1111', devPct: 8,
        });
        await tracker.sweep();
        expect(postUpdate).not.toHaveBeenCalled();
    });

    it('ignores devs whose starting position was already negligible', async () => {
        const fetchDevPct = vi.fn(async () => 0);
        const tracker = new PerformanceTracker({ statePath: null,
            postUpdate: async () => {},
            fetchMcap: async () => 11_000,
            fetchDevPct,
            minDevPct: 0.5,
        });
        tracker.track({
            mint: MINT, messageId: 33, symbol: 'A', mcapUsd: 10_000,
            devWallet: 'DevSynthetic1111', devPct: 0.1,
        });
        await tracker.sweep();
        expect(fetchDevPct).not.toHaveBeenCalled();
    });

    it('does not check the dev when no wallet was recorded', async () => {
        const fetchDevPct = vi.fn(async () => 0);
        const tracker = new PerformanceTracker({ statePath: null,
            postUpdate: async () => {}, fetchMcap: async () => 11_000, fetchDevPct,
        });
        tracker.track({ mint: MINT, messageId: 33, symbol: 'A', mcapUsd: 10_000 });
        await tracker.sweep();
        expect(fetchDevPct).not.toHaveBeenCalled();
    });
});
