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
import { recordClaim, isFirstClaimOnToken } from './claim-tracker.js';
import { fetchTokenInfo, fetchCreatorProfile } from './pump-client.js';
import {
    formatClaimFeed,
    formatLaunchFeed,
    formatGraduationFeed,
    formatWhaleFeed,
    formatFeeDistributionFeed,
} from './formatters.js';
import { log, setLogLevel } from './logger.js';
import type {
    FeeClaimEvent,
    GraduationEvent,
    TradeAlertEvent,
    FeeDistributionEvent,
} from './types.js';

async function main(): Promise<void> {
    const config = loadConfig();
    setLogLevel(config.logLevel);

    log.info('PumpFun Channel Bot starting...');
    log.info('  Channel: %s', config.channelId);
    log.info('  RPC: %s', config.solanaRpcUrl);
    log.info('  Feed: claims=%s launches=%s graduations=%s whales=%s fees=%s',
        config.feed.claims, config.feed.launches, config.feed.graduations,
        config.feed.whales, config.feed.feeDistributions,
    );

    const bot = new Bot(config.telegramToken);

    bot.catch((err) => {
        log.error('Bot error:', err.error);
    });

    /** Send a message to the channel. */
    async function postToChannel(message: string): Promise<void> {
        try {
            await bot.api.sendMessage(config.channelId, message, {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
            });
        } catch (err) {
            log.error('Failed to post to channel %s:', config.channelId, err);
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

        // Enrich with token info + creator profile
        const [token, creator] = await Promise.all([
            event.tokenMint ? fetchTokenInfo(event.tokenMint) : Promise.resolve(null),
            event.claimerWallet ? fetchCreatorProfile(event.claimerWallet) : Promise.resolve(null),
        ]);

        // Record claim history
        const record = recordClaim(
            event.claimerWallet,
            mint,
            event.amountSol,
            event.timestamp,
        );

        const message = formatClaimFeed(event, token, creator, record);
        await postToChannel(message);
    });

    // ── Event Monitor (graduations, whales, fee distributions) ───────
    const hasEvents = config.feed.graduations || config.feed.whales || config.feed.feeDistributions;
    let eventMonitor: EventMonitor | null = null;

    if (hasEvents) {
        eventMonitor = new EventMonitor(
            config,
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

    // ── Graceful shutdown ────────────────────────────────────────────
    const shutdown = () => {
        log.info('Shutting down...');
        claimMonitor.stop();
        if (eventMonitor) eventMonitor.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});

