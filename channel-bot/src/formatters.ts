/**
 * PumpFun Channel Bot — Formatters
 *
 * Claim feed cards: GitHub social fee PDA + other event feeds.
 * Every data point on its own line, clean emoji prefix.
 */

import type { GitHubUserInfo } from './github-client.js';
import type { CreatorProfile, TokenInfo, TokenHolderInfo, TokenTradeInfo, TopHolder, HolderDetails, DevWalletInfo, PoolLiquidityInfo, BundleInfo } from './pump-client.js';
import type {
    FeeClaimEvent,
    FeeDistributionEvent,
    GraduationEvent,
    TokenLaunchEvent,
    TradeAlertEvent,
} from './types.js';
import type { XProfile } from './x-client.js';
import { getInfluencerTier, formatFollowerCount, influencerLabel } from './x-client.js';

// ============================================================================
// GitHub Social Fee Claim Card
// ============================================================================

export interface ClaimFeedContext {
    event: FeeClaimEvent;
    solUsdPrice: number;
    githubUser: GitHubUserInfo | null;
    xProfile: XProfile | null;
    affiliates?: { axiom: string; gmgn: string; padre: string };
}

/**
 * GitHub Social Fee Claim card — shows a GitHub developer claiming their
 * first fee share from the PumpFun social fee PDA.
 */
export function formatGitHubClaimFeed(ctx: ClaimFeedContext): { imageUrl: string | null; caption: string } {
    const { event, solUsdPrice, githubUser, xProfile } = ctx;
    const L: string[] = [];
    const mint = event.tokenMint?.trim() || '';

    // ━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`🐙 <b>GitHub Dev Claimed Fees</b>`);

    // ━━ INFLUENCER BADGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const tier = getInfluencerTier(
        githubUser?.followers ?? 0,
        xProfile?.followers ?? null,
    );
    if (tier) {
        L.push(`${influencerLabel(tier)}`);
    }

    // ━━ AMOUNT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const claimSol = event.amountSol.toFixed(4);
    const claimUsd = solUsdPrice > 0 ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})` : '';
    L.push(`🏦 <b>${claimSol} SOL</b>${claimUsd}`);

    // ━━ GITHUB USER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (githubUser) {
        const userLink = `<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>`;
        const nameTag = githubUser.name ? ` (${esc(githubUser.name)})` : '';
        L.push(`👤 ${userLink}${nameTag}`);
        if (githubUser.publicRepos > 0) L.push(`📦 Repos: ${githubUser.publicRepos}`);
        if (githubUser.followers > 0) L.push(`👁 Followers: ${githubUser.followers}`);
        if (githubUser.createdAt) L.push(`📅 Joined: ${timeAgo(new Date(githubUser.createdAt).getTime() / 1000)}`);
        if (githubUser.bio) {
            const bio = githubUser.bio.length > 80 ? githubUser.bio.slice(0, 77) + '...' : githubUser.bio;
            L.push(`  <i>${esc(bio)}</i>`);
        }
        if (githubUser.twitterUsername) {
            const xLink = `<a href="https://x.com/${esc(githubUser.twitterUsername)}">${esc(githubUser.twitterUsername)}</a>`;
            if (xProfile && xProfile.followers > 0) {
                L.push(`𝕏 ${xLink} · ${formatFollowerCount(xProfile.followers)} followers`);
            } else {
                L.push(`𝕏 ${xLink}`);
            }
        }
        if (githubUser.blog) L.push(`🌐 <a href="${esc(githubUser.blog)}">${esc(githubUser.blog.replace(/^https?:\/\//, '').slice(0, 40))}</a>`);
        if (githubUser.location) L.push(`📍 ${esc(githubUser.location)}`);
    } else {
        L.push(`👤 GitHub ID: ${esc(event.githubUserId ?? 'unknown')}`);
    }

    // ━━ RECIPIENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const recipient = event.recipientWallet ?? event.claimerWallet;
    if (recipient) {
        L.push('');
        const recipientLink = `<a href="https://pump.fun/profile/${recipient}">${shortAddr(recipient)}</a>`;
        L.push(`💼 Recipient: ${recipientLink}`);
    }

    // ━━ CA + TRADING LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (mint) {
        // Click-to-copy CA (tapping <code> in Telegram copies to clipboard)
        L.push(`🧬 <b>CA</b>`);
        L.push(`<code>${mint}</code>`);

        // Trading links row
        const aff = ctx.affiliates;
        const pfUrl   = `https://pump.fun/coin/${mint}`;
        const axiomUrl = aff?.axiom
            ? `https://axiom.trade/t/${mint}?ref=${encodeURIComponent(aff.axiom)}`
            : `https://axiom.trade/t/${mint}`;
        const gmgnUrl  = aff?.gmgn
            ? `https://gmgn.ai/sol/token/${mint}?ref=${encodeURIComponent(aff.gmgn)}`
            : `https://gmgn.ai/sol/token/${mint}`;
        const padreUrl = aff?.padre
            ? `https://t.me/padre_trading_bot?start=token_${mint}_ref_${encodeURIComponent(aff.padre)}`
            : `https://t.me/padre_trading_bot?start=token_${mint}`;
        L.push(
            `<a href="${pfUrl}">Pump.fun</a>` +
            ` · <a href="${axiomUrl}">Axiom</a>` +
            ` · <a href="${gmgnUrl}">GMGN</a>` +
            ` · <a href="${padreUrl}">Padre</a>`,
        );
    } else {
        // Index not yet populated — show PDA so user can cross-reference
        L.push(`🧬 <b>CA:</b> <i>resolving…</i>`);
        if (event.socialFeePda) {
            L.push(`🧾 <code>${event.socialFeePda}</code>`);
        }
    }

    // ━━ TX ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (event.txSignature) {
        L.push(`🔍 <a href="https://solscan.io/tx/${event.txSignature}">TX</a>`);
    }
    L.push(`🕐 ${formatTime(event.timestamp)}`);

    const imageUrl = githubUser?.avatarUrl || null;
    return { imageUrl, caption: L.join('\n') };
}


