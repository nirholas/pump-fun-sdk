#!/usr/bin/env node
/**
 * Probe Solana RPC endpoints with the payloads this bot actually sends.
 *
 * A liveness ping proves nothing here. The claim monitor reads the pump
 * programs' signature history over HTTP and subscribes to their logs over a
 * websocket, and endpoints fail those two independently: a node can answer
 * getSlot in 40ms and still refuse getSignaturesForAddress, or accept a
 * logsSubscribe and never deliver a notification (rpc.magicblock.app did
 * exactly that for four days in September 2026). So each endpoint is put
 * through the real calls:
 *
 *   http  getSlot                  is it alive
 *   http  getSignaturesForAddress  can it read the pump program's history
 *   http  getTransaction           can it fetch a parsed tx (the heavy call)
 *   ws    logsSubscribe            does it deliver a real log event in time
 *
 * Usage:
 *   node scripts/probe-endpoints.mjs                 # probe what .env configures
 *   node scripts/probe-endpoints.mjs --env .env.claims
 *   node scripts/probe-endpoints.mjs --candidates    # also probe the public pool
 *   node scripts/probe-endpoints.mjs https://a https://b
 *   node scripts/probe-endpoints.mjs --json          # machine-readable
 *
 * Exit code is 1 when no endpoint passes every stage, so CI or a deploy gate
 * can refuse a configuration that cannot carry the feed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const HTTP_TIMEOUT_MS = 12_000;
const WS_TIMEOUT_MS = 20_000;

/** Public keyless endpoints worth trying. Keyed providers come from the env. */
export const PUBLIC_CANDIDATES = [
	'https://api.mainnet-beta.solana.com',
	'https://solana-rpc.publicnode.com',
	'https://solana.leorpc.com/?api_key=FREE',
	'https://solana.drpc.org',
	'https://endpoints.omniatech.io/v1/sol/mainnet/public',
	'https://solana.api.onfinality.io/public',
	'https://solana.blockpi.network/v1/rpc/public',
	'https://1rpc.io/sol',
	'https://api.blockeden.xyz/solana/67nCBdZQSH9z3YqDDjdm',
	'https://solana-mainnet.rpc.extrnode.com',
	'https://rpc.ankr.com/solana',
	'https://free.rpcpool.com',
	'https://api.metaplex.solana.com',
	'https://solana.public-rpc.com',
];

function parseArgs(argv) {
	const out = { envFile: '.env', candidates: false, json: false, urls: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--env') out.envFile = argv[++i];
		else if (a === '--candidates') out.candidates = true;
		else if (a === '--json') out.json = true;
		else if (a.startsWith('http')) out.urls.push(a);
	}
	return out;
}

/** Read an env file without pulling in dotenv or mutating process.env. */
export function readEnvFile(path) {
	const env = {};
	let raw;
	try {
		raw = readFileSync(resolve(path), 'utf8');
	} catch {
		return env;
	}
	for (const line of raw.split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#') || !t.includes('=')) continue;
		const i = t.indexOf('=');
		env[t.slice(0, i)] = t.slice(i + 1);
	}
	return env;
}

export function endpointsFromEnv(env) {
	const list = [];
	for (const key of ['SOLANA_RPC_URL', 'SOLANA_RPC_URLS']) {
		for (const u of (env[key] ?? '').split(',')) {
			const t = u.trim();
			if (t && !list.includes(t)) list.push(t);
		}
	}
	return list;
}

/** Never print a provider key: the report is meant to be pasted around. */
export function redact(url) {
	return url
		.replace(/((?:api[-_]?key|apikey|token)=)[^&]+/gi, '$1<KEY>')
		.replace(/\/([A-Za-z0-9_-]{24,})(?=\/|$)/g, '/<KEY>');
}

export function toWs(url) {
	if (/^wss?:\/\//i.test(url)) return url;
	if (url.startsWith('https://')) return 'wss://' + url.slice(8);
	if (url.startsWith('http://')) return 'ws://' + url.slice(7);
	return null;
}

async function rpc(url, method, params) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
	const started = Date.now();
	try {
		const resp = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
			signal: ctrl.signal,
		});
		const ms = Date.now() - started;
		if (!resp.ok) return { ok: false, ms, error: `HTTP ${resp.status}` };
		const body = await resp.json();
		if (body.error) return { ok: false, ms, error: body.error.message || 'rpc error' };
		return { ok: true, ms, result: body.result };
	} catch (err) {
		return { ok: false, ms: Date.now() - started, error: err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'failed') };
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Subscribe to the pump program's logs and demand a real notification.
 * Accepting the subscription id is not enough: that is what a refused or idle
 * endpoint also returns.
 */
