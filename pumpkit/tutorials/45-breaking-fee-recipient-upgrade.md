# Tutorial 45: The 2026-04-28 Breaking Fee Recipient Upgrade

> **IMPORTANT — Action required before 2026-04-28, 16:00 UTC.**
>
> The Pump bonding curve and PumpSwap AMM programs are being upgraded to require a new trailing account on every buy and sell instruction. If you are not using `@nirholas/pump-sdk@^1.32.0`, your transactions **will fail** after the cutover.

## What Changed

Every `buy` and `sell` instruction now needs one of 8 new "breaking fee recipient" accounts appended at the very end of the accounts list:

- **Bonding curve buy/sell** — one mutable fee recipient after `bonding-curve-v2`
- **PumpAMM buy/sell** — a readonly fee recipient + its mutable WSOL ATA after `pool-v2`

New final account counts:

| Instruction | Before | After |
|-------------|--------|-------|
| BC `buy` | 17 | **18** |
| BC `sell` (non-cashback) | 15 | **16** |
| BC `sell` (cashback) | 16 | **17** |
| AMM `buy` (non-cashback) | 24 | **26** |
| AMM `buy` (cashback) | 25 | **27** |
| AMM `sell` (non-cashback) | 22 | **24** |
| AMM `sell` (cashback) | 24 | **26** |

---

## The Easy Path — Upgrade the SDK

If you already use `PUMP_SDK.*` or `OnlinePumpSdk`, upgrading the package is all you need to do:

```bash
npm install @nirholas/pump-sdk@^1.32.0
```

The SDK appends the new accounts automatically inside `buyInstructions`, `sellInstructions`, `buyExactSolInInstruction`, `ammBuyInstruction`, `ammBuyExactQuoteInInstruction`, and `ammSellInstruction`. No call-site changes required.

```typescript
// This code is correct before and after the upgrade — no changes needed.
import { OnlinePumpSdk } from "@nirholas/pump-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const sdk = new OnlinePumpSdk(connection);

const mint = new PublicKey("YOUR_MINT");
const user = Keypair.generate(); // use your wallet

// Bonding curve buy — new accounts appended automatically
const buyState = await sdk.fetchBuyState(mint, user.publicKey);
const buyIxs = await sdk.buyInstructions({
  ...buyState,
  mint,
  user: user.publicKey,
  amount: new BN("1000000"),
  solAmount: new BN("10000000"),
  slippage: 0.05,
});

// Bonding curve sell — same
const sellState = await sdk.fetchSellState(mint, user.publicKey);
const sellIxs = await sdk.sellInstructions({
  ...sellState,
  mint,
  user: user.publicKey,
  amount: new BN("1000000"),
  solAmount: new BN("0"),
  slippage: 0.05,
});
```

---

## Verifying the Account Layout

Use this snippet to confirm the SDK is producing the correct layout before the cutover:

