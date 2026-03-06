// ── PumpFun Swarm — Entry Point ────────────────────────────────────
//
// Orchestrates all bots: telegram-bot, outsiders-bot, channel-bot,
// websocket-server. Provides a unified admin dashboard with real-time
// event streaming, cross-bot event bus, and health monitoring.
//
// Usage:
//   npm run dev          — Development with auto-reload
//   npm start            — Production
//   SWARM_AUTO_START=telegram-bot,websocket-server npm start
//
// Dashboard: http://localhost:4000
// API:       http://localhost:4000/api/v1/bots
// WebSocket: ws://localhost:4000/ws
// ──────────────────────────────────────────────────────────────────

import { loadConfig } from './config.js';
import { setLogLevel, log } from './logger.js';
import { EventBus } from './event-bus.js';
import { BotManager } from './bot-manager.js';
import { SwarmApi } from './api.js';
import type { BotId } from './types.js';

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  log.info('══════════════════════════════════════════');
  log.info('  🐝 PumpFun Swarm — Control Center');
  log.info('══════════════════════════════════════════');
  log.info(`Port: ${config.port}`);
  log.info(`Log level: ${config.logLevel}`);
  log.info(`Health check interval: ${config.healthCheckInterval}ms`);
  log.info(`Max event buffer: ${config.maxEventBuffer}`);
  log.info(`Auto-start bots: ${config.autoStartBots.length > 0 ? config.autoStartBots.join(', ') : 'none'}`);

  // ── Event Bus ───────────────────────────────────────────────
  const eventBus = new EventBus(config.maxEventBuffer);

  // ── Bot Manager ─────────────────────────────────────────────
  const botManager = new BotManager(eventBus, config.healthCheckInterval);
  botManager.startHealthChecks();

  // ── API + Dashboard ─────────────────────────────────────────
  const api = new SwarmApi(config, botManager, eventBus);
  api.start();

  // ── Auto-start configured bots ──────────────────────────────
  for (const botId of config.autoStartBots) {
    try {
      log.info(`Auto-starting ${botId}…`);
      await botManager.start(botId);
    } catch (err) {
      log.error(`Failed to auto-start ${botId}: ${err}`);
    }
  }

  // ── Cross-bot event routing ─────────────────────────────────
  // Route whale alerts from websocket-server to telegram-bot and channel-bot
  eventBus.on('alert:whale', (event) => {
    log.info(`🐋 Whale alert from ${event.source}: ${JSON.stringify(event.data)}`);
  });

  // Route token launches from websocket-server to channel-bot
  eventBus.on('token:launch', (event) => {
    log.info(`🚀 Token launch from ${event.source}`);
  });

  // Route graduation events across all bots
  eventBus.on('token:graduation', (event) => {
    log.info(`🎓 Graduation from ${event.source}`);
  });

  // Route call events from outsiders-bot to channel-bot
  eventBus.on('call:new', (event) => {
    log.info(`📞 New call from ${event.source}`);
  });

  // Log all errors
  eventBus.on('bot:error', (event) => {
    log.error(`❌ Bot error from ${event.source}: ${JSON.stringify(event.data)}`);
  });

  // ── Swarm metrics logging ───────────────────────────────────
  setInterval(() => {
    const metrics = eventBus.getMetrics();
    if (metrics.totalEvents > 0) {
      eventBus.emit('system:metric', 'orchestrator', {
        memory: process.memoryUsage().heapUsed,
        eventsPerMinute: metrics.eventsPerMinute,
        totalEvents: metrics.totalEvents,
        bufferSize: metrics.bufferSize,
      });
    }
  }, 30_000);

  // ── Graceful Shutdown ───────────────────────────────────────
  const shutdown = async () => {
    log.info('Shutting down swarm…');
    await botManager.stopAll();
    await api.stop();
    eventBus.destroy();
    log.info('Swarm stopped. Goodbye! 🐝');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log.info('──────────────────────────────────────────');
  log.info(`  Dashboard: http://localhost:${config.port}/`);
  log.info(`  API:       http://localhost:${config.port}/api/v1/bots`);
  log.info(`  WebSocket: ws://localhost:${config.port}/ws`);
  log.info('──────────────────────────────────────────');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
