# Tutorial 27: Cashback & Social Fee PDAs

> Enable cashback rewards on trades and manage social fee PDAs for off-chain identity-linked fee collection.

> **Breaking change — 2026-04-28:** Cashback sells (the ones that include `userVolumeAccumulator`) are also subject to the new trailing fee-recipient requirement. The cashback sell now requires 17 accounts (up from 16). Upgrade to `@nirholas/pump-sdk@^1.32.0` — handled automatically. See **[Tutorial 45: Breaking Fee Recipient Upgrade](./45-breaking-fee-recipient-upgrade.md)**.

## Prerequisites

- Node.js 18+
- `@nirholas/pump-sdk` installed
- Understanding of [Tutorial 01](./01-create-token.md) and [Tutorial 09](./09-fee-system.md)

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
```

## Part 1: Cashback System

Cashback is a reward mechanism where traders receive a portion of fees back when buying or selling tokens that have cashback enabled.

### How Cashback Works

```
Trader buys tokens
       │
       ▼
┌──────────────┐
│  Trade Fee   │ ──► Platform fee (normal)
│  Calculated  │ ──► Creator fee (normal)
│              │ ──► Cashback (returned to trader)
└──────────────┘
       │
       ▼
cashbackFeeBasisPoints applied
```

### Step 1: Create a Token with Cashback

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { PUMP_SDK, OnlinePumpSdk } from "@nirholas/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);
const creator = Keypair.generate();
const mint = Keypair.generate();

// Enable cashback at token creation
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "Cashback Token",
  symbol: "CASH",
  uri: "https://example.com/metadata.json",
  creator: creator.publicKey,
  user: creator.publicKey,
  mayhemMode: false,
  cashback: true, // <-- Enables cashback
});
```

### Step 2: Initialize a Volume Accumulator

To receive cashback, traders need a volume accumulator account:

```typescript
import { PUMP_SDK } from "@nirholas/pump-sdk";

const trader = Keypair.generate();

// Initialize the volume accumulator (one-time per trader)
const initIx = await PUMP_SDK.initUserVolumeAccumulator({
  payer: trader.publicKey,
  user: trader.publicKey,
});
```

### Step 3: Trade with Cashback

When selling a cashback-enabled token, pass `cashback: true`:

```typescript
import BN from "bn.js";

// Buy tokens (cashback is automatic during buy)
const buyIxs = await onlineSdk.buyInstructions({
  mint: mint.publicKey,
  user: trader.publicKey,
  solAmount: new BN(100_000_000), // 0.1 SOL
  slippageBps: 500,
});

// Sell tokens with cashback enabled
const sellIxs = await onlineSdk.sellInstructions({
  mint: mint.publicKey,
  user: trader.publicKey,
  tokenAmount: new BN("1000000"),
  slippageBps: 500,
  cashback: true, // Includes userVolumeAccumulator in remaining accounts
});
```

### Step 4: Check Cashback in Trade Events

After a trade, the `TradeEvent` includes cashback information:

```typescript
interface TradeEvent {
  // ... other fields
  cashbackFeeBasisPoints: BN; // The cashback rate applied
  cashback: BN;               // Cashback amount in lamports
}

// Parse trade event from transaction logs
function parseCashbackFromEvent(event: TradeEvent) {
  const cashbackBps = event.cashbackFeeBasisPoints.toNumber();
  const cashbackAmount = event.cashback.toNumber();

  console.log(`Cashback rate: ${cashbackBps / 100}%`);
  console.log(`Cashback amount: ${cashbackAmount / 1e9} SOL`);
}
```

### Step 5: Check if a Token Has Cashback

```typescript
async function isCashbackToken(mint: PublicKey): Promise<boolean> {
  const bc = await onlineSdk.fetchBondingCurve(mint);
  return bc.isCashbackCoin;
}

// Check global cashback status
async function isCashbackEnabled(): Promise<boolean> {
  const global = await onlineSdk.fetchGlobal();
  return global.isCashbackEnabled;
}
```

### Step 6: Claim Cashback

Claim accumulated cashback SOL from both programs. Cashback uses dedicated `claimCashbackInstruction` / `ammClaimCashbackInstruction` — these are separate from volume-based token incentives (`claimTokenIncentives`):

