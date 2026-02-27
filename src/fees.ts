import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { bondingCurveMarketCap } from "./bondingCurve";
import { FeeConfig, Global, Fees, BondingCurve, FeeTier } from "./state";

/** Constant: 1 billion token supply with 6 decimals (1,000,000,000 * 10^6). */
export const ONE_BILLION_SUPPLY = new BN(1_000_000_000_000_000);

export interface CalculatedFeesBps {
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}

/**
 * Calculate the total fee (protocol + creator) for a given trade amount.
 * Used internally by buy/sell quote functions.
 */
export function getFee({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
  isNewBondingCurve,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
  isNewBondingCurve: boolean;
}) {
  const { virtualSolReserves, virtualTokenReserves, isMayhemMode } =
    bondingCurve;
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply: isMayhemMode ? mintSupply : ONE_BILLION_SUPPLY,
    virtualSolReserves,
    virtualTokenReserves,
  });

  return fee(amount, protocolFeeBps).add(
    isNewBondingCurve || !PublicKey.default.equals(bondingCurve.creator)
      ? fee(amount, creatorFeeBps)
      : new BN(0),
  );
}

/**
 * Compute the protocol and creator fee rates in basis points.
 * Uses tiered fees from FeeConfig when available, otherwise falls back to global defaults.
 */
export function computeFeesBps({
  global,
  feeConfig,
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
}): CalculatedFeesBps {
  if (feeConfig != null) {
    const marketCap = bondingCurveMarketCap({
      mintSupply,
      virtualSolReserves,
      virtualTokenReserves,
    });

    return calculateFeeTier({
      feeTiers: feeConfig.feeTiers,
      marketCap,
    });
  }

  return {
    protocolFeeBps: global.feeBasisPoints,
    creatorFeeBps: global.creatorFeeBasisPoints,
  };
}

/**
 * Select the appropriate fee tier based on market cap.
 * Fee tiers are ordered by market cap threshold; the highest matching tier is used.
 *
 * @throws If feeTiers is empty
 */
/// rust reference: pump-fees-math::calculate_fee_tier()
export function calculateFeeTier({
  feeTiers,
  marketCap,
}: {
  feeTiers: FeeTier[];
  marketCap: BN;
}): Fees {
  const firstTier = feeTiers[0];
  if (!firstTier) {
    throw new Error("feeTiers must not be empty");
  }

  if (marketCap.lt(firstTier.marketCapLamportsThreshold)) {
    return firstTier.fees;
  }

  for (const tier of feeTiers.slice().reverse()) {
    if (marketCap.gte(tier.marketCapLamportsThreshold)) {
      return tier.fees;
    }
  }

  return firstTier.fees;
}

function fee(amount: BN, feeBasisPoints: BN): BN {
  return ceilDiv(amount.mul(feeBasisPoints), new BN(10_000));
}

function ceilDiv(a: BN, b: BN): BN {
  return a.add(b.subn(1)).div(b);
}

export function getFeeRecipient(
  global: Global,
  mayhemMode: boolean,
): PublicKey {
  if (mayhemMode) {
    const feeRecipients = [
      global.reservedFeeRecipient,
      ...global.reservedFeeRecipients,
    ];
    return feeRecipients[Math.floor(Math.random() * feeRecipients.length)]!;
  }
  const feeRecipients = [global.feeRecipient, ...global.feeRecipients];
  return feeRecipients[Math.floor(Math.random() * feeRecipients.length)]!;
}

