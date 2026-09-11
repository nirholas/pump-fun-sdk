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
import { hasGithubUserClaimed, markGithubUserClaimed, incrementGithubClaimCount, getGithubUserClaimedMints, loadPersistedClaims } from './claim-tracker.js';
import { fetchTokenInfo, fetchTopHolders, fetchTokenTrades, fetchDevWalletInfo, fetchSolUsdPrice, fetchPoolLiquidity, fetchBundleInfo, fetchCreatorProfile, fetchSameNameTokens } from './pump-client.js';
import { fetchGitHubUserById, fetchRepoFromUrls } from './github-client.js';
import { fetchXProfile } from './x-client.js';
import { formatGitHubClaimFeed, formatCreatorClaimFeed, formatGraduationFeed, formatLaunchFeed, formatWhaleFeed, formatFeeDistributionFeed } from './formatters.js';
import type { ClaimFeedContext, CreatorClaimContext } from './formatters.js';
import { log, setLogLevel } from './logger.js';
import { startHealthServer, stopHealthServer } from './health.js';
import { maskUrl } from './rpc-fallback.js';
import { EventStore } from './event-store.js';
import { WebhookDispatcher } from './webhooks.js';
import { registerAdminCommands, isMuted, type RuntimeState } from './admin.js';
import { DeliveryReporter, verifyChannelAccess, DeliveryFailedError, isReportedDelivery } from './delivery.js';
import { Watchdog } from './watchdog.js';
import { assertPostAllowed, ChannelPolicyError, type PostKind } from './channel-policy.js';
import { PerformanceTracker } from './performance-tracker.js';
import { buildTokenKeyboard, buildTxKeyboard, type InlineKeyboard } from './keyboards.js';
import type { FeeClaimEvent, GraduationEvent, TokenLaunchEvent, TradeAlertEvent, FeeDistributionEvent } from './types.js';

