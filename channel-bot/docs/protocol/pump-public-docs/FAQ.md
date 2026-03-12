# Frequently Asked Questions

## How to optimize buy / sell CU limit?

Each buy / sell instruction used CUs depend on all the inputs of the instruction:

- `user` pubkey, through the `associated_user` PDA bump seed derivation.
- `mint` pubkey, through the `bonding_curve`, `associated_bonding_curve`, `associated_user` PDA bump seed derivation.
- `creator` pubkey, through the `creator_vault` PDA bump seed derivation.
- for buy, the `amount` and `max_sol_cost` inputs are logged as part of instruction execution, so bigger values consume
  more CUs to log than smaller values.
- for sell inputs, it's similar.

The PDA bump seed derivation is the most expensive part of the instruction execution, as it can take up to 256
iterations to find the correct bump seed. The bump seed is deterministic for a given set of seeds, so the same
`(user, mint, creator)` tuple will always result in the same CU cost.

In practice, the CU cost of a buy / sell instruction varies between `20_000` and `80_000` CUs, depending on the
inputs. For most practical purposes, a static CU limit of `100_000` is recommended to avoid failed transactions
due to insufficient CU budget.

## What happens when a bonding curve completes?

When `real_token_reserves == 0` after a buy instruction, the `complete` field is set to `true`. After that:
- No more buys or sells can be executed on the bonding curve
- The `migrate` instruction can be called to move liquidity to PumpSwap AMM
- The `migrate` instruction is permissionless and idempotent

## How do I detect if a token has graduated?

Check the `BondingCurve::complete` field. If `true`, the token has graduated and should be traded on the AMM pool instead.

## What are the fee recipients?

The Pump program has 8 fee recipients (1 in `Global::fee_recipient` + 7 in `Global::fee_recipients`). Any of them
can be used in buy/sell instructions. It is recommended to randomly pick one for each transaction to improve
throughput.

Similarly, PumpSwap has 8 `protocol_fee_recipients` in the `GlobalConfig` account.

## How do I handle mayhem mode coins?

For coins with `is_mayhem_mode == true`, you must pass a Mayhem fee recipient instead of the regular fee recipient.
See the main README for the list of Mayhem fee recipients.
