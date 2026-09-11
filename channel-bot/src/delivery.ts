/**
 * PumpFun Channel Bot — Delivery Diagnostics
 *
 * Telegram rejects a post for a handful of very different reasons, and the
 * raw grammY error is a stack trace that says none of them clearly. This
 * module turns a delivery failure into a verdict plus the exact fix, so an
 * operator reading the logs (or /health) knows what to do instead of what
 * broke.
 *
 * The preflight check runs at boot: a bot that cannot reach its channel
 * should say so on line one, not after the first missed event.
 */

import type { Api } from 'grammy';

import { log } from './logger.js';

export type DeliveryFault =
    | 'not_a_member'
    | 'chat_not_found'
    | 'no_permission'
    | 'blocked'
    | 'rate_limited'
    | 'transient'
    | 'unknown';

export interface DeliveryVerdict {
    fault: DeliveryFault;
    /** True when retrying the same call later could succeed on its own. */
    retryable: boolean;
    /** One-line operator instruction. Empty when no action is needed. */
    fix: string;
}

/** Classify a Telegram delivery error into a fault plus the fix for it. */
export function classifyDeliveryError(err: unknown, channelId: string): DeliveryVerdict {
    const description = String(
        (err as { description?: string })?.description ?? (err as Error)?.message ?? err,
    ).toLowerCase();

    if (description.includes('not a member') || description.includes('bot was kicked')) {
        return {
            fault: 'not_a_member',
            retryable: false,
            fix: `Add the bot to ${channelId} and grant it post rights (Telegram → group → Add members → the bot, then promote it to admin).`,
        };
    }
    if (description.includes('chat not found')) {
        return {
            fault: 'chat_not_found',
            retryable: false,
            fix: `CHANNEL_ID=${channelId} does not resolve. Check the @username or use the numeric -100… chat ID.`,
        };
    }
    if (description.includes('not enough rights') || description.includes('need administrator')) {
        return {
            fault: 'no_permission',
            retryable: false,
            fix: `The bot is in ${channelId} but cannot post. Promote it to admin with "Send Messages" (and "Send Photos" for cards).`,
        };
    }
    if (description.includes('blocked') || description.includes('bot was blocked')) {
        return { fault: 'blocked', retryable: false, fix: `The bot is blocked in ${channelId}. Unblock it to resume posting.` };
    }
    if (description.includes('too many requests') || description.includes('429')) {
        return { fault: 'rate_limited', retryable: true, fix: '' };
    }
    if (/50[0234]/.test(description) || description.includes('timeout') || description.includes('network')) {
        return { fault: 'transient', retryable: true, fix: '' };
    }
    return { fault: 'unknown', retryable: true, fix: '' };
}

/**
 * Thrown by the posting helpers once a failure has already been classified
 * and logged. Callers rethrow-and-catch around posting for control flow, so
 * without this marker every handler logs the same failure a second time as a
 * raw stack trace, which is exactly the noise the reporter exists to remove.
 */
export class DeliveryFailedError extends Error {
    readonly verdict: DeliveryVerdict;

    constructor(verdict: DeliveryVerdict, cause: unknown) {
        super(`Channel delivery failed (${verdict.fault})`);
        this.name = 'DeliveryFailedError';
        this.verdict = verdict;
        this.cause = cause;
    }
}

/** True when this error was already classified and logged by the reporter. */
export function isReportedDelivery(err: unknown): boolean {
    return err instanceof DeliveryFailedError;
}

export interface ChannelAccess {
    ok: boolean;
    fault?: DeliveryFault;
    fix?: string;
}

/**
 * Verify at boot that the bot can actually post to its channel.
 * Never throws: a preflight that cannot run must not stop the feed.
 */
/**
 * Telegram answers getChatMember with "member list is inaccessible" when the
 * caller is not an administrator of the chat. The string matches none of the
 * classifier's branches, so on its own it lands in the retryable `unknown`
 * bucket.
 */
