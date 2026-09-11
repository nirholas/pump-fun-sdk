# channel-bot: rules for agents

This directory is one codebase deployed as two different Telegram feeds. Read
this before touching config, env files, deploy scripts, or posting paths.

## The two feeds

| Profile | Channel | Chat id | Bot | Cloud Run service | Env file |
|---|---|---|---|---|---|
| `github-first-claims` | [@pumpfunclaims](https://t.me/pumpfunclaims) | `-1003533969743` | @pumpclaimsbot | `pumpfun-claims-bot` | `.env.claims` |
| `graduations` | [@trackpumpfun](https://t.me/trackpumpfun) | `-1003965305979` | @pumpgraduatedbot | `pumpfun-channel-bot` | `.env` |

`FEED_PROFILE` is the switch. One word selects the whole feed; the individual
`FEED_*` toggles are ignored when it is set. Switching a deployment between the
two is changing that one variable and redeploying with the matching env file.

## What @pumpfunclaims is for (do not widen it)

It carries exactly one event: **a developer's first-ever on-chain claim of
GitHub social-fee rewards on a coin.** Traders watch it because a first claim
means the dev showed up to collect, which reads as "the dev is still working on
this". That is the whole product. The card looks like this:

```
🚨🚨🚨 FIRST CREATOR FEE CLAIM
⭐ Notable
🟢 Credibility: 100/100 · Strong
...
💸 Claim Stats
Claim #1
Type: Claim Social Fee PDA (GitHub)
⚡ Signals
✅ Verified — token GitHub matches claimer
```

Everything else is noise in that channel and must never be posted there:

- plain creator-fee collections (`💰 Creator Claimed Fees`, `collect_creator_fee`)
- a second or later claim on the same coin (`Claim #2`), even with the FIRST banner
- graduations, launches, whales, fee distributions
- diagnostics, tests, announcements from scripts

On 2026-09-11 the channel carried a routine creator-fee payout because that
path posted under `FEED_CLAIMS` with no toggle of its own. It has one now
(`FEED_CREATOR_CLAIMS`, default off) and the profile pins it off.

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
  at `-1003965305979`. Each service has one channel.
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
| `HEALTHY` but the channel is quiet | Working as designed. A GitHub *first* claim is rare; hours between posts is normal. | Nobody. Do not widen the feed to make it busier. |

That last row matters most: a quiet channel is usually correct. Never respond to
silence by enabling more feeds.

## Verify before you claim it works

```bash
npm run typecheck && npm test                    # 228+ tests, profile + policy pinned
npm run probe:endpoints -- --env .env.claims     # every RPC passes the real payloads
PORT=3910 node dist/index.js                     # boot log must say "Channel access verified"
```

A 90-second local boot on the claims profile must log `0 posted` unless a real
GitHub first claim landed in that window. Then check `/stats`: `policyRejected`
must be 0 on a correctly wired feed; a non-zero count means a path is trying to
post something the channel is not for.
