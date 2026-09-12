#!/usr/bin/env node
/**
 * Answer "did the feed miss a GitHub first claim?" from the chain, not from the bot.
 *
 * Every GitHub social fee claim is co-signed by one pump.fun verifier, so that
 * address's history is the complete list of GitHub claims, and it is small
 * (about 34 transactions a day). This reads it for the last N hours, decodes each
 * SocialFeePdaClaimed event, and classifies it the way the bot does. V2 events
 * keep two lifetime counters, SOL and non-SOL quote assets, and a claim is
 * first-ever only when its own currency's counter equals the amount and the
 * other is empty. Reading only the SOL counter reported a veteran's 203.7
 * stablecoin claim on 2026-09-11 as a first claim.
 *
 * An earlier version scanned the fee program instead. That program runs about
 * 22 transactions a second, so 400 signatures covered 0.003 hours, and "0 first
 * claims" there meant nothing. The verifier gives the whole day in one page.
 *
 * Usage:
 *   node scripts/audit-first-claims.mjs                # last 24 hours, .env.claims
 *   node scripts/audit-first-claims.mjs --hours 6
 *   node scripts/audit-first-claims.mjs --env .env
 *
 * To check the running feed saw each one, match the printed 12-character tx
 * prefixes against its log:
 *   gcloud logging read 'resource.labels.service_name="pumpfun-claims-bot"
 *     (textPayload:"Skipped" OR textPayload:"FIRST CLAIM")' --freshness=25h
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AUTHORITY = '2sMrGNK8i36YRkF5WWCwnaUYuwDJhHe1g2xA8aPvhkjM';
const EVENT_DISC = '3212c141edd2eaec'; // SocialFeePdaClaimed
const GITHUB = 2;
const SOL_QUOTES = new Set(['11111111111111111111111111111111', 'So11111111111111111111111111111111111111112']);

function parseArgs() {
	const a = { envFile: '.env.claims', hours: 24 };
	const v = process.argv.slice(2);
	for (let i = 0; i < v.length; i++) {
		if (v[i] === '--env') a.envFile = v[++i];
		else if (v[i] === '--hours') a.hours = Number(v[++i]);
	}
	return a;
}

function readEnv(p) {
	const e = {};
	for (const line of readFileSync(resolve(p), 'utf8').split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#') || !t.includes('=')) continue;
		const i = t.indexOf('=');
		e[t.slice(0, i)] = t.slice(i + 1);
	}
	return e;
}

async function rpc(url, method, params, tries = 4) {
	for (let t = 0; ; t++) {
		try {
			const r = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
			});
			const j = await r.json();
			if (j.error) throw new Error(j.error.message);
			return j.result;
		} catch (err) {
			if (t >= tries - 1) throw err;
			await new Promise((res) => setTimeout(res, 1500 * (t + 1)));
		}
	}
}

/** Mirrors claim-monitor.ts: disc, timestamp, user_id, platform, 3 pubkeys, amount, claimable_before,
 * lifetime, then on V2 events two balances, quote_mint and lifetime_stable_claimed. */
function decodeEvent(buf) {
	if (buf.length < 16 || buf.subarray(0, 8).toString('hex') !== EVENT_DISC) return null;
	let o = 16;
	const uidLen = buf.readUInt32LE(o); o += 4;
	if (buf.length < o + uidLen + 1 + 96 + 24) return null;
	const githubUserId = buf.subarray(o, o + uidLen).toString('utf8'); o += uidLen;
	const platform = buf[o]; o += 1;
	o += 96;
	const amount = buf.readBigUInt64LE(o); o += 16;
	const lifetime = buf.readBigUInt64LE(o); o += 8;
	let quoteMint = null;
	let lifetimeStable = null;
	if (buf.length >= o + 16 + 32 + 8) {
		o += 16;
		quoteMint = bs58(buf.subarray(o, o + 32)); o += 32;
		lifetimeStable = buf.readBigUInt64LE(o);
	}
	return { githubUserId, platform, amount, lifetime, quoteMint, lifetimeStable };
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58(bytes) {
	let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '0'));
	let out = '';
	while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
	for (const b of bytes) { if (b !== 0) break; out = '1' + out; }
	return out;
}

/** Same rule as src/first-claim.ts onchainClaimVerdict. */
function isFirstEver(ev) {
	const near = (life) => life * 100n <= ev.amount * 101n;
	if (ev.quoteMint == null || SOL_QUOTES.has(ev.quoteMint)) {
		return near(ev.lifetime) && (ev.lifetimeStable == null || ev.lifetimeStable === 0n);
	}
	return ev.lifetime === 0n && ev.lifetimeStable != null && near(ev.lifetimeStable);
}

async function main() {
	const a = parseArgs();
	const url = readEnv(a.envFile).SOLANA_RPC_URL;
	if (!url) throw new Error(`SOLANA_RPC_URL missing from ${a.envFile}`);
	const cutoff = Date.now() / 1000 - a.hours * 3600;

	const sigs = [];
	let before;
	for (;;) {
		const page = await rpc(url, 'getSignaturesForAddress', [AUTHORITY, { limit: 1000, ...(before ? { before } : {}) }]);
		if (!page.length) break;
		sigs.push(...page);
		before = page[page.length - 1].signature;
		if ((page[page.length - 1].blockTime ?? 0) < cutoff) break;
	}
	const inWindow = sigs.filter((s) => (s.blockTime ?? 0) >= cutoff && !s.err);

	const claims = [];
	for (const s of inWindow) {
		const tx = await rpc(url, 'getTransaction', [s.signature, { maxSupportedTransactionVersion: 0, encoding: 'json' }]);
		for (const line of tx?.meta?.logMessages ?? []) {
			if (!line.startsWith('Program data: ')) continue;
			let ev;
			try { ev = decodeEvent(Buffer.from(line.slice(14), 'base64')); } catch { ev = null; }
			if (!ev || ev.platform !== GITHUB) continue;
			claims.push({ ...ev, signature: s.signature, blockTime: s.blockTime, first: isFirstEver(ev) });
		}
	}

	const firsts = claims.filter((c) => c.first);
	console.log(`GitHub claims in the last ${a.hours}h: ${claims.length}  (first-ever ${firsts.length}, repeat ${claims.length - firsts.length})\n`);
	for (const c of claims.sort((x, y) => x.blockTime - y.blockTime)) {
		const when = new Date(c.blockTime * 1000).toISOString().slice(5, 19).replace('T', ' ');
		const sol = (n) => (Number(n) / 1e9).toFixed(4);
		const quote = c.quoteMint == null || SOL_QUOTES.has(c.quoteMint) ? 'SOL' : c.quoteMint.slice(0, 8);
		const stable = c.lifetimeStable == null ? '-' : sol(c.lifetimeStable);
		console.log(`${c.first ? 'FIRST ' : 'repeat'} ${when}Z gh=${c.githubUserId.padEnd(10)} amount=${sol(c.amount).padStart(10)} ${quote.padEnd(8)} solLifetime=${sol(c.lifetime).padStart(11)} stableLifetime=${stable.padStart(10)} tx=${c.signature.slice(0, 12)}`);
	}
	if (firsts.length) {
		console.log('\nFirst-ever claims, full signatures:');
		for (const f of firsts) console.log(`  ${f.signature}`);
	}
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
