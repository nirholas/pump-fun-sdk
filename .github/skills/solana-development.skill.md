# Solana Development — Web3.js, Anchor, SPL Tokens & On-Chain Patterns

## Skill Description

Apply Solana development patterns used throughout this project: Anchor IDL-based program interaction, SPL Token and Token-2022 account management, transaction construction with instruction composition, RPC batching, and cross-program account coordination.

## Context

This project interacts with multiple Solana on-chain programs using the Anchor framework for IDL-based instruction building and account decoding. It supports both the legacy SPL Token program and the newer Token-2022 program. All operations are built as instruction arrays that callers compose into transactions, following Solana's composability model.

## Key Files

- `src/sdk.ts` — primary Anchor program interaction layer
- `src/onlineSdk.ts` — RPC fetch patterns and multi-account queries
- `src/pda.ts` — PDA derivation using `PublicKey.findProgramAddressSync`
- `src/idl/pump.ts` — Pump program IDL (Anchor format)
- `src/idl/pump_amm.ts` — PumpAMM program IDL
- `src/idl/pump_fees.ts` — PumpFees program IDL
- `src/state.ts` — on-chain account state interfaces
- `package.json` — `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token` dependencies

## Key Concepts

### Anchor Program Initialization

Programs are initialized with Anchor's `Program` class using IDLs:

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Pump } from './idl/pump';

function getPumpProgram(connection: Connection): Program<Pump> {
    const provider = new AnchorProvider(
        connection,
        { publicKey: PublicKey.default, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
        { commitment: 'confirmed' }
    );
    return new Program(pumpIdl as Pump, PUMP_PROGRAM_ID, provider);
}
```

**Offline pattern:** The SDK uses a dummy provider (no wallet) for building instructions. The actual signing happens in the caller's code.

### Instruction Building with Anchor

```typescript
// Anchor method builder pattern
const instruction = await program.methods
    .buy(amount, maxSolCost)
    .accountsStrict({
        global: GLOBAL_PDA,
        feeRecipient: feeRecipient,
        mint: mint,
        bondingCurve: bondingCurvePda(mint),
        associatedBondingCurve: getAssociatedTokenAddressSync(mint, bondingCurvePda(mint), true),
        associatedUser: getAssociatedTokenAddressSync(mint, user),
        user: user,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
        program: PUMP_PROGRAM_ID,
    })
    .instruction();
```

### PDA Derivation

Standard pattern using `findProgramAddressSync`:

```typescript
const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID
);
```

**Conventions in this project:**
- Global singletons: pre-computed as constants (e.g., `GLOBAL_PDA`)
- Per-entity PDAs: computed via functions (e.g., `bondingCurvePda(mint)`)
- Event authorities: `["__event_authority"]` (Anchor convention)

### Associated Token Accounts (ATAs)

```typescript
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';

// Derive ATA address
const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    true,                // allowOwnerOffCurve (for PDAs)
    tokenProgram         // TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID
);

// Create ATA if needed (idempotent = no-op if exists)
const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    payer,
    ata,
    owner,
    mint,
    tokenProgram
);
```

### Token-2022 Support

The SDK supports both token programs:

```typescript
// Default to standard SPL Token
const tokenProgram = tokenProgramId ?? TOKEN_PROGRAM_ID;

// Token-2022 uses the same ATA derivation but different program
const ata = getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID);
```

`createV2Instruction` uses Token-2022 by default, while legacy `createInstruction` uses SPL Token.

### Account Decoding (Anchor Coder)

```typescript
// Decode raw AccountInfo buffer using Anchor's coder
decodeBondingCurve(accountInfo: AccountInfo<Buffer>): BondingCurve {
    return this.pumpProgram.coder.accounts.decode<BondingCurve>(
        'bondingCurve',
        accountInfo.data
    );
}
```

Nullable variants handle missing accounts:
```typescript
decodeBondingCurveNullable(accountInfo: AccountInfo<Buffer> | null): BondingCurve | null {
    if (!accountInfo || accountInfo.data.length < 82) return null;
    return this.decodeBondingCurve(accountInfo);
}
```

### RPC Batching

Use `getMultipleAccountsInfo` to fetch multiple accounts in a single RPC call:

```typescript
const accounts = await this.connection.getMultipleAccountsInfo([
    bondingCurvePda(mint),
    getAssociatedTokenAddressSync(mint, user, false, tokenProgram),
]);
const [bondingCurveAccount, userAtaAccount] = accounts;
```

### Transaction Simulation

Read-only queries via simulated transactions:

```typescript
const tx = new Transaction().add(ix);
tx.feePayer = simulationSigner;
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

const result = await connection.simulateTransaction(tx);
// Parse return data from result.value.returnData
```

### Remaining Accounts Pattern

Anchor's `remainingAccounts` for variable-length account lists:

```typescript
const instruction = await program.methods
    .sell(amount, minSolOutput)
    .accountsStrict({ ... })
    .remainingAccounts([
        { pubkey: userVolumeAccumulatorPda(user), isWritable: true, isSigner: false },
    ])
    .instruction();
```

### Instruction Composition

All methods return `TransactionInstruction[]`, enabling flexible composition:

```typescript
const instructions = [
    ...createAtaInstructions,
    ...extendAccountInstructions,
    buyInstruction,
];
// Caller composes into Transaction with their own fee payer and signer
```

### Connection Configuration

```typescript
const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"  // commitment level
);
```

### BN.js Arithmetic

All on-chain numeric values use `BN` from `bn.js`:

```typescript
import BN from 'bn.js';

const solAmount = new BN(0.1 * 10 ** 9);  // 0.1 SOL in lamports
const tokenAmount = new BN("1000000000000000");  // 1B tokens with 6 decimals

// Arithmetic
const result = solAmount.mul(tokenReserves).div(solReserves.add(solAmount));

// Comparison
if (amount.gt(new BN(0))) { ... }
if (reserves.isZero()) { ... }
```

## Patterns to Follow

- Always use `accountsStrict` (not `accounts`) for explicit account specification
- Return `TransactionInstruction[]` from instruction builders — never build full `Transaction` objects
- Use `getMultipleAccountsInfo` to batch account fetches (max ~100 accounts per call)
- Handle `null` account info gracefully — accounts may not exist yet
- Use `createAssociatedTokenAccountIdempotentInstruction` — safe to call even if ATA exists
- Set `allowOwnerOffCurve: true` when deriving ATAs for PDA owners
- Use Anchor's coder for account deserialization — never parse buffers manually
- Keep instruction building offline (no RPC calls) in the base SDK
- Use `BN` for all numeric values — JavaScript `number` loses precision above 2^53

## Common Pitfalls

- `PublicKey.default` is `11111111111111111111111111111111` (system program) — not a zero address
- ATA derivation requires the token program ID — using the wrong one produces different addresses
- `accountsStrict` requires ALL accounts to be specified — missing one triggers a runtime error
- Token-2022 ATAs are different from SPL Token ATAs for the same mint/owner pair
- `getMultipleAccountsInfo` returns `null` for non-existent accounts — always check before decoding
- Anchor's `instruction()` method is async — don't forget `await`
- `BN` division truncates (floor division) — use ceiling division for fee calculations
- Commitment levels matter: `confirmed` vs `finalized` affects account state freshness
