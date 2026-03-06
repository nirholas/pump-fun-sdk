/**
 * PumpFun Telegram Bot — Message Formatters
 *
 * Rich HTML message formatting for Telegram notifications.
 */

import type { CreatorChangeEvent, FeeClaimEvent, FeeDistributionEvent, GraduationEvent, MonitorState, PumpEventMonitorState, TokenLaunchEvent, TokenLaunchMonitorState, TradeAlertEvent, WatchEntry } from './types.js';
import type { FeeTierInfo, PumpTokenInfo, QuoteResult } from './pump-client.js';
import { formatSol, formatTokenAmount } from './pump-client.js';

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

    // CA line
    const mint = event.tokenMint?.trim() || '';
    let caLine = '';
    if (mint) {
        caLine = `\n🧬 <b>CA:</b> <code>${mint}</code>`;
    } else if (event.claimType === 'claim_social_fee_pda' || event.claimType === 'claim_cashback' || event.claimType === 'collect_creator_fee') {
        caLine = `\n🧬 <b>CA:</b> <i>N/A (wallet-level claim)</i>`;
    }
    if (event.socialFeePda) {
        caLine += `\n🧾 <b>Social PDA:</b> <code>${shortAddr(event.socialFeePda)}</code>`;
    }

    const solscanTx = `https://solscan.io/tx/${event.txSignature}`;
    const solscanWallet = `https://solscan.io/account/${event.claimerWallet}`;
    const pumpfunToken = mint ? `https://pump.fun/coin/${mint}` : null;

    const links = pumpfunToken
        ? `🔗 <a href="${solscanTx}">View TX</a> · <a href="${solscanWallet}">Wallet</a> · <a href="${pumpfunToken}">pump.fun</a>`
        : `🔗 <a href="${solscanTx}">View TX</a> · <a href="${solscanWallet}">Wallet</a>`;

    return (
        `${emoji} <b>${typeLabel} Detected!</b>\n\n` +
        `👤 <b>Claimer:</b> <code>${shortWallet}</code>${labelLine}\n` +
        `💰 <b>Amount:</b> ${solAmount} SOL\n` +
        `${tokenLine}` +
        `${caLine}\n` +
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

    const mint = event.tokenMint?.trim() || '';
    const tokenLine = event.tokenSymbol
        ? `<b>Token:</b> ${escapeHtml(event.tokenSymbol)}${event.tokenName ? ` (${escapeHtml(event.tokenName)})` : ''}`
        : mint
            ? `<b>Token:</b> <code>${shortAddr(mint)}</code>`
            : '<b>Token:</b> <i>unknown</i>';
    const caLine = mint ? `\n🧬 <b>CA:</b> <code>${mint}</code>` : '';

    const solscanTx = `https://solscan.io/tx/${event.txSignature}`;
    const solscanSigner = `https://solscan.io/account/${event.signerWallet}`;
    const solscanNew = event.newCreatorWallet
        ? `https://solscan.io/account/${event.newCreatorWallet}`
        : '';
    const pumpfunToken = mint ? `https://pump.fun/coin/${mint}` : null;

    const links = pumpfunToken
        ? `🔗 <a href="${solscanTx}">View TX</a> · <a href="${solscanSigner}">Signer</a>` +
          (solscanNew ? ` · <a href="${solscanNew}">New Creator</a>` : '') +
          ` · <a href="${pumpfunToken}">pump.fun</a>`
        : `🔗 <a href="${solscanTx}">View TX</a> · <a href="${solscanSigner}">Signer</a>` +
          (solscanNew ? ` · <a href="${solscanNew}">New Creator</a>` : '');

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
        `${tokenLine}` +
        `${caLine}\n` +
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
    eventState?: PumpEventMonitorState,
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

    if (eventState) {
        text += `\n\n${formatEventMonitorStatus(eventState)}`;
    }

    return text;
}

// ============================================================================
// Help
// ============================================================================

