# Holder rewards coins

This repository tracks the canonical Pump.fun holder-rewards integration.
The full upstream document is maintained at
<https://github.com/pump-fun/pump-public-docs/blob/main/docs/HOLDER_REWARDS_README.md>.

- Pass `holderReward: true` to `createV2Instruction` or
  `createV2AndBuyInstructions`.
- The program replaces the requested creator with `holderRewardsPda(mint)`.
- Trading interfaces do not change. Creator fees accrue for periodic,
  Pump.fun-managed holder distribution; holders do not claim them.
- Holder-reward mode is permanent once selected.
- New cashback launches are deprecated and rejected. Existing cashback coins
  remain tradeable and their accrued rewards remain claimable.
- Use the unified `admin_cto` flow to convert an eligible existing coin.

The checked-in IDLs are the authoritative account and event layouts. Run
`npm run idl:check` to detect upstream drift.
