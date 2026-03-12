/**
 * PumpFun Channel Bot — Formatters
 *
 * Claim feed cards: GitHub social fee PDA + other event feeds.
 * Every data point on its own line, clean emoji prefix.
 */

import type { GitHubRepoInfo, GitHubUserInfo } from './github-client.js';
import type { CreatorProfile, TokenInfo, TokenTradeInfo, HolderDetails, DevWalletInfo, PoolLiquidityInfo, BundleInfo, SameNameToken } from './pump-client.js';
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
    /** True when the claim instruction was called but no event was emitted (fake/scam claim). */
    isFake?: boolean;
    /** Sequential claim number tracked by the bot (persisted across restarts). */
    claimNumber?: number;
    /** Lifetime total SOL claimed from this PDA (from on-chain event data). */
    lifetimeClaimedSol?: number;
    /** GitHub repo info fetched from token's GitHub URLs. */
    repoInfo?: GitHubRepoInfo | null;
    /** Token creator profile from PumpFun API. */
    creatorProfile?: CreatorProfile | null;
    /** Top holders + concentration data. */
    holders?: HolderDetails | null;
    /** Recent trade activity. */
    trades?: TokenTradeInfo | null;
    /** Dev wallet SOL balance + token holdings. */
    devWallet?: DevWalletInfo | null;
    /** Pool liquidity from DexScreener. */
    liquidity?: PoolLiquidityInfo | null;
    /** Coordinated early-buy (bundle) detection. */
    bundle?: BundleInfo | null;
    /** Other tokens with the same name/symbol (copycat detection). */
    sameNameTokens?: SameNameToken[] | null;
    /** All tokens this user earns social fees from (resolved from PDA → multiple SharingConfigs). */
    allLinkedTokens?: TokenInfo[] | null;
    /** Mints of all coins this GitHub user has previously claimed fees from. */
    claimedMints?: string[];
}

/**
 * GitHub Social Fee Claim card — rich Telegram HTML card with every
 * data point on its own line, grouped into clear sections.
 *
 * Layout follows: Badge → CA → Token Info → Claim Stats → Claimed By →
 * Transaction → Linked Dev → Repo Claimed → Token Market →
 * Holder Intel → Trust Signals → Chart → Socials → Separator → Trade Links
 */
