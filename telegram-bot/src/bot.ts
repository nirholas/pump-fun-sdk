/**
 * PumpFun Telegram Bot — Telegram Bot & Command Handlers
 *
 * grammý bot setup with /watch, /unwatch, /list, /status, /help,
 * /monitor, and /stopmonitor commands.
 * Works in both personal DMs and group chats.
 */

import { Bot } from 'grammy';
import type { Context } from 'grammy';

import {
    formatClaimNotification,
    formatCreatorChangeNotification,
    formatHelp,
    formatMonitorActivated,
    formatMonitorDeactivated,
    formatStatus,
    formatWatchList,
    formatWelcome,
    escapeHtml,
} from './formatters.js';
import type { PumpEventMonitorState, TokenLaunchMonitorState } from './types.js';
import {
    activateMonitor,
    deactivateMonitor,
    getActiveMonitorCount,
    getMonitorEntry,
    isMonitorActive,
} from './launch-store.js';
import { log } from './logger.js';
import type { PumpFunMonitor } from './monitor.js';
import {
    addWatch,
    findMatchingWatches,
    getWatchesForChat,
    removeWatch,
    removeWatchByWallet,
} from './store.js';
import type { BotConfig, CreatorChangeEvent, FeeClaimEvent } from './types.js';

// ============================================================================
// Token Launch Monitor type (optional — may not exist yet)
// ============================================================================

/** Minimal interface for the TokenLaunchMonitor (built by Agent 1). */
export interface TokenLaunchMonitorLike {
    getState(): TokenLaunchMonitorState;
}

/** Minimal interface for the PumpEventMonitor. */
export interface PumpEventMonitorLike {
    getState(): PumpEventMonitorState;
}

// ============================================================================
// Bot Factory
// ============================================================================

