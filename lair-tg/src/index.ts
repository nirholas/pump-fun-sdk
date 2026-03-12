/**
 * Lair-TG — Entry Point
 *
 * Unified Telegram bot platform for DeFi intelligence.
 *
 * Modules:
 *   - Market data: token lookups from DexScreener and other sources
 *   - Wallet:      balance checks via Solana RPC
 *   - Alerts:      price alerts with polling
 *   - Launch:      token deployment via bonding curves (planned)
 *
 * Run:
 *   npm run dev          (hot reload)
 *   npm run build && npm start  (production)
 */

import { loadConfig } from './config.js';
import { setLogLevel, log } from './logger.js';
import { createBot } from './bot.js';
import { startHealthServer, stopHealthServer } from './health.js';

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  log.info('──────────────────────────────────────');
  log.info('  Lair-TG starting…');
  log.info('──────────────────────────────────────');
  log.info('  RPC: %s', config.solanaRpcUrl.replace(/\/[^/]*$/, '/***'));
  log.info('  Modules: %s', Object.entries(config.modules)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', '));

  const bot = createBot(config);

  bot.catch((err) => {
    log.error('Bot error: %s', err.message);
  });

  // Graceful shutdown
  const shutdown = async () => {
    log.info('Shutting down…');
    stopHealthServer();
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Health server
  const startedAt = Date.now();
  startHealthServer({
    serviceName: 'lair-tg',
    startedAt,
    port: config.healthPort,
  });

  // Start polling
  await bot.start({
    onStart: () => log.info('Lair is running! Listening for messages…'),
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
