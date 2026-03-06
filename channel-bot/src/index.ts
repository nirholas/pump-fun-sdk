/**
 * PumpFun Channel Bot — Entry Point
 *
 * A read-only Telegram channel feed that broadcasts:
 *   - GitHub social fee PDA first-claims
 *   - Creator fee claims (>= 1 SOL, first per wallet)
 *   - Token graduations (bonding curve complete / AMM migration)
 *
 * Run:
 *   npm run dev          (hot reload)
 *   npm run build && npm start  (production)
 */

import { Bot } from 'grammy';

import { loadConfig } from './config.js';
import { ClaimMonitor } from './claim-monitor.js';
import { EventMonitor } from './event-monitor.js';
import { isFirstClaimByGithubUser, isFirstClaimByWallet, loadPersistedClaims } from './claim-tracker.js';
import { fetchCreatorProfile, fetchTokenInfo, fetchTokenHolders, fetchTokenTrades, fetchSolUsdPrice } from './pump-client.js';
import { fetchGitHubUserById } from './github-client.js';
import { fetchXProfile } from './x-client.js';
import { formatGitHubClaimFeed, formatCreatorClaimFeed, formatGraduationFeed } from './formatters.js';
import type { ClaimFeedContext, CreatorClaimContext } from './formatters.js';
import { log, setLogLevel } from './logger.js';
import { startHealthServer, stopHealthServer } from './health.js';
import { maskUrl } from './rpc-fallback.js';
import type { FeeClaimEvent, GraduationEvent } from './types.js';

