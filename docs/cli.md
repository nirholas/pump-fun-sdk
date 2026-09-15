# The `pump` CLI

> Inspect, trade, and launch Pump tokens from your terminal. Ships with `@nirholas/pump-sdk`, needs no wallet for reads, and every command speaks `--json`.

The CLI is built on the same instruction builders the SDK exports. Anything it does, your code can do in three lines of TypeScript. Use the CLI to answer a question fast; use the SDK to put the answer in a product.

## Table of contents

- [Install](#install)
- [Sixty seconds in](#sixty-seconds-in)
- [Configuration](#configuration)
- [Reading the chain](#reading-the-chain)
- [Quoting a trade](#quoting-a-trade)
- [Trading](#trading)
- [Launching a token](#launching-a-token)
- [Earnings](#earnings)
- [Utilities](#utilities)
- [JSON output and scripting](#json-output-and-scripting)
- [Safety model](#safety-model)
- [Troubleshooting](#troubleshooting)

---

## Install

```bash
npm install -g @nirholas/pump-sdk
pump --version
```

Or run it without installing anything:

```bash
npx -p @nirholas/pump-sdk pump curve <mint>
```

Requirements: Node.js 18 or later. Nothing else. No wallet, no API key, no account.

---

## Sixty seconds in

Every read command works out of the box against the default public mainnet RPC:

```bash
# What is this token worth, and how close is it to graduating?
pump curve FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump

# What would 1 SOL actually buy, after fees and price impact?
pump quote buy FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump --sol 1

# Watch it move.
pump watch FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump
```

`pump curve` on a live token prints a full snapshot:

```
FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump live on the bonding curve
────────────────────────────────────────────────────────────

  Market cap   93.705347 SOL
  Buy price    0.000000096 SOL per token
  Sell price   0.000000091 SOL per token
  Trading fee  1.25% 0.95% protocol + 0.3% creator

  Graduation  ███████████████░░░░░░░░░ 61.39%

  SOL to graduate   60.684661 SOL
  SOL in curve      24.921536 SOL
  Tokens left       306.21M of 793.1M
  Virtual reserves  54.921536 SOL / 586.11M tokens
  Real reserves     24.921536 SOL / 306.21M tokens
  Total supply      1B
```

Run `pump doctor` first if anything looks wrong. It checks the RPC, the protocol accounts, the wallet, and the balance in one shot, and every failing check tells you the fix.

---

## Configuration

Precedence, highest wins: **command flag → environment variable → `~/.pump/config.json` → built-in default.**

| Setting | Flag | Environment | Config key | Default |
|---|---|---|---|---|
| RPC endpoint | `--rpc <url>` | `PUMP_RPC_URL`, `SOLANA_RPC_URL` | `rpcUrl` | `https://api.mainnet-beta.solana.com` |
| Failover endpoints | (part of `--rpc`, comma separated) | | `fallbackRpcUrls` | none |
| Signer keypair | `--keypair <path>` | `PUMP_KEYPAIR`, `SOLANA_KEYPAIR` | `keypair` | `~/.config/solana/id.json` |
| Slippage (percent) | `--slippage <n>` | `PUMP_SLIPPAGE` | `slippage` | `1` |
| Priority fee (micro-lamports/CU) | `--priority-fee <n>` | `PUMP_PRIORITY_FEE` | `priorityFee` | `0` |
| Compute unit limit | `--compute-unit-limit <n>` | | `computeUnitLimit` | `300000` |

```bash
pump config set rpcUrl https://your-endpoint.example.com
pump config set fallbackRpcUrls https://backup-a.example.com,https://backup-b.example.com
pump config set keypair ~/.config/solana/id.json
pump config list          # effective values, with their sources
pump config path          # where the file lives
pump config unset rpcUrl  # back to the default
```

The config file is written mode `0600`. Set `PUMP_CONFIG_DIR` to relocate it (useful for per-project configs and CI).

### Keypair formats

`--keypair` accepts all three shapes people actually have:

1. A `solana-keygen` JSON byte array file (`[12,34,...]`).
2. A file containing a base58 secret key, which is what most wallet exports produce.
3. A raw base58 secret key in `PUMP_KEYPAIR` itself, for CI where writing a key file is worse than an env var.

---

## Reading the chain

### `pump curve <mint>`

The full picture: price, market cap, fee tier, graduation meter, reserves, creator, and links.

If the token has already graduated, its bonding curve reads all zeros on chain (the program wipes the reserves at migration). Rather than reporting a market cap of zero, the command reads the PumpAMM pool and prices the token from real pool liquidity.

### `pump price <mint>`

Just the numbers: buy price, sell price, the spread between them (which is the round-trip fee cost), and market cap.

### `pump pool <mint>`

PumpAMM pool state for a graduated token: liquidity in both legs, implied spot price, LP supply, and the pool, LP mint, and creator-vault addresses. Fails with a pointer to `pump curve` if the token has not graduated yet.

### `pump global`

Protocol-wide configuration: authorities, fee recipient, the initial virtual and real reserves every new curve is seeded with, and the market-cap fee tiers.

### `pump watch <mint>`

A live dashboard that refreshes on an interval, showing the market cap trend and the graduation meter moving.

```bash
pump watch <mint> --interval 3     # every 3 seconds
pump watch <mint> --count 20       # 20 refreshes, then exit
pump watch <mint> --json | jq -c   # one JSON object per poll, as a feed
```

It polls rather than subscribing, because `accountSubscribe` is unavailable on most free RPC lanes and a command that only works on a paid endpoint is a command that does not work. A transient RPC error mid-watch is retried, not fatal. The watch stops itself when the token graduates.

---

## Quoting a trade

Quotes need no wallet and send nothing.

```bash
pump quote buy  <mint> --sol 1
pump quote sell <mint> --tokens 5000000
pump quote sell <mint> --percent 50     # of your configured wallet's balance
```

Each quote reports what you get, the fees, the effective price you actually pay per token, the price impact, and the spot price before and after the trade. Impact above 5% raises a warning suggesting you split the order.

A sell quote also checks the amount against the curve's safe sell ceiling. Above it, the on-chain math overflows and the transaction will be rejected, so the CLI says so and suggests selling in chunks instead of letting you discover it from a failed transaction.

---

## Trading

```bash
pump buy  <mint> --sol 0.5
pump sell <mint> --tokens 1000000
pump sell <mint> --percent 25
pump sell <mint> --all
```

Buys and sells route automatically: a token still on its bonding curve fills against the curve, a graduated token fills against the PumpAMM pool. You do not have to know which.

`--all` uses the SDK's sell-everything path, which also closes the associated token account and reclaims its rent, so exiting a position leaves nothing behind.

Every trade:

1. Checks the wallet can cover the amount plus fees, before building anything.
2. Builds the instructions and attaches a compute budget.
3. **Simulates the transaction**, and refuses to continue if the simulation fails, reporting the Anchor error message rather than 40 lines of program logs.
4. Prints exactly what is about to happen and waits for your confirmation.
5. Sends, confirms, and prints the explorer link.

```
Buy on bonding curve simulated OK
──────────────────────────────────

  Token          8ySri4NPaCHFHn4JfDzLjiBemn9ktk6FEZamMDkupump
  Spending       0.5 SOL
  Expected       16.9M tokens
  Price impact   3.49%
  Slippage       1%
  Payer          88FraXPEfzmRq3r4hmCHWN7jQWLuAUHKy9Y477z1DANx
  Priority fee   none
  Compute units  61432 used of 300000 requested

Send this transaction? [y/N]
```

### Priority fees

Under congestion, add one:

```bash
pump buy <mint> --sol 0.5 --priority-fee 50000
```

The value is micro-lamports per compute unit. The confirmation screen reports the compute units actually consumed by the simulation, so you can size it honestly rather than guessing.

---

## Launching a token

```bash
# 1. Grind a mint address ending in `pump` (about 11 million attempts, seconds to minutes)
pump vanity --suffix pump

# 2. Launch with it, and take the first buy in the same transaction
pump create \
  --name "My Token" \
  --symbol MTK \
  --uri https://your-host.example.com/metadata.json \
  --mint-keypair ~/.pump/mints/<address>.json \
  --buy 0.5
```

`--uri` is the metadata **JSON** URL, not the image URL. The JSON holds the image URL. Passing an image directly is the single most common launch mistake, so the CLI rejects anything that is not an http(s) URL up front.

Other options: `--creator <address>` to route the creator fee somewhere other than the signer, `--mayhem` for mayhem mode, `--holder-reward` to distribute creator fees to holders, and `--vanity-suffix <suffix>` to grind inline instead of preparing a keypair first (the ground key is still written to disk before the transaction is submitted, so a crash cannot lose an address you just paid for). New cashback launches are deprecated; existing cashback coins remain tradeable and claimable.

---

## Earnings

Creator fees and volume incentives both accrue across two programs, the bonding curve program and PumpAMM. Checking by hand means deriving four PDAs, so most creators never look.

```bash
pump fees                 # the configured wallet's unclaimed creator fees
pump fees <creator>       # any address
pump fees claim           # collect from both programs in one transaction

pump incentives           # unclaimed volume-reward tokens
pump incentives <user>
pump incentives claim
```

Volume incentives settle a day in arrears, so `pump incentives` reports today's accrual separately from what is claimable now.

---

## Utilities

### `pump pda`

Derive any Pump program address. Run it bare to list every kind:

```bash
pump pda                                # list all derivations
pump pda bonding-curve <mint>
pump pda pool <mint>
pump pda creator-vault <creator>
pump pda user-volume <user>
pump pda global                         # fixed protocol accounts too
pump pda program-pump
```

An unknown kind suggests the closest matches rather than just failing.

### `pump events <signature>`

Decode every Pump event in a transaction. Explorers show these as opaque base64 `Program data:` lines; the SDK knows all 60-odd event layouts across the three programs.

```bash
pump events <signature>
pump events <signature> --finalized     # if it is not visible at `confirmed` yet
pump events <signature> --json | jq '.events[] | select(.type == "trade")'
```

### `pump vanity`

```bash
pump vanity --suffix pump               # the pump.fun convention
pump vanity --prefix MOON --case-insensitive
pump vanity --suffix cool --out ./my-mint.json
pump vanity --suffix pump --max-attempts 50000000
```

Prints the expected attempt count before it starts, so you know whether you asked for seconds or days, and warns when a pattern is long enough to be impractical on one core. Ctrl-C cancels cleanly. The result is written mode `0600` and never printed to the terminal.

### `pump doctor`

Checks the RPC endpoint and its latency, whether the Pump global account decodes (which catches pointing at devnet, where the programs do not exist), whether a wallet loads, and whether it has enough SOL to trade. Exits non-zero if any check fails, so it works in CI.

---

## JSON output and scripting

Every command accepts `--json`. In JSON mode stdout carries the object and nothing else: progress, prompts, and errors go to stderr, so a pipe is always parseable.

```bash
# Market cap of a token, as a number
pump curve <mint> --json | jq .marketCapSol

# Alert when a token crosses 90% of the way to graduation
pump curve <mint> --json | jq -e '.graduation.progressBps > 9000' && notify-send "almost there"

# Every trade in a transaction
pump events <sig> --json | jq '.events[] | select(.type=="trade") | {side: .data.isBuy, sol: .data.solAmount}'

# A price feed
pump watch <mint> --json --interval 10 | while read -r line; do
  echo "$line" | jq -r '"\(.at) \(.marketCapSol)"'
done
```

Numbers are emitted twice where it matters: as an exact integer string in the chain's own units (`marketCapLamports: "93705347000"`) and as a convenient float (`marketCapSol: 93.705347`). Use the string when precision matters; `BN` values would otherwise lose precision as JSON numbers.

Errors in JSON mode are objects too, so a script never has to parse prose:

```json
{
  "error": "No pump bonding curve exists for <mint>",
  "hint": "Check the mint address. Tokens launched outside pump.fun have no bonding curve..."
}
```

---

## Safety model

The CLI moves real funds, so the rules are explicit:

- **Reads never touch a keypair.** `curve`, `price`, `pool`, `quote`, `watch`, `events`, `pda`, and `global` work on a machine with no wallet on it.
- **Nothing is sent without a simulation succeeding first.** A trade that would fail on chain fails locally instead, with the program's own error message.
- **Nothing is sent without an explicit yes.** `--yes` skips the prompt for scripts, and `--simulate` stops after the simulation and sends nothing.
- **A non-interactive invocation with no `--yes` refuses rather than proceeding.** A piped command must never spend funds just because nobody was there to say no.
- **Balance is checked before building.** You get a clear "holds 0 SOL, which does not cover 0.5 SOL plus fees" instead of a simulation failure.
- **Keypairs are written mode `0600` and never printed.**

```bash
pump buy <mint> --sol 0.1 --simulate     # dry run, no prompt, nothing sent
pump buy <mint> --sol 0.1 --yes          # no prompt, DOES send
```

---

## Troubleshooting

**`No pump bonding curve exists for <mint>`**
The address is not a Pump token, or you are pointed at the wrong network. The Pump programs are mainnet only. Run `pump doctor`.

**`Division by zero` (SDK versions before 1.36.0)**
A graduated token's bonding curve reads all zeros. Upgrade: the analytics helpers now report a graduated curve rather than throwing, and `pump curve` reads the AMM pool for those tokens.

**`excluded from account secondary indexes`**
Your RPC refuses `getProgramAccounts` for the Pump program. That method is not used by any CLI command; if you hit it from your own code, use a dedicated endpoint.

**Rate limited / very slow**
The default public endpoint is shared and throttled. `pump doctor` flags latency over 2 seconds. Point at a dedicated endpoint with `pump config set rpcUrl <url>`, and add fallbacks with `pump config set fallbackRpcUrls <a>,<b>`.

**A trade simulates fine and then fails on chain**
The price moved between simulation and landing. Raise `--slippage`, and add `--priority-fee` so the transaction lands sooner.

**`Confirmation required but stdin is not a terminal`**
You piped a command that spends funds. Add `--yes` if you meant it, or `--simulate` if you did not.

---

## See also

- [Getting started with the SDK](./getting-started.md), the programmatic equivalent of everything above
- [API reference](./api-reference.md)
- [Bonding curve math](./bonding-curve-math.md), what the quote numbers actually mean
- [Fee tiers](./fee-tiers.md), why the trading fee changes with market cap
- [Vanity address guide](./cli-guide.md), the standalone Rust and `solana-keygen` grinders
- [Error handling](./errors.md)
- [Tutorial: the CLI in ten minutes](../tutorials/45-cli-quickstart.md)