```typescript
import {
  PUMP_SDK,
  BREAKING_FEE_RECIPIENTS,
  bondingCurveV2Pda,
  poolV2Pda,
  buildAmmBreakingFeeRecipientAccounts,
} from "@nirholas/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const BREAKING_SET = new Set(BREAKING_FEE_RECIPIENTS.map((k) => k.toBase58()));
const mint = new PublicKey("So11111111111111111111111111111111111111112");
const user = Keypair.generate().publicKey;
const creator = Keypair.generate().publicKey;
const feeRecipient = Keypair.generate().publicKey;

// ── Bonding curve buy ─────────────────────────────────────────────────────────
const buyIx = await PUMP_SDK.getBuyInstructionRaw({
  user, mint, creator, feeRecipient,
  amount: new BN(1), solAmount: new BN(1),
});

console.assert(buyIx.keys.length === 18, `BC buy: expected 18 accounts, got ${buyIx.keys.length}`);

const buyTail = buyIx.keys[buyIx.keys.length - 1]!;
console.assert(BREAKING_SET.has(buyTail.pubkey.toBase58()), "BC buy: last key must be a breaking fee recipient");
console.assert(buyTail.isWritable, "BC buy: last key must be mutable");
console.assert(buyIx.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint)), "BC buy: index 16 must be bonding-curve-v2");

console.log("✓ BC buy: 18 accounts, mutable breaking fee recipient at tail");

// ── Bonding curve sell (non-cashback) ─────────────────────────────────────────
const sellIx = await PUMP_SDK.getSellInstructionRaw({
  user, mint, creator, feeRecipient,
  amount: new BN(1), solAmount: new BN(1),
  tokenProgram: TOKEN_PROGRAM_ID,
  cashback: false,
});

console.assert(sellIx.keys.length === 16, `BC sell: expected 16 accounts, got ${sellIx.keys.length}`);
const sellTail = sellIx.keys[sellIx.keys.length - 1]!;
console.assert(BREAKING_SET.has(sellTail.pubkey.toBase58()), "BC sell: last key must be a breaking fee recipient");
console.assert(sellTail.isWritable, "BC sell: last key must be mutable");

console.log("✓ BC sell (non-cashback): 16 accounts, mutable breaking fee recipient at tail");

// ── Bonding curve sell (cashback) ─────────────────────────────────────────────
const sellCashbackIx = await PUMP_SDK.getSellInstructionRaw({
  user, mint, creator, feeRecipient,
  amount: new BN(1), solAmount: new BN(1),
  tokenProgram: TOKEN_PROGRAM_ID,
  cashback: true,
});

console.assert(sellCashbackIx.keys.length === 17, `BC sell cashback: expected 17, got ${sellCashbackIx.keys.length}`);
console.log("✓ BC sell (cashback): 17 accounts, mutable breaking fee recipient at tail");

// ── AMM trailing-accounts helper ──────────────────────────────────────────────
const [ammRecipient, ammRecipientAta] = buildAmmBreakingFeeRecipientAccounts();

console.assert(BREAKING_SET.has(ammRecipient!.pubkey.toBase58()), "AMM: first trailing key must be a breaking fee recipient");
console.assert(!ammRecipient!.isWritable, "AMM: fee recipient must be readonly");
console.assert(ammRecipientAta!.isWritable, "AMM: WSOL ATA must be mutable");

console.log("✓ AMM trailing accounts: readonly recipient + mutable WSOL ATA");
```

---

## The Manual Path — Building Instructions Without the SDK

If you are constructing Anchor instructions by hand (without calling `PUMP_SDK.*`), you must append the new accounts yourself.

### Bonding Curve — 1 new mutable account

```typescript
import {
  pickBreakingFeeRecipient,
  bondingCurveV2Pda,
} from "@nirholas/pump-sdk";

// Remaining accounts list for bonding curve buy or sell:
const remainingAccounts = [
  // ... existing accounts (e.g. user_volume_accumulator if cashback) ...
  {
    pubkey: bondingCurveV2Pda(mint),  // unchanged — was already required
    isWritable: false,
    isSigner: false,
  },
  // NEW: one of 8 breaking fee recipients — mutable, last
  {
    pubkey: pickBreakingFeeRecipient(),
    isWritable: true,
    isSigner: false,
  },
];
```

If you want to pin a specific recipient (e.g. for deterministic tests):

```typescript
import { BREAKING_FEE_RECIPIENTS } from "@nirholas/pump-sdk";

const recipient = BREAKING_FEE_RECIPIENTS[0]!; // all 8 are valid
```

### PumpAMM — 2 new accounts

```typescript
import {
  buildAmmBreakingFeeRecipientAccounts,
  poolV2Pda,
} from "@nirholas/pump-sdk";

// Remaining accounts list for AMM buy or sell:
const remainingAccounts = [
  // cashback paths also prepend user_volume_accumulator_wsol_ata + user_volume_accumulator
  {
    pubkey: poolV2Pda(mint),   // unchanged — was already required
    isWritable: false,
    isSigner: false,
  },
  // NEW: fee recipient (readonly) + recipient's WSOL ATA (mutable)
  ...buildAmmBreakingFeeRecipientAccounts(),
];
```

