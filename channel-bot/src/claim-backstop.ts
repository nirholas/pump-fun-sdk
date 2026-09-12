/**
 * A completeness backstop for GitHub claims that does not depend on the websocket.
 *
 * The websocket is a subscription to a busy program, and a claim can be lost
 * after it arrives: on 2026-09-12 the live feed saw 21 of the 23 GitHub claims
 * the chain recorded. Every GitHub social fee claim is co-signed by a single
 * pump.fun verifier, so that address's own history is the complete list, and it
 * is tiny (34 transactions in a day). Reading it every few seconds costs one
 * RPC call and catches whatever the websocket dropped.
 */

/** Co-signs every GitHub social fee claim. Verified on cards from April through September 2026. */
export const GITHUB_CLAIM_AUTHORITY = '2sMrGNK8i36YRkF5WWCwnaUYuwDJhHe1g2xA8aPvhkjM';

/** How often the verifier's history is read. */
export const BACKSTOP_POLL_MS = 20_000;

/** Signatures requested per read. At about 34 a day this spans more than a day. */
export const BACKSTOP_PAGE_SIZE = 50;

/**
 * Claims older than the process start minus this are never processed. It covers
 * the gap while a new revision boots, and it stops a redeploy from replaying
 * claims the previous revision already posted.
 */
export const BACKSTOP_STARTUP_GRACE_SEC = 180;

/** Fetch attempts for one transaction before it stops being retried. */
export const BACKSTOP_MAX_ATTEMPTS = 5;

export interface SignatureRef {
    signature: string;
    blockTime?: number | null;
    err?: unknown;
}

/**
 * Which of the verifier's recent signatures still need processing: successful,
 * no older than `earliestBlockTimeSec`, and not already handled. Returned oldest
 * first so a burst is processed in the order it happened.
 */
export function selectBackstopSignatures(
    refs: readonly SignatureRef[],
    earliestBlockTimeSec: number,
    isHandled: (signature: string) => boolean,
): string[] {
    const out: string[] = [];
    for (const ref of refs) {
        if (ref.err) continue;
        if (ref.blockTime == null || ref.blockTime < earliestBlockTimeSec) continue;
        if (isHandled(ref.signature)) continue;
        out.push(ref.signature);
    }
    return out.reverse();
}