```typescript
import { TransactionMessage, VersionedTransaction } from "@solana/web3.js";

// Claim cashback from Pump bonding curve trades
const pumpCashbackIx = await PUMP_SDK.claimCashbackInstruction({
  user: trader.publicKey,
});

// Claim cashback from AMM trades
const ammCashbackIx = await PUMP_SDK.ammClaimCashbackInstruction({
  user: trader.publicKey,
});

const { blockhash } = await connection.getLatestBlockhash("confirmed");
const message = new TransactionMessage({
  payerKey: trader.publicKey,
  recentBlockhash: blockhash,
  instructions: [pumpCashbackIx, ammCashbackIx],
}).compileToV0Message();

const tx = new VersionedTransaction(message);
tx.sign([trader]);
await connection.sendTransaction(tx);
console.log("Cashback claimed!");
```

---

## Part 2: Social Fee PDAs

Social Fee PDAs link **off-chain identities** (like Twitter handles or Telegram usernames) to on-chain fee collection accounts. This lets creators share fees with social media collaborators who may not have Solana wallets yet.

### How Social Fees Work

```
Creator sets up fee sharing
       │
       ▼
Social Fee PDA created for "@twitter_user" on platform 1
       │
       ▼
Fees accumulate in the PDA
       │
       ▼
User with matching identity claims fees
```

### Step 7: Derive a Social Fee PDA

```typescript
import { socialFeePda, Platform, SUPPORTED_SOCIAL_PLATFORMS } from "@nirholas/pump-sdk";

// Platform enum (from src/state.ts):
// Platform.Pump   = 0
// Platform.X      = 1
// Platform.GitHub  = 2
//
// Currently only Platform.GitHub is in SUPPORTED_SOCIAL_PLATFORMS.
// Check SUPPORTED_SOCIAL_PLATFORMS for the latest supported list.

const githubUserId = "12345678"; // GitHub numeric user ID (from api.github.com/users/<username>)
const platform = Platform.GitHub;

const pda = socialFeePda(githubUserId, platform);
console.log("Social Fee PDA:", pda.toBase58());
// Seeds: ["social-fee-pda", Buffer.from("12345678"), Buffer.from([2])]
```

### Step 8: Fetch Social Fee PDA State

```typescript
interface SocialFeePda {
  bump: number;
  version: number;
  userId: string;
  platform: number;
  totalClaimed: BN;
  lastClaimed: BN;
}

const state = await onlineSdk.fetchSocialFeePda(githubUserId, platform);

console.log("User ID:", state.userId);
console.log("Platform:", state.platform);
console.log("Total claimed:", state.totalClaimed.toString(), "lamports");
console.log(
  "Last claimed:",
  new Date(state.lastClaimed.toNumber() * 1000).toISOString()
);
```

### Step 9: Decode Social Fee Events

Two events signal social fee PDA activity. Use the SDK decoders on raw transaction log data:

```typescript
import {
  PUMP_SDK,
  SocialFeePdaCreatedEvent,
  SocialFeePdaClaimedEvent,
} from "@nirholas/pump-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

// Fetch and parse events from a confirmed transaction
async function parseSocialFeeEvents(connection: Connection, signature: string) {
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx?.meta?.logMessages) return;

  for (const log of tx.meta.logMessages) {
    // SocialFeePdaCreatedEvent — fires when a new PDA is initialized
    if (log.includes("SocialFeePdaCreatedEvent")) {
      const data = Buffer.from(log.split("Program data: ")[1] ?? "", "base64");
      const event: SocialFeePdaCreatedEvent =
        PUMP_SDK.decodeSocialFeePdaCreatedEvent(data);
      // Full event shape:
      // {
      //   timestamp: BN,
      //   userId: string,
      //   platform: number,        // Platform enum value
      //   socialFeePda: PublicKey, // The PDA address
      //   createdBy: PublicKey,    // Who paid for creation
      // }
      console.log(
        `PDA created for userId=${event.userId} on platform=${event.platform}`
      );
      console.log(`PDA address: ${event.socialFeePda.toBase58()}`);
    }

    // SocialFeePdaClaimedEvent — fires when accumulated fees are withdrawn
    if (log.includes("SocialFeePdaClaimedEvent")) {
      const data = Buffer.from(log.split("Program data: ")[1] ?? "", "base64");
      const event: SocialFeePdaClaimedEvent =
        PUMP_SDK.decodeSocialFeePdaClaimedEvent(data);
      // Full event shape:
      // {
      //   timestamp: BN,
      //   userId: string,
      //   platform: number,
      //   socialFeePda: PublicKey,
      //   recipient: PublicKey,            // Where SOL was sent
      //   socialClaimAuthority: PublicKey, // Authority that approved claim
      //   amountClaimed: BN,              // SOL claimed this time (lamports)
      //   claimableBefore: BN,            // Balance before claim (lamports)
      //   lifetimeClaimed: BN,            // All-time claimed (lamports)
      //   recipientBalanceBefore: BN,
      //   recipientBalanceAfter: BN,
      // }
      console.log(
        `Claimed ${event.amountClaimed.toNumber() / 1e9} SOL for userId=${event.userId}`
      );
      console.log(
        `Lifetime claimed: ${event.lifetimeClaimed.toNumber() / 1e9} SOL`
      );
    }
  }
}
```

