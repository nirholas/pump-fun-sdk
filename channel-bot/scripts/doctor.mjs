#!/usr/bin/env node
/**
 * One command that says why the feed is not posting, and can repair it.
 *
 * The outages this bot has had were all cheap to fix and expensive to diagnose.
 * An endpoint goes key-gated, the channel goes quiet, and the next person to
 * look starts from nothing: which bot is this, which channel, which endpoints
 * are configured, are any of them alive, is it even an RPC problem or did the
 * bot lose post rights? Answering that by hand took days more than once. This
 * answers it in one run, in the order the pipeline actually fails:
 *
 *   1. config      is this env file internally coherent
 *   2. telegram    can this bot post to this channel, right now
 *   3. rpc         does each endpoint serve the real payloads, over http and ws
 *   4. verdict     what is broken and the exact command that fixes it
 *
 * Usage:
 *   node scripts/doctor.mjs                      # diagnose .env.claims
 *   node scripts/doctor.mjs --env .env
 *   node scripts/doctor.mjs --fix                # rewrite the endpoint lists to what works
 *   node scripts/doctor.mjs --fix --candidates   # and pull in public endpoints if needed
 *
 * Exit codes: 0 healthy, 1 broken, 2 could not run.
 */

import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	PUBLIC_CANDIDATES,
	readEnvFile,
	endpointsFromEnv,
	redact,
	toWs,
	probe,
} from './probe-endpoints.mjs';

const PROFILES = {
	'github-first-claims': { channel: '-1003533969743', name: '@pumpfunclaims' },
	graduations: { channel: '-1003965305979', name: '@trackpumpfun' },
};

function parseArgs(argv) {
	const out = { envFile: '.env.claims', fix: false, candidates: false };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--env') out.envFile = argv[++i];
		else if (argv[i] === '--fix') out.fix = true;
		else if (argv[i] === '--candidates') out.candidates = true;
	}
	return out;
}

const problems = [];
const notes = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, fix) => { console.log(`  FAIL  ${m}`); problems.push({ m, fix }); };
const warn = (m) => { console.log(`  warn  ${m}`); notes.push(m); };

async function tg(token, method, params) {
	const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(params ?? {}),
	});
	return r.json();
}

function checkConfig(env, envFile) {
	console.log('\n[1/3] config');

	const profile = env.FEED_PROFILE;
	if (!profile) {
		warn('FEED_PROFILE is unset: this feed is steered by individual FEED_* toggles and can drift.');
	} else if (!(profile in PROFILES)) {
		bad(`FEED_PROFILE=${profile} is not a real profile`, `Set FEED_PROFILE to one of: ${Object.keys(PROFILES).join(', ')}`);
	} else {
		ok(`profile ${profile} (${PROFILES[profile].name})`);
		if (env.CHANNEL_ID !== PROFILES[profile].channel) {
			bad(
				`CHANNEL_ID=${env.CHANNEL_ID} does not match the ${profile} channel (${PROFILES[profile].channel})`,
				`Set CHANNEL_ID=${PROFILES[profile].channel} in ${envFile}, or switch FEED_PROFILE to match the channel.`,
			);
		} else {
			ok(`channel ${env.CHANNEL_ID} matches the profile`);
		}
	}

	if (!env.TELEGRAM_BOT_TOKEN) {
		bad('TELEGRAM_BOT_TOKEN is missing', `Recover it: SERVICE=<service> ENV_FILE=${envFile} ./recover-env.sh --force`);
	}
	if (!/^-100\d+$/.test(env.CHANNEL_ID ?? '')) {
		bad(`CHANNEL_ID=${env.CHANNEL_ID ?? '(unset)'} is not a numeric -100… chat id`,
			'A @handle does not survive a username change. Use the numeric id.');
	}
	if ((env.ADMIN_USER_IDS ?? '').trim()) {
		warn('ADMIN_USER_IDS is set, so this instance long-polls. Only one instance per bot token may do that.');
	}
	if (!env.ALERT_CHAT_ID) {
		warn('ALERT_CHAT_ID is unset: an outage will be silent. Bind one with `npm run alerts:bind`.');
	} else {
		ok(`outage alerts go to ${env.ALERT_CHAT_ID}`);
	}
}

async function checkTelegram(env) {
	console.log('\n[2/3] telegram');
	const token = env.TELEGRAM_BOT_TOKEN;
	if (!token) { bad('skipped: no token', 'See step 1.'); return; }

	const me = await tg(token, 'getMe');
	if (!me.ok) {
		bad(`getMe failed: ${me.description}`, 'The token is wrong or revoked. Recover it from the deployed service.');
		return;
	}
	ok(`authenticated as @${me.result.username}`);

	const member = await tg(token, 'getChatMember', { chat_id: env.CHANNEL_ID, user_id: me.result.id });
	if (!member.ok) {
		// This is exactly what a demoted bot returns, and it reads like nothing.
		const demoted = /member list is inaccessible/i.test(member.description ?? '');
		bad(
			`cannot read its own membership in ${env.CHANNEL_ID}: ${member.description}`,
			demoted
				? `@${me.result.username} is not an administrator of that channel. Promote it in Telegram with "Send Messages" and "Send Photos". Nothing in this repo can grant that.`
				: 'Check that CHANNEL_ID is right and the bot was added to the channel.',
		);
		return;
	}
	const s = member.result.status;
	if (s === 'administrator' && member.result.can_post_messages !== false) {
		ok(`administrator with post rights in ${env.CHANNEL_ID}`);
	} else {
		bad(`status is "${s}" in ${env.CHANNEL_ID}, which cannot post`,
			`Promote @${me.result.username} to administrator with "Send Messages" and "Send Photos".`);
	}
}

