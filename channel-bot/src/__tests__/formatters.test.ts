/**
 * Tests for formatters — rich HTML card generation for Telegram.
 *
 * Tests all formatter functions for correct output structure,
 * HTML escaping, and handling of missing/null data.
 */

import { describe, it, expect } from 'vitest';
import {
    formatGitHubClaimFeed,
    formatCreatorClaimFeed,
    formatLaunchFeed,
    formatGraduationFeed,
    formatWhaleFeed,
    formatFeeDistributionFeed,
    shortAddr,
    esc,
} from '../formatters.js';
import {
    makeClaimFeedContext,
    makeFeeClaimEvent,
    makeGitHubUser,
    makeGitHubRepo,
    makeXProfile,
    makeGraduationEvent,
    makeTokenLaunchEvent,
    makeTradeAlertEvent,
    makeFeeDistributionEvent,
} from './fixtures.js';

// ── formatGitHubClaimFeed ────────────────────────────────────────────────────

describe('formatGitHubClaimFeed', () => {
    it('returns imageUrl and caption', () => {
        const ctx = makeClaimFeedContext();
        const { imageUrl, caption } = formatGitHubClaimFeed(ctx);

        expect(typeof caption).toBe('string');
        expect(caption.length).toBeGreaterThan(0);
        expect(imageUrl).not.toBeNull();
    });

    it('shows FIRST CREATOR FEE CLAIM badge for first claims', () => {
        const ctx = makeClaimFeedContext({ isFirstClaim: true, isFake: false });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('FIRST CREATOR FEE CLAIM');
    });

    it('shows FAKE CLAIM badge for fake claims', () => {
        const ctx = makeClaimFeedContext({ isFake: true, isFirstClaim: false });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('FAKE CLAIM');
    });

    it('shows REPEAT CLAIM badge with number', () => {
        const ctx = makeClaimFeedContext({ isFirstClaim: false, isFake: false, claimNumber: 5 });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('REPEAT CLAIM #5');
    });

    it('includes token info section', () => {
        const ctx = makeClaimFeedContext();
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('$PUMP');
        expect(caption).toContain('PumpCoin');
        expect(caption).toContain('MC:');
    });

    it('includes claim stats section', () => {
        const ctx = makeClaimFeedContext();
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Claim Stats');
        expect(caption).toContain('SOL');
    });

    it('includes GitHub user info', () => {
        const ctx = makeClaimFeedContext();
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Linked Dev');
        expect(caption).toContain('testdev');
        expect(caption).toContain('Repos:');
    });

    it('includes repo info when available', () => {
        const ctx = makeClaimFeedContext({ repoInfo: makeGitHubRepo() });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Repo Claimed');
        expect(caption).toContain('testdev/pump-token');
        expect(caption).toContain('Stars:');
    });

    it('includes creator profile when available', () => {
        const ctx = makeClaimFeedContext();
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Token Creator');
        expect(caption).toContain('Launches:');
    });

    it('includes holder intel when available', () => {
        const ctx = makeClaimFeedContext();
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Holders');
        expect(caption).toContain('Total:');
    });

    it('includes trade links', () => {
        const ctx = makeClaimFeedContext();
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Axiom');
        expect(caption).toContain('GMGN');
        expect(caption).toContain('Padre');
    });

    it('includes trust signals section', () => {
        const ctx = makeClaimFeedContext();
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Signals');
    });

    it('shows verified signal when GitHub owner matches claimer', () => {
        const ctx = makeClaimFeedContext({
            githubUser: makeGitHubUser({ login: 'testdev' }),
            tokenInfo: {
                ...makeClaimFeedContext().tokenInfo!,
                githubUrls: ['https://github.com/testdev/pump-token'],
            },
        });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Verified');
    });

    it('shows mismatch signal when GitHub owner differs', () => {
        const ctx = makeClaimFeedContext({
            githubUser: makeGitHubUser({ login: 'differentuser' }),
            tokenInfo: {
                ...makeClaimFeedContext().tokenInfo!,
                githubUrls: ['https://github.com/testdev/pump-token'],
            },
        });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Mismatch');
    });

    it('handles missing tokenInfo gracefully', () => {
        const ctx = makeClaimFeedContext({ tokenInfo: null });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(typeof caption).toBe('string');
        expect(caption.length).toBeGreaterThan(0);
    });

    it('handles missing githubUser gracefully', () => {
        const ctx = makeClaimFeedContext({ githubUser: null });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('GitHub ID:');
    });

    it('handles missing xProfile gracefully', () => {
        const ctx = makeClaimFeedContext({ xProfile: null });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(typeof caption).toBe('string');
    });

    it('shows all linked tokens when multiple exist', () => {
        const ctx = makeClaimFeedContext({
            allLinkedTokens: [
                { ...makeClaimFeedContext().tokenInfo!, mint: 'Mint1', symbol: 'PUMP', usdMarketCap: 100_000, complete: true },
                { ...makeClaimFeedContext().tokenInfo!, mint: 'Mint2', symbol: 'TEST', usdMarketCap: 5_000, complete: false },
            ],
        });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('All Linked Coins');
    });

    it('shows same-name tokens when present', () => {
        const ctx = makeClaimFeedContext({
            sameNameTokens: [
                { mint: 'OtherMint', name: 'PumpCoin', symbol: 'PUMP', usdMarketCap: 500_000, url: 'https://pump.fun/coin/OtherMint', age: '3d ago' },
            ],
        });
        const { caption } = formatGitHubClaimFeed(ctx);

        expect(caption).toContain('Same Name Tokens');
    });

    it('uses token image URI as primary imageUrl', () => {
        const ctx = makeClaimFeedContext();
        const { imageUrl } = formatGitHubClaimFeed(ctx);

        expect(imageUrl).toBe('https://pump.fun/img/test.png');
    });

    it('falls back to GitHub avatar when no token image', () => {
        const ctx = makeClaimFeedContext({
            tokenInfo: { ...makeClaimFeedContext().tokenInfo!, imageUri: '' },
        });
        const { imageUrl } = formatGitHubClaimFeed(ctx);

        expect(imageUrl).toBe('https://avatars.githubusercontent.com/u/12345678');
    });
});