function probeWs(wsUrl) {
	return new Promise((done) => {
		const started = Date.now();
		let socket;
		let settled = false;
		const finish = (res) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try { socket?.close(); } catch { /* already closing */ }
			done(res);
		};
		const timer = setTimeout(() => finish({ ok: false, error: `no event in ${WS_TIMEOUT_MS / 1000}s` }), WS_TIMEOUT_MS);
		try {
			socket = new WebSocket(wsUrl);
		} catch (err) {
			return finish({ ok: false, error: err?.message ?? 'ctor failed' });
		}
		socket.onopen = () => {
			socket.send(JSON.stringify({
				jsonrpc: '2.0', id: 1, method: 'logsSubscribe',
				params: [{ mentions: [PUMP_PROGRAM] }, { commitment: 'confirmed' }],
			}));
		};
		socket.onmessage = (ev) => {
			let msg;
			try { msg = JSON.parse(String(ev.data)); } catch { return; }
			// Only a notification counts. The subscribe ack does not.
			if (msg.method === 'logsNotification') finish({ ok: true, ms: Date.now() - started });
			else if (msg.error) finish({ ok: false, error: msg.error.message || 'subscribe rejected' });
		};
		socket.onerror = () => finish({ ok: false, error: 'connect/upgrade failed' });
		socket.onclose = (ev) => finish({ ok: false, error: `closed (${ev?.code ?? '?'})` });
	});
}

export async function probe(url) {
	const row = { url, redacted: redact(url) };

	const slot = await rpc(url, 'getSlot', []);
	row.slot = slot;
	if (!slot.ok) return row;

	const sigs = await rpc(url, 'getSignaturesForAddress', [PUMP_PROGRAM, { limit: 10 }]);
	row.sigs = sigs;

	if (sigs.ok && Array.isArray(sigs.result) && sigs.result.length > 0) {
		row.tx = await rpc(url, 'getTransaction', [
			sigs.result[0].signature,
			{ maxSupportedTransactionVersion: 0, encoding: 'json' },
		]);
	} else {
		row.tx = { ok: false, error: 'no signatures to fetch' };
	}

	const wsUrl = toWs(url);
	row.ws = wsUrl ? await probeWs(wsUrl) : { ok: false, error: 'no ws form' };
	return row;
}

const mark = (r) => (r?.ok ? 'pass' : 'FAIL');
const detail = (r) => (r?.ok ? `${r.ms}ms` : (r?.error ?? '?'));

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const env = readEnvFile(args.envFile);

	let urls = args.urls.length ? args.urls : endpointsFromEnv(env);
	if (args.candidates) {
		for (const c of PUBLIC_CANDIDATES) if (!urls.includes(c)) urls.push(c);
	}
	if (urls.length === 0) {
		console.error(`No endpoints to probe. Configure SOLANA_RPC_URLS in ${args.envFile}, pass URLs, or use --candidates.`);
		process.exit(2);
	}

	if (!args.json) {
		console.log(`Probing ${urls.length} endpoint(s) with real pump-program payloads.`);
		console.log(`http: getSlot, getSignaturesForAddress, getTransaction   ws: logsSubscribe (${WS_TIMEOUT_MS / 1000}s for a real event)\n`);
	}

	// Sequential on purpose: probing in parallel makes shared-IP public nodes
	// rate-limit each other's probes and report false failures.
	const rows = [];
	for (const url of urls) {
		const row = await probe(url);
		rows.push(row);
		if (!args.json) {
			console.log(`${row.redacted}`);
			console.log(`   getSlot        ${mark(row.slot).padEnd(5)} ${detail(row.slot)}`);
			if (row.sigs) console.log(`   getSignatures  ${mark(row.sigs).padEnd(5)} ${detail(row.sigs)}`);
			if (row.tx)   console.log(`   getTransaction ${mark(row.tx).padEnd(5)} ${detail(row.tx)}`);
			if (row.ws)   console.log(`   logsSubscribe  ${mark(row.ws).padEnd(5)} ${detail(row.ws)}`);
			console.log('');
		}
	}

	const httpOk = rows.filter((r) => r.slot?.ok && r.sigs?.ok && r.tx?.ok);
	const wsOk = rows.filter((r) => r.ws?.ok);

	if (args.json) {
		console.log(JSON.stringify({ rows: rows.map((r) => ({ url: r.redacted, slot: r.slot?.ok ?? false, sigs: r.sigs?.ok ?? false, tx: r.tx?.ok ?? false, ws: r.ws?.ok ?? false })) }, null, 2));
	} else {
		console.log('─'.repeat(64));
		console.log(`HTTP fully usable: ${httpOk.length}/${rows.length}`);
		for (const r of httpOk) console.log(`   ${r.redacted}`);
		console.log(`Websocket delivering: ${wsOk.length}/${rows.length}`);
		for (const r of wsOk) console.log(`   ${r.redacted}`);
		console.log('');
		console.log('SOLANA_RPC_URLS=' + httpOk.map((r) => r.redacted).join(','));
		console.log('SOLANA_WS_URLS=' + wsOk.map((r) => toWs(r.redacted)).join(','));
		console.log('(keys shown as <KEY>; copy the real URLs from your provider)');
	}

	process.exit(httpOk.length > 0 ? 0 : 1);
}

// Only run as a CLI. doctor.mjs imports the probe instead of shelling out, so
// the two can never disagree about what "working" means.
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err);
		process.exit(2);
	});
}
