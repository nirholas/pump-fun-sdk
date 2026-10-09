# Error Reference

> Every custom error class the SDK throws, what causes it, and how to recover, plus the common on-chain Anchor errors and `getPumpProgramError` for resolving any program error code.

All SDK error classes are exported from `@nirholas/pump-sdk` and extend `Error`, so `instanceof` checks work.

---

## Fee Sharing Errors

Thrown by `updateFeeShares` (and the wrappers that call it) when validating a shareholder list. All shares must total exactly **10,000 BPS** (100%).

### NoShareholdersError

```
No shareholders provided
```

**Cause:** Empty `newShareholders` array.
**Fix:** Provide at least one shareholder.

---

### TooManyShareholdersError

```
Too many shareholders. Maximum allowed is 10, got 12
```

**Cause:** More than `MAX_SHAREHOLDERS` (10) shareholders in the config.
**Fix:** Reduce to 10 or fewer shareholders. Properties: `count`, `max`.

---

### ZeroShareError

```
Zero or negative share not allowed for address BYsXqJ...
```

**Cause:** A shareholder has `shareBps` of 0 or negative.
**Fix:** Every shareholder must have a positive share. Property: `address`.

---

### InvalidShareTotalError

```
Invalid share total. Must equal 10,000 basis points (100%). Got 9500
```

**Cause:** Shares don't sum to exactly 10,000 BPS.
**Fix:** Adjust shares so they total 10,000. Property: `total`.

---

### DuplicateShareholderError

```
Duplicate shareholder addresses not allowed
```

**Cause:** Same address appears more than once in the shareholders array.
**Fix:** Merge duplicate entries into a single shareholder with combined BPS.

---

### ShareCalculationOverflowError

```
Share calculation overflow - total shares exceed maximum value
```

**Cause:** Internal arithmetic overflow during share calculation.
**Fix:** Reduce share values. This typically indicates a bug; file an issue.

---

### PoolRequiredForGraduatedError

```
Pool parameter is required for graduated coins (bondingCurve.complete = true)
```

**Cause:** A fee-sharing operation on a graduated token was attempted without supplying the AMM pool address.
**Fix:** Pass the pool, e.g. `pool: canonicalPumpPoolPda(mint)`, when the token has graduated. Pass `pool: null` only while the token is still on its bonding curve.

---

## Trading Errors

### SellOverflowError

```
Sell amount ... would overflow the on-chain arithmetic for
virtualSolReserves=... . Max safe chunk is ... raw token units. Use
OnlinePumpSdk.sellChunked() or split the sell into smaller chunks.
```

**Cause:** The amount does not fit the arithmetic the program can represent. The sell multiply `amount * virtualSolReserves` is widened to u128 on-chain, so in practice the binding limit is the token amount's own u64 field width. This throws only for genuinely unrepresentable amounts.

