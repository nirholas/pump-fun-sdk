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
    tokenInfo?: TokenInfo | null;
    affiliates?: { axiom: string; gmgn: string; padre: string };
    /** True when this GitHub user is claiming for the very first time. */
    isFirstClaim?: boolean;
}

/**
 * GitHub Social Fee Claim card — shows a GitHub developer claiming their
 * first fee share from the PumpFun social fee PDA.
 */
export function formatGitHubClaimFeed(ctx: ClaimFeedContext): { imageUrl: string | null; caption: string } {
    const { event, solUsdPrice, githubUser, xProfile, tokenInfo } = ctx;
    const L: string[] = [];
    const mint = event.tokenMint?.trim() || '';
    const aff = ctx.affiliates;

    // ━━ HEADER: TOKEN IDENTITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ctx.isFirstClaim) {
        L.push(`🚨🚨🚨 <b>FIRST TIME CLAIM</b> 🚨🚨🚨`);
        L.push('');
    }
    if (tokenInfo) {
        const pfLink = `<a href="https://pump.fun/coin/${mint}">${esc(tokenInfo.name || mint.slice(0, 8))}</a>`;
        const ticker = tokenInfo.symbol ? ` <b>$${esc(tokenInfo.symbol)}</b>` : '';
        const mcStr = tokenInfo.usdMarketCap > 0
            ? `  💹 $${formatCompact(tokenInfo.usdMarketCap)}`
            : tokenInfo.marketCapSol > 0 ? `  💹 ${tokenInfo.marketCapSol.toFixed(1)} SOL` : '';
        L.push(`🐙${ticker} — ${pfLink}${mcStr}`);
        L.push(`  ↳ GitHub dev claimed PumpFun social fees`);
    } else {
        L.push(`🐙 <b>GitHub dev claimed PumpFun social fees</b>`);
    }

    // ━━ INFLUENCER BADGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const tier = getInfluencerTier(
        githubUser?.followers ?? 0,
        xProfile?.followers ?? null,
    );
    if (tier) L.push(influencerLabel(tier));

    // ━━ AMOUNT + RECIPIENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const claimSol = event.amountSol.toFixed(4);
    const claimUsd = solUsdPrice > 0 ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})` : '';
    L.push(`🏦 <b>${claimSol} SOL</b>${claimUsd}`);
    const recipient = event.recipientWallet ?? event.claimerWallet;
    if (recipient) {
        const recipientLink = `<a href="https://pump.fun/profile/${recipient}">${shortAddr(recipient)}</a>`;
        L.push(`  ↳ ${recipientLink}`);
    }

    // ━━ GITHUB PROFILE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (githubUser) {
        const userLink = `<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>`;
        const nameTag = githubUser.name ? ` (${esc(githubUser.name)})` : '';
        L.push(`👤 ${userLink}${nameTag}`);

        // Compact meta row
        const meta: string[] = [];
        if (githubUser.publicRepos > 0) meta.push(`📦 ${githubUser.publicRepos}`);
        if (githubUser.followers > 0) meta.push(`👁 ${githubUser.followers}`);
        if (githubUser.createdAt) meta.push(`📅 ${timeAgo(new Date(githubUser.createdAt).getTime() / 1000)}`);
        if (meta.length > 0) L.push(`  ↳ ${meta.join(' · ')}`);

        if (githubUser.bio) {
            const bio = githubUser.bio.length > 80 ? githubUser.bio.slice(0, 77) + '...' : githubUser.bio;
            L.push(`  <i>${esc(bio)}</i>`);
        }
        if (githubUser.twitterUsername) {
            const xLink = `<a href="https://x.com/${esc(githubUser.twitterUsername)}">${esc(githubUser.twitterUsername)}</a>`;
            const xFollowers = xProfile && xProfile.followers > 0 ? ` · ${formatFollowerCount(xProfile.followers)}` : '';
            L.push(`𝕏 ${xLink}${xFollowers}`);
        }
        if (githubUser.location) L.push(`📍 ${esc(githubUser.location)}`);
        if (githubUser.blog) L.push(`🌐 <a href="${esc(githubUser.blog)}">${esc(githubUser.blog.replace(/^https?:\/\//, '').slice(0, 40))}</a>`);
    } else {
        const ghIdLink = event.githubUserId
            ? `GitHub ID ${esc(event.githubUserId)}`
            : 'unknown';
        L.push(`👤 ${ghIdLink}`);
    }

    // ━━ CA + TRADING LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (mint) {
        L.push(`<code>${mint}</code>`);
        const axiomUrl = `https://axiom.trade/t/${mint}?ref=${encodeURIComponent(aff?.axiom ?? 'nich')}`;
        const gmgnUrl  = `https://gmgn.ai/sol/token/${mint}?ref=${encodeURIComponent(aff?.gmgn ?? 'nichxbt')}`;
        const padreUrl = `https://t.me/padre_trading_bot?start=token_${mint}_ref_${encodeURIComponent(aff?.padre ?? 'nichxbt')}`;
        L.push(`<a href="${axiomUrl}">Axiom</a> · <a href="${gmgnUrl}">GMGN</a> · <a href="${padreUrl}">Padre</a>`);
    } else {
        L.push(`<i>CA resolving…</i>`);
    }

    // ━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const txLink = event.txSignature
        ? `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`
        : null;
    L.push(`${txLink ? `🔍 ${txLink} · ` : ''}🕐 ${formatTime(event.timestamp)}`);

    // Token image takes priority; fall back to GitHub avatar
    const imageUrl = tokenInfo?.imageUri || githubUser?.avatarUrl || null;
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
    const coinName = token?.name ?? 'Unknown';
    const coinTicker = token?.symbol ?? '???';

    // ── Age to graduation ────────────────────────────────────────────────────
    let speedEmoji = '';
    let timeLabel = '';
    if (token && token.createdTimestamp > 0 && event.timestamp > token.createdTimestamp) {
        const seconds = event.timestamp - token.createdTimestamp;
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (seconds < 30)       { speedEmoji = '⚡️⚡️⚡️'; timeLabel = `${seconds}s`; }
        else if (seconds < 60)  { speedEmoji = '⚡️⚡️';   timeLabel = `${seconds}s`; }
        else if (seconds < 120) { speedEmoji = '⚡️';     timeLabel = `${minutes}m`; }
        else if (days > 3)      { speedEmoji = '💤';     timeLabel = `${days}d`; }
        else if (hours > 0)     { timeLabel = `${hours}h${minutes % 60 > 0 ? `${minutes % 60}m` : ''}`; }
        else                    { timeLabel = `${minutes}m`; }
    }

    // ── 🆕💊 Name — $TICKER ⚡️ [4m] ────────────────────────────────────────
    const nameLink = `<a href="https://pump.fun/coin/${mint}">${esc(coinName)}</a>`;
    const speedStr = speedEmoji ? ` ${speedEmoji}` : '';
    const ageStr   = timeLabel  ? ` [${timeLabel}]` : '';
    L.push(`🆕💊 <b>${nameLink}</b> — $${esc(coinTicker)}${speedStr}${ageStr}`);

    // ── Description subtitle (if any) ───────────────────────────────────────
    if (token?.description) {
        const desc = token.description.length > 80 ? token.description.slice(0, 77) + '...' : token.description;
        L.push(esc(desc));
    }

    // ── 💎 MC: $69K ⇨ ATH: $420K ────────────────────────────────────────────
    if (token && (token.usdMarketCap > 0 || token.marketCapSol > 0)) {
        const mcStr = token.usdMarketCap > 0
            ? `$${formatCompact(token.usdMarketCap)}`
            : `~${token.marketCapSol.toFixed(1)} SOL`;
        const athStr = token.athMarketCap > 0 && token.athMarketCap > token.usdMarketCap * 1.05
            ? ` ⇨ $${formatCompact(token.athMarketCap)}`
            : '';
        const liqStr = enrichment?.liquidity
            ? `  ⋅  💦 $${formatCompact(enrichment.liquidity.liquidityUsd)}`
            : '';
        L.push(`💎 MC: ${mcStr}${athStr}${liqStr}`);
    }

    // ── 📊 Vol: $7K ⋅ 🅑 105  Ⓢ 38 ─────────────────────────────────────────
    {
        const trades = enrichment?.trades;
        const parts: string[] = [];
        if (trades && trades.recentVolumeSol > 0) {
            const volStr = solUsdPrice > 0
                ? `$${formatCompact(trades.recentVolumeSol * solUsdPrice)}`
                : `${trades.recentVolumeSol.toFixed(1)} SOL`;
            parts.push(`Vol: ${volStr}`);
        }
        if (trades && (trades.buyCount > 0 || trades.sellCount > 0)) {
            parts.push(`🅑 ${trades.buyCount}  Ⓢ ${trades.sellCount}`);
        }
        if (enrichment?.bundle && enrichment.bundle.bundlePct > 0) {
            parts.push(`📦 ${enrichment.bundle.bundlePct.toFixed(1)}% (${enrichment.bundle.bundleWallets}w)`);
        }
        if (parts.length > 0) L.push(`📊 ${parts.join('  ⋅  ')}`);
    }

    L.push('');

    // ── 👥 TH: 4.2⋅3.1⋅2.8⋅2.6⋅2.1 [18%] ──────────────────────────────────
    const hd = enrichment?.holders;
    if (hd && hd.totalHolders > 0) {
        const nonPool = hd.topHolders.filter(h => !h.isPool);
        const top5 = nonPool.slice(0, 5).map(h => h.pct.toFixed(1)).join('⋅');
        const concStr = hd.top10Pct > 0 ? ` [${hd.top10Pct.toFixed(0)}%]` : '';
        L.push(`👥 TH: ${top5}${concStr}`);

        L.push(`🤝 Total: ${hd.totalHolders.toLocaleString()}`);

        const subParts: string[] = [];
        if (enrichment?.bundle && enrichment.bundle.bundlePct > 0) {
            subParts.push(`📦 ${enrichment.bundle.bundlePct.toFixed(1)}%`);
        }
        if (enrichment?.devWallet && enrichment.devWallet.tokenSupplyPct > 0.001) {
            subParts.push(`🧑‍💻 ${enrichment.devWallet.tokenSupplyPct.toFixed(1)}%`);
        }
        if (subParts.length > 0) L.push(`  ↳ ${subParts.join('  ⋅  ')}`);
    }

    // ── 👨‍💻 DEV ⋅ 0.42 SOL ── creator history ─────────────────────────────
    {
        const dw = enrichment?.devWallet;
        const devParts: string[] = [];
        if (creator && creator.totalLaunches > 0) {
            const rugStr = creator.scamEstimate > 0 ? ` ⚠️ ${creator.scamEstimate}` : '';
            devParts.push(`${creator.totalLaunches} launch${creator.totalLaunches !== 1 ? 'es' : ''}${rugStr}`);
            const graduated = creator.recentCoins.filter(c => c.complete && c.usdMarketCap > 1000);
            if (graduated.length > 0) {
                const best = graduated.reduce((m, c) => c.usdMarketCap > m.usdMarketCap ? c : m, graduated[0]!);
                const coinLink = `<a href="https://pump.fun/coin/${best.mint}">$${esc(best.symbol)}</a>`;
                devParts.push(`best ${coinLink} $${formatCompact(best.usdMarketCap)}`);
            }
        }
        if (dw) {
            const solStr = dw.solBalance >= 1 ? dw.solBalance.toFixed(2) : dw.solBalance.toFixed(4);
            const usdStr = solUsdPrice > 0 ? ` [$${(dw.solBalance * solUsdPrice).toFixed(0)}]` : '';
            devParts.push(`${solStr} SOL${usdStr}`);
        }
        if (devParts.length > 0) L.push(`👨‍💻 ${devParts.join('  ⋅  ')}`);
    }

    // ── 𝕏 @handle [12K] ✅ ──────────────────────────────────────────────────
    if (enrichment?.xProfile) {
        const xp = enrichment.xProfile;
        const rawHandle = token?.twitter
            ? token.twitter.replace(/.*twitter\.com\/|.*x\.com\//, '').replace(/\/+$/, '')
            : null;
        const isCommunity = rawHandle?.startsWith('i/communities');
        const isRealHandle = rawHandle != null && !rawHandle.includes('/');
        if (isCommunity && token?.twitter) {
            L.push(`𝕏 <a href="${esc(token.twitter)}">Community</a>`);
        } else {
            const url    = isRealHandle && token?.twitter ? token.twitter : (xp.url ?? `https://x.com/${xp.username}`);
            const handle = isRealHandle ? rawHandle! : xp.username;
            const follStr = xp.followers > 0 ? ` [${formatFollowerCount(xp.followers)}]` : '';
            const verStr  = xp.verified ? ' ✅' : '';
            L.push(`𝕏 <a href="${esc(url)}">@${esc(handle)}</a>${follStr}${verStr}`);
        }
    } else if (token?.twitter) {
        const rawHandle = token.twitter.replace(/.*twitter\.com\/|.*x\.com\//, '').replace(/\/+$/, '');
        if (rawHandle.startsWith('i/communities')) {
            L.push(`𝕏 <a href="${esc(token.twitter)}">Community</a>`);
        } else if (!rawHandle.includes('/')) {
            L.push(`𝕏 <a href="${esc(token.twitter)}">@${esc(rawHandle)}</a>`);
        }
    }

    // ── Other socials (website / telegram / github) ──────────────────────────
    if (token) {
        const sp: string[] = [];
        if (token.website)  sp.push(`<a href="${esc(token.website)}">🌍</a>`);
        if (token.telegram) sp.push(`<a href="${esc(token.telegram)}">✈️</a>`);
        if (token.githubUrls?.[0]) sp.push(`<a href="${esc(token.githubUrls[0])}">🐙</a>`);
        if (sp.length > 0) L.push(sp.join('  '));
    }

    // ── 💹 Chart: DEX⋅DEF  🧰 AXI⋅GMG⋅PDR⋅PHO ──────────────────────────────
    L.push(
        `💹 Chart: <a href="https://dexscreener.com/solana/${mint}">DEX</a>` +
        `⋅<a href="https://www.defined.fi/sol/${mint}">DEF</a>`,
    );
    L.push(
        `🧰 <a href="https://axiom.trade/t/${mint}">AXI</a>` +
        `⋅<a href="https://gmgn.ai/sol/token/${mint}">GMG</a>` +
        `⋅<a href="https://t.me/padre_bot?start=${mint}">PDR</a>` +
        `⋅<a href="https://photon-sol.tinyastro.io/en/lp/${mint}">PHO</a>` +
        `⋅<a href="https://bullx.io/terminal?chainId=1399811149&address=${mint}">BLX</a>`,
    );

    L.push('');

    // ── CA ───────────────────────────────────────────────────────────────────
    L.push(`<code>${mint}</code>`);

    // ── Footer ───────────────────────────────────────────────────────────────
    L.push('');
    const txLink = `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`;
    const pfLink = `<a href="https://pump.fun/coin/${mint}">pump.fun</a>`;
    L.push(`🔗 ${txLink}  ·  ${pfLink}  ·  🕐 ${formatTime(event.timestamp)}`);

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

