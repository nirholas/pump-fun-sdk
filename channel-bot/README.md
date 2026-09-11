# PumpFun Channel Bot

Read-only Telegram channel feed that broadcasts PumpFun on-chain activity — GitHub social fee claims, token graduations, and more. Posts rich, intelligence-enriched cards to a Telegram channel in real time.

> **Live deployment**: this code runs as the graduation/migration feed, posting to
> [@trackpumpfun](https://t.me/trackpumpfun) ("PumpFun Tracker Chat", chat id
> `-1003965305979`) as [@pumpgraduatedbot](https://t.me/pumpgraduatedbot). It runs on
> Cloud Run as `pumpfun-channel-bot`; see [Deploy to Google Cloud Run](#6-deploy-to-google-cloud-run).
> That chat is the discussion supergroup linked to channel `@migratedpumpfun`
> (`-1003818751043`); posting targets the supergroup, which is where the audience is.
>
> **`@pumpfunclaims` is not this service and is currently dark.** This code used to
> serve it; the deployment was repurposed into the migrations feed on 2026-08-01
> (`FEED_CLAIMS=false`). See
> [The `@pumpfunclaims` first-claims feed is dark](#the-pumpfunclaims-first-claims-feed-is-dark)
> for what is broken and how to bring it back without taking `@trackpumpfun` down.
>
> The separate all-claims firehose is [`@pumpkit/allclaims`](../pumpkit/packages/allclaims/),
> a **different bot, token, channel and Cloud Run service**. Never share a bot token
> between them: one token cannot serve two feeds, and reusing it crosses the streams.
>
> **Claim decoder**: this file's `src/claim-monitor.ts` is a copy. The canonical decoder
> lives in `@pumpkit/allclaims`; see [DECODERS.md](../DECODERS.md) before changing it.
>
> **Looking for interactive monitoring?** The [telegram-bot](../telegram-bot/) supports watch management, group chats, REST API, SSE streaming, and webhooks. Use this channel-bot for simple broadcast-only channels.

## Features

### Feed Types

| Feed | Description | Toggle |
|------|-------------|--------|
| **GitHub First Claims** | A dev's first-ever claim of GitHub social-fee-PDA rewards on a coin (Path A). The @pumpfunclaims product | `FEED_CLAIMS` |
| **Creator Fee Claims** | Plain `collect_creator_fee` payouts (Path B). Off by default; never in the first-claims channel | `FEED_CREATOR_CLAIMS` |
| **Token Launches** | New token mints with creator profile enrichment | `FEED_LAUNCHES` |
| **Token Graduations** | Tokens graduating from bonding curve to PumpAMM | `FEED_GRADUATIONS` |
| **Whale Trades** | Buys/sells over `WHALE_THRESHOLD_SOL` with curve progress | `FEED_WHALES` |
| **Fee Distributions** | Creator fee payouts to shareholders | `FEED_FEE_DISTRIBUTIONS` |

**Prefer `FEED_PROFILE` to individual toggles.** `github-first-claims` and `graduations` each pin the complete set, so a deployment is selected by one word and cannot drift one variable at a time into posting things its channel is not for. With a profile set the `FEED_*` variables are ignored and `/feeds` refuses runtime changes. See [CLAUDE.md](CLAUDE.md) for the rules per feed.

All toggles except `FEED_CLAIMS` can also be flipped at runtime with the `/feeds` admin command — no redeploy needed. Detection always runs for every feed; toggles only gate what gets posted to Telegram, so the HTTP API and webhooks below always carry the full event stream.

### Claim Intelligence

Every GitHub social fee claim card includes:

| Feature | Description |
|---------|-------------|
| **🚨 First-Time Alert** | `🚨🚨🚨 FIRST TIME CLAIM` banner when a GitHub user claims for the first time ever |
| **⚠️ Fake Claim Detection** | Detects when `claim_social_fee_pda` instruction is called but no fees are actually paid out |
| **📊 Claim Counter** | Sequential claim number tracked persistently across restarts |
| **💹 Lifetime SOL** | Total SOL claimed from the PDA over all time |
| **👤 GitHub Profile** | Username, bio, repos, followers, account age, location, blog |
| **𝕏 Social Links** | Twitter/X profile with follower counts (from GitHub profile) |
| **🏅 Influencer Badge** | Tier-based badge for high-follower GitHub/X accounts |
| **📈 Token Intel** | Graduated/bonding curve status, curve progress %, created age, reply count |
| **🔗 Token Socials** | Twitter, Telegram, website links from token metadata |
| **🏷️ Token Flags** | NSFW, banned, cashback status indicators |
| **⚠️ Trust Signals** | Warnings for new GitHub accounts (< 30 days), zero repos, fake claims |
| **🔗 Trading Links** | Axiom, GMGN, Padre links with affiliate codes |
| **️ Token Image** | Token image or GitHub avatar as photo card |

### Graduation Cards

Rich graduation cards include creator profile, top holders analysis, 24h trading volume, dev wallet activity, pool liquidity, and bundle detection.

## Architecture

```
Solana RPC (WebSocket + HTTP polling)
        │
        ▼
┌───────────────────┐
│  SocialFeeIndex   │──▶ Bootstraps ~148K SharingConfig → mint mappings
└────────┬──────────┘
         │
┌────────▼──────────┐
│   ClaimMonitor    │──▶ Decodes PumpFees program claim transactions
│   EventMonitor    │──▶ Decodes Pump program logs (graduations)
└────────┬──────────┘
         │ FeeClaimEvent / GraduationEvent
┌────────▼──────────┐
│ Enrichment Layer  │
│  ├─ GitHub API    │──▶ User profile, repos, followers
│  ├─ X/Twitter API │──▶ Follower counts, influencer tier
│  ├─ PumpFun API   │──▶ Token info, creator profile, holders, trades
│  ├─ ClaimTracker  │──▶ First-claim detection, persistent counts
│  └─ Fake Detect   │──▶ Instruction called but no payout (amountLamports=0)
└────────┬──────────┘
         │ ClaimFeedContext
┌────────▼──────────┐
│    Formatters     │──▶ Rich HTML cards with sections & emoji layout
└────────┬──────────┘
         │
┌────────▼──────────┐
│   grammY Bot      │──▶ Posts photo + caption to Telegram channel
│   (retry + rate   │    Falls back to text-only if photo fails
│    limiting)      │
└───────────────────┘
```

### Programs Monitored

| Program | ID | Purpose |
|---------|-----|---------|
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing, social fee PDA claims |
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve (graduations) |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | AMM (graduated pool events) |

## Quick Start

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. `/newbot` → follow prompts → copy the bot token
3. Create a public channel (e.g., `@pumpfunclaims`)
4. Add the bot as an **admin** to the channel (must have "Post Messages" permission)

### 2. Configure Environment

```bash
cp .env.example .env
```

```env
# ── Required ──────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
CHANNEL_ID=-1001234567890        # numeric -100... chat id (see below)

# ── Solana RPC ────────────────────────────────────────────
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key
SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=your-key

# Multiple RPC endpoints for fallback (comma-separated)
SOLANA_RPC_URLS=https://mainnet.helius-rpc.com/?api-key=key1,https://your-other-rpc.com

# Multiple WebSocket endpoints, tried in order when one stops delivering.
# Set this. A single endpoint is a single point of failure: rpc.magicblock.app
# went key-gated on 2026-09-09 and started answering 401 on the upgrade, and the
# sibling all-claims feed sat silent on it for four days still reporting
# websocket mode, because a subscription that never connects looks identical to
# a healthy one. Whatever SOLANA_RPC_URLS implies is appended automatically.
SOLANA_WS_URLS=wss://solana-rpc.publicnode.com,wss://api.mainnet-beta.solana.com

# ── Feed Toggles ──────────────────────────────────────────
FEED_PROFILE=github-first-claims # one word selects the feed; pins every toggle below
# Individual toggles, only honoured when FEED_PROFILE is unset:
FEED_CLAIMS=true                 # GitHub first claims (Path A)
FEED_CREATOR_CLAIMS=false        # plain creator fee collections (Path B)
FEED_LAUNCHES=false              # New token launches
FEED_GRADUATIONS=true            # Token graduations
FEED_WHALES=false                # Large trades over WHALE_THRESHOLD_SOL
FEED_FEE_DISTRIBUTIONS=false     # Creator fee distributions to shareholders

# ── GitHub Enrichment ─────────────────────────────────────
REQUIRE_GITHUB=true              # Only post claims with GitHub social fee PDA
GITHUB_TOKEN=ghp_your_token      # Optional: raises rate limit from 60 to 5000 req/hr

# ── AI Summaries (optional) ──────────────────────────────
GROQ_API_KEY=gsk_your_key        # Groq API for AI one-liners

# ── Admin Commands (optional) ────────────────────────────
ADMIN_USER_IDS=123456789         # Telegram user IDs allowed to control the bot via DM

# ── Webhooks (optional) ──────────────────────────────────
WEBHOOK_URLS=https://example.com/pump-hook   # Every event POSTed as JSON
WEBHOOK_SECRET=change-me                     # Enables HMAC-SHA256 signatures

# ── Tuning ────────────────────────────────────────────────
POLL_INTERVAL_SECONDS=30         # HTTP polling fallback interval
WHALE_THRESHOLD_SOL=10           # Minimum SOL for whale alerts
LOG_LEVEL=info                   # debug | info | warn | error
```

### 3. Run

```bash
# Install dependencies
npm install

# Development (hot reload via tsx)
npm run dev

# Production
npm run build
npm start
```

### 4. Deploy with Docker

```bash
docker build -t pumpfun-channel-bot .
docker run -d --env-file .env pumpfun-channel-bot
```

### 5. Deploy to Railway

Railway auto-deploys from GitHub and provides persistent volumes for claim tracking data.

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Create & link project
railway init
railway link

# Set environment variables
railway variables set TELEGRAM_BOT_TOKEN=your-token
railway variables set CHANNEL_ID=-1001234567890
railway variables set SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key
railway variables set SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=your-key
railway variables set FEED_CLAIMS=true
railway variables set REQUIRE_GITHUB=true

# Create persistent volume for claim tracker data
railway volume create --mount /app/data

# Deploy
railway up
```

See [railway.json](railway.json) for the deployment config:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 6. Deploy to Google Cloud Run

The bot is a single container with an HTTP port, so it runs on Cloud Run as-is. The quickest path is the bundled script, which reads `.env`, puts the bot token in Secret Manager, and deploys one always-on instance:

```bash
./deploy-cloudrun.sh                       # uses the active gcloud project
PROJECT=my-project REGION=us-west1 ./deploy-cloudrun.sh
```

It ships env vars through a YAML file rather than `--set-env-vars` on purpose: `SOLANA_RPC_URLS` contains commas and affiliate refs contain `@`, so both the default comma separator and the `^@^` alternate-delimiter trick would silently corrupt them. **Never hand-roll a `--set-env-vars` deploy for this service.** Use the script, or [cloudbuild.yaml](cloudbuild.yaml) (substitutions: `_SERVICE`, `_REGION`, `_REPO`, `_RUNTIME_SA`) for an image-only release against a service whose env is already set.

Live as of 2026-08-01 in project `aerial-vehicle-466722-p5`, region `us-central1`, as the `pumpfun-channel-bot` service. What the script does that a hand-run `gcloud run deploy` will not:

- **Pins both service accounts.** The project's default compute SA was deleted, so the build (`three-ws-build@`) and runtime (`three-ws@`) identities must be explicit or the deploy dies with an opaque permissions error.
- **Refuses a non-numeric `CHANNEL_ID`.** It must be the `-100…` chat id. A `@handle` is not reliable across chat types and does not survive a username change.
- **Skips `PORT`.** Cloud Run reserves it and rejects the deploy outright if it appears in the env file. The container already reads `process.env.PORT`.
- **Stages a snapshot of `src/` before uploading.** Other agents edit this worktree concurrently and `--source .` uploads file by file, so an edit landing mid-upload ships a torn tree that fails `tsc` in Cloud Build while the source on disk is fine. That failure is indistinguishable from a real type error and costs a six-minute build to diagnose.
- **Typechecks first**, so a genuine type error fails in seconds instead of six minutes.

`--min-instances 1` with `--no-cpu-throttling` matters: this is a long-lived websocket monitor, not a request server, so it must not scale to zero or lose CPU between requests. `--max-instances 1` keeps it a singleton so the channel never gets duplicate posts. `/health` doubles as the container health check. Memory is 2 GiB against a 1536 MB Node heap cap; keep the cap below the container limit or Cloud Run kills the instance.

The service is private. To read its stats:

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "$(gcloud run services describe pumpfun-channel-bot --region us-central1 \
    --project aerial-vehicle-466722-p5 --format='value(status.url)')/stats"
```

**Lost your `.env`?** It is gitignored, so a codespace rebuild deletes it, and without it neither `npm start` nor `deploy-cloudrun.sh` can run. The deployed revision is the durable copy. Rebuild the file from it:

```bash
PROJECT=aerial-vehicle-466722-p5 ./recover-env.sh          # writes .env, refuses to clobber
PROJECT=aerial-vehicle-466722-p5 ./recover-env.sh --force  # replaces an existing .env
```

It reads the non-secret keys off the live revision, pulls `TELEGRAM_BOT_TOKEN` out of Secret Manager, applies the same numeric-`CHANNEL_ID` guard the deploy applies, and writes `.env` mode `0600`. It is the exact inverse of `deploy-cloudrun.sh` and takes the same `PROJECT`/`REGION`/`SERVICE`/`SECRET_NAME`/`ENV_FILE` overrides, so a sibling feed recovers into its own file instead of overwriting this one:

```bash
SERVICE=pumpfun-claims-bot ENV_FILE=.env.claims ./recover-env.sh
``` If gcloud has no usable credentials it says so and stops, because that is the normal state after a rebuild and the fix (`gcloud auth login`) is interactive.

### When it stops: `npm run doctor`

The outages this feed has had were cheap to fix and expensive to diagnose. An
endpoint goes key-gated, the channel goes quiet, and whoever looks next starts
from nothing: which bot is this, which channel, which endpoints are configured,
are any alive, is it even RPC or did the bot lose post rights. That question has
taken days to answer more than once, on a feed that was working the day before.

One command answers all of it, in the order the pipeline fails:

```bash
npm run doctor                                  # diagnose .env.claims
npm run doctor -- --env .env                    # the graduations feed
npm run doctor -- --fix --candidates            # rewrite the endpoint lists to what works
```

It checks config coherence (does `CHANNEL_ID` match `FEED_PROFILE`, is anything
about to collide), then Telegram (can this bot post to this channel *right
now*), then every endpoint against the real payloads. It ends with either
`HEALTHY` or a numbered list of problems, each with the exact command or Telegram
action that fixes it. `--fix` rewrites `SOLANA_RPC_URL(S)`/`SOLANA_WS_URL(S)` to
the endpoints that passed, pulling replacements from the public pool with
`--candidates`, and refuses to write an empty list.

Every watchdog alert ends with the `doctor` command for that deployment, so an
outage notification is also its own runbook.

### Staying up without a babysitter

Three mechanisms, each covering a failure this feed has actually had.

**1. Endpoint failover, proven rather than assumed.** `npm run probe:endpoints`
puts every configured RPC through the calls the claim monitor really makes:
`getSlot`, `getSignaturesForAddress` and `getTransaction` against the pump
program over HTTP, and a `logsSubscribe` that must deliver a real
`logsNotification` within 20s. Liveness pings do not qualify an endpoint here:
a node can answer `getSlot` in 40ms and still refuse signature history, and an
endpoint that accepts a subscription and sends nothing is exactly what took the
all-claims feed down for four days. Add `--candidates` to sweep the public pool,
`--json` for machine output. It exits non-zero when nothing passes every stage,
so it works as a deploy gate.

**The free public RPC pool is effectively gone, and adding entries will not
prevent an outage.** A 35-endpoint sweep on 2026-09-11 (`--candidates`) found
exactly **two** usable keyless endpoints: `api.mainnet-beta.solana.com` and
`solana-rpc.publicnode.com`. Everything else answered 401, 402, 403, 404, 410,
429, 503 or 521, or did not resolve, including every `rpcpool` host plus ankr,
magicblock, getblock, blastapi, tatum, jito, solscan, metaplex and extrnode.

The practical consequence: **depth comes from independent keyed providers, not
from more free URLs.** Each free tier (Helius, QuickNode, Alchemy, Shyft,
Syndica, Chainstack, dRPC) is its own quota, and one signup buys more
resilience than the entire remaining public pool. Two URLs from the same
provider share a balance: `mainnet.helius-rpc.com` and `beta.helius-rpc.com`
cover an endpoint fault, not running out of credits.

The candidate list stays long anyway, because the probe is what decides, a dead
entry costs one fast failure, and endpoints do come back. Rerun the sweep
rather than trusting any list. The live set is 6 HTTP endpoints and 5
delivering sockets across 4 independent providers, and the two feeds lead with
different ones so one exhausted quota cannot starve both.

**2. The feed reports its own outages.** Set `ALERT_CHAT_ID` to a DM or private
group and the watchdog ([watchdog.ts](src/watchdog.ts)) escalates two conditions:
delivery blocked (Telegram refusing our posts) and websocket silence (no event
for 10 minutes, when the pump programs are never quiet that long). It alerts
once per distinct problem, repeats every 6 hours while it persists, and sends a
single recovery message when it clears. Alerts are send-only, so a feed with an
empty `ADMIN_USER_IDS` still escalates without ever calling `getUpdates`.

This is the mechanism that was missing. `/health` already knew the channel was
blocked; `/health` lives on a private Cloud Run service that nothing was
reading, so the feed sat dark for six weeks with the process green.

Telegram will not let a bot open a conversation, so `ALERT_CHAT_ID` cannot be
guessed from outside. `npm run alerts:bind` waits for the first DM the bot
receives, writes that chat id into the env file, and sends a confirmation back
so the alert path is proven rather than assumed:

```bash
npm run alerts:bind            # then message the bot from the account that should get alerts
npm run alerts:bind -- --env .env --timeout 300
```

Run it only against a feed with an empty `ADMIN_USER_IDS`; if an instance with
admin commands is polling the same token, the two split updates between them.

**3. The platform keeps the process alive.** `--min-instances 1`,
`--no-cpu-throttling` and `--max-instances 1` mean one always-on singleton that
never scales to zero, never loses CPU between requests, and never doubles up to
post twice. `/health` returns 503 when delivery is blocked, so an uptime check
against it catches a lockout that a plain liveness probe would call healthy.

What none of this can cover: a bot demoted inside Telegram. Nothing in a
container can re-grant its own post rights. The watchdog turns that from a
silent outage into a message within a minute, which is the whole difference.

### Posting a one-off diagnostic

`npm run broadcast:test` renders a system-diagnostic card and prints it without
sending. Add `-- --send` to post it to `CHANNEL_ID`, or `-- --send --chat <id>`
to aim it elsewhere. Every value in it is measured when it runs: endpoint counts
from the env file, slot and chain lag from a live RPC call, and an HMAC-SHA512
attestation computed over the rendered message and keyed by a fresh nonce.
Sending is opt-in; a bare run never posts.

#### Running a second feed from this directory

`SERVICE`, `SECRET_NAME` and `ENV_FILE` are the three overrides that turn this
one checkout into several independent Cloud Run services. Each feed keeps its
own env file, so a redeploy of one never picks up another's channel, token or
`FEED_*` toggles:

```bash
SERVICE=pumpfun-claims-bot \
  SECRET_NAME=pumpfun-claims-bot-token \
  ENV_FILE=.env.claims \
  ./deploy-cloudrun.sh
```

Two feeds **may** share one bot token, but only if at most one of them sets
`ADMIN_USER_IDS`. That variable is the only thing that starts long polling
([index.ts](src/index.ts): "Long polling only exists to receive admin DMs;
without admins the bot stays send-only and never pulls updates"), and Telegram
gives `getUpdates` to one consumer at a time, so two *polling* instances on one
token split the admin DMs between them at random. Sending is unaffected: a
send-only instance never calls `getUpdates` and cannot collide with anything.
Leave `ADMIN_USER_IDS` empty on the second feed, or give it its own bot.

`.env*` is gitignored and excluded from both the Docker and Cloud Build
contexts, so a second env file never reaches an image.

#### The `@pumpfunclaims` first-claims feed is dark

`@pumpfunclaims` ("PumpFun Tracker [Github Claims]", `-1003533969743`, 227
members) has had no automated post since **2026-08-01**; everything after post
`1086` in it is hand-written. Three things have to be true again before a card
lands there, and today none of them are:

1. **A bot with post rights in the channel.** `@pumpgraduatedbot` is still *in*
   the channel but is no longer an **administrator**, so it cannot post.
   `getChatAdministrators` and `getChatMember` on `-1003533969743` both answer
   `member list is inaccessible`, which is what Telegram returns to a non-admin
   caller. That it is still a member is provable: resolving a numeric chat id
   only works for a bot that has the chat in its state, and `getChat` on
   `-1003533969743` succeeds with this token while the same call on
   `@pumpfunclaimed`'s id returns `chat not found`. Re-promoting it is a
   channel-owner action in the Telegram app; nothing in this repo can do it.
2. **A service pointed at that chat id.** Nothing in *this* repo is: the running
   `pumpfun-channel-bot` has `CHANNEL_ID=-1003965305979` (`@trackpumpfun`) and
   `pumpfun-allclaims-bot` has `-1003905427189` (`@pumpfunclaimed`). A *second*
   implementation does target it, in the three.ws repo: the
   `/api/cron/pump-claims-push` Cloud Scheduler job fires every 5 minutes at
   `TELEGRAM_PUMP_CLAIMS_CHAT_ID`. It posts nothing because its scanner is
   starved, not because it is switched off (see below).
3. **`FEED_CLAIMS=true`.** The running service ships `FEED_CLAIMS=false` and
   `FEED_GRADUATIONS=true`: it was repurposed into the migrations feed, so claim
   detection is off in the only deployment that ever served this channel.

Restore it as a third service rather than by repointing `pumpfun-channel-bot`,
which would take `@trackpumpfun` down: write `.env.claims` with
`CHANNEL_ID=-1003533969743`, `FEED_PROFILE=github-first-claims`, the
@pumpclaimsbot token and an empty `ADMIN_USER_IDS`, then run the
`SERVICE=pumpfun-claims-bot` command above.

Since 2026-09-11 the boot preflight catches step 1 on its own: a demoted bot in
a channel now fails `verifyChannelAccess` with `no_permission` and logs the fix,
where it previously fell into the retryable `unknown` bucket and booted logging
"Channel access verified" for a bot that could not post a single card.

That also settles which of the two implementations owns the channel. three.ws's
lane needs an indexer speaking `getFirstClaims`/`getRecentClaims` over JSON-RPC
`tools/call`, and no such service exists in any repo here, which is why
`PUMPFUN_BOT_URL` is unset and `https://three.ws/api/pump/first-claims` answers
`{"items":[]}` for every window. This bot needs no indexer: it decodes claims
straight off the pump program, which is what `@pumpfunclaimed` is doing right
now. Deploying it is the shorter path; pointing three.ws's
`PUMPFUN_BOT_URL` at a new adapter is the longer one.

Local fallback if Cloud Run is ever down: `npm run build && npm start` from this directory (port 3900 locally; 3901 belongs to `@pumpkit/allclaims`). Kill a local instance by matching `/proc/<pid>/cwd` to this directory, never by the `node dist/index.js` cmdline, which is relative: `pkill -f "channel-bot/dist/index.js"` matches nothing, and a bare `dist/index.js` pattern also matches unrelated services under `/workspaces/three.ws` that must never be killed.

## Admin Commands

With `ADMIN_USER_IDS` set, the operator can DM the bot to inspect and steer it at runtime. Everyone else is ignored silently, and commands only work in private chats.

| Command | Effect |
|---------|--------|
| `/status` | Uptime, transport (websocket/polling), feed toggles, counters, webhook stats |
| `/feeds` | List feed toggles |
| `/feeds graduations off` | Flip a feed at runtime (claims requires a restart to turn on) |
| `/threshold 25` | Set the whale alert threshold in SOL |
| `/mute 30` | Pause channel posting for 30 minutes (monitoring continues) |
| `/unmute` | Resume posting |
| `/recent 10` | Show the last 10 detected events |

## HTTP API

The health port (`PORT`, default 3000) serves a read-only JSON API over the same event pipeline. CORS is open — everything here is public on-chain data.

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness probe: status, uptime, counters |
| `GET /stats` | Transport mode, feed toggles, mute state, event counters, webhook stats |
| `GET /events/recent?limit=50&kind=graduation` | Ring buffer of recent events, newest first |
| `GET /events/stream?kind=whale` | Live [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) stream |

`kind` is one of `claim`, `launch`, `graduation`, `whale`, `feeDistribution`. Example consumer:

```js
const stream = new EventSource('http://localhost:3000/events/stream?kind=graduation');
stream.addEventListener('graduation', (e) => {
    const event = JSON.parse(e.data);
    console.log('graduated:', event.mint, event.summary);
});
```

## Webhooks

Set `WEBHOOK_URLS` to fan every detected event out as a JSON POST — the push-based twin of the SSE stream, for consumers that can't hold a connection open. With `WEBHOOK_SECRET` set, each delivery carries an HMAC-SHA256 signature:

```
POST <your-url>
Content-Type: application/json
X-PumpFeed-Event: graduation
X-PumpFeed-Signature-256: sha256=<hex hmac of the raw body>
```

Verify by recomputing the HMAC of the raw request body with your secret and comparing (timing-safe compare recommended). Deliveries retry up to 3 times on network errors and 5xx; 4xx responses are not retried.

## Delivery Health

The bot verifies at boot that it can actually post to `CHANNEL_ID` and says so on line one, rather than failing silently on the first event:

```
[INFO]  Channel access verified: @pumpgraduatedbot can post to @trackpumpfun
```

When it cannot, you get the fault and the fix instead of a stack trace, and the feed keeps running so the API and webhooks still carry every event:

```
[ERROR] CHANNEL NOT REACHABLE (not_a_member)
[ERROR] FIX: Add the bot to @trackpumpfun and grant it post rights (Telegram → group → Add members → the bot, then promote it to admin).
```

The same state is machine-readable: `GET /health` returns **503** with `degraded: true` and a `delivery` object carrying the fault and the fix, so an uptime check catches a bot that is running but mute. Recognized faults:

| Fault | Meaning | Fix |
|-------|---------|-----|
| `not_a_member` | Bot was never added, or was removed/kicked | Add the bot to the chat and promote it |
| `chat_not_found` | `CHANNEL_ID` does not resolve | Correct the `@username` or use the numeric `-100…` ID |
| `no_permission` | In the chat but cannot post | Promote to admin with Send Messages / Send Photos |
| `blocked` | Bot is blocked in the chat | Unblock it |
| `rate_limited`, `transient` | Telegram 429/5xx | None — retried automatically, health stays OK |

Repeated failures of the same kind log once, then periodically, instead of once per event.

## Call Follow-Ups

Every card the bot posts is scored in public, in its own thread. When a called
token crosses a multiple of its market cap at alert time, the bot replies to the
original message:

```
🚀 $CATE 5x since this call
$120.4K → $610.2K in 41m
```

It also reports the two outcomes a feed usually hides:

```
💀 $CATE -86% since this call
$120.4K → $16.8K in 3h20m
Peak was $610.2K (5.1x)

🚨 $CATE dev is selling
Dev position 8.0% → 1.1% of supply (-86%)
14m after this call
```

Only the highest milestone crossed since the last sweep is announced, so a token
that 12x'd between checks posts once rather than firing 2x, 5x and 10x in a row.
Each milestone, the collapse, and the dev alert fire at most once per call.

Open calls are persisted to disk, so a restart or redeploy does not abandon them.
Baselines under `$1,000` are ignored because a dust market cap manufactures
enormous multiples out of noise.

| Variable | Default | Meaning |
|----------|---------|---------|
| `PERFORMANCE_UPDATES` | `true` | Master switch for follow-ups |
| `PERFORMANCE_WINDOW_HOURS` | `24` | How long a call stays tracked |
| `PERFORMANCE_MILESTONES` | `2,5,10,25,50,100` | Multiples that trigger a reply |
| `PERFORMANCE_COLLAPSE_PCT` | `80` | Drawdown that counts as a collapse |

Live counts are on `GET /stats` under `performance`.

## Reading the Cards

Two conventions worth knowing, because both are deliberate.

**Missing data is stated, never implied.** A card with no holder line used to look
exactly like a card with safe holders. Concentration that could not be fetched now
says so, and a dev holding nothing says `Dev holds: 0% — sold or never held` rather
than printing nothing. Absence of a warning is not evidence of safety, and the
cards no longer pretend otherwise.

**Base rates, not raw counts.** `Launches: 5` reads as experience. The cards show
`⚠️ Dev record: 5 launches · 1 graduated · 4 died under $5k` instead, and only warn
when the dead outnumber the graduations.

The flow bar shows which side is in control:

```
⚖️ Flow: [███████░░░] 72% buys — 🟢 buyers in control
```

Under 8 recent trades it is omitted entirely rather than turning a handful of
trades into a trend.

## Transport Resilience

The monitor prefers a WebSocket subscription (real-time, complete) and falls back to HTTP polling only when the socket is genuinely unusable: after 3 consecutive silent heartbeat periods it switches to polling and retries the WebSocket every 10 minutes, promoting it back automatically the moment live events flow again. `/status` and `GET /stats` both report the active transport.

Polling is a degraded mode by design — `getSignaturesForAddress` caps at 20 signatures per poll on one of the busiest programs on Solana, so a healthy WebSocket endpoint matters. Free endpoints that carry the full `logsSubscribe` stream exist (e.g. `wss://solana-rpc.publicnode.com`).

## Project Structure

```
channel-bot/
├── src/
│   ├── index.ts              # Entry point — wires monitors, enrichment, & Telegram posting
│   ├── config.ts             # Environment variable loading & validation
│   ├── claim-monitor.ts      # PumpFees program monitor (WebSocket + HTTP polling)
│   ├── claim-tracker.ts      # First-claim detection + claim counter (persisted to disk)
│   ├── event-monitor.ts      # Pump program log decoder (graduations, launches)
│   ├── social-fee-index.ts   # SocialFeeIndex — maps SharingConfig PDAs → mints (~148K)
│   ├── formatters.ts         # Rich HTML card builders for Telegram
│   ├── pump-client.ts        # PumpFun HTTP API client (token info, creator profiles)
│   ├── github-client.ts      # GitHub API client (user profiles, rate-limited cache)
│   ├── x-client.ts           # X/Twitter profile fetcher + influencer tier logic
│   ├── groq-client.ts        # Groq AI one-liner summaries
│   ├── rpc-fallback.ts       # Multi-RPC failover with round-robin
│   ├── health.ts             # HTTP API: /health, /stats, /events/recent, /events/stream
│   ├── event-store.ts        # Ring buffer of recent events + live subscriber fan-out
│   ├── webhooks.ts           # Signed JSON webhook delivery with retries
│   ├── admin.ts              # Telegram DM admin commands (/status, /feeds, /mute, ...)
│   ├── delivery.ts           # Channel preflight + delivery fault classification
│   ├── performance-tracker.ts # Follow-up replies: milestones, collapses, dev dumps
│   ├── keyboards.ts          # Inline keyboards for trade/chart/tx links
│   ├── types.ts              # Program IDs, discriminators, event types
│   └── logger.ts             # Leveled console logger
├── data/                     # Persisted state (gitignored, Railway volume mount)
│   └── github-first-claims.json
├── Dockerfile                # Multi-stage Docker build
├── railway.json              # Railway deployment config
├── cloudbuild.yaml           # Google Cloud Run build + deploy config
├── deploy-cloudrun.sh        # One-command Cloud Run deploy (secret + env from .env)
├── package.json
└── tsconfig.json
```

## How It Works

### Claim Detection Pipeline

```
Transaction detected on PumpFees program
  │
  ▼
Identify instruction: claim_social_fee_pda?
  │
  ├─ YES ──▶ Parse platform (2 = GitHub) + user_id from Anchor args
  │           │
  │           ▼
  │        Check amountLamports from SocialFeePdaClaimed event
  │           │
  │           ├─ amountLamports > 0 ──▶ Real claim
  │           │   ├─ Check ClaimTracker: first time for this GitHub user?
  │           │   │   ├─ YES ──▶ 🚨 FIRST TIME CLAIM banner
  │           │   │   └─ NO  ──▶ Standard claim card
  │           │   └─ Enrich: GitHub API + PumpFun API + X profile
  │           │
  │           └─ amountLamports = 0 ──▶ ⚠️ FAKE CLAIM (instruction called, no payout)
  │
  └─ NO ───▶ Other claim type (creator fee, cashback, etc.)
```

### SocialFeeIndex Bootstrap

On startup, the bot fetches all `SharingConfig` accounts from the PumpFees program to build a reverse mapping from social fee PDA addresses to token mints. This enables resolving which token a social fee claim belongs to without additional RPC calls.

- **~148K mappings** loaded at startup
- **Incremental updates** via WebSocket subscription on `CreateFeeSharingConfig` and `UpdateFeeShares` events
- **Lookup**: `socialFeeIndex.getMintForPda(pdaAddress)` → token mint

### Fake Claim Detection

Some users call the `claim_social_fee_pda` instruction targeting random token PDAs where they have no fees to collect. The bot detects these by checking:

1. The instruction discriminator matches `claim_social_fee_pda`
2. The transaction logs contain no `SocialFeePdaClaimed` event — OR the event shows `amountLamports = 0`
3. The GitHub user ID and platform are still parsed from the instruction args (Anchor Borsh format)

Fake claims are posted with a `⚠️ FAKE CLAIM` warning and a `🚩 Fake claim — no fees paid out` trust signal.

### First-Claim Tracking

The `ClaimTracker` maintains a persistent set of GitHub user IDs that have successfully claimed:

- **In-memory set** for fast lookup during processing
- **Debounced disk persistence** (5-second delay) to `data/github-first-claims.json`
- **Split check/mark pattern**: `hasGithubUserClaimed()` checks without side effects, `markGithubUserClaimed()` only called after successful Telegram post
- **Claim counter**: `incrementGithubClaimCount()` returns sequential claim number per user
- First-claim status is NOT set for fake claims

## Example Claim Card

```
🚨🚨🚨 FIRST TIME CLAIM 🚨🚨🚨

🐙 $PUMP — PumpCoin  💹 $45K
  ↳ GitHub dev claimed PumpFun social fees

📊 Claim #1 · 0.1043 SOL lifetime ($15.65)

🏦 0.1043 SOL ($15.65)
  ↳ 8mNp...4rWz

👤 nirholas (Nicholas)
  ↳ 📦 45 · 👁 200 · 📅 5y ago
  TypeScript SDK builder
𝕏 nichxbt · 1.2K

📈 Bonding curve (72%) · Created 3h ago · 💬 12
𝕏 @pump_coin · 💬 TG · 🌐 pumpcoin.io

⚠️ GitHub account created 15d ago

CA: 7xKXt...p3Bz
Axiom · GMGN · Padre

🔍 TX
```

## Requirements

- **Node.js** >= 20.0.0
- **Telegram bot token** (via [@BotFather](https://t.me/BotFather))
- **Telegram channel** with the bot added as admin
- **Solana RPC endpoint** — dedicated RPC recommended (Helius, QuickNode, Triton). Public mainnet works but may rate-limit.
- **GitHub token** (optional) — raises API rate limit from 60 to 5,000 req/hr

## Troubleshooting

### Bot Not Posting Messages

1. **Check bot permissions** — The bot must be an admin in the channel with "Post Messages" permission
2. **Verify CHANNEL_ID** — Always use the numeric `-100…` chat id, never the `@handle`. The shared `t.me` link is not always the username, `getChat?chat_id=@handle` can return `chat not found` even with the bot already an admin, and a handle stops resolving if the chat is renamed. Recover the numeric id with `curl -s "https://api.telegram.org/bot<TOKEN>/getChat?chat_id=@handle"`, or from `getUpdates?allowed_updates=["my_chat_member"]`, whose promotion event carries the chat id, username and full admin rights
3. **Telegram 403 error** — Means the bot is NOT a member/admin of the channel. Add it via channel settings → Administrators → Add Administrator
4. **Check logs** — Set `LOG_LEVEL=debug` to see all events the bot processes

### Rate Limiting

Telegram limits bots to ~30 messages per second to a channel. The grammY framework handles rate limiting automatically:
- Messages may be delayed but won't be dropped
- The bot includes a retry helper that respects `retry_after` headers
- For very high activity, increase `POLL_INTERVAL_SECONDS` to reduce event volume

### RPC Connection Issues

- Public RPC endpoints have rate limits — for production use a dedicated RPC
- Set `SOLANA_RPC_URLS` with multiple endpoints for automatic failover
- If WebSocket disconnects, the bot falls back to HTTP polling at `POLL_INTERVAL_SECONDS`
- The `RpcFallback` class provides round-robin across configured endpoints
- Set `LOG_LEVEL=debug` to see connection status

### Missing Claims

- **GitHub claims only?** — Set `REQUIRE_GITHUB=true` to only post GitHub social fee claims
- **Feed disabled?** — Verify `FEED_CLAIMS=true` is set
- **SocialFeeIndex slow?** — Initial bootstrap fetches ~148K accounts. This takes 30-60 seconds on startup. Check logs for `SocialFeeIndex: loaded N mappings`
- **Rate limited?** — GitHub API allows 60 req/hr unauthenticated. Set `GITHUB_TOKEN` for 5,000 req/hr

### Pipeline Stats

The bot logs pipeline counters every 60 seconds:
```
Pipeline: 15 total → 8 social → 3 first / 5 repeat → 8 posted (skip: 7 cashback)
```

- **total**: All claim events received
- **social**: GitHub social fee PDA claims
- **first/repeat**: First-time vs. returning claimers
- **posted**: Successfully posted to Telegram
- **skip cashback**: Cashback claims (user refunds, not creator activity)

## Local Development

```bash
# Install dependencies
npm install

# Run with hot reload (tsx)
npm run dev
```

Set `LOG_LEVEL=debug` — all events are logged to stdout regardless of whether they're posted to Telegram.
