# Tutorial 9: Understanding the Fee System

> How Pump's tiered fee system works and how to calculate fees off-chain.

## Fee Overview

Every buy/sell on Pump incurs two types of fees:

| Fee | Goes To |
|-----|---------|
| **Protocol fee** | Pump protocol treasury |
| **Creator fee** | Token creator (or sharing config shareholders) |

Fees are calculated in **basis points (BPS)** where 100 BPS = 1%.

## Tiered Fee Structure

Fees vary based on the bonding curve's **market cap**. Higher market cap = different fee tier:

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk, bondingCurveMarketCap } from "@pump-fun/pump-sdk";
import { computeFeesBps } from "@pump-fun/pump-sdk/fees";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);
const mint = new PublicKey("YOUR_MINT");

const global = await onlineSdk.fetchGlobal();
const feeConfig = await onlineSdk.fetchFeeConfig();
const bondingCurve = await onlineSdk.fetchBondingCurve(mint);
```

## Calculating Fees for a Trade

```typescript
import { computeFeesBps } from "@pump-fun/pump-sdk";
import BN from "bn.js";

// Get the current fee tier
const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
  global,
  feeConfig,
  mintSupply: bondingCurve.tokenTotalSupply,
  virtualSolReserves: bondingCurve.virtualSolReserves,
  virtualTokenReserves: bondingCurve.virtualTokenReserves,
});

console.log("Protocol fee:", protocolFeeBps.toString(), "BPS");
console.log("Creator fee:", creatorFeeBps.toString(), "BPS");
console.log("Total fee:", protocolFeeBps.add(creatorFeeBps).toString(), "BPS");

// Calculate fee amount on a 1 SOL trade
const tradeAmount = new BN(1_000_000_000); // 1 SOL
const protocolFee = tradeAmount.mul(protocolFeeBps).divn(10_000);
const creatorFee = tradeAmount.mul(creatorFeeBps).divn(10_000);

console.log("Protocol fee on 1 SOL:", protocolFee.toNumber() / 1e9, "SOL");
console.log("Creator fee on 1 SOL:", creatorFee.toNumber() / 1e9, "SOL");
```

## FeeConfig Structure

The `FeeConfig` account holds the fee tiers:

```typescript
interface FeeConfig {
  admin: PublicKey;
  flatFees: Fees;         // Default fees when no tier matches
  feeTiers: FeeTier[];     // Market-cap-based tiers
}

interface FeeTier {
  marketCapLamportsThreshold: BN;  // Market cap threshold
  fees: Fees;
}

interface Fees {
  lpFeeBps: BN;
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}
```

## How Fee Tiers Are Selected

The SDK's `calculateFeeTier` function selects the appropriate tier:

```typescript
import { calculateFeeTier } from "@pump-fun/pump-sdk";

// Calculate current market cap
const marketCap = bondingCurveMarketCap({
  mintSupply: bondingCurve.tokenTotalSupply,
  virtualSolReserves: bondingCurve.virtualSolReserves,
  virtualTokenReserves: bondingCurve.virtualTokenReserves,
});

// Find the matching fee tier
const fees = calculateFeeTier({
  feeTiers: feeConfig.feeTiers,
  marketCap,
});

console.log("Active fee tier:");
console.log("  Protocol:", fees.protocolFeeBps.toString(), "BPS");
console.log("  Creator:", fees.creatorFeeBps.toString(), "BPS");
console.log("  LP:", fees.lpFeeBps.toString(), "BPS");
```

The algorithm:
1. If market cap < first tier threshold → use first tier
2. Otherwise, find the highest tier where market cap >= threshold

## Creator Fee Destinations

Creator fees go to different places depending on configuration:

```typescript
import { isCreatorUsingSharingConfig } from "@pump-fun/pump-sdk";

const bc = await onlineSdk.fetchBondingCurve(mint);

if (PublicKey.default.equals(bc.creator)) {
  console.log("No creator set — creator fees are burned");
} else if (isCreatorUsingSharingConfig({ mint, creator: bc.creator })) {
  console.log("Creator fees → fee sharing config → multiple shareholders");
} else {
  console.log("Creator fees → single creator wallet:", bc.creator.toBase58());
}
```

## Simulating Fees Before Trading

Build a fee calculator to preview costs:

```typescript
function previewTrade(solAmount: BN, isBuy: boolean) {
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    virtualSolReserves: bondingCurve.virtualSolReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });

  const totalFeeBps = protocolFeeBps.add(creatorFeeBps);
  const feeAmount = solAmount.mul(totalFeeBps).divn(10_000);
  const netAmount = solAmount.sub(feeAmount);

  return {
    grossAmount: solAmount.toString(),
    totalFeeBps: totalFeeBps.toString(),
    feeAmount: feeAmount.toString(),
    netAmount: netAmount.toString(),
    protocolFee: solAmount.mul(protocolFeeBps).divn(10_000).toString(),
    creatorFee: solAmount.mul(creatorFeeBps).divn(10_000).toString(),
  };
}

console.log(previewTrade(new BN(1_000_000_000), true));
```

## What's Next?

- [Tutorial 7: Set Up Fee Sharing](./07-fee-sharing.md)
- [Tutorial 10: Working with PDAs](./10-working-with-pdas.md)
