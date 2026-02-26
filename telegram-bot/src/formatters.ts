/**
 * PumpFun Telegram Bot — Message Formatters
 *
 * Rich HTML message formatting for Telegram notifications.
 */

import type { FeeClaimEvent, MonitorState, WatchEntry } from './types.js';

// ============================================================================
// Fee Claim Notification
// ============================================================================

export function formatClaimNotification(
    event: FeeClaimEvent,
    watch: WatchEntry,
): string {
    const emoji = event.isCashback ? '💸' : '🏦';
    const typeLabel = event.claimLabel || (event.isCashback ? 'Cashback Claim' : 'Creator Fee Claim');

    const shortWallet = shortAddr(event.claimerWallet);
    const solAmount = event.amountSol.toFixed(4);

    const tokenLine = event.tokenSymbol
        ? `<b>Token:</b> ${escapeHtml(event.tokenSymbol)}${event.tokenName ? ` (${escapeHtml(event.tokenName)})` : ''}`
        : event.tokenMint
            ? `<b>Token Mint:</b> <code>${event.tokenMint.slice(0, 12)}...${event.tokenMint.slice(-6)}</code>`
            : '<b>Token:</b> <i>unknown</i>';

    const labelLine = watch.label ? `\n📛 <b>Label:</b> ${escapeHtml(watch.label)}` : '';

    // Program source
    const programLabel = event.programId?.includes('pAMM') ? 'PumpSwap AMM' : 'Pump';

    const solscanTx = `https://solscan.io/tx/${event.txSignature}`;
    const solscanWallet = `https://solscan.io/account/${event.claimerWallet}`;
    const pumpfunToken = event.tokenMint
        ? `https://pump.fun/coin/${event.tokenMint}`
        : '';

    let links = `🔗 <a href="${solscanTx}">View TX</a> · <a href="${solscanWallet}">Wallet</a>`;
    if (pumpfunToken) {
        links += ` · <a href="${pumpfunToken}">pump.fun</a>`;
    }

    return (
        `${emoji} <b>${typeLabel} Detected!</b>\n\n` +
        `👤 <b>Claimer:</b> <code>${shortWallet}</code>${labelLine}\n` +
        `💰 <b>Amount:</b> ${solAmount} SOL\n` +
        `${tokenLine}\n` +
        `⚙️ <b>Program:</b> ${programLabel}\n` +
        `🕐 <b>Time:</b> ${formatTime(event.timestamp)}\n\n` +
        `${links}`
    );
}

// ============================================================================
// Watch List
// ============================================================================

export function formatWatchList(watches: WatchEntry[]): string {
    if (watches.length === 0) {
        return (
            '📋 <b>No active watches</b>\n\n' +
            'Add one with:\n' +
            '<code>/watch &lt;wallet_address&gt; [label]</code>'
        );
    }

    const lines = watches.map((w, i) => {
        const label = w.label ? ` (${escapeHtml(w.label)})` : '';
        const short = shortAddr(w.recipientWallet);
        return `${i + 1}. <code>${short}</code>${label}`;
    });

    return (
        `📋 <b>Active Watches (${watches.length})</b>\n\n` +
        lines.join('\n') +
        '\n\nRemove with: <code>/unwatch &lt;wallet_or_number&gt;</code>'
    );
}

// ============================================================================
// Status
// ============================================================================

export function formatStatus(state: MonitorState, watchCount: number): string {
    const uptime = state.startedAt
        ? formatDuration(Date.now() - state.startedAt)
        : 'not started';

    const programNames = (state.monitoredPrograms || []).map((p) =>
        p.includes('pAMM') ? 'PumpSwap' : 'Pump',
    ).join(', ') || 'N/A';

    return (
        `📊 <b>PumpFun Fee Monitor Status</b>\n\n` +
        `⚡ <b>Running:</b> ${state.isRunning ? '✅ Yes' : '❌ No'}\n` +
        `🔌 <b>Mode:</b> ${state.mode}\n` +
        `📡 <b>Programs:</b> ${programNames}\n` +
        `👁️ <b>Watches:</b> ${watchCount}\n` +
        `🔔 <b>Claims Detected:</b> ${state.claimsDetected}\n` +
        `  🏦 Creator Fees: ${state.creatorFeeClaims || 0}\n` +
        `  💸 Cashback: ${state.cashbackClaims || 0}\n` +
        `📦 <b>Last Slot:</b> ${state.lastSlot || 'N/A'}\n` +
        `⏱️ <b>Uptime:</b> ${uptime}`
    );
}

// ============================================================================
// Help
// ============================================================================

export function formatHelp(): string {
    return (
        `🤖 <b>PumpFun Fee Claim Bot</b>\n\n` +
        `Monitor when PumpFun creator fees or cashback rewards are claimed on Solana.\n\n` +
        `<b>Commands:</b>\n` +
        `/watch <code>&lt;wallet&gt;</code> <code>[label]</code> — Watch a fee recipient wallet\n` +
        `/unwatch <code>&lt;wallet_or_#&gt;</code> — Stop watching a wallet\n` +
        `/list — Show all active watches\n` +
        `/status — Monitor status & stats\n` +
        `/help — Show this help\n\n` +
        `<b>How it works:</b>\n` +
        `1. Add a fee-recipient wallet address with /watch\n` +
        `2. The bot monitors PumpFun on-chain for fee claims\n` +
        `3. When that wallet claims creator fees or cashback, you get notified instantly\n\n` +
        `<b>Works in:</b> DMs and group chats\n` +
        `<b>Supports:</b> Creator Fees + Cashback Coins (Pump + PumpSwap AMM)`
    );
}

// ============================================================================
// Welcome
// ============================================================================

export function formatWelcome(name: string): string {
    return (
        `👋 <b>Welcome, ${escapeHtml(name)}!</b>\n\n` +
        `I monitor PumpFun on Solana and notify you when creator fees ` +
        `or cashback rewards are claimed.\n\n` +
        `Get started:\n` +
        `<code>/watch &lt;wallet_address&gt; [label]</code>\n\n` +
        `Type /help for all commands.`
    );
}

// ============================================================================
// Utilities
// ============================================================================

function shortAddr(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}
