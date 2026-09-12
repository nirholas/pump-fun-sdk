/**
 * Quote currency handling for claim cards. The mint shapes below mirror real
 * jsonParsed getAccountInfo answers for a token-2022 xStock and an spl-token.
 */

import { describe, it, expect } from 'vitest';

import { applyQuoteAsset, quoteAssetFromParsedMint, resolveQuoteAsset } from '../quote-asset.js';
import { claimAmountLines } from '../formatters.js';
import { QUOTE_MINT_INFO, SOL_NATIVE_QUOTE, type FeeClaimEvent } from '../types.js';

const token2022 = {
    data: { parsed: { info: { decimals: 8, extensions: [{ extension: 'tokenMetadata', state: { symbol: 'TSLAx' } }] } } },
};
const splToken = { data: { parsed: { info: { decimals: 9 } } } };

describe('quoteAssetFromParsedMint', () => {
    it('takes decimals and symbol from a token-2022 mint with metadata', () => {
        expect(quoteAssetFromParsedMint('XsSyntheticMint', token2022)).toEqual({ ticker: 'TSLAx', decimals: 8, isStable: false });
    });

    it('names an spl-token mint without metadata by its address', () => {
        expect(quoteAssetFromParsedMint('AbCdEfSyntheticMint', splToken)).toEqual({ ticker: 'AbCdEf', decimals: 9, isStable: false });
    });

    it('returns null for an account that is not a mint', () => {
        expect(quoteAssetFromParsedMint('x', { data: { parsed: { info: {} } } })).toBeNull();
        expect(quoteAssetFromParsedMint('x', null)).toBeNull();
    });
});

describe('QUOTE_MINT_INFO', () => {
    it('treats the all-zero key V2 events write for SOL as SOL', () => {
        expect(QUOTE_MINT_INFO[SOL_NATIVE_QUOTE]).toEqual({ ticker: 'SOL', decimals: 9, isStable: false });
    });

    it('pins the on-chain decimals of the tokenized-stock quotes, which are not SOL\'s', () => {
        expect(QUOTE_MINT_INFO.XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB?.decimals).toBe(8);
        expect(QUOTE_MINT_INFO.chipCAT7vi5CZtbZsn9z7iMPXvFwyAnKz3QFu8XVuHm?.decimals).toBe(9);
    });

    it('answers a known mint without touching the network', async () => {
        expect(await resolveQuoteAsset(SOL_NATIVE_QUOTE, 'http://127.0.0.1:1/unreachable')).toEqual(QUOTE_MINT_INFO[SOL_NATIVE_QUOTE]);
    });
});

const base = (fields: Partial<FeeClaimEvent>): FeeClaimEvent => ({
    txSignature: 'synthetic', amountSol: 0, amountLamports: 0, claimType: 'claim_social_fee_pda',
    ...fields,
} as FeeClaimEvent);

describe('claimAmountLines', () => {
    it('prices a SOL claim in dollars', () => {
        const ev = base({ amountLamports: 2_000_000_000, amountSol: 2, amountQuote: 2, quoteTicker: 'SOL', lifetimeClaimedQuote: 2, quoteResolved: true });
        expect(claimAmountLines(ev, 150)).toEqual(['2.0000 SOL ($300.00)', 'Lifetime claims: 2.0000 SOL ($300.00)']);
    });

    it('never applies the SOL price to a tokenized stock', () => {
        const ev = base({ amountLamports: 203_000_000, amountQuote: 2.03, quoteTicker: 'TSLAx', lifetimeClaimedQuote: 2.03, quoteResolved: true });
        expect(claimAmountLines(ev, 150)).toEqual(['2.0300 TSLAx', 'Lifetime claims: 2.0300 TSLAx']);
    });

    it('shows a stablecoin at two places with no conversion', () => {
        const ev = base({ amountLamports: 12_500_000, amountQuote: 12.5, quoteTicker: 'USDC', isStableQuote: true, quoteResolved: true });
        expect(claimAmountLines(ev, 150)).toEqual(['12.50 USDC']);
    });

    it('names an unresolved asset instead of printing a guessed amount as SOL', () => {
        const ev = base({ amountLamports: 5_000_000_000, quoteMint: 'XsSyntheticUnknown11111111111111111111111', quoteResolved: false });
        expect(claimAmountLines(ev, 150)).toEqual(['Paid in XsSynthe (amount unavailable)']);
    });

    it('keeps rendering legacy SOL events that carry no quote fields', () => {
        const ev = base({ amountLamports: 1_500_000_000, amountSol: 1.5 });
        expect(claimAmountLines(ev, 100, 1.5)).toEqual(['1.5000 SOL ($150.00)', 'Lifetime claims: 1.5000 SOL ($150.00)']);
    });
});

describe('applyQuoteAsset', () => {
    it('recomputes the amount with real decimals and takes lifetime from the stable counter', () => {
        const ev = base({ amountLamports: 203_000_000, lifetimeStableClaimedRaw: 203_000_000, quoteResolved: false });
        applyQuoteAsset(ev, { ticker: 'TSLAx', decimals: 8, isStable: false });
        expect(ev.amountQuote).toBeCloseTo(2.03, 10);
        expect(ev.lifetimeClaimedQuote).toBeCloseTo(2.03, 10);
        expect(ev.quoteTicker).toBe('TSLAx');
        expect(ev.quoteResolved).toBe(true);
    });
});
