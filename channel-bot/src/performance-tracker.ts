/**
 * PumpFun Channel Bot — Performance Tracker
 *
 * Follows up on cards the channel already posted. When a called token crosses
 * a multiple of its market cap at alert time (2x, 5x, 10x…) or collapses, the
 * bot replies to the original message with the result.
 *
 * This is what turns a feed into a track record: every call is scored in
 * public, in the same thread, without anyone having to go look it up.
 *
 * Tracking state is persisted, so a restart or redeploy does not silently
 * abandon every open call.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { log } from './logger.js';
import { formatTicker } from './formatters.js';
import { fetchTokenInfo, fetchDevWalletInfo } from './pump-client.js';

export interface TrackedPost {
    mint: string;
    /** Telegram message id of the original card, used as the reply target */
    messageId: number;
    symbol: string;
    /** Market cap in USD when the card was posted */
    baselineMcapUsd: number;
    /** Unix ms when the card was posted */
    postedAt: number;
    /** Multiples already announced, so each milestone fires once */
    announced: number[];
    /** Highest market cap seen since the alert */
    peakMcapUsd: number;
    /** True once a collapse has been announced; no further updates follow */
    closed: boolean;
    /** Creator wallet, when known, so the dev position can be re-checked */
    devWallet?: string;
    /** Percentage of supply the dev held when the card was posted */
    baselineDevPct?: number;
    /** True once a dev sell-off has been announced */
    devDumpAnnounced?: boolean;
}

export interface PerformanceTrackerOptions {
    /** How long a call stays tracked, in hours */
    windowHours?: number;
    /** How often to sweep tracked calls */
    checkIntervalMs?: number;
    /** Multiples that trigger an update */
    milestones?: number[];
    /** Drawdown from the alert price that counts as a collapse, in percent */
    collapsePct?: number;
    /** Maximum concurrent tracked calls; oldest are dropped first */
    maxTracked?: number;
    /** Smallest baseline worth tracking — dust market caps produce fake multiples */
    minBaselineUsd?: number;
    /** Posts the follow-up as a reply to the original card */
    postUpdate: (text: string, replyToMessageId: number) => Promise<void>;
    /** Market cap lookup; injectable so tests never touch the network */
    fetchMcap?: (mint: string) => Promise<number | null>;
    /** Dev holding lookup as a percent of supply; injectable for tests */
    fetchDevPct?: (devWallet: string, mint: string) => Promise<number | null>;
    /** Relative drop in the dev position that counts as a dump, in percent */
    devDumpPct?: number;
    /** Smallest dev position worth watching, in percent of supply */
    minDevPct?: number;
    /** RPC endpoint used for the on-chain dev balance lookup */
    rpcUrl?: string;
    /** Where open calls persist across restarts; null disables persistence */
    statePath?: string | null;
}

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const STATE_FILE = join(DATA_DIR, 'performance-tracker.json');

const DEFAULTS = {
    windowHours: 24,
    checkIntervalMs: 180_000,
    milestones: [2, 5, 10, 25, 50, 100],
    collapsePct: 80,
    maxTracked: 250,
    minBaselineUsd: 1_000,
    devDumpPct: 30,
    minDevPct: 0.5,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    statePath: STATE_FILE as string | null,
};

const SAVE_DEBOUNCE_MS = 5_000;

