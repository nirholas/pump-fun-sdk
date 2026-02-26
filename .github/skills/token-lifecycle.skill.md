# Token Lifecycle — Create, Trade, Graduate, Migrate & Collect

## Skill Description

Manage the full lifecycle of Pump tokens from creation through bonding curve trading, graduation detection, AMM migration, fee collection, and volume tracking — using the offline `PumpSdk` and online `OnlinePumpSdk`.

## Context

Pump tokens follow a defined lifecycle: creation → bonding curve trading → graduation (when market cap reaches threshold) → AMM migration → AMM trading. The SDK provides instruction builders for each phase, with both offline (no RPC) and online (live fetches) variants. Tokens can use either SPL Token (v1, deprecated) or Token-2022 (v2).

## Key Files

- `src/sdk.ts` — `PumpSdk` class with all instruction builders
- `src/onlineSdk.ts` — `OnlinePumpSdk` with RPC fetchers and composed workflows
- `src/bondingCurve.ts` — buy/sell quoting math
- `src/fees.ts` — fee computation
- `src/pda.ts` — Program Derived Addresses for all accounts
- `src/state.ts` — on-chain state type definitions
- `src/errors.ts` — error classes for validation failures

## Lifecycle Phases

### Phase 1: Token Creation

```typescript
// V2 creation with Token-2022 (preferred)
const ix = await PUMP_SDK.createV2Instruction({
    mint,           // PublicKey — new token mint address
    name,           // string — token name
    symbol,         // string — token ticker symbol
    uri,            // string — metadata URI (IPFS/Arweave)
    creator,        // PublicKey — token creator
    user,           // PublicKey — transaction signer
});

// Create and immediately buy in same transaction
const ixs = await PUMP_SDK.createV2AndBuyInstructions({
    global, feeConfig, mint, name, symbol, uri,
    creator, user, solAmount, amount, slippage
});
```

**Key points:**
- `createInstruction` (v1) is **deprecated** — use `createV2Instruction` (Token-2022)
- `createV2AndBuyInstructions` bundles creation + first purchase atomically
- Token-2022 enables advanced token features (transfer hooks, confidential transfers, etc.)
- The bonding curve account is created with initial virtual reserves from Global config
- Mayhem mode tokens use additional Mayhem program PDAs

### Phase 2: Bonding Curve Trading

**Buying tokens:**
```typescript
// Fetch required state (batched RPC call)
const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
    await onlineSdk.fetchBuyState(mint, user);

// Compute token amount from SOL
const amount = getBuyTokenAmountFromSolAmount({
    global, feeConfig, mintSupply, bondingCurve,
    amount: solAmount
});

// Build buy instructions
const ixs = await PUMP_SDK.buyInstructions({
    global, bondingCurveAccountInfo, bondingCurve,
    associatedUserAccountInfo, mint, user,
    solAmount, amount, slippage: 1  // 0.1% slippage
});
```

**Selling tokens:**
```typescript
const { bondingCurveAccountInfo, bondingCurve } =
    await onlineSdk.fetchSellState(mint, user);

const solAmount = getSellSolAmountFromTokenAmount({
    global, feeConfig, mintSupply, bondingCurve, amount
});

const ixs = await PUMP_SDK.sellInstructions({
    global, bondingCurveAccountInfo, bondingCurve,
    mint, user, amount, solAmount, slippage: 1
});
```

**What `buyInstructions` does internally:**
1. Optionally extends bonding curve account to `BONDING_CURVE_NEW_SIZE` (151 bytes)
2. Creates user's ATA (idempotent — no-op if exists)
3. Builds the buy instruction with slippage-adjusted `maxSolCost`
4. Passes `{ 0: true }` flags argument (intentional)

**What `sellInstructions` does internally:**
1. Optionally extends bonding curve account
2. Builds sell instruction with slippage-adjusted `minSolOutput`
3. Adds user volume accumulator PDA as a remaining account (for cashback tracking)

### Phase 3: Graduation Detection

```typescript
const bondingCurve = await onlineSdk.fetchBondingCurve(mint);

if (bondingCurve.complete) {
    // Token has graduated — bonding curve trading will fail
    // Must migrate to AMM before further trading
    console.log("Token graduated! Ready for migration.");
}
```

Graduation happens automatically on-chain when the bonding curve reaches the configured market cap threshold defined in the `Global` account.

### Phase 4: AMM Migration

