import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { SellOverflowError } from "./errors";
import { computeFeesBps, getFee } from "./fees";
import { BondingCurve, FeeConfig, Global } from "./state";

/**
 * u64::MAX = 2^64 - 1 = 18_446_744_073_709_551_615
 *
 * The deployed pump program computes `amount * virtualSolReserves` as a u64
 * before dividing in the sell formula. When that intermediate product exceeds
 * u64::MAX, the program aborts with AnchorError 6024 (Overflow). We mirror the
 * same upper bound here — minus a 10% safety margin — so we can refuse the
 * sell before any tokens move.
 */
const U64_MAX = new BN("18446744073709551615");
const SELL_SAFETY_MARGIN = U64_MAX.muln(9).divn(10);

/**
 * Maximum token amount that is safe to sell in a single sell instruction for
 * the given reserves.
 *
 * Returns `floor(0.9 * u64::MAX / virtualSolReserves)`. The 10% margin absorbs
 * reserve drift between quote and execution. Returns 0 if reserves are 0.
 */
export function maxSafeSellAmount(virtualSolReserves: BN): BN {
  if (virtualSolReserves.isZero()) return new BN(0);
  return SELL_SAFETY_MARGIN.div(virtualSolReserves);
}

/**
 * Throws `SellOverflowError` if the sell amount would overflow the on-chain
 * u64 multiply. Use this as a pre-flight check before building sell
 * instructions.
 */
export function validateSellAmount(
  amount: BN,
  bondingCurve: BondingCurve,
): void {
  const max = maxSafeSellAmount(bondingCurve.virtualSolReserves);
  if (amount.gt(max)) {
    throw new SellOverflowError(amount, bondingCurve.virtualSolReserves, max);
  }
}

/**
 * Create a new bonding curve state from global config.
 * Used when simulating a buy on a token that hasn't been created yet.
 */
export function newBondingCurve(global: Global): BondingCurve {
  return {
    virtualTokenReserves: global.initialVirtualTokenReserves,
    virtualSolReserves: global.initialVirtualSolReserves,
    realTokenReserves: global.initialRealTokenReserves,
    realSolReserves: new BN(0),
    tokenTotalSupply: global.tokenTotalSupply,
    complete: false,
    creator: PublicKey.default,
    isMayhemMode: global.mayhemModeEnabled,
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

  const { virtualSolReserves, virtualTokenReserves } = bondingCurve;
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply,
    virtualSolReserves,
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
    virtualSolReserves: bondingCurve.virtualSolReserves,
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
    virtualSolReserves: bondingCurve.virtualSolReserves,
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
    virtualSolReserves: bondingCurve.virtualSolReserves,
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
  virtualSolReserves,
  virtualTokenReserves,
}: {
  mintSupply: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
}): BN {
  if (virtualTokenReserves.isZero()) {
    throw new Error("Division by zero: virtual token reserves cannot be zero");
  }
  return virtualSolReserves.mul(mintSupply).div(virtualTokenReserves);
}


