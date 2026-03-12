import { describe, it, expect } from 'vitest';
import {
    formatClaim, formatLaunch, formatGraduation,
    formatWhaleTrade, formatCTO, formatFeeDistribution,
} from '../formatter/templates.js';
import type {
    ClaimEventData, LaunchEventData, GraduationEventData,
    WhaleTradeEventData, CTOEventData, FeeDistEventData,
} from '../formatter/templates.js';

const BASE = { signature: 'sig123', slot: 100, blockTime: 1700000000 };

describe('formatter/templates', () => {
    it('formatClaim() produces valid HTML with all fields', () => {
        const event: ClaimEventData = {
            ...BASE,
            type: 'claim',
            claimerWallet: '7xKpR3nRm4qZ5bN2cW8dF1eG9hJk',
            tokenMint: 'MintABC123456789012345678901234',
            tokenName: 'PumpKitty',
            tokenSymbol: 'KITTY',
            amountLamports: 2_500_000_000,
            claimType: 'creator_fee',
        };
        const html = formatClaim(event);
        expect(html).toContain('<b>');
        expect(html).toContain('2.50 SOL');
        expect(html).toContain('PumpKitty');
        expect(html).toContain('Creator Fee');
        expect(html).toContain('solscan.io/tx/sig123');
    });

    it('formatLaunch() includes name, symbol, creator', () => {
        const event: LaunchEventData = {
            ...BASE,
            type: 'launch',
            tokenMint: 'MintABC123456789012345678901234',
            name: 'SolDoge',
            symbol: 'SDOGE',
            creator: '3mFqR8vLp4qZ5bN2cW8dF1eG9hJk',
        };
        const html = formatLaunch(event);
        expect(html).toContain('🚀');
        expect(html).toContain('SolDoge');
        expect(html).toContain('$SDOGE');
        expect(html).toContain('pump.fun');
    });

    it('formatGraduation() includes graduation emoji and pool info', () => {
        const event: GraduationEventData = {
            ...BASE,
            type: 'graduation',
            tokenMint: 'MintABC123456789012345678901234',
            tokenName: 'MoonPump',
            tokenSymbol: 'MPUMP',
            pool: 'PoolXYZ',
        };
        const html = formatGraduation(event);
        expect(html).toContain('🎓');
        expect(html).toContain('MoonPump');
        expect(html).toContain('PumpSwap AMM');
    });

    it('formatWhaleTrade() shows buy correctly', () => {
        const event: WhaleTradeEventData = {
            ...BASE,
            type: 'whale',
            direction: 'buy',
            amountLamports: 50_000_000_000,
            tokenMint: 'MintABC123456789012345678901234',
            tokenName: 'BonkFren',
            tokenSymbol: 'BFREN',
            wallet: '5cNrR7tQs4qZ5bN2cW8dF1eG9hJk',
        };
        const html = formatWhaleTrade(event);
        expect(html).toContain('🐋');
        expect(html).toContain('Buy');
        expect(html).toContain('50.00 SOL');
        expect(html).toContain('🟢');
    });

    it('formatWhaleTrade() shows sell correctly', () => {
        const event: WhaleTradeEventData = {
            ...BASE,
            type: 'whale',
            direction: 'sell',
            amountLamports: 10_000_000_000,
            tokenMint: 'MintABC123456789012345678901234',
            wallet: '5cNrR7tQs4qZ5bN2cW8dF1eG9hJk',
        };
        const html = formatWhaleTrade(event);
        expect(html).toContain('Sell');
        expect(html).toContain('🔴');
    });

    it('formatCTO() includes old and new creator', () => {
        const event: CTOEventData = {
            ...BASE,
            type: 'cto',
            tokenMint: 'MintABC123456789012345678901234',
            tokenName: 'ChadCoin',
            tokenSymbol: 'CHAD',
            oldCreator: '4fKtR6sWm4qZ5bN2cW8dF1eG9hJk',
            newCreator: '8bGxR1pRv4qZ5bN2cW8dF1eG9hJk',
        };
        const html = formatCTO(event);
        expect(html).toContain('👑');
        expect(html).toContain('ChadCoin');
        expect(html).toContain('From:');
        expect(html).toContain('To:');
    });

    it('formatFeeDistribution() lists shareholders', () => {
        const event: FeeDistEventData = {
            ...BASE,
            type: 'distribution',
            tokenMint: 'MintABC123456789012345678901234',
            tokenName: 'WenLambo',
            tokenSymbol: 'WEN',
            totalLamports: 5_000_000_000,
            shareholders: [
                { address: '7xKpR3nRm4qZ5bN2cW8dF1eG9hJk', amountLamports: 3_000_000_000 },
                { address: '3mFqR8vLp4qZ5bN2cW8dF1eG9hJk', amountLamports: 2_000_000_000 },
            ],
        };
        const html = formatFeeDistribution(event);
        expect(html).toContain('💎');
        expect(html).toContain('5.00 SOL');
        expect(html).toContain('Shareholders');
        expect(html).toContain('3.00 SOL');
        expect(html).toContain('2.00 SOL');
    });
});
