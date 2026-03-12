# Admin Operations

Reference for protocol administration instructions available in the Pump SDK.

---

## Feature Toggles

### Toggle Mayhem Mode

Enable/disable mayhem mode protocol-wide.

```typescript
const ix = await PUMP_SDK.toggleMayhemModeInstruction({
  authority: globalAuthority,
  enabled: true,
});
```

### Toggle Cashback

Enable/disable cashback rewards protocol-wide.

```typescript
const ix = await PUMP_SDK.toggleCashbackEnabledInstruction({
  authority: globalAuthority,
  enabled: true,
});
```

### Toggle CreateV2

Enable/disable the createV2 instruction.

```typescript
const ix = await PUMP_SDK.toggleCreateV2Instruction({
  authority: globalAuthority,
  enabled: true,
});
```

---

## Authority Management

### Update Global Authority

Transfer the global authority to a new address. **This is irreversible.**

```typescript
const ix = await PUMP_SDK.updateGlobalAuthorityInstruction({
  authority: currentAuthority,
  newAuthority: newAuthorityPubkey,
});
```

> ⚠️ **Warning:** Double-check the new authority address. Once transferred, the old authority loses all admin privileges permanently.

### Set Reserved Fee Recipients

Configure reserved fee recipients for the protocol.

```typescript
const ix = await PUMP_SDK.setReservedFeeRecipientsInstruction({
  authority: globalAuthority,
  whitelistPda: whitelistPdaAddress,
});
```

---

## Creator Management

### Set Metaplex Creator

Sets the on-chain Metaplex metadata creator from the bonding curve. This is a **permissionless** operation that anyone can call.

```typescript
const ix = await PUMP_SDK.setMetaplexCreatorInstruction({
  mint: tokenMintAddress,
});
```

### Migrate Bonding Curve Creator

Migrate a bonding curve's creator based on the fee sharing config. Also **permissionless**.

```typescript
const ix = await PUMP_SDK.migrateBondingCurveCreatorInstruction({
  mint: tokenMintAddress,
});
```

Emits `MigrateBondingCurveCreatorEvent` with old and new creator addresses.

### Admin Set Creator (Event Only)

The `AdminSetCreatorEvent` is emitted when the admin overrides a token's creator. There is no public instruction builder — this is an admin-only on-chain operation.

```typescript
// Decode the event from transaction logs
const event = PUMP_SDK.decodeAdminSetCreatorEvent(eventData);
// event.oldCreator, event.newCreator, event.mint
```

---

## AMM Admin Operations

### Migrate Pool Coin Creator

Update a graduated AMM pool's creator based on fee sharing config.

```typescript
const ix = await PUMP_SDK.ammMigratePoolCoinCreatorInstruction({
  pool: poolAddress,
  mint: tokenMint,
});
```

### Set AMM Coin Creator

Set a pool's creator from bonding curve metadata (permissionless).

```typescript
const ix = await PUMP_SDK.ammSetCoinCreatorInstruction({
  pool: poolAddress,
  mint: tokenMint,
});
```

---

## Admin Events

| Event | Trigger |
|-------|---------|
| `AdminSetCreatorEvent` | Admin overrides token creator |
| `MigrateBondingCurveCreatorEvent` | Creator migrated via fee sharing config |
| `SetCreatorEvent` | Creator set on bonding curve |

### AdminSetCreatorEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `adminSetCreatorAuthority` | `PublicKey` | Admin who made the change |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve address |
| `oldCreator` | `PublicKey` | Previous creator |
| `newCreator` | `PublicKey` | New creator |

### MigrateBondingCurveCreatorEvent

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `BN` | Unix timestamp |
| `mint` | `PublicKey` | Token mint |
| `bondingCurve` | `PublicKey` | Bonding curve address |
| `sharingConfig` | `PublicKey` | Fee sharing config |
| `oldCreator` | `PublicKey` | Previous creator |
| `newCreator` | `PublicKey` | New creator |

---

## Security Notes

- All toggle and authority operations require the **current global authority** signature.
- `updateGlobalAuthorityInstruction` is **irreversible** — double-check the new authority address.
- Creator management operations (`setMetaplexCreator`, `migrateBondingCurveCreator`) are permissionless and can be called by anyone.

---

## Related

- [Tutorial 35: Admin Protocol Management](../tutorials/35-admin-protocol-management.md) — Step-by-step admin guide
- [Events Reference](./events-reference.md) — Complete event catalog
- [API Reference](./api-reference.md) — Full SDK API
