/**
 * Feed profiles pin what a channel is allowed to carry.
 *
 * @pumpfunclaims exists for one event: a developer's first-ever GitHub reward
 * claim on a coin. On 2026-09-11 it carried routine creator-fee payouts
 * because that path had no toggle of its own and posted under FEED_CLAIMS.
 * These tests hold the line: the github-first-claims profile can never post
 * anything but Path A, no matter what the individual FEED_* variables say.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { loadConfig, FEED_PROFILES } from '../config.js';

const BASE = {
	TELEGRAM_BOT_TOKEN: '1:x',
	CHANNEL_ID: '-1001',
	SOLANA_RPC_URL: 'https://example.invalid',
};

let saved: NodeJS.ProcessEnv;

beforeEach(() => {
	saved = { ...process.env };
	for (const k of Object.keys(process.env)) if (k.startsWith('FEED_')) delete process.env[k];
	Object.assign(process.env, BASE);
});

afterEach(() => {
	process.env = saved;
});

describe('feed profiles', () => {
	it('github-first-claims posts Path A only, whatever the toggles say', () => {
		Object.assign(process.env, {
			FEED_PROFILE: 'github-first-claims',
			FEED_CLAIMS: 'false',
			FEED_CREATOR_CLAIMS: 'true',
			FEED_GRADUATIONS: 'true',
			FEED_LAUNCHES: 'true',
			FEED_WHALES: 'true',
			FEED_FEE_DISTRIBUTIONS: 'true',
		});
		const cfg = loadConfig();
		expect(cfg.profile).toBe('github-first-claims');
		expect(cfg.feed).toEqual(FEED_PROFILES['github-first-claims']);
		expect(cfg.feed.claims).toBe(true);
		expect(cfg.feed.creatorClaims).toBe(false);
		expect(cfg.feed.graduations).toBe(false);
	});

	it('graduations posts graduations only', () => {
		process.env.FEED_PROFILE = 'graduations';
		const cfg = loadConfig();
		expect(cfg.feed).toEqual(FEED_PROFILES.graduations);
		expect(cfg.feed.claims).toBe(false);
		expect(cfg.feed.creatorClaims).toBe(false);
		expect(cfg.feed.graduations).toBe(true);
	});

	it('rejects a profile name that does not exist instead of guessing', () => {
		process.env.FEED_PROFILE = 'everything';
		expect(() => loadConfig()).toThrow(/github-first-claims, graduations/);
	});

	it('without a profile, creator-fee claims stay off unless asked for', () => {
		process.env.FEED_CLAIMS = 'true';
		const cfg = loadConfig();
		expect(cfg.profile).toBeUndefined();
		expect(cfg.feed.claims).toBe(true);
		expect(cfg.feed.creatorClaims).toBe(false);
	});

	it('without a profile, FEED_CREATOR_CLAIMS is an explicit opt-in', () => {
		process.env.FEED_CREATOR_CLAIMS = 'true';
		expect(loadConfig().feed.creatorClaims).toBe(true);
	});

	it('every profile is a complete toggle set, so no feed key is left to a default', () => {
		const keys = Object.keys(FEED_PROFILES['github-first-claims']).sort();
		for (const p of Object.values(FEED_PROFILES)) {
			expect(Object.keys(p).sort()).toEqual(keys);
		}
	});
});
