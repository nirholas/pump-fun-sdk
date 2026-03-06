/**
 * PumpFun Channel Bot — Formatters
 *
 * Claim feed cards: GitHub social fee PDA + creator fee first-claims.
 * Every data point on its own line, clean emoji prefix.
 */

import type { GitHubUserInfo } from './github-client.js';
import type { CreatorProfile } from './pump-client.js';
import type { FeeClaimEvent } from './types.js';
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

    // ━━ CA / CLAIM ACCOUNT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (mint) {
        L.push(`🧬 CA: <code>${mint}</code>`);
    } else {
        L.push(`🧬 CA: <i>N/A (social fee claim is wallet-level)</i>`);
    }
    if (event.socialFeePda) {
        L.push(`🧾 Social Fee PDA: <code>${event.socialFeePda}</code>`);
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
// Utilities
// ============================================================================

    // ━━ LAUNCH DATE & AGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (token?.createdTimestamp && token.createdTimestamp > 0) {
        L.push(`📅 Launched: ${formatDateTime(token.createdTimestamp)} (${timeAgo(token.createdTimestamp)})`);
    }

    // ━━ BONDING CURVE BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (token && !token.complete && token.curveProgress > 0) {
        const p = Math.min(99, Math.round(token.curveProgress));
        const filled = Math.round(p / 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        L.push(`📈 [${bar}] ${p}%`);
    } else if (token?.complete) {
        L.push(`🎓 Graduated → AMM`);
    }

    // ━━ CA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (mint) L.push(`<code>${mint}</code>`);

    // ━━ FEE CLAIM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const claimSol = event.amountSol.toFixed(4);
    const claimUsd = solUsdPrice > 0 ? ` ($${(event.amountSol * solUsdPrice).toFixed(2)})` : '';
    L.push(`🏦 <b>${claimSol} SOL</b>${claimUsd}`);
    L.push(`  ↳ Type: ${esc(event.claimLabel)}`);
    const isSelf = token?.creator === event.claimerWallet;
    const claimerTag = isSelf ? '👤 Creator' : '👻 3rd-party';
    const claimerName = githubUser
        ? `<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>`
        : `<code>${shortAddr(event.claimerWallet)}</code>`;
    L.push(`  ↳ Claimed by ${claimerName} (${claimerTag})`);
    if (token && token.createdTimestamp > 0 && event.timestamp > 0) {
        const diff = event.timestamp - token.createdTimestamp;
        if (diff >= 0) L.push(`  ↳ ⏱ Launch→Claim: <b>${formatDuration(diff)}</b>`);
    }

    // ━━ CLAIM HISTORY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (claimRecord.claimCount > 1) {
        const totalUsd = solUsdPrice > 0 ? ` ($${(claimRecord.totalClaimedSol * solUsdPrice).toFixed(2)})` : '';
        L.push(`  ↳ Claim #${claimRecord.claimCount} · Total: ${claimRecord.totalClaimedSol.toFixed(4)} SOL${totalUsd}`);
    }
    if (claimRecord.claimMcapUsd > 0) {
        L.push(`  ↳ Mcap at claim: $${formatCompact(claimRecord.claimMcapUsd)}`);
    }

    // ━━ CREATOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const creatorWallet = token?.creator ?? '';
    if (creatorWallet) {
        L.push('');
        const profileLink = `<a href="https://pump.fun/profile/${creatorWallet}">${shortAddr(creatorWallet)}</a>`;
        const uname = creator?.username ? ` @${esc(creator.username)}` : '';
        L.push(`👤 ${profileLink}${uname}`);
        if (creator && creator.totalLaunches > 0) L.push(`🚀 Launches: ${creator.totalLaunches}`);
        if (creator) {
            const graduated = creator.recentCoins.filter((c) => c.complete).length;
            if (graduated > 0) L.push(`🎓 Graduated: ${graduated}`);
        }
        if (creator && creator.scamEstimate > 0) L.push(`⚠️ Rugs: ${creator.scamEstimate}`);
        if (creator && creator.followers > 0) L.push(`👁 Followers: ${formatCompact(creator.followers)}`);
        if (creator) {
            const others = creator.recentCoins.filter((c) => c.mint !== mint).slice(0, 5);
            if (others.length > 0) {
                const tickers = others.map((c) => {
                    const g = c.complete ? '⭐' : '';
                    return `<a href="https://pump.fun/coin/${c.mint}">${esc(c.symbol)}</a>${g}`;
                });
                L.push(`  ↳ ${tickers.join('·')}`);
            }
        }
    }

    // ━━ GITHUB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (githubUser) {
        L.push('');
        const userLink = `<a href="${esc(githubUser.htmlUrl)}">${esc(githubUser.login)}</a>`;
        const nameTag = githubUser.name ? ` (${esc(githubUser.name)})` : '';
        L.push(`🐙 ${userLink}${nameTag}`);
        if (githubUser.publicRepos > 0) L.push(`📦 Repos: ${githubUser.publicRepos}`);
        const ghFollow: string[] = [];
        if (githubUser.followers > 0) ghFollow.push(`${githubUser.followers} followers`);
        if (githubUser.following > 0) ghFollow.push(`${githubUser.following} following`);
        if (ghFollow.length > 0) L.push(`👁 ${ghFollow.join(' · ')}`);
        if (githubUser.createdAt) L.push(`📅 Joined: ${timeAgo(new Date(githubUser.createdAt).getTime() / 1000)}`);
        if (githubUser.company) L.push(`🏢 ${esc(githubUser.company)}`);
        if (githubUser.bio) {
            const bio = githubUser.bio.length > 80 ? githubUser.bio.slice(0, 77) + '...' : githubUser.bio;
            L.push(`  <i>${esc(bio)}</i>`);
        }
        const ghSocials: string[] = [];
        if (githubUser.twitterUsername) ghSocials.push(`<a href="https://x.com/${esc(githubUser.twitterUsername)}">𝕏 ${esc(githubUser.twitterUsername)}</a>`);
        if (githubUser.blog) ghSocials.push(`<a href="${esc(githubUser.blog)}">🌐 ${esc(githubUser.blog.replace(/^https?:\/\//, '').slice(0, 40))}</a>`);
        if (githubUser.location) ghSocials.push(`📍 ${esc(githubUser.location)}`);
        if (ghSocials.length > 0) L.push(`  ↳ ${ghSocials.join(' · ')}`);
    }
    if (githubRepo) {
        const repoLink = `<a href="${esc(githubRepo.htmlUrl)}">${esc(githubRepo.fullName)}</a>`;
        L.push(`📁 ${repoLink}`);
        if (githubRepo.language) L.push(`🔤 ${esc(githubRepo.language)}`);
        const repoStats: string[] = [];
        if (githubRepo.stars > 0) repoStats.push(`⭐${githubRepo.stars}`);
        if (githubRepo.forks > 0) repoStats.push(`🍴${githubRepo.forks}`);
        if (githubRepo.openIssues > 0) repoStats.push(`🐛${githubRepo.openIssues}`);
        if (githubRepo.commitCount && githubRepo.commitCount > 0) repoStats.push(`📝${githubRepo.commitCount} commits`);
        if (repoStats.length > 0) L.push(`  ${repoStats.join(' · ')}`);
        if (githubRepo.isFork) L.push(`  ⚠️ This is a fork`);
        if (githubRepo.createdAt) L.push(`  📅 Repo created: ${timeAgo(new Date(githubRepo.createdAt).getTime() / 1000)}`);
        if (githubRepo.lastPushAgo) L.push(`  🕐 Last push: ${githubRepo.lastPushAgo}`);
        if (githubRepo.description) {
            const desc = githubRepo.description.length > 80 ? githubRepo.description.slice(0, 77) + '...' : githubRepo.description;
            L.push(`  <i>${esc(desc)}</i>`);
        }
    }

    // ━━ SOCIALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (token?.twitter || token?.telegram || token?.website) {
        L.push('');
        if (token.twitter) {
            const handle = extractTwitterHandle(token.twitter);
            L.push(`𝕏 <a href="${esc(token.twitter)}">${handle ? esc(handle) : 'Twitter'}</a>`);
        }
        if (token.telegram) L.push(`💬 <a href="${esc(token.telegram)}">Telegram</a>`);
        if (token.website) L.push(`🌐 <a href="${esc(token.website)}">${esc(token.website.replace(/^https?:\/\//, '').slice(0, 40))}</a>`);
    }
    if (token?.description) {
        const desc = token.description.length > 100 ? token.description.slice(0, 97) + '...' : token.description;
        L.push(`  <i>${esc(desc)}</i>`);
    }

    // ━━ LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    if (mint) {
        L.push(
            `<a href="https://pump.fun/coin/${mint}">PMP</a>` +
            `·<a href="https://gmgn.ai/sol/token/${mint}&ref=nichxbt">GMG</a>` +
            `·<a href="https://axiom.trade/@nich/${mint}">AXI</a>` +
            `·<a href="https://dexscreener.com/solana/${mint}">DEX</a>` +
            `·<a href="https://photon-sol.tinyastro.io/en/lp/${mint}"><b>PHO</b></a>` +
            `·<a href="https://bullx.io/terminal?chainId=1399811149&address=${mint}">BLX</a>`,
        );
    }
    if (event.txSignature) {
        L.push(`🔍 <a href="https://solscan.io/tx/${event.txSignature}">TX</a> · <a href="https://solscan.io/token/${mint}">Solscan</a>`);
    }
    L.push(`🕐 ${formatTime(event.timestamp)}`);

    const imageUrl = token?.imageUri || null;
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

