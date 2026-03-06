import { Connection } from '@solana/web3.js';
import { loadConfig } from './config.js';
import { logger, setLogLevel } from './logger.js';
import { SwarmDb } from './store/db.js';
import { BotManager } from './engine/bot-manager.js';
import { TokenFeed } from './market/token-feed.js';
import { PriceFeed } from './market/price-feed.js';
import { ApiServer } from './api/server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel as 'debug' | 'info' | 'warn' | 'error');

  logger.info('═══════════════════════════════════════════');
  logger.info('  PumpFun Swarm Bot — Starting Up');
  logger.info('═══════════════════════════════════════════');
  logger.info(`RPC:      ${config.rpcUrl.slice(0, 30)}…`);
  logger.info(`Port:     ${config.port}`);
  logger.info(`DB:       ${config.dbPath}`);
  logger.info(`Slippage: ${config.defaultSlippageBps} bps`);
  logger.info(`Max/bot:  ${config.maxPositionSolPerBot} SOL`);
  logger.info(`Max/total:${config.maxTotalPositionSol} SOL`);

  // ── Initialize core components ─────────────────────────────────────────────

  // 1. Solana RPC connection
  const connection = new Connection(config.rpcUrl, 'confirmed');

  // Validate connection
  try {
    const slot = await connection.getSlot();
    logger.info(`Connected to Solana (slot: ${slot})`);
  } catch (err) {
    logger.error(`Failed to connect to Solana RPC: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // 2. Database
  const db = new SwarmDb(config.dbPath);
  logger.info('Database initialized');

  // 3. Bot Manager
  const botManager = new BotManager(db, connection);
  logger.info('Bot manager ready');

  // 4. Token Feed — detects new token launches
  const tokenFeed = new TokenFeed({
    pollIntervalMs: config.pollIntervalMs,
  });

  // 5. Price Feed — polls bonding curves for tracked mints
  const priceFeed = new PriceFeed({
    connection,
    pollIntervalMs: config.pollIntervalMs,
  });

  // ── Wire feeds to bot manager ──────────────────────────────────────────────

  // When a new token is detected, notify all running bots
  tokenFeed.on('token', (launch) => {
    botManager.onNewToken(launch.mint, {
      name: launch.name,
      symbol: launch.symbol,
    });
    // Also start tracking its price
    priceFeed.track(launch.mint);
  });

  // When a token graduates, update tracking
  priceFeed.on('graduation', ({ mint }) => {
    logger.info(`Token ${mint.slice(0, 8)}… graduated to AMM`);
  });

  // ── Start API server ───────────────────────────────────────────────────────

  const apiServer = new ApiServer({
    port: config.port,
    botManager,
    tokenFeed,
    priceFeed,
  });

  await apiServer.start();

  // ── Start feeds ────────────────────────────────────────────────────────────

  tokenFeed.start();
  priceFeed.start();

  logger.info('═══════════════════════════════════════════');
  logger.info('  All systems operational');
  logger.info(`  Dashboard: http://localhost:${config.port}`);
  logger.info('═══════════════════════════════════════════');

  // ── Graceful shutdown ──────────────────────────────────────────────────────

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`\n${signal} received — shutting down gracefully…`);

    // 1. Stop all bots
    botManager.stopAll();
    logger.info('All bots stopped');

    // 2. Stop feeds
    tokenFeed.stop();
    priceFeed.stop();
    logger.info('Feeds stopped');

    // 3. Stop API server
    await apiServer.stop();
    logger.info('API server stopped');

    // 4. Close database
    db.close();
    logger.info('Database closed');

    logger.info('Shutdown complete');
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep process alive
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    logger.error(err.stack ?? '');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });
}

main().catch((err) => {
  logger.error(`Fatal error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
