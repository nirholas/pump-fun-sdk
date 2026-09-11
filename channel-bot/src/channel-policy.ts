/**
 * Channel policy: the last gate before anything reaches Telegram.
 *
 * Feed profiles (config.ts) decide which detection paths run. This module is
 * the failsafe underneath them: the two functions that actually call
 * sendMessage/sendPhoto ask it, per post, whether this kind of content is
 * allowed in this channel at all. A future path that forgets the profile, a
 * toggle flipped by hand, or a copy of the bot pointed at the wrong channel all
 * hit the same wall, because the check keys on what is being sent, not on how
 * the caller got there.
 *
 * @pumpfunclaims carries exactly one thing: a developer's first-ever GitHub
 * reward claim on a coin. Traders read it as "the dev is still working", and
 * every other kind of post in that channel dilutes that signal. Under its
 * profile nothing but that card (and follow-up replies to it) can be sent.
 */

import type { FeedProfileName } from './config.js';
import { log } from './logger.js';

export type PostKind =
    | 'github_first_claim'
    | 'creator_claim'
    | 'graduation'
    | 'launch'
    | 'whale'
    | 'fee_distribution'
    | 'follow_up';

/**
 * What each profile may put in its channel. `follow_up` is a reply threaded
 * under an existing post (performance milestones), so it inherits the
 * legitimacy of the post it answers.
 */
export const ALLOWED_POSTS: Record<FeedProfileName, ReadonlySet<PostKind>> = {
    'github-first-claims': new Set<PostKind>(['github_first_claim', 'follow_up']),
    graduations: new Set<PostKind>(['graduation', 'follow_up']),
};

export class ChannelPolicyError extends Error {
    readonly kind: PostKind;
    readonly profile: FeedProfileName;

    constructor(profile: FeedProfileName, kind: PostKind) {
        super(`Channel policy: "${kind}" is not allowed in the ${profile} channel`);
        this.name = 'ChannelPolicyError';
        this.kind = kind;
        this.profile = profile;
    }
}

/** True when a post of this kind may go to the channel under this profile. */
export function isPostAllowed(profile: FeedProfileName | undefined, kind: PostKind): boolean {
    // No profile means the deployment opted out of pinning; the FEED_* toggles
    // are its only policy, and the paths already honour those.
    if (!profile) return true;
    return ALLOWED_POSTS[profile].has(kind);
}

/**
 * Refuse a post the profile does not allow. Logs once per rejected kind so a
 * misrouted path is visible in the first minute, not buried per event.
 */
const reported = new Set<string>();
export function assertPostAllowed(profile: FeedProfileName | undefined, kind: PostKind): void {
    if (isPostAllowed(profile, kind)) return;
    const err = new ChannelPolicyError(profile as FeedProfileName, kind);
    const key = `${profile}:${kind}`;
    if (!reported.has(key)) {
        reported.add(key);
        log.error('%s. Dropped and will keep dropping; a path is posting content this channel is not for.', err.message);
    }
    throw err;
}

/** Test hook: forget which rejections have been logged. */
export function resetPolicyReports(): void {
    reported.clear();
}