export function createBot(
    config: BotConfig,
    monitor: PumpFunMonitor,
    launchMonitor?: TokenLaunchMonitorLike,
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
    bot.command('status', (ctx) => handleStatus(ctx, monitor, launchMonitor));
    bot.command('cto', (ctx) => handleCto(ctx, monitor));
    bot.command('monitor', (ctx) => handleMonitor(ctx));
    bot.command('stopmonitor', (ctx) => handleStopMonitor(ctx));

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
// /cto <mint_or_wallet>
// ============================================================================

async function handleCto(ctx: Context, monitor: PumpFunMonitor): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1); // strip /cto

    if (parts.length === 0) {
        // Show CTO stats and usage
        const state = monitor.getState();
        const recentEvents = monitor.getRecentCtoEvents();
        let msg =
            '🔀 <b>Creator Takeover (CTO) Monitor</b>\n\n' +
            `📊 <b>CTO Events Detected:</b> ${state.creatorChanges || 0}\n\n`;

        if (recentEvents.length > 0) {
            msg += '<b>Recent CTO Events:</b>\n\n';
            for (const evt of recentEvents.slice(0, 5)) {
                const shortSigner = `${evt.signerWallet.slice(0, 6)}...${evt.signerWallet.slice(-4)}`;
                const shortNew = evt.newCreatorWallet
                    ? `${evt.newCreatorWallet.slice(0, 6)}...${evt.newCreatorWallet.slice(-4)}`
                    : '<i>from metadata</i>';
                const shortMint = evt.tokenMint
                    ? `${evt.tokenMint.slice(0, 6)}...${evt.tokenMint.slice(-4)}`
                    : 'unknown';
                const time = new Date(evt.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19);
                msg += `• <b>${escapeHtml(evt.changeLabel)}</b>\n` +
                    `  Signer: <code>${shortSigner}</code>\n` +
                    `  New Creator: <code>${shortNew}</code>\n` +
                    `  Mint: <code>${shortMint}</code>\n` +
                    `  Time: ${time} UTC\n` +
                    `  <a href="https://solscan.io/tx/${evt.txSignature}">View TX</a>\n\n`;
            }
        } else {
            msg += '<i>No CTO events detected yet. The monitor is watching for creator changes in real-time.</i>\n\n';
        }

        msg += '<b>Usage:</b>\n' +
            '<code>/cto &lt;mint_address&gt;</code> — Look up creator for a token\n' +
            '<code>/cto &lt;wallet_address&gt;</code> — Find CTO events for a wallet\n\n' +
            '<b>What is CTO?</b>\n' +
            'Creator Takeover redirects future creator fees to a new wallet. ' +
            'This can happen via <code>set_creator</code>, <code>admin_set_creator</code>, ' +
            '<code>set_coin_creator</code>, <code>admin_set_coin_creator</code>, or ' +
            '<code>migrate_pool_coin_creator</code>.';

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
        return;
    }

    const input = parts[0];

    // Validate: must be a Solana base58 address (32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) {
        await ctx.reply(
            '❌ Invalid address. Provide a Solana base58-encoded mint or wallet address (32-44 characters).',
        );
        return;
    }

    // Search recent CTO events for this address (as mint, signer, or new creator)
    const recentEvents = monitor.getRecentCtoEvents();
    const inputLower = input.toLowerCase();
    const matching = recentEvents.filter(
        (evt) =>
            evt.tokenMint.toLowerCase() === inputLower ||
            evt.signerWallet.toLowerCase() === inputLower ||
            (evt.newCreatorWallet && evt.newCreatorWallet.toLowerCase() === inputLower),
    );

    if (matching.length === 0) {
        const shortAddr = `${input.slice(0, 6)}...${input.slice(-4)}`;
        await ctx.reply(
            `🔍 <b>No CTO Events Found</b>\n\n` +
            `No recent creator change events involving <code>${shortAddr}</code>.\n\n` +
            `This address hasn't appeared as a signer, new creator, or token mint in any ` +
            `detected CTO transactions since the monitor started.\n\n` +
            `💡 <b>Tip:</b> Add it to your watch list to get notified when CTO events occur:\n` +
            `<code>/watch ${input}</code>`,
            { parse_mode: 'HTML' },
        );
        return;
    }

    // Determine the role of this address
    const asMint = matching.filter((e) => e.tokenMint.toLowerCase() === inputLower);
    const asSigner = matching.filter((e) => e.signerWallet.toLowerCase() === inputLower);
    const asNewCreator = matching.filter(
        (e) => e.newCreatorWallet && e.newCreatorWallet.toLowerCase() === inputLower,
    );

    const shortAddr = `${input.slice(0, 6)}...${input.slice(-4)}`;
    let msg = `🔀 <b>CTO Events for <code>${shortAddr}</code></b>\n\n`;

    if (asMint.length > 0) {
        msg += `🪙 <b>As Token Mint:</b> ${asMint.length} event(s)\n`;
    }
    if (asSigner.length > 0) {
        msg += `✍️ <b>As Signer/Authority:</b> ${asSigner.length} event(s)\n`;
    }
    if (asNewCreator.length > 0) {
        msg += `🆕 <b>As New Creator:</b> ${asNewCreator.length} event(s)\n`;
    }

    msg += '\n';

    for (const evt of matching.slice(0, 8)) {
        const shortSigner = `${evt.signerWallet.slice(0, 6)}...${evt.signerWallet.slice(-4)}`;
        const shortNew = evt.newCreatorWallet
            ? `${evt.newCreatorWallet.slice(0, 6)}...${evt.newCreatorWallet.slice(-4)}`
            : '<i>from metadata</i>';
        const shortMint = evt.tokenMint
            ? `${evt.tokenMint.slice(0, 6)}...${evt.tokenMint.slice(-4)}`
            : 'unknown';
        const time = new Date(evt.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19);
        const program = evt.programId?.includes('pAMM') ? 'PumpSwap' : 'Pump';

        msg += `📝 <b>${escapeHtml(evt.changeLabel)}</b>\n` +
            `  👤 Signer: <code>${shortSigner}</code>\n` +
            `  🆕 New Creator: <code>${shortNew}</code>\n` +
            `  🪙 Mint: <code>${shortMint}</code>\n` +
            `  ⚙️ Program: ${program}\n` +
            `  🕐 ${time} UTC\n` +
            `  🔗 <a href="https://solscan.io/tx/${evt.txSignature}">View TX</a>` +
            (evt.tokenMint ? ` · <a href="https://pump.fun/coin/${evt.tokenMint}">pump.fun</a>` : '') +
            '\n\n';
    }

    if (matching.length > 8) {
        msg += `<i>... and ${matching.length - 8} more event(s)</i>\n`;
    }

    await ctx.reply(msg, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
    });
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
    launchMonitor?: TokenLaunchMonitorLike,
): Promise<void> {
    const watches = getWatchesForChat(ctx.chat!.id);
    const state = monitor.getState();
    const launchState = launchMonitor?.getState();
    const activeMonitors = getActiveMonitorCount();
    await ctx.reply(
        formatStatus(state, watches.length, launchState, activeMonitors),
        { parse_mode: 'HTML' },
    );
}

