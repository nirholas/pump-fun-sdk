#!/usr/bin/env node
/**
 * Answer "should the feed have posted anything?" from the chain, not from the bot.
 *
 * A first-ever GitHub claim is rare, so the normal state of @pumpfunclaims is
 * silence, and silence is indistinguishable from a broken filter by looking at
 * the channel. This scans the fee program's recent history, decodes every
 * SocialFeePdaClaimed event, and classifies it the same way the bot does:
 * lifetime_claimed == amount_claimed is a first-ever claim, anything larger
 * means that payee has claimed before.
 *
 * If this reports first-claims and the channel is empty, the filter is broken.
 * If it reports none, the feed is correct and the signal simply has not fired.
 *
 * Usage:
 *   node scripts/audit-first-claims.mjs                 # last 1000 signatures
 *   node scripts/audit-first-claims.mjs --limit 300
 *   node scripts/audit-first-claims.mjs --env .env.claims
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FEE_PROGRAM = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';
const EVENT_DISC = '3212c141edd2eaec'; // SocialFeePdaClaimed

function args() {
	const a = { envFile: '.env.claims', limit: 1000 };
	const v = process.argv.slice(2);
	for (let i = 0; i < v.length; i++) {
		if (v[i] === '--env') a.envFile = v[++i];
		else if (v[i] === '--limit') a.limit = Number(v[++i]);
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

async function rpc(url, method, params) {
	const r = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
	});
	const j = await r.json();
	if (j.error) throw new Error(j.error.message);
	return j.result;
}

/** Decode a SocialFeePdaClaimed event body. Mirrors claim-monitor.ts exactly. */
function decodeEvent(buf) {
	if (buf.length < 16 || buf.subarray(0, 8).toString('hex') !== EVENT_DISC) return null;
	let o = 16; // disc(8) + timestamp(8)
	if (buf.length < o + 4) return null;
	const uidLen = buf.readUInt32LE(o); o += 4;
	if (buf.length < o + uidLen) return null;
	const githubUserId = buf.subarray(o, o + uidLen).toString('utf8'); o += uidLen;
	if (buf.length < o + 1) return null;
	const platform = buf[o]; o += 1;
	o += 32 + 32 + 32;           // social_fee_pda + recipient + social_claim_authority
	if (buf.length < o + 8) return null;
	const amount = buf.readBigUInt64LE(o); o += 8;
	o += 8;                      // claimable_before
	if (buf.length < o + 8) return null;
	const lifetime = buf.readBigUInt64LE(o);
	return { githubUserId, platform, amount, lifetime };
}

async function main() {
	const a = args();
	const env = readEnv(a.envFile);
	const url = env.SOLANA_RPC_URL;
	if (!url) throw new Error(`SOLANA_RPC_URL missing from ${a.envFile}`);

	console.log(`Scanning the last ${a.limit} fee-program signatures for GitHub claims.\n`);

	const sigs = [];
	let before;
	while (sigs.length < a.limit) {
		const page = await rpc(url, 'getSignaturesForAddress', [
			FEE_PROGRAM, { limit: Math.min(1000, a.limit - sigs.length), ...(before ? { before } : {}) },
		]);
		if (!page.length) break;
		sigs.push(...page);
		before = page[page.length - 1].signature;
	}
	const ok = sigs.filter((s) => !s.err);
	const span = sigs.length ? (sigs[0].blockTime - sigs[sigs.length - 1].blockTime) / 3600 : 0;
	console.log(`${sigs.length} signatures (${ok.length} successful) spanning ${span.toFixed(3)} hours.\n`);

	// The fee program clears roughly 22 transactions a second, so signature
	// paging covers far less time than it looks. Say so rather than letting a
	// "0 first claims" line read as 0 for the day when it is 0 for the minute.
	if (span < 1) {
		const perDay = span > 0 ? Math.round((24 / span) * sigs.length) : 0;
		console.log(`NOTE: that is ${(span * 60).toFixed(1)} minutes of history, not a day.`);
		console.log(`Covering 24h this way would need roughly ${perDay.toLocaleString()} signatures.`);
		console.log('For a real answer use the running feed, which holds a continuous subscription:');
		console.log("  gcloud run services logs read pumpfun-claims-bot --region us-central1 \\");
		console.log("    --project aerial-vehicle-466722-p5 --limit 1000 | grep -E 'Skipped|FIRST CLAIM'\n");
	}

	let claims = 0, first = 0, repeat = 0;
	const firsts = [];

	for (const s of ok) {
		let tx;
		try {
			tx = await rpc(url, 'getTransaction', [s.signature, { maxSupportedTransactionVersion: 0, encoding: 'json' }]);
		} catch { continue; }
		for (const line of tx?.meta?.logMessages ?? []) {
			if (!line.startsWith('Program data: ')) continue;
			let ev;
			try { ev = decodeEvent(Buffer.from(line.slice(14), 'base64')); } catch { continue; }
			if (!ev || ev.platform !== 2) continue; // platform 2 = GitHub
			claims++;
			if (ev.lifetime <= (ev.amount * 101n) / 100n) {
				first++;
				firsts.push({ sig: s.signature, user: ev.githubUserId, sol: Number(ev.amount) / 1e9, when: new Date(s.blockTime * 1000).toISOString() });
			} else {
				repeat++;
			}
		}
	}

	console.log(`GitHub social-fee claims found : ${claims}`);
	console.log(`  first-ever (lifetime == amt) : ${first}`);
	console.log(`  repeat     (lifetime >  amt) : ${repeat}\n`);

	if (first === 0) {
		console.log('No first-ever claim in this window. An empty channel is correct.');
	} else {
		console.log('First-ever claims that SHOULD have posted:');
		for (const f of firsts) console.log(`  ${f.when}  ${f.user}  ${f.sol.toFixed(4)} SOL  ${f.sig}`);
		console.log('\nIf none of these are in the channel, the filter is dropping real signal.');
	}
	process.exit(0);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
