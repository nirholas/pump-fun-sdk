---
name: pump-token-lifecycle
description: "Full token lifecycle from creation through bonding curve trading, graduation detection, AMM migration, fee collection, and volume tracking on Solana using PumpSdk and OnlinePumpSdk."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
    requires:
      env:
        - SOLANA_RPC_URL
---

# Token Lifecycle — Create, Trade, Graduate, Migrate & Collect

Manage the full lifecycle of Pump tokens from creation through bonding curve trading, graduation detection, AMM migration, fee collection, and volume tracking — using the offline `PumpSdk` and online `OnlinePumpSdk`.

## Context

Pump tokens follow a defined lifecycle: creation → bonding curve trading → graduation (when market cap reaches threshold) → AMM migration → AMM trading. The SDK provides instruction builders for each phase, with both offline (no RPC) and online (live fetches) variants.

## Lifecycle Phases

### Phase 1: Token Creation

```typescript
// V2 creation with Token-2022 (preferred)
const ix = await PUMP_SDK.createV2Instruction({
    mint, name, symbol, uri, creator, user,
});

// Create and immediately buy in same transaction
const ixs = await PUMP_SDK.createV2AndBuyInstructions({
    global, feeConfig, mint, name, symbol, uri,
    creator, user, solAmount, amount, slippage
});
```

- `createInstruction` (v1) is **deprecated** — use `createV2Instruction` (Token-2022)
- Token-2022 enables advanced token features (transfer hooks, confidential transfers)
- Mayhem mode tokens use additional Mayhem program PDAs

### Phase 2: Bonding Curve Trading

```typescript
// Buy
const { bondingCurve } = await onlineSdk.fetchBuyState(mint, user);
const amount = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply, bondingCurve, amount: solAmount });
const ixs = await PUMP_SDK.buyInstructions({ global, bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo, mint, user, solAmount, amount, slippage: 1 });

// Sell
const solAmount = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply, bondingCurve, amount });
const ixs = await PUMP_SDK.sellInstructions({ global, bondingCurveAccountInfo, bondingCurve, mint, user, amount, solAmount, slippage: 1 });
```

### Phase 3: Graduation Detection

```typescript
const bondingCurve = await onlineSdk.fetchBondingCurve(mint);
if (bondingCurve.complete) {
    // Token has graduated — must migrate to AMM
}
```

### Phase 4: AMM Migration

```typescript
const extendIx = await PUMP_SDK.extendAccountInstruction({ bondingCurvePda, bondingCurveAccountInfo });
const migrateIx = await PUMP_SDK.migrateInstruction({ mint, creator });
```

### Phase 5: Post-Migration (AMM Trading)

After migration, the SDK's "BothPrograms" methods handle trading transparently across Pump and PumpAMM.

### Phase 6: Creator Fee Collection

```typescript
const ixs = await onlineSdk.collectCoinCreatorFeeInstructions(creator);
const balance = await onlineSdk.getCreatorVaultBalanceBothPrograms(creator);
```

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PUMP_PROGRAM_ID` | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve program |
| `PUMP_AMM_PROGRAM_ID` | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | AMM pool program |
| `PUMP_FEE_PROGRAM_ID` | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing program |
| `BONDING_CURVE_NEW_SIZE` | `151` | Extended account size |

## State Transition Diagram

```
              create
    ────────────────────── ►  ACTIVE (BondingCurve)
                                    │
                               buy / sell
                                    │
                              graduation
                          (complete = true)
                                    │
                               migrate
                                    ▼
                              GRADUATED (AMM Pool)
                                    │
                              AMM trading + fee collection
```

## Patterns to Follow

- Return `TransactionInstruction[]`, never `Transaction` objects
- Use `getMultipleAccountsInfo` to batch RPC calls
- Check `bondingCurve.complete` before any bonding curve operation
- Use `fetchBuyState` / `fetchSellState` for efficient account fetching
- Always extend account before migration if needed

## Common Pitfalls

- `BondingCurve.complete === true` means graduated — buy/sell will fail on-chain
- Creator vault PDAs differ: `"creator-vault"` (Pump, hyphen) vs `"creator_vault"` (AMM, underscore)
- `fetchSellState` requires ATA to exist (unlike `fetchBuyState`)
- Fee recipient is selected randomly from `global.feeRecipients[]`
