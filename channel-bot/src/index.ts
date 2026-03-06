/**
 * PumpFun Channel Bot — Entry Point
 *
 * A read-only Telegram channel feed that broadcasts ONLY GitHub social fee
 * PDA first-claims. No launches, graduations, whales, or other fee events.
 *
 * Run:
 *   npm run dev          (hot reload)
 *   npm run build && npm start  (production)
 */

import { Bot } from 'grammy';

import { loadConfig } from './config.js';
import { ClaimMonitor } from './claim-monitor.js';
import { isFirstClaimByGithubUser, isFirstClaimByWallet, loadPersistedClaims } from './claim-tracker.js';
import { fetchCreatorProfile, fetchSolUsdPrice } from './pump-client.js';
import { fetchGitHubUserById } from './github-client.js';
import { fetchXProfile } from './x-client.js';
import { formatGitHubClaimFeed, formatCreatorClaimFeed } from './formatters.js';
import type { ClaimFeedContext, CreatorClaimContext } from './formatters.js';
import { log, setLogLevel } from './logger.js';
import { startHealthServer, stopHealthServer } from './health.js';
import { maskUrl } from './rpc-fallback.js';
import type { FeeClaimEvent } from './types.js';

async function main(): Promise<void> {
    const config = loadConfig();
    setLogLevel(config.logLevel);

    // Load persisted first-claim set to survive restarts
    loadPersistedClaims();

    log.info('PumpFun Channel Bot starting...');
    log.info('  Channel: %s', config.channelId);
    log.info('  RPC: %s', maskUrl(config.solanaRpcUrl));
    log.info('  Feed: GitHub social fee claims only');

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
    const pipeline = { total: 0, firstClaim: 0, posted: 0 };
    setInterval(() => {
        log.info('Pipeline: %d total → %d first → %d posted',
            pipeline.total, pipeline.firstClaim, pipeline.posted);
    }, 60_000);

    // ── Claim Monitor (GitHub social fee PDA first-claims ONLY) ──────
    const claimMonitor = new ClaimMonitor(config, async (event: FeeClaimEvent) => {
      try {
        pipeline.total++;

        // Only GitHub social fee PDA claims (platform 2 = GitHub)
        if (event.claimType !== 'claim_social_fee_pda') return;
        if (event.socialPlatform !== 2) return;
        if (!event.githubUserId) return;

        // Only first-ever claim per GitHub user
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
      } catch (err) {
        log.error('Claim handler error: %s', err);
      }
    });

    // ── Start ─────────────────────────────────────────────────────────
    await claimMonitor.start();

    // Start bot (needed for the API, but no commands registered)
    await bot.init();
    log.info('Bot initialized: @%s', bot.botInfo.username);
    log.info('Channel feed is live — GitHub claims only → %s', config.channelId);

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
            channel: config.channelId,
            messagesPosted,
            claimMonitor: claimMonitor.getMetrics(),
        }),
    });

    // ── Graceful shutdown ────────────────────────────────────────────
    const shutdown = () => {
        log.info('Shutting down...');
        claimMonitor.stop();
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

