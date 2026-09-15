# channel-bot: rules for agents

This directory is one codebase deployed as two different Telegram feeds. Read
this before touching config, env files, deploy scripts, or posting paths.

## The two feeds

| Profile | Channel | Chat id | Bot | Cloud Run service | Env file |
|---|---|---|---|---|---|
| `github-first-claims` | [@pumpfunclaims](https://t.me/pumpfunclaims) | `-1003533969743` | @pumpclaimsbot | `pumpfun-claims-bot` | `.env.claims` |
| `graduations` | [@migratedpumpfun](https://t.me/migratedpumpfun) | `-1003818751043` | @pumpgraduatedbot | `pumpfun-channel-bot` | `.env` |

`@trackpumpfun` (`-1003965305979`) is the linked discussion supergroup.
Publish to `@migratedpumpfun`; Telegram forwards channel posts into the group.
Posting directly into the group does not populate the channel.

`FEED_PROFILE` is the switch. One word selects the whole feed; the individual
`FEED_*` toggles are ignored when it is set. Switching a deployment between the
two is changing that one variable and redeploying with the matching env file.

## Product rule

Read [the GitHub Claims product contract](../docs/github-claims-product.md).
The owner clarified the scope on September 13, 2026: **first claim per GitHub
developer–coin pair**, including a first claim on another coin by a developer
who has claimed before. Suppress repeated claims for the same pair. Show prior
claimed coins as context. A developer need not create the token or publish its
CA in GitHub.

Coin attribution requires evidence. A shared PDA withdrawal does not identify a
mint; sorting linked coins by market cap does not establish a first claim on
one of them. Keep incomplete attribution/history explicit.

The runtime uses same-transaction fee-distribution evidence for coin attribution
and pair-keyed persisted history for eligibility. Never reintroduce the former
PDA-lifetime gate or market-cap mint selection.
The dedicated project is [pumpfun-github-claims](https://github.com/nirholas/pumpfun-github-claims).

Do not post plain creator-fee collections, repeat claims for the same pair,
graduations, launches, whales, fee distributions, diagnostics or test messages
to this channel. The `github_first_claim` post kind represents a first pair
claim; the product does not call for a general repeat-claim post kind.

## The three layers that keep it that way

1. **Profile** (`src/config.ts`, `FEED_PROFILES`): pins every toggle. `/feeds`
   over DM refuses to change anything while a profile is set.
2. **Channel policy** (`src/channel-policy.ts`): the send boundary. Every
   `postToChannel`/`postPhotoToChannel` call carries a `kind`, and a kind the
   profile forbids is counted in `/stats` as `policyRejected`, logged once, and
   never sent. A new posting path that forgets the profile still hits this.
3. **Tests** (`feed-profiles.test.ts`, `channel-policy.test.ts`): pin both.
   A change that lets a creator-fee claim into `github-first-claims` fails CI.

If you add a posting path, give it a `PostKind` and add it to the right
profile's allow-list deliberately. If you find yourself removing a kind from
`ALLOWED_POSTS['github-first-claims']` or adding one, stop: that is a product
decision the owner makes, not a fix.

## Never do these

- Never point `pumpfun-channel-bot` at `-1003533969743` or `pumpfun-claims-bot`
  at `-1003818751043`. Each service has one channel.
- Never set `ADMIN_USER_IDS` on both feeds if they share a token: only one
  instance may long-poll. The claims feed runs send-only.
- Never run `npm run broadcast:test -- --send` against the claims channel. The
  script refuses unless `--force`; do not pass `--force`.
- Never edit `.env` when you mean `.env.claims`. Check `CHANNEL_ID` first.
- Never "fix" the claims feed by flipping `FEED_*` variables. Set the profile.

## The feed stopped. Start here, not from scratch.

```bash
npm run doctor -- --env .env.claims     # or .env for the graduations feed
```

It answers, in one run: is the config coherent, can the bot post to its channel
right now, and does every RPC endpoint serve the real payloads over HTTP and
websocket. It prints `HEALTHY`, or a numbered list of problems each with the
command that fixes it. `--fix --candidates` rewrites the endpoint lists to what
actually works.

Do not begin by reading source, guessing at endpoints, or changing `FEED_*`
variables. Historically that is how a one-minute RPC fix became a multi-day
investigation, and how the channel's content got broken while "fixing" it.
The three most common verdicts and what they mean:

| Verdict | Reality | Who fixes it |
|---|---|---|
| `not an administrator of that channel` | The bot was demoted. Nothing in a container can re-grant this. | Owner, in the Telegram app |
| `every configured endpoint is dead` | Providers went key-gated or rate-limited. | `npm run doctor -- --fix --candidates`, then redeploy |
| `HEALTHY` but the channel is quiet | Unknown until checked against the chain. Run `node scripts/audit-first-claims.mjs --hours 24`: it reads the verifier that co-signs every GitHub claim. The audit classifies PDA-wide claims only. Missing `FIRST` lines does not rule out an experienced developer's first claim on another coin. | Whoever runs the audit. Do not widen the feed to make it busier. |

That last row matters most. On 2026-09-12 two GitHub claims were lost outright
while the silence was assumed correct, and a veteran's 203.7 stablecoin claim
was briefly reported as a missed first claim because only the SOL lifetime was
read. Silence is a question to answer with the audit, never a reason to enable
more feeds.

## Current runtime (known gaps are not product requirements)

1. **Found twice.** The websocket subscribes to the PumpFees program, and the
   backstop (`src/claim-backstop.ts`) reads the history of
   `2sMrGNK8i36YRkF5WWCwnaUYuwDJhHe1g2xA8aPvhkjM`, the verifier that co-signs
   every GitHub claim, every 20 seconds. The verifier signs about 34
   transactions a day, so this is cheap and complete. Both feed one queue gate,
   so a claim seen by both is processed once.
2. **Retried until fetched.** A transaction counts as handled only after it has
   actually been fetched. A failed fetch is retried, up to 5 attempts.
3. **Attributed from the transaction.** `claim-monitor.ts` decodes each
   `DistributeCreatorFeesEvent`, matches the claimed social fee PDA in its
   shareholder vector, and carries exact mint/config/share evidence. Several
   evidenced mints become separate pair events. No evidence means no channel post.
4. **Decided per pair.** Numeric GitHub ID plus full mint is the duplicate key.
   PDA SOL/stable lifetime counters remain context and cannot suppress coin B.
5. **Delivered durably.** Claim cards enter `delivery-outbox.json` before the
   Telegram call and are replayed after channel access is verified on restart.
   State files use atomic write-then-rename.

## Verify before you claim it works

```bash
npm run typecheck && npm test                    # 228+ tests, profile + policy pinned
npm run probe:endpoints -- --env .env.claims     # every RPC passes the real payloads
PORT=3910 node dist/index.js                     # boot log must say "Channel access verified"
```

Only boot a posting instance when explicitly deploying or operating the feed.
Use tests for local verification; do not post diagnostics to the live channel.
A quiet boot does not prove per-coin attribution works. Then check `/stats`: `policyRejected`
must be 0 on a correctly wired feed; a non-zero count means a path is trying to
post something the channel is not for.