### Step 10: Build a Social Fee Dashboard

Combine social fee tracking with a simple monitoring interface:

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk, socialFeePda } from "@nirholas/pump-sdk";

interface SocialFeeTracker {
  userId: string;
  platform: number;
  platformName: string;
  pdaAddress: string;
  totalClaimed: string;
  lastClaimed: string;
}

const PLATFORM_NAMES: Record<number, string> = {
  0: "Pump",
  1: "X (Twitter)",
  2: "GitHub",
};

async function trackSocialFees(
  onlineSdk: OnlinePumpSdk,
  accounts: Array<{ userId: string; platform: number }>
): Promise<SocialFeeTracker[]> {
  const results: SocialFeeTracker[] = [];

  for (const { userId, platform } of accounts) {
    try {
      const pda = socialFeePda(userId, platform);
      const state = await onlineSdk.fetchSocialFeePda(userId, platform);

      results.push({
        userId,
        platform,
        platformName: PLATFORM_NAMES[platform] ?? "Unknown",
        pdaAddress: pda.toBase58(),
        totalClaimed: `${state.totalClaimed.toNumber() / 1e9} SOL`,
        lastClaimed: state.lastClaimed.isZero()
          ? "Never"
          : new Date(state.lastClaimed.toNumber() * 1000).toISOString(),
      });
    } catch {
      results.push({
        userId,
        platform,
        platformName: PLATFORM_NAMES[platform] ?? "Unknown",
        pdaAddress: socialFeePda(userId, platform).toBase58(),
        totalClaimed: "N/A (not initialized)",
        lastClaimed: "N/A",
      });
    }
  }

  return results;
}

// Track multiple social accounts
const tracked = await trackSocialFees(onlineSdk, [
  { userId: "12345678", platform: Platform.GitHub },    // GitHub user
]);

console.table(tracked);
```

### Step 10b: Create and Claim Social Fee PDAs

To create a social fee PDA on-chain and claim accumulated fees:

```typescript
import { PUMP_SDK, Platform } from "@nirholas/pump-sdk";

// Create the PDA (anyone can pay)
const createPdaIx = await PUMP_SDK.createSocialFeePdaInstruction({
  payer: wallet.publicKey,
  userId: "12345678",          // GitHub user ID
  platform: Platform.GitHub,
});

// Claim accumulated fees (requires socialClaimAuthority signer)
const claimPdaIx = await PUMP_SDK.claimSocialFeePdaInstruction({
  recipient: wallet.publicKey,
  socialClaimAuthority: authorityKeypair.publicKey,
  userId: "12345678",
  platform: Platform.GitHub,
});
```

> **Note:** Only `Platform.GitHub` is currently supported. Check `SUPPORTED_SOCIAL_PLATFORMS` for the latest list. The `userId` must be the numeric GitHub user ID from `https://api.github.com/users/<username>`.

---

## Part 3: Volume Accumulator Lifecycle

The `UserVolumeAccumulator` account tracks per-user trading volume for cashback eligibility. Beyond the one-time `initUserVolumeAccumulator`, you may need to sync, inspect, or close the account.

### Read Accumulator State

