# Tutorial 35: Admin & Protocol Management

> Toggle protocol modes, manage authorities, update fee configurations, and distribute creator fees across all Pump programs.

## Prerequisites

- Node.js 18+
- `@pump-fun/pump-sdk` installed
- Admin/authority keypair for the operations you need

```bash
npm install @pump-fun/pump-sdk @solana/web3.js bn.js
```

## Who Needs This

Most admin operations require the **global authority** keypair. These are for:
- Protocol operators managing Pump program state
- Token creators managing their creator fees and metadata
- Fee sharing authorities updating shareholder configurations

```
┌───────────────────────────────────────────┐
│           Admin Operations                │
├──────────────┬──────────────┬─────────────┤
│  Protocol    │  Creator     │  Fee        │
│  Toggles     │  Management  │  Sharing    │
│              │              │             │
│ mayhemMode   │ setCreator   │ createConfig│
│ cashback     │ adminSet     │ updateShares│
│ createV2     │ migrate      │ distribute  │
│ authority    │ metaplex     │ socialFees  │
└──────────────┴──────────────┴─────────────┘
```

## Step 1: Protocol Toggles

Toggle global protocol features on/off:

```typescript
import { PUMP_SDK } from "@pump-fun/pump-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";

const authority = Keypair.generate(); // Must be current global authority

// Toggle Mayhem Mode (Token-2022 minting)
const mayhemIxs = PUMP_SDK.toggleMayhemModeInstruction({
  authority: authority.publicKey,
});

// Toggle cashback on token creation
const cashbackIxs = PUMP_SDK.toggleCashbackEnabledInstruction({
  authority: authority.publicKey,
});

// Toggle createV2 instruction availability
const createV2Ixs = PUMP_SDK.toggleCreateV2Instruction({
  authority: authority.publicKey,
});

// Update the global authority to a new keypair
const newAuthority = Keypair.generate();
const updateAuthIxs = PUMP_SDK.updateGlobalAuthorityInstruction({
  authority: authority.publicKey,
  newAuthority: newAuthority.publicKey,
});
```

## Step 2: Reserved Fee Recipients

Set protocol-level reserved fee recipients:

```typescript
const setReservedIxs = PUMP_SDK.setReservedFeeRecipientsInstruction({
  authority: authority.publicKey,
  recipients: [
    {
      address: new PublicKey("Treasury111..."),
      shareBps: 5000, // 50%
    },
    {
      address: new PublicKey("Dev222..."),
      shareBps: 5000, // 50%
    },
  ],
});
```

## Step 3: Creator Management

Manage who is designated as a token's creator:

```typescript
const creator = Keypair.generate();
const mint = new PublicKey("TokenMint...");

// Set creator (called by the creator themselves)
const setCreatorIxs = PUMP_SDK.setCreator({
  creator: creator.publicKey,
  mint,
});

// Admin override — set creator on behalf
const adminSetIxs = PUMP_SDK.adminSetCreator({
  authority: authority.publicKey,
  mint,
  newCreator: creator.publicKey,
});

// Migrate bonding curve creator to a new address
const migrateCreatorIxs = PUMP_SDK.migrateBondingCurveCreatorInstruction({
  authority: authority.publicKey,
  mint,
  newCreator: newCreatorAddress,
});

// Set Metaplex metadata creator
const metaplexIxs = PUMP_SDK.setMetaplexCreatorInstruction({
  creator: creator.publicKey,
  mint,
});
```

## Step 4: Fee Sharing Configuration

Create and update fee sharing configs for tokens:

```typescript
// Create initial fee sharing config
const createConfigIxs = await PUMP_SDK.createFeeSharingConfig({
  creator: creator.publicKey,
  mint,
  pool: poolAddress, // Required for graduated tokens, null otherwise
});

// Update fee shares
const updateSharesIxs = await PUMP_SDK.updateFeeShares({
  authority: creator.publicKey,
  mint,
  currentShareholders: [
    { address: creator.publicKey, shareBps: 10000 },
  ],
  newShareholders: [
    { address: creator.publicKey, shareBps: 7000 },
    { address: new PublicKey("Partner..."), shareBps: 3000 },
  ],
});

// Update with social recipients (platform integrations)
const socialUpdateIxs = await PUMP_SDK.updateSharingConfigWithSocialRecipients({
  authority: creator.publicKey,
  mint,
  shareholders: [
    { address: creator.publicKey, shareBps: 6000 },
    { address: new PublicKey("Partner..."), shareBps: 4000 },
  ],
  socialPlatformId: 0, // Platform ID (0-3)
});
```

