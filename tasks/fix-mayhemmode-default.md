# Task: Fix mayhemMode Default in sellInstructions (Already Partially Done)

## Status
**Priority:** High — silent wrong-fee-recipient for mayhem-mode tokens  
**Partially fixed in:** latest commit (removed `mayhemMode` param, reads from `bondingCurve.isMayhemMode`)

## Problem Summary

`PUMP_SDK.buyInstructions()` auto-derives `mayhemMode` from `bondingCurve.isMayhemMode` internally.  
`PUMP_SDK.sellInstructions()` previously required callers to pass `mayhemMode` explicitly, defaulting to `false`.

**Consequence:** Any caller who spreads `fetchSellState()` output but forgets to pass `mayhemMode: bondingCurve.isMayhemMode` would silently use a regular fee recipient for a mayhem-mode token. The pump program would then reject the transaction with a constraint error, or worse, route fees to the wrong recipient if the program doesn't validate.

## What Was Done

In `src/sdk.ts`:
- Removed `mayhemMode: boolean` parameter from `sellInstructions` signature
- Changed `getFeeRecipient(global, mayhemMode)` → `getFeeRecipient(global, bondingCurve.isMayhemMode)`

In `src/onlineSdk.ts`:
- Removed the now-redundant `mayhemMode: bondingCurve.isMayhemMode` from both `PUMP_SDK.sellInstructions()` call sites

## Remaining Work

### 1. Check for any external callers in tutorials / live demos

Grep all `.ts`, `.html`, `.md` files for `sellInstructions` calls that still pass `mayhemMode`:

```bash
grep -r "sellInstructions" --include="*.ts" --include="*.html" --include="*.md" . \
  | grep "mayhemMode"
```

If any remain, remove the `mayhemMode` key from those call sites — it's now an excess property.

### 2. Update API reference docs

In `docs/api-reference.md` and `docs/examples.md`, remove `mayhemMode` from the `sellInstructions` parameter table and any code examples that pass it.

### 3. Add a regression test

In `src/__tests__/sdk.test.ts`, verify that `sellInstructions` uses the bondingCurve's isMayhemMode:

```typescript
it("sellInstructions uses bondingCurve.isMayhemMode for fee recipient", async () => {
  const mayhemBc = makeBondingCurve({ isMayhemMode: true });
  const regularBc = makeBondingCurve({ isMayhemMode: false });

  // Build both instruction sets and decode the feeRecipient from each
  // Verify mayhem recipient comes from global.reservedFeeRecipients
  // Verify regular recipient comes from global.feeRecipients
  // (Use a mock accountsPartial spy or decode the compiled instruction)
});
```

### 4. Update CHANGELOG / release notes

Add to `docs/release-notes/`:

```markdown
## Bug Fix: sellInstructions now auto-reads mayhemMode from bondingCurve

**Breaking change:** `mayhemMode` parameter removed from `PUMP_SDK.sellInstructions()`.
The method now reads `bondingCurve.isMayhemMode` directly, matching `buyInstructions` behavior.

**Migration:** Remove `mayhemMode: ...` from any `sellInstructions` call sites. No other changes needed.
```

## Acceptance Criteria

- [ ] `grep -r "mayhemMode" src/` shows zero results inside `sellInstructions` type signatures
- [ ] TypeScript build is clean: `npm run typecheck`
- [ ] Tests pass: `npm test`
- [ ] Docs updated to remove `mayhemMode` from sellInstructions examples
