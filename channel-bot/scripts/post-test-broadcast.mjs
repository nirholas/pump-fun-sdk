#!/usr/bin/env node
/**
 * Post a one-off system diagnostic to the feed's channel.
 *
 * Every number in it is measured at send time, not typed in: the endpoint
 * counts come from the env file being used, the slot and block time come from
 * a live getSlot/getBlockTime against the primary RPC, and the attestation is a
 * real HMAC-SHA512 over the rendered payload keyed by a random session nonce.
 * It looks like machine output because it is machine output.
 *
 * Usage:
 *   node scripts/post-test-broadcast.mjs                      # dry run, prints it
 *   node scripts/post-test-broadcast.mjs --send               # posts to CHANNEL_ID
 *   node scripts/post-test-broadcast.mjs --send --chat -100…  # posts elsewhere
 *   node scripts/post-test-broadcast.mjs --send --force        # into a first-claims channel anyway
 *   node scripts/post-test-broadcast.mjs --env .env.claims
 *
 * Sending is opt-in: a bare run never posts.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';

function parseArgs(argv) {
	const out = { envFile: '.env.claims', send: false, chat: null, force: false };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--send') out.send = true;
		else if (argv[i] === '--force') out.force = true;
		else if (argv[i] === '--chat') out.chat = argv[++i];
		else if (argv[i] === '--env') out.envFile = argv[++i];
	}
	return out;
}

function readEnvFile(path) {
	const env = {};
	for (const line of readFileSync(resolve(path), 'utf8').split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#') || !t.includes('=')) continue;
		const i = t.indexOf('=');
		env[t.slice(0, i)] = t.slice(i + 1);
	}
	return env;
}

const listOf = (v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

async function rpc(url, method, params = []) {
	const resp = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
	});
	const body = await resp.json();
	if (body.error) throw new Error(body.error.message);
	return body.result;
}

/** Provider host only: never leak the api key into a public channel. */
function hostOf(url) {
	try { return new URL(url).host; } catch { return 'unknown'; }
}

/** Group a hex digest into wide, deliberately machine-looking rows. */
function blockify(hex, perGroup = 8, groupsPerLine = 4) {
	const groups = hex.match(new RegExp(`.{1,${perGroup}}`, 'g')) ?? [];
	const lines = [];
	for (let i = 0; i < groups.length; i += groupsPerLine) {
		lines.push(groups.slice(i, i + groupsPerLine).join(' '));
	}
	return lines.join('\n');
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const env = readEnvFile(args.envFile);

	const token = env.TELEGRAM_BOT_TOKEN;
	const chat = args.chat ?? env.CHANNEL_ID;
	if (!token) throw new Error(`TELEGRAM_BOT_TOKEN missing from ${args.envFile}`);
	if (!chat) throw new Error(`CHANNEL_ID missing from ${args.envFile} and no --chat given`);

	// The same rule the bot enforces at its send boundary: a channel running the
	// github-first-claims profile carries first claims and nothing else. A test
	// card there dilutes the one signal the channel exists for, so it takes an
	// explicit --force, and --chat is the right way to prove the pipeline.
	if (env.FEED_PROFILE === 'github-first-claims' && !args.chat && !args.force) {
		console.error(
			`Refusing: ${args.envFile} runs the github-first-claims profile, and this diagnostic is not a first claim.\n` +
			'Post it somewhere else with --chat <id>, or pass --force if you really mean this channel.',
		);
		process.exit(1);
	}

	const rpcUrls = [env.SOLANA_RPC_URL, ...listOf(env.SOLANA_RPC_URLS)].filter(Boolean);
	const wsUrls = listOf(env.SOLANA_WS_URLS);
	const primary = rpcUrls[0];

	const slot = await rpc(primary, 'getSlot');
	let blockTime = null;
	try { blockTime = await rpc(primary, 'getBlockTime', [slot]); } catch { /* not all nodes serve it */ }
	const lagSec = blockTime ? Math.max(0, Math.floor(Date.now() / 1000) - blockTime) : null;

	const nonce = randomBytes(16).toString('hex');
	const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';

	const body = [
		'▛▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▜',
		'▌  S Y S T E M   D I A G N O S T I C  ▐',
		'▌      ·  TEST  BROADCAST  ·         ▐',
		'▙▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▟',
		'',
		'<b>RPC UPGRADED · BOT RUNNING AGAIN</b>',
		'',
		'<code>' +
		[
			`STATUS ........ ONLINE`,
			`FEED .......... github first-claims`,
			`RPC LANE ...... ${rpcUrls.length} endpoints`,
			`SOCKETS ....... ${wsUrls.length} failover`,
			`PRIMARY ....... ${hostOf(primary)}`,
			`SLOT .......... ${slot}`,
			lagSec === null ? `CHAIN LAG ..... n/a` : `CHAIN LAG ..... ${lagSec}s`,
			`CLOCK ......... ${stamp}`,
		].join('\n') +
		'</code>',
		'',
		'<i>▚ attestation ▞</i>',
	].join('\n');

	// A genuine HMAC over exactly what is being posted, keyed by the nonce.
	const digest = createHmac('sha512', nonce).update(body).digest('hex');

	const message = [
		body,
		'<code>' + blockify(digest) + '</code>',
		`<code>nonce:${nonce}</code>`,
		'',
		'<i>∎ emitted by the feed itself. no human wrote this line.</i>',
	].join('\n');

	if (!args.send) {
		console.log('── DRY RUN (pass --send to post) ──');
		console.log(`target chat: ${chat}`);
		console.log('─'.repeat(44));
		console.log(message.replace(/<[^>]+>/g, ''));
		console.log('─'.repeat(44));
		console.log(`rendered length: ${message.length} chars`);
		return;
	}

	const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			chat_id: chat,
			text: message,
			parse_mode: 'HTML',
			link_preview_options: { is_disabled: true },
		}),
	});
	const result = await resp.json();
	if (!result.ok) {
		console.error(`Post failed (${result.error_code}): ${result.description}`);
		process.exit(1);
	}
	console.log(`Posted to ${chat} as message ${result.result.message_id}.`);
}

main().catch((err) => {
	console.error(err.message ?? err);
	process.exit(1);
});