// ── formatCreatorClaimFeed ───────────────────────────────────────────────────

describe('formatCreatorClaimFeed', () => {
    it('returns imageUrl and caption', () => {
        const ctx = {
            event: makeFeeClaimEvent({ claimType: 'collect_creator_fee' }),
            solUsdPrice: 150,
            creator: {
                wallet: 'CreatorWallet111',
                username: 'creator1',
                profileImage: 'https://pump.fun/img/creator.png',
                followers: 100,
                totalLaunches: 5,
                scamEstimate: 0,
                recentCoins: [],
            },
        };
        const { imageUrl, caption } = formatCreatorClaimFeed(ctx);

        expect(caption).toContain('Creator Claimed Fees');
        expect(caption).toContain('SOL');
        expect(imageUrl).toBe('https://pump.fun/img/creator.png');
    });

    it('handles null creator gracefully', () => {
        const ctx = {
            event: makeFeeClaimEvent({ claimType: 'collect_creator_fee' }),
            solUsdPrice: 150,
            creator: null,
        };
        const { caption } = formatCreatorClaimFeed(ctx);

        expect(typeof caption).toBe('string');
        expect(caption).toContain('Creator Claimed Fees');
    });

    it('includes USD value when solUsdPrice > 0', () => {
        const ctx = {
            event: makeFeeClaimEvent({ amountSol: 2.5 }),
            solUsdPrice: 100,
            creator: null,
        };
        const { caption } = formatCreatorClaimFeed(ctx);

        expect(caption).toContain('$250.00');
    });
});

