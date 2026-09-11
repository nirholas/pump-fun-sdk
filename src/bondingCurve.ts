import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { SellOverflowError, UnsupportedQuoteMintError } from "./errors";
import { computeFeesBps, getFee } from "./fees";
import { isLegacyQuoteMint } from "./pda";
import type { BondingCurve, FeeConfig, Global } from "./state";

/**
 * u64::MAX = 2^64 - 1 = 18_446_744_073_709_551_615
 *
 * The deployed pump program widens to u128 before multiplying
 * `amount * virtualSolReserves` in the sell formula, so the intermediate
 * product overflows only past u128::MAX. Token amounts are themselves u64
 * on-chain, which is the binding constraint in every realistic case: at
 * mainnet reserve sizes the u128 product limit sits many orders of magnitude
 * above u64::MAX.
 *
 * This bound was previously derived from u64::MAX, which rejected the great
 * majority of real sells: sampling live mainnet trade events, 344 of 417
 * landed sells (83%) exceeded the old limit, some by more than 2000x. Any
 * caller reaching `sellInstructions` for an ordinary position size got a
 * `SellOverflowError` for a transaction the chain would have accepted.
 */
const U64_MAX = new BN("18446744073709551615");
const U128_MAX = new BN(
  "340282366920938463463374607431768211455",
);
const SELL_SAFETY_MARGIN = U128_MAX.muln(9).divn(10);

/**
 * Maximum token amount that is safe to sell in a single sell instruction for
 * the given reserves.
 *
 * The limit is the smaller of u64::MAX (the on-chain width of a token amount)
 * and `floor(0.9 * u128::MAX / virtualSolReserves)` (the intermediate product
 * bound, with a 10% margin absorbing reserve drift between quote and
 * execution). A migrated curve has zero reserves and cannot be sold on at
 * all, so the product can never overflow and the limit is u64::MAX.
 */
export function maxSafeSellAmount(virtualSolReserves: BN): BN {
  if (virtualSolReserves.isZero()) return U64_MAX;
  return BN.min(U64_MAX, SELL_SAFETY_MARGIN.div(virtualSolReserves));
}

/**
 * Throws `SellOverflowError` if the sell amount would overflow the on-chain
 * arithmetic. Use this as a pre-flight check before building sell
 * instructions.
 */
export function validateSellAmount(
  amount: BN,
  bondingCurve: BondingCurve,
): void {
  const max = maxSafeSellAmount(bondingCurve.virtualQuoteReserves);
  if (amount.gt(max)) {
    throw new SellOverflowError(amount, bondingCurve.virtualQuoteReserves, max);
  }
}

/**
 * The virtual quote reserves a curve quoted in `quoteMint` starts from.
 *
 * SOL curves start from `Global.initialVirtualSolReserves`; a curve quoted in
 * one of the mints `Global.whitelistedQuoteMints` admits starts from
 * `Global.initialVirtualQuoteReserves`, which is denominated in that mint and
 * so is a different number entirely. Quoting a mint the program does not
 * accept would put a curve on a starting price the chain will not agree with,
 * so it throws rather than guessing.
 */
export function initialVirtualQuoteReservesFor(
  global: Global,
  quoteMint: PublicKey,
): BN {
  if (isLegacyQuoteMint(quoteMint)) {
    return global.initialVirtualSolReserves;
  }
  if (global.whitelistedQuoteMints.some((mint) => mint.equals(quoteMint))) {
    return global.initialVirtualQuoteReserves;
  }
  throw new UnsupportedQuoteMintError(quoteMint);
}

/**
 * Create a new bonding curve state from global config.
 * Used when simulating a buy on a token that hasn't been created yet.
 *
 * @param global    - The program's `Global` account.
 * @param quoteMint - The mint the curve is quoted in. Defaults to SOL, which
 *                    the program stores as the zero key.
 */
export function newBondingCurve(
  global: Global,
  quoteMint: PublicKey = PublicKey.default,
): BondingCurve {
  return {
    virtualTokenReserves: global.initialVirtualTokenReserves,
    virtualQuoteReserves: initialVirtualQuoteReservesFor(global, quoteMint),
    realTokenReserves: global.initialRealTokenReserves,
    realQuoteReserves: new BN(0),
    tokenTotalSupply: global.tokenTotalSupply,
    complete: false,
    creator: PublicKey.default,
    isMayhemMode: global.mayhemModeEnabled,
    isCashbackCoin: false,
    // Stored the way the program stores it: the zero key on a SOL curve.
    quoteMint: isLegacyQuoteMint(quoteMint) ? PublicKey.default : quoteMint,
  };
}

