/**
 * Analytics & convenience helpers for the Pump SDK
 *
 * Pure offline functions for:
 *   - Price impact calculation
 *   - Graduation progress
 *   - Token price (per-token SOL cost)
 *   - Bonding curve summary
 */

import BN from "bn.js";

import {
  getBuyTokenAmountFromSolAmount,
  getBuySolAmountFromTokenAmount,
  getSellSolAmountFromTokenAmount,
  bondingCurveMarketCap,
} from "./bondingCurve";
import { computeFeesBps } from "./fees";
import { BondingCurve, FeeConfig, Global } from "./state";

// ── Types ─────────────────────────────────────────────────────────────

export interface PriceImpactResult {
  /** Price per token BEFORE the trade (in lamports) */
  priceBefore: BN;
  /** Price per token AFTER the trade (in lamports) */
  priceAfter: BN;
  /** Price impact as basis points (e.g. 150 = 1.5%) */
  impactBps: number;
  /** Tokens received (for buy) or SOL received (for sell) */
  outputAmount: BN;
}

export interface GraduationProgress {
  /** Percentage complete (0 – 100, two decimal places via integer * 100) */
  progressBps: number;
  /** Whether the token has already graduated */
  isGraduated: boolean;
  /** Tokens remaining to be sold before graduation */
  tokensRemaining: BN;
  /** Total real tokens the curve started with */
  tokensTotal: BN;
  /** SOL accumulated in the real reserves */
  solAccumulated: BN;
  /** SOL cost (in lamports) to buy all remaining tokens and trigger graduation */
  solNeededToGraduate: BN;
}

export interface TokenPriceInfo {
  /** Cost to buy 1 whole token (10^6 raw units) in lamports */
  buyPricePerToken: BN;
  /** SOL received for selling 1 whole token in lamports */
  sellPricePerToken: BN;
  /** Current market cap in lamports */
  marketCap: BN;
  /** Whether the bonding curve is complete */
  isGraduated: boolean;
}

export interface BondingCurveSummary {
  /** Current market cap in lamports */
  marketCap: BN;
  /** Graduation progress (0-10000 bps) */
  progressBps: number;
  /** Is graduated */
  isGraduated: boolean;
  /** SOL cost to buy all remaining tokens and trigger graduation */
  solNeededToGraduate: BN;
  /** Buy price for 1 whole token in lamports */
  buyPricePerToken: BN;
  /** Sell price for 1 whole token in lamports */
  sellPricePerToken: BN;
  /** Real SOL reserves (lamports) */
  realSolReserves: BN;
  /** Real token reserves remaining */
  realTokenReserves: BN;
  /** Virtual SOL reserves */
  virtualSolReserves: BN;
  /** Virtual token reserves */
  virtualTokenReserves: BN;
  /** Protocol fee in basis points for the current fee tier */
  protocolFeeBps: BN;
  /** Creator fee in basis points for the current fee tier */
  creatorFeeBps: BN;
  /** Whether this is a Mayhem Mode token */
  isMayhemMode: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────

const LAMPORTS_PER_SOL = new BN(1_000_000_000);
/** Pump tokens have 6 decimals */
const ONE_TOKEN = new BN(1_000_000);

/**
 * Spot price = virtualSolReserves / virtualTokenReserves (in lamports per raw token unit).
 * Scaled by 1e9 for precision.
 */
function spotPrice(bondingCurve: BondingCurve): BN {
  if (bondingCurve.virtualTokenReserves.isZero()) return new BN(0);
  return bondingCurve.virtualSolReserves
    .mul(LAMPORTS_PER_SOL)
    .div(bondingCurve.virtualTokenReserves);
}

// ── Price Impact ──────────────────────────────────────────────────────

/**
 * Calculate the price impact of a buy trade.
 *
 * @param params.global     - Pump global state
 * @param params.feeConfig  - On-chain fee config (null for legacy flat fees)
 * @param params.mintSupply - Current mint supply
 * @param params.bondingCurve - Current bonding curve state
 * @param params.solAmount  - SOL amount to spend (in lamports)
 * @returns Price impact details
 */
export function calculateBuyPriceImpact({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  solAmount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  solAmount: BN;
}): PriceImpactResult {
  const priceBefore = spotPrice(bondingCurve);

  const tokensReceived = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: solAmount,
  });

  // Simulate new reserves after trade
  const newVirtualSolReserves = bondingCurve.virtualSolReserves.add(solAmount);
  const newVirtualTokenReserves =
    bondingCurve.virtualTokenReserves.sub(tokensReceived);

  const priceAfter = newVirtualTokenReserves.isZero()
    ? new BN(0)
    : newVirtualSolReserves.mul(LAMPORTS_PER_SOL).div(newVirtualTokenReserves);

  const impactBps = priceBefore.isZero()
    ? 0
    : priceAfter
        .sub(priceBefore)
        .muln(10_000)
        .div(priceBefore)
        .toNumber();

  return {
    priceBefore,
    priceAfter,
    impactBps,
    outputAmount: tokensReceived,
  };
}

