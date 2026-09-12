/**
 * The first-or-repeat decision, pinned against real claims from the live feed's
 * logs, the channel's cards, and a 7-day scan of the GitHub claim verifier.
 */

import { describe, it, expect } from 'vitest';

import { formatSkippedClaim, isSolQuote, onchainClaimVerdict } from '../first-claim.js';

const SOL = '11111111111111111111111111111111';
const WSOL = 'So11111111111111111111111111111111111111112';
const STABLE = 'StableQuoteSynthetic111111111111111111111111';

describe('onchainClaimVerdict', () => {
    it('leaves a SOL claim whose lifetime equals its amount as a candidate', () => {
        // Card 1086, 2026-08-01: 3.7845 SOL claimed, 3.7845 SOL lifetime.
        expect(onchainClaimVerdict({ amount: 3_784_500_000, lifetimeSol: 3_784_500_000, lifetimeStable: 0, quoteMint: SOL, isFake: false }))
            .toBe('candidate');
    });

    it('calls a SOL claim repeat when its SOL lifetime exceeds the amount', () => {
        // github 263723337, 2026-09-12: 0.7414 SOL claimed against 86.5111 SOL lifetime.
        expect(onchainClaimVerdict({ amount: 741_400_000, lifetimeSol: 86_511_100_000, lifetimeStable: 0, quoteMint: SOL, isFake: false }))
            .toBe('repeat');
    });

    it('calls a stablecoin claim by a veteran repeat, though the SOL counter looks untouched', () => {
        // tx 4wZjxJTe, 2026-09-11 22:34: 203.7353 claimed in a non-SOL quote,
        // SOL lifetime 157.8883, stable lifetime 327.9815. Reading only the SOL
        // counter called this a first-ever claim.
        expect(onchainClaimVerdict({
            amount: 203_735_300_000,
            lifetimeSol: 157_888_300_000,
            lifetimeStable: 327_981_500_000,
            quoteMint: STABLE,
            isFake: false,
        })).toBe('repeat');
    });

    it('calls a SOL claim repeat when the dev has already claimed in a stable asset', () => {
        expect(onchainClaimVerdict({ amount: 2_000_000_000, lifetimeSol: 2_000_000_000, lifetimeStable: 50_000_000, quoteMint: SOL, isFake: false }))
            .toBe('repeat');
    });

    it('accepts a genuine first claim paid in a stable asset', () => {
        expect(onchainClaimVerdict({ amount: 5_000_000_000, lifetimeSol: 0, lifetimeStable: 5_000_000_000, quoteMint: STABLE, isFake: false }))
            .toBe('candidate');
    });

    it('refuses to call a stable-asset claim first without its stable counter', () => {
        expect(onchainClaimVerdict({ amount: 5_000_000_000, lifetimeSol: 0, quoteMint: STABLE, isFake: false }))
            .toBe('repeat');
    });

    it('treats wrapped SOL as SOL', () => {
        expect(onchainClaimVerdict({ amount: 1_000_000_000, lifetimeSol: 1_000_000_000, lifetimeStable: 0, quoteMint: WSOL, isFake: false }))
            .toBe('candidate');
    });

    it('tolerates rounding up to one percent and no further', () => {
        expect(onchainClaimVerdict({ amount: 1_000_000_000, lifetimeSol: 1_010_000_000, isFake: false })).toBe('candidate');
        expect(onchainClaimVerdict({ amount: 1_000_000_000, lifetimeSol: 1_010_000_001, isFake: false })).toBe('repeat');
    });

    it('leaves a pre-V2 event with no lifetime fields to the local tracker', () => {
        expect(onchainClaimVerdict({ amount: 500_000_000, isFake: false })).toBe('candidate');
    });

    it('marks a fake claim fake whatever the numbers say', () => {
        expect(onchainClaimVerdict({ amount: 0, lifetimeSol: 0, isFake: true })).toBe('fake');
    });
});

describe('isSolQuote', () => {
    it('recognises the SOL markers and treats a missing mint as a SOL-only event', () => {
        expect(isSolQuote(SOL)).toBe(true);
        expect(isSolQuote(WSOL)).toBe(true);
        expect(isSolQuote(undefined)).toBe(true);
        expect(isSolQuote(STABLE)).toBe(false);
    });
});

describe('formatSkippedClaim', () => {
    it('prints every counter, starting with Skipped and ending with the tx prefix', () => {
        const line = formatSkippedClaim('repeat', {
            githubUserId: '263723337',
            amountLamports: 741_400_000,
            lifetimeClaimedLamports: 86_511_100_000,
            lifetimeStableClaimedRaw: 0,
            quoteMint: SOL,
            txSignature: '2LRep5nZypdVsynthetic',
        }, '6wRM3pvVsynthetic');
        expect(line).toBe(
            'Skipped repeat claim: github=263723337 mint=6wRM3pvV amount=0.7414 SOL lifetime=86.5111 SOL stableLifetime=0.0000 tx=2LRep5nZypdV',
        );
    });

    it('labels a non-SOL amount by its quote mint instead of calling it SOL', () => {
        const line = formatSkippedClaim('repeat', {
            githubUserId: '268538016',
            amountLamports: 203_735_300_000,
            lifetimeClaimedLamports: 157_888_300_000,
            lifetimeStableClaimedRaw: 327_981_500_000,
            quoteMint: STABLE,
            txSignature: '4wZjxJTeBjpfsynthetic',
        }, '');
        expect(line).toBe(
            'Skipped repeat claim: github=268538016 mint=unresolved amount=203.7353 StableQu lifetime=157.8883 SOL stableLifetime=327.9815 tx=4wZjxJTeBjpf',
        );
    });

    it('says unknown rather than printing blanks', () => {
        const line = formatSkippedClaim('fake', { amountLamports: 0, txSignature: 'abcdefghijklmnop' }, '');
        expect(line).toBe(
            'Skipped fake claim: github=unknown mint=unresolved amount=0.0000 SOL lifetime=unknown SOL stableLifetime=unknown tx=abcdefghijkl',
        );
    });
});
