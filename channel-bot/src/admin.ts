/**
 * PumpFun Channel Bot — Admin Commands
 *
 * Runtime controls over Telegram DM, restricted to ADMIN_USER_IDS.
 * The channel feed itself stays broadcast-only; these commands let the
 * operator inspect and steer the bot without a redeploy:
 *
 *   /status            — uptime, mode, feeds, counters
 *   /feeds             — list feed toggles
 *   /feeds <name> on|off — flip a feed at runtime
 *   /threshold <sol>   — set the whale alert threshold
 *   /mute <minutes>    — pause channel posting (monitoring continues)
 *   /unmute            — resume posting
 *   /recent [n]        — last n events (default 5)
 *   /help              — command list
 */

import type { Bot, Context } from 'grammy';

import type { ChannelBotConfig } from './config.js';
import type { EventStore } from './event-store.js';
import type { PerformanceTracker } from './performance-tracker.js';
import type { WebhookDispatcher } from './webhooks.js';
import { log } from './logger.js';

export interface RuntimeState {
    /** Unix ms until which channel posting is muted; 0 = not muted */
    muteUntil: number;
    /** Messages actually posted to the channel */
    posted: number;
    /** Description of the active monitor transport */
    getMode: () => string;
    /** Channel delivery health, when a reporter is wired */
    getDelivery?: () => { healthy: boolean; fault?: string; fix?: string; failures: number };
}

export interface AdminContext {
    config: ChannelBotConfig;
    state: RuntimeState;
    store: EventStore;
    webhooks: WebhookDispatcher;
    startedAt: number;
    performance?: PerformanceTracker;
}

const FEED_NAMES = ['claims', 'creatorClaims', 'launches', 'graduations', 'whales', 'feeDistributions'] as const;
type FeedName = (typeof FEED_NAMES)[number];

export function isMuted(state: RuntimeState): boolean {
    return state.muteUntil > Date.now();
}

function formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
}

