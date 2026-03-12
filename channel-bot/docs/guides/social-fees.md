# Social Fee Sharing

Assign fee shares to social identities (e.g., GitHub usernames) without requiring their wallet address upfront.

> **Program:** PumpFees (`pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`)

---

## Overview

Social fee sharing lets token creators assign revenue shares to people by their **GitHub username** instead of a Solana wallet address. The protocol creates a PDA (Program Derived Address) for each social identity, and fees accumulate there until the user claims them.

**Currently supported platforms:** GitHub only (enum value `2`).

```
Platform enum:
  Pump   = 0  (reserved)
  X      = 1  (reserved)
  GitHub = 2  ✅ supported
```

---

## How It Works

```
1. Creator assigns 30% share to GitHub user "alice123"
   └── SDK resolves to SocialFeePda(userId="12345", platform=2)

2. Fees accumulate in the PDA account on-chain

3. Alice claims fees later by proving GitHub identity
   └── socialClaimAuthority signs the claim transaction
   └── Funds transfer to Alice's recipient wallet
```

### PDA Derivation

```typescript
import { socialFeePda } from "@nirholas/pump-sdk";

// userId must be the numeric GitHub user ID from:
// https://api.github.com/users/<username>  →  response.id
const pda = socialFeePda("12345", Platform.GitHub);
```

Seeds: `["social-fee-pda", userId, [platform]]` under the PumpFees program.

---

## SDK Methods

### Create a Social Fee PDA

Initializes the on-chain account for a social identity. Must be called before fees can be routed there.

```typescript
import { PUMP_SDK } from "@nirholas/pump-sdk";

const ix = await PUMP_SDK.createSocialFeePdaInstruction({
  payer: walletPublicKey,        // Pays for account creation
  userId: "12345",               // GitHub numeric user ID
  platform: Platform.GitHub,     // Only GitHub supported
});
```

### Claim Social Fees

The social identity owner (verified by `socialClaimAuthority`) claims accumulated fees.

```typescript
const ix = await PUMP_SDK.claimSocialFeePdaInstruction({
  recipient: recipientWallet,           // Where funds go
  socialClaimAuthority: authorityKey,   // Signs to prove identity
  userId: "12345",
  platform: Platform.GitHub,
});
```

### Update Fee Shares with Social Recipients

High-level wrapper that resolves social handles to PDAs and creates any missing PDA accounts.

```typescript
const ixs = await PUMP_SDK.updateSharingConfigWithSocialRecipients({
  authority: creatorWallet,
  mint: tokenMint,
  currentShareholders: existingShareholders,
  newShareholders: [
    { address: walletA, shareBps: 5000 },           // 50% to wallet
    { userId: "12345", platform: Platform.GitHub, shareBps: 3000 },  // 30% to GitHub user
    { userId: "67890", platform: Platform.GitHub, shareBps: 2000 },  // 20% to GitHub user
  ],
});
// Returns array of instructions: createSocialFeePda (if needed) + updateFeeShares
```

### Normalize Social Shareholders

Low-level utility that resolves social handles without creating instructions.

```typescript
const { normalizedShareholders, socialRecipientsToCreate } =
  PUMP_SDK.normalizeSocialShareholders({
    newShareholders: [
      { address: walletA, shareBps: 7000 },
      { userId: "12345", platform: Platform.GitHub, shareBps: 3000 },
    ],
  });

// normalizedShareholders: all have .address (PDAs resolved)
// socialRecipientsToCreate: Map of PDA base58 → { userId, platform }
```

---

## On-Chain Account

```typescript
interface SocialFeePda {
  userId: string;         // GitHub numeric user ID
  platform: number;       // Platform enum value
  claimable: BN;          // Unclaimed fees (lamports)
  lifetimeClaimed: BN;    // Total ever claimed (lamports)
  bump: number;           // PDA bump seed
}
```

### Fetching Account State

```typescript
import { OnlinePumpSdk } from "@nirholas/pump-sdk";

const sdk = new OnlinePumpSdk(connection);
const account = await sdk.fetchSocialFeePda("12345", Platform.GitHub);
console.log(`Claimable: ${account.claimable.toString()} lamports`);
```

---

## Events

### SocialFeePdaCreatedEvent

Emitted when a new social fee PDA is initialized.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `userId` | `string` | GitHub numeric user ID |
| `platform` | `number` | Platform enum |
| `socialFeePda` | `PublicKey` | Created PDA address |
| `createdBy` | `PublicKey` | Payer who created it |

### SocialFeePdaClaimedEvent

Emitted when fees are claimed from a social fee PDA.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `userId` | `string` | GitHub numeric user ID |
| `platform` | `number` | Platform enum |
| `socialFeePda` | `PublicKey` | PDA address |
| `recipient` | `PublicKey` | Wallet receiving funds |
| `socialClaimAuthority` | `PublicKey` | Authority that signed |
| `amountClaimed` | `BN` | Lamports claimed this tx |
| `claimableBefore` | `BN` | Balance before claim |
| `lifetimeClaimed` | `BN` | Cumulative total claimed |
| `recipientBalanceBefore` | `BN` | Recipient SOL before |
| `recipientBalanceAfter` | `BN` | Recipient SOL after |

---

## Important Notes

- The `userId` **must** be the numeric GitHub user ID (from `https://api.github.com/users/<username>` → `response.id`), not the username string.
- Shares must total exactly **10,000 BPS** (100%) across all shareholders.
- Maximum 8 shareholders per sharing config.
- Social fee PDAs must be created before they can receive fees.

---

## Related

- [Fee Sharing](./fee-sharing.md) — General fee sharing system
- [Fee Tiers](./fee-tiers.md) — Fee tier structure
- [Tutorial 27](../tutorials/27-social-fee-sharing.md) — Step-by-step guide
