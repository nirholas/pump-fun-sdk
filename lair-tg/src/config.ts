// ── Lair-TG — Config ──────────────────────────────────────────────

import 'dotenv/config';
import type { LairConfig } from './types.js';

export function loadConfig(): LairConfig {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const rpc = process.env.SOLANA_RPC_URL;
  if (!rpc) {
    throw new Error('SOLANA_RPC_URL is required');
  }

  return {
    telegramBotToken: token,
    solanaRpcUrl: rpc,
    logLevel: (process.env.LOG_LEVEL as LairConfig['logLevel']) ?? 'info',
    healthPort: Number(process.env.HEALTH_PORT || process.env.PORT || 3000),
    modules: {
      wallet: process.env.MODULE_WALLET !== 'false',
      market: process.env.MODULE_MARKET !== 'false',
      launch: process.env.MODULE_LAUNCH !== 'false',
      alerts: process.env.MODULE_ALERTS !== 'false',
    },
  };
}