function getBuySolAmountFromTokenAmountQuote({
  minAmount,
  virtualTokenReserves,
  virtualSolReserves,
}: {
  minAmount: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
}): BN {
  return minAmount
    .mul(virtualSolReserves)
    .div(virtualTokenReserves.sub(minAmount))
    .add(new BN(1));
}

function getBuyTokenAmountFromSolAmountQuote({
  inputAmount,
  virtualTokenReserves,
  virtualSolReserves,
}: {
  inputAmount: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
}): BN {
  return inputAmount
    .mul(virtualTokenReserves)
    .div(virtualSolReserves.add(inputAmount));
}

function getSellSolAmountFromTokenAmountQuote({
  inputAmount,
  virtualTokenReserves,
  virtualSolReserves,
}: {
  inputAmount: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
}): BN {
  return inputAmount
    .mul(virtualSolReserves)
    .div(virtualTokenReserves.add(inputAmount));
}

/**
 * Calculate how many tokens you receive for a given SOL amount (buy quote).
 * Accounts for protocol and creator fees.
 *
 * @param global - Global program state
 * @param feeConfig - Fee tier config (null uses defaults)
 * @param mintSupply - Current token supply (null for new tokens)
 * @param bondingCurve - Current bonding curve state (null for new tokens)
 * @param amount - SOL amount in lamports
 * @returns Token amount receivable
 */
export function getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN | null;
  bondingCurve: BondingCurve | null;
  amount: BN;
}): BN {
  if (amount.eq(new BN(0))) {
    return new BN(0);
  }

  let isNewBondingCurve = false;

  if (bondingCurve === null || mintSupply === null) {
    bondingCurve = newBondingCurve(global);
    mintSupply = global.tokenTotalSupply;
    isNewBondingCurve = true;
  }

  // migrated bonding curve
  if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
    return new BN(0);
  }

  const { virtualQuoteReserves, virtualTokenReserves } = bondingCurve;
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply,
    virtualQuoteReserves,
    virtualTokenReserves,
  });

  const totalFeeBasisPoints = protocolFeeBps.add(
    isNewBondingCurve || !PublicKey.default.equals(bondingCurve.creator)
      ? creatorFeeBps
      : new BN(0),
  );

  const inputAmount = amount
    .subn(1)
    .muln(10_000)
    .div(totalFeeBasisPoints.addn(10_000));

  const tokensReceived = getBuyTokenAmountFromSolAmountQuote({
    inputAmount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });

  return BN.min(tokensReceived, bondingCurve.realTokenReserves);
}

/**
 * Calculate how much SOL is required to buy a given token amount (buy cost).
 * Accounts for protocol and creator fees.
 *
 * @param global - Global program state
 * @param feeConfig - Fee tier config (null uses defaults)
 * @param mintSupply - Current token supply (null for new tokens)
 * @param bondingCurve - Current bonding curve state (null for new tokens)
 * @param amount - Token amount to buy
 * @returns SOL cost in lamports (including fees)
 */
export function getBuySolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN | null;
  bondingCurve: BondingCurve | null;
  amount: BN;
}): BN {
  if (amount.eq(new BN(0))) {
    return new BN(0);
  }

  let isNewBondingCurve = false;

  if (bondingCurve === null || mintSupply === null) {
    bondingCurve = newBondingCurve(global);
    mintSupply = global.tokenTotalSupply;
    isNewBondingCurve = true;
  }

  // migrated bonding curve
  if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
    return new BN(0);
  }

  const minAmount = BN.min(amount, bondingCurve.realTokenReserves);

  const solCost = getBuySolAmountFromTokenAmountQuote({
    minAmount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });

  return solCost.add(
    getFee({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: solCost,
      isNewBondingCurve,
    }),
  );
}