// ── formatLaunchFeed ─────────────────────────────────────────────────────────

describe('formatLaunchFeed', () => {
    it('returns launch notification string', () => {
        const event = makeTokenLaunchEvent();
        const result = formatLaunchFeed(event, null);

        expect(result).toContain('NEW TOKEN LAUNCHED');
        expect(result).toContain('PumpCoin');
        expect(result).toContain('$PUMP');
        expect(result).toContain(event.mintAddress);
    });

    it('includes creator profile when provided', () => {
        const event = makeTokenLaunchEvent();
        const creator = {
            wallet: 'CreatorWallet111',
            username: 'creator1',
            profileImage: '',
            followers: 500,
            totalLaunches: 10,
            scamEstimate: 1,
            recentCoins: [
                { mint: 'Coin1', symbol: 'OLD', name: 'OldCoin', complete: true, usdMarketCap: 50000 },
            ],
        };
        const result = formatLaunchFeed(event, creator);

        expect(result).toContain('500');
        expect(result).toContain('10 total launches');
    });

    it('shows feature flags', () => {
        const event = makeTokenLaunchEvent({
            mayhemMode: true,
            cashbackEnabled: true,
            hasGithub: true,
        });
        const result = formatLaunchFeed(event, null);

        expect(result).toContain('Mayhem');
        expect(result).toContain('Cashback');
        expect(result).toContain('GitHub');
    });

    it('handles first-time launcher', () => {
        const creator = {
            wallet: 'NewCreator111',
            username: '',
            profileImage: '',
            followers: 0,
            totalLaunches: 1,
            scamEstimate: 0,
            recentCoins: [],
        };
        const event = makeTokenLaunchEvent();
        const result = formatLaunchFeed(event, creator);

        expect(result).toContain('First-time launcher');
    });
});

// ── formatGraduationFeed ─────────────────────────────────────────────────────

describe('formatGraduationFeed', () => {
    it('returns imageUrl and caption', () => {
        const event = makeGraduationEvent();
        const { imageUrl, caption } = formatGraduationFeed(event, null, null, 150);

        expect(typeof caption).toBe('string');
        expect(caption.length).toBeGreaterThan(0);
    });

    it('includes graduation speed emoji for fast graduations', () => {
        const now = Math.floor(Date.now() / 1000);
        const token = {
            ...makeClaimFeedContext().tokenInfo!,
            createdTimestamp: now - 20, // 20 seconds ago
        };
        const event = makeGraduationEvent({ timestamp: now });
        const { caption } = formatGraduationFeed(event, token, null, 150);

        expect(caption).toContain('⚡️⚡️⚡️');
    });

    it('shows chart and trading links', () => {
        const event = makeGraduationEvent();
        const { caption } = formatGraduationFeed(event, null, null, 150);

        expect(caption).toContain('DEX');
        expect(caption).toContain('AXI');
        expect(caption).toContain('GMG');
    });

    it('includes holder data when enrichment provided', () => {
        const event = makeGraduationEvent();
        const enrichment = {
            holders: {
                totalHolders: 500,
                topHolders: [
                    { address: 'H1', pct: 5.0, isPool: false },
                    { address: 'H2', pct: 3.0, isPool: false },
                ],
                top10Pct: 15,
            },
        };
        const { caption } = formatGraduationFeed(event, null, null, 150, enrichment);

        expect(caption).toContain('500');
    });

    it('shows X profile when available', () => {
        const event = makeGraduationEvent();
        const token = {
            ...makeClaimFeedContext().tokenInfo!,
            twitter: 'https://x.com/pumpcoin',
        };
        const enrichment = {
            xProfile: makeXProfile({ followers: 50000, verified: true }),
        };
        const { caption } = formatGraduationFeed(event, token, null, 150, enrichment);

        expect(caption).toContain('pumpcoin');
        expect(caption).toContain('✅');
    });
});

