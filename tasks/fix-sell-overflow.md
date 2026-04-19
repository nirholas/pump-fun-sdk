# Task: Fix Sell Overflow (Error 6024)

## Status
**Priority:** Critical — blocks ~25% of sell transactions in production

## Problem Summary

Users of `PUMP_SDK.sellInstructions()` get a transaction failure roughly 1-in-4 times with:

```
Program log: AnchorError thrown in programs/pump/src/lib.rs:764.
Error Code: Overflow. Error Number: 6024. Error Message: overflow.
Custom program error: 0x1788
```

**Key facts from trace:**
- FeeProgram CPI succeeds (returns `protocolFeeBps=95, creatorFeeBps=30`)
- Token2022 `TransferChecked` succeeds (tokens leave user wallet)
- Pump program then throws `Overflow` — transaction fully reverts, tokens return
- Failing args: `amount=6325344957752`, `min_sol_output=63292680`

**Root cause hypothesis:**  
The on-chain pump program computes `amount × virtualSolReserves` in the AMM sell formula.  
When both are large enough that their u64 product exceeds `u64::MAX ≈ 1.84e19`, the program's  
`checked_mul` returns `None` → custom Overflow error at line 764.  
Since `virtualSolReserves` grows as others buy, this becomes increasingly likely on popular tokens.

## What the SDK Must Do

The SDK cannot patch the on-chain program. It must:

1. **Pre-flight check** — detect sells that will overflow and throw a descriptive SDK error before broadcasting
2. **Auto-retry with back-off** — if the check is ambiguous (reserves changed at execution time), wrap in retry logic
3. **Chunked sell helper** — if amount is too large, split into safe sub-sells
4. **Clear error export** — typed `SellOverflowError` that callers can catch

## Implementation

### File: `src/bondingCurve.ts`

Add a pure validation function:

```typescript
/**
 * u64::MAX = 2^64 - 1 = 18_446_744_073_709_551_615n
 * The pump program computes `amount * virtualSolReserves` in u64 before dividing.
 * This overflows when the product > u64::MAX.
 *
 * Leave a 10% safety margin so near-threshold sells don't silently slip past.
 */
const U64_MAX = new BN("18446744073709551615");
const SELL_SAFETY_MARGIN = new BN(9).mul(U64_MAX).div(new BN(10)); // 90% of max

export function maxSafeSellAmount(virtualSolReserves: BN): BN {
  if (virtualSolReserves.isZero()) return new BN(0);
  return SELL_SAFETY_MARGIN.div(virtualSolReserves);
}

export function validateSellAmount(
  amount: BN,
  bondingCurve: BondingCurve,
): void {
  const max = maxSafeSellAmount(bondingCurve.virtualSolReserves);
  if (amount.gt(max)) {
    throw new SellOverflowError(amount, bondingCurve.virtualSolReserves, max);
  }
}
```

### File: `src/errors.ts`

```typescript
export class SellOverflowError extends Error {
  readonly amount: BN;
  readonly virtualSolReserves: BN;
  readonly maxSafeAmount: BN;

  constructor(amount: BN, virtualSolReserves: BN, maxSafeAmount: BN) {
    super(
      `Sell amount ${amount.toString()} exceeds safe limit ${maxSafeAmount.toString()} ` +
      `for virtualSolReserves=${virtualSolReserves.toString()}. ` +
      `Split into ≤${maxSafeAmount.toString()} token chunks or use sellChunked().`
    );
    this.name = "SellOverflowError";
    this.amount = amount;
    this.virtualSolReserves = virtualSolReserves;
    this.maxSafeAmount = maxSafeAmount;
  }
}
```

### File: `src/sdk.ts` — `sellInstructions()`

Add the validation call at the top of `sellInstructions`:

```typescript
// Throws SellOverflowError if amount × virtualSolReserves would overflow on-chain
validateSellAmount(amount, bondingCurve);
```

### File: `src/onlineSdk.ts` — new `sellChunked()` method

```typescript
/**
 * Sells `amount` tokens in safe-sized chunks to avoid the pump program's
 * u64 overflow when amount × virtualSolReserves exceeds u64::MAX.
 *
 * Each chunk is a separate transaction. Returns all transaction signatures.
 */
async sellChunked({
  mint,
  user,
  totalAmount,
  slippage,
  tokenProgram,
  sendTx,          // caller-provided send fn: (ixs: TransactionInstruction[]) => Promise<string>
}: {
  mint: PublicKey;
  user: PublicKey;
  totalAmount: BN;
  slippage: number;
  tokenProgram?: PublicKey;
  sendTx: (ixs: TransactionInstruction[]) => Promise<string>;
}): Promise<string[]> {
  const signatures: string[] = [];
  let remaining = totalAmount;

  while (remaining.gtn(0)) {
    // Fetch fresh state each chunk so reserves are current
    const [sellState, global, feeConfig] = await Promise.all([
      this.fetchSellState(mint, user, tokenProgram),
      this.fetchGlobal(),
      this.fetchFeeConfig(),
    ]);

    const maxChunk = maxSafeSellAmount(sellState.bondingCurve.virtualSolReserves);
    const chunk = BN.min(remaining, maxChunk);

    const solAmount = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: sellState.bondingCurve.tokenTotalSupply,
      bondingCurve: sellState.bondingCurve,
      amount: chunk,
    });

    const ixs = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint,
      user,
      amount: chunk,
      solAmount,
      slippage,
      tokenProgram: tokenProgram ?? TOKEN_PROGRAM_ID,
    });

    signatures.push(await sendTx(ixs));
    remaining = remaining.sub(chunk);
  }

  return signatures;
}
```

### File: `src/index.ts`

Export the new symbols:

```typescript
export { SellOverflowError } from "./errors";
export { maxSafeSellAmount, validateSellAmount } from "./bondingCurve";
```

## Tests

Add to `src/__tests__/bondingCurve.test.ts`:

```typescript
describe("maxSafeSellAmount", () => {
  it("returns correct limit for 30 SOL reserves", () => {
    const limit = maxSafeSellAmount(new BN(30_000_000_000));
    // 90% of u64_max / 30e9 ≈ 553_402_322
    expect(limit.gtn(500_000_000)).toBe(true);
    expect(limit.ltn(700_000_000)).toBe(true);
  });

  it("large amount throws SellOverflowError", () => {
    const bc = makeBondingCurve({ virtualSolReserves: new BN(30_000_000_000) });
    expect(() => validateSellAmount(new BN("9999999999999999"), bc))
      .toThrow(SellOverflowError);
  });

  it("safe amount does not throw", () => {
    const bc = makeBondingCurve({ virtualSolReserves: new BN(30_000_000_000) });
    expect(() => validateSellAmount(new BN(100_000_000), bc)).not.toThrow();
  });
});
```

## Acceptance Criteria

- [ ] `sellInstructions` throws `SellOverflowError` before building any instruction when amount would overflow
- [ ] `maxSafeSellAmount` and `validateSellAmount` are exported from `src/index.ts`
- [ ] `sellChunked` works end-to-end on devnet with a token that requires multiple chunks
- [ ] All existing tests still pass: `npm test`
- [ ] No new TypeScript errors: `npm run typecheck`

## Notes

- The 10% safety margin in `SELL_SAFETY_MARGIN` is conservative; increase if real-world reserves suggest it.
- The on-chain program fix (using u128 for the intermediate multiply) would make this client-side guard obsolete, but we cannot control the deployed program.
- If `virtualSolReserves` is confirmed to use u128 on-chain, this guard is still valuable as documentation and user guidance.
