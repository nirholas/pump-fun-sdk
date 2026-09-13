import { Connection } from '@solana/web3.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../config.js';
import { EventMonitor } from '../event-monitor.js';
import { Watchdog, feedWsEventCount } from '../watchdog.js';

vi.mock('../logger.js', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('graduation feed watchdog', () => {
    let monitor: EventMonitor;
    let receive: Parameters<Connection['onLogs']>[1];

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        vi.stubEnv('TELEGRAM_BOT_TOKEN', '1:test');
        vi.stubEnv('CHANNEL_ID', '-1003818751043');
        vi.stubEnv('FEED_PROFILE', 'graduations');
        vi.stubEnv('SOLANA_RPC_URL', 'https://rpc.example.invalid');
        vi.stubEnv('SOLANA_RPC_URLS', '');
        vi.stubEnv('SOLANA_WS_URL', 'wss://rpc.example.invalid');
        vi.stubEnv('SOLANA_WS_URLS', '');
        vi.spyOn(Connection.prototype, 'onLogs').mockImplementation((_filter, callback) => {
            receive = callback;
            return 1;
        });
        vi.spyOn(Connection.prototype, 'removeOnLogsListener').mockResolvedValue();
        monitor = new EventMonitor(loadConfig(), vi.fn(), vi.fn(), vi.fn(), vi.fn());
        await monitor.start();
    });

    afterEach(() => {
        monitor.stop();
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        vi.useRealTimers();
    });

    async function receiveLog() {
        // Even traffic with no graduation proves the subscription is alive.
        await receive({ signature: `sig-${Date.now()}`, logs: [], err: null }, { slot: 1 });
    }

    it('does not report 31 hours of silence when claims are disabled and Pump logs keep arriving', async () => {
        expect(loadConfig().feed.claims).toBe(false);
        const send = vi.fn().mockResolvedValue(undefined);
        const watchdog = new Watchdog({
            label: 'graduations', send,
            delivery: () => ({ blocked: false, failures: 0 }),
            wsEventsReceived: () => feedWsEventCount(null, monitor),
        });

        for (let minute = 1; minute <= 31 * 60; minute++) {
            vi.setSystemTime(minute * 60_000);
            await receiveLog();
            await watchdog.tick();
        }
        expect(send).not.toHaveBeenCalled();
        expect(monitor.getMetrics()).toEqual({ wsEventsReceived: 1860, lastWsEventAt: Date.now() });

        vi.setSystemTime(Date.now() + 11 * 60_000);
        await watchdog.tick();
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0]![0]).toContain('no on-chain event');
        await receiveLog();
        await watchdog.tick();
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[1]![0]).toContain('recovered');
    });

    it('does not count opening a subscription as receiving an event', async () => {
        expect(monitor.mode).toBe('websocket');
        expect(monitor.getMetrics()).toEqual({ wsEventsReceived: 0, lastWsEventAt: null });
        const send = vi.fn().mockResolvedValue(undefined);
        const watchdog = new Watchdog({
            label: 'graduations', send,
            delivery: () => ({ blocked: false, failures: 0 }),
            wsEventsReceived: () => feedWsEventCount(null, monitor),
        });
        vi.setSystemTime(11 * 60_000);
        await watchdog.tick();
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('does not report reconnect attempts as new activity', async () => {
        await receiveLog();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(Connection.prototype.onLogs).toHaveBeenCalledTimes(2);
        expect(monitor.getMetrics()).toEqual({ wsEventsReceived: 1, lastWsEventAt: 0 });
    });

    it('still detects a stalled claims monitor even if the optional event stream is busy', async () => {
        let claims = 0;
        const claimMonitor = { getMetrics: () => ({ wsEventsReceived: claims }) };
        const send = vi.fn().mockResolvedValue(undefined);
        const watchdog = new Watchdog({
            label: 'claims', send,
            delivery: () => ({ blocked: false, failures: 0 }),
            wsEventsReceived: () => feedWsEventCount(claimMonitor, monitor),
        });
        vi.setSystemTime(11 * 60_000);
        await receiveLog();
        await watchdog.tick();
        expect(send).toHaveBeenCalledTimes(1);
        claims++;
        await watchdog.tick();
        expect(send.mock.calls[1]![0]).toContain('recovered');
    });
});
