/**
 * The channel policy is the failsafe under the feed profiles: the send
 * boundary refuses content the channel is not for, however it got there.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
    ALLOWED_POSTS,
    ChannelPolicyError,
    assertPostAllowed,
    isPostAllowed,
    resetPolicyReports,
    type PostKind,
} from '../channel-policy.js';

const EVERY_KIND: PostKind[] = [
    'github_first_claim', 'creator_claim', 'graduation', 'launch', 'whale', 'fee_distribution', 'follow_up',
];

describe('channel policy', () => {
    let errSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        const { log } = await import('../logger.js');
        errSpy = vi.spyOn(log, 'error').mockImplementation(() => {});
        resetPolicyReports();
    });

    afterEach(() => errSpy.mockRestore());

    it('the github-first-claims channel accepts only first claims and their follow-ups', () => {
        for (const kind of EVERY_KIND) {
            const expected = kind === 'github_first_claim' || kind === 'follow_up';
            expect(isPostAllowed('github-first-claims', kind), kind).toBe(expected);
        }
    });

    it('a plain creator-fee claim is refused there, which is the 2026-09-11 leak', () => {
        expect(() => assertPostAllowed('github-first-claims', 'creator_claim')).toThrow(ChannelPolicyError);
    });

    it('the graduations channel accepts only graduations and their follow-ups', () => {
        for (const kind of EVERY_KIND) {
            const expected = kind === 'graduation' || kind === 'follow_up';
            expect(isPostAllowed('graduations', kind), kind).toBe(expected);
        }
    });

    it('without a profile the toggles are the policy and nothing is refused here', () => {
        for (const kind of EVERY_KIND) expect(isPostAllowed(undefined, kind)).toBe(true);
    });

    it('logs a refused kind once, then keeps refusing silently', () => {
        for (let i = 0; i < 5; i++) {
            expect(() => assertPostAllowed('github-first-claims', 'whale')).toThrow();
        }
        expect(errSpy).toHaveBeenCalledTimes(1);
        expect(() => assertPostAllowed('github-first-claims', 'launch')).toThrow();
        expect(errSpy).toHaveBeenCalledTimes(2);
    });

    it('every profile has an explicit allow-list', () => {
        for (const [profile, allowed] of Object.entries(ALLOWED_POSTS)) {
            expect(allowed.size, profile).toBeGreaterThan(0);
            expect(allowed.has('follow_up'), profile).toBe(true);
        }
    });
});