async function checkRpc(env, args) {
	console.log('\n[3/3] rpc  (real pump-program payloads, not a liveness ping)');
	let urls = endpointsFromEnv(env);
	if (urls.length === 0) {
		bad('no RPC endpoints configured', `Set SOLANA_RPC_URL and SOLANA_RPC_URLS in ${args.envFile}.`);
		return { httpOk: [], wsOk: [] };
	}

	const rows = [];
	for (const u of urls) {
		const r = await probe(u);
		rows.push(r);
		const httpPass = r.slot?.ok && r.sigs?.ok && r.tx?.ok;
		const label = `${r.redacted}  http:${httpPass ? 'ok' : (r.slot?.error ?? r.sigs?.error ?? r.tx?.error)}  ws:${r.ws?.ok ? 'ok' : r.ws?.error}`;
		if (httpPass && r.ws?.ok) ok(label);
		else if (httpPass) warn(label);
		else console.log(`  FAIL  ${label}`);
	}

	const httpOk = rows.filter((r) => r.slot?.ok && r.sigs?.ok && r.tx?.ok);
	const wsOk = rows.filter((r) => r.ws?.ok);

	console.log(`\n  ${httpOk.length}/${rows.length} endpoints serve HTTP, ${wsOk.length}/${rows.length} deliver websocket events.`);

	if (httpOk.length === 0) {
		bad('every configured endpoint is dead: the feed cannot read the chain',
			`node scripts/doctor.mjs --env ${args.envFile} --fix --candidates`);
	} else if (wsOk.length === 0) {
		bad('no endpoint delivers websocket events: the feed falls back to polling and will miss claims',
			`node scripts/doctor.mjs --env ${args.envFile} --fix --candidates`);
	} else if (httpOk.length < 2 || wsOk.length < 2) {
		warn('fewer than two working endpoints per transport: the next outage takes the feed down.');
	}
	return { httpOk, wsOk };
}

function writeEnvKeys(path, updates) {
	const p = resolve(path);
	const lines = readFileSync(p, 'utf8').split('\n');
	const seen = new Set();
	const out = lines.map((l) => {
		for (const [k, v] of Object.entries(updates)) {
			if (l.startsWith(`${k}=`)) { seen.add(k); return `${k}=${v}`; }
		}
		return l;
	});
	for (const [k, v] of Object.entries(updates)) if (!seen.has(k)) out.push(`${k}=${v}`);
	writeFileSync(p, out.join('\n'));
	chmodSync(p, 0o600);
}

async function applyFix(env, args, current) {
	let { httpOk, wsOk } = current;

	if (args.candidates) {
		console.log('\nprobing the public pool for replacements...');
		const have = new Set(endpointsFromEnv(env));
		for (const c of PUBLIC_CANDIDATES) {
			if (have.has(c)) continue;
			const r = await probe(c);
			const httpPass = r.slot?.ok && r.sigs?.ok && r.tx?.ok;
			if (httpPass) { httpOk.push(r); console.log(`  found  ${r.redacted}${r.ws?.ok ? ' (+ws)' : ''}`); }
			if (r.ws?.ok) wsOk.push(r);
		}
	}

	if (httpOk.length === 0) {
		console.log('\nNothing to write: no endpoint passed. Add a keyed provider (Helius, Triton, QuickNode) and rerun.');
		return false;
	}

	// Keep the configured order, which puts the fastest/keyed provider first.
	const rpcList = httpOk.map((r) => r.url);
	const wsList = wsOk.map((r) => toWs(r.url)).filter(Boolean);

	writeEnvKeys(args.envFile, {
		SOLANA_RPC_URL: rpcList[0],
		SOLANA_RPC_URLS: rpcList.slice(1).join(','),
		SOLANA_WS_URL: wsList[0] ?? toWs(rpcList[0]),
		SOLANA_WS_URLS: wsList.join(','),
	});
	console.log(`\nWrote ${rpcList.length} RPC and ${wsList.length} websocket endpoints to ${args.envFile}.`);
	console.log('Redeploy for the running service to pick them up.');
	return true;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	let env;
	try {
		env = readEnvFile(args.envFile);
	} catch {
		console.error(`Cannot read ${args.envFile}. Recover it with ./recover-env.sh, or pass --env.`);
		process.exit(2);
	}
	if (Object.keys(env).length === 0) {
		console.error(`${args.envFile} is empty.`);
		process.exit(2);
	}

	console.log(`Diagnosing ${args.envFile}`);
	checkConfig(env, args.envFile);
	await checkTelegram(env);
	const rpcState = await checkRpc(env, args);

	if (args.fix) {
		const wrote = await applyFix(env, args, rpcState);
		if (wrote) {
			console.log('\nRerun without --fix to confirm the repair.');
			process.exit(0);
		}
	}

	console.log('\n' + '='.repeat(64));
	if (problems.length === 0) {
		console.log('HEALTHY. Every stage passed.');
		if (notes.length) console.log(`${notes.length} warning(s) above are worth closing but do not stop the feed.`);
		process.exit(0);
	}

	console.log(`BROKEN: ${problems.length} problem(s).\n`);
	problems.forEach((p, i) => {
		console.log(`${i + 1}. ${p.m}`);
		console.log(`   fix: ${p.fix}\n`);
	});
	process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(2);
});