// ── formatWhaleFeed ──────────────────────────────────────────────────────────

describe('formatWhaleFeed', () => {
    it('shows BUY for buy trades', () => {
        const event = makeTradeAlertEvent({ isBuy: true, solAmount: 25 });
        const result = formatWhaleFeed(event, null);

        expect(result).toContain('WHALE BUY');
        expect(result).toContain('🟢');
        expect(result).toContain('25.00 SOL');
    });

    it('shows SELL for sell trades', () => {
        const event = makeTradeAlertEvent({ isBuy: false, solAmount: 30 });
        const result = formatWhaleFeed(event, null);

        expect(result).toContain('WHALE SELL');
        expect(result).toContain('🔴');
    });

    it('shows bonding curve progress bar', () => {
        const event = makeTradeAlertEvent({ bondingCurveProgress: 50 });
        const result = formatWhaleFeed(event, null);

        // 50% = 5 filled, 5 empty
        expect(result).toContain('█████░░░░░');
    });

    it('shows fee info', () => {
        const event = makeTradeAlertEvent({ fee: 0.155, creatorFee: 0.05 });
        const result = formatWhaleFeed(event, null);

        expect(result).toContain('0.1550 SOL');
        expect(result).toContain('0.0500 SOL');
    });
});

// ── formatFeeDistributionFeed ────────────────────────────────────────────────

describe('formatFeeDistributionFeed', () => {
    it('shows distribution details', () => {
        const event = makeFeeDistributionEvent();
        const result = formatFeeDistributionFeed(event, null);

        expect(result).toContain('FEES DISTRIBUTED');
        expect(result).toContain('5.0000 SOL');
    });

    it('lists shareholders with percentages', () => {
        const event = makeFeeDistributionEvent({
            shareholders: [
                { address: 'Share1111111111111111111111111111111111111111', shareBps: 7000 },
                { address: 'Share2222222222222222222222222222222222222222', shareBps: 3000 },
            ],
        });
        const result = formatFeeDistributionFeed(event, null);

        expect(result).toContain('70.0%');
        expect(result).toContain('30.0%');
        expect(result).toContain('Shareholders (2)');
    });

    it('truncates to 5 shareholders and shows remainder', () => {
        const shareholders = Array.from({ length: 8 }, (_, i) => ({
            address: `Share${i}111111111111111111111111111111111111111`,
            shareBps: 1250,
        }));
        const event = makeFeeDistributionEvent({ shareholders });
        const result = formatFeeDistributionFeed(event, null);

        expect(result).toContain('+3 more');
    });
});

// ── Utility functions ────────────────────────────────────────────────────────

describe('shortAddr', () => {
    it('truncates long addresses', () => {
        const addr = 'WaLLeT111111111111111111111111111111111111111';
        const result = shortAddr(addr);

        expect(result).toBe('WaLLeT…1111');
        expect(result.length).toBeLessThan(addr.length);
    });

    it('returns short addresses unchanged', () => {
        expect(shortAddr('ABC')).toBe('ABC');
        expect(shortAddr('123456789012')).toBe('123456789012');
    });

    it('handles empty/null input', () => {
        expect(shortAddr('')).toBe('???');
    });
});

describe('esc', () => {
    it('escapes HTML characters', () => {
        expect(esc('a<b>c')).toBe('a&lt;b&gt;c');
        expect(esc('a&b')).toBe('a&amp;b');
        expect(esc('a"b')).toBe('a&quot;b');
    });

    it('handles strings without special chars', () => {
        expect(esc('hello world')).toBe('hello world');
    });

    it('handles empty string', () => {
        expect(esc('')).toBe('');
    });

    it('prevents XSS injection', () => {
        const malicious = '<script>alert("xss")</script>';
        const escaped = esc(malicious);

        expect(escaped).not.toContain('<script>');
        expect(escaped).toContain('&lt;script&gt;');
    });
});
