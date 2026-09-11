#!/usr/bin/env node
/**
 * Bind ALERT_CHAT_ID by having the bot learn your chat id from a DM.
 *
 * Telegram will not let a bot message a person who has never messaged it, so
 * the alert destination cannot be configured from the outside. This waits for
 * the first private message the bot receives, writes that chat id into the env
 * file, and sends a confirmation back so the path is proven end to end rather
 * than assumed.
 *
 * Usage:
 *   node scripts/bind-alert-chat.mjs                 # waits on .env.claims
 *   node scripts/bind-alert-chat.mjs --env .env
 *   node scripts/bind-alert-chat.mjs --timeout 300   # seconds, default 180
 *
 * Then message the bot (any text) from the account that should get alerts.
 *
 * Safe to run against a feed whose ADMIN_USER_IDS is empty: it calls getUpdates
 * only while it runs, and a send-only bot has no long poll to interrupt. Do NOT
 * run it while an instance with admin commands enabled is polling the same
 * token, or the two will split updates between them.
 */

import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
	const out = { envFile: '.env.claims', timeoutSec: 180 };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--env') out.envFile = argv[++i];
		else if (argv[i] === '--timeout') out.timeoutSec = Number(argv[++i]);
	}
	return out;
}

function readEnv(path) {
	const env = {};
	for (const line of readFileSync(resolve(path), 'utf8').split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#') || !t.includes('=')) continue;
		const i = t.indexOf('=');
		env[t.slice(0, i)] = t.slice(i + 1);
	}
	return env;
}

/** Set or append a key, preserving the rest of the file byte for byte. */
function writeKey(path, key, value) {
	const p = resolve(path);
	const lines = readFileSync(p, 'utf8').split('\n');
	let found = false;
	const out = lines.map((l) => {
		if (l.startsWith(`${key}=`)) { found = true; return `${key}=${value}`; }
		return l;
	});
	if (!found) out.push(`${key}=${value}`);
	writeFileSync(p, out.join('\n'));
	chmodSync(p, 0o600);
}

async function tg(token, method, params) {
	const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(params ?? {}),
	});
	return resp.json();
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const env = readEnv(args.envFile);
	const token = env.TELEGRAM_BOT_TOKEN;
	if (!token) throw new Error(`TELEGRAM_BOT_TOKEN missing from ${args.envFile}`);

	const me = await tg(token, 'getMe');
	if (!me.ok) throw new Error(`getMe failed: ${me.description}`);
	console.log(`Waiting for a DM to @${me.result.username} (up to ${args.timeoutSec}s).`);
	console.log('Open that chat in Telegram and send any message from the account that should receive alerts.');

	const deadline = Date.now() + args.timeoutSec * 1000;
	let offset;

	while (Date.now() < deadline) {
		// Long poll, bounded so the deadline is still honoured.
		const remaining = Math.max(1, Math.min(25, Math.floor((deadline - Date.now()) / 1000)));
		const updates = await tg(token, 'getUpdates', { timeout: remaining, offset, allowed_updates: ['message'] });
		if (!updates.ok) throw new Error(`getUpdates failed: ${updates.description}`);

		for (const u of updates.result) {
			offset = u.update_id + 1;
			const chat = u.message?.chat;
			if (!chat || chat.type !== 'private') continue;

			const who = chat.username ? `@${chat.username}` : (chat.first_name ?? String(chat.id));
			writeKey(args.envFile, 'ALERT_CHAT_ID', String(chat.id));
			console.log(`Bound ALERT_CHAT_ID=${chat.id} (${who}) in ${args.envFile}.`);

			const confirm = await tg(token, 'sendMessage', {
				chat_id: chat.id,
				text:
					'✅ Alert channel bound.\n\n' +
					'This chat now receives outage alerts for the PumpFun first-claims feed: ' +
					'blocked delivery, and websocket silence longer than 10 minutes. ' +
					'One message per problem, a repeat every 6 hours while it lasts, and one when it clears.',
				link_preview_options: { is_disabled: true },
			});
			if (!confirm.ok) {
				console.error(`Bound, but the confirmation failed to send: ${confirm.description}`);
				process.exit(1);
			}
			console.log('Confirmation delivered. Redeploy for the watchdog to pick it up.');
			return;
		}
	}

	console.error('No DM received before the timeout. Nothing was changed.');
	process.exit(1);
}

main().catch((err) => {
	console.error(err.message ?? err);
	process.exit(1);
});