```typescript
// Extend account if needed
const extendIx = await PUMP_SDK.extendAccountInstruction({
    bondingCurvePda: bondingCurvePda(mint),
    bondingCurveAccountInfo
});

// Migrate bonding curve liquidity to PumpAMM pool
const migrateIx = await PUMP_SDK.migrateInstruction({ mint, creator });

// Send both instructions in sequence
const instructions = [...extendIx, migrateIx];
```

**Key points:**
- Only callable after graduation (`complete === true`)
- Migrates remaining liquidity from bonding curve to a PumpAMM pool
- The canonical pool PDA is derived via `canonicalPumpPoolPda(mint)`
- Account may need extension to BONDING_CURVE_NEW_SIZE first

### Phase 5: Post-Migration (AMM Trading)

After migration, trading happens through the PumpAMM program. The SDK's "BothPrograms" methods handle this transparently:

```typescript
// Creator vault balance across both programs
const balance = await onlineSdk.getCreatorVaultBalanceBothPrograms(creator);

// Volume tracking across both programs
const stats = await onlineSdk.fetchUserVolumeAccumulatorTotalStats(user);
```

### Phase 6: Creator Fee Collection

```typescript
// Collect fees from both Pump and PumpAMM vaults
const ixs = await onlineSdk.collectCoinCreatorFeeInstructions(creator);

// Check total balance before collecting
const balance = await onlineSdk.getCreatorVaultBalanceBothPrograms(creator);
```

### Set Creator (Admin)

```typescript
// Set the creator on an existing bonding curve
const ix = await PUMP_SDK.setCreator({ mint, creator, user });

// Admin: change creator on both programs
const ixs = await onlineSdk.adminSetCoinCreatorInstructions(newCreator, mint);
```

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PUMP_PROGRAM_ID` | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve program |
| `PUMP_AMM_PROGRAM_ID` | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | AMM pool program |
| `PUMP_FEE_PROGRAM_ID` | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing program |
| `MAYHEM_PROGRAM_ID` | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` | Mayhem mode program |
| `BONDING_CURVE_NEW_SIZE` | `151` | Extended account size |
| `MAX_SHAREHOLDERS` | `10` | Max fee sharing participants |

## Key PDAs

| PDA | Derivation | Usage |
|-----|-----------|-------|
| `GLOBAL_PDA` | `["global"]` on Pump | Global config singleton |
| `bondingCurvePda(mint)` | `["bonding-curve", mint]` | Per-token bonding curve |
| `creatorVaultPda(creator)` | `["creator-vault", creator]` | Creator fee vault (Pump) |
| `ammCreatorVaultPda(creator)` | `["creator_vault", creator]` | Creator fee vault (AMM) |
| `canonicalPumpPoolPda(mint)` | Via pump-swap-sdk | AMM pool for graduated token |
| `feeSharingConfigPda(mint)` | `["sharing-config", mint]` | Fee sharing config |
| `userVolumeAccumulatorPda(user)` | `["user_volume_accumulator", user]` | Volume tracking |

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
                                    │
                                    ▼
                              GRADUATED (AMM Pool)
                                    │
                              AMM trading
                                    │
                              fee collection
```

## Patterns to Follow

- Return `TransactionInstruction[]`, never `Transaction` objects — callers compose transactions
- Use `getMultipleAccountsInfo` to batch RPC calls (2–3 accounts per call)
- Support both Token (SPL) and Token-2022 via `tokenProgram` parameter
- All RPC calls belong in `OnlinePumpSdk`, not `PumpSdk`
- `PUMP_SDK` is a pre-initialized offline singleton — use it for pure instruction building
- Use `fetchBuyState` / `fetchSellState` to efficiently get all required accounts
- Check `bondingCurve.complete` before any bonding curve operation
- Always extend account before migration if needed

## Common Pitfalls

- Circular dependency between `sdk.ts` and `onlineSdk.ts` — `sdk.ts` imports `OFFLINE_PUMP_PROGRAM` from `onlineSdk.ts`
- `BONDING_CURVE_NEW_SIZE = 151` — accounts may need `extendAccountInstruction` before migration or setCreator
- `BondingCurve.complete === true` means graduated — bonding curve buy/sell will fail on-chain
- Buy instruction deliberately passes `{ 0: true }` flags — this is not a bug
- `createInstruction` (v1) is deprecated — always use `createV2Instruction`
- Creator vault PDAs differ between programs: `"creator-vault"` (Pump, hyphen) vs `"creator_vault"` (AMM, underscore)
- `fetchSellState` requires ATA to exist (unlike `fetchBuyState` which handles creation)
- Fee recipient is selected randomly from `global.feeRecipients[]` — non-deterministic