/**
 * Calculate the price impact of a sell trade.
 *
 * @param params.global     - Pump global state
 * @param params.feeConfig  - On-chain fee config (null for legacy flat fees)
 * @param params.mintSupply - Current mint supply
 * @param params.bondingCurve - Current bonding curve state
 * @param params.tokenAmount - Token amount to sell (raw units)
 * @returns Price impact details
 */
export function calculateSellPriceImpact({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  tokenAmount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  tokenAmount: BN;
}): PriceImpactResult {
  const priceBefore = spotPrice(bondingCurve);

  const solReceived = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: tokenAmount,
  });

  // Simulate new reserves after trade
  const newVirtualSolReserves = bondingCurve.virtualSolReserves.sub(solReceived);
  const newVirtualTokenReserves =
    bondingCurve.virtualTokenReserves.add(tokenAmount);

  const priceAfter = newVirtualTokenReserves.isZero()
    ? new BN(0)
    : newVirtualSolReserves.mul(LAMPORTS_PER_SOL).div(newVirtualTokenReserves);

  const impactBps = priceBefore.isZero()
    ? 0
    : priceBefore
        .sub(priceAfter)
        .muln(10_000)
        .div(priceBefore)
        .toNumber();

  return {
    priceBefore,
    priceAfter,
    impactBps,
    outputAmount: solReceived,
  };
}

// ── Graduation Progress ───────────────────────────────────────────────

/**
 * Standard initial real token reserves for a Pump bonding curve.
 * Tokens are sold from this pool; when it reaches 0 the curve graduates.
 */
export const INITIAL_REAL_TOKEN_RESERVES = new BN("793100000000000");

/**
 * Lightweight graduation progress check — no on-chain state required.
 *
 * Returns a number in [0, 1] where 1.0 = graduated. Uses a fixed
 * `initialRealTokenReserves` constant (793.1M tokens, 6 decimals), which
 * matches all Pump bonding curves created via `create_v2`.
 *
 * For mayhem-mode tokens with custom virtual params the initial reserves
 * may differ; pass the optional `initialRealTokenReserves` override.
 *
 * @example
 * const progress = bondingCurveGraduationProgress({ realSolReserves: bc.realSolReserves, realTokenReserves: bc.realTokenReserves });
 * console.log(`${(progress * 100).toFixed(1)}% to graduation`);
 */
export function bondingCurveGraduationProgress({
  realTokenReserves,
  initialRealTokenReserves = INITIAL_REAL_TOKEN_RESERVES,
}: {
  realSolReserves: BN;
  realTokenReserves: BN;
  initialRealTokenReserves?: BN;
}): number {
  if (initialRealTokenReserves.isZero()) return 0;
  if (realTokenReserves.isZero()) return 1;
  const sold = initialRealTokenReserves.sub(
    BN.min(realTokenReserves, initialRealTokenReserves),
  );
  return Math.min(1, sold.toNumber() / initialRealTokenReserves.toNumber());
}

