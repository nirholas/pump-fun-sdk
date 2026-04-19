# Task 26: Agent Pre-Flight Simulation & Safety Checks

## Context

You are working in the `pump-fun-sdk` repository. Autonomous agents must not send blind transactions. Before any buy/sell, the agent should pre-simulate against the latest slot, project the resulting token delta and SOL delta, verify the slippage envelope, and reject the trade if the on-chain state has shifted beyond a tolerance threshold.

This task introduces a **SafetyInspector** that wraps the `OnlinePumpSdk` and adds pre-flight checks.

## Background

The SDK already has `OnlinePumpSdk.fetchBuyState` / `fetchSellState`, which return `BondingCurve`, `Global`, and associated token accounts. The agent needs more:
- **Freshness check** — the fetched state's slot vs the slot at simulation time
- **Projected delta** — using bonding curve math, compute expected tokens out / SOL out
- **Price impact** — percent change in token price
- **Graduation check** — `bondingCurve.complete` means bonding curve trading is disabled
- **Dust floor** — reject sells of amounts where the fee exceeds the gross SOL (bug fixed in v1.32.0)
- **Creator fee awareness** — verify fee recipient configuration matches expectations

## Objective

Create `src/agent/safety.ts` that exposes `SafetyInspector`, plus explicit deny-reasons for rejected trades.

## What to Create

### 1. `src/agent/safety.ts`

```typescript
export type DenyReason =
  | { kind: 'graduated'; mint: PublicKey }
  | { kind: 'dust'; amount: BN; netSolEstimate: BN }
  | { kind: 'stale_state'; fetchedSlot: number; currentSlot: number; maxLag: number }
  | { kind: 'price_impact_exceeded'; expected: number; max: number }
  | { kind: 'insufficient_token_balance'; have: BN; need: BN }
  | { kind: 'insufficient_sol_balance'; have: BN; need: BN }
  | { kind: 'slippage_too_tight'; computedOut: BN; min: BN }
  | { kind: 'fee_recipient_changed'; expected: PublicKey; actual: PublicKey };

export interface BuyInspection {
  ok: boolean;
  reason?: DenyReason;
  projected: {
    tokensOut: BN;
    solIn: BN;
    feeLamports: BN;
    priceImpactPct: number;
    newSpotPriceLamports: BN;
  };
  stateSlot: number;
}

export interface SellInspection {
  ok: boolean;
  reason?: DenyReason;
  projected: {
    solOut: BN;
    tokensIn: BN;
    feeLamports: BN;
    priceImpactPct: number;
    newSpotPriceLamports: BN;
  };
  stateSlot: number;
}

export interface InspectorOptions {
  maxStateSlotLag?: number;        // default 20
  maxPriceImpactPct?: number;      // default 5
  minNetSolOutLamports?: BN;       // default 1000 (dust guard)
  expectedFeeRecipient?: PublicKey;
}

export class SafetyInspector {
  constructor(online: OnlinePumpSdk, opts?: InspectorOptions);

  async inspectBuy(params: {
    mint: PublicKey;
    user: PublicKey;
    solAmount: BN;
    slippageBps: number;  // expects 1..10000 — no floats
  }): Promise<BuyInspection>;

  async inspectSell(params: {
    mint: PublicKey;
    user: PublicKey;
    tokenAmount: BN;
    slippageBps: number;
  }): Promise<SellInspection>;
}
```

Implementation notes:
- Fetch state via `online.fetchBuyState` / `fetchSellState`
- Capture `connection.getSlot()` BEFORE and AFTER state fetch — if `(afterSlot - stateSlot) > maxStateSlotLag`, deny with `stale_state`
- Reuse `getBuyTokenAmountFromSolAmount` / `getSellSolAmountFromTokenAmount` for projections
- Reuse `calculateBuyPriceImpact` from `src/analytics.ts` for price impact
- If `bondingCurve.complete === true`, return `graduated` deny reason immediately
- For sell: if projected `solOut <= minNetSolOutLamports`, deny with `dust`
- For buy: check user SOL balance via `connection.getBalance(user)`
- For sell: check user token balance via `getParsedTokenAccountsByOwner` or from the associated account in the fetch state

### 2. New File: `src/agent/slippage.ts`

Centralize slippage math (both buy and sell) using BPS, not floats. This avoids the v1.31.0 `Math.floor(slippage * 10)` bug.

```typescript
// For buy: caller wants to NOT pay more than solAmount * (1 + slippageBps/10000)
export function maxSolInWithSlippage(solAmount: BN, slippageBps: number): BN;
// For sell: caller wants to receive at LEAST solOut * (1 - slippageBps/10000)
export function minSolOutWithSlippage(solOut: BN, slippageBps: number): BN;
```

Both must clamp at 0, use `BN.mul` + integer div only, and throw on `slippageBps < 0 || slippageBps > 10000`.

### 3. Tests: `src/__tests__/agent-safety.test.ts`

- Inspector denies trade when `bondingCurve.complete = true`
- Inspector denies sell when projected `solOut < minNetSolOutLamports`
- Inspector denies trade when `currentSlot - stateSlot > maxStateSlotLag`
- Inspector computes correct `tokensOut` projection for a canonical curve
- `maxSolInWithSlippage` / `minSolOutWithSlippage` round-trip against sdk.ts values
- Negative / out-of-range `slippageBps` throws

### 4. Update `src/agent/index.ts`

Add: `export * from './safety'; export * from './slippage';`

## Rules

- No floats in slippage math — BPS only
- All projections must use existing bonding curve helpers — do not reimplement
- `SafetyInspector` wraps `OnlinePumpSdk`; it must not duplicate RPC calls unnecessarily (batch with `getMultipleAccountsInfo` when possible)
- Use `BN` throughout
- Run `npm run typecheck`, never `npx tsc --noEmit`

## Files to Read Before Starting

- `src/onlineSdk.ts` — `fetchBuyState`, `fetchSellState` signatures
- `src/bondingCurve.ts` — projection helpers
- `src/analytics.ts` — `calculateBuyPriceImpact`, `getTokenPrice`
- `src/sdk.ts` — how slippage is applied today (and the v1.31 bug)
- `src/agent/executor.ts` (from Task 24)