function formatUsd(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

function formatAge(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? `${hours}h${rem}m` : `${hours}h`;
}

/** Build the follow-up text for a milestone crossing. */
export function formatMilestoneUpdate(post: TrackedPost, multiple: number, currentMcap: number, now: number): string {
    const rocket = multiple >= 50 ? '🌕' : multiple >= 10 ? '🚀🚀' : '🚀';
    return [
        `${rocket} <b>${formatTicker(post.symbol)} ${multiple}x since this call</b>`,
        `${formatUsd(post.baselineMcapUsd)} → ${formatUsd(currentMcap)} in ${formatAge(now - post.postedAt)}`,
    ].join('\n');
}

/** Build the follow-up text for a collapse. */
export function formatCollapseUpdate(post: TrackedPost, currentMcap: number, now: number): string {
    const dropPct = ((post.baselineMcapUsd - currentMcap) / post.baselineMcapUsd) * 100;
    const lines = [
        `💀 <b>${formatTicker(post.symbol)} -${dropPct.toFixed(0)}% since this call</b>`,
        `${formatUsd(post.baselineMcapUsd)} → ${formatUsd(currentMcap)} in ${formatAge(now - post.postedAt)}`,
    ];
    if (post.peakMcapUsd > post.baselineMcapUsd * 1.5) {
        lines.push(`Peak was ${formatUsd(post.peakMcapUsd)} (${(post.peakMcapUsd / post.baselineMcapUsd).toFixed(1)}x)`);
    }
    return lines.join('\n');
}

/** Build the follow-up text for a dev selling down their position. */
export function formatDevDumpUpdate(post: TrackedPost, currentPct: number, now: number): string {
    const from = post.baselineDevPct ?? 0;
    const dropPct = from > 0 ? ((from - currentPct) / from) * 100 : 0;
    return [
        `🚨 <b>${formatTicker(post.symbol)} dev is selling</b>`,
        `Dev position ${from.toFixed(1)}% → ${currentPct.toFixed(1)}% of supply (-${dropPct.toFixed(0)}%)`,
        `${formatAge(now - post.postedAt)} after this call`,
    ].join('\n');
}

/**
 * Highest milestone the token has reached that has not been announced yet.
 * Returns null when nothing new was crossed. Announcing only the highest
 * avoids a burst of 2x/5x/10x replies when a token moves between sweeps.
 */
export function nextMilestone(post: TrackedPost, multiple: number, milestones: number[]): number | null {
    const crossed = milestones.filter((m) => multiple >= m && !post.announced.includes(m));
    if (crossed.length === 0) return null;
    return Math.max(...crossed);
}

export class PerformanceTracker {
    private posts = new Map<string, TrackedPost>();
    private opts: Required<Omit<PerformanceTrackerOptions, 'postUpdate' | 'fetchMcap' | 'fetchDevPct'>> & PerformanceTrackerOptions;
    private timer?: ReturnType<typeof setInterval>;
    private saveTimer?: ReturnType<typeof setTimeout>;
    private sweeping = false;
    readonly stats = { tracked: 0, milestonesPosted: 0, collapsesPosted: 0, devDumpsPosted: 0, expired: 0 };

    constructor(options: PerformanceTrackerOptions) {
        this.opts = { ...DEFAULTS, ...options };
        this.load();
    }

    /** Begin tracking a posted card. No-op when the baseline is too small to be meaningful. */
    track(input: { mint: string; messageId: number; symbol: string; mcapUsd: number; devWallet?: string; devPct?: number }): void {
        if (!input.messageId || input.mcapUsd < this.opts.minBaselineUsd) return;
        if (this.posts.has(input.mint)) return;

        this.posts.set(input.mint, {
            mint: input.mint,
            messageId: input.messageId,
            symbol: input.symbol || '???',
            baselineMcapUsd: input.mcapUsd,
            postedAt: Date.now(),
            announced: [],
            peakMcapUsd: input.mcapUsd,
            closed: false,
            devWallet: input.devWallet,
            baselineDevPct: input.devPct,
        });
        this.stats.tracked++;

        // Drop the oldest calls rather than growing without bound.
        while (this.posts.size > this.opts.maxTracked) {
            const oldest = [...this.posts.values()].sort((a, b) => a.postedAt - b.postedAt)[0];
            if (!oldest) break;
            this.posts.delete(oldest.mint);
        }
        this.scheduleSave();
    }

    start(): void {
        if (this.timer) return;
        this.timer = setInterval(() => { void this.sweep(); }, this.opts.checkIntervalMs);
        log.info('Performance tracker: %dh window, milestones %s, collapse at -%d%%',
            this.opts.windowHours, this.opts.milestones.join('/'), this.opts.collapsePct);
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        this.save();
    }

    get activeCount(): number {
        return this.posts.size;
    }

    /** Open calls, newest first, for the /calls admin command. */
    openCalls(): TrackedPost[] {
        return [...this.posts.values()].sort((a, b) => b.postedAt - a.postedAt);
    }

    /** One pass over every tracked call. Never throws. */
    async sweep(now = Date.now()): Promise<void> {
        // A slow sweep must not overlap the next tick and double-post.
        if (this.sweeping) return;
        this.sweeping = true;
        try {
            const windowMs = this.opts.windowHours * 3_600_000;
            const lookup = this.opts.fetchMcap ?? (async (mint: string) => {
                const info = await fetchTokenInfo(mint);
                return info?.usdMarketCap ?? null;
            });

            for (const post of [...this.posts.values()]) {
                if (post.closed || now - post.postedAt > windowMs) {
                    this.posts.delete(post.mint);
                    this.stats.expired++;
                    continue;
                }
                try {
                    const mcap = await lookup(post.mint);
                    if (mcap == null || mcap <= 0) continue;
                    if (mcap > post.peakMcapUsd) post.peakMcapUsd = mcap;

                    const multiple = mcap / post.baselineMcapUsd;
                    const milestone = nextMilestone(post, multiple, this.opts.milestones);
                    if (milestone != null) {
                        await this.opts.postUpdate(formatMilestoneUpdate(post, milestone, mcap, now), post.messageId);
                        // Mark every lower crossed milestone too. Otherwise a
                        // 5x alert is followed by a nonsensical 2x alert on the
                        // next sweep while the token remains above both.
                        for (const crossed of this.opts.milestones) {
                            if (crossed <= milestone && !post.announced.includes(crossed)) {
                                post.announced.push(crossed);
                            }
                        }
                        this.stats.milestonesPosted++;
                        continue;
                    }

                    const dropPct = ((post.baselineMcapUsd - mcap) / post.baselineMcapUsd) * 100;
                    if (dropPct >= this.opts.collapsePct) {
                        await this.opts.postUpdate(formatCollapseUpdate(post, mcap, now), post.messageId);
                        post.closed = true;
                        this.stats.collapsesPosted++;
                        continue;
                    }

                    await this.checkDevPosition(post, now);
                } catch (err) {
                    log.debug('Performance check failed for %s: %s', post.mint.slice(0, 8), err);
                }
            }
            this.scheduleSave();
        } finally {
            this.sweeping = false;
        }
    }

    /**
     * A creator selling down their own position right after an alert is the
     * single most actionable thing that can happen to a call, so it is
     * announced in the same thread. Fires once per call.
     */
    private async checkDevPosition(post: TrackedPost, now: number): Promise<void> {
        if (post.devDumpAnnounced) return;
        if (!post.devWallet || post.baselineDevPct == null) return;
        if (post.baselineDevPct < this.opts.minDevPct) return;

        const lookup = this.opts.fetchDevPct ?? (async (wallet: string, mint: string) => {
            const info = await fetchDevWalletInfo(wallet, mint, this.opts.rpcUrl);
            return info?.tokenSupplyPct ?? null;
        });

        const current = await lookup(post.devWallet, post.mint);
        if (current == null) return;

        const soldPct = ((post.baselineDevPct - current) / post.baselineDevPct) * 100;
        if (soldPct >= this.opts.devDumpPct) {
            await this.opts.postUpdate(formatDevDumpUpdate(post, current, now), post.messageId);
            post.devDumpAnnounced = true;
            this.stats.devDumpsPosted++;
        }
    }

    // ── Persistence ──────────────────────────────────────────────────────

    private scheduleSave(): void {
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = undefined;
            this.save();
        }, SAVE_DEBOUNCE_MS);
        this.saveTimer.unref?.();
    }

    private save(): void {
        try {
            const statePath = this.opts.statePath;
            if (!statePath) return;
            mkdirSync(dirname(statePath), { recursive: true });
            writeFileSync(statePath, JSON.stringify([...this.posts.values()]), 'utf8');
        } catch (err) {
            log.warn('Performance tracker save failed: %s', err);
        }
    }

    private load(): void {
        try {
            const statePath = this.opts.statePath;
            if (!statePath || !existsSync(statePath)) return;
            const raw = JSON.parse(readFileSync(statePath, 'utf8')) as TrackedPost[];
            for (const p of raw) {
                if (p?.mint && p.messageId) this.posts.set(p.mint, p);
            }
            if (this.posts.size > 0) log.info('Performance tracker: resumed %d open call(s)', this.posts.size);
        } catch (err) {
            log.warn('Performance tracker load failed: %s', err);
        }
    }
}
