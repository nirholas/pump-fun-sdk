# Tutorial 23: Mayhem Mode Trading

> Create and trade tokens using Pump's Mayhem Mode — alternative routing with separate vaults, Token-2022, and different fee mechanics.

## Prerequisites

- Node.js 18+
- `@nirholas/pump-sdk` installed
- Understanding of [Tutorial 01](./01-create-token.md) (basic token creation)

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
```

## What Is Mayhem Mode?

Mayhem Mode is an alternative token creation path on Pump. When enabled:

| Feature | Standard Mode | Mayhem Mode |
|---------|---------------|-------------|
| Token Program | `TOKEN_PROGRAM_ID` | `TOKEN_2022_PROGRAM_ID` |
| Vault routing | Standard Pump vaults | Separate Mayhem program vaults |
| Fee recipients | `global.feeRecipient` | `global.reservedFeeRecipient` |
| Fee tier supply | Uses `ONE_BILLION_SUPPLY` constant | Uses actual `mintSupply` |
| PDAs | Standard Pump PDAs | Mayhem-specific PDAs |
| Immutable | — | Set at creation, **cannot be changed** |

**Key point:** Mayhem Mode is set at token creation and cannot be toggled afterward.

## Step 1: Create a Mayhem Mode Token

```typescript
import { Connection, Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PUMP_SDK, OnlinePumpSdk } from "@nirholas/pump-sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const creator = Keypair.generate(); // Your funded wallet
const mint = Keypair.generate();

// Enable Mayhem Mode at creation — this is IRREVERSIBLE
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "Mayhem Token",
  symbol: "MAYHEM",
  uri: "https://example.com/metadata.json",
  creator: creator.publicKey,
  user: creator.publicKey,
  mayhemMode: true,   // <-- Enables Mayhem Mode
  cashback: false,
});
```

## Step 2: Understand the PDA Differences

Mayhem Mode uses a separate program for vault derivation:

```typescript
import {
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
} from "@nirholas/pump-sdk";

// Mayhem-specific PDAs
const globalParams = getGlobalParamsPda();
// Seeds: ["global-params"]

const mayhemState = getMayhemStatePda(mint.publicKey);
// Seeds: ["mayhem-state", mint.publicKey.toBuffer()]

const solVault = getSolVaultPda();
// Seeds: ["sol-vault"]

const tokenVault = getTokenVaultPda(mint.publicKey);
// SOL vault's ATA for the mint, using TOKEN_2022_PROGRAM_ID

console.log("Mayhem State PDA:", mayhemState.toBase58());
console.log("SOL Vault PDA:", solVault.toBase58());
console.log("Token Vault PDA:", tokenVault.toBase58());
```

## Step 3: Buy a Mayhem Token

Buying works the same as standard tokens — the SDK handles routing internally:

```typescript
import { getBuyTokenAmountFromSolAmount } from "@nirholas/pump-sdk";
import BN from "bn.js";

const onlineSdk = new OnlinePumpSdk(connection);

// Fetch the bonding curve state
const bc = await onlineSdk.fetchBondingCurve(mint.publicKey);
const feeConfig = await onlineSdk.fetchFeeConfig();

// Quote how many tokens you'll get
const solToSpend = new BN(100_000_000); // 0.1 SOL
const tokensOut = getBuyTokenAmountFromSolAmount(
  solToSpend,
  bc.virtualSolReserves,
  bc.virtualTokenReserves,
  feeConfig
);

console.log(`Spending 0.1 SOL → ${tokensOut.toString()} tokens`);

// Build buy instructions
const buyIxs = await onlineSdk.buyInstructions({
  mint: mint.publicKey,
  user: creator.publicKey,
  solAmount: solToSpend,
  slippageBps: 500, // 5% slippage tolerance
});
```

## Step 4: Fee Tier Differences

In standard mode, fee tiers are calculated against a fixed supply of 1 billion tokens. In Mayhem Mode, the **actual minted supply** is used, which can place your token in a different fee tier:

```typescript
import { computeFeesBps } from "@nirholas/pump-sdk";

// Standard mode — always uses ONE_BILLION_SUPPLY
const standardFees = computeFeesBps(feeConfig, new BN("1000000000000000")); // 1B supply

// Mayhem mode — uses actual mint supply from the bonding curve
const mayhemFees = computeFeesBps(feeConfig, bc.tokenTotalSupply);

console.log("Standard fee (bps):", standardFees.totalFeeBps);
console.log("Mayhem fee (bps):", mayhemFees.totalFeeBps);
// These may differ based on where the actual supply falls in the tier schedule
```

## Step 5: Detect Mayhem Mode On-Chain

When analyzing existing tokens, check whether they use Mayhem Mode:

```typescript
async function isMayhemToken(
  onlineSdk: OnlinePumpSdk,
  mintAddress: PublicKey
): Promise<boolean> {
  const bc = await onlineSdk.fetchBondingCurve(mintAddress);
  // Mayhem tokens use Token-2022 program
  // Check the token vault account's owner program
  const tokenVault = getTokenVaultPda(mintAddress);
  const accountInfo = await connection.getAccountInfo(tokenVault);

  if (!accountInfo) return false;

  // Token-2022 program ID indicates Mayhem mode
  const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
  return accountInfo.owner.toBase58() === TOKEN_2022_PROGRAM_ID;
}
```

## Step 6: Mayhem + Cashback Combo

You can combine Mayhem Mode with cashback for a unique token configuration:

```typescript
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "Mayhem Cashback Token",
  symbol: "MCASH",
  uri: "https://example.com/metadata.json",
  creator: creator.publicKey,
  user: creator.publicKey,
  mayhemMode: true,   // Separate vaults + Token-2022
  cashback: true,      // Enable cashback rewards
});

// When selling with cashback enabled, include volume accumulator
const sellIxs = await onlineSdk.sellInstructions({
  mint: mint.publicKey,
  user: creator.publicKey,
  tokenAmount: new BN("1000000"),
  slippageBps: 500,
  cashback: true, // Includes userVolumeAccumulator in remaining accounts
});
```

## When to Use Mayhem Mode

**Use Mayhem Mode when:**
- You want Token-2022 features (extensions, transfer hooks, etc.)
- You want fee tiers based on actual minted supply rather than fixed 1B
- You're building a specialized token with separate vault routing

**Use Standard Mode when:**
- You want maximum compatibility with existing tools and wallets
- You want predictable fee tier behavior (fixed 1B supply baseline)
- You don't need Token-2022 extensions

## Important Caveats

1. **Immutable** — Mayhem Mode cannot be disabled after creation
2. **Different fee recipients** — Fees go to `reservedFeeRecipient` addresses
3. **Token-2022** — Some wallets may not display Token-2022 tokens correctly
4. **PDA derivation** — Use the Mayhem-specific PDA functions, not standard ones

## Next Steps

- See [Tutorial 27](./27-cashback-social-fees.md) for the full cashback system
- See [Tutorial 09](./09-fee-system.md) for understanding fee tiers