```typescript
import { userVolumeAccumulatorPda, ammUserVolumeAccumulatorPda } from "@nirholas/pump-sdk";

// Derive the PDA addresses
const pumpAccumulatorPda = userVolumeAccumulatorPda(trader.publicKey);
const ammAccumulatorPda = ammUserVolumeAccumulatorPda(trader.publicKey);

// Fetch raw account data and decode
const accountInfo = await connection.getAccountInfo(pumpAccumulatorPda);
if (accountInfo) {
  const accumulator = PUMP_SDK.decodeUserVolumeAccumulator(accountInfo.data);
  // {
  //   user: PublicKey,
  //   needsClaim: boolean,        // true = pending token incentives
  //   totalUnclaimedTokens: BN,  // earned but not yet claimed
  //   totalClaimedTokens: BN,
  //   currentSolVolume: BN,      // volume in current period (lamports)
  //   lastUpdateTimestamp: BN,
  // }
  console.log("Unclaimed tokens:", accumulator.totalUnclaimedTokens.toString());
  console.log("Current SOL volume:", accumulator.currentSolVolume.toNumber() / 1e9, "SOL");
  console.log("Needs claim:", accumulator.needsClaim);
}
```

### Sync the Accumulator

Call `syncUserVolumeAccumulator` when the account is out of sync with on-chain state (e.g. after a period rollover). The AMM variant does the same for graduated pool trades:

```typescript
// Sync bonding curve accumulator
const syncIx = PUMP_SDK.syncUserVolumeAccumulator({
  user: trader.publicKey,
});

// Sync AMM accumulator (for post-graduation trades)
const ammSyncIx = PUMP_SDK.ammSyncUserVolumeAccumulatorInstruction({
  user: trader.publicKey,
});

const { blockhash } = await connection.getLatestBlockhash("confirmed");
const message = new TransactionMessage({
  payerKey: trader.publicKey,
  recentBlockhash: blockhash,
  instructions: [syncIx, ammSyncIx],
}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([trader]);
await connection.sendTransaction(tx);
```

### Close the Accumulator

When a trader is done, close the account to reclaim rent:

```typescript
// Claim any remaining cashback first, then close
const claimIx = PUMP_SDK.claimCashbackInstruction({ user: trader.publicKey });
const closeIx = PUMP_SDK.closeUserVolumeAccumulator({ user: trader.publicKey });

const message = new TransactionMessage({
  payerKey: trader.publicKey,
  recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
  instructions: [claimIx, closeIx],
}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([trader]);
await connection.sendTransaction(tx);
console.log("Accumulator closed, rent reclaimed.");
```

### Decode the ClaimCashbackEvent

```typescript
import { PUMP_SDK, ClaimCashbackEvent } from "@nirholas/pump-sdk";

async function parseCashbackClaim(connection: Connection, signature: string) {
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx?.meta?.logMessages) return;

  for (const log of tx.meta.logMessages) {
    if (log.includes("ClaimCashbackEvent")) {
      const data = Buffer.from(log.split("Program data: ")[1] ?? "", "base64");
      const event: ClaimCashbackEvent = PUMP_SDK.decodeClaimCashbackEvent(data);
      // {
      //   user: PublicKey,
      //   amount: BN,               // SOL claimed this transaction (lamports)
      //   timestamp: BN,
      //   totalClaimed: BN,         // All-time claimed SOL (lamports)
      //   totalCashbackEarned: BN,  // All-time earned (may exceed claimed)
      // }
      console.log(`User: ${event.user.toBase58()}`);
      console.log(`Claimed: ${event.amount.toNumber() / 1e9} SOL`);
      console.log(`All-time claimed: ${event.totalClaimed.toNumber() / 1e9} SOL`);
    }
  }
}
```

---

## Part 4: Social Fee Sharing — The Full Picture

The SDK provides high-level helpers that let you mix wallet addresses and social identities (GitHub user IDs) as fee shareholders. The SDK resolves social IDs to their PDA addresses and creates missing PDAs automatically.

### `normalizeSocialShareholders` — Resolve Mixed Recipients

Use this when you need to preview or manually build the instructions:

