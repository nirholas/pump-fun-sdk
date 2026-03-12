# PumpSwap (Pump AMM) program

PumpSwap program is a constant-product AMM deployed at address `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` on
both [Mainnet](https://solscan.io/account/pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA)
and [Devnet](https://solscan.io/account/pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA?cluster=devnet).

## State

### GlobalConfig

The global configuration of the program is stored in the only `GlobalConfig` account, whose address is
`ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw` (PDA-derived from `["global_config"]` seeds). The content of this account
can be examined
on [Mainnet Solscan](https://solscan.io/account/ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw#accountData):

```json
{
  "admin": {
    "type": "pubkey",
    "data": "FFWtrEQ4B4PKQoVuHYzZq8FabGkVatYzDpEVHsK5rrhF"
  },
  "lp_fee_basis_points": {
    "type": "u64",
    "data": "20"
  },
  "protocol_fee_basis_points": {
    "type": "u64",
    "data": "5"
  },
  "disable_flags": {
    "type": "u8",
    "data": 0
  },
  "protocol_fee_recipients": {
    "type": {
      "array": [
        "pubkey",
        8
      ]
    },
    "data": [
      "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV",
      "7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ",
      "7hTckgnGnLQR6sdH7YkqFTAA7VwTfYFaZ6EhEsU3saCX",
      "9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz",
      "AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY",
      "FWsW1xNtWscwNmKv6wVsU1iTzRN6wmmk3MjxRP5tT7hz",
      "G5UZAVbAf46s7cKWoyKu8kYTip9DGTpbLZ2qa9Aq69dP",
      "JCRGumoE9Qi5BBgULTgdgTLjSgkCMSbF62ZZfGs84JeU"
    ]
  }
}
```

- The `admin` pubkey is the pubkey authorized to update the `GlobalConfig` account.
- The `lp_fee_basis_points == 20 bps` and `protocol_fee_basis_points == 5 bps` are the fees charged by the AMM for each
  `buy` / `sell` instruction. No fees are charged on `deposit` / `withdraw` instruction.
- The `disable_flags` is a bitmask that can be used to disable certain instructions. Currently, it is not used.
- The `protocol_fee_recipients` is an array of 8 pubkeys which receive the protocol fees on each `buy` /
  `sell` instruction. Any of the 8 pubkeys can be used in a `buy` / `sell` instruction and it is recommended to randomly
  choose a different one for each `buy` / `sell` instruction to improve program tx throughput.

### Pool

Each pool is represented by a `Pool` account, which is PDA-derived from the
`["pool", index, creator, baseMint, quoteMint]` seeds. An example Pool account data can be found
at https://solscan.io/account/GseMAnNDvntR5uFePZ51yZBXzNSn7GdFPkfHwfr6d77J#accountData:

```json
{
  "pool_bump": {
    "type": "u8",
    "data": 254
  },
  "index": {
    "type": "u16",
    "data": "0"
  },
  "creator": {
    "type": "pubkey",
    "data": "9XDYTfQKwW8sHPqnFdUreMmtmffmkHVPGTNV2e3LKxNW"
  },
  "base_mint": {
    "type": "pubkey",
    "data": "7LSsEoJGhLeZzGvDofTdNg7M3JttxQqGWNLo6vWMpump"
  },
  "quote_mint": {
    "type": "pubkey",
    "data": "So11111111111111111111111111111111111111112"
  },
  "lp_mint": {
    "type": "pubkey",
    "data": "6dpnPD6UWDw5hbJEuPQwnCCMba1JYwHANKuL6GQ6otAH"
  },
  "pool_base_token_account": {
    "type": "pubkey",
    "data": "5jMpkf4JF4noHftLgNKyPNh6roVfPSGSjuEk3U4eLKRa"
  },
  "pool_quote_token_account": {
    "type": "pubkey",
    "data": "43DVcZR4kQFjh4Xm2i3DcneRxNjZp7HMud8yDrJWrDr8"
  },
  "lp_supply": {
    "type": "u64",
    "data": "4193388284800"
  }
}
```

- The `pool_bump` is the bump seed used to derive the pool PDA.
- The `index` is the index of the pool, which is used to derive the pool PDA. PumpSwap pools created using Pump program
  `migrate` instruction use a `CANONICAL_POOL_INDEX == 0`.
- The `creator` is the pubkey of the pool creator, which is also used to derive the pool PDA.
- The `base_mint` and `quote_mint` are the mint addresses of the base and quote tokens of the pool.
- The `lp_mint` is the mint address of the LP token, which represents liquidity in the pool.
- The `pool_base_token_account` and `pool_quote_token_account` are the token accounts of the pool which hold the base and quote tokens.
- The `lp_supply` is the current supply of the LP token.

## Instructions

It supports the following Anchor program instructions:

- `create_pool(index, creator, baseMint, quoteMint, baseIn, quoteIn)`.
    - This allows creating a new AMM pool for the `(baseMint, quoteMint)` pair.
    - The `poolId` is PDA-derived from the tuple `(index, creator, baseMint, quoteMint)`. The `index` allows the same
      `creator` to create multiple pools for the same `(baseMint, quoteMint)` pair.
    - The `creator` is the pubkey of the pool creator and also the payer for pool creation costs.
    - `baseIn` and `quoteIn` are the initial amounts of `baseMint` and `quoteMint` tokens to be deposited into the pool,
      and they determine the initial pool price.
    - The `creator` also receives some `lpMint` tokens, which represent the initial liquidity of the pool. These
      `lpMint` tokens can be later used to `withdraw` liquidity from the pool.

- Liquidity instructions:
    - `deposit(pool, user, lpTokenOut, maxBaseIn, maxQuoteIn)` allows a `user` to deposit at most `maxBaseIn` and
      `maxQuoteIn` tokens into the `pool` in order to get exactly `lpTokenOut` tokens in return.
    - `withdraw(pool, user, lpTokenIn, minBaseOut, minQuoteOut)` allows a `user` to withdraw at least `minBaseOut` and
      `minQuoteOut` tokens from the `pool` by burning exactly `lpTokenIn` tokens in return.

- Swap instructions:
    - `buy(pool, user, baseOut, maxQuoteIn)` allows a `user` to buy exactly `baseOut` tokens from the `pool` by paying
      at most `maxQuoteIn` tokens.
    - `sell(pool, user, baseIn, minQuoteOut)` allows a `user` to sell exactly `baseIn` tokens to the `pool` to receive
      at least `minQuoteOut` tokens.

- Utility instructions:
    - `extend_account(user, account)` allows any user to extend the data array of a program-owned account (
      `GlobalConfig` or `Pool` account) to allow for future fields to be added to those account types.

- Admin instructions (can be executed only by `GlobalConfig::admin` pubkey):
    - `create_config(hardcoded_admin, global_config)` allows creating the sole `GlobalConfig` account on initial
      PumpSwap program deployment. The `hardcoded_admin` is a hardcoded pubkey into PumpSwap program itself, which is
      allowed to create the `GlobalConfig` account and will initialize `GlobalConfig::admin` to the `hardcoded_admin`
      pubkey.

- Cashback instructions:
    - `claim_cashback(user)` transfers WSOL from the WSOL ATA of the `UserVolumeAccumulator` to the user's WSOL ATA.
      The user's WSOL ATA is expected to exist beforehand.

## Mapping PumpSwap SDK methods to Anchor instructions

- `PumpAmmAdminSdk.createPoolInstructions(index, creator, baseMint, quoteMint, baseIn, quoteIn)` returns a
  `create_pool(index, creator, baseMint, quoteMint, baseIn, quoteIn)` instruction.

- `PumpAmmAdminSdk.depositInstructions(pool, user, lpTokenOut, slippage)` returns a
  `deposit(pool, user, lpTokenOut, maxBaseIn, maxQuoteIn)` instruction, where `maxBaseIn` and `maxQuoteIn` are computed
  using `lpTokenOut`, `slippage` and the current pool balances.

- `PumpAmmAdminSdk.withdrawInstructions(pool, user, lpTokenIn, slippage)` returns a
  `withdraw(pool, user, lpTokenIn, minBaseOut, minQuoteOut)` instruction, where `minBaseOut` and `minQuoteOut` are
  computed using `lpTokenIn`, `slippage` and the current pool balances.

## PumpSwap SDK autocomplete UI helpers

Each Anchor instruction has a set of corresponding autocomplete methods that can be used to autocomplete the UI inputs:

- `PumpAmmSdk.createAutocompleteInitialPoolPrice(initialBase, initialQuote)` is used to display the initial pool price
  based on the initial `base` and `quote` inputs on pool creation.

- `PumpAmmSdk.depositAutocompleteQuoteAndLpTokenFromBase(pool, base, slippage)` is used to autocomplete the
  corresponding `quote` and `lpToken` values in the UI when the `base` input changes on deposit UI.
- `PumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(pool, quote, slippage)` is used to autocomplete the
  corresponding `base` and `lpToken` values in the UI when the `quote` input changes on deposit UI.

- `PumpAmmSdk.swapAutocompleteBaseFromQuote(pool, quote, slippage, swapDirection)` is used to autocomplete the
  corresponding `base` value in the UI when the `quote` input changes on swap UI.
- `PumpAmmSdk.swapAutocompleteQuoteFromBase(pool, base, slippage, swapDirection)` is used to autocomplete the
  corresponding `quote` value in the UI when the `base` input changes on swap UI.
