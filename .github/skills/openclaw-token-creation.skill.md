# OpenClaw Token Creation — Mint New Tokens on Pumpfun

## Skill Description

Create new tokens on the Pumpfun protocol using the `createV2Instruction` builder, with support for Token-2022, optional mayhem mode, initial buy bundling, and metadata URI configuration — all built as composable `TransactionInstruction[]` arrays.

## Context

Token creation is the entry point of the Pumpfun token lifecycle. The SDK constructs instructions that mint a new token using Token-2022, register it with the Pump on-chain program, and optionally bundle an initial purchase in the same transaction. The `createV2Instruction` method replaced the deprecated `createInstruction` (SPL Token) and adds mayhem mode support and cashback tracking.

## Key Files

- [src/sdk.ts](src/sdk.ts) — `PumpSdk.createV2Instruction()`, `createV2AndBuyInstructions()`
- [src/state.ts](src/state.ts) — `Global` interface with creation parameters
- [src/pda.ts](src/pda.ts) — PDA derivations for bonding curve, global params, vaults
- [src/bondingCurve.ts](src/bondingCurve.ts) — `newBondingCurve()` for initial reserves
- [src/idl/pump.ts](src/idl/pump.ts) — Pump IDL with `createV2` instruction definition

## Token Creation Flow

```
1. Generate mint keypair (new PublicKey)
2. Prepare metadata (name, symbol, URI)
3. Build createV2Instruction
4. Optionally bundle initial buy
5. Submit transaction with mint as signer
```

## Instructions

### createV2Instruction

Creates a new token with Token-2022 and registers its bonding curve:

```typescript
const ix = await PUMP_SDK.createV2Instruction({
  mint: mintKeypair.publicKey,  // New mint address
  name: "My Token",             // Token name
  symbol: "MTK",                // Token symbol
  uri: "https://arweave.net/...", // Metadata JSON URI
  creator: wallet.publicKey,    // Creator address (receives fees)
  user: wallet.publicKey,       // Transaction payer
  mayhemMode: false,            // Enable mayhem mode pricing
  cashback: false,              // Enable cashback tracking
});
```

**Parameters:**
- `mint` — Fresh keypair public key; becomes the token's mint address
- `name` — Human-readable token name
- `symbol` — Token ticker symbol
- `uri` — URI pointing to off-chain metadata JSON (Arweave, IPFS, etc.)
- `creator` — Public key that will receive creator fees from trades
- `user` — Transaction fee payer
- `mayhemMode` — When `true`, uses mayhem fee recipients and altered supply calculation
- `cashback` — When `true`, enables volume-based cashback tracking

### createV2AndBuyInstructions

Atomic create + initial buy in one transaction:

```typescript
const instructions = await PUMP_SDK.createV2AndBuyInstructions({
  global,                        // Global account state
  mint: mintKeypair.publicKey,
  name: "My Token",
  symbol: "MTK",
  uri: "https://arweave.net/...",
  creator: wallet.publicKey,
  user: wallet.publicKey,
  amount: new BN(1_000_000),     // Token amount to buy
  solAmount: new BN(100_000_000), // SOL to spend (lamports)
  mayhemMode: false,
  cashback: false,
});
```

This returns 4 instructions:
1. `createV2` — Register the token
2. `extendAccount` — Extend bonding curve account to new size
3. `createAssociatedTokenAccountIdempotent` — Create buyer's ATA
4. `buy` — Purchase tokens from the fresh bonding curve

## Initial Bonding Curve State

When a token is created, its bonding curve is initialized from `Global` parameters:

```typescript
function newBondingCurve(global: Global): BondingCurve {
  return {
    virtualTokenReserves: global.initialVirtualTokenReserves,
    virtualSolReserves: global.initialVirtualSolReserves,
    realTokenReserves: global.initialRealTokenReserves,
    realSolReserves: new BN(0),
    tokenTotalSupply: global.tokenTotalSupply,
    complete: false,
    creator: PublicKey.default,
    isMayhemMode: global.mayhemModeEnabled,
  };
}
```

## On-Chain Accounts Created

| Account | PDA Seed | Purpose |
|---------|----------|---------|
| Bonding Curve | `["bonding-curve", mint]` | Token reserves and pricing state |
| Global Params | `["global-params"]` | Protocol-wide parameters |
| SOL Vault | `["sol-vault"]` | SOL reserve storage |
| Mayhem State | `["mayhem-state", mint]` | Mayhem mode state (if enabled) |
| Token Vault | `["token-vault", mint]` | Token vault (mayhem mode) |

## Metadata URI Format

The `uri` parameter should point to a JSON file following Metaplex token metadata standard:

```json
{
  "name": "My Token",
  "symbol": "MTK",
  "description": "A token launched on Pumpfun",
  "image": "https://arweave.net/image-hash",
  "external_url": "https://example.com",
  "properties": {
    "category": "token"
  }
}
```

## Patterns to Follow

- Always use `createV2Instruction`, never the deprecated `createInstruction`
- Use `Token-2022` (`TOKEN_2022_PROGRAM_ID`) for all new token creation
- Bundle create + buy in a single transaction to avoid front-running
- Generate a fresh `Keypair` for each new mint — never reuse mint addresses
- All amounts use `BN` (bn.js) — never JavaScript `number` for lamports or token amounts
- The `creator` field determines who receives creator fees — set it carefully

## Common Pitfalls

- Using `createInstruction` (v1) instead of `createV2Instruction` — v1 uses SPL Token and is deprecated
- Forgetting the mint keypair must sign the transaction — it's not just a public key parameter
- Not fetching `Global` state before bundling a buy — the buy instruction needs fee configuration
- Setting `creator` to the wrong address — this permanently determines fee recipient until admin override
- Using JavaScript `number` for amounts instead of `BN` — causes precision loss for large values
