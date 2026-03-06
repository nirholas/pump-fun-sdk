/**
 * PumpFun Channel Bot — Formatters
 *
 * Rich, clean HTML message formatting for the channel feed.
 * Each event type gets a visually distinct, information-dense card.
 */

import type { ClaimRecord } from './claim-tracker.js';
import type { CreatorProfile, TokenInfo, TokenHolderInfo, TokenTradeInfo } from './pump-client.js';
import type {
    FeeClaimEvent,
    FeeDistributionEvent,
    GraduationEvent,
    TokenLaunchEvent,
    TradeAlertEvent,
} from './types.js';

// ============================================================================
// Fee Claim — Compact, scannable first-claim card
// ============================================================================

export interface ClaimFeedContext {
    event: FeeClaimEvent;
    token: TokenInfo | null;
    creator: CreatorProfile | null;
    claimRecord: ClaimRecord;
    holders: TokenHolderInfo | null;
    trades: TokenTradeInfo | null;
    solUsdPrice: number;
}

/**
 * Compact first-claim card with image + dense info lines.
 * Returns { imageUrl, caption } so caller can send photo or text.
 */
export function formatClaimFeed(ctx: ClaimFeedContext): { imageUrl: string | null; caption: string } {
    const { event, token, creator, claimRecord, holders, trades, solUsdPrice } = ctx;
    const lines: string[] = [];

    // ── Row 1: Header — type emoji + token name + mcap + ticker ──
    const coinName = token?.name ?? event.tokenName ?? 'Unknown';
    const coinTicker = token?.symbol ?? event.tokenSymbol ?? '???';
    const mcapStr = token?.usdMarketCap ? formatCompact(token.usdMarketCap) : null;
    const pumpLink = event.tokenMint
        ? `<a href="https://pump.fun/coin/${event.tokenMint}">${esc(coinName)}</a>`
        : esc(coinName);

    let headerEmoji: string;
    if (event.claimType === 'distribute_creator_fees') headerEmoji = '🆕';
    else if (event.isCashback) headerEmoji = '💸';
    else headerEmoji = '🏦';

    const mcapTag = mcapStr ? ` [${mcapStr}]` : '';
    const statusTag = token?.complete ? ' ⭐' : '';
    lines.push(`${headerEmoji} <b>${pumpLink}</b>${mcapTag} <code>$${esc(coinTicker)}</code>${statusTag}`);

    // ── Row 2: GitHub links (the star of the show) ──
    if (token?.githubUrls && token.githubUrls.length > 0) {
        const ghLinks = token.githubUrls.slice(0, 2).map((u) => `<a href="${esc(u)}">GitHub</a>`).join(' ⋅ ');
        lines.push(`🐙 ${ghLinks}`);
    }

    // ── Row 3: Price + curve/graduated status ──
    if (token) {
        const parts: string[] = [];

        // SOL price
        if (token.priceSol > 0) {
            parts.push(`${formatPriceSol(token.priceSol)} SOL`);
        }

        // USD price (if we have SOL price)
        if (token.priceSol > 0 && solUsdPrice > 0) {
            const usdPrice = token.priceSol * solUsdPrice;
            parts.push(`$${formatPriceUsd(usdPrice)}`);
        }

        if (parts.length > 0) lines.push(`💰 ${parts.join(' ⋅ ')}`);

        // Mcap + curve progress
        const mcap = token.usdMarketCap > 0
            ? `$${formatCompact(token.usdMarketCap)}`
            : `${token.marketCapSol.toFixed(1)} SOL`;
        const curve = token.complete
            ? '⭐ Graduated'
            : `📈 ${token.curveProgress.toFixed(1)}%`;
        lines.push(`💎 Mcap: ${mcap} ⋅ ${curve}`);
    }

    // ── Row 4: Volume + Holders + Age ──
    {
        const parts: string[] = [];

        if (trades && trades.recentVolumeSol > 0) {
            parts.push(`Vol: ${formatCompact(trades.recentVolumeSol)} SOL`);
        }
        if (trades && trades.recentTradeCount > 0) {
            parts.push(`${trades.recentTradeCount} trades`);
        }
        if (holders && holders.totalHolders > 0) {
            parts.push(`👥 ${holders.totalHolders}`);
        }
        if (token && token.createdTimestamp > 0) {
            parts.push(`Age: ${timeAgo(token.createdTimestamp)}`);
        }

        if (parts.length > 0) lines.push(`📊 ${parts.join(' ⋅ ')}`);
    }

    // ── Row 5: Claim details — amount + USD + who ──
    {
        const claimSol = event.amountSol.toFixed(4);
        const claimUsd = solUsdPrice > 0
            ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})`
            : '';
        const programLabel = event.programId?.includes('pAMM') ? 'PumpSwap' : 'Pump';
        lines.push(`🏦 <b>${claimSol} SOL</b>${claimUsd} via ${programLabel}`);
    }

    // ── Row 6: Launch → Claim time + claimer identity ──
    {
        const parts: string[] = [];

        // Time from launch to first claim
        if (token && token.createdTimestamp > 0 && event.timestamp > 0) {
            const diff = event.timestamp - token.createdTimestamp;
            if (diff >= 0) {
                parts.push(`⏱ Launch→Claim: ${formatDuration(diff)}`);
            }
        }

        // Is claimer the creator?
        if (token?.creator && event.claimerWallet) {
            if (event.claimerWallet === token.creator) {
                parts.push('👤 Self-claim');
            } else {
                parts.push('👻 3rd-party claim');
            }
        }

        if (parts.length > 0) lines.push(parts.join(' ⋅ '));
    }

    // ── Row 7: Creator info — launches, graduated, username ──
    {
        const creatorWallet = token?.creator ?? '';
        if (creatorWallet) {
            const profileLink = `<a href="https://pump.fun/profile/${creatorWallet}">${shortAddr(creatorWallet)}</a>`;
            const usernameTag = creator?.username ? ` @${esc(creator.username)}` : '';

            const parts: string[] = [`${profileLink}${usernameTag}`];

            if (creator) {
                if (creator.followers > 0) parts.push(`${creator.followers} flw`);
                if (creator.totalLaunches > 0) {
                    const graduated = creator.recentCoins.filter((c) => c.complete).length;
                    const gradTag = graduated > 0 ? ` (${graduated}🎓)` : '';
                    parts.push(`${creator.totalLaunches} launches${gradTag}`);
                }
            }

            lines.push(`👤 ${parts.join(' ⋅ ')}`);

            // Recent coins by creator
            if (creator && creator.recentCoins.length > 0) {
                const recent = creator.recentCoins
                    .filter((c) => c.mint !== event.tokenMint)
                    .slice(0, 5)
                    .map((c) => {
                        const icon = c.complete ? '⭐' : '';
                        return `<a href="https://pump.fun/coin/${c.mint}">${esc(c.symbol)}</a>${icon}`;
                    })
                    .join('⋅');
                if (recent) lines.push(`  ↳ ${recent}`);
            }
        }
    }

    // ── Row 8: Socials ──
    {
        const socials: string[] = [];
        if (token?.twitter) socials.push(`<a href="${esc(token.twitter)}">𝕏</a>`);
        if (token?.telegram) socials.push(`<a href="${esc(token.telegram)}">TG</a>`);
        if (token?.website) socials.push(`<a href="${esc(token.website)}">🌐</a>`);
        if (socials.length > 0) lines.push(`🔗 ${socials.join(' ⋅ ')}`);
    }

    // ── Row 9: Description (truncated) ──
    if (token?.description) {
        const desc = token.description.length > 100
            ? token.description.slice(0, 97) + '...'
            : token.description;
        lines.push(`📝 <i>${esc(desc)}</i>`);
    }

    // ── Row 10: Full mint + links ──
    if (event.tokenMint) {
        lines.push(`\n<code>${event.tokenMint}</code>`);
    }

    const linkParts: string[] = [];
    if (event.txSignature) linkParts.push(`<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`);
    if (event.claimerWallet) linkParts.push(`<a href="https://solscan.io/account/${event.claimerWallet}">Wallet</a>`);
    if (event.tokenMint) {
        linkParts.push(`<a href="https://pump.fun/coin/${event.tokenMint}">Pump</a>`);
        linkParts.push(`<a href="https://dexscreener.com/solana/${event.tokenMint}">DEX</a>`);
    }
    if (linkParts.length > 0) lines.push(linkParts.join(' ⋅ '));

    // ── Timestamp ──
    lines.push(`🕐 ${formatTime(event.timestamp)}`);

    const imageUrl = token?.imageUri || null;
    return { imageUrl, caption: lines.join('\n') };
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

function formatPriceSol(price: number): string {
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.001) return price.toFixed(6);
    return price.toFixed(9);
}

function formatPriceUsd(price: number): string {
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    // Count leading zeros for very small prices
    const str = price.toFixed(20);
    const match = str.match(/^0\.(0+)/);
    if (match) {
        const zeros = match[1]!.length;
        const sig = price.toFixed(zeros + 4).replace(/0+$/, '');
        return sig;
    }
    return price.toFixed(8);
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