export function formatGitHubClaimFeed(ctx: ClaimFeedContext): { imageUrl: string | null; caption: string } {
    const { event, solUsdPrice, githubUser, xProfile, tokenInfo } = ctx;
    const L: string[] = [];
    const mint = event.tokenMint?.trim() || '';
    const aff = ctx.affiliates;

    // ━━ HEADER BADGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`🚨🚨🚨 <b>FIRST CREATOR FEE CLAIM</b>`);

    // Influencer badge right after header
    const tier = getInfluencerTier(
        githubUser?.followers ?? 0,
        xProfile?.followers ?? null,
    );
    if (tier) L.push(influencerLabel(tier));
    L.push('');

    // ━━ CA (CONTRACT ADDRESS) ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mint) {
        L.push(`<code>${mint}</code>`);
        L.push('');
    }

    // ━━ TOKEN INFO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (tokenInfo) {
        const ticker = tokenInfo.symbol ? `<b>$${esc(tokenInfo.symbol)}</b>` : '';
        const name = tokenInfo.name ? esc(tokenInfo.name) : '';
        L.push(`🐙 ${ticker}${ticker && name ? ' — ' : ''}${name}`);
        if (tokenInfo.usdMarketCap > 0) {
            L.push(`💰 MC: $${formatCompact(tokenInfo.usdMarketCap)}`);
        } else if (tokenInfo.marketCapSol > 0) {
            L.push(`💰 MC: ${tokenInfo.marketCapSol.toFixed(1)} SOL`);
        }
        if (tokenInfo.priceSol > 0) {
            const priceUsd = solUsdPrice > 0 ? ` ($${formatPriceUsd(tokenInfo.priceSol * solUsdPrice)})` : '';
            L.push(`💲 Price: ${formatPriceSol(tokenInfo.priceSol)} SOL${priceUsd}`);
        }
        if (tokenInfo.createdTimestamp > 0) {
            L.push(`⏱ Created: ${timeAgo(tokenInfo.createdTimestamp)}`);
        }
        if (tokenInfo.complete) {
            L.push('🎓 Status: Graduated (AMM)');
            if (tokenInfo.pumpSwapPool) {
                L.push(`🏊 Pool: <code>${tokenInfo.pumpSwapPool}</code>`);
            }
        } else if (tokenInfo.curveProgress > 0) {
            const pct = Math.round(tokenInfo.curveProgress);
            L.push(`📈 Status: Bonding curve (${pct > 0 ? `${pct}%` : '<1%'})`);
        } else {
            L.push('📈 Status: Bonding curve');
        }
        if (tokenInfo.athMarketCap > 0) {
            L.push(`🏆 ATH: $${formatCompact(tokenInfo.athMarketCap)}`);
        }
        if (ctx.liquidity) {
            L.push(`💦 Liquidity: $${formatCompact(ctx.liquidity.liquidityUsd)}`);
        }
        if (tokenInfo.replyCount > 0) {
            L.push(`💬 Replies: ${tokenInfo.replyCount}`);
        }
        if (tokenInfo.lastTradeTimestamp > 0) {
            L.push(`🕐 Last trade: ${timeAgo(tokenInfo.lastTradeTimestamp)}`);
        }
        if (tokenInfo.kothTimestamp > 0) {
            L.push(`👑 KotH: ${timeAgo(tokenInfo.kothTimestamp)}`);
        }
        L.push('');
    }

    // ━━ ALL LINKED COINS (multi-token PDA) ━━━━━━━━━━━━━━
    if (ctx.allLinkedTokens && ctx.allLinkedTokens.length > 1) {
        const MAX_LINKED = 3;
        L.push(`🪙 <b>All Linked Coins (${ctx.allLinkedTokens.length})</b>`);
        for (const t of ctx.allLinkedTokens.slice(0, MAX_LINKED)) {
            const mc = t.usdMarketCap > 0 ? `$${formatCompact(t.usdMarketCap)}` : '?';
            const status = t.complete ? '🎓' : '📈';
            const shortMint = `${t.mint.slice(0, 6)}…`;
            const isPrimary = tokenInfo && t.mint === tokenInfo.mint;
            const tag = isPrimary ? ' ◂' : '';
            L.push(`${status} <a href="https://pump.fun/coin/${esc(t.mint)}">${esc(t.symbol)}</a> — ${mc} — ${shortMint}${tag}`);
        }
        if (ctx.allLinkedTokens.length > MAX_LINKED) {
            L.push(`… +${ctx.allLinkedTokens.length - MAX_LINKED} more`);
        }
        L.push('');
    }

    // ━━ CLAIM STATS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`💸 <b>Claim Stats</b>`);
    L.push(`Claim #1`);
    const claimSol = event.amountSol.toFixed(4);
    const claimUsd = solUsdPrice > 0 ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})` : '';
    L.push(`${claimSol} SOL${claimUsd}`);
    if (ctx.lifetimeClaimedSol != null && ctx.lifetimeClaimedSol > 0) {
        const ltUsd = solUsdPrice > 0 ? ` ($${(ctx.lifetimeClaimedSol * solUsdPrice).toFixed(2)})` : '';
        L.push(`Lifetime claims: ${ctx.lifetimeClaimedSol.toFixed(4)} SOL${ltUsd}`);
    }
    L.push(`Type: ${esc(event.claimLabel)}`);
    L.push('');

    // ━━ COINS CLAIMED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ctx.claimedMints && ctx.claimedMints.length > 0) {
        // Exclude the current mint from the "previously claimed" list
        const previousMints = ctx.claimedMints.filter((m) => m !== mint);
        const total = previousMints.length + 1; // +1 for current claim
        L.push(`🪙 <b>Coins Claimed: ${total}</b>`);
        if (mint) {
            L.push(`<a href="https://pump.fun/coin/${mint}">${mint.slice(0, 6)}…</a> ◂ current`);
        }
        for (const m of previousMints.slice(0, 10)) {
            L.push(`<a href="https://pump.fun/coin/${m}">${m.slice(0, 6)}…</a>`);
        }
        if (previousMints.length > 10) {
            L.push(`… and ${previousMints.length - 10} more`);
        }
        L.push('');
    }

    // ━━ CLAIMED BY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`👛 <b>Claimed By</b>`);
    const recipient = event.recipientWallet ?? event.claimerWallet;
    if (recipient) {
        L.push(`<code>${shortAddr(recipient)}</code>`);
        L.push(`🔗 <a href="https://pump.fun/profile/${recipient}">pump.fun/profile/${shortAddr(recipient)}</a>`);
    }
    L.push('');

    // ━━ TRANSACTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (event.txSignature) {
        L.push(`🔎 <b>Transaction</b>`);
        L.push(`<a href="https://solscan.io/tx/${event.txSignature}">solscan.io/tx/${event.txSignature.slice(0, 20)}…</a>`);
        L.push('');
    }

    // ━━ LINKED DEV (GITHUB) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`👨‍💻 <b>Linked Dev</b>`);
    if (githubUser) {
        const nameTag = githubUser.name ? ` (${esc(githubUser.name)})` : '';
        L.push(`<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>${nameTag}`);
        L.push(`📦 Repos: <a href="${esc(githubUser.htmlUrl)}?tab=repositories">${githubUser.publicRepos}</a>`);
        if (githubUser.followers > 0) L.push(`👁 Followers: ${githubUser.followers}`);
        if (githubUser.following > 0) L.push(`👥 Following: ${githubUser.following}`);
        if (githubUser.createdAt) L.push(`📅 Account age: ${timeAgo(new Date(githubUser.createdAt).getTime() / 1000)}`);
        if (githubUser.company) L.push(`🏢 Company: ${esc(githubUser.company)}`);
        if (githubUser.location) L.push(`📍 Location: ${esc(githubUser.location)}`);
        if (githubUser.hireable) L.push(`💼 Hireable: Yes`);
        if (githubUser.bio) {
            const bio = githubUser.bio.length > 100 ? githubUser.bio.slice(0, 97) + '...' : githubUser.bio;
            L.push(`<i>${esc(bio)}</i>`);
        }
        if (githubUser.blog) {
            const blogDisplay = githubUser.blog.replace(/^https?:\/\//, '').slice(0, 40);
            L.push(`🌐 <a href="${esc(githubUser.blog)}">${esc(blogDisplay)}</a>`);
        }
        if (githubUser.twitterUsername) {
            const handle = cleanXHandle(githubUser.twitterUsername);
            if (handle) {
                L.push(`𝕏 <a href="https://x.com/${esc(handle)}">${esc(handle)}</a>`);
                if (xProfile && xProfile.followers > 0) {
                    L.push(`𝕏 Followers: ${formatFollowerCount(xProfile.followers)}`);
                }
            }
        }
    } else {
        const ghId = event.githubUserId ?? 'unknown';
        L.push(`GitHub ID: ${esc(ghId)}`);
    }
    L.push('');

    // ━━ REPO CLAIMED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ctx.repoInfo) {
        L.push(`📂 <b>Repo Claimed</b>`);
        L.push(`<a href="${esc(ctx.repoInfo.htmlUrl)}">${esc(ctx.repoInfo.fullName)}</a>`);
        if (ctx.repoInfo.description) {
            const desc = ctx.repoInfo.description.length > 100 ? ctx.repoInfo.description.slice(0, 97) + '...' : ctx.repoInfo.description;
            L.push(`<i>${esc(desc)}</i>`);
        }
        if (ctx.repoInfo.language) L.push(`🔤 Language: ${esc(ctx.repoInfo.language)}`);
        if (ctx.repoInfo.stars > 0) L.push(`⭐ Stars: ${ctx.repoInfo.stars}`);
        if (ctx.repoInfo.forks > 0) L.push(`🍴 Forks: ${ctx.repoInfo.forks}`);
        if (ctx.repoInfo.openIssues > 0) L.push(`📋 Open issues: ${ctx.repoInfo.openIssues}`);
        if (ctx.repoInfo.commitCount != null && ctx.repoInfo.commitCount > 0) L.push(`📝 Commits: ${ctx.repoInfo.commitCount}`);
        if (ctx.repoInfo.lastPushAgo) L.push(`🕐 Last push: ${ctx.repoInfo.lastPushAgo}`);
        if (ctx.repoInfo.createdAt) L.push(`📅 Repo created: ${timeAgo(new Date(ctx.repoInfo.createdAt).getTime() / 1000)}`);
        if (ctx.repoInfo.defaultBranch && ctx.repoInfo.defaultBranch !== 'main') L.push(`🌿 Branch: ${esc(ctx.repoInfo.defaultBranch)}`);
        if (ctx.repoInfo.topics.length > 0) L.push(`🏷 Topics: ${ctx.repoInfo.topics.map(t => esc(t)).join(', ')}`);
        if (ctx.repoInfo.isFork) L.push('⚠️ This is a fork');
        L.push('');
    } else if (tokenInfo?.githubUrls?.length) {
        const repoUrl = tokenInfo.githubUrls[0]!;
        const repoPath = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
        const isRepoUrl = repoPath.includes('/');
        L.push(`📂 <b>${isRepoUrl ? 'Repo Claimed' : 'GitHub Linked'}</b>`);
        L.push(`<a href="${esc(repoUrl)}">${esc(repoPath)}</a>`);
        if (!isRepoUrl) L.push(`<i>Profile linked — no specific repo</i>`);
        L.push('');
    }

    // ━━ TOKEN CREATOR (PUMP PROFILE) ━━━━━━━━━━━━━━━━━━━━
    if (ctx.creatorProfile) {
        const cp = ctx.creatorProfile;
        L.push(`🧑‍💻 <b>Token Creator</b>`);
        const creatorLink = `<a href="https://pump.fun/profile/${cp.wallet}">${shortAddr(cp.wallet)}</a>`;
        const uname = cp.username ? ` @${esc(cp.username)}` : '';
        L.push(`${creatorLink}${uname}`);
        if (cp.totalLaunches > 0) L.push(`🚀 Launches: ${cp.totalLaunches}`);
        const graduated = cp.recentCoins.filter(c => c.complete).length;
        if (graduated > 0) L.push(`🎓 Graduated: ${graduated}`);
        if (cp.scamEstimate > 0) L.push(`⚠️ Rugs: ${cp.scamEstimate}`);
        if (cp.followers > 0) L.push(`👁 Followers: ${formatCount(cp.followers)}`);
        // Recent coins
        const coins = cp.recentCoins.slice(0, 3);
        if (coins.length > 0) {
            const tickers = coins.map(c => {
                const g = c.complete ? '⭐' : '';
                const mcap = c.usdMarketCap > 0 ? ` [${formatCompact(c.usdMarketCap)}]` : '';
                return `<a href="https://pump.fun/coin/${c.mint}">${esc(c.symbol)}</a>${g}${mcap}`;
            });
            const more = cp.recentCoins.length > 3 ? ` … +${cp.recentCoins.length - 3}` : '';
            L.push(`🪙 ${tickers.join(' · ')}${more}`);
        }
        L.push('');
    }

    // ━━ MARKET DATA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        const parts: string[] = [];
        if (ctx.trades) {
            if (ctx.trades.recentVolumeSol > 0) {
                const volStr = solUsdPrice > 0
                    ? `$${formatCompact(ctx.trades.recentVolumeSol * solUsdPrice)}`
                    : `${ctx.trades.recentVolumeSol.toFixed(1)} SOL`;
                parts.push(`Vol: ${volStr}`);
            }
            if (ctx.trades.buyCount > 0 || ctx.trades.sellCount > 0) {
                parts.push(`🅑 ${ctx.trades.buyCount}  Ⓢ ${ctx.trades.sellCount}`);
            }
            if (ctx.trades.recentTradeCount > 0) {
                parts.push(`Trades: ${ctx.trades.recentTradeCount}`);
            }
        }
        if (ctx.bundle && ctx.bundle.bundlePct > 0) {
            parts.push(`📦 Bundle: ${ctx.bundle.bundlePct.toFixed(1)}% (${ctx.bundle.bundleWallets}w)`);
        }
        if (parts.length > 0) {
            L.push(`📊 <b>Market</b>`);
            for (const p of parts) L.push(p);
            L.push('');
        }
    }

    // ━━ HOLDER INTEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ctx.holders && ctx.holders.totalHolders > 0) {
        const hd = ctx.holders;
        L.push(`👥 <b>Holders</b>`);
        L.push(`🤝 Total: ${hd.totalHolders.toLocaleString()}`);
        const nonPool = hd.topHolders.filter(h => !h.isPool);
        if (nonPool.length > 0) {
            const top5 = nonPool.slice(0, 5).map(h => h.pct.toFixed(1)).join('⋅');
            const concStr = hd.top10Pct > 0 ? ` [top10: ${hd.top10Pct.toFixed(0)}%]` : '';
            L.push(`📊 Top5: ${top5}${concStr}`);
        }
        if (ctx.devWallet && ctx.devWallet.tokenSupplyPct > 0.001) {
            L.push(`🧑‍💻 Dev holds: ${ctx.devWallet.tokenSupplyPct.toFixed(1)}%`);
        }
        L.push('');
    }



    // ━━ TRUST SIGNALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        const signals: string[] = [];

        // ── Claim verification: does the token's GitHub URL match the claiming user? ──
        if (githubUser && tokenInfo) {
            const claimerLogin = githubUser.login.toLowerCase();
            const ghUrls = tokenInfo.githubUrls ?? [];
            if (ghUrls.length > 0) {
                // Extract owner from first GitHub URL (github.com/OWNER or github.com/OWNER/REPO)
                const ownerMatch = ghUrls[0]!
                    .replace(/^https?:\/\/github\.com\//, '')
                    .replace(/\/+$/, '')
                    .split('/')[0]?.toLowerCase();
                if (ownerMatch === claimerLogin) {
                    signals.push(`✅ Verified — token GitHub matches claimer`);
                } else if (ownerMatch) {
                    signals.push(`🚩 Mismatch — token GitHub is <b>${esc(ownerMatch)}</b>, claimer is <b>${esc(githubUser.login)}</b>`);
                }
            } else {
                signals.push(`⚠️ Unverified — token has no GitHub link`);
            }
        }

        // Copycat warning: higher-MC token with same name exists
        if (ctx.sameNameTokens?.length && tokenInfo) {
            const top = ctx.sameNameTokens[0]!;
            if (top.usdMarketCap > tokenInfo.usdMarketCap * 5) {
                signals.push(`🚩 Possible copycat — ${esc(top.symbol)} exists at $${formatCompact(top.usdMarketCap)}`);
            }
        }

        const warnings: string[] = [];
        if (githubUser?.createdAt) {
            const accountAgeDays = (Date.now() - new Date(githubUser.createdAt).getTime()) / 86_400_000;
            if (accountAgeDays < 30) {
                warnings.push(`⚠️ New GitHub account (${Math.floor(accountAgeDays)}d old)`);
            }
        }
        if (githubUser && githubUser.publicRepos === 0) {
            warnings.push('⚠️ 0 public repos');
        }
        if (ctx.repoInfo?.isFork) {
            warnings.push('⚠️ Claimed repo is a fork');
        }
        if (ctx.bundle && ctx.bundle.bundlePct >= 5) {
            warnings.push(`📦 Bundled launch (${ctx.bundle.bundlePct.toFixed(1)}%)`);
        }
        if (ctx.creatorProfile && ctx.creatorProfile.scamEstimate >= 3) {
            warnings.push(`⚠️ Creator has ${ctx.creatorProfile.scamEstimate} suspected rugs`);
        }
        if (ctx.holders && ctx.holders.top10Pct >= 50) {
            warnings.push(`⚠️ Top10 hold ${ctx.holders.top10Pct.toFixed(0)}% of supply`);
        }
        if (tokenInfo?.isNsfw) warnings.push('🔞 NSFW');
        if (tokenInfo?.isBanned) warnings.push('🚫 BANNED');
        if (tokenInfo?.isCashbackEnabled) warnings.push('💸 Cashback enabled');
        if (tokenInfo?.isHackathon) warnings.push('🏗 Hackathon token');

        const all = [...signals, ...warnings];
        if (all.length > 0) {
            L.push(`⚡ <b>Signals</b>`);
            for (const s of all) L.push(s);
            L.push('');
        }
    }

    // ━━ SAME-NAME TOKENS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ctx.sameNameTokens && ctx.sameNameTokens.length > 0) {
        const MAX_SAME_NAME = 3;
        const top = ctx.sameNameTokens[0]!;
        const isCopycat = tokenInfo && top.usdMarketCap > tokenInfo.usdMarketCap * 5;
        if (isCopycat) {
            L.push(`🚩 <b>Same Name Tokens — possible copycat</b>`);
            L.push(`This token: $${formatCompact(tokenInfo!.usdMarketCap)}`);
        } else {
            L.push(`🔍 <b>Same Name Tokens</b>`);
        }
        for (const t of ctx.sameNameTokens.slice(0, MAX_SAME_NAME)) {
            const mc = `$${formatCompact(t.usdMarketCap)}`;
            const age = t.age ? ` ${t.age}` : '';
            const shortMint = t.mint.length > 8 ? `${t.mint.slice(0, 6)}…` : t.mint;
            L.push(`• <a href="${esc(t.url)}">${esc(t.symbol)}</a> ${mc} — ${shortMint}${age}`);
        }
        if (ctx.sameNameTokens.length > MAX_SAME_NAME) {
            L.push(`… +${ctx.sameNameTokens.length - MAX_SAME_NAME} more`);
        }
        L.push('');
    }

    // ━━ CHART ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mint) {
        L.push(`📊 <a href="https://pump.fun/coin/${mint}">pump.fun/coin/${mint.slice(0, 12)}…</a>`);
    }

    // ━━ SOCIALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (tokenInfo) {
        if (tokenInfo.twitter) {
            const handle = cleanXHandle(tokenInfo.twitter);
            if (handle) {
                L.push(`𝕏 <a href="https://x.com/${esc(handle)}">${esc(handle)}</a>`);
            } else {
                L.push(`𝕏 <a href="${esc(tokenInfo.twitter)}">Twitter</a>`);
            }
        }
        if (tokenInfo.telegram) {
            L.push(`💬 <a href="${esc(tokenInfo.telegram)}">Telegram</a>`);
        }
        if (tokenInfo.website) {
            const host = tokenInfo.website.replace(/^https?:\/\//, '').replace(/\/+$/, '').slice(0, 30);
            L.push(`🌐 <a href="${esc(tokenInfo.website)}">${esc(host)}</a>`);
        }
    }
    L.push('');

    // ━━ SEPARATOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('━━━━━━━━━━━━━━━━');
    L.push('');

    // ━━ TRADE LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mint) {
        const axiomUrl = `https://axiom.trade/t/${mint}?ref=${encodeURIComponent(aff?.axiom ?? 'nich')}`;
        const gmgnUrl  = `https://gmgn.ai/sol/token/${mint}?ref=${encodeURIComponent(aff?.gmgn ?? 'nichxbt')}`;
        const padreUrl = `https://trade.padre.gg/rk/${encodeURIComponent(aff?.padre ?? 'nichxbt')}`;
        L.push(`💹 Trade`);
        L.push(`<a href="${axiomUrl}">Axiom</a> | <a href="${gmgnUrl}">GMGN</a> | <a href="${padreUrl}">Padre</a>`);
    }

    // ━━ TLDR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    L.push('━━━━━━━━━━━━━━━━');
    L.push('<b>TLDR</b>');
    if (tokenInfo) {
        const ticker = tokenInfo.symbol ? `<b>$${esc(tokenInfo.symbol)}</b>` : '';
        const name = tokenInfo.name ? esc(tokenInfo.name) : '';
        L.push(`🐙 ${ticker}${ticker && name ? ' — ' : ''}${name}`);
        if (tokenInfo.usdMarketCap > 0) {
            L.push(`💰 MC: $${formatCompact(tokenInfo.usdMarketCap)}`);
        } else if (tokenInfo.marketCapSol > 0) {
            L.push(`💰 MC: ${tokenInfo.marketCapSol.toFixed(1)} SOL`);
        }
        if (tokenInfo.complete) {
            L.push('🎓 Status: Graduated (AMM)');
        } else if (tokenInfo.curveProgress > 0) {
            const pct = Math.round(tokenInfo.curveProgress);
            L.push(`📈 Status: Bonding curve (${pct > 0 ? `${pct}%` : '<1%'})`);
        }
        if (tokenInfo.athMarketCap > 0) {
            L.push(`🏆 ATH: $${formatCompact(tokenInfo.athMarketCap)}`);
        }
    }
    L.push('');
    if (githubUser) {
        const nameTag = githubUser.name ? ` (${esc(githubUser.name)})` : '';
        L.push(`👨‍💻 Linked Dev`);
        L.push(`<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>${nameTag}`);
        if (githubUser.publicRepos > 0) L.push(`📦 Repos: ${githubUser.publicRepos}`);
        if (githubUser.followers > 0) L.push(`👁 Followers: ${githubUser.followers}`);
        if (githubUser.createdAt) L.push(`📅 Account age: ${timeAgo(new Date(githubUser.createdAt).getTime() / 1000)}`);
        if (githubUser.company) L.push(`🏢 Company: ${esc(githubUser.company)}`);
        if (githubUser.blog) {
            const blogDisplay = githubUser.blog.replace(/^https?:\/\//, '').replace(/\/+$/, '');
            L.push(`🌐 <a href="${esc(githubUser.blog)}">${esc(blogDisplay)}</a>`);
        }
        if (githubUser.twitterUsername) {
            const handle = cleanXHandle(githubUser.twitterUsername);
            if (handle) L.push(`𝕏 <a href="https://x.com/${esc(handle)}">${esc(handle)}</a>`);
        }
        L.push('');
    }
    if (ctx.repoInfo) {
        L.push(`📂 GitHub Linked`);
        L.push(`<a href="${esc(ctx.repoInfo.htmlUrl)}">${esc(ctx.repoInfo.fullName)}</a>`);
    } else if (tokenInfo?.githubUrls?.length) {
        const repoUrl = tokenInfo.githubUrls[0]!;
        const repoPath = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
        const isRepoUrl = repoPath.includes('/');
        L.push(`📂 ${isRepoUrl ? 'Repo Linked' : 'GitHub Linked'}`);
        L.push(`<a href="${esc(repoUrl)}">${esc(repoPath)}</a>`);
        if (!isRepoUrl) L.push(`<i>Profile linked — no specific repo</i>`);
    }
    L.push('');
    if (mint) {
        L.push(`CA: <code>${mint}</code>`);
    }

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
    tokenInfo?: TokenInfo | null;
    holders?: HolderDetails | null;
    trades?: TokenTradeInfo | null;
    devWallet?: DevWalletInfo | null;
    liquidity?: PoolLiquidityInfo | null;
    bundle?: BundleInfo | null;
    sameNameTokens?: SameNameToken[] | null;
    affiliates?: { axiom: string; gmgn: string; padre: string };
}

