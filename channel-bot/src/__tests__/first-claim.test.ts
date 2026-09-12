/**
 * The first-or-repeat decision, pinned against real claims. The numbers below
 * come from the live feed's logs and the channel's own cards.
 */

import { describe, it, expect } from 'vitest';

import { formatSkippedClaim, onchainClaimVerdict } from '../first-claim.js';

describe('onchainClaimVerdict', () => {
    it('leaves a claim whose lifetime equals its amount as a first-claim candidate', () => {
        // Card 1086, 2026-08-01: 3.7845 SOL claimed, 3.7845 SOL lifetime.
        expect(onchainClaimVerdict(3_784_500_000, 3_784_500_000, false)).toBe('candidate');
    });

    it('calls a claim repeat when lifetime exceeds the amount, with no lookup needed', () => {
        // github 263723337, 2026-09-12: 0.7414 SOL claimed against 86.5111 SOL lifetime.
        expect(onchainClaimVerdict(741_400_000, 86_511_100_000, false)).toBe('repeat');
    });

    it('tolerates rounding up to one percent and no further', () => {
        expect(onchainClaimVerdict(1_000_000_000, 1_010_000_000, false)).toBe('candidate');
        expect(onchainClaimVerdict(1_000_000_000, 1_010_000_001, false)).toBe('repeat');
    });

    it('leaves a claim with no lifetime field to the local tracker', () => {
        expect(onchainClaimVerdict(500_000_000, undefined, false)).toBe('candidate');
        expect(onchainClaimVerdict(500_000_000, null, false)).toBe('candidate');
    });

    it('marks a fake claim fake whatever the numbers say', () => {
        expect(onchainClaimVerdict(0, 0, true)).toBe('fake');
        expect(onchainClaimVerdict(5_000_000_000, 5_000_000_000, true)).toBe('fake');
    });
});

describe('formatSkippedClaim', () => {
    it('prints both numbers in the shape the audit tooling matches', () => {
        const line = formatSkippedClaim('repeat', {
            githubUserId: '263723337',
            amountLamports: 741_400_000,
            lifetimeClaimedLamports: 86_511_100_000,
            txSignature: '2LRep5nZypdVsynthetic',
        }, '6wRM3pvVsynthetic');
        expect(line).toBe(
            'Skipped repeat claim: github=263723337 mint=6wRM3pvV amount=0.7414 SOL lifetime=86.5111 SOL tx=2LRep5nZypdV',
        );
    });

    it('says unknown and unresolved rather than printing blanks', () => {
        const line = formatSkippedClaim('fake', {
            amountLamports: 0,
            txSignature: 'abcdefghijklmnop',
        }, '');
        expect(line).toBe(
            'Skipped fake claim: github=unknown mint=unresolved amount=0.0000 SOL lifetime=unknown SOL tx=abcdefghijkl',
        );
    });
});