Or construct manually without the helper:

```typescript
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { pickBreakingFeeRecipient } from "@nirholas/pump-sdk";

const feeRecipient = pickBreakingFeeRecipient();
const recipientWsolAta = getAssociatedTokenAddressSync(
  NATIVE_MINT,
  feeRecipient,
  true,          // allowOwnerOffCurve
  TOKEN_PROGRAM_ID,
);

// Append to the end of remainingAccounts after pool-v2:
const breakingFeeAccounts = [
  { pubkey: feeRecipient, isWritable: false, isSigner: false },
  { pubkey: recipientWsolAta, isWritable: true, isSigner: false },
];
```

---

## Devnet Verification

The devnet programs already accept the new accounts. Test before mainnet cutover:

```bash
MODE=devnet \
WALLET_SECRET_KEY=<your-funded-devnet-keypair-base58> \
PUMP_TEST_MINT=<active-devnet-bonding-curve-mint> \
SOLANA_RPC_URL=https://api.devnet.solana.com \
  npx ts-node tests/integration/test-breaking-fee-recipient.ts
```

The test will:
1. Verify all instruction account counts offline (no keypair required)
2. Send a real buy + sell to devnet, confirming the programs accept the new layout

---

## The 8 Fee Recipients

Pick any one per transaction — they are equivalent:

```typescript
import { BREAKING_FEE_RECIPIENTS, pickBreakingFeeRecipient } from "@nirholas/pump-sdk";

// All 8:
console.log(BREAKING_FEE_RECIPIENTS.map((k) => k.toBase58()));
// [
//   "5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD",
//   "9M4giFFMxmFGXtc3feFzRai56WbBqehoSeRE5GK7gf7",
//   "GXPFM2caqTtQYC2cJ5yJRi9VDkpsYZXzYdwYpGnLmtDL",
//   "3BpXnfJaUTiwXnJNe7Ej1rcbzqTTQUvLShZaWazebsVR",
//   "5cjcW9wExnJJiqgLjq7DEG75Pm6JBgE1hNv4B2vHXUW6",
//   "EHAAiTxcdDwQ3U4bU6YcMsQGaekdzLS3B5SmYo46kJtL",
//   "5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD",
//   "A7hAgCzFw14fejgCp387JUJRMNyz4j89JKnhtKU8piqW",
// ]

// Pick one at random (recommended for production — spreads load):
const recipient = pickBreakingFeeRecipient();
```

---

### New utilities (v1.32.0+)

```typescript
import {
  // Predicate — is this pubkey one of the 8?
  isBreakingFeeRecipient,

  // Pre-computed map: recipient base58 → WSOL ATA (use in hot paths)
  BREAKING_FEE_RECIPIENT_WSOL_ATAS,

  // Structured validators — return { valid, errors[] }
  validateBcInstruction,     // kind: "buy" | "sell" | "sell-cashback"
  validateAmmInstruction,    // kind: "buy" | "buy-cashback" | "sell" | "sell-cashback"

  // Migration patchers — idempotent, return new instruction
  patchBcInstruction,        // appends trailing breaking fee recipient
  patchAmmInstruction,       // appends recipient + WSOL ATA pair
} from "@nirholas/pump-sdk";

// Type
import type { BreakingFeeValidation } from "@nirholas/pump-sdk";
```

---

## Monitoring — Detecting Breaking Fee Recipients On-Chain

Use `isBreakingFeeRecipient` to detect the new accounts in parsed transactions — useful for analytics dashboards, fee accounting, or audit logging.

```typescript
import {
  isBreakingFeeRecipient,
  BREAKING_FEE_RECIPIENTS,
} from "@nirholas/pump-sdk";
import { Connection } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");

async function logBreakingFeeAccounts(signature: string) {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) return;

  const accounts = tx.transaction.message.getAccountKeys().staticAccountKeys;
  const breakingFeeAccounts = accounts.filter(isBreakingFeeRecipient);

  if (breakingFeeAccounts.length > 0) {
    console.log(
      `[${signature.slice(0, 8)}] Breaking fee recipients used:`,
      breakingFeeAccounts.map((k) => k.toBase58()),
    );
  }
}
```