export function registerAdminCommands(bot: Bot, ctx: AdminContext): void {
    const { config } = ctx;

    if (config.adminUserIds.length === 0) {
        log.info('Admin commands disabled (set ADMIN_USER_IDS to enable)');
        return;
    }

    // Gate every command to the allowlist; ignore everyone else silently.
    bot.use(async (c: Context, next: () => Promise<void>) => {
        const from = c.from?.id;
        if (from === undefined || !config.adminUserIds.includes(from)) return;
        // Only react in private chats so group noise never triggers commands
        if (c.chat?.type !== 'private') return;
        await next();
    });

    bot.command('status', async (c: Context) => {
        const feeds = FEED_NAMES
            .map((f) => `${config.feed[f] ? '🟢' : '⚫'} ${f}`)
            .join('\n');
        const counts = Object.entries(ctx.store.counters)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
        const muted = isMuted(ctx.state)
            ? `🔇 muted for ${Math.ceil((ctx.state.muteUntil - Date.now()) / 60_000)}m`
            : '🔊 posting';
        const webhookLine = ctx.webhooks.enabled
            ? `\nWebhooks: ${ctx.webhooks.stats.delivered} delivered, ${ctx.webhooks.stats.failed} failed`
            : '';
        const perf = ctx.performance;
        const perfLine = perf
            ? `\nOpen calls: ${perf.activeCount} (${perf.stats.milestonesPosted} milestones, ` +
              `${perf.stats.collapsesPosted} collapses, ${perf.stats.devDumpsPosted} dev sells)`
            : '';
        const health = ctx.state.getDelivery?.();
        const deliveryLine = health && !health.healthy
            ? `\n\n⚠️ <b>Delivery blocked</b> (${health.fault}, ${health.failures} failures)\n${health.fix ?? ''}`
            : '';
        await c.reply(
            `<b>Channel bot status</b>\n` +
            `Channel: ${config.channelId}\n` +
            `Uptime: ${formatUptime(Date.now() - ctx.startedAt)}\n` +
            `Transport: ${ctx.state.getMode()}\n` +
            `State: ${muted}\n` +
            `Posted: ${ctx.state.posted}\n` +
            `Whale threshold: ${config.whaleThresholdSol} SOL\n` +
            `Events seen: ${counts}\n` +
            `API subscribers: ${ctx.store.subscriberCount}${perfLine}${webhookLine}\n\n${feeds}${deliveryLine}`,
            { parse_mode: 'HTML' },
        );
    });

    bot.command('feeds', async (c: Context) => {
        const parts = (c.match as string | undefined)?.trim().split(/\s+/).filter(Boolean) ?? [];
        if (parts.length === 2) {
            const [name, value] = parts as [string, string];
            const feed = FEED_NAMES.find((f) => f.toLowerCase() === name.toLowerCase());
            if (!feed || !['on', 'off'].includes(value.toLowerCase())) {
                await c.reply(`Usage: /feeds <${FEED_NAMES.join('|')}> <on|off>`);
                return;
            }
            const enabled = value.toLowerCase() === 'on';
            if (config.profile) {
                // A profile is the whole point: one word that says what this
                // channel carries. Letting a DM widen it is how the first-claims
                // feed ended up posting routine payouts.
                await c.reply(
                    `🔒 This deployment runs the "${config.profile}" profile, which pins every feed. ` +
                    `Change FEED_PROFILE and redeploy to alter what it posts.`,
                );
                return;
            }
            if (feed === 'claims' && enabled && !config.feed.claims) {
                // The claim monitor bootstraps a large on-chain index at startup,
                // so it only runs when claims were enabled at boot.
                await c.reply('⚠️ The claims monitor only starts at boot. Set FEED_CLAIMS=true and restart to enable it.');
                return;
            }
            (config.feed as Record<FeedName, boolean>)[feed] = enabled;
            log.info('Admin %d set feed %s → %s', c.from?.id, feed, enabled ? 'on' : 'off');
            await c.reply(`${enabled ? '🟢' : '⚫'} ${feed} is now ${enabled ? 'on' : 'off'}`);
            return;
        }
        const lines = FEED_NAMES.map((f) => `${config.feed[f] ? '🟢' : '⚫'} ${f}`).join('\n');
        await c.reply(`${lines}\n\nToggle with: /feeds <name> <on|off>`);
    });

    bot.command('threshold', async (c: Context) => {
        const arg = (c.match as string | undefined)?.trim();
        const sol = Number.parseFloat(arg ?? '');
        if (!arg || !Number.isFinite(sol) || sol <= 0) {
            await c.reply(`Whale threshold is ${config.whaleThresholdSol} SOL.\nSet with: /threshold <sol>`);
            return;
        }
        config.whaleThresholdSol = sol;
        log.info('Admin %d set whale threshold → %s SOL', c.from?.id, sol);
        await c.reply(`🐋 Whale threshold set to ${sol} SOL`);
    });

    bot.command('mute', async (c: Context) => {
        const arg = (c.match as string | undefined)?.trim();
        const minutes = Number.parseInt(arg || '60', 10);
        if (!Number.isFinite(minutes) || minutes <= 0) {
            await c.reply('Usage: /mute <minutes>');
            return;
        }
        ctx.state.muteUntil = Date.now() + minutes * 60_000;
        log.info('Admin %d muted posting for %dm', c.from?.id, minutes);
        await c.reply(`🔇 Posting muted for ${minutes}m. Monitoring continues; /unmute to resume.`);
    });

    bot.command('unmute', async (c: Context) => {
        ctx.state.muteUntil = 0;
        log.info('Admin %d unmuted posting', c.from?.id);
        await c.reply('🔊 Posting resumed.');
    });

    bot.command('recent', async (c: Context) => {
        const arg = (c.match as string | undefined)?.trim();
        const n = Math.min(Number.parseInt(arg || '5', 10) || 5, 20);
        const events = ctx.store.recent(n);
        if (events.length === 0) {
            await c.reply('No events recorded yet.');
            return;
        }
        const lines = events.map((e) => {
            const age = Math.floor((Date.now() - e.receivedAt) / 1000);
            const ageStr = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`;
            return `${e.posted ? '✅' : '·'} [${e.kind}] ${e.summary} (${ageStr} ago)`;
        });
        await c.reply(lines.join('\n'));
    });

    bot.command('calls', async (c: Context) => {
        const perf = ctx.performance;
        if (!perf) {
            await c.reply('Call follow-ups are disabled (PERFORMANCE_UPDATES=false).');
            return;
        }
        const open = perf.openCalls();
        if (open.length === 0) {
            await c.reply('No open calls being tracked right now.');
            return;
        }
        const lines = open.slice(0, 20).map((p) => {
            const ageMin = Math.floor((Date.now() - p.postedAt) / 60_000);
            const hit = p.announced.length > 0 ? ` [${Math.max(...p.announced)}x hit]` : '';
            return `$${p.symbol} — ${ageMin}m ago${hit}`;
        });
        const more = open.length > 20 ? `\n<i>... +${open.length - 20} more</i>` : '';
        await c.reply(`<b>Open calls (${open.length})</b>\n${lines.join('\n')}${more}`, { parse_mode: 'HTML' });
    });

    bot.command('help', async (c: Context) => {
        await c.reply(
            '/status — uptime, transport, counters\n' +
            '/feeds — list or toggle feeds\n' +
            '/threshold <sol> — whale alert threshold\n' +
            '/mute <minutes> — pause posting\n' +
            '/unmute — resume posting\n' +
            '/recent [n] — last n events\n' +
            '/calls — open calls being tracked for follow-ups',
        );
    });

    log.info('Admin commands enabled for %d user(s)', config.adminUserIds.length);
}
