/**
 * PumpFun Telegram Bot + REST API — Entry Point
 *
 * Wires together config → monitor → bot → API and starts everything.
 *
 * Run:
 *   npm run dev                 (bot only, tsx watch)
 *   ENABLE_API=true npm run dev (bot + API)
 *   npm run api                 (API-only, no Telegram bot)
 *   npm run build && npm start  (production)
 */

import { loadConfig } from './config.js';
import { createBot, createClaimHandler, createCreatorChangeHandler } from './bot.js';
import type { TokenLaunchMonitorLike, PumpEventMonitorLike } from './bot.js';
import {
    formatTokenLaunchNotification,
    formatGraduationNotification,
    formatTradeAlertNotification,
    formatFeeDistributionNotification,
} from './formatters.js';
import type { TokenLaunchEvent, GraduationEvent, TradeAlertEvent, FeeDistributionEvent } from './types.js';
import { getActiveMonitors } from './launch-store.js';
import { log, setLogLevel } from './logger.js';
import { PumpFunMonitor } from './monitor.js';
import { loadWatches } from './store.js';
import { loadApiConfig, PumpFunApi } from './api/index.js';

async function main(): Promise<void> {
    // ── Load config ──────────────────────────────────────────────────────
    const config = loadConfig();
    setLogLevel(config.logLevel);

    const enableApi = process.env.ENABLE_API === 'true' || process.env.API_ONLY === 'true';
    const apiOnly = process.env.API_ONLY === 'true';

    log.info('PumpFun %s starting...', apiOnly ? 'API' : enableApi ? 'Bot + API' : 'Bot');
    log.info('  RPC: %s', config.solanaRpcUrl);
    log.info('  WS:  %s', config.solanaWsUrl || '(derived from RPC)');
    if (!apiOnly) {
        log.info('  Allowed users: %s', config.allowedUserIds.length || 'all');
    }

    // ── Load persisted watches ───────────────────────────────────────────
    loadWatches();

    // ── Create Solana monitor (not started yet) ──────────────────────────
    // We pass placeholder callbacks; they get replaced after bot creation
    let claimHandler = (_event: import('./types.js').FeeClaimEvent) => { };
    let ctoHandler = (_event: import('./types.js').CreatorChangeEvent) => { };
    const monitor = new PumpFunMonitor(
        config,
        (event) => claimHandler(event),
        (event) => ctoHandler(event),
    );

    // ── Create API server (if enabled) ───────────────────────────────────
    let api: PumpFunApi | null = null;
    if (enableApi) {
        const apiConfig = loadApiConfig();
        api = new PumpFunApi(apiConfig, monitor);
        log.info('  API port: %d', apiConfig.port);
        log.info('  API keys: %s', apiConfig.apiKeys.length || 'none (open)');
    }

    // ── Create Telegram bot ──────────────────────────────────────────────
    // Try to load the token launch monitor (Agent 1's module, may not exist yet)
    let launchMonitor: TokenLaunchMonitorLike | undefined;
    try {
        const { TokenLaunchMonitor } = await import('./token-launch-monitor.js');
        launchMonitor = new TokenLaunchMonitor(config, async (event: TokenLaunchEvent) => {
            if (!bot) return;
            const monitors = getActiveMonitors();
            for (const entry of monitors) {
                // Skip chats that disabled launch alerts
                if (!entry.alerts.launches) continue;
                // Apply github filter
                if (entry.githubOnly && !event.hasGithub) continue;

                try {
                    const message = formatTokenLaunchNotification(event);
                    await bot.api.sendMessage(entry.chatId, message, {
                        parse_mode: 'HTML',
                        link_preview_options: { is_disabled: true },
                    });
                } catch (err) {
                    log.error('Failed to send launch notification to chat %d:', entry.chatId, err);
                }
            }
        });
        log.info('Token launch monitor loaded');
    } catch {
        log.info('Token launch monitor not available (token-launch-monitor.ts not built yet)');
    }

    // ── Create Pump Event Monitor (graduation, whale trades, fee distributions)
    let eventMonitor: PumpEventMonitorLike | undefined;
    const hasEventFeatures =
        config.enableGraduationAlerts ||
        config.enableTradeAlerts ||
        config.enableFeeDistributionAlerts;

    if (hasEventFeatures) {
        try {
            const { PumpEventMonitor } = await import('./pump-event-monitor.js');

            const broadcastToMonitors = async (
                alertKey: 'graduations' | 'whales' | 'feeDistributions',
                formatFn: (event: never) => string,
                event: GraduationEvent | TradeAlertEvent | FeeDistributionEvent,
            ) => {
                if (!bot) return;
                const monitors = getActiveMonitors();
                for (const entry of monitors) {
                    // Respect per-chat alert preferences
                    if (!entry.alerts[alertKey]) continue;
                    try {
                        const message = formatFn(event as never);
                        await bot.api.sendMessage(entry.chatId, message, {
                            parse_mode: 'HTML',
                            link_preview_options: { is_disabled: true },
                        });
                    } catch (err) {
                        log.error('Failed to send event notification to chat %d:', entry.chatId, err);
                    }
                }
            };

            eventMonitor = new PumpEventMonitor(
                config,
                (event: GraduationEvent) => broadcastToMonitors('graduations', formatGraduationNotification, event),
                (event: TradeAlertEvent) => broadcastToMonitors('whales', formatTradeAlertNotification, event),
                (event: FeeDistributionEvent) => broadcastToMonitors('feeDistributions', formatFeeDistributionNotification, event),
            );
            log.info('Pump event monitor loaded');
        } catch {
            log.info('Pump event monitor not available (pump-event-monitor.ts not built yet)');
        }
    }

    let bot: import('grammy').Bot | null = null;
    let botClaimHandler: ((event: import('./types.js').FeeClaimEvent) => Promise<void>) | null = null;

    if (!apiOnly) {
        bot = createBot(config, monitor, launchMonitor, eventMonitor);

        // Wire up the claim handler now that bot exists
        const handler = createClaimHandler(bot);
        botClaimHandler = handler;
    }

    // Wire up the unified claim handler (bot + API)
    claimHandler = (event) => {
        if (botClaimHandler) {
            botClaimHandler(event).catch((err) => log.error('Claim handler error:', err));
        }
        if (api) {
            api.handleClaim(event);
        }
    };

    // Wire up the CTO handler
    if (bot) {
        const ctoHandlerFn = createCreatorChangeHandler(bot);
        ctoHandler = (event) => {
            ctoHandlerFn(event).catch((err) => log.error('CTO handler error:', err));
        };
    }

    // ── Start monitor ────────────────────────────────────────────────────
    await monitor.start();

    // ── Start token launch monitor (if available and enabled) ────────────
    if (launchMonitor && config.enableLaunchMonitor) {
        try {
            await (launchMonitor as unknown as { start(): Promise<void> }).start();
            log.info('Token launch monitor started');
        } catch (err) {
            log.error('Failed to start token launch monitor:', err);
        }
    }

    // ── Start pump event monitor (if available and features enabled) ─────
    if (eventMonitor && hasEventFeatures) {
        try {
            await (eventMonitor as unknown as { start(): Promise<void> }).start();
            log.info('Pump event monitor started');
        } catch (err) {
            log.error('Failed to start pump event monitor:', err);
        }
    }

    // ── Start API server ─────────────────────────────────────────────────
    if (api) {
        await api.start();
    }

    // ── Start bot (polling mode for dev, webhook for prod) ───────────────
    if (!bot) {
        log.info('API-only mode — Telegram bot disabled');
    } else {
        log.info('Starting Telegram bot in polling mode...');

        await bot.api.setMyCommands([
            { command: 'start', description: 'Welcome & get started' },
            { command: 'help', description: 'Show all commands' },
            { command: 'watch', description: 'Watch a fee recipient wallet' },
            { command: 'unwatch', description: 'Stop watching a wallet' },
            { command: 'list', description: 'List active watches' },
            { command: 'status', description: 'Monitor status & stats' },
            { command: 'cto', description: 'Creator Takeover lookup & stats' },
            { command: 'alerts', description: 'Configure alert types per chat' },
            { command: 'monitor', description: 'Start real-time token launch feed' },
            { command: 'stopmonitor', description: 'Stop the token launch feed' },
        ]);

        bot.start({
            onStart: (info) => {
                log.info('Bot started: @%s', info.username);
                log.info('Send /start to the bot to begin!');
            },
        });
    }

    // ── Graceful shutdown ────────────────────────────────────────────────
    const shutdown = () => {
        log.info('Shutting down...');
        monitor.stop();
        if (api) api.stop();
        if (launchMonitor && typeof (launchMonitor as unknown as { stop(): void }).stop === 'function') {
            (launchMonitor as unknown as { stop(): void }).stop();
        }
        if (eventMonitor && typeof (eventMonitor as unknown as { stop(): void }).stop === 'function') {
            (eventMonitor as unknown as { stop(): void }).stop();
        }
        if (bot) bot.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
