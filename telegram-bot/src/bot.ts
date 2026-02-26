/**
 * PumpFun Telegram Bot — Telegram Bot & Command Handlers
 *
 * grammY bot setup with /watch, /unwatch, /list, /status, /help commands.
 * Works in both personal DMs and group chats.
 */

import { Bot } from 'grammy';
import type { Context } from 'grammy';

import {
    formatClaimNotification,
    formatHelp,
    formatStatus,
    formatWatchList,
    formatWelcome,
} from './formatters.js';
import { log } from './logger.js';
import type { PumpFunMonitor } from './monitor.js';
import {
    addWatch,
    findMatchingWatches,
    getWatchesForChat,
    removeWatch,
    removeWatchByWallet,
} from './store.js';
import type { BotConfig, FeeClaimEvent } from './types.js';

// ============================================================================
// Bot Factory
// ============================================================================

export function createBot(
    config: BotConfig,
    monitor: PumpFunMonitor,
): Bot {
    const bot = new Bot(config.telegramToken);

    // ── Auth middleware (optional) ────────────────────────────────────────
    if (config.allowedUserIds.length > 0) {
        bot.use(async (ctx, next) => {
            const userId = ctx.from?.id;
            if (!userId || !config.allowedUserIds.includes(userId)) {
                log.debug('Unauthorized user %d blocked', userId);
                return; // silently ignore
            }
            await next();
        });
    }

    // ── Error handling ───────────────────────────────────────────────────
    bot.catch((err) => {
        log.error('Bot error:', err.error);
    });

    // ── Commands ──────────────────────────────────────────────────────────
    bot.command('start', handleStart);
    bot.command('help', handleHelpCmd);
    bot.command('watch', handleWatch);
    bot.command('unwatch', handleUnwatch);
    bot.command('list', handleList);
    bot.command('status', (ctx) => handleStatus(ctx, monitor));

    // ── Fallback ─────────────────────────────────────────────────────────
    bot.on('message:text', async (ctx) => {
        // In groups, only respond to commands (already handled above)
        // In DMs, show a hint
        if (ctx.chat.type === 'private') {
            await ctx.reply(
                '💡 Use /help to see available commands.',
                { parse_mode: 'HTML' },
            );
        }
    });

    return bot;
}

// ============================================================================
// /start
// ============================================================================

async function handleStart(ctx: Context): Promise<void> {
    const name = ctx.from?.first_name || ctx.from?.username || 'there';
    await ctx.reply(formatWelcome(name), { parse_mode: 'HTML' });
}

// ============================================================================
// /help
// ============================================================================

async function handleHelpCmd(ctx: Context): Promise<void> {
    await ctx.reply(formatHelp(), { parse_mode: 'HTML' });
}

// ============================================================================
// /watch <wallet> [label]
// ============================================================================

async function handleWatch(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1); // strip /watch

    if (parts.length === 0) {
        await ctx.reply(
            '👁️ <b>Watch a Fee Recipient</b>\n\n' +
            'Usage: <code>/watch &lt;wallet_address&gt; [label]</code>\n\n' +
            'Example:\n' +
            '<code>/watch HN7c...4xYz MyProject</code>\n\n' +
            "The wallet should be the Solana address of the person whose fee claims you want to track.",
            { parse_mode: 'HTML' },
        );
        return;
    }

    const wallet = parts[0];
    const label = parts.slice(1).join(' ') || undefined;

    // Basic Solana address validation (base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
        await ctx.reply(
            '❌ Invalid Solana wallet address. Must be a base58-encoded public key (32-44 characters).',
        );
        return;
    }

    // Check for duplicates in this chat
    const existing = getWatchesForChat(ctx.chat!.id);
    if (existing.some((w) => w.recipientWallet.toLowerCase() === wallet.toLowerCase())) {
        await ctx.reply('⚠️ This wallet is already being watched in this chat.');
        return;
    }

    const watch = addWatch(ctx.chat!.id, ctx.from!.id, wallet, label);
    const shortWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    const labelStr = label ? ` (<b>${escapeHtml(label)}</b>)` : '';

    await ctx.reply(
        `✅ <b>Watch Added</b>\n\n` +
        `👤 Wallet: <code>${shortWallet}</code>${labelStr}\n` +
        `🔔 You'll be notified when this wallet claims PumpFun fees or cashback.\n\n` +
        `ID: <code>${watch.id}</code>`,
        { parse_mode: 'HTML' },
    );
}

// ============================================================================
// /unwatch <wallet_or_number>
// ============================================================================

async function handleUnwatch(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1);

    if (parts.length === 0) {
        await ctx.reply(
            '🗑️ <b>Remove a Watch</b>\n\n' +
            'Usage: <code>/unwatch &lt;wallet_address_or_list_number&gt;</code>\n\n' +
            'Use /list to see your watches.',
            { parse_mode: 'HTML' },
        );
        return;
    }

    const input = parts[0];
    const chatId = ctx.chat!.id;

    // Try by list number first
    const num = Number.parseInt(input, 10);
    if (!Number.isNaN(num) && num > 0) {
        const watches = getWatchesForChat(chatId);
        if (num <= watches.length) {
            const target = watches[num - 1];
            removeWatch(target.id, chatId);
            const shortW = `${target.recipientWallet.slice(0, 6)}...${target.recipientWallet.slice(-4)}`;
            await ctx.reply(`✅ Removed watch for <code>${shortW}</code>`, {
                parse_mode: 'HTML',
            });
            return;
        }
    }

    // Try by wallet address
    if (removeWatchByWallet(input, chatId)) {
        const shortW = `${input.slice(0, 6)}...${input.slice(-4)}`;
        await ctx.reply(`✅ Removed watch for <code>${shortW}</code>`, {
            parse_mode: 'HTML',
        });
    } else {
        await ctx.reply(
            '❌ Watch not found. Use /list to see your active watches.',
        );
    }
}

// ============================================================================
// /list
// ============================================================================

async function handleList(ctx: Context): Promise<void> {
    const watches = getWatchesForChat(ctx.chat!.id);
    await ctx.reply(formatWatchList(watches), { parse_mode: 'HTML' });
}

// ============================================================================
// /status
// ============================================================================

async function handleStatus(
    ctx: Context,
    monitor: PumpFunMonitor,
): Promise<void> {
    const watches = getWatchesForChat(ctx.chat!.id);
    const state = monitor.getState();
    await ctx.reply(formatStatus(state, watches.length), { parse_mode: 'HTML' });
}

// ============================================================================
// Notification Sender
// ============================================================================

/**
 * Called by the monitor when a fee claim is detected.
 * Finds matching watches and sends notifications to the appropriate chats.
 */
export function createClaimHandler(bot: Bot) {
    return async (event: FeeClaimEvent): Promise<void> => {
        const watches = findMatchingWatches(event.claimerWallet);

        if (watches.length === 0) {
            log.debug(
                'Claim by %s — no matching watches',
                event.claimerWallet.slice(0, 8),
            );
            return;
        }

        log.info(
            'Sending %d notifications for claim by %s',
            watches.length,
            event.claimerWallet.slice(0, 8),
        );

        for (const watch of watches) {
            try {
                const text = formatClaimNotification(event, watch);
                await bot.api.sendMessage(watch.chatId, text, {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                });
            } catch (err) {
                log.error(
                    'Failed to send notification to chat %d:',
                    watch.chatId,
                    err,
                );
            }
        }
    };
}

// ============================================================================
// Utility
// ============================================================================

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