`isBreakingFeeRecipient` is also handy in a Helius/Triton webhook processor when you want to route post-upgrade buy/sell events differently from pre-upgrade ones.

---

## Performance — Pre-Computed WSOL ATAs

In high-throughput scenarios (AMM trading bots calling `ammBuyInstruction` hundreds of times per second), avoid re-deriving the WSOL ATA with every instruction. Use the pre-computed `BREAKING_FEE_RECIPIENT_WSOL_ATAS` map instead:

```typescript
import {
  BREAKING_FEE_RECIPIENT_WSOL_ATAS,
  pickBreakingFeeRecipient,
} from "@nirholas/pump-sdk";

// O(1) lookup — no `getAssociatedTokenAddressSync` on the hot path
const recipient = pickBreakingFeeRecipient();
const wsolAta = BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(recipient.toBase58())!;

// Build AMM remaining accounts manually:
const breakingFeeAccounts = [
  { pubkey: recipient, isWritable: false, isSigner: false },
  { pubkey: wsolAta, isWritable: true, isSigner: false },
];
```

`buildAmmBreakingFeeRecipientAccounts` already uses this map internally, so you only need the raw lookup when constructing AMM accounts by hand at scale.

---

## CI Validation — Check Your Instructions Offline

`validateBcInstruction` and `validateAmmInstruction` return a structured `{ valid, errors }` result so your own test suite can assert account layout without needing to parse raw bytes.

```typescript
import {
  PUMP_SDK,
  validateBcInstruction,
  validateAmmInstruction,
  buildAmmBreakingFeeRecipientAccounts,
  poolV2Pda,
} from "@nirholas/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

const mint = new PublicKey("YOUR_MINT");
const user = new PublicKey("YOUR_WALLET");
const creator = new PublicKey("CREATOR_PUBKEY");
const feeRecipient = new PublicKey("FEE_RECIPIENT");

// ── Bonding curve buy ────────────────────────────────────────────────
const buyIx = await PUMP_SDK.getBuyInstructionRaw({
  user, mint, creator, feeRecipient,
  amount: new BN(1_000_000), solAmount: new BN(10_000_000),
});
const buyResult = validateBcInstruction(buyIx, "buy");
if (!buyResult.valid) throw new Error(buyResult.errors.join("\n"));
console.log("✓ BC buy is compliant");

// ── Bonding curve sell (non-cashback) ────────────────────────────────
const sellIx = await PUMP_SDK.getSellInstructionRaw({
  user, mint, creator, feeRecipient,
  amount: new BN(1_000_000), solAmount: new BN(0),
  tokenProgram: TOKEN_PROGRAM_ID, cashback: false,
});
const sellResult = validateBcInstruction(sellIx, "sell");
if (!sellResult.valid) throw new Error(sellResult.errors.join("\n"));
console.log("✓ BC sell is compliant");

// ── AMM buy (non-cashback) ───────────────────────────────────────────
// Build a synthetic AMM ix (OnlinePumpSdk builds this for you in practice):
const [recipient, ata] = buildAmmBreakingFeeRecipientAccounts();
const ammBuyIx = new TransactionInstruction({
  keys: [
    // ... your 23 existing AMM accounts ...
    { pubkey: poolV2Pda(mint), isWritable: false, isSigner: false },
    recipient!,
    ata!,
  ],
  programId: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
  data: Buffer.alloc(8),
});
const ammResult = validateAmmInstruction(ammBuyIx, "buy");
if (!ammResult.valid) throw new Error(ammResult.errors.join("\n"));
console.log("✓ AMM buy is compliant");
```

`kind` values and their expected account counts:

| `validateBcInstruction` kind | Accounts |
|------------------------------|----------|
| `"buy"` | 18 |
| `"sell"` | 16 |
| `"sell-cashback"` | 17 |

