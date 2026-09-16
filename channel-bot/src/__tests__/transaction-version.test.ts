import { Connection } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

import { MAX_SUPPORTED_TRANSACTION_VERSION } from '../rpc-fallback.js';

const SIGNATURE = '5'.repeat(88);
const FEE_PAYER = 'So11111111111111111111111111111111111111112';

function v1ParsedTransaction() {
    return {
        slot: 400_000_000,
        blockTime: 1_789_000_000,
        version: 1,
        meta: { err: null, fee: 5000, preBalances: [1], postBalances: [1], logMessages: ['Program log: claim'] },
        transaction: {
            signatures: [SIGNATURE],
            message: {
                accountKeys: [{ pubkey: FEE_PAYER, signer: true, writable: true, source: 'transaction' }],
                instructions: [],
                recentBlockhash: '11111111111111111111111111111111',
            },
        },
    };
}

describe('Solana transaction version support', () => {
    it('asks the RPC for v1 transactions', () => {
        expect(MAX_SUPPORTED_TRANSACTION_VERSION).toBe(1);
    });

    it('parses a v1 transaction response instead of rejecting it', async () => {
        let requested: unknown;
        const connection = new Connection('http://rpc.invalid', {
            fetch: async (_url, init) => {
                const body = JSON.parse(String(init?.body));
                requested = body.params[1];
                return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: v1ParsedTransaction() }), {
                    headers: { 'content-type': 'application/json' },
                });
            },
        });

        const tx = await connection.getParsedTransaction(SIGNATURE, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: MAX_SUPPORTED_TRANSACTION_VERSION,
        });

        expect(requested).toMatchObject({ maxSupportedTransactionVersion: 1 });
        expect(tx?.version).toBe(1);
        expect(tx?.meta?.logMessages).toEqual(['Program log: claim']);
    });
});