```typescript
import {
  PUMP_SDK,
  Platform,
  socialFeePda,
} from "@nirholas/pump-sdk";

// newShareholders accepts either address or (userId + platform)
const { normalizedShareholders, socialRecipientsToCreate } =
  PUMP_SDK.normalizeSocialShareholders({
    newShareholders: [
      // Wallet address — passed through as-is
      { address: creator.publicKey, shareBps: 5000 },
      // GitHub identity — resolved to its social fee PDA
      { userId: "12345678", platform: Platform.GitHub, shareBps: 3000 },
      { userId: "87654321", platform: Platform.GitHub, shareBps: 2000 },
    ],
  });

// normalizedShareholders: Shareholder[] ready for updateFeeShares
// All share BPS still sum to 10,000

// socialRecipientsToCreate: Map<pdaAddress, { userId, platform }>
// PDAs that don't exist yet and need createSocialFeePdaInstruction
console.log("Resolved shareholders:", normalizedShareholders.map(s => s.address.toBase58()));
console.log("PDAs to create:", [...socialRecipientsToCreate.keys()]);
```

### `createSharingConfigWithSocialRecipients` — One-Shot Setup

Create a fee sharing config with social recipients in a single call. The SDK creates missing social PDAs and wires up the config atomically:

```typescript
import { PUMP_SDK, Platform } from "@nirholas/pump-sdk";

// Returns TransactionInstruction[] — handles PDA creation + config creation
const setupIxs = await PUMP_SDK.createSharingConfigWithSocialRecipients({
  creator: creator.publicKey,
  mint: mint.publicKey,
  pool: null, // null for bonding curve, PublicKey for graduated AMM pool
  newShareholders: [
    { address: creator.publicKey, shareBps: 5000 },
    { userId: "12345678", platform: Platform.GitHub, shareBps: 3000 },
    { userId: "87654321", platform: Platform.GitHub, shareBps: 2000 },
  ],
});

// Build and send
const { blockhash } = await connection.getLatestBlockhash("confirmed");
const message = new TransactionMessage({
  payerKey: creator.publicKey,
  recentBlockhash: blockhash,
  instructions: setupIxs,
}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([creator]);
await connection.sendTransaction(tx);
console.log("Fee config created with social recipients.");
```

### `updateSharingConfigWithSocialRecipients` — Modify Existing Config

When shareholders change (new collaborator, updated splits), use the update variant. Pass the current shareholders so the SDK can diff and create only missing PDAs:

```typescript
import { PUMP_SDK, Platform, OnlinePumpSdk } from "@nirholas/pump-sdk";

const online = new OnlinePumpSdk(connection);

// Fetch the existing config to get current shareholders
const currentConfig = await online.fetchFeeSharingConfig(mint.publicKey);

// Reassign: give a new GitHub collaborator 20%, reduce creator share
const updateIxs = await PUMP_SDK.updateSharingConfigWithSocialRecipients({
  authority: creator.publicKey,
  mint: mint.publicKey,
  currentShareholders: currentConfig.shareholders,
  newShareholders: [
    { address: creator.publicKey, shareBps: 4000 },          // was 5000
    { userId: "12345678", platform: Platform.GitHub, shareBps: 3000 },
    { userId: "87654321", platform: Platform.GitHub, shareBps: 1000 }, // was 2000
    { userId: "99999999", platform: Platform.GitHub, shareBps: 2000 }, // new
  ],
});

const { blockhash } = await connection.getLatestBlockhash("confirmed");
const message = new TransactionMessage({
  payerKey: creator.publicKey,
  recentBlockhash: blockhash,
  instructions: updateIxs,
}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([creator]);
await connection.sendTransaction(tx);
console.log("Shareholders updated.");
```

---

## Part 5: AMM Cashback Trading

Once a token graduates to the AMM (bonding curve `complete === true`), cashback continues through the AMM programs. The patterns mirror the bonding curve ones but use AMM-specific methods.

### Check Graduation and Switch to AMM