| `validateAmmInstruction` kind | Accounts |
|-------------------------------|----------|
| `"buy"` | 26 |
| `"buy-cashback"` | 27 |
| `"sell"` | 24 |
| `"sell-cashback"` | 26 |

---

## Migration — Patching Legacy Instructions

If you build bonding curve or AMM instructions by hand (not through `PUMP_SDK.*`) and cannot update every call site before the deadline, `patchBcInstruction` and `patchAmmInstruction` let you retrofit existing code with a single wrapper.

Both functions are **idempotent** — they check whether the trailing account(s) are already present and return the original instruction unchanged if they are.

### Bonding Curve

```typescript
import {
  patchBcInstruction,
  validateBcInstruction,
} from "@nirholas/pump-sdk";
import { TransactionInstruction } from "@solana/web3.js";

// Somewhere in your codebase you build a BC buy ix without the trailing account:
function buildMyLegacyBcBuyIx(): TransactionInstruction {
  // ... your existing Anchor instruction builder (17 accounts) ...
}

// Wrap it before submitting — zero changes to existing call sites required:
const ix = patchBcInstruction(buildMyLegacyBcBuyIx());

// Optionally assert it's correct before sending:
const { valid, errors } = validateBcInstruction(ix, "buy");
if (!valid) throw new Error(errors.join("\n"));
```

### PumpAMM

```typescript
import {
  patchAmmInstruction,
  validateAmmInstruction,
} from "@nirholas/pump-sdk";

function buildMyLegacyAmmBuyIx(): TransactionInstruction {
  // ... your existing AMM instruction builder (24 accounts) ...
}

const ix = patchAmmInstruction(buildMyLegacyAmmBuyIx());

const { valid, errors } = validateAmmInstruction(ix, "buy");
if (!valid) throw new Error(errors.join("\n"));
```

### Bulk migration of an instruction array

```typescript
import {
  isBreakingFeeRecipient,
  patchBcInstruction,
} from "@nirholas/pump-sdk";
import { TransactionInstruction } from "@solana/web3.js";

function ensureBcInstructionsCompliant(
  ixs: TransactionInstruction[],
): TransactionInstruction[] {
  return ixs.map((ix) => {
    const tail = ix.keys[ix.keys.length - 1];
    const needsPatch = !tail || !isBreakingFeeRecipient(tail.pubkey);
    return needsPatch ? patchBcInstruction(ix) : ix;
  });
}
```

---

## What Did NOT Change

- The `Global::fee_recipient` and `Global::fee_recipients` slots (the 8-way pre-existing protocol fee) — still present, still in the same account positions.
- All accounts before `bonding-curve-v2` (bonding curve) or `pool-v2` (AMM) — identical.
- Fee math: bps, tiers, cashback split, creator vault.
- PDAs: `bondingCurveV2Pda`, `poolV2Pda`, `creatorVaultPda`, `feeSharingConfigPda`.

---

## Checklist

- [ ] Upgrade to `@nirholas/pump-sdk@^1.32.0`
- [ ] `npm run typecheck` — passes clean
- [ ] `npm test` — all suites green
- [ ] Run offline verification snippet above — all assertions pass
- [ ] Test a buy + sell on devnet
- [ ] Deploy before 2026-04-28, 16:00 UTC

## See Also

- [Tutorial 2: Buy Tokens](./02-buy-tokens.md)
- [Tutorial 3: Sell Tokens](./03-sell-tokens.md)
- [Tutorial 24: Cross-Program Trading (AMM)](./24-cross-program-trading.md)
- [Full protocol spec](../../docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md)
- [Migration guide](../docs/migration.md#upgrading-to-v1320-latest)
- [verify-accounts.ts — offline account layout checker](../../pumpkit/examples/breaking-fee-recipient/verify-accounts.ts)
- [patch-legacy.ts — migration utilities demo](../../pumpkit/examples/breaking-fee-recipient/patch-legacy.ts)
- [devnet-buy-sell.ts — end-to-end devnet test](../../pumpkit/examples/breaking-fee-recipient/devnet-buy-sell.ts)