export function formatHelp(): string {
    return (
        `🤖 <b>PumpFun Monitor</b>\n\n` +
        `Real-time PumpFun intelligence on Solana.\n\n` +
        `📊 <b>Token Analytics:</b>\n` +
        `/price <code>&lt;mint&gt;</code> — Token price, market cap &amp; curve status\n` +
        `/curve <code>&lt;mint&gt;</code> — Alias for /price\n` +
        `/balance <code>&lt;mint&gt;</code> <code>&lt;wallet&gt;</code> — Check token balance\n` +
        `/graduated <code>&lt;mint&gt;</code> — Check AMM graduation status\n` +
        `/impact <code>&lt;mint&gt;</code> <code>&lt;sol_amount&gt;</code> — Calculate buy price impact\n` +
        `/fees <code>&lt;mint&gt;</code> — Fee tiers for a token\n` +
        `/rewards <code>&lt;mint&gt;</code> <code>&lt;wallet&gt;</code> — Check unclaimed volume rewards\n` +
        `/quote <code>buy|sell</code> <code>&lt;mint&gt;</code> <code>&lt;amount&gt;</code> — Buy/sell quote estimate\n\n` +
        `👁 <b>Wallet Monitoring:</b>\n` +
        `/watch <code>&lt;wallet&gt;</code> <code>[label]</code> — Watch a fee recipient wallet\n` +
        `/unwatch <code>&lt;wallet_or_#&gt;</code> — Stop watching a wallet\n` +
        `/list — Show all active watches\n` +
        `/status — Monitor status &amp; stats\n\n` +
        `🔀 <b>Creator Takeover (CTO):</b>\n` +
        `/cto — Show CTO stats &amp; recent events\n` +
        `/cto <code>&lt;mint_or_wallet&gt;</code> — Look up CTO events\n\n` +
        `🔔 <b>Alert Preferences:</b>\n` +
        `/alerts — View current alert settings\n` +
        `/alerts <code>&lt;type&gt;</code> <code>on|off</code> — Toggle an alert type\n` +
        `/alerts <code>all on|off</code> — Toggle all alerts\n` +
        `  Types: <code>launches</code>, <code>graduations</code>, <code>whales</code>, <code>fees</code>\n\n` +
        `📡 <b>Launch Monitor:</b>\n` +
        `/monitor <code>[github]</code> — Start real-time token launch feed\n` +
        `/stopmonitor — Stop the launch feed\n\n` +
        `<b>How it works:</b>\n` +
        `1. /watch a wallet → get notified on fee claims &amp; CTO events\n` +
        `2. /monitor → live token launches, graduations, whale trades\n` +
        `3. /alerts → customize which notifications you receive\n` +
        `4. /price /balance /graduated /impact → instant token lookups\n\n` +
        `<b>Works in:</b> DMs and group chats`
    );
}

// ============================================================================
// Welcome
// ============================================================================

