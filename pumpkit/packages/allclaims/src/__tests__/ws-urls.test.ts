import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveWsUrls } from '../config.js';

const RPCS = [
    'https://solana-rpc.publicnode.com',
    'https://api.mainnet-beta.solana.com',
];

describe('resolveWsUrls', () => {
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
        saved = {
            SOLANA_WS_URL: process.env.SOLANA_WS_URL,
            SOLANA_WS_URLS: process.env.SOLANA_WS_URLS,
        };
        delete process.env.SOLANA_WS_URL;
        delete process.env.SOLANA_WS_URLS;
    });

    afterEach(() => {
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    });

    it('derives one endpoint per RPC url when nothing is set', () => {
        expect(resolveWsUrls(RPCS)).toEqual([
            'wss://solana-rpc.publicnode.com/',
            'wss://api.mainnet-beta.solana.com/',
        ]);
    });

    it('puts an explicit SOLANA_WS_URL first but still keeps the derived backups', () => {
        process.env.SOLANA_WS_URL = 'wss://api.mainnet-beta.solana.com';
        const urls = resolveWsUrls(RPCS);
        expect(urls[0]).toBe('wss://api.mainnet-beta.solana.com');
        expect(urls).toContain('wss://solana-rpc.publicnode.com/');
        expect(urls.length).toBeGreaterThan(1);
    });

    it('reads SOLANA_WS_URLS as an ordered comma-separated list', () => {
        process.env.SOLANA_WS_URLS = 'wss://one.example/ , wss://two.example/';
        const urls = resolveWsUrls([]);
        expect(urls).toEqual(['wss://one.example/', 'wss://two.example/']);
    });

    it('never returns a single point of failure while a second RPC exists', () => {
        process.env.SOLANA_WS_URL = 'wss://solana-rpc.publicnode.com/';
        // The 2026-09-09 outage: the one configured endpoint went key-gated and
        // answered 401 forever. A backup has to survive that de-duplication.
        expect(resolveWsUrls(RPCS).length).toBeGreaterThan(1);
    });

    it('drops duplicates and preserves first-seen order', () => {
        process.env.SOLANA_WS_URLS = 'wss://one.example/,wss://one.example/,wss://two.example/';
        expect(resolveWsUrls(['https://one.example/'])).toEqual([
            'wss://one.example/',
            'wss://two.example/',
        ]);
    });

    it('ignores entries that are not websocket urls', () => {
        process.env.SOLANA_WS_URLS = 'https://not-a-socket.example/,not a url,,wss://ok.example/';
        expect(resolveWsUrls([])).toEqual(['wss://ok.example/']);
    });

    it('returns an empty list when there is nothing to derive from', () => {
        expect(resolveWsUrls([])).toEqual([]);
    });
});
