/**
 * The first-or-repeat decision for GitHub social fee claims, kept free of any
 * network call.
 *
 * Every SocialFeePdaClaimed event carries the claim amount and the PDA's
 * lifetime_claimed, and lifetime_claimed already includes this claim. A genuine
 * first-ever claim therefore has lifetime equal to amount, and anything larger
 * means the dev has claimed before. That answer needs nothing from pump.fun's
 * API, which is why it must be taken before any enrichment runs: when the
 * enrichment came first, a dev with hundreds of linked coins stalled the
 * handler and the claim was never classified at all.
 */

/** Slack for rounding between the event's amount and lifetime fields. */
const LIFETIME_TOLERANCE = 1.01;

/** Concurrent pump.fun lookups when resolving the coins linked to one PDA. */
export const LINKED_TOKEN_CONCURRENCY = 6;

/** Budget for resolving a PDA's linked coins; the best coin found by then is used. */
export const LINKED_TOKEN_DEADLINE_MS = 20_000;

/**
 * `candidate` means the chain does not rule the claim out: lifetime matches the
 * amount, or the event had no lifetime field. The local tracker decides next,
 * once the coin is resolved.
 */
export type OnchainVerdict = 'fake' | 'repeat' | 'candidate';

export function onchainClaimVerdict(
    amountLamports: number,
    lifetimeClaimedLamports: number | null | undefined,
    isFake: boolean,
): OnchainVerdict {
    if (isFake) return 'fake';
    if (lifetimeClaimedLamports != null && lifetimeClaimedLamports > amountLamports * LIFETIME_TOLERANCE) {
        return 'repeat';
    }
    return 'candidate';
}

export interface SkippedClaimFields {
    githubUserId?: string;
    amountLamports: number;
    lifetimeClaimedLamports?: number | null;
    txSignature: string;
}

/**
 * The line logged for every rejected claim. It prints the two numbers the
 * decision turns on so a quiet feed stays auditable against the chain, and its
 * shape is what scripts/audit tooling matches on (`Skipped`, `tx=` + 12 chars).
 */
export function formatSkippedClaim(kind: 'fake' | 'repeat', claim: SkippedClaimFields, mint: string): string {
    const sol = (lamports: number | null | undefined): string =>
        lamports == null ? 'unknown' : (lamports / 1e9).toFixed(4);
    return `Skipped ${kind} claim: github=${claim.githubUserId ?? 'unknown'}`
        + ` mint=${mint ? mint.slice(0, 8) : 'unresolved'}`
        + ` amount=${sol(claim.amountLamports)} SOL`
        + ` lifetime=${sol(claim.lifetimeClaimedLamports)} SOL`
        + ` tx=${claim.txSignature.slice(0, 12)}`;
}