async function main(): Promise<void> {
    const config = loadConfig();
    setLogLevel(config.logLevel);

    // Load persisted first-claim set to survive restarts
    loadPersistedClaims();

    log.info('PumpFun Channel Bot starting...');
    log.info('  Channel: %s', config.channelId);
    log.info('  RPC: %s', maskUrl(config.solanaRpcUrl));
    const feeds: string[] = ['claims'];
    if (config.feed.graduations) feeds.push('graduations');
    log.info('  Feeds: %s', feeds.join(', '));

    const bot = new Bot(config.telegramToken);

    bot.catch((err) => {
        log.error('Bot error:', err.error);
    });

    /** Retry helper for transient Telegram errors (429, 5xx). */
    async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err: unknown) {
                const msg = String(err);
                const is429 = msg.includes('429') || msg.includes('Too Many Requests');
                const is5xx = msg.includes('500') || msg.includes('502') || msg.includes('503');
                if ((is429 || is5xx) && attempt < maxRetries) {
                    // Respect Telegram retry_after if present
                    let delay = (attempt + 1) * 2000;
                    const retryMatch = msg.match(/retry after (\d+)/i);
                    if (retryMatch) delay = (Number(retryMatch[1]) + 1) * 1000;
                    log.warn('Telegram %s — retry %d/%d in %dms', is429 ? '429' : '5xx', attempt + 1, maxRetries, delay);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw err;
            }
        }
        throw new Error('Unreachable');
    }

    /** Send a message to the channel. */
    async function postToChannel(message: string): Promise<void> {
        try {
            await withRetry(() => bot.api.sendMessage(config.channelId, message, {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
            }));
        } catch (err) {
            log.error('Failed to post to channel %s:', config.channelId, err);
        }
    }

    /** Send a photo with caption to the channel. Falls back to text if photo fails. */
    async function postPhotoToChannel(imageUrl: string, caption: string): Promise<void> {
        try {
            await withRetry(() => bot.api.sendPhoto(config.channelId, imageUrl, {
                caption,
                parse_mode: 'HTML',
            }));
        } catch (err) {
            log.warn('Photo send failed, falling back to text: %s', err);
            await postToChannel(caption);
        }
    }

    // ── Pipeline Counters ─────────────────────────────────────────────
    const pipeline = { total: 0, creatorClaims: 0, socialClaims: 0, firstClaim: 0, posted: 0, skippedCashback: 0, skippedDust: 0 };
    setInterval(() => {
        log.info('Pipeline: %d total → %d creator/%d social → %d first → %d posted (skip: %d cashback, %d dust)',
            pipeline.total, pipeline.creatorClaims, pipeline.socialClaims,
            pipeline.firstClaim, pipeline.posted, pipeline.skippedCashback, pipeline.skippedDust);
    }, 60_000);

    /** Minimum SOL for creator fee claims to be posted. */
    const MIN_CREATOR_CLAIM_SOL = 1.0;

    /** Creator claim types we post about. */
    const CREATOR_CLAIM_TYPES: ReadonlySet<string> = new Set([
        'collect_creator_fee',
        'collect_coin_creator_fee',
        'distribute_creator_fees',
        'transfer_creator_fees_to_pump',
    ]);

    // ── Claim Monitor ────────────────────────────────────────────────
    const claimMonitor = new ClaimMonitor(config, async (event: FeeClaimEvent) => {
      try {
        pipeline.total++;

        // Skip cashback claims (user refunds, not creator activity)
        if (event.isCashback) {
            pipeline.skippedCashback++;
            return;
        }

        // ── Path A: GitHub social fee PDA claim ──────────────────────
        if (event.claimType === 'claim_social_fee_pda' && event.socialPlatform === 2 && event.githubUserId) {
            pipeline.socialClaims++;

            if (!isFirstClaimByGithubUser(event.githubUserId)) return;
            pipeline.firstClaim++;

            const githubUser = await fetchGitHubUserById(event.githubUserId);
            const xProfile = githubUser?.twitterUsername
                ? await fetchXProfile(githubUser.twitterUsername)
                : null;
            const solUsdPrice = await fetchSolUsdPrice();

            log.info('📤 GitHub social fee claim by %s (%s) — %.4f SOL',
                event.githubUserId, githubUser?.login ?? '?', event.amountSol);

            const ctx: ClaimFeedContext = {
                event,
                solUsdPrice,
                githubUser,
                xProfile,
            };

            const { imageUrl, caption } = formatGitHubClaimFeed(ctx);
            if (imageUrl) {
                await postPhotoToChannel(imageUrl, caption);
            } else {
                await postToChannel(caption);
            }
            pipeline.posted++;
            log.info('✅ Posted GitHub claim by %s (%s) to %s',
                event.githubUserId, githubUser?.login ?? '?', config.channelId);
            return;
        }

        // ── Path B: Creator fee claims (first per wallet, >= 1 SOL) ──
        if (!CREATOR_CLAIM_TYPES.has(event.claimType)) return;
        pipeline.creatorClaims++;

        if (event.amountSol < MIN_CREATOR_CLAIM_SOL) {
            pipeline.skippedDust++;
            return;
        }

        if (!isFirstClaimByWallet(event.claimerWallet)) return;
        pipeline.firstClaim++;

        log.info('📤 First creator claim by %s — %.4f SOL (%s)',
            event.claimerWallet.slice(0, 8), event.amountSol, event.claimType);

        const [creator, solUsdPrice] = await Promise.all([
            fetchCreatorProfile(event.claimerWallet),
            fetchSolUsdPrice(),
        ]);

        const creatorCtx: CreatorClaimContext = {
            event,
            solUsdPrice,
            creator,
        };

        const { imageUrl: cImg, caption: cCaption } = formatCreatorClaimFeed(creatorCtx);
        if (cImg) {
            await postPhotoToChannel(cImg, cCaption);
        } else {
            await postToChannel(cCaption);
        }
        pipeline.posted++;
        log.info('✅ Posted creator claim by %s to %s', event.claimerWallet.slice(0, 8), config.channelId);
      } catch (err) {
        log.error('Claim handler error: %s', err);
      }
    });

    // ── Graduation Monitor ─────────────────────────────────────────────
    let eventMonitor: EventMonitor | null = null;
    if (config.feed.graduations) {
        eventMonitor = new EventMonitor(
            config,
            () => {}, // launches — not used
            async (event: GraduationEvent) => {
                try {
                    log.info('🎓 Graduation detected: %s (migration=%s)', event.mintAddress, event.isMigration);

                    const [token, solUsdPrice] = await Promise.all([
                        fetchTokenInfo(event.mintAddress),
                        fetchSolUsdPrice(),
                    ]);

                    const [creator, holders, trades] = await Promise.all([
                        token?.creator ? fetchCreatorProfile(token.creator) : Promise.resolve(null),
                        fetchTokenHolders(event.mintAddress),
                        fetchTokenTrades(event.mintAddress),
                    ]);

                    const { imageUrl, caption } = formatGraduationFeed(
                        event, token, creator, solUsdPrice,
                        { holders, trades },
                    );

                    if (imageUrl) {
                        await postPhotoToChannel(imageUrl, caption);
                    } else {
                        await postToChannel(caption);
                    }
                    pipeline.posted++;
                    log.info('✅ Posted graduation for %s to %s', event.mintAddress.slice(0, 8), config.channelId);
                } catch (err) {
                    log.error('Graduation handler error: %s', err);
                }
            },
            () => {}, // whales — not used
            () => {}, // fee distributions — not used
        );
    }

    // ── Start ─────────────────────────────────────────────────────────
    await claimMonitor.start();
    if (eventMonitor) {
        await eventMonitor.start();
        log.info('Graduation monitor started');
    }

    // Start bot (needed for the API, but no commands registered)
    await bot.init();
    log.info('Bot initialized: @%s', bot.botInfo.username);
    log.info('Channel feed is live → %s', config.channelId);

    // ── Health check server ──────────────────────────────────────────
    const startedAt = Date.now();

    startHealthServer({
        startedAt,
        getStats: () => ({
            channel: config.channelId,
            messagesPosted: pipeline.posted,
            claimMonitor: claimMonitor.getMetrics(),
        }),
    });

    // ── Graceful shutdown ────────────────────────────────────────────
    const shutdown = () => {
        log.info('Shutting down...');
        claimMonitor.stop();
        eventMonitor?.stop();
        stopHealthServer();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});

