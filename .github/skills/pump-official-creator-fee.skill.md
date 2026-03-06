---
applyTo: "**"
---
# Pump Creator Fee — Official Documentation

## Skill Description

Reference the official Pump creator fee documentation when implementing creator fee collection, creator vault PDAs, fee calculation with `creator_fee_basis_points`, or extending BondingCurve accounts for creator fee support.

## When to Use

- Implementing or modifying creator fee collection logic
- Working with `creator_vault` PDA derivation
- Extending BondingCurve accounts to support creator fees (`dataLen < 150`)
- Implementing `collectCreatorFee` instruction
- Setting the `BondingCurve::creator` field via `set_creator` or `set_metaplex_creator`
- Computing fees that include `Global::creator_fee_basis_points`

## Official Documentation

Read `docs/pump-official/PUMP_CREATOR_FEE_README.md` for the full specification.

## Key Concepts

### BondingCurve Extension

BondingCurve accounts must be extended to `150` bytes to support creator fees. Prepend `extendAccount(bondingCurve)` if `bondingCurveAccountInfo.dataLen < 150`.

### Creator Vault PDA

```rust
#[account(
    mut,
    seeds = [b"creator-vault", bonding_curve.creator.as_ref()],
    bump
)]
pub creator_vault: AccountInfo<'info>,
```

- Derives from `bonding_curve.creator`, NOT the user/signer
- Used at Buy instruction index `10` (replaces previously unused `rent` account)
- Used at Sell instruction index `8` (replaces previously unused `associated_token_program`)

### BondingCurve State (with creator)

```rust
pub struct BondingCurve {
    pub virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub token_total_supply: u64,
    pub complete: bool,
    pub creator: Pubkey,        // creator who receives fees
    pub is_mayhem_mode: bool,   // determines fee recipient
}
```

### Global State (with creator fee bps)

```rust
pub struct Global {
    pub fee_basis_points: u64,
    pub creator_fee_basis_points: u64,  // used for creator fee computation
    pub fee_recipients: [Pubkey; 7],
    pub set_creator_authority: Pubkey,
    // ... other fields
}
```

### Creator Source Priority

1. `creator` argument in `create` / `create_v2` instruction
2. Metaplex creator metadata via `set_metaplex_creator` instruction
3. Backend `set_creator` admin instruction for legacy coins

### Collecting Fees

Use `collectCreatorFee(creator)` instruction — the `creator` must sign the transaction.

## Critical Rules

1. **Creator vault PDA derives from `bonding_curve.creator`**, not the user
2. **`extendAccount` must precede buy/sell** if `bondingCurveAccountInfo.dataLen < 150`
3. **Creator fee is separate from protocol fee** — both are charged on every trade
4. **Be careful with the `creator` arg in `create`** — that pubkey receives ALL creator fees
