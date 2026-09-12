/**
 * Run async work with a concurrency cap and a total deadline, keeping whatever
 * finished in time.
 *
 * A GitHub social fee PDA can be linked to hundreds of coins. The claim path
 * used to resolve every one of them with an unbounded Promise.all before it
 * decided anything, so a dev with 354 linked coins fired 354 pump.fun API calls
 * at once, the API throttled them into ten-second timeouts, and the claim never
 * reached the first-or-repeat decision. Two GitHub claims were lost that way on
 * 2026-09-12. This makes that fan-out safe: at most `concurrency` calls are in
 * flight, the batch returns by `deadlineMs`, and a task that throws is counted
 * rather than propagated.
 */

export interface BoundedOptions {
    /** Maximum tasks in flight at once. Anything below 1, or not a number, runs one lane. */
    concurrency: number;
    /** Total time budget for the batch, in milliseconds. */
    deadlineMs: number;
}

export interface BoundedResult<R> {
    /** Values of tasks that resolved before the deadline, in completion order. */
    results: R[];
    /** Tasks that settled (resolved or rejected) before the deadline. */
    settled: number;
    /** True when the deadline fired before every task settled. */
    timedOut: boolean;
}

export async function mapBounded<T, R>(
    items: readonly T[],
    task: (item: T) => Promise<R>,
    options: BoundedOptions,
): Promise<BoundedResult<R>> {
    const results: R[] = [];
    let settled = 0;
    let next = 0;
    let expired = false;

    const worker = async (): Promise<void> => {
        while (!expired && next < items.length) {
            const item = items[next++] as T;
            try {
                const value = await task(item);
                if (!expired) results.push(value);
            } catch {
                // Throttling and timeouts are expected here; one failed lookup
                // must not sink the rest of the batch.
            }
            if (!expired) settled++;
        }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
            expired = true;
            resolve();
        }, options.deadlineMs);
    });

    const cap = Number.isFinite(options.concurrency) ? Math.floor(options.concurrency) : 1;
    const lanes = Math.max(1, Math.min(cap, items.length));
    const all = items.length === 0
        ? Promise.resolve()
        : Promise.all(Array.from({ length: lanes }, worker)).then(() => undefined);

    await Promise.race([all, deadline]);
    if (timer) clearTimeout(timer);

    return { results, settled, timedOut: expired && settled < items.length };
}
