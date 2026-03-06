---
applyTo: "**"
---
# Pump FAQ & CU Optimization — Official Documentation

## Skill Description

Reference the official Pump FAQ when optimizing compute unit (CU) limits for buy/sell transactions, understanding PDA bump seed effects on compute usage, or troubleshooting transaction performance.

## When to Use

- Setting compute unit limits on buy/sell transactions
- Optimizing transaction performance
- Understanding why CU usage varies between different mints
- Deciding whether to simulate transactions before submission
- Debugging compute budget exceeded errors

## Official Documentation

Read `docs/pump-official/FAQ.md` for the full specification.

## CU Optimization for Buy/Sell

### Why CU Usage Varies

Each buy/sell instruction's CU cost depends on:

1. **`user` pubkey** — affects `associated_user` PDA bump seed derivation
2. **`mint` pubkey** — affects `bonding_curve`, `associated_bonding_curve`, `associated_user` PDA derivations
3. **`creator` pubkey** — affects `creator_vault` PDA bump seed derivation
4. **`amount` and `max_sol_cost`** (buy) — larger values consume more CUs to log
5. **`amount` and `min_sol_output`** (sell) — similar effect

### PDA Bump Seed Example

```rust
// Mint with bump = 255 (fewer iterations to find PDA)
let mint = Pubkey::from_str("Coyj3LtKn1BNSgWc9HsGK5SKoGfEoDaymig4wrN6pump").unwrap();
assert_eq!(
    Pubkey::find_program_address(&[b"bonding-curve", mint.as_ref()], &pump::ID).1,
    255
);

// Mint with bump = 251 (more iterations to find PDA)
let mint = Pubkey::from_str("3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump").unwrap();
assert_eq!(
    Pubkey::find_program_address(&[b"bonding-curve", mint.as_ref()], &pump::ID).1,
    251
);
```

Lower bump seeds = more CU usage (more iterations in `find_program_address`).

### Recommendation

**Do NOT simulate before buy/sell** — simulation slows down submission and increases slippage risk.

**Use a static CU limit of `100_000`** — this is large enough for all buy/sell operations, including edge cases where the bonding curve completes on that buy.

```typescript
import { ComputeBudgetProgram } from "@solana/web3.js";

const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
  units: 100_000,
});

// Prepend to your transaction instructions
const instructions = [computeUnitIx, ...buyOrSellInstructions];
```

## Critical Rules

1. **Never simulate buy/sell just for CU estimation** — use static `100_000`
2. **CU usage is not deterministic per mint** — it depends on PDA bump seeds
3. **Bonding curve completion on buy** uses extra CU — the static limit accounts for this
4. **Add a 1% buffer** if you must simulate for other reasons