/**
 * Calculate how much SOL you receive for selling a given token amount (sell quote).
 * Accounts for protocol and creator fees.
 *
 * @param global - Global program state
 * @param feeConfig - Fee tier config (null uses defaults)
 * @param mintSupply - Current token supply
 * @param bondingCurve - Current bonding curve state
 * @param amount - Token amount to sell
 * @returns SOL receivable in lamports (after fees)
 */
export function getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
}): BN {
  if (amount.eq(new BN(0))) {
    return new BN(0);
  }

  // migrated bonding curve
  if (bondingCurve.virtualTokenReserves.eq(new BN(0))) {
    return new BN(0);
  }

  const solCost = getSellSolAmountFromTokenAmountQuote({
    inputAmount: amount,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
    virtualSolReserves: bondingCurve.virtualQuoteReserves,
  });

  const netSol = solCost.sub(
    getFee({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: solCost,
      isNewBondingCurve: false,
    }),
  );

  // ceilDiv fee rounding can exceed gross SOL for dust amounts; clamp to 0.
  return BN.max(new BN(0), netSol);
}

/**
 * Binary-search the token amount to sell that yields approximately `targetSol`
 * lamports (after all protocol and creator fees).
 *
 * Bounded by the smaller of `realTokenReserves` and `maxSafeSellAmount` so the
 * returned amount is always safe for a single sell instruction. If selling the
 * entire safe limit still doesn't reach `targetSol`, the limit is returned so
 * callers can decide whether to fall back to `sellChunked`.
 *
 * @param global - Global program state
 * @param feeConfig - Fee tier config (null uses defaults)
 * @param mintSupply - Current token supply
 * @param bondingCurve - Current bonding curve state
 * @param targetSol - Desired SOL out in lamports
 * @returns Token amount to sell, clamped to the safe single-tx limit
 */
export function getTokenAmountForTargetSol({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  targetSol,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  targetSol: BN;
}): BN {
  if (targetSol.isZero()) return new BN(0);

  const safeMax = maxSafeSellAmount(bondingCurve.virtualQuoteReserves);
  const upper = BN.min(bondingCurve.realTokenReserves, safeMax);

  if (upper.isZero()) return new BN(0);

  const maxOut = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: upper,
  });

  // Target unreachable within a single safe sell — return the ceiling
  if (maxOut.lte(targetSol)) return upper;

  let lo = new BN(0);
  let hi = upper;

  while (hi.sub(lo).gtn(1)) {
    const mid = lo.add(hi).divn(2);
    const solOut = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: mid,
    });
    if (solOut.gte(targetSol)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return hi;
}

/**
 * Pick a random fee recipient from the hardcoded list.
 * Used when building buy/sell instructions.
 */
export function getStaticRandomFeeRecipient(): PublicKey {
  const randomIndex = Math.floor(Math.random() * CURRENT_FEE_RECIPIENTS.length);
  const recipient = CURRENT_FEE_RECIPIENTS[randomIndex]!;
  return new PublicKey(recipient);
}

const CURRENT_FEE_RECIPIENTS = [
  "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV",
  "7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ",
  "7hTckgnGnLQR6sdH7YkqFTAA7VwTfYFaZ6EhEsU3saCX",
  "9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz",
  "AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY",
  "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM",
  "FWsW1xNtWscwNmKv6wVsU1iTzRN6wmmk3MjxRP5tT7hz",
  "G5UZAVbAf46s7cKWoyKu8kYTip9DGTpbLZ2qa9Aq69dP",
];

/**
 * Calculate the market cap of a token on its bonding curve.
 * Formula: `virtualSolReserves * mintSupply / virtualTokenReserves`
 *
 * @param mintSupply - Total token supply
 * @param virtualSolReserves - Virtual SOL reserves
 * @param virtualTokenReserves - Virtual token reserves
 * @returns Market cap in lamports
 * @throws If virtualTokenReserves is zero
 */
export function bondingCurveMarketCap({
  mintSupply,
  virtualQuoteReserves,
  virtualTokenReserves,
}: {
  mintSupply: BN;
  virtualQuoteReserves: BN;
  virtualTokenReserves: BN;
}): BN {
  if (virtualTokenReserves.isZero()) {
    throw new Error("Division by zero: virtual token reserves cannot be zero");
  }
  return virtualQuoteReserves.mul(mintSupply).div(virtualTokenReserves);
}