interface PostOptions {
    /**
     * What this post is. Checked against the channel policy before anything
     * is sent, so no path can put content in a channel its profile forbids.
     */
    kind: PostKind;
    /** Message id this post should reply to (used by follow-up updates) */
    replyTo?: number;
    /** Inline keyboard rendered under the message */
    keyboard?: InlineKeyboard;
}

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

    // ── Runtime state: event store, webhooks, admin controls ──────────
    const store = new EventStore();
    const webhooks = new WebhookDispatcher({ urls: config.webhookUrls, secret: config.webhookSecret });
    const state: RuntimeState = {
        muteUntil: 0,
        get posted() { return pipeline.posted; },
        set posted(_v: number) { /* derived from the pipeline counter */ },
        getMode: () => 'starting',
        getDelivery: () => ({
            healthy: delivery.healthy,
            fault: delivery.lastFault,
            fix: delivery.lastFix,
            failures: delivery.failures,
        }),
    };

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

    const delivery = new DeliveryReporter(config.channelId);

    // Follow-up tracker: scores every posted call in its own thread.
    const performance = new PerformanceTracker({
        windowHours: config.performance.windowHours,
        milestones: config.performance.milestones,
        collapsePct: config.performance.collapsePct,
        rpcUrl: config.solanaRpcUrl,
        postUpdate: async (text, replyToMessageId) => {
            await postToChannel(text, { kind: 'follow_up', replyTo: replyToMessageId });
            pipeline.posted++;
        },
    });

    /**
     * The failsafe. Every send goes through here; a kind the profile forbids
     * is counted, logged once, and never reaches Telegram.
     */
    function guardPost(kind: PostKind): void {
        try {
            assertPostAllowed(config.profile, kind);
        } catch (err) {
            if (err instanceof ChannelPolicyError) pipeline.policyRejected++;
            throw err;
        }
    }

    /** Send a message to the channel. Returns the message id. Throws on failure. */
    async function postToChannel(message: string, opts: PostOptions): Promise<number> {
        guardPost(opts.kind);
        try {
            const sent = await withRetry(() => bot.api.sendMessage(config.channelId, message, {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
                ...(opts.replyTo ? { reply_parameters: { message_id: opts.replyTo, allow_sending_without_reply: true } } : {}),
                ...(opts.keyboard ? { reply_markup: opts.keyboard } : {}),
            }));
            delivery.recordSuccess();
            return sent.message_id;
        } catch (err) {
            // Already classified and logged here; the marker keeps callers
            // from logging the same failure again as a raw stack trace.
            throw new DeliveryFailedError(delivery.report(err), err);
        }
    }

    /** Send a photo with caption to the channel. Falls back to text if photo fails. */
    async function postPhotoToChannel(imageUrl: string, caption: string, opts: PostOptions): Promise<number> {
        guardPost(opts.kind);
        try {
            const sent = await withRetry(() => bot.api.sendPhoto(config.channelId, imageUrl, {
                caption,
                parse_mode: 'HTML',
                ...(opts.keyboard ? { reply_markup: opts.keyboard } : {}),
            }));
            delivery.recordSuccess();
            return sent.message_id;
        } catch (err) {
            // A photo can fail for reasons the text path survives (bad image
            // URL, size limits), so always try text before giving up.
            return await postToChannel(caption, opts);
        }
    }

    // ── Pipeline Counters ─────────────────────────────────────────────
    const pipeline = { total: 0, socialClaims: 0, creatorClaims: 0, firstClaim: 0, posted: 0, skippedCashback: 0, repeatClaim: 0, policyRejected: 0 };

    /** True when the operator paused channel posting via /mute. */
    const postingMuted = () => isMuted(state);
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

            let mint = event.tokenMint?.trim() || '';

            // When multiple tokens share the same social fee PDA,
            // fetch token info for ALL candidates and pick highest MC as primary.
            let allLinkedTokens: import('./pump-client.js').TokenInfo[] = [];
            if (event.allCandidateMints && event.allCandidateMints.length > 1) {
                log.info('PDA %s maps to %d tokens — fetching all',
                    event.socialFeePda?.slice(0, 8) ?? '?', event.allCandidateMints.length);
                const infos = (await Promise.all(
                    event.allCandidateMints.map((m) => fetchTokenInfo(m)),
                )).filter((i): i is import('./pump-client.js').TokenInfo => i != null);
                infos.sort((a, b) => b.usdMarketCap - a.usdMarketCap);
                allLinkedTokens = infos;
                const best = infos[0];
                if (best && best.usdMarketCap > 0) {
                    mint = best.mint;
                    event.tokenMint = mint;
                    log.info('Resolved PDA to highest-MC token: %s ($%s)',
                        mint.slice(0, 8), best.usdMarketCap.toFixed(0));
                }
            }

            // Use on-chain lifetime data as ground truth: if lifetime lamports
            // significantly exceed this claim, the user has claimed before —
            // regardless of what our local persistence says (it resets on redeploy).
            // Tracked per user+mint so claiming coin A doesn't affect coin B.
            let isFirstClaim = !hasGithubUserClaimed(event.githubUserId, mint);
            if (isFirstClaim && event.lifetimeClaimedLamports != null && event.lifetimeClaimedLamports > event.amountLamports * 1.01) {
                // On-chain lifetime is larger than this single claim → not actually first
                isFirstClaim = false;
                // Backfill our local tracker so future claims aren't misclassified
                markGithubUserClaimed(event.githubUserId, mint);
            }
            const isFake = event.isFake === true;
            if (isFirstClaim) pipeline.firstClaim++;
            else pipeline.repeatClaim++;

            // Only post FIRST claims — skip fake and repeat claims entirely
            if (isFake || !isFirstClaim) {
                log.debug('Skipping %s claim by %s on %s',
                    isFake ? 'fake' : 'repeat', event.githubUserId, mint.slice(0, 8));
                return;
            }

            const [githubUser, tokenInfo, solUsdPrice] = await Promise.all([
                fetchGitHubUserById(event.githubUserId),
                mint ? fetchTokenInfo(mint) : Promise.resolve(null),
                fetchSolUsdPrice(),
            ]);
            // Second wave: depends on first-wave results
            const [xProfile, repoInfo, creatorProfile, holders, trades, liquidity, bundle, sameNameTokens] = await Promise.all([
                githubUser?.twitterUsername
                    ? fetchXProfile(githubUser.twitterUsername)
                    : Promise.resolve(null),
                tokenInfo?.githubUrls?.length
                    ? fetchRepoFromUrls(tokenInfo.githubUrls)
                    : Promise.resolve(null),
                tokenInfo?.creator
                    ? fetchCreatorProfile(tokenInfo.creator)
                    : Promise.resolve(null),
                mint ? fetchTopHolders(mint) : Promise.resolve(null),
                mint ? fetchTokenTrades(mint) : Promise.resolve(null),
                mint && tokenInfo ? fetchPoolLiquidity(mint, tokenInfo.usdMarketCap) : Promise.resolve(null),
                mint ? fetchBundleInfo(mint) : Promise.resolve(null),
                tokenInfo ? fetchSameNameTokens(tokenInfo.name, tokenInfo.symbol, mint) : Promise.resolve([]),
            ]);
            // Third wave: dev wallet needs RPC + creator address
            const devWallet = tokenInfo?.creator
                ? await fetchDevWalletInfo(tokenInfo.creator, mint, config.solanaRpcUrl)
                : null;

            const claimNumber = incrementGithubClaimCount(event.githubUserId, mint);
            const claimedMints = getGithubUserClaimedMints(event.githubUserId);
            log.info('🚨 GitHub social fee FIRST claim by %s (%s) — %s SOL',
                event.githubUserId, githubUser?.login ?? '?', event.amountSol.toFixed(4));

            const ctx: ClaimFeedContext = {
                event,
                solUsdPrice,
                githubUser,
                xProfile,
                tokenInfo,
                isFirstClaim: true,
                isFake: false,
                claimNumber,
                lifetimeClaimedSol: event.lifetimeClaimedLamports != null
                    ? event.lifetimeClaimedLamports / 1e9
                    : undefined,
                repoInfo,
                creatorProfile,
                holders,
                trades,
                devWallet,
                liquidity,
                bundle,
                sameNameTokens,
                allLinkedTokens: allLinkedTokens.length > 0 ? allLinkedTokens : undefined,
                claimedMints: claimedMints.length > 0 ? claimedMints : undefined,
            };

            const stored = store.record({
                kind: 'claim',
                mint: mint || undefined,
                txSignature: event.txSignature,
                summary: `First GitHub claim by ${githubUser?.login ?? event.githubUserId}: ${event.amountSol.toFixed(4)} SOL`,
                posted: false,
                data: { type: 'github_social_claim', githubUser: githubUser?.login ?? null, amountSol: event.amountSol, mint: mint || null },
            });
            void webhooks.dispatch(stored);

            if (postingMuted()) {
                log.info('Posting muted — skipped GitHub claim by %s', event.githubUserId);
                return;
            }

            const { imageUrl, caption } = formatGitHubClaimFeed(ctx);
            try {
                const keyboard = mint
                    ? buildTxKeyboard(mint, event.txSignature, config.affiliates)
                    : undefined;
                const messageId = imageUrl
                    ? await postPhotoToChannel(imageUrl, caption, { kind: 'github_first_claim', keyboard })
                    : await postToChannel(caption, { kind: 'github_first_claim', keyboard });
                markGithubUserClaimed(event.githubUserId, mint);
                pipeline.posted++;
                store.markPosted(stored.seq);
                if (mint && tokenInfo) {
                    performance.track({
                        mint,
                        messageId,
                        symbol: tokenInfo.symbol,
                        mcapUsd: tokenInfo.usdMarketCap,
                        devWallet: tokenInfo.creator || undefined,
                        devPct: devWallet?.tokenSupplyPct,
                    });
                }
                log.info('✅ Posted GitHub claim by %s (%s) to %s',
                    event.githubUserId, githubUser?.login ?? '?', config.channelId);
            } catch (postErr) {
                if (!isReportedDelivery(postErr)) {
                    log.error('Failed to post claim by %s — will retry on next claim event: %s',
                        event.githubUserId, postErr);
                }
            }
        }

        // ── Path B: Creator fee claims (collect_creator_fee, collect_coin_creator_fee, distribute_creator_fees) ──
        // Gated separately from Path A. Before FEED_CREATOR_CLAIMS existed this
        // branch posted under FEED_CLAIMS, so the github-first-claims feed
        // carried every routine payout on the chain (2026-09-11).
        else if ((config.feed.creatorClaims && (event.claimType === 'collect_creator_fee' ||
                                                 event.claimType === 'collect_coin_creator_fee')) ||
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

            const stored = store.record({
                kind: 'claim',
                mint: mint || undefined,
                txSignature: event.txSignature,
                summary: `Creator fee claim ${event.amountSol.toFixed(4)} SOL by ${event.claimerWallet.slice(0, 8)}`,
                posted: false,
                data: { type: event.claimType, wallet: event.claimerWallet, amountSol: event.amountSol, mint: mint || null },
            });
            void webhooks.dispatch(stored);

            if (postingMuted()) {
                log.info('Posting muted — skipped creator claim by %s', event.claimerWallet.slice(0, 8));
                return;
            }

            const { imageUrl, caption } = formatCreatorClaimFeed(ctx);
            try {
                const keyboard = mint
                    ? buildTxKeyboard(mint, event.txSignature, config.affiliates)
                    : undefined;
                if (imageUrl) {
                    await postPhotoToChannel(imageUrl, caption, { kind: 'creator_claim', keyboard });
                } else {
                    await postToChannel(caption, { kind: 'creator_claim', keyboard });
                }
                pipeline.posted++;
                store.markPosted(stored.seq);
                log.info('✅ Posted creator claim by %s to %s', event.claimerWallet.slice(0, 8), config.channelId);
            } catch (postErr) {
                if (!isReportedDelivery(postErr)) {
                    log.error('Failed to post creator claim by %s: %s', event.claimerWallet.slice(0, 8), postErr);
                }
            }
        }
      } catch (err) {
        if (!isReportedDelivery(err)) log.error('Claim handler error: %s', err);
      }
    });
    }

    // ── On-chain Event Monitor: launches, graduations, whales, fee distributions ──
    // The monitor always runs; each feed's toggle gates Telegram posting at
    // event time so /feeds can flip them at runtime. Every detected event is
    // recorded to the store and fanned out to webhooks regardless of toggles,
    // which makes /events/recent and /events/stream a data API in their own right.
    const eventMonitor = new EventMonitor(
            config,
            async (event: TokenLaunchEvent) => {
                try {
                    const stored = store.record({
                        kind: 'launch',
                        mint: event.mintAddress,
                        txSignature: event.txSignature,
                        summary: `Launch: ${event.name} ($${event.symbol})${event.hasGithub ? ' [github]' : ''}`,
                        posted: false,
                        data: {
                            name: event.name, symbol: event.symbol, creator: event.creatorWallet,
                            hasGithub: event.hasGithub, mayhemMode: event.mayhemMode, cashbackEnabled: event.cashbackEnabled,
                        },
                    });
                    void webhooks.dispatch(stored);
                    if (!config.feed.launches || postingMuted()) return;

                    const creator = await fetchCreatorProfile(event.creatorWallet);
                    await postToChannel(formatLaunchFeed(event, creator), {
                        kind: 'launch',
                        keyboard: buildTokenKeyboard(event.mintAddress, config.affiliates),
                    });
                    pipeline.posted++;
                    store.markPosted(stored.seq);
                    log.info('✅ Posted launch %s ($%s) to %s', event.name, event.symbol, config.channelId);
                } catch (err) {
                    if (!isReportedDelivery(err)) log.error('Launch handler error: %s', err);
                }
            },
            async (event: GraduationEvent) => {
                try {
                    log.info('🎓 Graduation detected: %s (migration=%s)', event.mintAddress, event.isMigration);

                    const stored = store.record({
                        kind: 'graduation',
                        mint: event.mintAddress,
                        txSignature: event.txSignature,
                        summary: `Graduation: ${event.mintAddress.slice(0, 8)}…${event.isMigration ? ' (AMM migration)' : ''}`,
                        posted: false,
                        data: { isMigration: event.isMigration, solAmount: event.solAmount ?? null, poolAddress: event.poolAddress ?? null },
                    });
                    void webhooks.dispatch(stored);
                    if (!config.feed.graduations || postingMuted()) return;

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
                        { holders, trades, devWallet, xProfile, liquidity, bundle, affiliates: config.affiliates },
                    );

                    const keyboard = buildTokenKeyboard(event.mintAddress, config.affiliates);
                    const messageId = imageUrl
                        ? await postPhotoToChannel(imageUrl, caption, { kind: 'graduation', keyboard })
                        : await postToChannel(caption, { kind: 'graduation', keyboard });
                    pipeline.posted++;
                    store.markPosted(stored.seq);
                    if (token) {
                        performance.track({
                            mint: event.mintAddress,
                            messageId,
                            symbol: token.symbol,
                            mcapUsd: token.usdMarketCap,
                            devWallet: token.creator || undefined,
                            devPct: devWallet?.tokenSupplyPct,
                        });
                    }
                    log.info('✅ Posted graduation for %s to %s', event.mintAddress.slice(0, 8), config.channelId);
                } catch (err) {
                    if (!isReportedDelivery(err)) log.error('Graduation handler error: %s', err);
                }
            },
            async (event: TradeAlertEvent) => {
                try {
                    const side = event.isBuy ? 'buy' : 'sell';
                    const stored = store.record({
                        kind: 'whale',
                        mint: event.mintAddress,
                        txSignature: event.txSignature,
                        summary: `Whale ${side}: ${event.solAmount.toFixed(1)} SOL on ${event.mintAddress.slice(0, 8)}…`,
                        posted: false,
                        data: {
                            isBuy: event.isBuy, solAmount: event.solAmount, trader: event.user,
                            marketCapSol: event.marketCapSol, bondingCurveProgress: event.bondingCurveProgress,
                        },
                    });
                    void webhooks.dispatch(stored);
                    if (!config.feed.whales || postingMuted()) return;

                    const token = await fetchTokenInfo(event.mintAddress);
                    await postToChannel(formatWhaleFeed(event, token), {
                        kind: 'whale',
                        keyboard: buildTokenKeyboard(event.mintAddress, config.affiliates),
                    });
                    pipeline.posted++;
                    store.markPosted(stored.seq);
                    log.info('✅ Posted whale %s (%s SOL) to %s', side, event.solAmount.toFixed(1), config.channelId);
                } catch (err) {
                    if (!isReportedDelivery(err)) log.error('Whale handler error: %s', err);
                }
            },
            async (event: FeeDistributionEvent) => {
                try {
                    const stored = store.record({
                        kind: 'feeDistribution',
                        mint: event.mintAddress,
                        txSignature: event.txSignature,
                        summary: `Fee distribution: ${event.distributedSol.toFixed(4)} SOL to ${event.shareholders.length} shareholder(s)`,
                        posted: false,
                        data: { distributedSol: event.distributedSol, shareholders: event.shareholders.length },
                    });
                    void webhooks.dispatch(stored);
                    if (!config.feed.feeDistributions || postingMuted()) return;

                    const token = await fetchTokenInfo(event.mintAddress);
                    await postToChannel(formatFeeDistributionFeed(event, token), {
                        kind: 'fee_distribution',
                        keyboard: buildTxKeyboard(event.mintAddress, event.txSignature, config.affiliates),
                    });
                    pipeline.posted++;
                    store.markPosted(stored.seq);
                    log.info('✅ Posted fee distribution for %s to %s', event.mintAddress.slice(0, 8), config.channelId);
                } catch (err) {
                    if (!isReportedDelivery(err)) log.error('Fee distribution handler error: %s', err);
                }
            },
        );

    // ── Start ─────────────────────────────────────────────────────────
    if (config.feed.claims) {
        await claimMonitor!.start();
        log.info('Claim monitor started');
    }
    await eventMonitor.start();
    state.getMode = () => eventMonitor.mode;
    log.info('Event monitor started (%s)', eventMonitor.mode);
    if (config.performance.enabled) performance.start();

    // ── Telegram bot: admin commands + long polling ──────────────────
    const startedAt = Date.now();
    registerAdminCommands(bot, { config, state, store, webhooks, startedAt, performance: config.performance.enabled ? performance : undefined });
    await bot.init();
    log.info('Bot initialized: @%s', bot.botInfo.username);

    // Preflight: a bot that cannot reach its channel must say so at boot,
    // not silently drop every event until someone reads a stack trace.
    const access = await verifyChannelAccess(bot.api, config.channelId, bot.botInfo.id);
    if (access.ok) {
        log.info('Channel access verified: @%s can post to %s', bot.botInfo.username, config.channelId);
    } else {
        delivery.lastFault = access.fault;
        delivery.lastFix = access.fix;
        log.error('CHANNEL NOT REACHABLE (%s)', access.fault);
        log.error('FIX: %s', access.fix);
        log.error('Monitoring continues and events stay available on the HTTP API and webhooks.');
    }
    if (config.adminUserIds.length > 0) {
        // Long polling only exists to receive admin DMs; without admins the
        // bot stays send-only and never pulls updates.
        void bot.start({ drop_pending_updates: true }).catch((err) => {
            log.error('Bot long polling stopped: %s', err);
        });
    }
    log.info('Channel feed is live → %s', config.channelId);

    // ── HTTP API server ──────────────────────────────────────────────
    startHealthServer({
        startedAt,
        store,
        getStats: () => ({
            channel: config.channelId,
            transport: eventMonitor.mode,
            activeWs: eventMonitor.activeWsUrl ?? null,
            feeds: { ...config.feed },
            muted: postingMuted(),
            whaleThresholdSol: config.whaleThresholdSol,
            messagesPosted: pipeline.posted,
            policyRejected: pipeline.policyRejected,
            // A bot that cannot reach its channel is degraded, not healthy:
            // /health returns 503 so an uptime check actually catches it.
            degraded: !delivery.healthy,
            delivery: delivery.healthy
                ? { status: 'ok' }
                : { status: 'blocked', fault: delivery.lastFault, fix: delivery.lastFix, failures: delivery.failures },
            webhooks: webhooks.enabled ? { ...webhooks.stats } : undefined,
            performance: config.performance.enabled
                ? { openCalls: performance.activeCount, ...performance.stats }
                : undefined,
            ...(claimMonitor ? { claimMonitor: claimMonitor.getMetrics() } : {}),
        }),
    });

    // ── Watchdog: the feed reports its own outages ───────────────────
    // Without this a blocked channel or a dead websocket is only visible to
    // whoever thinks to curl /health on a private service, which is how this
    // feed stayed dark for six weeks.
    const watchdog = config.alertChatId
        ? new Watchdog({
            label: `PumpFun feed (${config.profile ?? 'custom'}) → ${config.channelId}`,
            envFile: process.env.ENV_FILE ?? (config.profile === 'github-first-claims' ? '.env.claims' : '.env'),
            send: async (text) => {
                await bot.api.sendMessage(config.alertChatId as string, text, { link_preview_options: { is_disabled: true } });
            },
            delivery: () => ({
                blocked: !delivery.healthy,
                fault: delivery.lastFault,
                fix: delivery.lastFix,
                failures: delivery.failures,
            }),
            wsEventsReceived: () =>
                Number((claimMonitor?.getMetrics().wsEventsReceived as number | undefined) ?? 0),
        })
        : undefined;
    if (watchdog) {
        watchdog.start();
        // Report a boot that is already broken instead of waiting a full cycle.
        void watchdog.tick();
    } else {
        log.info('Watchdog disabled (set ALERT_CHAT_ID to receive outage alerts)');
    }

    // ── Graceful shutdown ────────────────────────────────────────────
    const shutdown = () => {
        log.info('Shutting down...');
        watchdog?.stop();
        claimMonitor?.stop();
        eventMonitor.stop();
        performance.stop();
        void bot.stop().catch(() => {});
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