export function formatGraduationFeed(
    event: GraduationEvent,
    token: TokenInfo | null,
    creator: CreatorProfile | null,
    solUsdPrice: number,
): { imageUrl: string | null; caption: string } {
    const L: string[] = [];

    // ━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push(`🎓 <b>TOKEN GRADUATED</b>`);
    L.push('');

    // ━━ TOKEN INFO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const coinName = token?.name ?? 'Unknown';
    const coinTicker = token?.symbol ?? '???';
    const pumpLink = `<a href="https://pump.fun/coin/${event.mintAddress}">${esc(coinName)}</a>`;
    
    // Calculate time spent in bonding curve and add speed emojis
    let speedEmoji = '';
    let timeSpent = '';
    if (token && token.createdTimestamp > 0) {
        const seconds = event.timestamp - token.createdTimestamp;
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 30) {
            speedEmoji = '⚡️⚡️⚡️';
            timeSpent = `${seconds}s`;
        } else if (seconds < 60) {
            speedEmoji = '⚡️⚡️';
            timeSpent = `${seconds}s`;
        } else if (seconds < 120) {
            speedEmoji = '⚡️';
            timeSpent = `${minutes}m`;
        } else if (days > 3) {
            speedEmoji = '💤';
            timeSpent = days > 0 ? `${days}d ${hours % 24}h` : `${hours}h ${minutes % 60}m`;
        } else if (hours > 0) {
            timeSpent = `${hours}h ${minutes % 60}m`;
        } else {
            timeSpent = `${minutes}m`;
        }
    }
    
    const launchpadEmoji = '💊'; // Pump launchpad
    L.push(`${launchpadEmoji} ${speedEmoji} <b>${pumpLink}</b>  <code>$${esc(coinTicker)}</code>`.trim());
    L.push(`CA: <code>${event.mintAddress}</code>`);
    if (timeSpent) {
        L.push(`     Bonding Curve: ${timeSpent}`);
    }
    if (token && token.createdTimestamp > 0) {
        L.push(`     Launched ${timeAgo(token.createdTimestamp)}`);
    }

    // ━━ MIGRATION DETAILS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    L.push(`📈 <b>Type:</b> ${event.isMigration ? 'AMM Migration' : 'Bonding Curve Complete'}`);
    if (event.isMigration && event.solAmount != null) {
        const solMigrated = event.solAmount.toFixed(2);
        const usdMigrated = solUsdPrice > 0 ? ` ($${(event.solAmount * solUsdPrice).toFixed(0)})` : '';
        L.push(`     SOL Migrated: ${solMigrated} SOL${usdMigrated}`);
    }
    if (event.poolMigrationFee != null) {
        L.push(`     Migration Fee: ${event.poolMigrationFee.toFixed(4)} SOL`);
    }
    if (event.poolAddress) {
        const poolLink = `<a href="https://solscan.io/account/${event.poolAddress}">${shortAddr(event.poolAddress)}</a>`;
        L.push(`     Pool: ${poolLink}`);
    }
    const userLink = `<a href="https://pump.fun/profile/${event.user}">${shortAddr(event.user)}</a>`;
    L.push(`     Triggered by: ${userLink}`);

    // ━━ MARKET INFO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (token) {
        L.push('');
        if (token.usdMarketCap > 0) {
            L.push(`💹 <b>Market Cap:</b> $${formatCompact(token.usdMarketCap)}`);
        } else if (token.marketCapSol > 0) {
            L.push(`💹 <b>Market Cap:</b> ~${token.marketCapSol.toFixed(1)} SOL`);
        }
        if (token.priceSol > 0) {
            const priceStr = token.priceSol < 0.000001 
                ? token.priceSol.toExponential(2) 
                : token.priceSol.toFixed(9).replace(/\.?0+$/, '');
            L.push(`     Price: ${priceStr} SOL`);
        }
        if (token.athMarketCap > 0 && token.athMarketCap > token.usdMarketCap) {
            L.push(`     ATH: $${formatCompact(token.athMarketCap)}`);
        }
    }

    // ━━ DEV DETAILS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (token && token.creator) {
        L.push('');
        const devLink = `<a href="https://pump.fun/profile/${token.creator}">${shortAddr(token.creator)}</a>`;
        L.push(`👤 <b>Dev:</b> ${devLink}`);
        
        if (creator) {
            if (creator.username) L.push(`     Name: ${esc(creator.username)}`);
            if (creator.totalLaunches > 0) {
                L.push(`     Total Launches: ${creator.totalLaunches}`);
            }
            if (creator.scamEstimate > 0) {
                L.push(`     ⚠️ Suspected Rugs: ${creator.scamEstimate}`);
            }
            
            // Show dev's past successful launches
            const graduated = creator.recentCoins.filter(c => c.complete && c.usdMarketCap > 0);
            if (graduated.length > 0) {
                L.push(`     Past Graduations: ${graduated.length}`);
                const topLaunch = graduated.reduce((max, c) => c.usdMarketCap > max.usdMarketCap ? c : max, graduated[0]);
                if (topLaunch.usdMarketCap > 1000) {
                    L.push(`     Best ATH: ${esc(topLaunch.name)} ($${formatCompact(topLaunch.usdMarketCap)})`);
                }
            }
        }
    }

    // ━━ SOCIALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (token) {
        const socials: string[] = [];
        if (token.website) socials.push(`<a href="${esc(token.website)}">Website</a>`);
        if (token.twitter) {
            const twitterHandle = token.twitter.replace(/.*twitter\.com\/|.*x\.com\//, '').replace(/\/+$/, '');
            socials.push(`<a href="${esc(token.twitter)}">𝕏 @${esc(twitterHandle)}</a>`);
        }
        if (token.telegram) socials.push(`<a href="${esc(token.telegram)}">Telegram</a>`);
        if (token.githubUrls && token.githubUrls.length > 0) {
            socials.push(`<a href="${esc(token.githubUrls[0])}">GitHub</a>`);
        }
        
        if (socials.length > 0) {
            L.push('');
            L.push(`🔗 <b>Socials:</b> ${socials.join(' · ')}`);
        }
    }

    // ━━ TRADING BOT QUICK LINKS ━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const mint = event.mintAddress;
    const quickBots = [
        `<a href="https://photon-sol.tinyastro.io/en/lp/${mint}">Photon</a>`,
        `<a href="https://t.me/solana_bullx_bot?start=${mint}">BullX</a>`,
        `<a href="https://t.me/paris_trojanbot?start=r-pumpdotfun-${mint}">Trojan</a>`,
        `<a href="https://t.me/BananaGunSolana_bot?start=${mint}">Banana</a>`,
        `<a href="https://t.me/maestro?start=${mint}">Maestro</a>`,
    ];
    L.push(`🤖 ${quickBots.join(' · ')}`);

    // ━━ TRANSACTION LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    L.push('');
    const txLink = `<a href="https://solscan.io/tx/${event.txSignature}">TX</a>`;
    const pfLink = `<a href="https://pump.fun/coin/${event.mintAddress}">Pump.fun</a>`;
    const solscanLink = `<a href="https://solscan.io/token/${event.mintAddress}">Solscan</a>`;
    const dexLink = `<a href="https://dexscreener.com/solana/${event.mintAddress}">DexScreener</a>`;
    L.push(`🔍 ${txLink} · ${pfLink} · ${solscanLink} · ${dexLink}`);
    L.push(`🕐 ${formatTime(event.timestamp)}`);

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

