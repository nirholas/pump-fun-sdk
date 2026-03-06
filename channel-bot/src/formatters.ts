/**
 * PumpFun Channel Bot — Formatters
 *
 * Rich, clean HTML message formatting for the channel feed.
 * Each event type gets a visually distinct, information-dense card.
 */

import type { ClaimRecord } from './claim-tracker.js';
import type { GitHubRepoInfo, GitHubUserInfo } from './github-client.js';
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
    githubRepo: GitHubRepoInfo | null;
    githubUser: GitHubUserInfo | null;
    aiSummary: string;
}

/**
 * Compact first-claim card — glanceable, dense, clickable.
 * Returns { imageUrl, caption } so caller can send photo or text.
 */
export function formatClaimFeed(ctx: ClaimFeedContext): { imageUrl: string | null; caption: string } {
    const { event, token, creator, claimRecord, holders, trades, solUsdPrice, githubRepo, githubUser, aiSummary } = ctx;
    const lines: string[] = [];
    const mint = event.tokenMint;

    const coinName = token?.name ?? event.tokenName ?? 'Unknown';
    const coinTicker = token?.symbol ?? event.tokenSymbol ?? '???';
    const pumpLink = mint
        ? `<a href="https://pump.fun/coin/${mint}">${esc(coinName)}</a>`
        : esc(coinName);

    // ── Header: token + status at a glance ───────────────────────────
    const statusBadge = token?.complete ? ' ⭐' : token?.curveProgress ? ` 📈${token.curveProgress.toFixed(0)}%` : '';
    const mcapTag = token?.usdMarketCap ? ` [$${formatCompact(token.usdMarketCap)}]` : '';
    const ageTag = token?.createdTimestamp ? ` · ${timeAgo(token.createdTimestamp)}` : '';

    lines.push(`🐙 <b>${pumpLink}</b> $${esc(coinTicker)}${mcapTag}${statusBadge}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Creator
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    lines.push('');
    lines.push(`━━ <b>Creator</b> ━━`);

    const creatorWallet = token?.creator ?? '';
    if (creatorWallet) {
        const profileLink = `<a href="https://pump.fun/profile/${creatorWallet}">${shortAddr(creatorWallet)}</a>`;
        lines.push(`👤 ${profileLink}`);

        if (creator) {
            const parts: string[] = [];
            if (creator.totalLaunches > 0) parts.push(`� ${creator.totalLaunches} deploys`);
            if (creator.scamEstimate > 0) parts.push(`⚠️ ${creator.scamEstimate} scams`);
            if (parts.length > 0) lines.push(parts.join(' · '));

            // Top coin by creator (highest MC, excluding current)
            const otherCoins = creator.recentCoins.filter((c) => c.mint !== event.tokenMint);
            if (otherCoins.length > 0) {
                const top = otherCoins.sort((a, b) => b.usdMarketCap - a.usdMarketCap)[0];
                if (top) {
                    const topLink = `<a href="https://pump.fun/coin/${top.mint}">${esc(top.name)} (${esc(top.symbol)})</a>`;
                    const mcStr = top.usdMarketCap > 0 ? ` ($${formatCompact(top.usdMarketCap)})` : '';
                    lines.push(`📊 TOP: ${topLink}${mcStr}`);
                }
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Fee Recipient
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    lines.push('');
    {
        const claimSol = event.amountSol.toFixed(4);
        const claimUsd = solUsdPrice > 0
            ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})`
            : '';

        // Claimer identity
        const isSelf = token?.creator === event.claimerWallet;

        // Fee share label — for GitHub claims it's typically 100%
        const shareLabel = '100%';
        const claimCountLabel = claimRecord.claimCount > 1 ? ` · ${claimRecord.claimCount}x` : '';

        lines.push(`━━ <b>Fee Recipient</b> (${shareLabel}${claimCountLabel}) ━━`);

        // Show GitHub username if available, otherwise wallet
        if (githubUser) {
            const ghLink = `<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>`;
            lines.push(`🐙 ${ghLink}`);
        } else {
            const claimerLink = `<a href="https://pump.fun/profile/${event.claimerWallet}">${shortAddr(event.claimerWallet)}</a>`;
            lines.push(`🐙 ${claimerLink}`);
        }

        lines.push(`🏦 <b>${claimSol} SOL</b>${claimUsd}`);

        // Launch → Claim time
        if (token && token.createdTimestamp > 0 && event.timestamp > 0) {
            const diff = event.timestamp - token.createdTimestamp;
            if (diff >= 0) {
                lines.push(`⏱ Launch→Claim: ${formatDuration(diff)}`);
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // GitHub
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (githubUser || githubRepo) {
        lines.push('');
        lines.push(`━━ <b>GitHub</b> ━━`);

        if (githubUser) {
            const userLink = `<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>`;
            const nameTag = githubUser.name ? ` (${esc(githubUser.name)})` : '';
            lines.push(`🐙 ${userLink}${nameTag}`);

            const stats: string[] = [];
            if (githubUser.publicRepos > 0) stats.push(`📦 ${githubUser.publicRepos} repos`);
            if (githubUser.followers > 0) stats.push(`${githubUser.followers} followers`);
            if (githubUser.following > 0) stats.push(`${githubUser.following} following`);
            if (stats.length > 0) lines.push(stats.join(' · '));

            if (githubUser.bio) {
                const bio = githubUser.bio.length > 100 ? githubUser.bio.slice(0, 97) + '...' : githubUser.bio;
                lines.push(`<i>${esc(bio)}</i>`);
            }

            const socials: string[] = [];
            if (githubUser.twitterUsername) socials.push(`<a href="https://x.com/${esc(githubUser.twitterUsername)}">𝕏 ${esc(githubUser.twitterUsername)}</a>`);
            if (githubUser.blog) socials.push(`<a href="${esc(githubUser.blog)}">🌐 Site</a>`);
            if (githubUser.company) socials.push(`🏢 ${esc(githubUser.company)}`);
            if (githubUser.location) socials.push(`📍 ${esc(githubUser.location)}`);
            if (socials.length > 0) lines.push(socials.join(' · '));

            if (githubUser.createdAt) {
                const acctAge = timeAgo(new Date(githubUser.createdAt).getTime() / 1000);
                lines.push(`🕐 Account: ${acctAge}`);
            }
        }

        if (githubRepo) {
            lines.push('');
            const repoLink = `<a href="${esc(githubRepo.htmlUrl)}">${esc(githubRepo.fullName)}</a>`;
            lines.push(`📁 ${repoLink}`);

            const repoStats: string[] = [];
            if (githubRepo.language) repoStats.push(esc(githubRepo.language));
            if (githubRepo.stars > 0) repoStats.push(`⭐ ${githubRepo.stars}`);
            if (githubRepo.forks > 0) repoStats.push(`🍴 ${githubRepo.forks}`);
            if (githubRepo.isFork) repoStats.push('⚠️ Fork');
            if (repoStats.length > 0) lines.push(repoStats.join(' · '));

            if (githubRepo.lastPushAgo) {
                lines.push(`Last push: ${githubRepo.lastPushAgo}`);
            }
            if (githubRepo.description) {
                const desc = githubRepo.description.length > 100 ? githubRepo.description.slice(0, 97) + '...' : githubRepo.description;
                lines.push(`<i>${esc(desc)}</i>`);
            }
            if (githubRepo.topics.length > 0) {
                lines.push(`🏷 ${githubRepo.topics.map((t) => esc(t)).join(' · ')}`);
            }
        }
    } else if (token?.githubUrls && token.githubUrls.length > 0) {
        lines.push('');
        lines.push(`━━ <b>GitHub</b> ━━`);
        const ghLinks = token.githubUrls.slice(0, 2).map((u) => `<a href="${esc(u)}">GitHub</a>`).join(' · ');
        lines.push(`🐙 ${ghLinks}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Token Socials
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        const hasSocials = token?.twitter || token?.telegram || token?.website;
        const hasDesc = token?.description;

        if (hasSocials || hasDesc) {
            lines.push('');
            lines.push(`━━ <b>Token Socials</b> ━━`);

            // Twitter — show as "Status by @handle" with description as blockquote
            if (token?.twitter) {
                const handle = extractTwitterHandle(token.twitter);
                if (handle) {
                    lines.push(`🐦 <a href="${esc(token.twitter)}">Status</a> by <a href="${esc(token.twitter)}">${esc(handle)}</a>`);
                } else {
                    lines.push(`🐦 <a href="${esc(token.twitter)}">Twitter</a>`);
                }
            }

            // Description as blockquote (like tweet content)
            if (token?.description) {
                const desc = token.description.length > 200
                    ? token.description.slice(0, 197) + '...'
                    : token.description;
                lines.push(`<blockquote>${esc(desc)}</blockquote>`);
            }

            // Creator followers from PumpFun profile
            if (creator && creator.followers > 0) {
                lines.push(`${formatCompact(creator.followers)} Followers`);
            }

            // Other socials
            const otherLinks: string[] = [];
            if (token?.telegram) otherLinks.push(`<a href="${esc(token.telegram)}">💬 TG</a>`);
            if (token?.website) otherLinks.push(`<a href="${esc(token.website)}">🌐 Site</a>`);
            if (otherLinks.length > 0) lines.push(otherLinks.join(' · '));
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Market Data
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        const hasMarketData = token || (trades && trades.recentTradeCount > 0) || (holders && holders.totalHolders > 0);
        if (hasMarketData) {
            lines.push('');
            lines.push(`━━ <b>Market</b> ━━`);

            if (token) {
                // Price
                if (token.priceSol > 0) {
                    const usdPrice = solUsdPrice > 0 ? ` · $${formatPriceUsd(token.priceSol * solUsdPrice)}` : '';
                    lines.push(`💰 ${formatPriceSol(token.priceSol)} SOL${usdPrice}`);
                }

                // Status
                const curve = token.complete
                    ? '⭐ Graduated'
                    : `📈 Curve: ${token.curveProgress.toFixed(1)}%`;
                lines.push(curve);
            }

            const stats: string[] = [];
            if (trades && trades.recentVolumeSol > 0) stats.push(`Vol: ${formatCompact(trades.recentVolumeSol)} SOL`);
            if (trades && trades.recentTradeCount > 0) stats.push(`${trades.recentTradeCount} trades`);
            if (holders && holders.totalHolders > 0) stats.push(`👥 ${holders.totalHolders} holders`);
            if (token && token.createdTimestamp > 0) stats.push(`Age: ${timeAgo(token.createdTimestamp)}`);
            if (stats.length > 0) lines.push(stats.join(' · '));
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // AI Summary
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (aiSummary) {
        lines.push('');
        lines.push(`🤖 <i>${esc(aiSummary)}</i>`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Links
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    lines.push('');
    const linkParts: string[] = [];
    if (event.tokenMint) {
        linkParts.push(`<a href="https://gmgn.ai/sol/token/${event.tokenMint}&ref=nichxbt">GMGN</a>`);
        linkParts.push(`<a href="https://pump.fun/coin/${event.tokenMint}">Pump</a>`);
        linkParts.push(`<a href="https://axiom.trade/@nich/${event.tokenMint}">Axiom</a>`);
    }
    if (event.txSignature) linkParts.push(`<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`);
    if (linkParts.length > 0) lines.push(`🔗 ${linkParts.join(' · ')}`);

    // Timestamp
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
    lines.push(`CA: <code>${event.mintAddress}</code>`);

    if (event.description) {
        const desc = event.description.length > 120
            ? event.description.slice(0, 117) + '...'
            : event.description;
        lines.push(`     ${esc(desc)}`);
    }

    lines.push('');

    // Creator
    const profileLink = `<a href="https://pump.fun/profile/${event.creatorWallet}">${shortAddr(event.creatorWallet)}</a>`;
    const usernameTag = creator?.username ? ` (<a href="https://pump.fun/profile/${event.creatorWallet}">${esc(creator.username)}</a>)` : '';
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
    lines.push(`CA: <code>${event.mintAddress}</code>`);

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