/**
 * Calculate how close a token is to graduating from the bonding curve to AMM.
 *
 * A token graduates when `realTokenReserves` reaches 0 (all tokens sold).
 * Progress = 1 - (realTokenReserves / initialRealTokenReserves)
 *
 * @param global       - Pump global state (for initial reserves)
 * @param bondingCurve - Current bonding curve state
 * @returns Graduation progress details
 */
export function getGraduationProgress(
  global: Global,
  bondingCurve: BondingCurve,
  feeConfig: FeeConfig | null = null,
): GraduationProgress {
  if (bondingCurve.complete) {
    return {
      progressBps: 10_000,
      isGraduated: true,
      tokensRemaining: new BN(0),
      tokensTotal: global.initialRealTokenReserves,
      solAccumulated: bondingCurve.realSolReserves,
      solNeededToGraduate: new BN(0),
    };
  }

  const initialReal = global.initialRealTokenReserves;
  if (initialReal.isZero()) {
    return {
      progressBps: 0,
      isGraduated: false,
      tokensRemaining: new BN(0),
      tokensTotal: new BN(0),
      solAccumulated: new BN(0),
      solNeededToGraduate: new BN(0),
    };
  }

  const tokensSold = initialReal.sub(bondingCurve.realTokenReserves);
  const progressBps = tokensSold.muln(10_000).div(initialReal).toNumber();

  const solNeededToGraduate = getBuySolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: bondingCurve.realTokenReserves,
  });

  return {
    progressBps,
    isGraduated: false,
    tokensRemaining: bondingCurve.realTokenReserves,
    tokensTotal: initialReal,
    solAccumulated: bondingCurve.realSolReserves,
    solNeededToGraduate,
  };
}

// ── Token Price ───────────────────────────────────────────────────────

/**
 * Get the current price per whole token (10^6 raw units) from the bonding curve.
 *
 * @param global       - Pump global state
 * @param feeConfig    - Fee config (null for legacy)
 * @param mintSupply   - Current mint supply
 * @param bondingCurve - Current bonding curve state
 * @returns Buy/sell price per token and market cap
 */
export function getTokenPrice({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
}): TokenPriceInfo {
  // Cost to buy 1 whole token (1e6 raw units)
  const buyPricePerToken = getBuySolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: ONE_TOKEN,
  });

  // SOL received for selling 1 whole token
  const sellPricePerToken = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: ONE_TOKEN,
  });

  const marketCap = bondingCurveMarketCap({
    mintSupply,
    virtualSolReserves: bondingCurve.virtualSolReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });

  return {
    buyPricePerToken,
    sellPricePerToken,
    marketCap,
    isGraduated: bondingCurve.complete,
  };
}

// ── Bonding Curve Summary ─────────────────────────────────────────────

/**
 * Get a comprehensive summary of a bonding curve's current state,
 * combining market cap, graduation progress, and token pricing.
 *
 * @param global       - Pump global state
 * @param feeConfig    - Fee config (null for legacy)
 * @param mintSupply   - Current mint supply
 * @param bondingCurve - Current bonding curve state
 * @returns Full summary of the bonding curve
 */
export function getBondingCurveSummary({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
}): BondingCurveSummary {
  const progress = getGraduationProgress(global, bondingCurve, feeConfig);
  const price = getTokenPrice({ global, feeConfig, mintSupply, bondingCurve });
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply,
    virtualSolReserves: bondingCurve.virtualSolReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });

  return {
    marketCap: price.marketCap,
    progressBps: progress.progressBps,
    isGraduated: progress.isGraduated,
    solNeededToGraduate: progress.solNeededToGraduate,
    buyPricePerToken: price.buyPricePerToken,
    sellPricePerToken: price.sellPricePerToken,
    realSolReserves: bondingCurve.realSolReserves,
    realTokenReserves: bondingCurve.realTokenReserves,
    virtualSolReserves: bondingCurve.virtualSolReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    protocolFeeBps,
    creatorFeeBps,
    isMayhemMode: bondingCurve.isMayhemMode,
  };
}

