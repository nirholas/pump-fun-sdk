/**
 * Test fixtures for channel-bot tests.
 * Provides factory functions for all event and context types.
 */

import type { FeeClaimEvent, GraduationEvent, TokenLaunchEvent, TradeAlertEvent, FeeDistributionEvent } from '../types.js';
import type { ClaimFeedContext, CreatorClaimContext } from '../formatters.js';
import type { GitHubRepoInfo, GitHubUserInfo } from '../github-client.js';
import type { ClaimSummaryInput } from '../groq-client.js';
import type { XProfile } from '../x-client.js';

// ── Fee Claim Event ──────────────────────────────────────────────────────────

export function makeFeeClaimEvent(overrides: Partial<FeeClaimEvent> = {}): FeeClaimEvent {
    return {
        txSignature: '5xTestSig123ABC',
        slot: 300_000_000,
        timestamp: Math.floor(Date.now() / 1000) - 60,
        claimerWallet: 'WaLLeT111111111111111111111111111111111111111',
        tokenMint: 'MiNt111111111111111111111111111111111111111111',
        amountSol: 1.5,
        amountLamports: 1_500_000_000,
        claimType: 'claim_social_fee_pda',
        isCashback: false,
        programId: 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
        claimLabel: 'Claim Social Fee PDA (GitHub)',
        githubUserId: '12345678',
        socialPlatform: 2,
        recipientWallet: 'WaLLeT111111111111111111111111111111111111111',
        ...overrides,
    };
}

// ── GitHub User ──────────────────────────────────────────────────────────────

export function makeGitHubUser(overrides: Partial<GitHubUserInfo> = {}): GitHubUserInfo {
    return {
        login: 'testdev',
        name: 'Test Developer',
        bio: 'Building on Solana',
        htmlUrl: 'https://github.com/testdev',
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345678',
        publicRepos: 42,
        followers: 150,
        following: 30,
        company: 'TestCorp',
        location: 'San Francisco, CA',
        blog: 'https://testdev.io',
        twitterUsername: 'testdev_x',
        createdAt: '2020-06-15T00:00:00Z',
        hireable: false,
        ...overrides,
    };
}

// ── GitHub Repo ──────────────────────────────────────────────────────────────

export function makeGitHubRepo(overrides: Partial<GitHubRepoInfo> = {}): GitHubRepoInfo {
    return {
        fullName: 'testdev/pump-token',
        description: 'A Solana token project',
        language: 'TypeScript',
        stars: 150,
        forks: 23,
        openIssues: 5,
        lastPush: '2026-03-10T10:00:00Z',
        lastPushAgo: '2d ago',
        createdAt: '2025-01-01T00:00:00Z',
        defaultBranch: 'main',
        isFork: false,
        topics: ['solana', 'defi', 'token'],
        htmlUrl: 'https://github.com/testdev/pump-token',
        ownerAvatar: 'https://avatars.githubusercontent.com/u/12345678',
        commitCount: 342,
        ...overrides,
    };
}

// ── X Profile ────────────────────────────────────────────────────────────────

export function makeXProfile(overrides: Partial<XProfile> = {}): XProfile {
    return {
        username: 'testdev_x',
        name: 'Test Developer',
        followers: 5000,
        following: 200,
        verified: false,
        description: 'Building cool stuff on Solana',
        url: 'https://x.com/testdev_x',
        createdAt: '2019-01-01T00:00:00Z',
        tweetCount: 1500,
        ...overrides,
    };
}

// ── Claim Summary Input ──────────────────────────────────────────────────────

export function makeClaimSummaryInput(overrides: Partial<ClaimSummaryInput> = {}): ClaimSummaryInput {
    return {
        tokenName: 'PumpCoin',
        tokenSymbol: 'PUMP',
        tokenDescription: 'Community token for pump.fun ecosystem',
        mcapUsd: 45_000,
        graduated: false,
        curveProgress: 0.72,
        claimAmountSol: 1.5,
        claimAmountUsd: 225,
        launchToClaimSeconds: 3600,
        isSelfClaim: true,
        creatorLaunches: 12,
        creatorGraduated: 3,
        creatorFollowers: 450,
        holderCount: 89,
        recentTradeCount: 234,
        githubRepoName: 'pump-fun-sdk',
        githubStars: 150,
        githubLanguage: 'TypeScript',
        githubLastPush: '2026-03-05T10:00:00Z',
        githubDescription: 'Solana token SDK',
        githubIsFork: false,
        githubUserLogin: 'testdev',
        githubUserFollowers: 200,
        githubUserRepos: 45,
        githubUserCreatedAt: '2020-01-15T00:00:00Z',
        ...overrides,
    };
}

// ── Claim Feed Context ───────────────────────────────────────────────────────

