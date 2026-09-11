/**
 * Tests for the self-reporting watchdog.
 *
 * The watchdog only matters during an outage, so every case here is a failure
 * path: it must alert once, repeat slowly rather than flood, recover cleanly,
 * and never let a failed alert take the feed down with it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Watchdog, type DeliveryState } from '../watchdog.js';

const OK: DeliveryState = { blocked: false, failures: 0 };
const BLOCKED: DeliveryState = {
	blocked: true,
	fault: 'no_permission',
	fix: 'Promote it to admin.',
	failures: 3,
};

function harness(opts: { delivery: () => DeliveryState; events: () => number; now: () => number }) {
	const sent: string[] = [];
	const wd = new Watchdog({
		label: 'test feed',
		send: async (t) => { sent.push(t); },
		delivery: opts.delivery,
		wsEventsReceived: opts.events,
		silenceMs: 10 * 60_000,
		repeatMs: 6 * 60 * 60_000,
		now: opts.now,
	});
	return { wd, sent };
}

describe('Watchdog', () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		const { log } = await import('../logger.js');
		logSpy = vi.spyOn(log, 'info').mockImplementation(() => {});
		warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => {});
	});

	afterEach(() => { logSpy.mockRestore(); warnSpy.mockRestore(); });

	it('stays silent while delivery works and events keep arriving', async () => {
		let t = 0;
		let events = 0;
		const { wd, sent } = harness({ delivery: () => OK, events: () => events, now: () => t });
		for (let i = 0; i < 5; i++) { t += 60_000; events += 3; await wd.tick(); }
		expect(sent).toEqual([]);
	});

	it('alerts once when delivery is blocked, naming the fault and the fix', async () => {
		let t = 0;
		let events = 0;
		const { wd, sent } = harness({ delivery: () => BLOCKED, events: () => events, now: () => t });
		t += 60_000; events += 3; await wd.tick();
		t += 60_000; events += 3; await wd.tick();
		t += 60_000; events += 3; await wd.tick();
		expect(sent).toHaveLength(1);
		expect(sent[0]).toContain('no_permission');
		expect(sent[0]).toContain('Promote it to admin.');
	});

	it('repeats a persistent problem only after the repeat window', async () => {
		let t = 0;
		let events = 0;
		const { wd, sent } = harness({ delivery: () => BLOCKED, events: () => events, now: () => t });
		t += 60_000; events += 1; await wd.tick();
		expect(sent).toHaveLength(1);
		// Five hours of ticks: still one alert.
		for (let i = 0; i < 5; i++) { t += 60 * 60_000; events += 1; await wd.tick(); }
		expect(sent).toHaveLength(1);
		// Past six hours: a second.
		t += 2 * 60 * 60_000; events += 1; await wd.tick();
		expect(sent).toHaveLength(2);
	});

	it('sends exactly one recovery message after a problem clears', async () => {
		let t = 0;
		let events = 0;
		let state = BLOCKED;
		const { wd, sent } = harness({ delivery: () => state, events: () => events, now: () => t });
		t += 60_000; events += 1; await wd.tick();
		state = OK;
		t += 60_000; events += 1; await wd.tick();
		t += 60_000; events += 1; await wd.tick();
		expect(sent).toHaveLength(2);
		expect(sent[1]).toContain('recovered');
	});

	it('never reports recovery when nothing was ever wrong', async () => {
		let t = 0;
		let events = 0;
		const { wd, sent } = harness({ delivery: () => OK, events: () => events, now: () => t });
		t += 60_000; events += 1; await wd.tick();
		expect(sent).toEqual([]);
	});

	it('alerts when the websocket stops delivering, even though delivery is fine', async () => {
		let t = 0;
		const events = 7; // frozen: the transport died
		const { wd, sent } = harness({ delivery: () => OK, events: () => events, now: () => t });
		t += 60_000; await wd.tick();
		expect(sent).toEqual([]);
		t += 11 * 60_000; await wd.tick();
		expect(sent).toHaveLength(1);
		expect(sent[0]).toContain('no on-chain event');
	});

	it('treats a moving event counter as proof the transport is alive', async () => {
		let t = 0;
		let events = 0;
		const { wd, sent } = harness({ delivery: () => OK, events: () => events, now: () => t });
		for (let i = 0; i < 30; i++) { t += 60_000; events += 1; await wd.tick(); }
		expect(sent).toEqual([]);
	});

	it('survives an alert transport that throws', async () => {
		let t = 0;
		const wd = new Watchdog({
			label: 'test feed',
			send: async () => { throw new Error('telegram down'); },
			delivery: () => BLOCKED,
			wsEventsReceived: () => 1,
			now: () => t,
		});
		t += 60_000;
		await expect(wd.tick()).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});
});
