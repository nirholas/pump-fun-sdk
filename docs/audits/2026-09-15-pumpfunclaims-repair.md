# @pumpfunclaims production audit and repair — 2026-09-15

## Executive result

The Telegram channel was live, but its former mint-selection rule could publish
the wrong coin. The feed treated every mint currently sharing a GitHub social
fee PDA as a candidate, fetched market data, and selected the highest-market-cap
candidate. Market cap is not transaction evidence.

The repaired pipeline uses `DistributeCreatorFeesEvent` records from the same
transaction. Each such event names the mint and sharing config and lists the
recipient PDA with its share. A social withdrawal is published only when one of
those transaction distributions paid the exact social fee PDA being claimed.
Several evidenced mints in one transaction become independent developer–coin
pair events. A withdrawal without that evidence is retained as unresolved in
the event/API stream and is not turned into a trading alert.

## Incident evidence

Transaction:
`2pm12CDG5c6HxW9Mf6M1RAUd1fpNk9chaGFVDqao9Hhc7kfAEFzRCUVuzKiUrDszP8FNBRECjnNmcuwv5z9Z35kc`

- The live channel presented `8XTUnXmSRP42ZVf4MyDVxAEQ6djzUpqXzywob6mLpump`
  (`BRAIN`) because it ranked highest among seven linked candidates.
- The transaction's `DistributeCreatorFeesEvent` names
  `BfLgqS6vhUpAqTW5EofEB34xeo6KbBXdqRMDXbUepump`.
- It names sharing config `CPhXwTACStFdLakRKRHsoMad7ii2RoDXG9kxwSdsh78T`.
- It assigns 10,000 bps of 11,286,771,447 raw quote units to social fee PDA
  `GVZwypRf6VEs65p3dbbAW1dbJmjjiaTqVQam6aAeCzPc`.
- The subsequent claim instruction withdraws that PDA. This is reproducible
  transaction-level attribution; BRAIN was not the mint named by the event.

The regression fixture is committed in
`channel-bot/src/__tests__/transaction-attribution.test.ts`.

## Recent-chain validation

Seven recent channel transactions were replayed through the repaired decoder.
Six contained an exact same-transaction mint/PDA distribution and resolved to:

1. `EkTvqvdFyjrtX1zkd367qk1LEWmjpunosoKFRGH8u9sj`
2. `FmUJ5iMeictH8AHWjequ1F9vx2N5AigyipVpmc9Jpump`
3. `BfLgqS6vhUpAqTW5EofEB34xeo6KbBXdqRMDXbUepump` (formerly misreported as BRAIN)
4. `Hixq4pFDVmbwE6xSCXc5ys4p2ZfdN7bX6RTdpcnSpump`
5. `5JVpouztbAiwFc8ZEQ4RZjR2E6hv6CiSFAH3uSLVpump`
6. `Bns3hzz5jJTmGxNWrb7TmAxEhiSvN72NvxA1vg9Fpump`

The V2 withdrawal
`3MG4AnqKcYXxM9Fi5yJW5wDtsut9FeymXKu9ZbKbG2cuMA6fUb9A2vH1GPbNuJMxFJRhrrnrSsAVUjAL2eWAooDq`
contained no matching distribution event. It therefore remains unresolved and
will not be assigned a CA by market cap.

## Repairs

- Decode transaction distributions independently of the top-level instruction
  currently being classified.
- Match the event's shareholder address to the claimed social fee PDA.
- Preserve raw amounts as decimal strings; use bigint for share calculation.
- Expand one transaction into one event per evidenced mint.
- Stop using the shared-PDA lifetime counters as a pair-eligibility gate.
- Use persisted numeric-GitHub-ID/full-mint pairs for duplicate suppression.
- Migrate legacy pair keys that were mixed into `github-first-claims.json`.
- Atomically persist claim state with write-then-rename and mode `0600`.
- Replace removed shareholders in the live fee-share index instead of retaining
  stale PDA→mint candidates forever.
- Add a durable, unique delivery outbox. Failed posts survive restarts and are
  replayed after Telegram channel access is verified.
- Correct reserve-unit price normalization (Pump tokens use six decimals while
  SOL uses nine) and refresh graduated-token price/market cap from DexScreener.
- Mark every lower crossed performance milestone when a higher one is posted,
  preventing the observed `5x` followed by `2x` sequence.

## Delivery semantics

The outbox provides durable at-least-once delivery and process-level duplicate
suppression. Telegram's Bot API has no caller-supplied idempotency key. A process
that dies after Telegram accepts a post but before the local acknowledgement is
persisted can replay that post. The transaction link makes such a duplicate
detectable, but exactly-once delivery would require an external reconciliation
source or a Telegram interface that exposes channel history/idempotency.

## History coverage

Pair history proves only the coverage that has been imported into the persisted
volume. Cards therefore say “first claim observed … within persisted history
coverage,” never “first-ever,” unless a separate complete backfill proves it.
PDA lifetime totals remain developer-wide context and never decide whether a
different coin is new.

Before a production cutover, preserve and migrate:

- `github-first-claims.json`
- `github-user-token-claims.json`
- `github-claim-counts.json`
- `delivery-outbox.json`
- `performance-tracker.json`

Run only one publisher during migration.

## Repository scope

| Repository | Role in this repair |
| --- | --- |
| `nirholas/pump-fun-sdk` | Production `channel-bot` source and canonical protocol IDLs |
| `nirholas/pumpfun-github-claims` | Focused standalone mirror; must receive the same repaired runtime |
| `nirholas/pumpfun-claims-bot` | General/legacy service; not the canonical production claims source |
| `nirholas/pumpkit` | Framework copies; decoder drift should be tracked separately |
| `pumpfun-creator-rewards` | Reference for distribution-timeline/per-coin accounting |
| Remaining pump-named repositories | SDKs, MCP, workers, skills, or wallet UI; not channel publishers |

## Verification gate

The channel-bot change is ready only when all of these pass:

```bash
cd channel-bot
npm run typecheck
npm test
npm run build
docker build .
```

Production readiness additionally requires `npm run doctor -- --env
.env.claims`, a preserved data volume, successful channel-access preflight, and
observation of a real attributed claim without starting a second publisher.
