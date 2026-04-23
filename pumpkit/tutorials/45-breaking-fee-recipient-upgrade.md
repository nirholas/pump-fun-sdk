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
