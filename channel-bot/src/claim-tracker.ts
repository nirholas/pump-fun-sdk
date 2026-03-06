/**
 * PumpFun Channel Bot — Claim Tracker
 *
 * Tracks claim history per wallet+token to show "first claim"
 * vs "claim #N" and total claimed amounts in the channel feed.
 */

export interface ClaimRecord {
    /** Total number of claims by this wallet for this token */
    claimCount: number;
    /** Total SOL claimed so far */
    totalClaimedSol: number;
    /** Timestamp of the first claim (unix seconds) */
    firstClaimTimestamp: number;
    /** Timestamp of the most recent claim (unix seconds) */
    lastClaimTimestamp: number;
}

/** Key: "wallet:mint" */
const claimHistory = new Map<string, ClaimRecord>();

/** Tracks which tokens have had ANY claim (key: mint) */
const tokenFirstClaim = new Set<string>();

/** Max entries before eviction of oldest */
const MAX_ENTRIES = 50_000;

function makeKey(wallet: string, mint: string): string {
    return `${wallet}:${mint}`;
}

/**
 * Record a new claim and return the updated record.
 * Returns the state AFTER recording (so claimCount=1 means first-ever claim).
 */
export function recordClaim(
    wallet: string,
    mint: string,
    amountSol: number,
    timestamp: number,
): ClaimRecord {
    const key = makeKey(wallet, mint);
    const existing = claimHistory.get(key);

    if (existing) {
        existing.claimCount++;
        existing.totalClaimedSol += amountSol;
        existing.lastClaimTimestamp = timestamp;
        return { ...existing };
    }

    const record: ClaimRecord = {
        claimCount: 1,
        totalClaimedSol: amountSol,
        firstClaimTimestamp: timestamp,
        lastClaimTimestamp: timestamp,
    };
    claimHistory.set(key, record);

    // Evict oldest entries if over limit
    if (claimHistory.size > MAX_ENTRIES) {
        let oldest = '';
        let oldestTime = Infinity;
        for (const [k, v] of claimHistory) {
            if (v.lastClaimTimestamp < oldestTime) {
                oldestTime = v.lastClaimTimestamp;
                oldest = k;
            }
        }
        if (oldest) claimHistory.delete(oldest);
    }

    return { ...record };
}

/** Get claim history for a wallet+token without recording. */
export function getClaimRecord(wallet: string, mint: string): ClaimRecord | null {
    return claimHistory.get(makeKey(wallet, mint)) ?? null;
}

/**
 * Returns true if this is the first-ever claim on this token (any wallet).
 * Marks the token as claimed so subsequent calls return false.
 */
export function isFirstClaimOnToken(mint: string): boolean {
    if (tokenFirstClaim.has(mint)) return false;
    tokenFirstClaim.add(mint);
    // Evict oldest if over limit
    if (tokenFirstClaim.size > MAX_ENTRIES) {
        const first = tokenFirstClaim.values().next().value;
        if (first) tokenFirstClaim.delete(first);
    }
    return true;
}

/** Total unique wallet+token pairs tracked. */
export function getTrackedCount(): number {
    return claimHistory.size;
}