export function makeClaimFeedContext(overrides: Partial<ClaimFeedContext> = {}): ClaimFeedContext {
    return {
        event: makeFeeClaimEvent(),
        solUsdPrice: 150.0,
        githubUser: makeGitHubUser(),
        xProfile: makeXProfile(),
        tokenInfo: {
            mint: 'MiNt111111111111111111111111111111111111111111',
            name: 'PumpCoin',
            symbol: 'PUMP',
            description: 'Community token',
            imageUri: 'https://pump.fun/img/test.png',
            bannerUri: '',
            creator: 'CreatorWallet111111111111111111111111111111111',
            createdTimestamp: Math.floor(Date.now() / 1000) - 86400,
            complete: false,
            usdMarketCap: 45_000,
            marketCapSol: 300,
            priceSol: 0.00001,
            curveProgress: 72,
            athMarketCap: 120_000,
            athTimestamp: Math.floor(Date.now() / 1000) - 43200,
            pumpSwapPool: '',
            program: 'pump',
            isCashbackEnabled: false,
            isNsfw: false,
            isBanned: false,
            isHackathon: false,
            website: 'https://pumpcoin.io',
            twitter: 'https://x.com/pumpcoin',
            telegram: 'https://t.me/pumpcoin',
            githubUrls: ['https://github.com/testdev/pump-token'],
            replyCount: 45,
            lastTradeTimestamp: Math.floor(Date.now() / 1000) - 120,
            lastReplyTimestamp: Math.floor(Date.now() / 1000) - 300,
            kothTimestamp: 0,
        },
        isFirstClaim: true,
        isFake: false,
        claimNumber: 1,
        lifetimeClaimedSol: 1.5,
        repoInfo: makeGitHubRepo(),
        creatorProfile: {
            wallet: 'CreatorWallet111111111111111111111111111111111',
            username: 'pumpcreator',
            profileImage: 'https://pump.fun/profile/test.png',
            followers: 450,
            totalLaunches: 12,
            scamEstimate: 0,
            recentCoins: [
                { mint: 'Coin1', symbol: 'PUMP', name: 'PumpCoin', complete: true, usdMarketCap: 120_000 },
                { mint: 'Coin2', symbol: 'TEST', name: 'TestCoin', complete: false, usdMarketCap: 5_000 },
            ],
        },
        holders: {
            totalHolders: 89,
            topHolders: [
                { address: 'Holder1', pct: 8.5, isPool: false },
                { address: 'Holder2', pct: 5.2, isPool: false },
                { address: 'Holder3', pct: 3.1, isPool: false },
            ],
            top10Pct: 25,
        },
        trades: {
            recentTradeCount: 234,
            recentVolumeSol: 156,
            buyCount: 180,
            sellCount: 54,
        },
        devWallet: {
            solBalance: 12.5,
            tokenSupplyPct: 2.5,
        },
        ...overrides,
    };
}

// ── Graduation Event ─────────────────────────────────────────────────────────

export function makeGraduationEvent(overrides: Partial<GraduationEvent> = {}): GraduationEvent {
    return {
        txSignature: '5xGradSig123ABC',
        slot: 300_000_100,
        timestamp: Math.floor(Date.now() / 1000),
        mintAddress: 'MiNt111111111111111111111111111111111111111111',
        user: 'User111111111111111111111111111111111111111111',
        bondingCurve: 'BC111111111111111111111111111111111111111111',
        isMigration: true,
        solAmount: 85,
        ...overrides,
    };
}

// ── Token Launch Event ───────────────────────────────────────────────────────

export function makeTokenLaunchEvent(overrides: Partial<TokenLaunchEvent> = {}): TokenLaunchEvent {
    return {
        txSignature: '5xLaunchSig123',
        slot: 300_000_050,
        timestamp: Math.floor(Date.now() / 1000),
        mintAddress: 'MiNt111111111111111111111111111111111111111111',
        creatorWallet: 'CreatorWallet111111111111111111111111111111111',
        name: 'PumpCoin',
        symbol: 'PUMP',
        description: 'Community token',
        metadataUri: 'https://arweave.net/test',
        hasGithub: true,
        githubUrls: ['https://github.com/testdev/pump-token'],
        mayhemMode: false,
        cashbackEnabled: false,
        ...overrides,
    };
}

// ── Trade Alert Event ────────────────────────────────────────────────────────

export function makeTradeAlertEvent(overrides: Partial<TradeAlertEvent> = {}): TradeAlertEvent {
    return {
        txSignature: '5xTradeSig123',
        slot: 300_000_075,
        timestamp: Math.floor(Date.now() / 1000),
        mintAddress: 'MiNt111111111111111111111111111111111111111111',
        user: 'Trader111111111111111111111111111111111111111111',
        creator: 'CreatorWallet111111111111111111111111111111111',
        isBuy: true,
        solAmount: 15.5,
        tokenAmount: 1_500_000,
        fee: 0.155,
        creatorFee: 0.05,
        virtualSolReserves: 30_000_000_000,
        virtualTokenReserves: 400_000_000_000_000,
        realSolReserves: 20_000_000_000,
        realTokenReserves: 300_000_000_000_000,
        mayhemMode: false,
        marketCapSol: 300,
        bondingCurveProgress: 72,
        ...overrides,
    };
}

// ── Fee Distribution Event ───────────────────────────────────────────────────

export function makeFeeDistributionEvent(overrides: Partial<FeeDistributionEvent> = {}): FeeDistributionEvent {
    return {
        txSignature: '5xDistSig123',
        slot: 300_000_200,
        timestamp: Math.floor(Date.now() / 1000),
        mintAddress: 'MiNt111111111111111111111111111111111111111111',
        bondingCurve: 'BC111111111111111111111111111111111111111111',
        admin: 'Admin111111111111111111111111111111111111111111',
        distributedSol: 5.0,
        shareholders: [
            { address: 'Share1', shareBps: 7000 },
            { address: 'Share2', shareBps: 3000 },
        ],
        ...overrides,
    };
}
