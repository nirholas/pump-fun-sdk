/**
 * PumpFun Channel Bot — Formatters
 *
 * Rich, clean HTML message formatting for the channel feed.
 * Each event type gets a visually distinct, information-dense card.
 */

import type { ClaimRecord } from './claim-tracker.js';
import type { CreatorProfile, TokenInfo } from './pump-client.js';
import type {
    FeeClaimEvent,
    FeeDistributionEvent,
    GraduationEvent,
    TokenLaunchEvent,
    TradeAlertEvent,
} from './types.js';

// ============================================================================
// Fee Claim — The star of the show
// ============================================================================

/**
 * Rich claim notification with token details, creator profile,
 * claim history, and clean formatting.
 */
export function formatClaimFeed(
    event: FeeClaimEvent,
    token: TokenInfo | null,
    creator: CreatorProfile | null,
    claimRecord: ClaimRecord,
): string {
    const lines: string[] = [];

    // ── Header ───────────────────────────────────────────────────────
    let headerEmoji: string;
    let headerLabel: string;
    if (event.claimType === 'distribute_creator_fees') {
        headerEmoji = '🆕';
        headerLabel = 'FIRST FEE DISTRIBUTION';
    } else if (event.isCashback) {
        headerEmoji = '💸';
        headerLabel = 'FIRST CASHBACK CLAIM';
    } else {
        headerEmoji = '🏦';
        headerLabel = 'FIRST CREATOR FEE CLAIM';
    }
    lines.push(`${headerEmoji} <b>${headerLabel}</b>`);
    lines.push('');

    // ── Token Info ───────────────────────────────────────────────────
    const coinName = token?.name ?? event.tokenName ?? 'Unknown';
    const coinTicker = token?.symbol ?? event.tokenSymbol ?? '???';
    const mintShort = shortAddr(event.tokenMint);
    const pumpLink = event.tokenMint
        ? `<a href="https://pump.fun/coin/${event.tokenMint}">${esc(coinName)}</a>`
        : esc(coinName);

    lines.push(`🪙  <b>${pumpLink}</b>  <code>$${esc(coinTicker)}</code>`);

    if (token) {
        const mcap = token.usdMarketCap > 0
            ? `$${formatCompact(token.usdMarketCap)}`
            : `~${token.marketCapSol.toFixed(1)} SOL`;
        lines.push(`     Mcap: ${mcap}  ·  ${token.complete ? '⭐ Graduated' : `📈 ${token.curveProgress.toFixed(0)}%`}`);
    }

    if (event.tokenMint) {
        lines.push(`     Mint: <code>${mintShort}</code>`);
    }

    lines.push('');

    // ── Launched ─────────────────────────────────────────────────────
    if (token && token.createdTimestamp > 0) {
        const launchAge = timeAgo(token.createdTimestamp);
        lines.push(`📅  Launched: ${launchAge}`);
    }

    // ── Creator / Launcher ───────────────────────────────────────────
    const creatorWallet = token?.creator ?? '';
    if (creatorWallet) {
        const profileLink = `<a href="https://pump.fun/profile/${creatorWallet}">${shortAddr(creatorWallet)}</a>`;
        const usernameTag = creator?.username ? ` (@${esc(creator.username)})` : '';
        lines.push(`👤  Creator: ${profileLink}${usernameTag}`);

        if (creator) {
            if (creator.followers > 0) {
                lines.push(`     ${creator.followers.toLocaleString()} followers`);
            }
            if (creator.totalLaunches > 0) {
                const launchCount = creator.totalLaunches;
                const graduated = creator.recentCoins.filter((c) => c.complete).length;
                const launchWord = launchCount === 1 ? 'launch' : 'launches';
                const gradLine = graduated > 0 ? ` (${graduated} graduated)` : '';
                const recentNames = creator.recentCoins
                    .filter((c) => c.mint !== event.tokenMint)
                    .slice(0, 3)
                    .map((c) => `<a href="https://pump.fun/coin/${c.mint}">${esc(c.symbol)}</a>`)
                    .join(', ');
                lines.push(`     ${launchCount} ${launchWord}${gradLine}${recentNames ? ` — recent: ${recentNames}` : ''}`);
            }
        }
    }

    lines.push('');

    // ── Claim Details ────────────────────────────────────────────────
    const claimerLink = `<a href="https://pump.fun/profile/${event.claimerWallet}">${shortAddr(event.claimerWallet)}</a>`;
    lines.push(`💰  <b>${event.amountSol.toFixed(4)} SOL</b>  claimed by ${claimerLink}`);

    // First claim — always true now since we only post first claims
    lines.push(`     🆕 <b>First claim on this token!</b>`);

    const programLabel = event.programId?.includes('pAMM') ? 'PumpSwap' : 'Pump';
    lines.push(`     via ${programLabel}`);

    lines.push('');

    // ── Links ────────────────────────────────────────────────────────
    const txLink = `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`;
    const walletLink = `<a href="https://solscan.io/account/${event.claimerWallet}">Wallet</a>`;
    const mintLink = event.tokenMint
        ? ` · <a href="https://pump.fun/coin/${event.tokenMint}">pump.fun</a>`
        : '';
    lines.push(`🔗  ${txLink}  ·  ${walletLink}${mintLink}`);

    // ── Timestamp ────────────────────────────────────────────────────
    lines.push(`🕐  ${formatTime(event.timestamp)}`);

    return lines.join('\n');
}

