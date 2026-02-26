# Migration Guide

> How to upgrade between major versions of pump-fun-sdk. Each section covers breaking changes and the steps to migrate.

---

## Upgrading to v1.28.x (Latest)

### From v1.27.x

No breaking changes. Safe to upgrade:

```bash
npm install @pump-fun/pump-sdk@latest
```

### From v1.x (< 1.27)

#### Deprecated: `createInstruction`

`createInstruction` (v1) is deprecated. Use `createV2Instruction` instead:

```typescript
// Before (deprecated)
const ix = await PUMP_SDK.createInstruction({ mint, name, symbol, uri, creator, user });

// After
const ix = await PUMP_SDK.createV2Instruction({ mint, name, symbol, uri, creator, user, mayhemMode: false });
```

#### Fee calculation changes

Fee functions now accept a `feeConfig` parameter for tiered fee support:

```typescript
// Before
const tokens = getBuyTokenAmountFromSolAmount(global, bondingCurve, solAmount);

// After
const tokens = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,        // NEW — fetch with sdk.fetchFeeConfig()
  mintSupply,        // NEW — bondingCurve.tokenTotalSupply or null for new curves
  bondingCurve,
  amount: solAmount,
});
```

#### New exports

The following are now available and should be used where applicable:

- `isCreatorUsingSharingConfig` — Check if a creator has set up fee sharing
- `MinimumDistributableFeeResult` — Return type for fee distribution checks
- `DistributeCreatorFeeResult` — Return type for fee distribution
- `MAYHEM_PROGRAM_ID` — Mayhem program address
- Custom error types: `NoShareholdersError`, `TooManyShareholdersError`, `ZeroShareError`, `InvalidShareTotalError`, `DuplicateShareholderError`

---

## General Upgrade Steps

1. **Read the [CHANGELOG](../CHANGELOG.md)** for the version you're upgrading to
2. **Update the package**: `npm install @pump-fun/pump-sdk@<version>`
3. **Run TypeScript compilation**: `npx tsc --noEmit` to catch type errors
4. **Run your tests** to verify behavior
5. **Test on devnet** before deploying to mainnet

---

## Getting Help

If you run into issues during migration:

1. Check [Troubleshooting](TROUBLESHOOTING.md)
2. Search [issues](https://github.com/nirholas/pump-fun-sdk/issues) for your error
3. Open a [new issue](https://github.com/nirholas/pump-fun-sdk/issues/new?template=bug_report.md) with your migration context
