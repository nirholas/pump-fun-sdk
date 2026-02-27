/**
 * PumpFun Telegram Bot — Message Formatters
 *
 * Rich HTML message formatting for Telegram notifications.
 */

import type { CreatorChangeEvent, FeeClaimEvent, MonitorState, TokenLaunchEvent, TokenLaunchMonitorState, WatchEntry } from './types.js';

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
// Creator Change (CTO) Notification
// ============================================================================

export function formatCreatorChangeNotification(
    event: CreatorChangeEvent,
    watch: WatchEntry,
): string {
    const shortSigner = shortAddr(event.signerWallet);
    const shortNewCreator = event.newCreatorWallet
        ? shortAddr(event.newCreatorWallet)
        : '<i>from metadata</i>';

    const labelLine = watch.label ? `\n📛 <b>Label:</b> ${escapeHtml(watch.label)}` : '';

    const programLabel = event.programId?.includes('pAMM') ? 'PumpSwap AMM' : 'Pump';

    const tokenLine = event.tokenMint
        ? `<b>Token Mint:</b> <code>${event.tokenMint.slice(0, 12)}...${event.tokenMint.slice(-6)}</code>`
        : '<b>Token:</b> <i>unknown</i>';

    const solscanTx = `https://solscan.io/tx/${event.txSignature}`;
    const solscanSigner = `https://solscan.io/account/${event.signerWallet}`;
    const solscanNew = event.newCreatorWallet
        ? `https://solscan.io/account/${event.newCreatorWallet}`
        : '';
    const pumpfunToken = event.tokenMint
        ? `https://pump.fun/coin/${event.tokenMint}`
        : '';

    let links = `🔗 <a href="${solscanTx}">View TX</a> · <a href="${solscanSigner}">Signer</a>`;
    if (solscanNew) {
        links += ` · <a href="${solscanNew}">New Creator</a>`;
    }
    if (pumpfunToken) {
        links += ` · <a href="${pumpfunToken}">pump.fun</a>`;
    }

    // Determine relationship to watched wallet
    const watchedAddr = watch.recipientWallet.toLowerCase();
    let relationship = '';
    if (event.newCreatorWallet && event.newCreatorWallet.toLowerCase() === watchedAddr) {
        relationship = '\n✅ <b>Your watched wallet is the NEW fee recipient</b>';
    } else if (event.signerWallet.toLowerCase() === watchedAddr) {
        relationship = '\n⚠️ <b>Your watched wallet initiated this change</b>';
    } else {
        relationship = '\n🔄 <b>Fees for this token are being redirected</b>';
    }

    return (
        `🔀 <b>Creator Change (CTO) Detected!</b>\n\n` +
        `📝 <b>Type:</b> ${event.changeLabel}\n` +
        `👤 <b>Signer:</b> <code>${shortSigner}</code>${labelLine}\n` +
        `🆕 <b>New Creator:</b> <code>${shortNewCreator}</code>\n` +
        `${tokenLine}\n` +
        `⚙️ <b>Program:</b> ${programLabel}\n` +
        `🕐 <b>Time:</b> ${formatTime(event.timestamp)}\n` +
        `${relationship}\n\n` +
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

export function formatStatus(
    state: MonitorState,
    watchCount: number,
    launchState?: TokenLaunchMonitorState,
    activeMonitorCount?: number,
): string {
    const uptime = state.startedAt
        ? formatDuration(Date.now() - state.startedAt)
        : 'not started';

    const programNames = (state.monitoredPrograms || []).map((p) =>
        p.includes('pAMM') ? 'PumpSwap' : 'Pump',
    ).join(', ') || 'N/A';

    let text =
        `📊 <b>PumpFun Fee Monitor Status</b>\n\n` +
        `⚡ <b>Running:</b> ${state.isRunning ? '✅ Yes' : '❌ No'}\n` +
        `🔌 <b>Mode:</b> ${state.mode}\n` +
        `📡 <b>Programs:</b> ${programNames}\n` +
        `👁️ <b>Watches:</b> ${watchCount}\n` +
        `🔔 <b>Claims Detected:</b> ${state.claimsDetected}\n` +
        `  🏦 Creator Fees: ${state.creatorFeeClaims || 0}\n` +
        `  💸 Cashback: ${state.cashbackClaims || 0}\n` +
        `  🔀 Creator Changes (CTO): ${state.creatorChanges || 0}\n` +
        `📦 <b>Last Slot:</b> ${state.lastSlot || 'N/A'}\n` +
        `⏱️ <b>Uptime:</b> ${uptime}`;

    if (launchState) {
        text += `\n\n${formatMonitorStatus(launchState, activeMonitorCount)}`;
    }

    return text;
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
        `� <b>Creator Takeover (CTO):</b>\n` +
        `/cto — Show CTO stats & recent events\n` +
        `/cto <code>&lt;mint_or_wallet&gt;</code> — Look up CTO events for a token or wallet\n\n` +
        `�📡 <b>Launch Monitor:</b>\n` +
        `/monitor <code>[github]</code> — Start real-time token launch feed\n` +
        `/stopmonitor — Stop the launch feed\n\n` +
        `<b>How it works:</b>\n` +
        `1. Add a fee-recipient wallet address with /watch\n` +
        `2. The bot monitors PumpFun on-chain for fee claims and creator changes\n` +
        `3. When that wallet claims creator fees or cashback, you get notified instantly\n` +
        `4. When creator fees are redirected (CTO) involving a watched wallet, you get alerted\n\n` +
        `<b>Works in:</b> DMs and group chats\n` +
        `<b>Supports:</b> Creator Fees + Cashback Coins + CTO Alerts (Pump + PumpSwap AMM)`
    );
}

// ============================================================================
// Welcome
// ============================================================================

export function formatWelcome(name: string): string {
    return (
        `👋 <b>Welcome, ${escapeHtml(name)}!</b>\n\n` +
        `I monitor PumpFun on Solana and notify you when creator fees ` +
        `or cashback rewards are claimed, and when creator fees are redirected (CTO).\n\n` +
        `Get started:\n` +
        `<code>/watch &lt;wallet_address&gt; [label]</code>\n\n` +
        `Type /help for all commands.`
    );
}

// ============================================================================
// Token Launch Notifications
// ============================================================================

/** Rich HTML notification for a new token launch. */
export function formatTokenLaunchNotification(event: TokenLaunchEvent): string {
    const name = event.name ? escapeHtml(event.name) : 'Unknown';
    const symbol = event.symbol ? escapeHtml(event.symbol) : '???';
    const creator = shortAddr(event.creatorWallet);
    const mint = shortAddr(event.mintAddress);

    const solscanTx = `https://solscan.io/tx/${event.txSignature}`;
    const solscanMint = `https://solscan.io/token/${event.mintAddress}`;
    const solscanCreator = `https://solscan.io/account/${event.creatorWallet}`;
    const pumpfun = `https://pump.fun/coin/${event.mintAddress}`;

    let githubSection = '';
    if (event.hasGithub && event.githubUrls.length > 0) {
        const githubLinks = event.githubUrls
            .map((url: string) => `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`)
            .join('\n  ');
        githubSection = `\n🌐 <b>GitHub:</b> ${githubLinks}\n`;
    }

    const mayhemIcon = event.mayhemMode ? '✅' : '❌';
    const timeStr = event.timestamp
        ? formatTime(event.timestamp)
        : new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    return (
        `🚀 <b>New Token Launched!</b>\n\n` +
        `🪙 <b>Name:</b> ${name} (${symbol})\n` +
        `👤 <b>Creator:</b> <a href="${solscanCreator}"><code>${creator}</code></a>\n` +
        `🔗 <b>Mint:</b> <a href="${solscanMint}"><code>${mint}</code></a>\n` +
        githubSection +
        `\n⚡ <b>Mayhem Mode:</b> ${mayhemIcon}\n` +
        `🕐 <b>Time:</b> ${timeStr}\n\n` +
        `🔗 <a href="${solscanTx}">View TX</a> · ` +
        `<a href="${solscanMint}">Solscan</a> · ` +
        `<a href="${pumpfun}">pump.fun</a>`
    );
}

/** Confirmation message when /monitor is activated. */
export function formatMonitorActivated(githubOnly: boolean, activeCount: number): string {
    const mode = githubOnly ? 'GitHub-linked only' : 'All launches';
    return (
        `✅ <b>Token Launch Monitor Activated!</b>\n\n` +
        `<b>Mode:</b> ${mode}\n` +
        `<b>Active subscribers:</b> ${activeCount}\n\n` +
        `You'll receive real-time notifications for new PumpFun token launches.\n\n` +
        `💡 Switch mode: <code>/monitor</code> (all) or <code>/monitor github</code> (filtered)\n` +
        `Stop with: /stopmonitor`
    );
}

/** Confirmation message when /stopmonitor is used. */
export function formatMonitorDeactivated(): string {
    return (
        `⏹️ <b>Token Launch Monitor Stopped</b>\n\n` +
        `No more launch notifications will be sent to this chat.\n` +
        `Re-enable with: /monitor`
    );
}

/** Stats display for the token launch monitor. */
export function formatMonitorStatus(state: TokenLaunchMonitorState, activeSubscribers?: number): string {
    const uptime = state.startedAt
        ? formatDuration(Date.now() - state.startedAt)
        : 'not started';

    const githubPct = state.tokensDetected > 0
        ? ` (${((state.tokensWithGithub / state.tokensDetected) * 100).toFixed(1)}%)`
        : '';

    let text =
        `📡 <b>Token Launch Monitor</b>\n` +
        `⚡ <b>Running:</b> ${state.isRunning ? '✅ Yes' : '❌ No'}\n` +
        `🔌 <b>Mode:</b> ${state.mode}\n` +
        `🚀 <b>Tokens Detected:</b> ${state.tokensDetected}\n` +
        `🌐 <b>With GitHub:</b> ${state.tokensWithGithub}${githubPct}\n` +
        `📦 <b>Last Slot:</b> ${state.lastSlot || 'N/A'}\n` +
        `⏱️ <b>Uptime:</b> ${uptime}`;

    if (activeSubscribers !== undefined) {
        text += `\n👥 <b>Subscribers:</b> ${activeSubscribers}`;
    }

    return text;
}

// ============================================================================
// Utilities
// ============================================================================

export function shortAddr(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function escapeHtml(text: string): string {
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
