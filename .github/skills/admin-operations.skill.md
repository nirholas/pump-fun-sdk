# Admin Operations — Protocol Governance & Authority Management

## Skill Description

Understand and implement admin-only protocol operations including creator overrides, token incentive configuration, IDL authority management, and cross-program admin coordination using the Pump and PumpAMM programs' authority system.

## Context

The Pump protocol has several admin-gated operations that require specific authority keypairs stored in the `Global` account. These operations span both the Pump and PumpAMM programs and are coordinated via "BothPrograms" methods on the `OnlinePumpSdk`. Admin operations are critical for protocol governance — they control incentive parameters, creator reassignment, and IDL management.

## Key Files

- [src/onlineSdk.ts](src/onlineSdk.ts) — `OnlinePumpSdk` with admin methods (`adminSetCoinCreatorInstructions`, `adminUpdateTokenIncentives`, etc.)
- [src/sdk.ts](src/sdk.ts) — `PumpSdk` with offline instruction builders, `claimCashbackInstruction`
- [src/state.ts](src/state.ts) — `Global` interface with authority fields
- [src/pda.ts](src/pda.ts) — PDA derivations for admin-related accounts
- [src/idl/pump.ts](src/idl/pump.ts) — Pump IDL with `adminSetCreator`, `adminSetIdlAuthority`, `adminUpdateTokenIncentives`
- [src/idl/pump_amm.ts](src/idl/pump_amm.ts) — PumpAMM IDL with mirrored admin instructions

## Authority Model

The `Global` account stores several authority keys, each governing a specific admin capability:

| Authority Field | Purpose | Used By |
|----------------|---------|---------|
| `authority` | Primary admin — updates global config, token incentives | `adminUpdateTokenIncentives` |
| `adminSetCreatorAuthority` | Reassigns bonding curve creator | `adminSetCreator` |
| `setCreatorAuthority` | Creator self-reassignment authority | Creator operations |
| `feeRecipient` | Receives protocol fees | Fee collection |
| `withdrawAuthority` | Withdraws from vaults | Vault management |
| `reservedFeeRecipient` | Reserved fee recipient | Fee routing |

```typescript
// Global interface — authority fields
interface Global {
  authority: PublicKey;                  // Primary admin
  feeRecipient: PublicKey;              // Protocol fee recipient
  withdrawAuthority: PublicKey;         // Vault withdrawal
  adminSetCreatorAuthority: PublicKey;  // Creator override
  setCreatorAuthority: PublicKey;       // Creator self-set
  reservedFeeRecipient: PublicKey;      // Reserved fees
  mayhemModeEnabled: boolean;           // Global mayhem toggle
  createV2Enabled: boolean;             // V2 creation toggle
  // ... fee parameters, reserves, etc.
}
```

## Admin Operations

### 1. Set Coin Creator

Override the creator address on a bonding curve. Requires `adminSetCreatorAuthority`. Updates both Pump and PumpAMM simultaneously:

```typescript
// OnlinePumpSdk
async adminSetCoinCreatorInstructions(
  newCoinCreator: PublicKey,
  mint: PublicKey,
): Promise<TransactionInstruction[]> {
  const global = await this.fetchGlobal();
  return [
    // Pump program: adminSetCreator
    await this.offlinePumpProgram.methods
      .adminSetCreator(newCoinCreator)
      .accountsPartial({
        adminSetCreatorAuthority: global.adminSetCreatorAuthority,
        mint,
      })
      .instruction(),
    // PumpAMM program: mirrored call
    await this.pumpAmmAdminSdk.adminSetCoinCreator(mint, newCoinCreator),
  ];
}
```

**Use case**: When a creator loses access to their wallet or needs to transfer token ownership, the admin can reassign the creator address — which controls fee collection rights.

### 2. Update Token Incentives

Configure the volume-based PUMP token reward system parameters. Requires `authority`:

```typescript
// OnlinePumpSdk — single program
async adminUpdateTokenIncentives(
  startTime: BN,      // Epoch start timestamp
  endTime: BN,        // Epoch end timestamp
  dayNumber: BN,      // Day index in current epoch
  tokenSupplyPerDay: BN,  // PUMP tokens distributed per day
  secondsInADay: BN = new BN(86_400),
  mint: PublicKey = PUMP_TOKEN_MINT,
  tokenProgram: PublicKey = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionInstruction>

// OnlinePumpSdk — both programs simultaneously
async adminUpdateTokenIncentivesBothPrograms(
  startTime: BN, endTime: BN, dayNumber: BN,
  tokenSupplyPerDay: BN, ...
): Promise<TransactionInstruction[]>
// Returns [pumpIx, pumpAmmIx]
```