// ============================================================================
// /monitor [github]
// ============================================================================

async function handleMonitor(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1); // strip /monitor
    const githubOnly = parts.some((p) => p.toLowerCase() === 'github');

    const existing = getMonitorEntry(ctx.chat!.id);
    const wasActive = existing?.active ?? false;

    activateMonitor(ctx.chat!.id, ctx.from!.id, githubOnly);
    const activeCount = getActiveMonitorCount();

    if (wasActive) {
        log.info(
            'Monitor filter updated for chat %d: githubOnly=%s',
            ctx.chat!.id,
            githubOnly,
        );
    } else {
        log.info(
            'Monitor activated for chat %d: githubOnly=%s',
            ctx.chat!.id,
            githubOnly,
        );
    }

    await ctx.reply(formatMonitorActivated(githubOnly, activeCount), { parse_mode: 'HTML' });
}

// ============================================================================
// /stopmonitor
// ============================================================================

async function handleStopMonitor(ctx: Context): Promise<void> {
    const wasActive = isMonitorActive(ctx.chat!.id);

    if (!wasActive) {
        await ctx.reply(
            'ℹ️ Token launch monitor is not active in this chat.\n' +
            'Start it with: /monitor',
            { parse_mode: 'HTML' },
        );
        return;
    }

    deactivateMonitor(ctx.chat!.id);
    log.info('Monitor stopped by user for chat %d', ctx.chat!.id);
    await ctx.reply(formatMonitorDeactivated(), { parse_mode: 'HTML' });
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

/**
 * Called by the monitor when a creator change (CTO) is detected.
 * Finds matching watches (by signer or new creator wallet) and
 * sends notifications to the appropriate chats.
 */
export function createCreatorChangeHandler(bot: Bot) {
    return async (event: CreatorChangeEvent): Promise<void> => {
        // Match watches against the signer, the new creator, or both
        const signerWatches = findMatchingWatches(event.signerWallet);
        const newCreatorWatches = event.newCreatorWallet
            ? findMatchingWatches(event.newCreatorWallet)
            : [];

        // Deduplicate by watch ID (in case same wallet is both signer and new creator)
        const seen = new Set<string>();
        const allWatches = [...signerWatches, ...newCreatorWatches].filter((w) => {
            if (seen.has(w.id)) return false;
            seen.add(w.id);
            return true;
        });

        if (allWatches.length === 0) {
            log.debug(
                'Creator change by %s — no matching watches',
                event.signerWallet.slice(0, 8),
            );
            return;
        }

        log.info(
            'Sending %d CTO notifications for tx %s',
            allWatches.length,
            event.txSignature.slice(0, 12),
        );

        for (const watch of allWatches) {
            try {
                const text = formatCreatorChangeNotification(event, watch);
                await bot.api.sendMessage(watch.chatId, text, {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                });
            } catch (err) {
                log.error(
                    'Failed to send CTO notification to chat %d:',
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

// NOTE: escapeHtml is imported from formatters.ts — no duplicate needed here