// ============================================================================
// Token Launch
// ============================================================================

export function formatLaunchFeed(
    event: TokenLaunchEvent,
    creator: CreatorProfile | null,
): string {
    const lines: string[] = [];

    lines.push(`🚀 <b>NEW TOKEN LAUNCHED</b>`);
    lines.push('');

    const pumpLink = `<a href="https://pump.fun/coin/${event.mintAddress}">${esc(event.name || 'Unknown')}</a>`;
    lines.push(`🪙  <b>${pumpLink}</b>  <code>$${esc(event.symbol || '???')}</code>`);
    lines.push(`     Mint: <code>${shortAddr(event.mintAddress)}</code>`);

    if (event.description) {
        const desc = event.description.length > 120
            ? event.description.slice(0, 117) + '...'
            : event.description;
        lines.push(`     ${esc(desc)}`);
    }

    lines.push('');

    // Creator
    const profileLink = `<a href="https://pump.fun/profile/${event.creatorWallet}">${shortAddr(event.creatorWallet)}</a>`;
    const usernameTag = creator?.username ? ` (@${esc(creator.username)})` : '';
    lines.push(`👤  Creator: ${profileLink}${usernameTag}`);

    if (creator) {
        if (creator.followers > 0) {
            lines.push(`     ${creator.followers.toLocaleString()} followers`);
        }
        if (creator.totalLaunches > 1) {
            const graduated = creator.recentCoins.filter((c) => c.complete).length;
            const gradLine = graduated > 0 ? ` (${graduated} graduated)` : '';
            const past = creator.recentCoins
                .filter((c) => c.mint !== event.mintAddress)
                .slice(0, 3)
                .map((c) => `<a href="https://pump.fun/coin/${c.mint}">${esc(c.symbol)}</a>`)
                .join(', ');
            lines.push(`     ${creator.totalLaunches} total launches${gradLine}${past ? ` — recent: ${past}` : ''}`);
        } else if (creator.totalLaunches <= 1) {
            lines.push(`     🆕 First-time launcher`);
        }
    }

    lines.push('');

    // Features
    const features: string[] = [];
    if (event.mayhemMode) features.push('⚡ Mayhem');
    if (event.cashbackEnabled) features.push('💸 Cashback');
    if (event.hasGithub) features.push('🌐 GitHub');
    if (features.length > 0) {
        lines.push(`⚙️  ${features.join('  ·  ')}`);
    }

    if (event.hasGithub && event.githubUrls.length > 0) {
        lines.push(`     ${event.githubUrls.slice(0, 2).map((u) => `<a href="${esc(u)}">GitHub</a>`).join(', ')}`);
    }

    lines.push('');

    // Links
    const txLink = `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`;
    const solscanLink = `<a href="https://solscan.io/token/${event.mintAddress}">Solscan</a>`;
    const pfLink = `<a href="https://pump.fun/coin/${event.mintAddress}">pump.fun</a>`;
    lines.push(`🔗  ${txLink}  ·  ${solscanLink}  ·  ${pfLink}`);
    lines.push(`🕐  ${formatTime(event.timestamp)}`);

    return lines.join('\n');
}

// ============================================================================
// Graduation
// ============================================================================

export function formatGraduationFeed(
    event: GraduationEvent,
    token: TokenInfo | null,
): string {
    const lines: string[] = [];

    lines.push(`🎓 <b>TOKEN GRADUATED</b>`);
    lines.push('');

    const coinName = token?.name ?? 'Unknown';
    const coinTicker = token?.symbol ?? '???';
    const pumpLink = `<a href="https://pump.fun/coin/${event.mintAddress}">${esc(coinName)}</a>`;
    lines.push(`🪙  <b>${pumpLink}</b>  <code>$${esc(coinTicker)}</code>`);
    lines.push(`     Mint: <code>${shortAddr(event.mintAddress)}</code>`);

    if (token && token.createdTimestamp > 0) {
        lines.push(`     Launched ${timeAgo(token.createdTimestamp)}`);
    }

    lines.push('');

    lines.push(`📈  Type: ${event.isMigration ? 'AMM Migration' : 'Bonding Curve Complete'}`);
    if (event.isMigration) {
        if (event.solAmount != null) lines.push(`     SOL migrated: ${event.solAmount.toFixed(2)} SOL`);
        if (event.poolMigrationFee != null) lines.push(`     Migration fee: ${event.poolMigrationFee.toFixed(4)} SOL`);
        if (event.poolAddress) lines.push(`     Pool: <code>${shortAddr(event.poolAddress)}</code>`);
    }

    lines.push(`     Triggered by: <code>${shortAddr(event.user)}</code>`);
    lines.push('');

    const txLink = `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`;
    const pfLink = `<a href="https://pump.fun/coin/${event.mintAddress}">pump.fun</a>`;
    lines.push(`🔗  ${txLink}  ·  ${pfLink}`);
    lines.push(`🕐  ${formatTime(event.timestamp)}`);

    return lines.join('\n');
}