export function formatWelcome(name: string): string {
    return (
        `👋 <b>Welcome, ${escapeHtml(name)}!</b>\n\n` +
        `I'm your real-time PumpFun intelligence bot on Solana.\n\n` +
        `📊 <b>Token Analytics</b>\n` +
        `/price — Token price &amp; bonding curve\n` +
        `/balance — Check token balance\n` +
        `/graduated — AMM graduation status\n` +
        `/impact — Buy price impact calculator\n` +
        `/fees — Fee tiers &amp; uncollected fees\n` +
        `/rewards — Unclaimed volume rewards\n` +
        `/quote — Buy/sell quote estimate\n\n` +
        `👁 <b>Monitoring</b>\n` +
        `/watch — Track wallet fee claims\n` +
        `/cto — Creator takeover alerts\n` +
        `/monitor — Live token launch feed\n` +
        `/alerts — Configure notifications\n\n` +
        `Get started: <code>/watch &lt;wallet_address&gt;</code>\n` +
        `Full command list: /help`
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
    const cashbackIcon = event.cashbackEnabled ? '✅' : '❌';
    const timeStr = event.timestamp
        ? formatTime(event.timestamp)
        : new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    return (
        `🚀 <b>New Token Launched!</b>\n\n` +
        `🪙 <b>Name:</b> ${name} (${symbol})\n` +
        `👤 <b>Creator:</b> <a href="${solscanCreator}"><code>${creator}</code></a>\n` +
        `🧬 <b>CA:</b> <code>${event.mintAddress}</code>\n` +
        githubSection +
        `\n⚡ <b>Mayhem Mode:</b> ${mayhemIcon}\n` +
        `💸 <b>Cashback:</b> ${cashbackIcon}\n` +
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
// Graduation Notification
// ============================================================================

/** Rich HTML notification for a token graduating from bonding curve to AMM. */
export function formatGraduationNotification(event: GraduationEvent): string {
    const mint = shortAddr(event.mintAddress);
    const user = shortAddr(event.user);
    const timeStr = formatTime(event.timestamp);

    const solscanTx = `https://solscan.io/tx/${event.txSignature}`;
    const solscanMint = `https://solscan.io/token/${event.mintAddress}`;
    const pumpfun = `https://pump.fun/coin/${event.mintAddress}`;

    let details = '';
    if (event.isMigration) {
        details =
            `💰 <b>SOL Migrated:</b> ${event.solAmount?.toFixed(2) ?? '?'} SOL\n` +
            `🏊 <b>Migration Fee:</b> ${event.poolMigrationFee?.toFixed(4) ?? '?'} SOL\n` +
            (event.poolAddress
                ? `🔗 <b>AMM Pool:</b> <code>${shortAddr(event.poolAddress)}</code>\n`
                : '');
    }

    return (
        `🎓 <b>Token Graduated!</b>\n\n` +
        `🧬 <b>CA:</b> <code>${event.mintAddress}</code>\n` +
        `👤 <b>Triggered by:</b> <code>${user}</code>\n` +
        `📈 <b>Type:</b> ${event.isMigration ? 'AMM Migration' : 'Bonding Curve Complete'}\n` +
        details +
        `🕐 <b>Time:</b> ${timeStr}\n\n` +
        `🔗 <a href="${solscanTx}">View TX</a> · ` +
        `<a href="${solscanMint}">Solscan</a> · ` +
        `<a href="${pumpfun}">pump.fun</a>`
    );
}

// ============================================================================
// Trade Alert (Whale) Notification
// ============================================================================

/** Rich HTML notification for a large trade (whale alert). */
export function formatTradeAlertNotification(event: TradeAlertEvent): string {
    const emoji = event.isBuy ? '🟢' : '🔴';
    const action = event.isBuy ? 'BUY' : 'SELL';
    const mint = shortAddr(event.mintAddress);
    const trader = shortAddr(event.user);
    const timeStr = formatTime(event.timestamp);

    const solscanTx = `https://solscan.io/tx/${event.txSignature}`;
    const solscanMint = `https://solscan.io/token/${event.mintAddress}`;
    const solscanTrader = `https://solscan.io/account/${event.user}`;
    const pumpfun = `https://pump.fun/coin/${event.mintAddress}`;

    // Progress bar visualization (10 blocks)
    const filled = Math.round(event.bondingCurveProgress / 10);
    const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    let mayhemLine = '';
    if (event.mayhemMode) {
        mayhemLine = `⚡ <b>Mayhem Mode:</b> Active\n`;
    }

    return (
        `🐋 <b>Whale ${action}!</b>\n\n` +
        `${emoji} <b>Amount:</b> ${event.solAmount.toFixed(2)} SOL\n` +
        `� <b>CA:</b> <code>${event.mintAddress}</code>\n` +
        `👤 <b>Trader:</b> <a href="${solscanTrader}"><code>${trader}</code></a>\n` +
        `💹 <b>Market Cap:</b> ~${event.marketCapSol.toFixed(1)} SOL\n` +
        `📊 <b>Graduation:</b> [${progressBar}] ${event.bondingCurveProgress.toFixed(1)}%\n` +
        `💰 <b>Fee:</b> ${event.fee.toFixed(4)} SOL | <b>Creator Fee:</b> ${event.creatorFee.toFixed(4)} SOL\n` +
        mayhemLine +
        `🕐 <b>Time:</b> ${timeStr}\n\n` +
        `🔗 <a href="${solscanTx}">View TX</a> · ` +
        `<a href="${solscanMint}">Solscan</a> · ` +
        `<a href="${pumpfun}">pump.fun</a>`
    );
}

// ============================================================================
// Fee Distribution Notification
// ============================================================================

/** Rich HTML notification for a creator fee distribution to shareholders. */
export function formatFeeDistributionNotification(event: FeeDistributionEvent): string {
    const mint = shortAddr(event.mintAddress);
    const admin = shortAddr(event.admin);
    const timeStr = formatTime(event.timestamp);

    const solscanTx = `https://solscan.io/tx/${event.txSignature}`;
    const solscanMint = `https://solscan.io/token/${event.mintAddress}`;
    const pumpfun = `https://pump.fun/coin/${event.mintAddress}`;

    const shareholderLines = event.shareholders
        .slice(0, 5)
        .map((s) => {
            const pct = (s.shareBps / 100).toFixed(1);
            return `  • <code>${shortAddr(s.address)}</code> — ${pct}%`;
        })
        .join('\n');

    const truncated = event.shareholders.length > 5
        ? `\n  <i>... and ${event.shareholders.length - 5} more</i>`
        : '';

    return (
        `💎 <b>Creator Fees Distributed!</b>\n\n` +
        `🪙 <b>Token:</b> <a href="${solscanMint}"><code>${mint}</code></a>\n` +
        `💰 <b>Distributed:</b> ${event.distributedSol.toFixed(4)} SOL\n` +
        `👤 <b>Admin:</b> <code>${admin}</code>\n` +
        `👥 <b>Shareholders (${event.shareholders.length}):</b>\n` +
        shareholderLines + truncated +
        `\n\n🕐 <b>Time:</b> ${timeStr}\n\n` +
        `🔗 <a href="${solscanTx}">View TX</a> · ` +
        `<a href="${solscanMint}">Solscan</a> · ` +
        `<a href="${pumpfun}">pump.fun</a>`
    );
}

// ============================================================================
// Pump Event Monitor Status
// ============================================================================

/** Stats display for the pump event monitor. */
export function formatEventMonitorStatus(state: PumpEventMonitorState): string {
    const uptime = state.startedAt
        ? formatDuration(Date.now() - state.startedAt)
        : 'not started';

    return (
        `📡 <b>Event Monitor</b>\n` +
        `⚡ <b>Running:</b> ${state.isRunning ? '✅ Yes' : '❌ No'}\n` +
        `🔌 <b>Mode:</b> ${state.mode}\n` +
        `🎓 <b>Graduations:</b> ${state.graduationsDetected}\n` +
        `🐋 <b>Whale Trades:</b> ${state.whaleTradesDetected}\n` +
        `💎 <b>Fee Distributions:</b> ${state.feeDistributionsDetected}\n` +
        `⏱️ <b>Uptime:</b> ${uptime}`
    );
}

// ============================================================================
// Token Price Display
// ============================================================================

/** Rich HTML display for token price & bonding curve info. */
export function formatTokenPrice(token: PumpTokenInfo): string {
    const name = escapeHtml(token.name);
    const symbol = escapeHtml(token.symbol);
    const mint = shortAddr(token.mint);
    const creator = shortAddr(token.creator);

    const solscanMint = `https://solscan.io/token/${token.mint}`;
    const solscanCreator = `https://solscan.io/account/${token.creator}`;
    const pumpfun = `https://pump.fun/coin/${token.mint}`;

    // Progress bar (10 blocks)
    const filled = Math.round(token.curveProgress / 10);
    const progressBar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

    const stageEmoji: Record<string, string> = {
        new: '\ud83c\udf31',
        growing: '\ud83d\udcc8',
        graduating: '\ud83c\udf93',
        graduated: '\u2b50',
    };

    const priceStr = token.priceSol > 0
        ? `${token.priceSol.toFixed(token.priceSol < 0.0001 ? 10 : 6)} SOL`
        : 'N/A';

    const marketCapStr = token.usdMarketCap > 0
        ? `$${token.usdMarketCap >= 1000 ? `${(token.usdMarketCap / 1000).toFixed(1)}K` : token.usdMarketCap.toFixed(0)}`
        : `~${token.marketCapSol.toFixed(2)} SOL`;

    let socialLinks = '';
    if (token.twitter) socialLinks += ` · <a href="${token.twitter}">Twitter</a>`;
    if (token.telegram) socialLinks += ` · <a href="${token.telegram}">Telegram</a>`;
    if (token.website) socialLinks += ` · <a href="${token.website}">Website</a>`;

    const graduatedLine = token.complete
        ? `\n\u2705 <b>Graduated</b> — Trading on AMM${token.raydiumPool ? ` (<code>${shortAddr(token.raydiumPool)}</code>)` : ''}`
        : '';

    return (
        `\ud83d\udcb0 <b>Token Price: ${name} (${symbol})</b>\n\n` +
        `\ud83e\ude99 <b>Mint:</b> <a href="${solscanMint}"><code>${mint}</code></a>\n` +
        `\ud83d\udc64 <b>Creator:</b> <a href="${solscanCreator}"><code>${creator}</code></a>\n` +
        `${stageEmoji[token.stage] ?? ''} <b>Stage:</b> ${token.stage}\n\n` +
        `\ud83d\udcb5 <b>Price:</b> ${priceStr}\n` +
        `\ud83d\udcca <b>Market Cap:</b> ${marketCapStr}\n` +
        `\ud83d\udcca <b>Graduation:</b> [${progressBar}] ${token.curveProgress.toFixed(1)}%\n` +
        `\ud83d\udca7 <b>Virtual SOL:</b> ${formatSol(token.virtualSolReserves)} SOL\n` +
        `\ud83e\ude99 <b>Virtual Tokens:</b> ${formatTokenAmount(token.virtualTokenReserves)}\n` +
        graduatedLine +
        `\n\n\ud83d\udd17 <a href="${solscanMint}">Solscan</a> · <a href="${pumpfun}">pump.fun</a>${socialLinks}`
    );
}

// ============================================================================
// Buy/Sell Quote Display
// ============================================================================

/** Rich HTML display for a buy or sell quote. */
export function formatQuote(quote: QuoteResult): string {
    const token = quote.token;
    const symbol = escapeHtml(token.symbol);
    const isBuy = quote.side === 'buy';
    const emoji = isBuy ? '\ud83d\udfe2' : '\ud83d\udd34';
    const action = isBuy ? 'BUY' : 'SELL';

    const inputStr = isBuy
        ? `${formatSol(quote.inputAmount)} SOL`
        : `${formatTokenAmount(quote.inputAmount)} ${symbol}`;

    const outputStr = isBuy
        ? `${formatTokenAmount(quote.outputAmount)} ${symbol}`
        : `${formatSol(quote.outputAmount)} SOL`;

    const feeStr = `${formatSol(quote.estimatedFee)} SOL`;
    const priceBefore = quote.priceBefore.toFixed(quote.priceBefore < 0.0001 ? 10 : 6);
    const priceAfter = quote.priceAfter.toFixed(quote.priceAfter < 0.0001 ? 10 : 6);

    const impactColor = Math.abs(quote.impactBps) > 500 ? '\u26a0\ufe0f' : '';
    const impactStr = `${(quote.impactBps / 100).toFixed(2)}% ${impactColor}`;

    const solscanMint = `https://solscan.io/token/${token.mint}`;
    const pumpfun = `https://pump.fun/coin/${token.mint}`;

    return (
        `${emoji} <b>${action} Quote: ${symbol}</b>\n\n` +
        `\ud83d\udce5 <b>You ${isBuy ? 'spend' : 'sell'}:</b> ${inputStr}\n` +
        `\ud83d\udce4 <b>You ${isBuy ? 'receive' : 'get'}:</b> ${outputStr}\n` +
        `\ud83d\udcb8 <b>Est. Fee:</b> ${feeStr} (2%)\n\n` +
        `\ud83d\udcb5 <b>Price Before:</b> ${priceBefore} SOL/token\n` +
        `\ud83d\udcb5 <b>Price After:</b> ${priceAfter} SOL/token\n` +
        `\ud83d\udcca <b>Price Impact:</b> ${impactStr}\n\n` +
        `\u26a0\ufe0f <i>Estimates only. Actual amounts depend on on-chain state at execution time.</i>\n\n` +
        `\ud83d\udd17 <a href="${solscanMint}">Solscan</a> · <a href="${pumpfun}">pump.fun</a>`
    );
}

// ============================================================================
// Fee Tier Display
// ============================================================================

/** Rich HTML display of fee tiers for a specific token. */
export function formatFeeTiers(
    token: PumpTokenInfo,
    tiers: Array<FeeTierInfo & { isCurrent: boolean }>,
): string {
    const symbol = escapeHtml(token.symbol);
    const marketCapStr = token.usdMarketCap > 0
        ? `$${token.usdMarketCap >= 1000 ? `${(token.usdMarketCap / 1000).toFixed(1)}K` : token.usdMarketCap.toFixed(0)}`
        : `~${token.marketCapSol.toFixed(2)} SOL`;

    const pumpfun = `https://pump.fun/coin/${token.mint}`;

    const tierLines = tiers.map((t) => {
        const pointer = t.isCurrent ? '\u25b6\ufe0f' : '  ';
        const bold = t.isCurrent ? '<b>' : '';
        const boldEnd = t.isCurrent ? '</b>' : '';
        const thresholdStr = t.thresholdSol > 0 ? `\u2265${t.thresholdSol} SOL` : 'Base';
        return `${pointer} ${bold}${t.name}${boldEnd} (${thresholdStr}) — Protocol: ${(t.protocolFeeBps / 100).toFixed(1)}% · Creator: ${(t.creatorFeeBps / 100).toFixed(1)}% · Total: ${(t.totalFeeBps / 100).toFixed(1)}%`;
    }).join('\n');

    return (
        `\ud83d\udcb8 <b>Fee Tiers: ${symbol}</b>\n\n` +
        `\ud83d\udcca <b>Current Market Cap:</b> ${marketCapStr}\n\n` +
        `${tierLines}\n\n` +
        `\u25b6\ufe0f = current tier for this token\n\n` +
        `\ud83d\udd17 <a href="${pumpfun}">pump.fun</a>`
    );
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

