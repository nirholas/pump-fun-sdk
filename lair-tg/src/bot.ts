// ── Lair-TG — Bot (command handlers) ──────────────────────────────

import { Bot, type Context } from 'grammy';
import { DataAggregator } from './data-sources.js';
import { formatTokenInfo } from './formatters.js';
import { log } from './logger.js';
import type { LairConfig } from './types.js';

export function createBot(config: LairConfig): Bot {
  const bot = new Bot(config.telegramBotToken);
  const aggregator = new DataAggregator();

  // ── /start ──────────────────────────────────────────────────────
  bot.command('start', async (ctx: Context) => {
    await ctx.reply(
      [
        '<b>Welcome to Lair</b> — DeFi Intelligence Bot',
        '',
        '/token &lt;address&gt; — Look up token info',
        '/price &lt;address&gt; — Quick price check',
        '/help — Show all commands',
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  // ── /help ───────────────────────────────────────────────────────
  bot.command('help', async (ctx: Context) => {
    const commands = [
      '<b>Lair Commands</b>',
      '',
      '<b>Market Data</b>',
      '/token &lt;address&gt; — Full token info card',
      '/price &lt;address&gt; — Quick price check',
      '',
      '<b>General</b>',
      '/start — Welcome message',
      '/help — This help text',
    ];

    if (config.modules.wallet) {
      commands.push('', '<b>Wallet</b>', '/wallet &lt;address&gt; — Check wallet balance');
    }

    if (config.modules.alerts) {
      commands.push(
        '',
        '<b>Alerts</b>',
        '/alert &lt;address&gt; above|below &lt;price&gt; — Set price alert',
      );
    }

    await ctx.reply(commands.join('\n'), { parse_mode: 'HTML' });
  });

  // ── /token ──────────────────────────────────────────────────────
  if (config.modules.market) {
    bot.command('token', async (ctx: Context) => {
      const address = ctx.match?.toString().trim();
      if (!address) {
        await ctx.reply('Usage: /token <address>');
        return;
      }

      const token = await aggregator.fetchToken(address);
      if (!token) {
        await ctx.reply('Token not found or no data available.');
        return;
      }

      await ctx.reply(formatTokenInfo(token), { parse_mode: 'HTML' });
    });

    bot.command('price', async (ctx: Context) => {
      const address = ctx.match?.toString().trim();
      if (!address) {
        await ctx.reply('Usage: /price <address>');
        return;
      }

      const token = await aggregator.fetchToken(address);
      if (!token || token.priceUsd == null) {
        await ctx.reply('Price not available.');
        return;
      }

      await ctx.reply(
        `<b>${token.symbol}</b>: <code>$${token.priceUsd.toFixed(8)}</code>`,
        { parse_mode: 'HTML' },
      );
    });
  }

  log.info('Bot commands registered (modules: %s)', Object.entries(config.modules)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', '));

  return bot;
}
