import { describe, expect, it } from 'vitest';

import {
    evidenceForSocialFeePda,
    expandAttributedClaimEvents,
    parseTransactionDistributions,
} from '../claim-monitor.js';
import type { FeeClaimEvent } from '../types.js';

// Real DistributeCreatorFeesEvent from transaction
// 2pm12CDG5c6HxW9Mf6M1RAUd1fpNk9chaGFVDqao9Hhc7kfAEFzRCUVuzKiUrDszP8FNBRECjnNmcuwv5z9Z35kc.
// The old production path incorrectly selected 8XTU…pump (BRAIN) by market cap;
// this event names BfLg…pump and pays the claimed social fee PDA directly.
const DISTRIBUTION_LOG = 'Program data: pTeBcASzyijBZqhqAAAAAJ5nMzBdYdIuj8vj1emKGBHUivIwa4eQTWmV0i7bEdF/QHHHXSvR9TMijBRWsq6PPwupUD7GIM8DnXkNuAeZaHOpQSpP8syuxm28dVnJJc6qu98PCitAA8dr7q1DpR3eqBN1MXZoU/Bb9zbcssnzGcA3RzT/C1tVGSv3KZIhepEOAQAAAOYw0iWaTPRB8GwOxcjIImNzJjZUJHMZ12HChmu3F1yLECf3dr6gAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SOCIAL_FEE_PDA = 'GVZwypRf6VEs65p3dbbAW1dbJmjjiaTqVQam6aAeCzPc';
const EVIDENCED_MINT = 'BfLgqS6vhUpAqTW5EofEB34xeo6KbBXdqRMDXbUepump';

function socialClaim(over: Partial<FeeClaimEvent> = {}): FeeClaimEvent {
    return {
        txSignature: 'sig', slot: 1, timestamp: 1,
        claimerWallet: 'claimer', tokenMint: '', amountSol: 1,
        amountLamports: 1_000_000_000, claimType: 'claim_social_fee_pda',
        isCashback: false, programId: 'pfee', claimLabel: 'social',
        githubUserId: '259645792', socialPlatform: 2,
        socialFeePda: SOCIAL_FEE_PDA,
        ...over,
    };
}

describe('transaction-scoped coin attribution', () => {
    it('decodes the exact mint and recipient share from the real failed attribution', () => {
        const distributions = parseTransactionDistributions([DISTRIBUTION_LOG]);
        const evidence = evidenceForSocialFeePda(distributions, SOCIAL_FEE_PDA);

        expect(evidence).toEqual([expect.objectContaining({
            mint: EVIDENCED_MINT,
            sharingConfig: 'CPhXwTACStFdLakRKRHsoMad7ii2RoDXG9kxwSdsh78T',
            shareBps: 10_000,
            distributedRaw: '11286771447',
            recipientAmountRaw: '11286771447',
            source: 'same_transaction_distribution',
        })]);
    });

    it('does not attribute a distribution to a PDA absent from its shareholders', () => {
        const distributions = parseTransactionDistributions([DISTRIBUTION_LOG]);
        expect(evidenceForSocialFeePda(distributions, '11111111111111111111111111111111')).toEqual([]);
    });

    it('expands multiple evidenced mints into independent pair events', () => {
        const evidence = evidenceForSocialFeePda(parseTransactionDistributions([DISTRIBUTION_LOG]), SOCIAL_FEE_PDA)[0]!;
        const second = { ...evidence, mint: 'SecondMint11111111111111111111111111111111' };
        const events = expandAttributedClaimEvents(socialClaim({ transactionDistributions: [evidence, second] }));

        expect(events.map((event) => event.tokenMint)).toEqual([EVIDENCED_MINT, second.mint]);
        expect(events.every((event) => event.attributionEvidence?.source === 'same_transaction_distribution')).toBe(true);
    });

    it('clears heuristic candidate mints when transaction evidence is absent', () => {
        const [event] = expandAttributedClaimEvents(socialClaim({
            tokenMint: 'HighestMarketCapGuess111111111111111111111111',
            allCandidateMints: ['HighestMarketCapGuess111111111111111111111111'],
        }));
        expect(event?.tokenMint).toBe('');
        expect(event?.attributionEvidence).toBeUndefined();
    });
});
