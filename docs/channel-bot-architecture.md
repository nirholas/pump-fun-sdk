# GitHub Claims feed architecture

The product is [Pump.fun GitHub Claims](https://t.me/pumpfunclaims): first-time
reward claims for GitHub-linked coins, enriched with market data, developer
history and socials. Its dedicated home is
[nirholas/pumpfun-github-claims](https://github.com/nirholas/pumpfun-github-claims).

Read the [product contract](github-claims-product.md) first. It defines one alert
per **numeric GitHub user ID and full mint address**. Previous claims on other
coins provide context and must not suppress a first claim on a new coin.
Repeated claims for the same pair stay out. A developer need not launch the coin
or put its CA in GitHub.

## Existing components

| Component | Responsibility |
| --- | --- |
| `channel-bot/src/claim-monitor.ts` | Fetch and decode successful PumpFees claims; extract GitHub identity, PDA, recipient and quote-aware payment fields |
| `claim-backstop.ts` | Recover claim candidates from verifier signature history alongside websocket detection |
| `social-fee-index.ts` | Map fee recipients to potentially multiple delegated token mints |
| `first-claim.ts` | Current PDA-level lifetime classification; not sufficient for coin-specific eligibility |
| `claim-tracker.ts` | Local persisted observations, including GitHub-user/mint keys |
| `index.ts` | Classification, bounded enrichment and delivery orchestration |
| `pump-client.ts`, `github-client.ts`, `x-client.ts` | Market, repository, developer and social context |
| `formatters.ts` | Telegram cards |
| `channel-policy.ts`, `config.ts` | Feed isolation at configuration and send boundaries |
| `delivery.ts`, `watchdog.ts` | Delivery health, failure reporting and transport monitoring |
| `event-store.ts`, `health.ts`, `webhooks.ts` | Recent events, health, read-only API/SSE and optional webhook delivery |

## Current runtime versus intended behavior

The runtime currently rejects prior claims using the **shared PDA lifetime**
before resolving a token. It then selects the highest-market-cap linked token
and applies a local user–mint guard. This can miss a developer's first claim on
a different coin, and the selected mint is not proven by the withdrawal event.

The intended flow is:

```text
Successful GitHub claim transaction
    → payment evidence and stable GitHub identity
    → evidence-backed coin attribution (or unresolved record)
    → durable first-claim check for the developer–mint pair
    → bounded market/project/social enrichment and developer history
    → pending delivery → channel card → delivered state
```

A token delegated to a shared fee account is a candidate, not proof of a payment
from that coin. Do not mark all candidates claimed, or treat a new market-cap
leader as a newly claimed coin. Developer-wide lifetime status is separate
context. Partial history must remain explicit.

## Delivery and migration

Keep the existing claims and graduations services separate. The legacy
`github-first-claims` profile name remains for configuration compatibility.
Publishing the standalone source does not deploy it, change Telegram tokens,
transfer channel ownership or migrate historical records.

The implementation needs durable pair-level claim history, attribution evidence
and a retryable outbox. Preserve those records during cutover and run only one
publisher for the channel. The existing audit script classifies PDA-wide first
claims; it cannot prove there were no missed first claims on other coins.

## Verification

Run `npm run typecheck`, `npm test` and `npm run build` in `channel-bot/` for
local validation. These validate the current implementation, not completion of
the new attribution contract. The product contract lists the required per-coin,
history, replay and delivery scenarios. Read [DECODERS.md](../DECODERS.md) before
changing binary event parsing; the standalone extraction records its source
revision and must document future decoder divergence.
