# Claim decoders: which copy is canonical

There are four copies of the PumpFun claim decoder in this repo. They have
drifted, and the drift is silent: a stale decoder does not crash, it just stops
reporting claims it no longer recognizes. This file says which copy wins and what
to do when you need one.

## The decision (2026-08-01)

**`pumpkit/packages/allclaims/src/claim-monitor.ts` is canonical.** Copy from it.

Nothing was refactored into a shared package. That was considered and rejected:
`@pumpkit/core` is consumed by seven packages, two of which are live feeds, and a
shared-decoder refactor would put both at risk to fix a problem that a written
rule plus a test fixes for free. Extracting a shared decoder is still the right
long-term move; it is just not worth doing under two running bots.

### Ranking, newest to stalest

| Copy | State |
|---|---|
| `pumpkit/packages/allclaims/src/claim-monitor.ts` | **Canonical.** Two-path log filter, V2 layouts, quote-mint claims, fake social-claim detection. |
| `channel-bot/src/claim-monitor.ts` | Current as of 2026-08-01. Two-path filter back-ported from the canonical copy; covered by `src/__tests__/claim-logs.test.ts`. |
| `pumpkit/packages/channel/src/claim-monitor.ts` | **Stale (March snapshot).** Do not copy from it. |
| `pumpkit/packages/core/src/monitor/ClaimMonitor.ts` | **Stalest.** No social-fee handling at all. Do not copy from it. |

## The trap this exists to prevent

A claim monitor in WebSocket mode uses the log lines to decide which signatures
are worth a `getParsedTransaction`. Get that filter wrong and the claim is dropped
before anything else in the pipeline ever sees it. There are **two** signals, and
both are required:

1. **Anchor `Program log: Instruction:` lines.** `claim_social_fee_pda` does not
   emit a CPI event at all (it returns a `SocialFeePdaClaimed` struct), so for
   fake claims the instruction log line is the only trace that exists.
2. **Claim event discriminators on `Program data:` lines.** Creator fee claims do
   emit events and carry no social instruction log.

A filter keyed only on `ClaimSocialFeePda` therefore discards **every pure
creator-fee claim**, which is most of the stream. Measured on the live feed after
the fix, creator-fee claims are roughly 90% of detections:
`collect_creator_fee=41, collect_coin_creator_fee=15, distribute_creator_fees=5,
transfer_creator_fees_to_pump=4` against a handful of social claims.

Cashback is deliberately **excluded** from the fetch filter. It is a user refund
rather than creator activity, and it is the single highest-volume claim on chain,
so fetching it only to discard it downstream saturates the RPC queue and starves
real claims.

## If you are adding a bot

Copy `claim-monitor.ts` from the canonical copy above, and copy its test with it.
`channel-bot/src/__tests__/claim-logs.test.ts` derives its expectations from the
`CLAIM_INSTRUCTIONS` table rather than hardcoding discriminators, so a new claim
layout added to that table is automatically asserted against the filter. That is
the cheap version of the refactor: the table is the single source of truth even
though the decoder is duplicated.

## The transport has the same rule (added 2026-09-09)

The decoder only ever sees what the transport delivers, so the WebSocket layer
of `claim-monitor.ts` propagates the same way: canonical copy first, then
`channel-bot`. Both now refuse an endpoint that does not deliver a real log event
within 20 seconds and walk to the next one in `SOLANA_WS_URLS`.

That rule exists because a subscription cannot fail loudly. web3.js returns a
subscription id immediately and retries the socket internally, so an endpoint
answering `401` on the upgrade is indistinguishable from a healthy one: when
`rpc.magicblock.app` went key-gated on 2026-09-09, the all-claims feed reported
`mode: websocket` while detecting zero claims for four days. `channel-bot`'s
`event-monitor.ts` carries the same rotation, since that is the transport its
live feed actually runs on.

## If you are fixing a decoder bug

Fix it in the canonical copy first, then propagate to `channel-bot`, then update
this file's date. Leaving `pumpkit/packages/{core,channel}` stale is fine and
intentional; they are not deployed. If you ever put one of them back into service,
sync it from the canonical copy before you do, not after.