**Parameters**:
- `startTime` / `endTime` — Define the reward epoch window
- `dayNumber` — Current day index within the epoch
- `tokenSupplyPerDay` — Daily PUMP token allocation for pro-rata distribution
- `secondsInADay` — Day length (default 86,400, adjustable for testing)
- `mint` — Reward token mint (default: `PUMP_TOKEN_MINT`)

### 3. Set IDL Authority

Transfer IDL account ownership to a new authority. Requires `authority`:

```typescript
// IDL instruction from Pump program
{
  name: "adminSetIdlAuthority",
  accounts: [
    { name: "authority", signer: true, relations: ["global"] },
    { name: "global", pda: { seeds: ["global"] } },
    { name: "idlAccount", writable: true },
    { name: "systemProgram" },
    { name: "programSigner", pda: { seeds: [] } },
  ],
  args: [{ name: "idlAuthority", type: "pubkey" }],
}
```

### 4. Claim Cashback

User-facing (not admin), but part of the Mayhem/cashback subsystem:

```typescript
// PumpSdk
async claimCashbackInstruction({
  user,
}: {
  user: PublicKey;
}): Promise<TransactionInstruction> {
  return await this.offlinePumpProgram.methods
    .claimCashback()
    .accountsPartial({ user })
    .instruction();
}
```

## BothPrograms Pattern

Admin operations that affect both Pump and PumpAMM follow a consistent pattern — the `OnlinePumpSdk` wraps both calls into a single method returning `TransactionInstruction[]`:

```
Method                                          → Pump IX + PumpAMM IX
─────────────────────────────────────────────────────────────────────
adminSetCoinCreatorInstructions()                → adminSetCreator + adminSetCoinCreator
adminUpdateTokenIncentivesBothPrograms()         → adminUpdateTokenIncentives × 2
syncUserVolumeAccumulatorBothPrograms()          → syncUserVolumeAccumulator × 2
claimTokenIncentivesBothPrograms()               → claimTokenIncentives × 2
getCreatorVaultBalanceBothPrograms()             → getCreatorVaultBalance + getCoinCreatorVaultBalance
getTotalUnclaimedTokensBothPrograms()            → getTotalUnclaimedTokens × 2
getCurrentDayTokensBothPrograms()                → getCurrentDayTokens × 2
```

These combined instructions must be submitted in a single transaction for atomicity.

## Mayhem Mode

The Mayhem program (`MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e`) adds a gamification layer:

- **Global toggle**: `Global.mayhemModeEnabled` controls whether mayhem tokens can be created
- **Per-token state**: `BondingCurve.isMayhemMode` indicates if a specific token uses mayhem
- **PDAs**: `getGlobalParamsPda()`, `getMayhemStatePda(mint)`, `getSolVaultPda()`, `getTokenVaultPda(mint)`
- **createV2**: Accepts `mayhemMode: boolean` and `cashback: boolean` parameters
- **Buy instruction**: Propagates `mayhemMode` from the bonding curve state to the buy call

## Patterns to Follow

- Always use `BothPrograms` variants when updating shared state across Pump + PumpAMM
- Fetch `Global` account before admin operations to get current authority addresses
- Admin instructions require the authority to be a signer — include it in the transaction's signers
- Use `BN` for all timestamp and amount parameters — never `number`
- Default `secondsInADay` to `new BN(86_400)` in production; shorter values for testing
- `PUMP_TOKEN_MINT` is the default reward token — override only for testing

## Common Pitfalls

- Using the wrong authority key — each admin operation requires a specific authority from the Global account
- Forgetting to include both Pump and PumpAMM instructions — changes must be synchronized
- Setting `dayNumber` incorrectly — it's a 0-indexed day within the current epoch, not absolute
- `claimCashback` is user-facing despite being in the admin-adjacent code area
- Creator reassignment affects fee collection — the new creator receives all future fees
- `isCreatorUsingSharingConfig()` returns `true` if the creator address has been replaced with the fee sharing config PDA — check this before assuming fees go to a wallet
