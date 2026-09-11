/**
 * Tests for delivery-failure classification and the once-per-fault reporter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
    classifyDeliveryError,
    DeliveryReporter,
    verifyChannelAccess,
    DeliveryFailedError,
    isReportedDelivery,
} from '../delivery.js';

const CHANNEL = '@trackpumpfun';

describe('classifyDeliveryError', () => {
    it('identifies a bot that is not in the group and names the fix', () => {
        const verdict = classifyDeliveryError(
            { description: 'Forbidden: bot is not a member of the supergroup chat' },
            CHANNEL,
        );
        expect(verdict.fault).toBe('not_a_member');
        expect(verdict.retryable).toBe(false);
        expect(verdict.fix).toContain(CHANNEL);
    });

    it('identifies a kicked bot as the same fault', () => {
        expect(classifyDeliveryError({ description: 'Forbidden: bot was kicked from the supergroup chat' }, CHANNEL).fault)
            .toBe('not_a_member');
    });

    it('identifies an unresolvable chat id', () => {
        const verdict = classifyDeliveryError({ description: 'Bad Request: chat not found' }, CHANNEL);
        expect(verdict.fault).toBe('chat_not_found');
        expect(verdict.retryable).toBe(false);
    });

    it('identifies missing post rights', () => {
        const verdict = classifyDeliveryError({ description: 'Bad Request: not enough rights to send text messages' }, CHANNEL);
        expect(verdict.fault).toBe('no_permission');
        expect(verdict.fix).toContain('admin');
    });

    it('treats rate limits and 5xx as retryable with no operator action', () => {
        const rateLimited = classifyDeliveryError({ description: 'Too Many Requests: retry after 12' }, CHANNEL);
        expect(rateLimited.fault).toBe('rate_limited');
        expect(rateLimited.retryable).toBe(true);
        expect(rateLimited.fix).toBe('');

        expect(classifyDeliveryError({ description: 'Bad Gateway 502' }, CHANNEL).fault).toBe('transient');
    });

    it('falls back to unknown+retryable for unrecognized errors', () => {
        const verdict = classifyDeliveryError(new Error('something entirely new'), CHANNEL);
        expect(verdict.fault).toBe('unknown');
        expect(verdict.retryable).toBe(true);
    });

    it('reads a plain Error message as well as a Telegram description', () => {
        expect(classifyDeliveryError(new Error('Forbidden: bot is not a member of the channel chat'), CHANNEL).fault)
            .toBe('not_a_member');
    });
});

describe('DeliveryReporter', () => {
    it('tracks health and clears it on success', () => {
        const reporter = new DeliveryReporter(CHANNEL);
        expect(reporter.healthy).toBe(true);

        reporter.report({ description: 'Forbidden: bot is not a member of the supergroup chat' });
        expect(reporter.healthy).toBe(false);
        expect(reporter.lastFault).toBe('not_a_member');
        expect(reporter.failures).toBe(1);

        reporter.recordSuccess();
        expect(reporter.healthy).toBe(true);
        expect(reporter.failures).toBe(0);
        expect(reporter.lastFault).toBeUndefined();
    });

    it('counts every failure but does not log a line per event', async () => {
        const { log } = await import('../logger.js');
        const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => {});
        try {
            const reporter = new DeliveryReporter(CHANNEL);
            for (let i = 0; i < 10; i++) {
                reporter.report({ description: 'Forbidden: bot is not a member of the supergroup chat' });
            }
            expect(reporter.failures).toBe(10);
            // One loud error for the first occurrence, not ten.
            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls.length).toBeLessThan(10);
        } finally {
            errorSpy.mockRestore();
            warnSpy.mockRestore();
        }
    });

    it('keeps rate limiting out of the unrecoverable-fault state', () => {
        const reporter = new DeliveryReporter(CHANNEL);
        reporter.report({ description: 'Too Many Requests: retry after 5' });
        expect(reporter.healthy).toBe(true);
        expect(reporter.failures).toBe(1);
    });
});

describe('isReportedDelivery', () => {
    it('marks an already-reported failure so callers stay quiet', () => {
        const reporter = new DeliveryReporter(CHANNEL);
        const original = { description: 'Forbidden: bot is not a member of the supergroup chat' };
        const wrapped = new DeliveryFailedError(reporter.report(original), original);

        expect(isReportedDelivery(wrapped)).toBe(true);
        expect(wrapped.verdict.fault).toBe('not_a_member');
        expect(wrapped.cause).toBe(original);
    });

    it('does not mark unrelated errors, so real bugs still log', () => {
        expect(isReportedDelivery(new Error('enrichment blew up'))).toBe(false);
        expect(isReportedDelivery('a string')).toBe(false);
        expect(isReportedDelivery(undefined)).toBe(false);
    });
});

describe('verifyChannelAccess', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        const { log } = await import('../logger.js');
        warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => {});
    });

    afterEach(() => warnSpy.mockRestore());

    it('fails a channel whose bot was demoted, instead of passing it as inconclusive', async () => {
        // What Telegram actually returns to a non-admin caller. Before this was
        // handled it classified as retryable `unknown`, so the preflight logged
        // "Channel access verified" for a bot that could not post at all.
        const api = {
            getChatMember: async () => {
                throw { description: 'Bad Request: member list is inaccessible' };
            },
            getChat: async () => ({ type: 'channel' }),
        };
        const access = await verifyChannelAccess(api as never, CHANNEL, 1);
        expect(access.ok).toBe(false);
        expect(access.fault).toBe('no_permission');
        expect(access.fix).toContain(CHANNEL);
    });

    it('still passes a group on the same error, where a non-admin bot can post', async () => {
        const api = {
            getChatMember: async () => {
                throw { description: 'Bad Request: member list is inaccessible' };
            },
            getChat: async () => ({ type: 'supergroup' }),
        };
        await expect(verifyChannelAccess(api as never, CHANNEL, 1)).resolves.toEqual({ ok: true });
    });

    it('passes when the chat type cannot be read, so a flaky probe never fails the boot', async () => {
        const api = {
            getChatMember: async () => {
                throw { description: 'Bad Request: member list is inaccessible' };
            },
            getChat: async () => {
                throw new Error('network');
            },
        };
        await expect(verifyChannelAccess(api as never, CHANNEL, 1)).resolves.toEqual({ ok: true });
    });

    it('passes for a member that can post', async () => {
        const api = { getChatMember: async () => ({ status: 'administrator' }) };
        await expect(verifyChannelAccess(api as never, CHANNEL, 1)).resolves.toEqual({ ok: true });
    });

    it('fails with a fix when the bot has left the chat', async () => {
        const api = { getChatMember: async () => ({ status: 'left' }) };
        const result = await verifyChannelAccess(api as never, CHANNEL, 1);
        expect(result.ok).toBe(false);
        expect(result.fault).toBe('not_a_member');
        expect(result.fix).toContain(CHANNEL);
    });

    it('fails when the bot is restricted from sending messages', async () => {
        const api = { getChatMember: async () => ({ status: 'restricted', can_send_messages: false }) };
        const result = await verifyChannelAccess(api as never, CHANNEL, 1);
        expect(result.ok).toBe(false);
        expect(result.fault).toBe('no_permission');
    });

    it('does not condemn the channel on a transient probe failure', async () => {
        const api = { getChatMember: async () => { throw new Error('network timeout'); } };
        await expect(verifyChannelAccess(api as never, CHANNEL, 1)).resolves.toEqual({ ok: true });
    });
});