```typescript
import { PUMP_SDK, OnlinePumpSdk } from "@nirholas/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

const online = new OnlinePumpSdk(connection);

async function tradeWithCashback(mint: PublicKey, user: PublicKey) {
  const bc = await online.fetchBondingCurve(mint);

  if (!bc.complete) {
    // Still on bonding curve
    const buyIxs = await online.buyInstructions({
      mint,
      user,
      solAmount: new BN(50_000_000), // 0.05 SOL
      slippageBps: 500,
    });
    return buyIxs;
  }

  // Graduated — use AMM
  const pool = await online.fetchPoolForMint(mint);

  // AMM buy (base tokens out, quote SOL in)
  const ammBuyIx = await PUMP_SDK.ammBuyInstruction({
    user,
    pool,
    mint,
    baseAmountOut: new BN(1_000_000),   // token amount to receive
    maxQuoteAmountIn: new BN(50_000_000), // max SOL to spend
    cashback: true,                      // include volume accumulator
  });
  return [ammBuyIx];
}
```

### AMM Exact-Quote Buy

Pay an exact SOL amount and receive at least `minBaseAmountOut` tokens:

```typescript
const ammExactBuyIx = await PUMP_SDK.ammBuyExactQuoteInInstruction({
  user: trader.publicKey,
  pool,
  mint,
  quoteAmountIn: new BN(100_000_000), // exact 0.1 SOL in
  minBaseAmountOut: new BN(900_000),  // min tokens out (after slippage)
  cashback: true,
});
```

### AMM Sell

```typescript
const ammSellIx = await PUMP_SDK.ammSellInstruction({
  user: trader.publicKey,
  pool,
  mint,
  baseAmountIn: new BN(1_000_000),    // tokens to sell
  minQuoteAmountOut: new BN(45_000_000), // min SOL out (after slippage)
  cashback: true,
});
```

### Claim AMM Cashback

AMM cashback accumulates in a separate account from bonding curve cashback. Claim both in one transaction:

```typescript
const pumpClaimIx = PUMP_SDK.claimCashbackInstruction({ user: trader.publicKey });
const ammClaimIx = PUMP_SDK.ammClaimCashbackInstruction({ user: trader.publicKey });

const message = new TransactionMessage({
  payerKey: trader.publicKey,
  recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
  instructions: [pumpClaimIx, ammClaimIx],
}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([trader]);
await connection.sendTransaction(tx);
```

---

## Combining Cashback + Social Fees + Fee Sharing

For maximum fee distribution, combine all three mechanisms. Use `createSharingConfigWithSocialRecipients` to handle social PDA creation automatically:

```typescript
import {
  PUMP_SDK,
  OnlinePumpSdk,
  Platform,
} from "@nirholas/pump-sdk";
import { TransactionMessage, VersionedTransaction } from "@solana/web3.js";

// 1. Create token with cashback
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "Full Featured Token",
  symbol: "FULL",
  uri: "https://example.com/metadata.json",
  creator: creator.publicKey,
  user: creator.publicKey,
  mayhemMode: false,
  cashback: true,
});

// 2. Set up fee sharing with social recipients in one call
//    - creator keeps 50% (wallet address)
//    - two GitHub collaborators get 25% each (no wallets needed yet)
const feeSharingIxs = await PUMP_SDK.createSharingConfigWithSocialRecipients({
  creator: creator.publicKey,
  mint: mint.publicKey,
  pool: null,
  newShareholders: [
    { address: creator.publicKey, shareBps: 5000 },
    { userId: "12345678", platform: Platform.GitHub, shareBps: 2500 },
    { userId: "87654321", platform: Platform.GitHub, shareBps: 2500 },
  ],
});

// 3. Initialize volume accumulator so creator earns cashback too
const initAccumIx = PUMP_SDK.initUserVolumeAccumulator({
  payer: creator.publicKey,
  user: creator.publicKey,
});

// Send create + fee config + accumulator init in one transaction
const { blockhash } = await connection.getLatestBlockhash("confirmed");
const message = new TransactionMessage({
  payerKey: creator.publicKey,
  recentBlockhash: blockhash,
  instructions: [createIx, ...feeSharingIxs, initAccumIx],
}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([creator, mint]);
await connection.sendTransaction(tx);
console.log("Token launched with cashback + social fee sharing.");
```

## Next Steps

- See [Tutorial 07](./07-fee-sharing.md) for detailed fee sharing configuration
- See [Tutorial 08](./08-token-incentives.md) for volume-based token rewards
- See [Tutorial 16](./16-monitoring-claims.md) for monitoring all claim types
- See [Tutorial 23](./23-mayhem-mode-trading.md) for Mayhem Mode cashback combo
