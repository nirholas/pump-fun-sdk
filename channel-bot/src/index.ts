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
import { recordClaim, isFirstClaimOnToken, loadPersistedClaims } from './claim-tracker.js';
import type { ClaimPriceSnapshot } from './claim-tracker.js';
import { fetchTokenInfo, fetchCreatorProfile, fetchTokenHolders, fetchTokenTrades, fetchSolUsdPrice } from './pump-client.js';
import { fetchRepoFromUrls, fetchGitHubUserFromUrls } from './github-client.js';
import { generateClaimSummary } from './groq-client.js';
import type { ClaimSummaryInput } from './groq-client.js';
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
    log.info('  RPC: %s', config.solanaRpcUrl);
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

    // ── Claim Monitor ────────────────────────────────────────────────
    const claimMonitor = new ClaimMonitor(config, async (event: FeeClaimEvent) => {
        if (!config.feed.claims) return;

        // Skip wallet-level claims with no token mint (cashback, collect_creator_fee)
        const mint = event.tokenMint;
        if (!mint) return;

        // Only post the first-ever claim on each token
        if (!isFirstClaimOnToken(mint)) return;

        // Fetch token info first — needed for the GitHub gate
        const token = await fetchTokenInfo(event.tokenMint);

        // GitHub gate: skip tokens with no GitHub URLs in description
        if (config.requireGithub) {
            if (!token?.githubUrls?.length) {
                log.debug('Skipping claim for %s — no GitHub URLs (requireGithub=true)', mint.slice(0, 8));
                return;
            }
        }

        // Enrich with remaining data in parallel
        const [creator, holders, trades, solUsdPrice] = await Promise.all([
            event.claimerWallet ? fetchCreatorProfile(event.claimerWallet) : Promise.resolve(null),
            fetchTokenHolders(event.tokenMint),
            fetchTokenTrades(event.tokenMint),
            fetchSolUsdPrice(),
        ]);

        // Also fetch creator profile for the token creator if different from claimer
        let creatorProfile = creator;
        if (token?.creator && token.creator !== event.claimerWallet) {
            creatorProfile = await fetchCreatorProfile(token.creator);
        }

        // Fetch GitHub repo info + user profile if token has GitHub URLs
        const [githubRepo, githubUser] = token?.githubUrls?.length
            ? await Promise.all([
                fetchRepoFromUrls(token.githubUrls),
                fetchGitHubUserFromUrls(token.githubUrls),
            ])
            : [null, null];

        // Record claim history with price snapshot for tracking
        const priceSnapshot: ClaimPriceSnapshot = {
            priceSol: token?.priceSol ?? 0,
            priceUsd: (token?.priceSol ?? 0) * solUsdPrice,
            mcapUsd: token?.usdMarketCap ?? 0,
            curveProgress: token?.curveProgress ?? 0,
        };
        const record = recordClaim(
            event.claimerWallet,
            mint,
            event.amountSol,
            event.timestamp,
            priceSnapshot,
        );

        // Generate AI summary
        const launchToClaimSeconds = (token?.createdTimestamp && event.timestamp)
            ? event.timestamp - token.createdTimestamp
            : -1;
        const graduated = creatorProfile?.recentCoins.filter((c) => c.complete).length ?? 0;

        const summaryInput: ClaimSummaryInput = {
            tokenName: token?.name ?? event.tokenName ?? 'Unknown',
            tokenSymbol: token?.symbol ?? event.tokenSymbol ?? '???',
            tokenDescription: token?.description ?? '',
            mcapUsd: token?.usdMarketCap ?? 0,
            graduated: token?.complete ?? false,
            curveProgress: token?.curveProgress ?? 0,
            claimAmountSol: event.amountSol,
            claimAmountUsd: solUsdPrice > 0 ? event.amountSol * solUsdPrice : 0,
            launchToClaimSeconds,
            isSelfClaim: token?.creator === event.claimerWallet,
            creatorLaunches: creatorProfile?.totalLaunches ?? 0,
            creatorGraduated: graduated,
            creatorFollowers: creatorProfile?.followers ?? 0,
            holderCount: holders?.totalHolders ?? 0,
            recentTradeCount: trades?.recentTradeCount ?? 0,
            githubRepoName: githubRepo?.fullName ?? null,
            githubStars: githubRepo?.stars ?? null,
            githubLanguage: githubRepo?.language ?? null,
            githubLastPush: githubRepo?.lastPushAgo ?? null,
            githubDescription: githubRepo?.description ?? null,
            githubIsFork: githubRepo?.isFork ?? null,
            githubUserLogin: githubUser?.login ?? null,
            githubUserFollowers: githubUser?.followers ?? null,
            githubUserRepos: githubUser?.publicRepos ?? null,
            githubUserCreatedAt: githubUser?.createdAt ?? null,
        };

        const aiSummary = await generateClaimSummary(summaryInput);

        const ctx: ClaimFeedContext = {
            event,
            token,
            creator: creatorProfile,
            claimRecord: record,
            holders,
            trades,
            solUsdPrice,
            githubRepo,
            githubUser,
            aiSummary,
        };

        const { imageUrl, caption } = formatClaimFeed(ctx);

        if (imageUrl) {
            await postPhotoToChannel(imageUrl, caption);
        } else {
            await postToChannel(caption);
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
                if (!config.feed.launches) return;
                const creator = await fetchCreatorProfile(event.creatorWallet);
                const message = formatLaunchFeed(event, creator);
                await postToChannel(message);
            },
            // Graduation
            async (event: GraduationEvent) => {
                if (!config.feed.graduations) return;
                const token = await fetchTokenInfo(event.mintAddress);
                const message = formatGraduationFeed(event, token);
                await postToChannel(message);
            },
            // Whale trade
            async (event: TradeAlertEvent) => {
                if (!config.feed.whales) return;
                const token = await fetchTokenInfo(event.mintAddress);
                const message = formatWhaleFeed(event, token);
                await postToChannel(message);
            },
            // Fee distribution
            async (event: FeeDistributionEvent) => {
                if (!config.feed.feeDistributions) return;
                const token = await fetchTokenInfo(event.mintAddress);
                const message = formatFeeDistributionFeed(event, token);
                await postToChannel(message);
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

