---
name: pump-admin-ops
description: "Admin and authority operations for the Pump protocol — set coin creator, update token incentives, set IDL authority, claim cashback, Mayhem mode, and BothPrograms cross-program admin instructions."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
    requires:
      env:
        - SOLANA_RPC_URL
---

# Admin Operations — Authority Management & Protocol Administration

Manage Pump protocol authority operations: set coin creator, update token incentives, set IDL authority, claim cashback, and cross-program admin instructions.

## Authority Model

| Authority | Account | Controls |
|-----------|---------|----------|
| `global.authority` | Global PDA | Protocol parameters |
| `bondingCurve.creator` | Per-token | Creator fee recipient |
| `sharingConfig.admin` | Per-token | Fee sharing shareholders |
| `global.idlAuthority` | Global PDA | IDL updates |
| `feeConfig.authority` | FeeConfig PDA | Fee tier configuration |
| `backendWallet` | Global PDA | Cashback claims |

## Admin Operations

### Set Coin Creator
```typescript
const ix = await PUMP_SDK.setCreator({ mint, creator: newCreator, user: admin });
// Cross-program version:
const ixs = await onlineSdk.adminSetCoinCreatorInstructions(newCreator, mint);
```

### Update Token Incentives
```typescript
const ix = await PUMP_SDK.syncUserVolumeAccumulator({ user, authority });
```

### Set IDL Authority
```typescript
const ix = await PUMP_SDK.setIdlAuthority({ newAuthority, currentAuthority });
```

### Claim Cashback
```typescript
const ix = await PUMP_SDK.claimCashback({ user, backendSigner });
```

## BothPrograms Admin Pattern

| Method | Description |
|--------|-------------|
| `adminSetCoinCreatorInstructions` | Set creator on Pump + PumpAMM |
| `collectCoinCreatorFeeInstructions` | Collect fees from both vaults |
| `syncUserVolumeAccumulatorBothPrograms` | Sync volume on both programs |

## Mayhem Mode

Tokens with `isMayhemMode === true` use:
- `MAYHEM_PROGRAM_ID` for additional PDAs
- `global.reservedFeeRecipients[]` instead of `global.feeRecipients[]`
- Different token supply values

## Patterns to Follow

- Only protocol authority can call admin instructions — verify signer
- Use BothPrograms methods for cross-program admin operations
- Check `bondingCurve.complete` before admin operations on bonding curves
- Extend accounts to `BONDING_CURVE_NEW_SIZE` before `setCreator`

## Common Pitfalls

- `setCreator` requires account extension first — will fail on undersized accounts
- Admin instructions fail silently if the signer lacks authority
- Mayhem mode tokens have separate fee recipient lists
- `adminRevoked === true` on SharingConfig blocks all shareholder updates
