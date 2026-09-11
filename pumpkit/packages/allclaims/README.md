# @pumpkit/allclaims

> Telegram channel feed that broadcasts **every** PumpFun fee claim, not just first claims.

This is the firehose sibling of [`@pumpkit/channel`](../channel/). Where the channel bot posts a curated signal (a developer's *first* GitHub fee claim on a token), this bot reports the whole claim stream: creator fees, AMM creator fees, fee distributions, social fee PDA claims, and optionally cashback.

Because the whole stream is far more traffic than a Telegram channel can accept, the bot never simply relays it. Large claims post individually; everything else is batched into a periodic digest. Delivery stays inside the rate limit no matter how busy the chain gets.

**This is a separate bot, a separate token, and a separate channel from the first-claims feed.** It does not read, write, or share state with `channel-bot`, so running it cannot affect [@pumpfunclaims](https://t.me/pumpfunclaims).

---

## How claims are routed

The channel is made of **cards**: a claim gets its own enriched message with the coin artwork, a credibility score, and action buttons. The digest exists for the tail, not as the default output.

| Route | Condition | Delivery |
|-------|-----------|----------|
| **Instant card** | USD value >= `INSTANT_THRESHOLD_USD` and post budget available | Its own card, immediately |
| **Window card** | Among the top `CARDS_PER_WINDOW` distinct claims of the window | Its own card, at the end of the window |
| **Digest** | Anything else at or above `MIN_CLAIM_USD` | One line in the window's digest |
| **Dropped** | Below `MIN_CLAIM_USD` | Counted, and the count is disclosed in the digest |

`CARDS_PER_WINDOW` is what keeps the feed readable when the chain is paying small. A fixed instant threshold alone cannot: typical claims run a few dollars, so a $100 bar never fires and every post collapses into digest lines. Each window instead ranks its claims and promotes the biggest ones, whatever the absolute numbers happen to be that minute.

Repeats collapse before that ranking. One payout routinely surfaces as several claims (the AMM vault and the pump vault swept in the same breath, or a claim bot firing repeatedly), and each of those used to become its own line about the same coin. The largest of each payee/coin pair becomes the card; its twins stay in the digest.

Nothing is silently discarded. A claim is always carded, digested, or counted, and the digest footer states how many dust claims were filtered.

### Flood control

Telegram accepts roughly 20 posts/min to a channel. `MAX_POSTS_PER_MINUTE` (default 15) is enforced with a sliding-window budget:

- One budget slot is always held in reserve for the digest, so a burst of large claims can never starve it.
- When the budget runs out, instant claims **demote into the digest** rather than being dropped.
- If a digest itself cannot post, its claims **roll into the next window** instead of being lost.

Measured on mainnet, claim volume runs roughly 8-25 claims per 150s (~3-10/min). The digest is what makes that deliverable.

---

## Quick start

```bash
cd packages/allclaims
cp .env.example .env
# Edit .env: TELEGRAM_BOT_TOKEN, CHANNEL_ID, SOLANA_RPC_URL, SOLANA_WS_URL
npm install
npm run dev
```

Then:

1. Create a **new** bot with [@BotFather](https://t.me/BotFather). Do not reuse the first-claims bot token.
2. Create your channel, add the bot as an administrator with permission to post.
3. Set `CHANNEL_ID` to `@your_channel` or the numeric `-100…` chat ID.

### A WebSocket RPC is effectively required

Set `SOLANA_WS_URL`. The bot works without one, but polling mode samples only the 20 most recent signatures per program per tick, and on a chain doing thousands of transactions per minute it **will** miss most claims. The bot logs a loud warning when it falls back to polling.

**Give it more than one endpoint.** `SOLANA_WS_URLS` takes a comma-separated
list; whatever the RPC endpoints imply is appended automatically, so there is
always somewhere to fail over to. Endpoints verified keyless and streaming on
2026-09-09:

```bash
SOLANA_RPC_URL=https://solana-rpc.publicnode.com
SOLANA_WS_URL=wss://solana-rpc.publicnode.com
SOLANA_WS_URLS=wss://solana-rpc.publicnode.com,wss://api.mainnet-beta.solana.com
SOLANA_RPC_URLS=https://solana-rpc.publicnode.com,https://api.mainnet-beta.solana.com,https://solana.leorpc.com/?api_key=FREE
```

A paid RPC (Helius, QuickNode, Triton) is recommended for production. Note that Helius's free tier refuses WebSocket upgrades with HTTP 429.

> **`rpc.magicblock.app` is no longer keyless.** It was this bot's endpoint until
> 2026-09-09, when it began answering `401` on the WebSocket upgrade and
> `{"error":"invalid api key"}` on HTTP. That is what a dead endpoint costs here:
> subscribing cannot fail loudly, because web3.js returns a subscription id
> immediately and retries the socket internally, so the feed reported
> `mode: websocket` while detecting **zero claims for four days**. The monitor now
> requires a new subscription to deliver a real log event within 20 seconds before
> it accepts an endpoint, and walks to the next one otherwise. Check `activeWs`
> and `wsEventsReceived` in `/stats`: a websocket with no events is a dead one.

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Bot token from @BotFather (its own bot) |
| `CHANNEL_ID` | ✅ | — | Channel to post to (`@name` or `-100…`) |
| `SOLANA_RPC_URL` | ⬜ | `api.mainnet-beta.solana.com` | Primary RPC HTTP endpoint |
| `SOLANA_RPC_URLS` | ⬜ | — | Comma-separated fallback RPCs |
| `SOLANA_WS_URL` | ⬜ | Derived from RPC URL | Preferred WebSocket endpoint. Strongly recommended |
| `SOLANA_WS_URLS` | ⬜ | Derived from the RPC URLs | Comma-separated WebSocket endpoints, tried in order when one stops delivering |
| `INSTANT_THRESHOLD_USD` | ⬜ | `100` | Claims at or above this post individually |
| `MIN_CLAIM_USD` | ⬜ | `0` | Claims below this are counted but not shown |
| `CARDS_PER_WINDOW` | ⬜ | `6` | Biggest distinct claims per window promoted to full cards |
| `DIGEST_INTERVAL_SECONDS` | ⬜ | `60` | Length of a window, and how often the digest posts |
| `DIGEST_MAX_LINES` | ⬜ | `12` | Claims listed per digest; the rest are summarized |
| `MAX_POSTS_PER_MINUTE` | ⬜ | `15` | Telegram post budget (max 19) |
| `INCLUDE_CASHBACK` | ⬜ | `false` | Include cashback (user refunds, not creator activity) |
| `INCLUDE_DISTRIBUTIONS` | ⬜ | `true` | Include `distribute_creator_fees` payouts |
| `POLL_INTERVAL_SECONDS` | ⬜ | `30` | Polling interval when no WebSocket is available |
| `LOG_LEVEL` | ⬜ | `info` | `debug` \| `info` \| `warn` \| `error` |
| `PORT` | ⬜ | `3000` | HTTP API port |

Invalid numeric values fail at startup with a named error rather than silently falling back to a default.

---

## Who claimed, when the chain does not say

Most fee claims name no coin. `collect_creator_fee` and `collect_coin_creator_fee` drain a per-creator vault that pools fees across every coin that creator launched, so there is no mint in the instruction to report.

That does not make them anonymous. Both claim events carry the **creator pubkey**, which resolves through the pump.fun profile API to a username, a launch history, and the coins that earned the fees. The bot uses it in this order:

1. The mint named by the event (fee distributions, resolved social claims). Reported as fact.
2. The creator pubkey from the event, resolved to a profile and their coins. The biggest coin is shown and labelled as attribution, not as the exact source. A creator with exactly one coin is unambiguous, so no label is added.
3. The signer, only when the event carried no creator.

A card says "wallet-level claim" only when all three come back empty.

---

## Message formats

**Instant** (one claim, one post, coin artwork attached via link preview):

```
🏊 FEE CLAIM · creator fee (AMM)
🟡 Credibility: 65/100 · Moderate
↑ 7 graduated · top10 hold 18%
↓ 90% off ATH

0.1043 SOL ($7.47) claimed by troll_halloween

EXAMPLEc0inMintAAAAAAAAAAAAAAAAAAAAAAAAApump

🪙 $TROLLOWEEN · TROLLOWEEN
💰 MC: $17.2k
💲 Price: 0.000067591 SOL ($0.004961)
🎓 Status: Graduated (AMM)
🏆 ATH: $88.4k
💦 Liquidity: $12.0k
⏱ Created: 3d ago
🕐 Last trade: 2m ago

💸 Claim Stats
0.1043 SOL ($7.47)
Lifetime claims: 8.5729 SOL ($637.65)
Type: Collect Creator Fee (PumpSwap)
📐 0.04% of market cap

👛 Claimed By
EXAMPLEwa11etAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
🔗 pump.fun/profile/EXAM…AAAA

🧑‍💻 Token Creator troll_halloween
🚀 17 launches · 🎓 12 graduated · 👁 672 followers
🪙 $KISHU $2.9k · $SHIB $2.2k · $TROLLSTER $2.1k

👥 Holders
📊 Top5: 3.2⋅2.4⋅2.2⋅2.2⋅2.0 [top10: 18%]

📊 Market
Vol: $1.4k
🅑 34  Ⓢ 40
⚖️ Flow: [█████░░░░░] 46% buys · ⚪ balanced

⚡ Signals
⚠️ Top10 hold 41% of supply

𝕏 · 🌐 Website

━━━━━━━━━━━━━━━━
CA: EXAMPLEc0inMintAAAAAAAAAAAAAAAAAAAAAAAAApump
[⚡ Axiom] [🐸 GMGN] [🅿️ Padre]
[📊 Chart] [💊 pump.fun] [🔍 Solscan]
[🧾 Transaction] [👛 Claimer]
```

The mint renders as a code block at both ends of the card, so one tap copies it from wherever the reader stopped scrolling. The creator wallet is a code block too.

**Credibility** is a transparent sum of the evidence the card already fetched: coin stage, creator track record, holder concentration, and the GitHub identity behind a social claim. Every point moved appears as an ↑ or ↓ reason, so the two lines under the score are the whole model. A claim with nothing indexed scores `⚪ Unrated` rather than a passing 50, and a coin whose concentration could not be read says so out loud: a blank holders section reads exactly like a safe one.

**Actions live on buttons**, not in the text. Beyond being easier to hit on a phone, this keeps a link wall out of the card. A vault claim that resolved no coin gets the transaction row only, never a row of dead trade links.

Artwork rides on the link preview rather than a photo upload: `sendPhoto` caps captions at 1024 characters, which a full card exceeds, while a previewed message keeps both the image and the whole card. Telegram fetches the image itself, so a slow IPFS gateway costs a thumbnail, never a post.

**Digest** (one window, one post):

```
🧾 CLAIMS DIGEST · last 1m · 6 claims · $16 total

🏊 $7.47 · $TROLLOWEEN ($17.2k) · troll_halloween · tx
📤 $2.67 · $FLOKI ($1.5k) · EXAM…AAAA · tx
💸 $0.08 · $LottoLab ($2.0k) · earnedwhale2232 · tx

3 dust claims below the minimum were not listed
```

Only the lines that actually ship get enriched, so a busy window costs `DIGEST_MAX_LINES` lookups rather than one per claim.

USDC-quoted claims (PumpFun V2, rolled out 2026-05-21) render in USDC without a redundant USD conversion. SOL-quoted claims convert at spot from Jupiter Price v3, falling back to CoinGecko then Binance.

---

## HTTP API

The bot serves a read-only JSON API on `PORT` alongside the Telegram feed:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness probe with uptime and counters |
| `GET /stats` | Pipeline counters, transport mode, dispatcher state |
| `GET /events/recent?limit=50` | Ring buffer of recent claims |
| `GET /events/stream` | Live Server-Sent Events stream |

```bash
curl localhost:3000/stats
```

Each recorded event carries the route it took (`instant`, `digest`), its USD value, claim type, and transaction signature, so the API is a complete record even for claims that were only digested.

---

## Claim types

| Type | Program | Meaning |
|------|---------|---------|
| `collect_creator_fee` | Pump | Creator collecting bonding-curve fees |
| `collect_coin_creator_fee` | PumpAMM | Creator collecting post-graduation AMM fees |
| `distribute_creator_fees` | Pump | Payout split across fee shareholders |
| `transfer_creator_fees_to_pump` | PumpAMM | Fees routed back to the Pump program |
| `claim_social_fee_pda` | PumpFees | GitHub-assigned developer claiming social fees |
| `claim_cashback` | Pump / PumpAMM | User refund. Excluded by default |

Both V1 and V2 instruction discriminators are matched, and V2's trailing `quote_mint` field is decoded so USDC-paired coins report the correct currency.

---

## Detection

Claims are found by subscribing to program logs for the Pump, PumpAMM, and PumpFees programs, then fetching only the transactions that look like claims.

That filter is the load-bearing part, and it needs both of its paths:

- **Anchor instruction log lines** catch `claim_social_fee_pda`, which emits no CPI event at all on a fake claim. The log line is the only trace it leaves.
- **Event discriminators** on `Program data:` lines catch creator fee claims, which emit events but carry no social instruction log.

A filter keyed only on the social instruction discards every pure creator-fee claim before it is ever fetched, which is the entire product for this bot. `classifyClaimLogs()` is exported and covered by tests for exactly this reason.

Cashback is classified separately so that refund transactions, the highest-volume claim type on chain, are not fetched when the feed excludes them. Fetching them saturates the RPC queue and starves real creator claims. When the queue does overflow, the drop count is reported in the heartbeat log and in `/stats` rather than being swallowed.

---

## Development

```bash
npm run dev        # hot reload
npm test           # 36 tests: dispatcher routing, formatters, log classification
npm run typecheck
npm run build && npm start
```

## Deploy

A `Dockerfile` and `railway.json` are included:

```bash
docker build -t pumpkit-allclaims .
docker run --env-file .env -p 3000:3000 pumpkit-allclaims
```

### Cloud Run (production)

The feed runs as the `pumpfun-allclaims-bot` Cloud Run service (project
`aerial-vehicle-466722-p5`, region `us-central1`), deployed 2026-08-01. Deploy or
redeploy with:

```bash
PROJECT=aerial-vehicle-466722-p5 ./deploy-cloudrun.sh
```

The script stores `TELEGRAM_BOT_TOKEN` in Secret Manager
(`pumpfun-allclaims-bot-token`, runtime SA needs `secretAccessor` on it), ships
every other `.env` key through a YAML env file (never `--set-env-vars`: the RPC
list contains commas), pins the `three-ws-build@` build SA and `three-ws@`
runtime SA, and runs a single always-on instance (`--min-instances 1
--no-cpu-throttling`) so the websocket subscription survives idle periods.
`CHANNEL_ID` must be the numeric `-100...` chat id, and the script refuses
anything else. The service is private; check it with:

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "$(gcloud run services describe pumpfun-allclaims-bot --region us-central1 \
    --project aerial-vehicle-466722-p5 --format='value(status.url)')/stats"
```

**When `gcloud` cannot mint that token, verify from the public channel instead.**
A recycled codespace answers `Reauthentication failed. cannot prompt during
non-interactive execution` on every `gcloud` call, and an org reauth policy
cannot be satisfied non-interactively, so the command above is unavailable
exactly when someone is trying to confirm the feed is alive. A post is the
stronger signal anyway: it proves the deployed service decoded a real event and
delivered it, not merely that a container is `Ready`.

```bash
# @pumpfunclaimed is a channel, so the web preview lists post timestamps
curl -s -A Mozilla/5.0 https://t.me/s/pumpfunclaimed |
  grep -o 'datetime="[^"]*"' | tail -3
```

Before treating the reading as proof of Cloud Run, rule out a local bot as the
source: no `node` process whose `/proc/<pid>/cwd` is under this repo, and the
local stats port refusing the connection.

Two settings are load-bearing and were learned the hard way:

- **Memory is 2 GiB, and the Node heap cap must stay below it.** The service
  originally ran at 1 GiB against a `--max-old-space-size=2048` Dockerfile flag,
  so Node was permitted a heap twice the container's limit and Cloud Run killed
  it with `Memory limit of 1024 MiB exceeded`. The container is now 2 GiB and the
  heap cap 1536 MB, leaving headroom for RSS overhead. Change one and you must
  change the other.
- **The deploy stages a snapshot of `src/` before uploading.** Other agents edit
  this worktree concurrently, and `gcloud run deploy --source .` uploads files
  one at a time, so an edit landing mid-upload ships a torn tree that fails
  `tsc` in Cloud Build while the source on disk is perfectly fine. That failure
  looks exactly like a real type error and costs a six-minute build to diagnose.

**Lost your `.env`?** It is gitignored, so a codespace rebuild deletes it, and
without it neither `npm start` nor `deploy-cloudrun.sh` can run. The deployed
revision is the durable copy. Rebuild the file from it:

```bash
PROJECT=aerial-vehicle-466722-p5 ./recover-env.sh          # writes .env, refuses to clobber
PROJECT=aerial-vehicle-466722-p5 ./recover-env.sh --force  # replaces an existing .env
```

It reads the non-secret keys off the live revision, pulls `TELEGRAM_BOT_TOKEN`
out of Secret Manager, applies the same numeric-`CHANNEL_ID` guard the deploy
applies, and writes `.env` mode `0600`. It is the exact inverse of
`deploy-cloudrun.sh` and takes the same `PROJECT`/`REGION`/`SERVICE`/`SECRET_NAME`
overrides. If gcloud has no usable credentials it says so and stops, because
that is the normal state after a rebuild and the fix (`gcloud auth login`) is
interactive.

Local fallback if Cloud Run is ever down: `npm run build && npm start` from this
directory (port 3901 locally; 3900 belongs to channel-bot). Kill a local
instance by matching `/proc/<pid>/cwd` to this directory, never by the
`node dist/index.js` cmdline, which is relative and matches unrelated services
(including ones under `/workspaces/three.ws`, which must never be killed).

**Verified baseline** (2026-08-02, revision `-00005`, 3h43m uptime): websocket
mode against `rpc.magicblock.app/mainnet`, 18.2M events observed, 2980 claim
transactions seen, 1931 claims detected across every layout
(`collect_creator_fee=1130, collect_coin_creator_fee=543,
distribute_creator_fees=142, transfer_creator_fees_to_pump=100,
claim_social_fee_pda=14`), 0 dropped by a full queue, 224 digests posted.

### Decoder provenance (this file is canonical)

**`src/claim-monitor.ts` in this package is the canonical claim decoder.** It
started as a copy of `channel-bot/src/claim-monitor.ts` but has since moved ahead
of it, so the arrow now points the other way: on 2026-08-01 its two-path log
filter was back-ported *into* channel-bot, which until then recognized only
`ClaimSocialFeePda` and therefore silently dropped every pure creator-fee claim.

The `@pumpkit/core` and `@pumpkit/channel` decoders are March snapshots missing
the post-2026-05-21 V2 layouts (quote-mint claims, lifetime claimed totals, fake
social-claim detection). Do not copy from them, and do not resync this file from
them.

The full ranking, the reasoning for not extracting a shared package, and the
rule for future bots live in [`DECODERS.md`](../../../DECODERS.md) at the repo
root.

## Related

- [`@pumpkit/channel`](../channel/) — first-claims-only curated feed
- [`@pumpkit/claim`](../claim/) — interactive DM bot for tracking specific tokens
- [`@pumpkit/core`](../core/) — shared framework
