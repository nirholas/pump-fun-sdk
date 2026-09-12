/**
 * The first-or-repeat decision for GitHub social fee claims, kept free of any
 * network call.
 *
 * A SocialFeePdaClaimed event carries the claim amount and the PDA's lifetime
 * totals, which already include this claim. V2 events keep two totals: SOL in
 * lifetime_claimed and every non-SOL quote asset in lifetime_stable_claimed.
 * A claim is first-ever only when the counter for its own currency equals the
 * amount and the other counter is empty. Reading only the SOL counter made a
 * veteran's 203.7 stablecoin claim look first on 2026-09-11: SOL lifetime 157.9,
 * stable lifetime 328.0.
 *
 * This runs before any enrichment: when enrichment came first, a dev with
 * hundreds of linked coins stalled the handler and the claim was never
 * classified at all.
 */

/** Slack for rounding between an event's amount and its lifetime fields. */
const LIFETIME_TOLERANCE = 1.01;

/** Concurrent pump.fun lookups when resolving the coins linked to one PDA. */
export const LINKED_TOKEN_CONCURRENCY = 6;

/** Budget for resolving a PDA's linked coins; the best coin found by then is used. */
export const LINKED_TOKEN_DEADLINE_MS = 20_000;

/** Quote mints that mean SOL. V2 events write the all-zero key; wrapped SOL is accepted too. */
const SOL_QUOTE_MINTS = new Set([
    '11111111111111111111111111111111',
    'So11111111111111111111111111111111111111112',
]);

/** True when a claim's quote currency is SOL. A missing mint is a pre-V2 event, which was SOL-only. */
export function isSolQuote(quoteMint: string | undefined): boolean {
    return quoteMint == null || SOL_QUOTE_MINTS.has(quoteMint);
}

/**
 * `candidate` means the chain does not rule the claim out. The local tracker
 * decides next, once the coin is resolved.
 */
export type OnchainVerdict = 'fake' | 'repeat' | 'candidate';

export interface ClaimCounters {
    /** Claim amount in base units of its quote currency. */
    amount: number;
    /** PDA lifetime claimed in SOL, in lamports. Absent on events without the field. */
    lifetimeSol?: number | null;
    /** PDA lifetime claimed in non-SOL quote assets, in base units. Absent before V2. */
    lifetimeStable?: number | null;
    quoteMint?: string;
    isFake: boolean;
}

export function onchainClaimVerdict(claim: ClaimCounters): OnchainVerdict {
    if (claim.isFake) return 'fake';
    const beyondThisClaim = (lifetime: number) => lifetime > claim.amount * LIFETIME_TOLERANCE;

    if (isSolQuote(claim.quoteMint)) {
        if (claim.lifetimeSol != null && beyondThisClaim(claim.lifetimeSol)) return 'repeat';
        // Anything already claimed in another asset is a prior claim.
        if (claim.lifetimeStable != null && claim.lifetimeStable > 0) return 'repeat';
        return 'candidate';
    }

    // Paid in a non-SOL asset: its own counter must carry exactly this claim.
    if (claim.lifetimeSol != null && claim.lifetimeSol > 0) return 'repeat';
    // Without the stable counter a first-ever claim cannot be established, and a
    // false first card is worse than a missed one.
    if (claim.lifetimeStable == null) return 'repeat';
    if (beyondThisClaim(claim.lifetimeStable)) return 'repeat';
    return 'candidate';
}

export interface SkippedClaimFields {
    githubUserId?: string;
    amountLamports: number;
    lifetimeClaimedLamports?: number | null;
    lifetimeStableClaimedRaw?: number | null;
    quoteMint?: string;
    txSignature: string;
}

/**
 * The line logged for every rejected claim. It prints every number the decision
 * turns on so a quiet feed stays auditable against the chain, and it always
 * starts with `Skipped` and ends with `tx=` plus 12 characters, which is what
 * the audit tooling matches.
 */
export function formatSkippedClaim(kind: 'fake' | 'repeat', claim: SkippedClaimFields, mint: string): string {
    const units = (raw: number | null | undefined): string =>
        raw == null ? 'unknown' : (raw / 1e9).toFixed(4);
    const quote = isSolQuote(claim.quoteMint) ? 'SOL' : (claim.quoteMint ?? '').slice(0, 8);
    return `Skipped ${kind} claim: github=${claim.githubUserId ?? 'unknown'}`
        + ` mint=${mint ? mint.slice(0, 8) : 'unresolved'}`
        + ` amount=${units(claim.amountLamports)} ${quote}`
        + ` lifetime=${units(claim.lifetimeClaimedLamports)} SOL`
        + ` stableLifetime=${units(claim.lifetimeStableClaimedRaw)}`
        + ` tx=${claim.txSignature.slice(0, 12)}`;
}
