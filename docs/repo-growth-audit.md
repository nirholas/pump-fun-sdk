# Repository growth audit

**Date:** 2026-09-11
**Subject:** `nirholas/pump-fun-sdk` at 121 stars, 38 forks, 1 watcher, 800 npm downloads/month.

This audit compares the repo against the leading pump.fun and Solana SDK repositories on
GitHub and lists, in priority order, what is costing us adoption. Every number below was
read from the GitHub and npm APIs on the date above; re-run the commands in
[Verifying this audit](#verifying-this-audit) before trusting any of them later.

---

## The competitive picture

| Repo | Stars | npm/month | License | Last commit | State |
|---|---:|---:|---|---|---|
| `rckprtr/pumpdotfun-sdk` | 821 | 10,644 | MIT | 2025-04-11 | **Abandoned**, 62+ open issues |
| `0xfnzero/pumpfun-sdk` (Rust) | 83 | n/a | | active | Rust only |
| `cryptoscan-pro/pumpfun-sdk` | 34 | low | | active | API wrapper, not on-chain |
| `@pump-fun/pump-sdk` (official) | n/a | 72,027 | | active | First-party, narrow scope |
| **`nirholas/pump-fun-sdk`** | **121** | **800** | **contradictory** | **today** | Broadest feature set |

### The opening

`rckprtr/pumpdotfun-sdk` is the repo developers find when they search "pump fun sdk". It has
**821 stars, 322 forks and 10,644 npm downloads a month, and it has been dead since April
2025.** Its issue tracker is the evidence:

- `Failed: incorrect program id for instruction` (2025-11-27, unanswered) - it no longer
  works against the current on-chain program.
- `Rebuilt and modernized the current Pump.fun library` (2026-01-22) - someone offering a
  rewrite because nobody is maintaining it.
- 12 of the issues on the first page have zero replies.

Ten thousand downloads a month are flowing into a broken library whose maintainer left.
Nobody has claimed the "maintained successor" position. We are the only candidate with a
wider feature set and commits landing today, and we are not saying so anywhere.

---

## Priority 1: the repo claims four different licenses

This is the single largest adoption blocker and it is not a matter of taste.

| Source | Claims |
|---|---|
| `LICENSE` | **Proprietary.** "All rights reserved... may not be used, copied, modified, distributed... without the express written permission of the copyright owner." |
| `package.json` | Apache-2.0 |
| `NOTICE` | Apache-2.0 (cites Apache section 4) |
| `README.md` | Apache-2.0, linking to the proprietary `LICENSE` |
| `CITATION.cff` | was MIT (now Apache-2.0, see below) |
| npm `1.30.0` | MIT |
| npm `1.32.0`+ | Apache-2.0, while the tarball ships the proprietary `LICENSE` |

Consequences, all of them live right now:

- GitHub cannot classify it, so the sidebar reads **"Other"** instead of a license badge,
  and the repo is excluded from `license:apache-2.0` and `license:mit` search filters.
- Every corporate OSS review, and every automated scanner (FOSSA, Snyk, GitHub dependency
  insights), reads the `LICENSE` file. It says the software may not be used. That is a
  hard stop for any company evaluating us, and a reason for an individual to pick the
  competitor.
- The competitor is unambiguously MIT.

**This needs an owner decision, because relicensing is a legal choice, not an engineering
one.** The repo's own weight of evidence is Apache-2.0: `package.json`, `NOTICE` and the
`README` all say so, and `NOTICE` is written as an Apache attribution notice. If that is
the intent, the fix is one command:

```bash
# From the repo root. Replaces the proprietary text with the real Apache-2.0 licence.
curl -fsSL https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE
```

Then confirm GitHub picks it up: the sidebar should read "Apache-2.0" within a minute of
the push, and `gh api repos/nirholas/pump-fun-sdk --jq .license.spdx_id` should stop
returning `NOASSERTION`.

If the intent is genuinely proprietary, then `package.json`, `NOTICE`, `README.md` and the
npm listings are all wrong and the word "SDK" is misleading. Either way the contradiction
has to go.

---

## Priority 2: CI has never passed (fixed)

218 workflow runs, **zero successes**, so every commit on the repo's front page carried a
red X. On a project that asks people to hand it keypairs, that is the worst possible first
impression.

Both causes were small and are fixed in this branch:

- **Lint: 462 errors.** 159 were in `pump-fun-repos/`, vendored upstream sources that are
  not ours to restyle. 142 were `process`, `console` and `fetch` reading as `no-undef`
  because the flat config never declared Node globals. The rest were real but trivial.
- **Test: one coverage threshold.** `analytics.ts` sat at 87.27% against a 90% bar. The gap
  was `bondingCurveGraduationProgress`, a public export with no test at all, and the
  `getTokenPrice` guard that stops a migrated curve dividing by zero. Both now have real
  tests; the threshold was not lowered. `analytics.ts` is at 100% lines, the suite went
  from 301 to 310 tests.

A genuine parse error also surfaced: `vanity-demo/src/app/page.tsx` had unescaped double
quotes inside two double-quoted strings, so that file never compiled.

Type Check, Lint, Build and Test now all exit 0.

**Second-order effect:** `release.yml` runs `semantic-release` after `npm run test:coverage`.
Because the test job always failed, **semantic-release never ran**, which is why the repo
has **0 GitHub releases and 0 tags** at version 1.36.0, and why npm has not seen a publish
since 2026-08-04. Green CI should restore automatic releases on the next push to `main`.
Watch that first run: if `NPM_TOKEN` has expired, the release job will now fail loudly
where it used to be masked by the test failure.

---

## Priority 3: GitHub thinks this is a Rust repo (fixed)

The language bar said **Rust**. Of 9.46 MB of `.rs`, **9.35 MB (98.8%) is vendored upstream
code** under `pump-fun-repos/` (carbon and friends), against 5.4 MB of our own TypeScript.

Effect: a developer filtering for a TypeScript Solana SDK never saw us. `.gitattributes`
now marks that tree `linguist-vendored`, which is what it is.

---

## Priority 4: description and topics

### Description

Current:

> Token creation launching, bonding curve trading, AMM migration, tiered fees, creator fee sharing, vanity keygen, MCP server, Telegram bot & live dashboards

It is a feature list. It never says what the thing **is**, and it omits the exact strings
people search for. It does not contain "TypeScript", "SDK", "pump.fun" (only "pumpfun"),
or "Solana". GitHub weights the description heavily in search.

Proposed:

> TypeScript SDK for pump.fun on Solana: token creation, bonding curves, AMM migration, fee sharing, vanity mints, a CLI, and an MCP server for AI agents.

That carries TypeScript, SDK, pump.fun, Solana, bonding curve, AMM, CLI, MCP and AI agents
in 147 of the 350 allowed characters.

### Topics

We use 12 of the 20 allowed, and three of them (`meme`, `memecoin`, `memecoins`) are near
duplicates while `fun` and `cryptocurrency` are noise. Missing entirely: `typescript`,
`sdk`, `pump-fun` (hyphenated, a distinct search term from `pumpfun`), `bonding-curve`,
`mcp`, `mcp-server`, `ai-agents`, `defi`, `web3`, `cli`, `amm`.

### Applying both

Repository metadata cannot be changed from this workspace; the Codespace token returns
`403 Resource not accessible by integration`. The owner can apply the whole change with:

```bash
gh api -X PATCH repos/nirholas/pump-fun-sdk \
  -f description='TypeScript SDK for pump.fun on Solana: token creation, bonding curves, AMM migration, fee sharing, vanity mints, a CLI, and an MCP server for AI agents.' \
  -f homepage='https://sdk.pumpk.it'

gh api -X PUT repos/nirholas/pump-fun-sdk/topics \
  -f names[]=solana -f names[]=typescript -f names[]=sdk \
  -f names[]=pumpfun -f names[]=pump-fun -f names[]=pump \
  -f names[]=bonding-curve -f names[]=amm -f names[]=defi -f names[]=web3 \
  -f names[]=mcp -f names[]=mcp-server -f names[]=ai-agents -f names[]=cli \
  -f names[]=token-launchpad -f names[]=vanity-address -f names[]=memecoin \
  -f names[]=trading -f names[]=crypto-bot -f names[]=anchor
```

---

## Priority 5: dead links and a wrong citation (fixed)

- `README.md` advertised `https://nirholas.github.io/pump-fun-sdk/` as the "full
  documentation site". GitHub Pages was never enabled on this repo, so it 404s. Repointed
  to `sdk.pumpk.it`, which is live and is already the package homepage.
- `docs/defi-agents.md` and `docs/ecosystem.md` documented the agent registry as an API on
  that same dead Pages host. It serves from `agents.pumpk.it`; verified against both
  `index.json` and a per-agent document before repointing.
- `CITATION.cff` **described a different project entirely** (`solana-wallet-toolkit`), with
  `repository-code` pointing at that other repo, so GitHub's "Cite this repository" button
  offered a citation for the wrong software. Rewritten to describe this project. Note its
  `license:` field now reads Apache-2.0 to match `package.json`, `NOTICE` and the `README`;
  revisit if Priority 1 resolves differently.

---

## Priority 6: community signals we are leaving on the table

- **1 watcher.** 121 people starred; one subscribes to activity. The competitor has 27.
- **Discussions disabled**, despite `.github/DISCUSSION_TEMPLATE/` already containing three
  configured templates (`q-a`, `ideas`, `show-and-tell`). Turning it on costs nothing:
  `gh api -X PATCH repos/nirholas/pump-fun-sdk -F has_discussions=true`
- **Two issues unanswered for months.** `#7 [bug] package.json configuration` (2026-05-11)
  and `#8 feat: USDC quote-mint support` (2026-06-04) both have zero replies. `#8` is a
  contributor offering work. Unanswered issues are the clearest signal a repo is dying, and
  they are the first thing a developer checks after the star count. Answering both is
  ten minutes and is worth more than a feature.
- **No social preview image.** GitHub is auto-generating one. `.github/banner.svg` already
  exists; a 1280x640 PNG uploaded in Settings makes every share on X and Telegram render as
  a branded card instead of grey text.
- **No pinned "start here" issue** and no release notes for people to follow.

---

## Priority 7: README structure

The README is 578 lines and the content quality is high. Two structural problems:

1. **The reader hits promotional material before they learn what the library does.**
   Order today: title, badges, one-paragraph description, table of contents, "Live Demos &
   Resources" (9 links), "Proof & Virality" (tweet embeds), "Looking for more? Check out
   PumpKit", and only then Quick Start at line 96. A developer evaluating an SDK wants the
   install line and a working snippet inside the first screen. Tweet screenshots read as
   marketing to that reader, not as evidence. Move Quick Start directly under the
   description, and fold demos, virality and PumpKit into a single section near the end.

2. **Nothing states the one fact that would win the competitor's users.** There is no line
   saying this SDK is actively maintained, tracks the current on-chain program, and is the
   drop-in path off an abandoned alternative. That claim belongs near the top, stated
   plainly and without naming the other project disparagingly. A short "Migrating from
   another pump.fun SDK" section mapping the common call sites would convert directly
   against those 322 forks.

Also worth adding, in the order a reader needs them: a CI status badge (meaningful now that
it passes), the supported Node and Solana web3.js versions, and a one-line statement of what
the SDK does **not** do (it never sends transactions; it returns instructions). That last
point is currently buried in prose and is exactly the design decision a senior evaluator
wants stated up front.

---

## Priority 8: repository weight

The repo is **79,843 KB against the competitor's 150 KB**, with 38 top-level directories.
It carries bots, dashboards, a website, a Rust vanity generator, vendored upstream repos and
the SDK itself. `git clone` is slow and a first-time reader cannot tell where the SDK is.

This is not urgent and splitting it is a large change, but it is the reason the repo reads
as a monorepo of side projects rather than as a library. Two cheaper options that keep one
repo: a `## Repository layout` table at the top of the README mapping each top-level
directory to its purpose, and moving `pump-fun-repos/` (vendored upstream, 9.3 MB) to a
submodule or dropping it, since it exists only as reference material.

---

## Verifying this audit

```bash
# Repo metadata, topics, license classification
gh api repos/nirholas/pump-fun-sdk --jq '{description,topics,license:.license.spdx_id,size,subscribers_count,has_discussions}'

# Workflow success rate
gh api 'repos/nirholas/pump-fun-sdk/actions/runs?status=success&per_page=1' --jq .total_count

# Releases and tags
gh api repos/nirholas/pump-fun-sdk/releases --jq length
gh api repos/nirholas/pump-fun-sdk/tags --jq length

# npm reach, ours against the abandoned leader
curl -s https://api.npmjs.org/downloads/point/last-month/@nirholas/pump-sdk
curl -s https://api.npmjs.org/downloads/point/last-month/pumpdotfun-sdk

# Competitor liveness
gh api 'repos/rckprtr/pumpdotfun-sdk/commits?per_page=1' --jq '.[0].commit.author.date'
```

---

## Summary

| # | Item | Status | Owner action needed |
|---|---|---|---|
| 1 | Four contradictory licenses | **Open** | **Yes, legal decision** |
| 2 | CI never passed (0/218) | Fixed | Push |
| 3 | Language reported as Rust | Fixed | Push |
| 4 | Description and topics | Prepared | Yes, run the two `gh` commands |
| 5 | Dead links, wrong citation | Fixed | Push |
| 6 | Discussions, watchers, stale issues | Open | Yes, low effort |
| 7 | README order and positioning | Open | Follow-up change |
| 8 | 80 MB repo, 38 top-level dirs | Open | Larger refactor |