## Step 5: Social Fee PDAs

Create and claim from social fee accounts:

```typescript
// Create a social fee PDA for a platform
const createSocialIxs = PUMP_SDK.createSocialFeePdaInstruction({
  payer: creator.publicKey,
  socialPlatformId: 0,
  socialHandle: "myproject",
});

// Claim accumulated fees from a social fee PDA
const claimSocialIxs = PUMP_SDK.claimSocialFeePdaInstruction({
  claimer: creator.publicKey,
  socialPlatformId: 0,
  socialHandle: "myproject",
});
```

## Step 6: Distribute Creator Fees

Trigger distribution of accumulated creator fees:

```typescript
// Distribute fees for a single token
const distributeIxs = await PUMP_SDK.distributeCreatorFees({
  mint,
  payer: creator.publicKey,
});
```

## Step 7: Token Incentives

Admin-managed volume-based token incentives:

```typescript
// Update token incentives for Pump program
const incentivesIxs = PUMP_SDK.adminUpdateTokenIncentives({
  authority: authority.publicKey,
  mint,
  incentiveParams: {
    enabled: true,
    rewardBps: 100, // 1% reward
  },
});

// Update across both programs (Pump + PumpAMM)
const bothIxs = PUMP_SDK.adminUpdateTokenIncentivesBothPrograms({
  authority: authority.publicKey,
  mint,
  incentiveParams: {
    enabled: true,
    rewardBps: 100,
  },
});
```

## Step 8: Multi-Operation Admin Script

Combine admin operations into a single transaction:

```typescript
import {
  Connection,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

async function adminBatchUpdate(
  connection: Connection,
  authority: Keypair,
  mint: PublicKey
) {
  const instructions = [];

  // 1. Enable cashback
  instructions.push(
    ...PUMP_SDK.toggleCashbackEnabledInstruction({
      authority: authority.publicKey,
    })
  );

  // 2. Set reserved recipients
  instructions.push(
    ...PUMP_SDK.setReservedFeeRecipientsInstruction({
      authority: authority.publicKey,
      recipients: [
        { address: authority.publicKey, shareBps: 10000 },
      ],
    })
  );

  // Build and send as one tx
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: authority.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([authority]);

  const sig = await connection.sendTransaction(tx);
  console.log("Admin batch update:", sig);
  return sig;
}
```

## Operation Reference

| Operation | Authority | Program |
|-----------|-----------|---------|
| `toggleMayhemMode` | Global authority | Pump |
| `toggleCashbackEnabled` | Global authority | Pump |
| `toggleCreateV2` | Global authority | Pump |
| `updateGlobalAuthority` | Global authority | Pump |
| `setReservedFeeRecipients` | Global authority | PumpFees |
| `setCreator` | Token creator | Pump |
| `adminSetCreator` | Global authority | Pump |
| `migrateBondingCurveCreator` | Global authority | Pump |
| `setMetaplexCreator` | Token creator | Pump |
| `createFeeSharingConfig` | Token creator | PumpFees |
| `updateFeeShares` | Fee authority | PumpFees |
| `distributeCreatorFees` | Any (permissionless) | PumpFees |
| `createSocialFeePda` | Any payer | PumpFees |
| `claimSocialFeePda` | Linked claimer | PumpFees |
| `adminUpdateTokenIncentives` | Global authority | Pump |

## Next Steps

- See [Tutorial 07](./07-fee-sharing.md) for fee sharing fundamentals
- See [Tutorial 33](./33-error-handling-patterns.md) for validation errors
- See [Tutorial 27](./27-cashback-social-fees.md) for cashback & social fee details