function isMemberListInaccessible(err: unknown): boolean {
    const description = String(
        (err as { description?: string })?.description ?? (err as Error)?.message ?? err,
    ).toLowerCase();
    return description.includes('member list is inaccessible');
}

/** The chat's type, or undefined when it cannot be read. Never throws. */
async function chatTypeOf(api: Api, channelId: string): Promise<string | undefined> {
    try {
        return (await api.getChat(channelId)).type;
    } catch {
        return undefined;
    }
}

export async function verifyChannelAccess(api: Api, channelId: string, botId: number): Promise<ChannelAccess> {
    try {
        const member = await api.getChatMember(channelId, botId);
        const status = member.status;
        if (status === 'left' || status === 'kicked') {
            const verdict = classifyDeliveryError({ description: 'bot is not a member' }, channelId);
            return { ok: false, fault: verdict.fault, fix: verdict.fix };
        }
        if (status === 'restricted' && member.can_send_messages === false) {
            const verdict = classifyDeliveryError({ description: 'not enough rights' }, channelId);
            return { ok: false, fault: verdict.fault, fix: verdict.fix };
        }
        return { ok: true };
    } catch (err) {
        const verdict = classifyDeliveryError(err, channelId);
        // "member list is inaccessible" means the bot is not an admin. In a
        // channel that is decisive rather than inconclusive: a non-admin bot
        // cannot post there at all. Left in the retryable `unknown` bucket it
        // boots the feed logging "Channel access verified" and then silently
        // drops every event, which is the state @pumpfunclaims was in after
        // its bot was demoted. A group is different (a non-admin member can
        // still post), so only a channel converts the fault.
        if (verdict.fault === 'unknown' && isMemberListInaccessible(err)) {
            if ((await chatTypeOf(api, channelId)) === 'channel') {
                const demoted = classifyDeliveryError({ description: 'not enough rights' }, channelId);
                return { ok: false, fault: demoted.fault, fix: demoted.fix };
            }
        }
        // A transient probe failure is not proof of a broken channel.
        if (verdict.retryable) {
            log.warn('Channel preflight inconclusive (%s) — continuing', verdict.fault);
            return { ok: true };
        }
        return { ok: false, fault: verdict.fault, fix: verdict.fix };
    }
}

/**
 * Logs a delivery failure once per fault class, so a persistent
 * misconfiguration produces one actionable line instead of a stack trace
 * per event.
 */
export class DeliveryReporter {
    private reported = new Map<DeliveryFault, number>();
    private channelId: string;
    /** Consecutive failures since the last success. */
    failures = 0;
    /** Most recent unrecoverable fault, surfaced in /health and /status. */
    lastFault?: DeliveryFault;
    lastFix?: string;

    constructor(channelId: string) {
        this.channelId = channelId;
    }

    report(err: unknown): DeliveryVerdict {
        const verdict = classifyDeliveryError(err, this.channelId);
        this.failures++;
        if (!verdict.retryable) {
            this.lastFault = verdict.fault;
            this.lastFix = verdict.fix;
        }
        const seen = this.reported.get(verdict.fault) ?? 0;
        this.reported.set(verdict.fault, seen + 1);
        if (seen === 0) {
            if (verdict.fix) {
                log.error('Cannot post to %s (%s). FIX: %s', this.channelId, verdict.fault, verdict.fix);
            } else {
                log.error('Post to %s failed (%s): %s', this.channelId, verdict.fault, err);
            }
        } else if (seen === 1 || (seen + 1) % 25 === 0) {
            log.warn('Still cannot post to %s (%s) — %d failures so far. FIX: %s',
                this.channelId, verdict.fault, seen + 1, verdict.fix || 'see the first error above');
        }
        return verdict;
    }

    recordSuccess(): void {
        if (this.failures > 0) {
            log.info('Channel delivery recovered after %d failure(s)', this.failures);
        }
        this.failures = 0;
        this.lastFault = undefined;
        this.lastFix = undefined;
        this.reported.clear();
    }

    get healthy(): boolean {
        return this.lastFault === undefined;
    }
}
