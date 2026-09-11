/**
 * Self-reporting watchdog.
 *
 * Every failure this feed has actually suffered was silent. The bot lost its
 * post rights in @pumpfunclaims and kept running for six weeks with nobody
 * told; the all-claims sibling sat on a websocket that had gone key-gated for
 * four days still reporting "websocket mode". In both cases the process was up,
 * /health knew the truth, and /health is on a private Cloud Run service that
 * nothing was reading.
 *
 * So the bot reports on itself. Two conditions are watched:
 *
 *   delivery blocked   Telegram is refusing our posts (demoted, kicked, bad
 *                      chat id). Events are still being detected, so the feed
 *                      looks busy in the logs while the channel stays empty.
 *   upstream silent    No websocket event for `silenceMs`. The pump programs
 *                      are never quiet for long, so silence means the transport
 *                      died even though the subscription still looks healthy.
 *
 * Alerts go out over `sendMessage` to ALERT_CHAT_ID, which needs no long
 * polling, so a send-only instance can keep its own token and still escalate.
 * Each distinct problem alerts once, repeats at `repeatMs` while it persists,
 * and sends one recovery message when it clears.
 */

import { log } from './logger.js';

export interface DeliveryState {
	blocked: boolean;
	fault?: string;
	fix?: string;
	failures: number;
}

export interface WatchdogOptions {
	/** Send-only transport. Must not throw; failures are logged and dropped. */
	send: (text: string) => Promise<void>;
	/** Current delivery health, read fresh each tick. */
	delivery: () => DeliveryState;
	/** Monotonic count of websocket events seen since boot. */
	wsEventsReceived: () => number;
	/** A label for the feed, so one alert chat can serve several bots. */
	label: string;
	/** Env file this deployment runs on, named in alerts so the fix is copy-pasteable. */
	envFile?: string;
	checkIntervalMs?: number;
	silenceMs?: number;
	repeatMs?: number;
	now?: () => number;
}

const DEFAULT_CHECK_MS = 60_000;
const DEFAULT_SILENCE_MS = 10 * 60_000;
const DEFAULT_REPEAT_MS = 6 * 60 * 60_000;

export class Watchdog {
	private readonly opts: Required<Omit<WatchdogOptions, 'send' | 'delivery' | 'wsEventsReceived' | 'label'>> &
		Pick<WatchdogOptions, 'send' | 'delivery' | 'wsEventsReceived' | 'label'>;

	private timer?: ReturnType<typeof setInterval>;
	private lastEventCount = 0;
	private lastEventAt: number;
	private currentProblem: string | null = null;
	private lastAlertAt = 0;
	/** Set once a problem has been announced, so recovery is only sent after one. */
	private announced = false;

	constructor(options: WatchdogOptions) {
		const now = options.now ?? (() => Date.now());
		this.opts = {
			send: options.send,
			delivery: options.delivery,
			wsEventsReceived: options.wsEventsReceived,
			label: options.label,
			envFile: options.envFile ?? '.env',
			checkIntervalMs: options.checkIntervalMs ?? DEFAULT_CHECK_MS,
			silenceMs: options.silenceMs ?? DEFAULT_SILENCE_MS,
			repeatMs: options.repeatMs ?? DEFAULT_REPEAT_MS,
			now,
		};
		this.lastEventAt = now();
	}

	start(): void {
		if (this.timer) return;
		this.timer = setInterval(() => void this.tick(), this.opts.checkIntervalMs);
		// Never hold the process open on the watchdog alone.
		this.timer.unref?.();
		log.info(
			'Watchdog armed: alerting on blocked delivery and on %d min of websocket silence',
			Math.round(this.opts.silenceMs / 60_000),
		);
	}

	stop(): void {
		if (!this.timer) return;
		clearInterval(this.timer);
		this.timer = undefined;
	}

	/** Exposed for tests and for an immediate check at boot. */
	async tick(): Promise<void> {
		const now = this.opts.now();

		// Any forward progress in the event counter proves the transport is live.
		const events = this.opts.wsEventsReceived();
		if (events > this.lastEventCount) {
			this.lastEventCount = events;
			this.lastEventAt = now;
		}

		const problem = this.classify(now);

		if (problem !== this.currentProblem) {
			this.currentProblem = problem;
			if (problem) {
				this.announced = true;
				this.lastAlertAt = now;
				await this.emit(this.describe(problem, now));
			} else if (this.announced) {
				this.announced = false;
				await this.emit(`✅ ${this.opts.label}: recovered. Posting and receiving normally again.`);
			}
			return;
		}

		// Same problem as last tick: repeat on a slow cadence so a long outage
		// stays visible without becoming a notification flood.
		if (problem && now - this.lastAlertAt >= this.opts.repeatMs) {
			this.lastAlertAt = now;
			await this.emit(this.describe(problem, now));
		}
	}

	private classify(now: number): string | null {
		const delivery = this.opts.delivery();
		if (delivery.blocked) return `delivery:${delivery.fault ?? 'unknown'}`;
		if (now - this.lastEventAt >= this.opts.silenceMs) return 'silence';
		return null;
	}

	private describe(problem: string, now: number): string {
		// Every alert carries the command that diagnoses it. An outage that
		// arrives without one starts another multi-day investigation from zero,
		// which is what actually made past RPC failures expensive.
		const runDoctor = `\n\nDiagnose and repair:\n  npm run doctor -- --env ${this.opts.envFile}\n  npm run doctor -- --env ${this.opts.envFile} --fix --candidates`;

		if (problem === 'silence') {
			const mins = Math.round((now - this.lastEventAt) / 60_000);
			return (
				`🔇 ${this.opts.label}: no on-chain event for ${mins} min.\n` +
				`The pump programs are never quiet this long, so the transport is dead even though the subscription looks open. ` +
				`The feed rotates endpoints on its own, so if this persists every configured endpoint is refusing traffic.` +
				runDoctor
			);
		}
		const d = this.opts.delivery();
		return (
			`🚨 ${this.opts.label}: cannot post to the channel (${d.fault ?? 'unknown'}), ${d.failures} failed attempt(s).\n` +
			`Events are still being detected, so the feed looks busy while the channel stays empty.\n` +
			`FIX: ${d.fix ?? 'check the bot\'s channel permissions.'}` +
			runDoctor
		);
	}

	private async emit(text: string): Promise<void> {
		try {
			await this.opts.send(text);
			log.info('Watchdog alert sent: %s', text.split('\n')[0]);
		} catch (err) {
			// An alert that cannot be delivered must never take the feed down.
			log.warn('Watchdog alert failed to send: %s', (err as Error)?.message ?? err);
		}
	}
}
