# Error Reference

Custom error classes thrown by the SDK, with causes and fixes.

---

## Fee Sharing Errors

These errors are thrown when configuring fee sharing shareholders. All shares must total exactly **10,000 BPS** (100%).

### NoShareholdersError

```
No shareholders provided
```

**Cause:** Empty `shareholders` array passed to fee sharing config.
**Fix:** Provide at least one shareholder.

---

### TooManyShareholdersError

```
Too many shareholders. Maximum allowed is 8, got 12
```

**Cause:** More than 8 shareholders in the config.
**Fix:** Reduce to 8 or fewer shareholders. Properties: `count`, `max`.

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
**Fix:** Reduce share values. This typically indicates a bug — file an issue.

---

## Handling Errors

```typescript
import {
  NoShareholdersError,
  TooManyShareholdersError,
  ZeroShareError,
  InvalidShareTotalError,
  DuplicateShareholderError,
} from "@nirholas/pump-sdk";

try {
  const ixs = await sdk.createFeeSharingConfigInstruction({
    authority: wallet,
    mint: tokenMint,
    shareholders: shares,
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
| `SlippageExceeded` | Pump/PumpAMM | Price moved beyond slippage tolerance |
| `BondingCurveComplete` | Pump | Token already graduated — use AMM |
| `Unauthorized` | All | Wrong authority/signer |
| `AccountNotFound` | All | PDA doesn't exist yet |

These are standard Anchor errors and appear in transaction logs — not as SDK exceptions.

---

## Related

- [Fee Sharing](./fee-sharing.md) — Share configuration
- [API Reference](./api-reference.md) — Full SDK API
