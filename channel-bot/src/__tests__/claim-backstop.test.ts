/**
 * The backstop decides which verifier transactions still need processing. It
 * must never replay history on a redeploy, never re-queue what is already
 * handled, and keep a burst in chain order.
 */

import { describe, it, expect } from 'vitest';

import {
    BACKSTOP_STARTUP_GRACE_SEC,
    GITHUB_CLAIM_AUTHORITY,
    selectBackstopSignatures,
} from '../claim-backstop.js';

const START = 1_789_000_000;
const earliest = START - BACKSTOP_STARTUP_GRACE_SEC;
const nothingHandled = () => false;

describe('selectBackstopSignatures', () => {
    it('returns unhandled recent claims oldest first', () => {
        // getSignaturesForAddress answers newest first.
        const refs = [
            { signature: 'c', blockTime: START + 30 },
            { signature: 'b', blockTime: START + 20 },
            { signature: 'a', blockTime: START + 10 },
        ];
        expect(selectBackstopSignatures(refs, earliest, nothingHandled)).toEqual(['a', 'b', 'c']);
    });

    it('never reaches back past the startup grace, so a redeploy cannot replay posted claims', () => {
        const refs = [
            { signature: 'fresh', blockTime: START - 60 },
            { signature: 'from-the-previous-revision', blockTime: START - 3_600 },
        ];
        expect(selectBackstopSignatures(refs, earliest, nothingHandled)).toEqual(['fresh']);
    });

    it('skips failed transactions and ones without a block time', () => {
        const refs = [
            { signature: 'failed', blockTime: START, err: { InstructionError: [0, 'Custom'] } },
            { signature: 'no-time', blockTime: null },
            { signature: 'ok', blockTime: START },
        ];
        expect(selectBackstopSignatures(refs, earliest, nothingHandled)).toEqual(['ok']);
    });

    it('leaves out what the websocket or an earlier read already handled', () => {
        const refs = [
            { signature: 'seen-by-websocket', blockTime: START + 5 },
            { signature: 'dropped-by-websocket', blockTime: START + 6 },
        ];
        const handled = (sig: string) => sig === 'seen-by-websocket';
        expect(selectBackstopSignatures(refs, earliest, handled)).toEqual(['dropped-by-websocket']);
    });

    it('watches a well-formed verifier address', () => {
        expect(GITHUB_CLAIM_AUTHORITY).toMatch(/^[1-9A-HJ-NP-Za-km-z]{44}$/);
    });
});
