/**
 * Endpoint URLs carry credentials in two different places, and /stats served
 * one of them raw until 2026-09-11. Every provider shape we actually use is
 * pinned here.
 */

import { describe, it, expect } from 'vitest';

import { maskRpcUrl } from '../rpc-fallback.js';

describe('maskRpcUrl', () => {
	it('drops a key held in the query string (Helius)', () => {
		const masked = maskRpcUrl('https://mainnet.helius-rpc.com/?api-key=af3ab8dc-600c-45e2-881a-fea9bb3f6b68');
		expect(masked).toBe('mainnet.helius-rpc.com');
		expect(masked).not.toContain('api-key');
	});

	it('drops a key held in the path (Phantom)', () => {
		const masked = maskRpcUrl('https://solana-mainnet.phantom.app/YBPpkkN4g91xDiAnTE9r0RcMkjg0sKUIWvAfoFVJ');
		expect(masked).toBe('solana-mainnet.phantom.app');
		expect(masked).not.toContain('YBPpkk');
	});

	it('masks websocket URLs the same way', () => {
		expect(maskRpcUrl('wss://mainnet.helius-rpc.com/?api-key=secret')).toBe('mainnet.helius-rpc.com');
	});

	it('leaves a keyless endpoint readable', () => {
		expect(maskRpcUrl('https://api.mainnet-beta.solana.com')).toBe('api.mainnet-beta.solana.com');
	});

	it('never echoes a long non-URL back in full', () => {
		const junk = 'not-a-url-' + 'x'.repeat(200);
		expect(maskRpcUrl(junk).length).toBeLessThanOrEqual(30);
	});
});
