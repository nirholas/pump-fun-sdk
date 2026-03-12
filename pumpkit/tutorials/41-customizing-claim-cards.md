# Tutorial 2: Customizing Claim Cards

> Modify the claim card layout, add your own data points, and adjust what triggers notifications.

## Formatter Architecture

All claim cards are built in `packages/monitor/src/formatters.ts` (or `packages/channel/src/formatters.ts` for the channel bot). The formatter receives a `ClaimFeedContext` object and returns HTML for Telegram.

### ClaimFeedContext Fields

| Field | Type | Source |
|-------|------|--------|
| `event` | `FeeClaimEvent` | On-chain transaction data |
| `solUsdPrice` | `number` | CoinGecko/Jupiter price API |
| `githubUser` | `GitHubUserInfo` | GitHub API (from social fee PDA user ID) |
| `xProfile` | `XProfile` | X/Twitter API (from GitHub profile) |
| `tokenInfo` | `TokenInfo` | PumpFun API (MC, price, status, image) |
| `creatorProfile` | `CreatorProfile` | PumpFun API (creator's other launches) |
| `repoInfo` | `GitHubRepoInfo` | GitHub API (linked repo stars, language) |
| `holders` | `HolderDetails` | PumpFun API (top 10, concentration) |
| `trades` | `TokenTradeInfo` | PumpFun API (recent volume, buy/sell counts) |
| `devWallet` | `DevWalletInfo` | Solana RPC (SOL balance, token holdings) |
| `liquidity` | `PoolLiquidityInfo` | DexScreener API (pool liquidity, MC/Liq ratio) |
| `bundle` | `BundleInfo` | Trench API (bundled early buys) |
| `allLinkedTokens` | `TokenInfo[]` | All tokens this PDA earns fees from |
| `sameNameTokens` | `SameNameToken[]` | Copycat detection (same name, higher MC) |

### Card Section Order

The card is built top-to-bottom:

1. **Badge** — FIRST CLAIM / REPEAT / FAKE
2. **CA** — Contract address (monospace)
3. **Token Info** — Name, MC, price, status, ATH, liquidity
4. **All Linked Coins** — Every token this user earns fees from
5. **Claim Stats** — Amount, lifetime total, claim number
6. **Claimed By** — Wallet address + pump.fun profile link
7. **Transaction** — Solscan link
8. **Linked Dev** — GitHub profile, repos, followers, X handle
9. **Repo Claimed** — GitHub repo details (if token has GitHub URL)
10. **Token Creator** — Pump.fun creator profile + recent launches
11. **Dev Wallet** — SOL balance
12. **Market Data** — Holders, concentration, bundle info
13. **Trust Signals** — Warnings (rugs, copycats, bundles)
14. **Same Name Tokens** — Copycat detection
15. **Chart** — pump.fun link
16. **Socials** — X, GitHub, website
17. **Trade Links** — Axiom, GMGN, Padre (with referral codes)

## Adding a Custom Data Point

### Example: Add "Token Age" to the card

1. The data is already available in `tokenInfo.createdTimestamp`
2. Find the TOKEN INFO section in `formatters.ts`
3. Add your line:

```typescript
// In the TOKEN INFO section
if (tokenInfo.createdTimestamp > 0) {
    const ageMs = Date.now() - tokenInfo.createdTimestamp * 1000;
    const ageDays = Math.floor(ageMs / 86_400_000);
    L.push(`📅 Age: ${ageDays} days`);
}
```

## Filtering Claims

### Only show claims above a threshold

In `packages/monitor/src/index.ts`, find the claim handler and add:

```typescript
// Skip small claims
if (event.amountSol < 0.01) return;
```

### Only show first-time claims

```typescript
if (!isFirstClaim) return;
```

### Only show graduated tokens

```typescript
if (tokenInfo && !tokenInfo.complete) return;
```

## Adding Referral Links

Edit the trade links section in `formatters.ts`:

```typescript
const axiomUrl = `https://axiom.trade/t/${mint}?ref=YOUR_REF`;
const gmgnUrl = `https://gmgn.ai/sol/token/${mint}?ref=YOUR_REF`;
const padreUrl = `https://trade.padre.gg/rk/YOUR_REF`;
```

Or set them via environment variables:

```bash
AXIOM_REF=your_axiom_ref
GMGN_REF=your_gmgn_ref
PADRE_REF=your_padre_ref
```
