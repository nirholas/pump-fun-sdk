/**
 * PumpFun Channel Bot — Entry Point
 *
 * A read-only Telegram channel feed that broadcasts:
 *   - GitHub social fee PDA first-claims  (FEED_CLAIMS=true)
 *   - Token graduations                    (FEED_GRADUATIONS=true)
 *
 * Run:
 *   npm run dev          (hot reload)
 *   npm run build && npm start  (production)
 */

import { Bot, type BotError } from 'grammy';

import { loadConfig } from './config.js';
import { ClaimMonitor } from './claim-monitor.js';
import { EventMonitor } from './event-monitor.js';
import { hasGithubUserClaimed, markGithubUserClaimed, incrementGithubClaimCount, loadPersistedClaims } from './claim-tracker.js';
import { fetchTokenInfo, fetchTopHolders, fetchTokenTrades, fetchDevWalletInfo, fetchSolUsdPrice, fetchPoolLiquidity, fetchBundleInfo, fetchCreatorProfile } from './pump-client.js';
import { fetchGitHubUserById, fetchRepoFromUrls } from './github-client.js';
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
    if (config.feed.claims) loadPersistedClaims();

    log.info('PumpFun Channel Bot starting...');
    log.info('  Channel: %s', config.channelId);
    log.info('  RPC: %s', maskUrl(config.solanaRpcUrl));
    const feeds: string[] = [];
    if (config.feed.claims) feeds.push('claims');
    if (config.feed.graduations) feeds.push('graduations');
    log.info('  Feeds: %s', feeds.join(', ') || 'none');

    const bot = new Bot(config.telegramToken);

    bot.catch((err: BotError) => {
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

    /** Send a message to the channel. Throws on failure. */
    async function postToChannel(message: string): Promise<void> {
        try {
            await withRetry(() => bot.api.sendMessage(config.channelId, message, {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
            }));
        } catch (err) {
            log.error('Failed to post to channel %s: %s', config.channelId, err);
            throw err;
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
    const pipeline = { total: 0, socialClaims: 0, creatorClaims: 0, firstClaim: 0, posted: 0, skippedCashback: 0, repeatClaim: 0 };
    setInterval(() => {
        log.info('Pipeline: %d total → %d social + %d creator → %d first / %d repeat → %d posted (skip: %d cashback)',
            pipeline.total, pipeline.socialClaims, pipeline.creatorClaims, pipeline.firstClaim, pipeline.repeatClaim, pipeline.posted, pipeline.skippedCashback);
    }, 60_000);

    // ── Claim Monitor ────────────────────────────────────────────────
    let claimMonitor: ClaimMonitor | null = null;
    if (config.feed.claims) {
      claimMonitor = new ClaimMonitor(config, async (event: FeeClaimEvent) => {
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

            const isFirstClaim = !hasGithubUserClaimed(event.githubUserId);
            if (isFirstClaim) pipeline.firstClaim++;
            else pipeline.repeatClaim++;

            const mint = event.tokenMint?.trim() || '';
            const [githubUser, tokenInfo, solUsdPrice] = await Promise.all([
                fetchGitHubUserById(event.githubUserId),
                mint ? fetchTokenInfo(mint) : Promise.resolve(null),
                fetchSolUsdPrice(),
            ]);
            const [xProfile, repoInfo] = await Promise.all([
                githubUser?.twitterUsername
                    ? fetchXProfile(githubUser.twitterUsername)
                    : Promise.resolve(null),
                tokenInfo?.githubUrls?.length
                    ? fetchRepoFromUrls(tokenInfo.githubUrls)
                    : Promise.resolve(null),
            ]);

            const isFake = event.isFake === true;
            const claimNumber = isFake ? 0 : incrementGithubClaimCount(event.githubUserId);
            const emoji = isFake ? '⚠️' : isFirstClaim ? '🚨' : '📤';
            log.info('%s %sGitHub social fee claim by %s (%s) — %s SOL',
                emoji, isFake ? 'FAKE ' : '',
                event.githubUserId, githubUser?.login ?? '?', event.amountSol.toFixed(4));

            const ctx: ClaimFeedContext = {
                event,
                solUsdPrice,
                githubUser,
                xProfile,
                tokenInfo,
                isFirstClaim: isFake ? false : isFirstClaim,
                isFake,
                claimNumber,
                lifetimeClaimedSol: event.lifetimeClaimedLamports != null
                    ? event.lifetimeClaimedLamports / 1e9
                    : undefined,
                repoInfo,
            };

            const { imageUrl, caption } = formatGitHubClaimFeed(ctx);
            try {
                if (imageUrl) {
                    await postPhotoToChannel(imageUrl, caption);
                } else {
                    await postToChannel(caption);
                }
                if (!isFake && isFirstClaim) markGithubUserClaimed(event.githubUserId);
                pipeline.posted++;
                log.info('✅ Posted GitHub claim by %s (%s) to %s',
                    event.githubUserId, githubUser?.login ?? '?', config.channelId);
            } catch (postErr) {
                log.error('Failed to post claim by %s — will retry on next claim event: %s',
                    event.githubUserId, postErr);
            }
        }

        // ── Path B: Creator fee claims (collect_creator_fee, collect_coin_creator_fee, distribute_creator_fees) ──
        else if (event.claimType === 'collect_creator_fee' ||
                 event.claimType === 'collect_coin_creator_fee' ||
                 (event.claimType === 'distribute_creator_fees' && config.feed.feeDistributions)) {
            pipeline.creatorClaims++;

            const mint = event.tokenMint?.trim() || '';
            const [tokenInfo, solUsdPrice, creator] = await Promise.all([
                mint ? fetchTokenInfo(mint) : Promise.resolve(null),
                fetchSolUsdPrice(),
                fetchCreatorProfile(event.claimerWallet),
            ]);

            log.info('💰 Creator fee claim by %s — %s SOL (%s)',
                event.claimerWallet.slice(0, 8), event.amountSol.toFixed(4), event.claimLabel);

            const ctx: CreatorClaimContext = {
                event,
                solUsdPrice,
                creator,
            };

            const { imageUrl, caption } = formatCreatorClaimFeed(ctx);
            try {
                if (imageUrl) {
                    await postPhotoToChannel(imageUrl, caption);
                } else {
                    await postToChannel(caption);
                }
                pipeline.posted++;
                log.info('✅ Posted creator claim by %s to %s', event.claimerWallet.slice(0, 8), config.channelId);
            } catch (postErr) {
                log.error('Failed to post creator claim by %s: %s', event.claimerWallet.slice(0, 8), postErr);
            }
        }
      } catch (err) {
        log.error('Claim handler error: %s', err);
      }
    });
    }

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

                    const [creator, holders, trades, devWallet, liquidity, bundle] = await Promise.all([
                        token?.creator ? fetchCreatorProfile(token.creator) : Promise.resolve(null),
                        fetchTopHolders(event.mintAddress),
                        fetchTokenTrades(event.mintAddress),
                        token?.creator ? fetchDevWalletInfo(token.creator, event.mintAddress, config.solanaRpcUrl) : Promise.resolve(null),
                        fetchPoolLiquidity(event.mintAddress, token?.usdMarketCap ?? 0),
                        fetchBundleInfo(event.mintAddress),
                    ]);

                    // Fetch X profile if token has a Twitter link
                    let xProfile = null;
                    if (token?.twitter) {
                        const handle = token.twitter.replace(/.*twitter\.com\/|.*x\.com\//, '').replace(/\/+$/, '');
                        if (handle) xProfile = await fetchXProfile(handle);
                    }

                    const { imageUrl, caption } = formatGraduationFeed(
                        event, token, creator, solUsdPrice,
                        { holders, trades, devWallet, xProfile, liquidity, bundle },
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
    if (config.feed.claims) {
        await claimMonitor!.start();
        log.info('Claim monitor started');
    }
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
            ...(claimMonitor ? { claimMonitor: claimMonitor.getMetrics() } : {}),
        }),
    });

    // ── Graceful shutdown ────────────────────────────────────────────
    const shutdown = () => {
        log.info('Shutting down...');
        claimMonitor?.stop();
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