/**
 * Creator fee claim card — rich card with token info, creator profile,
 * market data, holder intel, signals, same-name tokens, and trade links.
 */
export function formatCreatorClaimFeed(ctx: CreatorClaimContext): { imageUrl: string | null; caption: string } {
    const { event, solUsdPrice, creator, tokenInfo } = ctx;
    const L: string[] = [];
    const mint = event.tokenMint?.trim() || '';
    const aff = ctx.affiliates;

    // ━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`💰 <b>Creator Claimed Fees</b>`);
    L.push('');

    // ━━ CA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mint) {
        L.push(`<code>${mint}</code>`);
        L.push('');
    }

    // ━━ TOKEN INFO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (tokenInfo) {
        const ticker = tokenInfo.symbol ? `<b>$${esc(tokenInfo.symbol)}</b>` : '';
        const name = tokenInfo.name ? esc(tokenInfo.name) : '';
        L.push(`🐙 ${ticker}${ticker && name ? ' — ' : ''}${name}`);
        if (tokenInfo.usdMarketCap > 0) {
            L.push(`💰 MC: $${formatCompact(tokenInfo.usdMarketCap)}`);
        } else if (tokenInfo.marketCapSol > 0) {
            L.push(`💰 MC: ${tokenInfo.marketCapSol.toFixed(1)} SOL`);
        }
        if (tokenInfo.priceSol > 0) {
            const priceUsd = solUsdPrice > 0 ? ` ($${formatPriceUsd(tokenInfo.priceSol * solUsdPrice)})` : '';
            L.push(`💲 Price: ${formatPriceSol(tokenInfo.priceSol)} SOL${priceUsd}`);
        }
        if (tokenInfo.createdTimestamp > 0) {
            L.push(`⏱ Created: ${timeAgo(tokenInfo.createdTimestamp)}`);
        }
        if (tokenInfo.complete) {
            L.push('🎓 Status: Graduated (AMM)');
            if (tokenInfo.pumpSwapPool) {
                L.push(`🏊 Pool: <code>${tokenInfo.pumpSwapPool}</code>`);
            }
        } else if (tokenInfo.curveProgress > 0) {
            const pct = Math.round(tokenInfo.curveProgress);
            L.push(`📈 Status: Bonding curve (${pct > 0 ? `${pct}%` : '<1%'})`);
        } else {
            L.push('📈 Status: Bonding curve');
        }
        if (tokenInfo.athMarketCap > 0) {
            L.push(`🏆 ATH: $${formatCompact(tokenInfo.athMarketCap)}`);
        }
        if (ctx.liquidity) {
            L.push(`💦 Liquidity: $${formatCompact(ctx.liquidity.liquidityUsd)}`);
        }
        if (tokenInfo.replyCount > 0) {
            L.push(`💬 Replies: ${tokenInfo.replyCount}`);
        }
        if (tokenInfo.lastTradeTimestamp > 0) {
            L.push(`🕐 Last trade: ${timeAgo(tokenInfo.lastTradeTimestamp)}`);
        }
        if (tokenInfo.kothTimestamp > 0) {
            L.push(`👑 KotH: ${timeAgo(tokenInfo.kothTimestamp)}`);
        }
        L.push('');
    }

    // ━━ CLAIM STATS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`💸 <b>Claim Stats</b>`);
    const claimSol = event.amountSol.toFixed(4);
    const claimUsd = solUsdPrice > 0 ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})` : '';
    L.push(`${claimSol} SOL${claimUsd}`);
    L.push(`Type: ${esc(event.claimLabel)}`);
    L.push('');

    // ━━ CREATOR PROFILE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const wallet = event.claimerWallet;
    const profileLink = `<a href="https://pump.fun/profile/${wallet}">${shortAddr(wallet)}</a>`;
    const uname = creator?.username ? ` @${esc(creator.username)}` : '';
    L.push(`🧑‍💻 <b>Token Creator</b>`);
    L.push(`${profileLink}${uname}`);

    if (creator) {
        if (creator.totalLaunches > 0) L.push(`🚀 Launches: ${creator.totalLaunches}`);
        const graduated = creator.recentCoins.filter((c) => c.complete).length;
        if (graduated > 0) L.push(`🎓 Graduated: ${graduated}`);
        if (creator.scamEstimate > 0) L.push(`⚠️ Rugs: ${creator.scamEstimate}`);
        if (creator.followers > 0) L.push(`👁 Followers: ${formatCount(creator.followers)}`);

        // Show recent coins
        const coins = creator.recentCoins.slice(0, 5);
        if (coins.length > 0) {
            const tickers = coins.map((c) => {
                const g = c.complete ? '⭐' : '';
                const mcap = c.usdMarketCap > 0 ? ` [${formatCompact(c.usdMarketCap)}]` : '';
                return `<a href="https://pump.fun/coin/${c.mint}">${esc(c.symbol)}</a>${g}${mcap}`;
            });
            const more = creator.recentCoins.length > 5 ? ` … +${creator.recentCoins.length - 5}` : '';
            L.push(`🪙 ${tickers.join(' · ')}${more}`);
        }
    }
    L.push('');

    // ━━ MARKET DATA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        const parts: string[] = [];
        if (ctx.trades) {
            if (ctx.trades.recentVolumeSol > 0) {
                const volStr = solUsdPrice > 0
                    ? `$${formatCompact(ctx.trades.recentVolumeSol * solUsdPrice)}`
                    : `${ctx.trades.recentVolumeSol.toFixed(1)} SOL`;
                parts.push(`Vol: ${volStr}`);
            }
            if (ctx.trades.buyCount > 0 || ctx.trades.sellCount > 0) {
                parts.push(`🅑 ${ctx.trades.buyCount}  Ⓢ ${ctx.trades.sellCount}`);
            }
            if (ctx.trades.recentTradeCount > 0) {
                parts.push(`Trades: ${ctx.trades.recentTradeCount}`);
            }
        }
        if (ctx.bundle && ctx.bundle.bundlePct > 0) {
            parts.push(`📦 Bundle: ${ctx.bundle.bundlePct.toFixed(1)}% (${ctx.bundle.bundleWallets}w)`);
        }
        if (parts.length > 0) {
            L.push(`📊 <b>Market</b>`);
            for (const p of parts) L.push(p);
            L.push('');
        }
    }

    // ━━ HOLDER INTEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ctx.holders && ctx.holders.totalHolders > 0) {
        const hd = ctx.holders;
        L.push(`👥 <b>Holders</b>`);
        L.push(`🤝 Total: ${hd.totalHolders.toLocaleString()}`);
        const nonPool = hd.topHolders.filter(h => !h.isPool);
        if (nonPool.length > 0) {
            const top5 = nonPool.slice(0, 5).map(h => h.pct.toFixed(1)).join('⋅');
            const concStr = hd.top10Pct > 0 ? ` [top10: ${hd.top10Pct.toFixed(0)}%]` : '';
            L.push(`📊 Top5: ${top5}${concStr}`);
        }
        if (ctx.devWallet && ctx.devWallet.tokenSupplyPct > 0.001) {
            L.push(`🧑‍💻 Dev holds: ${ctx.devWallet.tokenSupplyPct.toFixed(1)}%`);
        }
        L.push('');
    }

    // ━━ TRUST SIGNALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        const signals: string[] = [];
        if (ctx.sameNameTokens?.length && tokenInfo) {
            const top = ctx.sameNameTokens[0]!;
            if (top.usdMarketCap > tokenInfo.usdMarketCap * 5) {
                signals.push(`🚩 Possible copycat — ${esc(top.symbol)} exists at $${formatCompact(top.usdMarketCap)}`);
            }
        }
        if (ctx.bundle && ctx.bundle.bundlePct >= 5) {
            signals.push(`📦 Bundled launch (${ctx.bundle.bundlePct.toFixed(1)}%)`);
        }
        if (creator && creator.scamEstimate >= 3) {
            signals.push(`⚠️ Creator has ${creator.scamEstimate} suspected rugs`);
        }
        if (ctx.holders && ctx.holders.top10Pct >= 50) {
            signals.push(`⚠️ Top10 hold ${ctx.holders.top10Pct.toFixed(0)}% of supply`);
        }
        if (tokenInfo?.isNsfw) signals.push('🔞 NSFW');
        if (tokenInfo?.isBanned) signals.push('🚫 BANNED');
        if (tokenInfo?.isCashbackEnabled) signals.push('💸 Cashback enabled');
        if (tokenInfo?.isHackathon) signals.push('🏗 Hackathon token');

        if (signals.length > 0) {
            L.push(`⚡ <b>Signals</b>`);
            for (const s of signals) L.push(s);
            L.push('');
        }
    }

    // ━━ SAME-NAME TOKENS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ctx.sameNameTokens && ctx.sameNameTokens.length > 0) {
        const MAX_SAME_NAME = 5;
        const top = ctx.sameNameTokens[0]!;
        const isCopycat = tokenInfo && top.usdMarketCap > tokenInfo.usdMarketCap * 5;
        if (isCopycat) {
            L.push(`🚩 <b>Same Name Tokens — possible copycat</b>`);
            L.push(`This token: $${formatCompact(tokenInfo!.usdMarketCap)}`);
        } else {
            L.push(`🔍 <b>Same Name Tokens</b>`);
        }
        for (const t of ctx.sameNameTokens.slice(0, MAX_SAME_NAME)) {
            const mc = `$${formatCompact(t.usdMarketCap)}`;
            const age = t.age ? ` ${t.age}` : '';
            const shortMint = t.mint.length > 8 ? `${t.mint.slice(0, 6)}…` : t.mint;
            L.push(`• <a href="${esc(t.url)}">${esc(t.symbol)}</a> ${mc} — ${shortMint}${age}`);
        }
        if (ctx.sameNameTokens.length > MAX_SAME_NAME) {
            L.push(`… +${ctx.sameNameTokens.length - MAX_SAME_NAME} more`);
        }
        L.push('');
    }

    // ━━ TRANSACTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (event.txSignature) {
        L.push(`🔎 <b>Transaction</b>`);
        L.push(`<a href="https://solscan.io/tx/${event.txSignature}">solscan.io/tx/${event.txSignature.slice(0, 20)}…</a>`);
        L.push('');
    }

    // ━━ CHART ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mint) {
        L.push(`📊 <a href="https://pump.fun/coin/${mint}">pump.fun/coin/${mint.slice(0, 12)}…</a>`);
    }

    // ━━ SOCIALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (tokenInfo) {
        if (tokenInfo.twitter) {
            const handle = cleanXHandle(tokenInfo.twitter);
            if (handle) {
                L.push(`𝕏 <a href="https://x.com/${esc(handle)}">${esc(handle)}</a>`);
            } else {
                L.push(`𝕏 <a href="${esc(tokenInfo.twitter)}">Twitter</a>`);
            }
        }
        if (tokenInfo.telegram) {
            L.push(`💬 <a href="${esc(tokenInfo.telegram)}">Telegram</a>`);
        }
        if (tokenInfo.website) {
            const host = tokenInfo.website.replace(/^https?:\/\//, '').replace(/\/+$/, '').slice(0, 30);
            L.push(`🌐 <a href="${esc(tokenInfo.website)}">${esc(host)}</a>`);
        }
    }
    L.push('');

    // ━━ SEPARATOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('━━━━━━━━━━━━━━━━');
    L.push('');

    // ━━ TRADE LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mint) {
        const axiomUrl = `https://axiom.trade/t/${mint}?ref=${encodeURIComponent(aff?.axiom ?? 'nich')}`;
        const gmgnUrl  = `https://gmgn.ai/sol/token/${mint}?ref=${encodeURIComponent(aff?.gmgn ?? 'nichxbt')}`;
        const padreUrl = `https://trade.padre.gg/rk/${encodeURIComponent(aff?.padre ?? 'nichxbt')}`;
        L.push(`💹 Trade`);
        L.push(`<a href="${axiomUrl}">Axiom</a> | <a href="${gmgnUrl}">GMGN</a> | <a href="${padreUrl}">Padre</a>`);
    }

    // ━━ CA FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mint) {
        L.push('');
        L.push(`<code>${mint}</code>`);
    }

    // ━━ SEPARATOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    L.push('━━━━━━━━━━━━━━━━');

    // ━━ TLDR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('<b>TLDR</b>');
    if (tokenInfo) {
        const ticker = tokenInfo.symbol ? `<b>$${esc(tokenInfo.symbol)}</b>` : '';
        const name = tokenInfo.name ? esc(tokenInfo.name) : '';
        L.push(`🐙 ${ticker}${ticker && name ? ' — ' : ''}${name}`);
        if (tokenInfo.usdMarketCap > 0) {
            L.push(`💰 MC: $${formatCompact(tokenInfo.usdMarketCap)}`);
        } else if (tokenInfo.marketCapSol > 0) {
            L.push(`💰 MC: ${tokenInfo.marketCapSol.toFixed(1)} SOL`);
        }
        if (tokenInfo.complete) {
            L.push('🎓 Status: Graduated (AMM)');
        } else if (tokenInfo.curveProgress > 0) {
            const pct = Math.round(tokenInfo.curveProgress);
            L.push(`📈 Status: Bonding curve (${pct > 0 ? `${pct}%` : '<1%'})`);
        }
        if (tokenInfo.athMarketCap > 0) {
            L.push(`🏆 ATH: $${formatCompact(tokenInfo.athMarketCap)}`);
        }
    }
    L.push('');
    if (creator) {
        const uTag = creator.username ? ` @${esc(creator.username)}` : '';
        L.push(`🧑‍💻 Creator: <a href="https://pump.fun/profile/${wallet}">${shortAddr(wallet)}</a>${uTag}`);
        if (creator.totalLaunches > 0) L.push(`🚀 Launches: ${creator.totalLaunches}`);
        const grad = creator.recentCoins.filter(c => c.complete).length;
        if (grad > 0) L.push(`🎓 Graduated: ${grad}`);
    }
    L.push('');
    if (mint) {
        L.push(`CA: <code>${mint}</code>`);
    }

    const imageUrl = tokenInfo?.imageUri || creator?.profileImage || null;
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
    const bcp = Math.round(event.bondingCurveProgress);
    const filled = Math.round(event.bondingCurveProgress / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    lines.push(`💹  Mcap: ${mcap}  ·  [${bar}] ${bcp > 0 ? `${bcp}%` : '<1%'}`);
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
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
}

function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(2);
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return n.toLocaleString('en-US');
    return String(n);
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
/**
 * Extract a clean X/Twitter handle from a URL or raw username string.
 * Handles full URLs, tweet status links, and bare usernames.
 * Returns just the handle (without @) or null if unparseable.
 */
function cleanXHandle(input: string): string | null {
    if (!input) return null;
    // Strip URL prefix to get the path
    const path = input.replace(/^https?:\/\/(?:www\.)?(?:twitter|x)\.com\//, '').replace(/^@/, '');
    // Take only the first path segment (the username), ignore /status/... etc.
    const handle = path.split(/[/?#]/)[0]?.trim();
    if (!handle || ['home', 'search', 'explore', 'settings', 'i'].includes(handle.toLowerCase())) {
        return null;
    }
    // Validate it looks like a username (alphanumeric + underscore)
    if (/^[a-zA-Z0-9_]{1,15}$/.test(handle)) {
        return handle;
    }
    return null;
}

