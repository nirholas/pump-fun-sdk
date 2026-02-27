---
name: pump-solana-dev
description: "Solana development patterns used in the Pump SDK — Anchor IDL-based program interaction, SPL Token and Token-2022 management, transaction construction with instruction composition, RPC batching, and cross-program coordination."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
    requires:
      env:
        - SOLANA_RPC_URL
---

# Solana Development — Web3.js, Anchor, SPL Tokens & On-Chain Patterns

Apply Solana development patterns used throughout the Pump SDK: Anchor IDL-based program interaction, SPL Token and Token-2022 account management, transaction construction with instruction composition, RPC batching, and cross-program account coordination.

## Anchor Program Initialization

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';

function getPumpProgram(connection: Connection): Program<Pump> {
    const provider = new AnchorProvider(
        connection,
        { publicKey: PublicKey.default, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
        { commitment: 'confirmed' }
    );
    return new Program(pumpIdl as Pump, PUMP_PROGRAM_ID, provider);
}
```

**Offline pattern:** Uses a dummy provider (no wallet) for building instructions. Actual signing happens in the caller's code.

## Instruction Building with `accountsStrict`

```typescript
const ix = await program.methods
    .buy(amount, maxSolCost, flags)
    .accountsStrict({
        global: GLOBAL_PDA,
        bondingCurve: bondingCurvePda(mint),
        user: userPublicKey,
        // ... all required accounts
    })
    .remainingAccounts(additionalAccounts)
    .instruction();
```

## PDA Derivation

```typescript
const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID
);
```

## RPC Batching

```typescript
const accounts = await connection.getMultipleAccountsInfo([
    bondingCurvePda(mint),
    GLOBAL_PDA,
    FEE_CONFIG_PDA,
]);
```

## Token-2022 Support

The SDK supports both SPL Token and Token-2022:
- `createV2Instruction` creates Token-2022 mints
- `tokenProgram` parameter selects the appropriate program
- Associated Token Accounts (ATAs) are created idempotently

## Account Decoding

```typescript
const bondingCurve = program.coder.accounts.decode('bondingCurve', accountInfo.data);
```

Nullable variants handle missing accounts:
```typescript
const bc = decodeBondingCurveNullable(accountInfo); // returns null instead of throwing
```

## Transaction Simulation

```typescript
const result = await connection.simulateTransaction(tx, [signer]);
// Parse return data from simulation logs
```

## BN.js Arithmetic

All amounts use `BN` for arbitrary-precision integer arithmetic:

```typescript
const fee = amount.mul(new BN(feeBps)).div(new BN(10000));
const ceilFee = amount.mul(new BN(feeBps)).add(new BN(9999)).div(new BN(10000));
```

## Patterns to Follow

- Always use `accountsStrict` — not `accounts` — for type-safe account specification
- Use `getMultipleAccountsInfo` to batch account fetches
- Build instruction arrays, not transactions — let callers compose
- Handle both Token and Token-2022 programs via parameter
- Use nullable decoders for optional accounts

## Common Pitfalls

- `AnchorProvider` with dummy wallet is for instruction building only — never sign with it
- `getMultipleAccountsInfo` returns nulls for missing accounts — always check
- Transaction size limit is 1232 bytes — large instruction sets may need multiple transactions
- `remainingAccounts` order matters — the on-chain program reads them positionally
