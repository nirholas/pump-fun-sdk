/**
 * @pumpkit/core — SDK Bridge
 *
 * Convenience wrappers around @nirholas/pump-sdk for PumpKit bots.
 * Fetches on-chain state and returns easy-to-consume results.
 *
 * Requires @nirholas/pump-sdk as a peer dependency.
 */

import type { Connection } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import {
    OnlinePumpSdk,
    getTokenPrice as sdkGetTokenPrice,
    getGraduationProgress as sdkGetGraduationProgress,
    getBuyTokenAmountFromSolAmount,
    getSellSolAmountFromTokenAmount,
    calculateBuyPriceImpact,
    calculateSellPriceImpact,
    bondingCurvePda,
} from '@nirholas/pump-sdk';
import type {
    BondingCurve,
    Global,
    FeeConfig,
    TokenPriceInfo,
    GraduationProgress,
} from '@nirholas/pump-sdk';

export interface BondingCurveInfo {
    virtualTokenReserves: string;
    virtualSolReserves: string;
    realTokenReserves: string;
    realSolReserves: string;
    tokenTotalSupply: string;
    complete: boolean;
    creator: string;
    isMayhemMode: boolean;
}

// Internal helper to fetch all state needed for price calculations
async function fetchState(connection: Connection, mint: PublicKey) {
    const sdk = new OnlinePumpSdk(connection);
    const [global, feeConfig, bondingCurve] = await Promise.all([
        sdk.fetchGlobal(),
        sdk.fetchFeeConfig(),
        sdk.fetchBondingCurve(mint),
    ]);
    // mintSupply is the user-held supply: totalSupply - virtualTokenReserves
    const mintSupply = bondingCurve.tokenTotalSupply.sub(bondingCurve.virtualTokenReserves);
    return { global, feeConfig, bondingCurve, mintSupply };
}

/**
 * Get the current token price and market cap for a bonding curve token.
 * Returns null if the bonding curve account doesn't exist.
 */
export async function getTokenPrice(
    connection: Connection,
    mint: PublicKey,
): Promise<TokenPriceInfo | null> {
    try {
        const { global, feeConfig, bondingCurve, mintSupply } = await fetchState(connection, mint);
        return sdkGetTokenPrice({ global, feeConfig, mintSupply, bondingCurve });
    } catch {
        return null;
    }
}

/**
 * Get graduation progress for a bonding curve token.
 * Returns null if the bonding curve account doesn't exist.
 */
export async function getGraduationProgress(
    connection: Connection,
    mint: PublicKey,
): Promise<GraduationProgress | null> {
    try {
        const sdk = new OnlinePumpSdk(connection);
        const [global, bondingCurve] = await Promise.all([
            sdk.fetchGlobal(),
            sdk.fetchBondingCurve(mint),
        ]);
        return sdkGetGraduationProgress(global, bondingCurve);
    } catch {
        return null;
    }
}

/**
 * Get a buy quote: how many tokens for a given SOL amount.
 */
export async function getBuyQuote(
    connection: Connection,
    mint: PublicKey,
    solAmount: BN,
): Promise<{ tokens: BN; priceImpact: number } | null> {
    try {
        const { global, feeConfig, bondingCurve, mintSupply } = await fetchState(connection, mint);
        const tokens = getBuyTokenAmountFromSolAmount({
            global,
            feeConfig,
            mintSupply,
            bondingCurve,
            amount: solAmount,
        });
        const impact = calculateBuyPriceImpact({
            global,
            feeConfig,
            mintSupply,
            bondingCurve,
            solAmount,
        });
        return { tokens, priceImpact: impact.impactBps / 100 };
    } catch {
        return null;
    }
}

/**
 * Get a sell quote: how much SOL for a given token amount.
 */
export async function getSellQuote(
    connection: Connection,
    mint: PublicKey,
    tokenAmount: BN,
): Promise<{ sol: BN; priceImpact: number } | null> {
    try {
        const { global, feeConfig, bondingCurve, mintSupply } = await fetchState(connection, mint);
        const sol = getSellSolAmountFromTokenAmount({
            global,
            feeConfig,
            mintSupply,
            bondingCurve,
            amount: tokenAmount,
        });
        const impact = calculateSellPriceImpact({
            global,
            feeConfig,
            mintSupply,
            bondingCurve,
            tokenAmount,
        });
        return { sol, priceImpact: impact.impactBps / 100 };
    } catch {
        return null;
    }
}

/**
 * Fetch the raw bonding curve state for a token.
 * Returns null if the account doesn't exist.
 */
export async function getBondingCurveState(
    connection: Connection,
    mint: PublicKey,
): Promise<BondingCurveInfo | null> {
    try {
        const sdk = new OnlinePumpSdk(connection);
        const bc = await sdk.fetchBondingCurve(mint);
        return {
            virtualTokenReserves: bc.virtualTokenReserves.toString(),
            virtualSolReserves: bc.virtualSolReserves.toString(),
            realTokenReserves: bc.realTokenReserves.toString(),
            realSolReserves: bc.realSolReserves.toString(),
            tokenTotalSupply: bc.tokenTotalSupply.toString(),
            complete: bc.complete,
            creator: bc.creator.toBase58(),
            isMayhemMode: bc.isMayhemMode,
        };
    } catch {
        return null;
    }
}
