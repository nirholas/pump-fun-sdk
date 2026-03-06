---
applyTo: "**"
---
# PumpSwap Creator Fee — Official Documentation

## Skill Description

Reference the official PumpSwap creator fee documentation when implementing creator fee collection on AMM pools, `coin_creator_vault_authority` PDAs, Pool account extensions, or determining canonical Pump pools.

## When to Use

- Implementing or modifying AMM creator fee collection
- Working with `coin_creator_vault_authority` PDA derivation
- Extending Pool accounts for creator fees (`dataLen < 300`)
- Determining if a pool is a canonical Pump pool
- Implementing `collectCoinCreatorFee` instruction
- Adding `coin_creator_vault_ata` and `coin_creator_vault_authority` accounts to AMM buy/sell

## Official Documentation

Read `docs/pump-official/PUMP_SWAP_CREATOR_FEE_README.md` for the full specification.

## Key Concepts

### Canonical Pump Pool Detection

A canonical Pump pool is one whose `pool.creator` matches the PDA:

```rust
pub fn pump_pool_authority_pda(base_mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"pool-authority", base_mint.as_ref()],
        &PUMP_PROGRAM_ID,  // 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
    ).0
}
```

Only canonical pools (created by Pump `migrate` instruction) receive coin creator fees.

### Pool Extension

Pool accounts must be extended to `300` bytes. Prepend `extendAccount(pool)` if `pool.dataLen < 300`.

### New Buy/Sell Accounts (Indexes 17-18)

```rust
// Index 17: WSOL ATA of the coin_creator_vault_authority
#[account(
    mut,
    associated_token::mint = quote_mint,
    associated_token::authority = coin_creator_vault_authority,
    associated_token::token_program = quote_token_program,
)]
pub coin_creator_vault_ata: InterfaceAccount<'info, TokenAccount>,

// Index 18: PDA authority for the vault
#[account(
    seeds = [b"creator_vault", pool.coin_creator.as_ref()],
    bump
)]
pub coin_creator_vault_authority: AccountInfo<'info>,
```

### Pool State (with coin_creator)

```rust
pub struct Pool {
    pub pool_bump: u8,
    pub index: u16,
    pub creator: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub lp_mint: Pubkey,
    pub pool_base_token_account: Pubkey,
    pub pool_quote_token_account: Pubkey,
    pub lp_supply: u64,
    pub coin_creator: Pubkey,  // set for canonical pools, Pubkey::default() otherwise
}
```

### GlobalConfig (with coin creator fee bps)

```rust
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub lp_fee_basis_points: u64,
    pub protocol_fee_basis_points: u64,
    pub disable_flags: u8,
    pub protocol_fee_recipients: [Pubkey; 8],
    pub coin_creator_fee_basis_points: u64,  // creator fee rate
}
```

### Coin Creator Source

1. `coin_creator` arg in `create_pool` for new canonical pools
2. Metaplex creator metadata or `BondingCurve::creator` via `set_creator` instruction
3. Backend auto-populates for canonical pools with missing creators

### Collecting Fees

Use `PumpAmmSdk.collectCoinCreatorFee(coinCreator)` — the `coinCreator` must sign.

## Critical Rules

1. **`extendAccount(pool)` must precede buy/sell** if `pool.dataLen < 300`
2. **AMM buy/sell need 2 extra accounts** at indexes 17-18 for creator vault
3. **Creator vault authority PDA** uses seed `["creator_vault", pool.coin_creator]`
4. **Only canonical Pump pools get creator fees** — check `pool.creator` matches `pump_pool_authority_pda(baseMint)`
5. **Fees accumulate in WSOL** in the creator vault ATA
