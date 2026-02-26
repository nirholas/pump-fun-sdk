/**
 * PumpFun Telegram Bot — Entry Point
 *
 * Wires together config → monitor → bot and starts everything.
 *
 * Run:
 *   npm run dev      (tsx watch, hot reload)
 *   npm run build && npm start   (production)
 */

import { loadConfig } from './config.js';
import { createBot, createClaimHandler } from './bot.js';
import { log, setLogLevel } from './logger.js';
import { PumpFunMonitor } from './monitor.js';
import { loadWatches } from './store.js';

async function main(): Promise<void> {
    // ── Load config ──────────────────────────────────────────────────────
    const config = loadConfig();
    setLogLevel(config.logLevel);

    log.info('PumpFun Telegram Bot starting...');
    log.info('  RPC: %s', config.solanaRpcUrl);
    log.info('  WS:  %s', config.solanaWsUrl || '(derived from RPC)');
    log.info('  Allowed users: %s', config.allowedUserIds.length || 'all');

    // ── Load persisted watches ───────────────────────────────────────────
    loadWatches();

    // ── Create Solana monitor (not started yet) ──────────────────────────
    // We pass a placeholder callback; it gets replaced after bot creation
    let claimHandler = (_event: import('./types.js').FeeClaimEvent) => { };
    const monitor = new PumpFunMonitor(config, (event) => claimHandler(event));

    // ── Create Telegram bot ──────────────────────────────────────────────
    const bot = createBot(config, monitor);

    // Wire up the claim handler now that bot exists
    const handler = createClaimHandler(bot);
    claimHandler = (event) => {
        handler(event).catch((err) => log.error('Claim handler error:', err));
    };

    // ── Start monitor ────────────────────────────────────────────────────
    await monitor.start();

    // ── Start bot (polling mode for dev, webhook for prod) ───────────────
    log.info('Starting Telegram bot in polling mode...');

    await bot.api.setMyCommands([
        { command: 'start', description: 'Welcome & get started' },
        { command: 'help', description: 'Show all commands' },
        { command: 'watch', description: 'Watch a fee recipient wallet' },
        { command: 'unwatch', description: 'Stop watching a wallet' },
        { command: 'list', description: 'List active watches' },
        { command: 'status', description: 'Monitor status & stats' },
    ]);

    bot.start({
        onStart: (info) => {
            log.info('Bot started: @%s', info.username);
            log.info('Send /start to the bot to begin!');
        },
    });

    // ── Graceful shutdown ────────────────────────────────────────────────
    const shutdown = () => {
        log.info('Shutting down...');
        monitor.stop();
        bot.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
