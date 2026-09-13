# Pump.fun GitHub Claims

**First-time fee claims for GitHub-linked coins.** A read-only feed that helps
traders discover when a developer starts collecting trading-fee rewards, with
price, market cap, developer history, project information and socials.

- Channel: [PumpFun Tracker [Github Claims] 🛠️ 💊🟢](https://t.me/pumpfunclaims)
- Dedicated repository: [nirholas/pumpfun-github-claims](https://github.com/nirholas/pumpfun-github-claims)
- Suggestions: [@nichxbt](https://t.me/nichxbt)
- Related bots: [@pfclaimsbot](https://t.me/pfclaimsbot), [@cryptocurrencyvisionbot](https://t.me/cryptocurrencyvisionbot)
- Related graduation channel: [@migratedpumpfun](https://t.me/migratedpumpfun)

These are public community links. They do not identify the bot token or service
currently delivering a particular feed. More channels are planned.

## Why the feed exists

Someone can discover a developer's project, launch a Pump.fun coin around it,
and delegate trading-fee rewards to the developer's GitHub identity. The
developer can then collect those rewards. The developer need not have launched
the token, and its contract address (CA) need not appear in the GitHub repository.

The claim is the signal: the developer showed up to collect. Delivering that
event promptly lets traders investigate the project and developer before the
claim becomes widely noticed. Repository activity, reputation, account age,
socials and previous claimed coins give context. A claim does not settle which
coin the developer will continue supporting; that is a separate, ongoing choice.

## The notification rule

**Notify once for each developer–coin pair**, keyed by stable numeric GitHub
user ID and full Solana mint address. Symbols and repository names are not keys.

| Event | Channel behavior |
| --- | --- |
| Developer first claims rewards attributable to coin A | Notify |
| Same developer claims coin A again | Suppress |
| Same developer first claims a different coin B | Notify; show previous claimed coins |
| Coin B has the same name, symbol or repository as A, but a different CA | Treat it as a different coin |
| Another developer first claims the same coin | Treat it as a different developer–coin pair |
| A token merely delegates fees to the developer | No claim notification |
| An instruction fails or pays no rewards | No claim notification |
| A pooled claim cannot be attributed to a coin | Retain the unresolved event; do not invent a coin-specific first claim |

A developer's prior claims on other coins **must not disqualify** their first
claim on a new coin. Repeated claims on the same coin must not generate more
alerts. Changing a wallet, GitHub username, quote currency or market-cap ranking
does not reset that pair's history.

Use **“First claim for this coin”** for the per-pair event. Add **“Developer's
first-ever GitHub reward claim”** only when complete evidence establishes that
separate fact. Otherwise show the known previous coins or state that the earlier
history is incomplete. A locally observed count is not a lifetime claim count.

## Example: three.ws and THREE

As described by the project owner, @nichxbt announced development of
`nirholas/three.ws` on X. Someone else launched THREE at
`FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump` and delegated rewards to the
developer. The developer collected rewards and chose to support that coin as
the main coin for three.ws, despite having more than 50 coins linked to their
GitHub identity.

The first attributable claim for that THREE should trigger an alert. Subsequent
claims for it should not. A first claim for a pumpfun-sdk coin or another THREE
with a different CA should trigger its own alert and include the developer's
previous claim history. This is a product example supplied by the owner, not
an independently reconstructed transaction history or an exclusive commitment.

## What must be established

Keep four facts separate in storage and presentation:

1. **Delegation:** a token's fee configuration names a GitHub social-fee account
   as a recipient. This establishes a fee link, not a claim.
2. **Payment:** a successful claim identifies the GitHub numeric ID, fee PDA,
   receiving wallet, amount, quote asset and transaction.
3. **Coin attribution:** evidence connects the payment to a particular mint.
   A social-fee withdrawal can pool rewards from several coins; the withdrawal
   event alone has no repository or token-mint field.
4. **Developer support:** statements or actions identify a coin the developer
   chooses to support. Fee delegation and metadata alone do not establish that.

Never derive coin attribution from the highest market cap, a token name, a
GitHub URL, or the mere presence of a coin in a fee PDA's linked-token list.
Do not issue an alert for every linked coin when one pooled withdrawal occurs.
A later change in the list or ranking must not create a fictitious new claim.
Persist the attribution evidence and its transaction/slot provenance so a
reviewer can reproduce the decision. If sufficient evidence is unavailable,
keep the attribution unresolved until it can be established.

PDA lifetime counters describe the shared account's claim history. They can
help describe developer history, but cannot establish a first claim for a
particular coin or veto an experienced developer's new-coin claim.

## What a card should show

- The full CA, name, symbol and first-claim status for the developer–coin pair.
- Claim transaction, timestamp, recipient, amount and correctly identified
  quote currency. A pooled withdrawal total must be labeled as such.
- GitHub identity, account age, project/repository information, activity and
  socials. Use **“Linked repository”** for a repository obtained from metadata.
- Previously claimed coins, with full links and a clear history coverage limit.
- Price, market cap, graduation status, liquidity and timestamps where available.
- Context such as a GitHub-owner mismatch, a new account, or same-name tokens.
  These observations provide context; they are not proof of impersonation or
  developer endorsement. Organization repositories may have individual claimers.

Missing enrichment must not erase a verified claim. Perform slow API enrichment
with bounded concurrency and deadlines. Keep discovery and delivery state
separate, persist pending deliveries, and retry the same event on send failure.
Replays, restarts and concurrent workers must not create duplicate pair alerts.

## Implementation status — September 13, 2026

This document is the agreed product contract. The existing `channel-bot/`
implementation does **not yet implement the complete per-coin rule**:

| Current behavior | Required correction |
| --- | --- |
| `first-claim.ts` rejects prior PDA lifetime claims before mint resolution | Separate developer history from per-pair eligibility |
| `index.ts` picks the highest-market-cap linked mint | Establish coin attribution from evidence before per-pair deduplication |
| `claim-tracker.ts` has user–mint keys, populated from that inferred mint | Persist verified per-pair history and explicit coverage/provenance |
| `formatters.ts` labels metadata as “Repo Claimed” | Use “Linked repository”; separate it from the claiming GitHub identity |
| `pump-client.ts` uses raw curve-reserve ratios as SOL prices after graduation | Normalize decimals and use a current, quote-aware AMM price |
| `social-fee-index.ts` only adds shareholder mappings on updates | Replace superseded mappings; preserve historical evidence separately |
| Delivery and history are not a durable, atomic outbox | Prevent losses and duplicates across retries, restarts and workers |

Simply removing the lifetime gate would retain incorrect attribution and could
produce misleading new-coin alerts. Attribution and history migration must be
resolved together. The dedicated repository starts with the existing source,
tests and this contract; its initial extraction is not a production cutover.

## Acceptance scenarios for the implementation

Before deploying the per-coin behavior, verify first A → notify, repeat A →
suppress, first B by the same developer → notify with A in history; also test
same-name/different-CA coins, another developer on A, wallet/username/currency
changes, unresolved pooled withdrawals, stale delegation mappings, missing
historical coverage, duplicate log delivery, concurrent workers, restart and
failed Telegram delivery. Include a real attributed multi-coin claim fixture;
a synthetic mint chosen by market cap cannot prove this requirement.