// ============================================================================
// Whale Trade
// ============================================================================

export function formatWhaleFeed(
    event: TradeAlertEvent,
    token: TokenInfo | null,
): string {
    const lines: string[] = [];

    const emoji = event.isBuy ? '🟢' : '🔴';
    const action = event.isBuy ? 'BUY' : 'SELL';
    lines.push(`🐋 <b>WHALE ${action}</b>`);
    lines.push('');

    const coinName = token?.name ?? 'Unknown';
    const coinTicker = token?.symbol ?? '???';
    const pumpLink = `<a href="https://pump.fun/coin/${event.mintAddress}">${esc(coinName)}</a>`;
    lines.push(`🪙  <b>${pumpLink}</b>  <code>$${esc(coinTicker)}</code>`);

    lines.push('');

    lines.push(`${emoji}  <b>${event.solAmount.toFixed(2)} SOL</b>`);

    const trader = `<a href="https://pump.fun/profile/${event.user}">${shortAddr(event.user)}</a>`;
    lines.push(`👤  Trader: ${trader}`);

    const mcap = token?.usdMarketCap
        ? `$${formatCompact(token.usdMarketCap)}`
        : `~${event.marketCapSol.toFixed(1)} SOL`;
    const filled = Math.round(event.bondingCurveProgress / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    lines.push(`💹  Mcap: ${mcap}  ·  [${bar}] ${event.bondingCurveProgress.toFixed(0)}%`);
    lines.push(`💰  Fee: ${event.fee.toFixed(4)} SOL  ·  Creator: ${event.creatorFee.toFixed(4)} SOL`);

    lines.push('');

    const txLink = `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`;
    const pfLink = `<a href="https://pump.fun/coin/${event.mintAddress}">pump.fun</a>`;
    lines.push(`🔗  ${txLink}  ·  ${pfLink}`);
    lines.push(`🕐  ${formatTime(event.timestamp)}`);

    return lines.join('\n');
}

// ============================================================================
// Fee Distribution
// ============================================================================

export function formatFeeDistributionFeed(
    event: FeeDistributionEvent,
    token: TokenInfo | null,
): string {
    const lines: string[] = [];

    lines.push(`💎 <b>FEES DISTRIBUTED</b>`);
    lines.push('');

    const coinName = token?.name ?? 'Unknown';
    const coinTicker = token?.symbol ?? '???';
    const pumpLink = `<a href="https://pump.fun/coin/${event.mintAddress}">${esc(coinName)}</a>`;
    lines.push(`🪙  <b>${pumpLink}</b>  <code>$${esc(coinTicker)}</code>`);

    lines.push('');

    lines.push(`💰  <b>${event.distributedSol.toFixed(4)} SOL</b> distributed`);
    lines.push(`👤  Admin: <code>${shortAddr(event.admin)}</code>`);

    if (event.shareholders.length > 0) {
        lines.push(`👥  Shareholders (${event.shareholders.length}):`);
        for (const s of event.shareholders.slice(0, 5)) {
            const pct = (s.shareBps / 100).toFixed(1);
            const shareLink = `<a href="https://pump.fun/profile/${s.address}">${shortAddr(s.address)}</a>`;
            lines.push(`     • ${shareLink}  —  ${pct}%`);
        }
        if (event.shareholders.length > 5) {
            lines.push(`     <i>... +${event.shareholders.length - 5} more</i>`);
        }
    }

    lines.push('');

    const txLink = `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`;
    const pfLink = `<a href="https://pump.fun/coin/${event.mintAddress}">pump.fun</a>`;
    lines.push(`🔗  ${txLink}  ·  ${pfLink}`);
    lines.push(`🕐  ${formatTime(event.timestamp)}`);

    return lines.join('\n');
}

// ============================================================================
// Utilities
// ============================================================================

export function shortAddr(addr: string): string {
    if (!addr || addr.length <= 12) return addr || '???';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function esc(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19) + ' UTC';
}

function timeAgo(unixSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixSeconds;
    if (diff < 0) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatTime(unixSeconds);
}

function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
}
