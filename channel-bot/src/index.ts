/**
 * PumpFun Channel Bot — Entry Point
 *
 * A read-only Telegram channel feed for PumpFun activity.
 * Broadcasts fee claims, token launches, graduations, whale trades,
 * and fee distributions to a channel. No interactive commands — just a feed.
 *
 * Run:
 *   npm run dev          (hot reload)
 *   npm run build && npm start  (production)
 */

import { Bot } from 'grammy';

import { loadConfig } from './config.js';
import { ClaimMonitor } from './claim-monitor.js';
import { EventMonitor } from './event-monitor.js';
import { isFirstClaimByGithubUser, isFirstClaimByWallet, recordClaim, loadPersistedClaims } from './claim-tracker.js';
import { fetchTokenInfo, fetchCreatorProfile, fetchSolUsdPrice } from './pump-client.js';
import { fetchGitHubUserById } from './github-client.js';
import {
    formatClaimFeed,
    formatLaunchFeed,
    formatGraduationFeed,
    formatWhaleFeed,
    formatFeeDistributionFeed,
} from './formatters.js';
import type { ClaimFeedContext } from './formatters.js';
import { log, setLogLevel } from './logger.js';
import { startHealthServer, stopHealthServer } from './health.js';
import { maskUrl } from './rpc-fallback.js';
import type {
    FeeClaimEvent,
    GraduationEvent,
    TokenLaunchEvent,
    TradeAlertEvent,
    FeeDistributionEvent,
} from './types.js';

async function main(): Promise<void> {
    const config = loadConfig();
    setLogLevel(config.logLevel);

    // Load persisted first-claim set to survive restarts
    loadPersistedClaims();

    log.info('PumpFun Channel Bot starting...');
    log.info('  Channel: %s', config.channelId);
    log.info('  RPC: %s', maskUrl(config.solanaRpcUrl));
    log.info('  Feed: claims=%s launches=%s graduations=%s whales=%s fees=%s',
        config.feed.claims, config.feed.launches, config.feed.graduations,
        config.feed.whales, config.feed.feeDistributions,
    );
    log.info('  Require GitHub: %s', config.requireGithub);

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
    const pipeline = { total: 0, socialClaims: 0, firstClaim: 0, posted: 0 };
    setInterval(() => {
        log.info('Pipeline: %d total → %d social → %d first → %d posted',
            pipeline.total, pipeline.socialClaims, pipeline.firstClaim, pipeline.posted);
    }, 60_000);

    // ── Claim Monitor ────────────────────────────────────────────────
    const claimMonitor = new ClaimMonitor(config, async (event: FeeClaimEvent) => {
      try {
        if (!config.feed.claims) return;
        pipeline.total++;

        // ── Path A: GitHub social fee PDA claim ──────────────────────
        if (event.claimType === 'claim_social_fee_pda' && event.socialPlatform === 2 && event.githubUserId) {
            pipeline.socialClaims++;

            if (!isFirstClaimByGithubUser(event.githubUserId)) return;
            pipeline.firstClaim++;

            const githubUser = await fetchGitHubUserById(event.githubUserId);
            const solUsdPrice = await fetchSolUsdPrice();

            log.info('📤 GitHub social fee claim by %s (%s) — %.4f SOL',
                event.githubUserId, githubUser?.login ?? '?', event.amountSol);

            const ctx: ClaimFeedContext = {
                event,
                token: null,
                creator: null,
                claimRecord: {
                    claimCount: 1,
                    totalClaimedSol: event.amountSol,
                    firstClaimTimestamp: event.timestamp,
                    lastClaimTimestamp: event.timestamp,
                    claimPriceSol: 0,
                    claimPriceUsd: 0,
                    claimMcapUsd: 0,
                    claimCurveProgress: 0,
                },
                holders: null,
                trades: null,
                solUsdPrice,
                githubRepo: null,
                githubUser,
                aiSummary: '',
            };

            const { imageUrl, caption } = formatClaimFeed(ctx);
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

        // All other claim types: ignore
      } catch (err) {
        log.error('Claim handler error: %s', err);
      }
    });

    // ── Event Monitor (launches, graduations, whales, fee distributions) ───
    const hasEvents = config.feed.launches || config.feed.graduations || config.feed.whales || config.feed.feeDistributions;
    let eventMonitor: EventMonitor | null = null;

    if (hasEvents) {
        eventMonitor = new EventMonitor(
            config,
            // Token launch
            async (event: TokenLaunchEvent) => {
              try {
                if (!config.feed.launches) return;
                const creator = await fetchCreatorProfile(event.creatorWallet);
                const message = formatLaunchFeed(event, creator);
                await postToChannel(message);
              } catch (err) {
                log.error('Launch handler error: %s', err);
              }
            },
            // Graduation
            async (event: GraduationEvent) => {
              try {
                if (!config.feed.graduations) return;
                const token = await fetchTokenInfo(event.mintAddress);
                const message = formatGraduationFeed(event, token);
                await postToChannel(message);
              } catch (err) {
                log.error('Graduation handler error: %s', err);
              }
            },
            // Whale trade
            async (event: TradeAlertEvent) => {
              try {
                if (!config.feed.whales) return;
                const token = await fetchTokenInfo(event.mintAddress);
                const message = formatWhaleFeed(event, token);
                await postToChannel(message);
              } catch (err) {
                log.error('Whale handler error: %s', err);
              }
            },
            // Fee distribution
            async (event: FeeDistributionEvent) => {
              try {
                if (!config.feed.feeDistributions) return;
                const token = await fetchTokenInfo(event.mintAddress);
                const message = formatFeeDistributionFeed(event, token);
                await postToChannel(message);
              } catch (err) {
                log.error('Fee distribution handler error: %s', err);
              }
            },
        );
    }

    // ── Start everything ─────────────────────────────────────────────
    await claimMonitor.start();

    if (eventMonitor) {
        await eventMonitor.start();
        log.info('Event monitor started (graduations/whales/fees)');
    }

    // Start bot (needed for the API, but no commands registered)
    await bot.init();
    log.info('Bot initialized: @%s', bot.botInfo.username);
    log.info('Channel feed is live! Events will be posted to %s', config.channelId);

    // ── Health check server ──────────────────────────────────────────
    const startedAt = Date.now();
    let messagesPosted = 0;
    const originalPost = postToChannel;
    const postToChannelTracked = async (message: string): Promise<void> => {
        await originalPost(message);
        messagesPosted++;
    };

    startHealthServer({
        startedAt,
        getStats: () => ({
            feeds: config.feed,
            channel: config.channelId,
            requireGithub: config.requireGithub,
            messagesPosted,
            claimMonitor: claimMonitor.getMetrics(),
        }),
    });

    // ── Graceful shutdown ────────────────────────────────────────────
    const shutdown = () => {
        log.info('Shutting down...');
        claimMonitor.stop();
        if (eventMonitor) eventMonitor.stop();
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

