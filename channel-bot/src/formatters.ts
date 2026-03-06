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

    // Price line
    if (token?.priceSol && token.priceSol > 0) {
        const usdPrice = solUsdPrice > 0 ? ` · $${formatPriceUsd(token.priceSol * solUsdPrice)}` : '';
        lines.push(`💰 ${formatPriceSol(token.priceSol)} SOL${usdPrice}${ageTag}`);
    } else if (token?.createdTimestamp) {
        lines.push(`📊 Age: ${timeAgo(token.createdTimestamp)}`);
    }

    // Market stats: vol · trades · holders — one compact line
    {
        const ms: string[] = [];
        if (trades && trades.recentVolumeSol > 0) ms.push(`💦 ${formatCompact(trades.recentVolumeSol)} SOL`);
        if (trades && trades.recentTradeCount > 0) ms.push(`🅑 ${trades.recentTradeCount}`);
        if (holders && holders.totalHolders > 0) ms.push(`👥 ${holders.totalHolders}`);
        if (ms.length > 0) lines.push(ms.join(' · '));
    }

    // CA — full, copyable
    if (mint) lines.push(`<code>${mint}</code>`);

    // -- Fee Claim
    lines.push('');
    {
        const claimSol = event.amountSol.toFixed(4);
        const claimUsd = solUsdPrice > 0 ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})` : '';
        const isSelf = token?.creator === event.claimerWallet;
        const claimerTag = isSelf ? '👤 Self' : '👻 3rd-party';

        lines.push(`🏦 <b>${claimSol} SOL</b>${claimUsd} · ${claimerTag}`);

        // Show GitHub username as claimer if available
        if (githubUser) {
            const ghLink = `<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>`;
            lines.push(`  ↳ 🐙 ${ghLink}`);
        }
        const claimerLink = `<a href="https://pump.fun/profile/${event.claimerWallet}">${shortAddr(event.claimerWallet)}</a>`;
        lines.push(`  ↳ ${claimerLink}`);

        // Launch → Claim duration
        if (token && token.createdTimestamp > 0 && event.timestamp > 0) {
            const diff = event.timestamp - token.createdTimestamp;
            if (diff >= 0) lines.push(`  ↳ ⏱ Launch→Claim: <b>${formatDuration(diff)}</b>`);
        }
    }

    // -- Creator
    {
        const creatorWallet = token?.creator ?? '';
        if (creatorWallet) {
            lines.push('');
            const profileLink = `<a href="https://pump.fun/profile/${creatorWallet}">${shortAddr(creatorWallet)}</a>`;
            const usernameTag = creator?.username ? ` (@${esc(creator.username)})` : '';
            lines.push(`👤 ${profileLink}${usernameTag}`);

            if (creator) {
                const parts: string[] = [];
                if (creator.totalLaunches > 0) parts.push(`🚀 ${creator.totalLaunches}`);
                const graduated = creator.recentCoins.filter((c) => c.complete).length;
                if (graduated > 0) parts.push(`🎓 ${graduated}`);
                if (creator.followers > 0) parts.push(`${creator.followers} fol`);
                if (creator.scamEstimate > 0) parts.push(`⚠️ ${creator.scamEstimate} scams`);
                if (parts.length > 0) lines.push(parts.join(' · '));

                // Recent coins as compact ticker list
                const others = creator.recentCoins.filter((c) => c.mint !== mint).slice(0, 5);
                if (others.length > 0) {
                    const tickers = others.map((c) => {
                        const grad = c.complete ? '⭐' : '';
                        return `<a href="https://pump.fun/coin/${c.mint}">${esc(c.symbol)}</a>${grad}`;
                    });
                    lines.push(`  ↳ ${tickers.join('·')}`);
                }
            }
        }
    }

    // -- GitHub
    if (githubUser || githubRepo) {
        lines.push('');
        if (githubUser) {
            const userLink = `<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>`;
            const nameTag = githubUser.name ? ` (${esc(githubUser.name)})` : '';
            const ghStats: string[] = [];
            if (githubUser.publicRepos > 0) ghStats.push(`📦 ${githubUser.publicRepos}`);
            if (githubUser.followers > 0) ghStats.push(`${githubUser.followers} fol`);
            if (githubUser.createdAt) ghStats.push(timeAgo(new Date(githubUser.createdAt).getTime() / 1000));
            lines.push(`🐙 ${userLink}${nameTag}${ghStats.length > 0 ? ' · ' + ghStats.join(' · ') : ''}`);

            if (githubUser.bio) {
                const bio = githubUser.bio.length > 80 ? githubUser.bio.slice(0, 77) + '...' : githubUser.bio;
                lines.push(`  <i>${esc(bio)}</i>`);
            }

            // GitHub user socials — one compact line
            const ghSocials: string[] = [];
            if (githubUser.twitterUsername) ghSocials.push(`<a href="https://x.com/${esc(githubUser.twitterUsername)}">𝕏 ${esc(githubUser.twitterUsername)}</a>`);
            if (githubUser.blog) ghSocials.push(`<a href="${esc(githubUser.blog)}">🌐</a>`);
            if (githubUser.company) ghSocials.push(`🏢 ${esc(githubUser.company)}`);
            if (githubUser.location) ghSocials.push(`📍 ${esc(githubUser.location)}`);
            if (ghSocials.length > 0) lines.push(`  ↳ ${ghSocials.join(' · ')}`);
        }

        if (githubRepo) {
            const repoLink = `<a href="${esc(githubRepo.htmlUrl)}">${esc(githubRepo.fullName)}</a>`;
            const repoStats: string[] = [];
            if (githubRepo.language) repoStats.push(esc(githubRepo.language));
            if (githubRepo.stars > 0) repoStats.push(`⭐${githubRepo.stars}`);
            if (githubRepo.forks > 0) repoStats.push(`🍴${githubRepo.forks}`);
            if (githubRepo.isFork) repoStats.push('⚠️Fork');
            if (githubRepo.lastPushAgo) repoStats.push(githubRepo.lastPushAgo);
            lines.push(`📁 ${repoLink}${repoStats.length > 0 ? ' · ' + repoStats.join('·') : ''}`);
            if (githubRepo.description) {
                const desc = githubRepo.description.length > 80 ? githubRepo.description.slice(0, 77) + '...' : githubRepo.description;
                lines.push(`  <i>${esc(desc)}</i>`);
            }
            if (githubRepo.topics.length > 0) {
                lines.push(`  🏷 ${githubRepo.topics.map((t) => esc(t)).join('·')}`);
            }
        }
    } else if (token?.githubUrls && token.githubUrls.length > 0) {
        lines.push('');
        lines.push(`🐙 ${token.githubUrls.slice(0, 2).map((u) => `<a href="${esc(u)}">GitHub</a>`).join(' · ')}`);
    }

    // -- Token Socials — compact
    {
        const socials: string[] = [];
        if (token?.twitter) {
            const handle = extractTwitterHandle(token.twitter);
            socials.push(`<a href="${esc(token.twitter)}">𝕏${handle ? ' ' + esc(handle) : ''}</a>`);
        }
        if (token?.telegram) socials.push(`<a href="${esc(token.telegram)}">💬 TG</a>`);
        if (token?.website) socials.push(`<a href="${esc(token.website)}">🌐 Web</a>`);
        if (creator && creator.followers > 0) socials.push(`${formatCompact(creator.followers)} fol`);
        if (socials.length > 0) lines.push(`🔗 ${socials.join(' · ')}`);

        if (token?.description) {
            const desc = token.description.length > 120 ? token.description.slice(0, 117) + '...' : token.description;
            lines.push(`  <i>${esc(desc)}</i>`);
        }
    }

    // -- AI Summary
    if (aiSummary) {
        lines.push('');
        lines.push(`🤖 <i>${esc(aiSummary)}</i>`);
    }

    // -- Links: trade + explore
    lines.push('');
    if (mint) {
        lines.push(`💹 <a href="https://pump.fun/coin/${mint}">Pump</a> · <a href="https://gmgn.ai/sol/token/${mint}&ref=nichxbt">GMGN</a> · <a href="https://axiom.trade/@nich/${mint}">Axiom</a> · <a href="https://dexscreener.com/solana/${mint}">DEX</a> · <a href="https://photon-sol.tinyastro.io/en/lp/${mint}">Photon</a> · <a href="https://bullx.io/terminal?chainId=1399811149&address=${mint}">BullX</a>`);
    }
    if (event.txSignature) {
        lines.push(`🔍 <a href="https://solscan.io/tx/${event.txSignature}">TX</a> · <a href="https://solscan.io/token/${mint}">Solscan</a>`);
    }
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

/** Extract @handle from a Twitter/X URL. Returns "@handle" or null. */
function extractTwitterHandle(url: string): string | null {
    const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i);
    if (match && match[1] && !['home', 'search', 'explore', 'settings', 'i'].includes(match[1].toLowerCase())) {
        return `@${match[1]}`;
    }
    return null;
}