**This is not the cause of an intermittent 6024.** If your sells succeed most of the time and fail occasionally at similar sizes, the cause is slippage and state drift, not arithmetic width: a function of `(amount, reserves)` would fail every time. See [Sell fails intermittently](#sell-fails-intermittently-anchorerror-6024) below.

**Fix:** Split the sell. Either call `OnlinePumpSdk.sellChunked()` (refetches state between chunks and sends each via your `sendTx` callback) or cap each sell at `maxSafeSellAmount(bondingCurve.virtualSolReserves)`. Properties: `amount`, `virtualSolReserves`, `maxSafeAmount`.

Pre-flight check without triggering the throw:

```typescript
import { maxSafeSellAmount, validateSellAmount } from "@nirholas/pump-sdk";

const max = maxSafeSellAmount(bondingCurve.virtualSolReserves);
if (amount.gt(max)) {
  // chunk the sell instead of sending one oversized instruction
}
// or let it throw:
validateSellAmount(amount, bondingCurve);
```

---

## October 2026 Upgrade Errors

Thrown by the v3 curve trades, `multi_hop_swap` and `create_v2` quote-mint builders before anything is sent, each mirroring the on-chain error the program would return.

| Error | Program code | Cause | Fix |
|-------|--------------|-------|-----|
| `CashbackCoinNotSupportedError` | pump 6094 | A v3 curve trade (`buyV3Instructions`, `buyExactQuoteInV3Instructions`, `sellV3Instructions`) on a cashback coin | Trade it with `buyInstructions` / `sellInstructions`. Property: `mint` |
| `UnsupportedQuoteMintError` | pump 6063 | A `create_v2` quote mint that is neither SOL, a `Global.whitelistedQuoteMints` entry, a `QuoteControl` mint nor a pump coin passed with `pumpQuote` | Pick a listed quote, or resolve the pump coin with `OnlinePumpSdk.fetchPumpQuote`. Property: `quoteMint` |
| `CurveDepthExceededError` | pump 6105 | The pump-coin quote chain would be deeper than `Global.maxCurveDepth` (mainnet allows coins quoted in depth-0 coins only) | Quote the new coin in a shallower coin. Properties: `depth`, `maxCurveDepth` |
| `QuoteBondingCurveNotEligibleError` | pump 6100 | The quote coin is mayhem mode, or a depth-0 coin whose own quote no list admits | Use another quote. Property: `quoteMint` |
| `QuotePoolNotFoundError` | pump 6102 | The quote coin migrated but its canonical PumpSwap pool does not exist | Use another quote. Properties: `quoteMint`, `pool` |
| `QuoteCurveAwaitingMigrationError` | pump 6107 | The quote coin's curve completed but `migrate` has not run, so it has no price | Retry once the pool exists. Property: `quoteMint` |
| `QuoteReservesOutOfRangeError` | pump 6104 | The starting reserves derived from the quote coin's price are outside the allowed range | Use another quote. Properties: `quoteMint`, `derived` |
| `MultiHopDiscontinuousPathError` | pump 6098, pump-amm 6084 | A `multi_hop_swap` hop does not continue from the one before it (on a buy, each hop's quote must be the previous hop's coin; on a sell, each hop's coin must be the previous hop's quote) | Reorder or fix the hops. Property: `hopIndex` |

```typescript
import {
  CurveDepthExceededError,
  QuoteCurveAwaitingMigrationError,
  OnlinePumpSdk,
} from "@nirholas/pump-sdk";

try {
  const ix = await sdk.createV2Instruction({ mint, name, symbol, uri, creator, user, quoteMint });
} catch (err) {
  if (err instanceof CurveDepthExceededError) {
    console.error(`depth ${err.depth} is over the limit ${err.maxCurveDepth}`);
  } else if (err instanceof QuoteCurveAwaitingMigrationError) {
    console.error(`${err.quoteMint.toBase58()} has not migrated yet; retry later`);
  } else {
    throw err;
  }
}
```

---

## Vanity Mint Errors

Thrown by `generateVanityMint` (see the [CLI Guide](./cli-guide.md) for the standalone generators).

| Error | Cause |
|-------|-------|
| `VanityMintPatternError` | Pattern contains non-Base58 characters (`0`, `O`, `I`, `l`) or exceeds `MAX_VANITY_PATTERN_LENGTH` (6) |
| `VanityMintMaxAttemptsError` | `maxAttempts` was reached before a matching keypair was found |

Both extend the shared base class `VanityError`, which carries a `type` field (`VanityErrorType`).

---

## Handling Errors

```typescript
import {
  PUMP_SDK,
  NoShareholdersError,
  TooManyShareholdersError,
  ZeroShareError,
  InvalidShareTotalError,
  DuplicateShareholderError,
} from "@nirholas/pump-sdk";

try {
  const ix = await PUMP_SDK.updateFeeShares({
    authority: wallet,
    mint: tokenMint,
    currentShareholders: [],
    newShareholders: shares,
  });
} catch (err) {
  if (err instanceof InvalidShareTotalError) {
    console.error(`Shares total ${err.total}, need 10000`);
  } else if (err instanceof TooManyShareholdersError) {
    console.error(`${err.count} shareholders, max ${err.max}`);
  } else if (err instanceof ZeroShareError) {
    console.error(`Zero share for ${err.address}`);
  }
}
```

---

## On-Chain Errors

The Anchor programs also return errors via transaction logs. Common on-chain errors:

| Error | Program | Cause |
|-------|---------|-------|
| `InsufficientFunds` | Pump | Not enough SOL for buy |
| `SlippageExceeded` / `TooLittleSolReceived` | Pump/PumpAMM | Price moved beyond slippage tolerance |
| `BondingCurveComplete` | Pump | Token already graduated; use AMM |
| `Overflow` (6024) | Pump | Intermittent: slippage and reserve drift between quote and landing. Consistent at one size: see `SellOverflowError` above |
| `Unauthorized` | All | Wrong authority/signer |
| `AccountNotFound` | All | PDA doesn't exist yet |

These are standard Anchor errors and appear in transaction logs, not as SDK exceptions.

### Resolving a custom error code

A failed transaction reports `InstructionError: [index, { Custom: code }]`. `getPumpProgramError` turns the code into the name and message the program declares, from the IDLs bundled with the SDK, so every code is covered, including the ones the October 2026 upgrade added (pump 6094 to 6108, pump-amm 6059 to 6087, pump-fees 6031 to 6034):

```typescript
import { getPumpProgramError, PUMP_PROGRAM_ID } from "@nirholas/pump-sdk";

const err = getPumpProgramError(PUMP_PROGRAM_ID, 6095);
// { program: "pump", code: 6095, name: "CreatorFeesNotSwept", msg: ... }
getPumpProgramError("pumpAmm", 6079)?.name; // "CashbackCoinNotSupported"
getPumpProgramError("pump", 100);           // undefined: an Anchor framework code
```

Codes worth knowing since the October 2026 upgrade:

| Code | Name | Meaning and fix |
|------|------|-----------------|
| pump 6095 | `CreatorFeesNotSwept` | v3 trades left creator fees on the curve. Put `sweepCreatorFeeInstruction` first in the same transaction (or use `OnlinePumpSdk.creatorFeeSweepInstructions`) |
| pump-amm 6081 | `CreatorFeesNotSwept` | PumpSwap v2 trades left creator fees in the pool. Put `ammSweepCreatorFeeInstruction` first |
| pump-fees 6033 | `PoolCreatorFeesNotSwept` | `update_fee_shares` on a graduated coin with un-swept pool creator fees. Sweep first |
| pump 6057, 6062 | `BuybackFeeRecipientNotAuthorized`, `BuybackFeeRecipientMissing` | The `buyback_fee_recipient` is not a listed `Global.buybackFeeRecipients` wallet (or, on a token quote, that wallet's quote ATA), or it is missing. The program never creates that ATA: the v3 builders pick a listed wallet and create it idempotently, the raw builders do neither |
| pump 6021 | `NotEnoughTokensToBuy` | A v3 buy past the remaining supply on a mayhem curve without `partialFill`, or one that would take the whole pool-to-be |
| pump-amm 6079 | `CashbackCoinNotSupported` | A PumpSwap v2 trade on a cashback coin. Use the v1 AMM builders |
| pump-amm 6080 / pump 6108 | `MayhemPoolNotSupported` / `MultiHopMayhemCurveNotSupported` | A mayhem pool or curve as a `multi_hop_swap` hop |
| pump-fees 6031 | `UnsupportedQuoteMint` | A fee computation for a quote mint the fee program does not price |

---

## Related

- [Fee Sharing](./fee-sharing.md): share configuration
- [Troubleshooting](./TROUBLESHOOTING.md): symptom-driven fixes
- [API Reference](./api-reference.md): full SDK API

Runnable examples: see Curve Math & Fees examples 11-20 (`npm run example 15` covers the max-safe-sell limit).