// ============================================================================
// Creator Fee Claim Card
// ============================================================================

export interface CreatorClaimContext {
    event: FeeClaimEvent;
    solUsdPrice: number;
    creator: CreatorProfile | null;
}

/**
 * Creator fee first-claim card — shows a creator collecting fees for the first time.
 * Includes their PumpFun profile and recent launches.
 */
export function formatCreatorClaimFeed(ctx: CreatorClaimContext): { imageUrl: string | null; caption: string } {
    const { event, solUsdPrice, creator } = ctx;
    const L: string[] = [];

    // ━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`💰 <b>Creator Claimed Fees</b>`);

    // ━━ AMOUNT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const claimSol = event.amountSol.toFixed(4);
    const claimUsd = solUsdPrice > 0 ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})` : '';
    L.push(`🏦 <b>${claimSol} SOL</b>${claimUsd}`);
    L.push(`  ↳ ${esc(event.claimLabel)}`);

    // ━━ CREATOR PROFILE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const wallet = event.claimerWallet;
    const profileLink = `<a href="https://pump.fun/profile/${wallet}">${shortAddr(wallet)}</a>`;
    const uname = creator?.username ? ` @${esc(creator.username)}` : '';
    L.push(`👤 ${profileLink}${uname}`);

    if (creator) {
        if (creator.totalLaunches > 0) L.push(`🚀 Launches: ${creator.totalLaunches}`);
        const graduated = creator.recentCoins.filter((c) => c.complete).length;
        if (graduated > 0) L.push(`🎓 Graduated: ${graduated}`);
        if (creator.scamEstimate > 0) L.push(`⚠️ Rugs: ${creator.scamEstimate}`);
        if (creator.followers > 0) L.push(`👁 Followers: ${formatCompact(creator.followers)}`);

        // Show recent coins
        const coins = creator.recentCoins.slice(0, 5);
        if (coins.length > 0) {
            const tickers = coins.map((c) => {
                const g = c.complete ? '⭐' : '';
                const mcap = c.usdMarketCap > 0 ? ` [${formatCompact(c.usdMarketCap)}]` : '';
                return `<a href="https://pump.fun/coin/${c.mint}">${esc(c.symbol)}</a>${g}${mcap}`;
            });
            L.push(`🪙 ${tickers.join(' · ')}`);
        }
    }

    // ━━ TX ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (event.txSignature) {
        L.push(`🔍 <a href="https://solscan.io/tx/${event.txSignature}">TX</a>`);
    }
    L.push(`🕐 ${formatTime(event.timestamp)}`);

    const imageUrl = creator?.profileImage || null;
    return { imageUrl, caption: L.join('\n') };
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

export interface GraduationEnrichment {
    holders?: HolderDetails | null;
    trades?: TokenTradeInfo | null;
    devWallet?: DevWalletInfo | null;
    xProfile?: XProfile | null;
    liquidity?: PoolLiquidityInfo | null;
    bundle?: BundleInfo | null;
}

export function formatGraduationFeed(
    event: GraduationEvent,
    token: TokenInfo | null,
    creator: CreatorProfile | null,
    solUsdPrice: number,
    enrichment?: GraduationEnrichment,
): { imageUrl: string | null; caption: string } {
    const L: string[] = [];
    const mint = event.mintAddress;

    // ━━ LINE 1: TOKEN IDENTITY + SPEED EMOJI ━━━━━━━━━━━━
    const coinName = token?.name ?? 'Unknown';
    const coinTicker = token?.symbol ?? '???';

    // Speed emoji + label based on bonding curve duration
    let speedEmoji = '';
    let timeLabel = '';
    if (token && token.createdTimestamp > 0 && event.timestamp > token.createdTimestamp) {
        const seconds = event.timestamp - token.createdTimestamp;
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (seconds < 30) {
            speedEmoji = '⚡️⚡️⚡️';
            timeLabel = `${seconds}s`;
        } else if (seconds < 60) {
            speedEmoji = '⚡️⚡️';
            timeLabel = `${seconds}s`;
        } else if (seconds < 120) {
            speedEmoji = '⚡️';
            timeLabel = `${minutes}m`;
        } else if (days > 3) {
            speedEmoji = '💤';
            timeLabel = `${days}d`;
        } else if (hours > 0) {
            timeLabel = `${hours}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ''}`;
        } else {
            timeLabel = `${minutes}m`;
        }
    }

    // 💊 ⚡️⚡️⚡️ $TICKER — Name [0m]
    const nameLink = `<a href="https://pump.fun/coin/${mint}">${esc(coinName)}</a>`;
    const headerPrefix = ['💊', speedEmoji].filter(Boolean).join(' ');
    L.push(`${headerPrefix} <b>$${esc(coinTicker)}</b> — ${nameLink}${timeLabel ? ` [${timeLabel}]` : ''}`);

    // ━━ LINE 2: CONTRACT ADDRESS + MARKET CAP ━━━━━━━━━━
    L.push(`<code>${mint}</code>`);
    if (token && (token.usdMarketCap > 0 || token.marketCapSol > 0)) {
        const mcStr = token.usdMarketCap > 0
            ? `$${formatCompact(token.usdMarketCap)}`
            : `~${token.marketCapSol.toFixed(1)} SOL`;
        L.push(`💹 MC: ${mcStr}`);
    }
    if (enrichment?.liquidity) {
        const liq = enrichment.liquidity;
        const liqStr = `$${formatCompact(liq.liquidityUsd)}`;
        const multStr = liq.liquidityMultiplier > 1 ? ` [x${liq.liquidityMultiplier}]` : '';
        L.push(`💦 Liq: ${liqStr}${multStr}`);
    }

    // ━━ STATS BLOCK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');

    // Holders + top-10 on one line
    const holderData = enrichment?.holders;
    if (holderData && holderData.totalHolders > 0) {
        let holderLine = `👥 ${holderData.totalHolders.toLocaleString()}`;
        if (holderData.top10Pct > 0) {
            const nonPool = holderData.topHolders.filter(h => !h.isPool);
            const top5 = nonPool.slice(0, 5).map(h => `${h.pct.toFixed(1)}%`).join(', ');
            holderLine += `  ·  🔟 ${holderData.top10Pct.toFixed(0)}%${top5 ? ` [${top5}]` : ''}`;
        }
        L.push(holderLine);
    }

    // Buy/sell split + bundle
    const tradeData = enrichment?.trades;
    if (tradeData && (tradeData.buyCount > 0 || tradeData.sellCount > 0)) {
        let tradeLine = `🅑 ${tradeData.buyCount}  ·  Ⓢ ${tradeData.sellCount}`;
        if (enrichment?.bundle && enrichment.bundle.bundlePct > 0) {
            const b = enrichment.bundle;
            tradeLine += `  ·  📦 ${b.bundlePct.toFixed(1)}% (${b.bundleWallets}w)`;
        }
        L.push(tradeLine);
    } else if (enrichment?.bundle && enrichment.bundle.bundlePct > 0) {
        const b = enrichment.bundle;
        L.push(`📦 Bundle: ${b.bundlePct.toFixed(1)}% (${b.bundleWallets} wallets)`);
    }

    // Dev % + SOL balance on one line
    const dw = enrichment?.devWallet;
    const devParts: string[] = [];
    if (dw && dw.tokenSupplyPct > 0.001) devParts.push(`👨‍💻 ${dw.tokenSupplyPct.toFixed(2)}%`);
    if (dw) {
        const devSolStr = dw.solBalance >= 1 ? dw.solBalance.toFixed(2) : dw.solBalance.toFixed(4);
        const devUsdStr = solUsdPrice > 0 ? ` [$${(dw.solBalance * solUsdPrice).toFixed(0)}]` : '';
        devParts.push(`👜 ${devSolStr} SOL${devUsdStr}`);
    }
    if (devParts.length > 0) L.push(devParts.join('  ·  '));

    // Launch history
    if (creator && creator.totalLaunches > 0) {
        const graduated = creator.recentCoins.filter(c => c.complete && c.usdMarketCap > 0);
        const topLaunch = graduated.length > 0
            ? graduated.reduce((max, c) => c.usdMarketCap > max.usdMarketCap ? c : max, graduated[0])
            : null;
        let histLine = `🚀 ${creator.totalLaunches} launch${creator.totalLaunches !== 1 ? 'es' : ''}`;
        if (topLaunch && topLaunch.usdMarketCap > 1000) {
            const coinLink = `<a href="https://pump.fun/coin/${topLaunch.mint}">$${esc(topLaunch.symbol)}</a>`;
            histLine += `  ·  Best: ${coinLink} ATH $${formatCompact(topLaunch.usdMarketCap)}`;
        }
        if (creator.scamEstimate > 0) histLine += `  ·  ⚠️ ${creator.scamEstimate} rug${creator.scamEstimate !== 1 ? 's' : ''}`;
        L.push(histLine);
    }

    // Socials links
    if (token) {
        const socialParts: string[] = [];
        if (token.twitter) socialParts.push(`<a href="${esc(token.twitter)}">Twitter</a>`);
        if (token.website) socialParts.push(`<a href="${esc(token.website)}">Website</a>`);
        if (token.telegram) socialParts.push(`<a href="${esc(token.telegram)}">Telegram</a>`);
        if (token.githubUrls && token.githubUrls.length > 0) {
            socialParts.push(`<a href="${esc(token.githubUrls[0])}">GitHub</a>`);
        }
        if (socialParts.length > 0) L.push(socialParts.join('  ·  '));
    }

    // X/Twitter profile — show @handle or "Community" link depending on URL type
    if (enrichment?.xProfile) {
        const xp = enrichment.xProfile;
        const rawHandle = token?.twitter
            ? token.twitter.replace(/.*twitter\.com\/|.*x\.com\//, '').replace(/\/+$/, '')
            : null;
        const isCommunity = rawHandle != null && rawHandle.startsWith('i/communities');
        const isRealHandle = rawHandle != null && !rawHandle.includes('/');
        if (isCommunity && token?.twitter) {
            L.push(`𝕏 <a href="${esc(token.twitter)}">Community</a>`);
        } else {
            const twitterUrl = isRealHandle && token?.twitter ? token.twitter : (xp.url ?? `https://x.com/${xp.username}`);
            const handle = isRealHandle ? rawHandle! : xp.username;
            const followerStr = xp.followers > 0 ? ` [${formatFollowerCount(xp.followers)}]` : '';
            const verifiedStr = xp.verified ? ' ✅' : '';
            L.push(`𝕏 <a href="${esc(twitterUrl)}">@${esc(handle)}</a>${followerStr}${verifiedStr}`);
        }
    } else if (token?.twitter) {
        const rawHandle = token.twitter.replace(/.*twitter\.com\/|.*x\.com\//, '').replace(/\/+$/, '');
        if (rawHandle.startsWith('i/communities')) {
            L.push(`𝕏 <a href="${esc(token.twitter)}">Community</a>`);
        } else if (!rawHandle.includes('/')) {
            L.push(`𝕏 <a href="${esc(token.twitter)}">@${esc(rawHandle)}</a>`);
        }
    }

    // ━━ TRADING LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const bots: Array<{ abbr: string; url: string }> = [
        { abbr: 'PH', url: `https://photon-sol.tinyastro.io/en/lp/${mint}` },
        { abbr: 'AX', url: `https://axiom.trade/t/${mint}` },
        { abbr: 'TJ', url: `https://t.me/paris_trojanbot?start=r-pumpdotfun-${mint}` },
        { abbr: 'BA', url: `https://t.me/BananaGunSolana_bot?start=${mint}` },
        { abbr: 'PR', url: `https://t.me/padre_bot?start=${mint}` },
        { abbr: 'BL', url: `https://t.me/bloom_trading_bot?start=${mint}` },
        { abbr: 'MA', url: `https://t.me/maestro?start=${mint}` },
        { abbr: 'MT', url: `https://t.me/MaestroProBot?start=${mint}` },
        { abbr: 'NE', url: `https://t.me/solana_bullx_bot?start=${mint}` },
        { abbr: 'XX', url: `https://pump.fun/coin/${mint}` },
    ];
    L.push(bots.map(b => `<a href="${b.url}">${b.abbr}</a>`).join(' | '));

    // ━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const txLink = `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`;
    const pfLink = `<a href="https://pump.fun/coin/${mint}">pump.fun</a>`;
    const solscanLink = `<a href="https://solscan.io/token/${mint}">Solscan</a>`;
    const dexLink = `<a href="https://dexscreener.com/solana/${mint}">DexScreener</a>`;
    L.push(`🔗 ${txLink}  ·  ${pfLink}  ·  ${solscanLink}  ·  ${dexLink}`);
    const userLink = `<a href="https://pump.fun/profile/${event.user}">${shortAddr(event.user)}</a>`;
    L.push(`by ${userLink}  ·  🕐 ${formatTime(event.timestamp)}`);

    return {
        imageUrl: token?.imageUri || null,
        caption: L.join('\n'),
    };
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

    if (event.shareholders && event.shareholders.length > 0) {
        lines.push(`👥  Shareholders (${event.shareholders.length}):`);
        for (const s of event.shareholders.slice(0, 5)) {
            const pctVal = (s.shareBps / 100).toFixed(1);
            const shareLink = `<a href="https://pump.fun/profile/${s.address}">${shortAddr(s.address)}</a>`;
            lines.push(`     • ${shareLink}  —  ${pctVal}%`);
        }
        if (event.shareholders && event.shareholders.length > 5) {
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
    if (!unixSeconds || unixSeconds < 1_000_000) return 'unknown';
    return new Date(unixSeconds * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19) + ' UTC';
}

function formatDateTime(unixSeconds: number): string {
    const d = new Date(unixSeconds * 1000);
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
    return `${d.getUTCDate()} ${mon} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;
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

/** Extract @handle from a Twitter/X URL. */
function extractTwitterHandle(url: string): string | null {
    const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i);
    if (match && match[1] && !['home', 'search', 'explore', 'settings', 'i'].includes(match[1].toLowerCase())) {
        return `@${match[1]}`;
    }
    return null;
}

