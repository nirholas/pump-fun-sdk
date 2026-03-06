# Tutorial 19: CoinGecko Integration

> Enrich your Pump token data with CoinGecko market feeds — SOL/USD prices, trending tokens, and metadata lookup.

## Why CoinGecko?

The Pump SDK gives you on-chain bonding curve data (SOL-denominated). CoinGecko adds:
- **SOL/USD price** — convert market caps and prices to dollars
- **Token discovery** — find newly listed Pump tokens
- **Historical prices** — chart token performance over time
- **Global market context** — fear/greed index, overall market data

```
┌──────────────────────────┐     ┌─────────────────┐
│  Pump SDK (on-chain)     │     │  CoinGecko API   │
│  • Bonding curve state   │     │  • SOL/USD price │
│  • Market cap (SOL)      │ ──► │  • Token metadata│
│  • Reserves, progress    │     │  • Market data   │
└──────────────────────────┘     └─────────────────┘
                    │
              ┌─────▼──────┐
              │  Your App   │
              │  USD prices │
              │  Charts     │
              │  Discovery  │
              └────────────┘
```

---

## Step 1: Setup

```bash
npm install @pump-fun/pump-sdk @solana/web3.js bn.js
```

CoinGecko's free API requires no API key for basic endpoints. For higher rate limits, get a key at [coingecko.com](https://www.coingecko.com/en/api).

```typescript
// src/coingecko.ts
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const COINGECKO_PRO_BASE = "https://pro-api.coingecko.com/api/v3";

interface CoinGeckoConfig {
  apiKey?: string;
  /** Requests per minute (free: 10-30, paid: 500+) */
  rateLimit?: number;
}

class CoinGeckoClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private lastRequest = 0;
  private minInterval: number;

  constructor(config: CoinGeckoConfig = {}) {
    this.baseUrl = config.apiKey ? COINGECKO_PRO_BASE : COINGECKO_BASE;
    this.headers = config.apiKey
      ? { "x-cg-pro-api-key": config.apiKey }
      : {};
    this.minInterval = 60_000 / (config.rateLimit ?? 10); // Default 10 req/min
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    // Simple rate limiting
    const now = Date.now();
    const wait = this.minInterval - (now - this.lastRequest);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequest = Date.now();

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) {
      throw new Error(`CoinGecko ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  /** Get SOL price in USD and other currencies */
  async getSolPrice(): Promise<{ usd: number; usd_24h_change: number }> {
    const data = await this.request<Record<string, any>>("/simple/price", {
      ids: "solana",
      vs_currencies: "usd",
      include_24hr_change: "true",
    });
    return {
      usd: data.solana.usd,
      usd_24h_change: data.solana.usd_24h_change,
    };
  }

  /** Get price for any token by CoinGecko ID */
  async getTokenPrice(id: string): Promise<{ usd: number; usd_24h_change: number; usd_market_cap: number }> {
    const data = await this.request<Record<string, any>>("/simple/price", {
      ids: id,
      vs_currencies: "usd",
      include_24hr_change: "true",
      include_market_cap: "true",
    });
    return {
      usd: data[id]?.usd ?? 0,
      usd_24h_change: data[id]?.usd_24h_change ?? 0,
      usd_market_cap: data[id]?.usd_market_cap ?? 0,
    };
  }

  /** Get token info by contract address on Solana */
  async getTokenByContract(contractAddress: string): Promise<any | null> {
    try {
      return await this.request(`/coins/solana/contract/${contractAddress}`);
    } catch {
      return null; // Not listed on CoinGecko
    }
  }

  /** Get trending tokens on CoinGecko */
  async getTrending(): Promise<any[]> {
    const data = await this.request<{ coins: any[] }>("/search/trending");
    return data.coins;
  }

  /** Search for tokens by name/symbol */
  async search(query: string): Promise<any[]> {
    const data = await this.request<{ coins: any[] }>("/search", { query });
    return data.coins;
  }

  /** Get OHLC price history */
  async getOHLC(id: string, days: number = 7): Promise<number[][]> {
    return await this.request(`/coins/${id}/ohlc`, {
      vs_currency: "usd",
      days: days.toString(),
    });
  }

  /** Get Solana ecosystem tokens */
  async getSolanaEcosystemTokens(page = 1): Promise<any[]> {
    return await this.request("/coins/markets", {
      vs_currency: "usd",
      category: "solana-ecosystem",
      order: "market_cap_desc",
      per_page: "50",
      page: page.toString(),
    });
  }
}

export const coingecko = new CoinGeckoClient({
  apiKey: process.env.COINGECKO_API_KEY, // Optional
});
```

---

## Step 2: Combine Pump SDK + CoinGecko Data

```typescript
// src/enriched-token.ts
import { Connection, PublicKey } from "@solana/web3.js";
import {
  OnlinePumpSdk,
  bondingCurveMarketCap,
} from "@pump-fun/pump-sdk";
import BN from "bn.js";
import { coingecko } from "./coingecko";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);
const onlineSdk = new OnlinePumpSdk(connection);

export interface EnrichedTokenData {
  // On-chain (Pump SDK)
  mint: string;
  priceSol: number;
  marketCapSol: number;
  realSolReserves: number;
  progressPercent: number;
  complete: boolean;

  // CoinGecko enrichment
  priceUsd: number;
  marketCapUsd: number;
  solPriceUsd: number;
  sol24hChange: number;

  // CoinGecko metadata (if listed)
  coingeckoId?: string;
  name?: string;
  symbol?: string;
  image?: string;
  coingeckoRank?: number;
}

export async function getEnrichedTokenData(mintAddress: string): Promise<EnrichedTokenData | null> {
  // Fetch on-chain data and SOL price in parallel
  const [bcResult, solPrice, cgToken] = await Promise.all([
    (async () => {
      const mint = new PublicKey(mintAddress);
      const bc = await onlineSdk.fetchBondingCurve(mint);
      return bc;
    })(),
    coingecko.getSolPrice(),
    coingecko.getTokenByContract(mintAddress),
  ]);

  const bc = bcResult;

  const priceSol = bc.virtualTokenReserves.isZero()
    ? 0
    : bc.virtualSolReserves.toNumber() / bc.virtualTokenReserves.toNumber();

  let marketCapSol = 0;
  if (!bc.virtualTokenReserves.isZero()) {
    const mc = bondingCurveMarketCap({
      mintSupply: bc.tokenTotalSupply,
      virtualSolReserves: bc.virtualSolReserves,
      virtualTokenReserves: bc.virtualTokenReserves,
    });
    marketCapSol = mc.toNumber() / 1e9;
  }

  const realSol = bc.realSolReserves.toNumber() / 1e9;

  return {
    mint: mintAddress,
    priceSol,
    marketCapSol,
    realSolReserves: realSol,
    progressPercent: Math.min(100, (realSol / 85) * 100),
    complete: bc.complete,

    // USD conversion
    priceUsd: priceSol * solPrice.usd,
    marketCapUsd: marketCapSol * solPrice.usd,
    solPriceUsd: solPrice.usd,
    sol24hChange: solPrice.usd_24h_change,

    // CoinGecko metadata
    coingeckoId: cgToken?.id,
    name: cgToken?.name,
    symbol: cgToken?.symbol,
    image: cgToken?.image?.small,
    coingeckoRank: cgToken?.market_cap_rank,
  };
}
```

---

## Step 3: Price Feed Service

Build a service that caches SOL/USD prices and refreshes periodically:

```typescript
// src/price-feed.ts
import { coingecko } from "./coingecko";

interface PriceCache {
  solUsd: number;
  sol24hChange: number;
  updatedAt: number;
}

class PriceFeed {
  private cache: PriceCache | null = null;
  private refreshMs: number;
  private updating = false;

  constructor(refreshMs = 60_000) {
    this.refreshMs = refreshMs;
  }

  async getSolUsd(): Promise<number> {
    await this.ensureFresh();
    return this.cache!.solUsd;
  }

  async getSol24hChange(): Promise<number> {
    await this.ensureFresh();
    return this.cache!.sol24hChange;
  }

  /** Convert SOL amount to USD */
  async solToUsd(solAmount: number): Promise<number> {
    const solUsd = await this.getSolUsd();
    return solAmount * solUsd;
  }

  /** Convert USD amount to SOL */
  async usdToSol(usdAmount: number): Promise<number> {
    const solUsd = await this.getSolUsd();
    return usdAmount / solUsd;
  }

  private async ensureFresh(): Promise<void> {
    const now = Date.now();
    if (this.cache && now - this.cache.updatedAt < this.refreshMs) return;
    if (this.updating) {
      // Wait for in-flight update
      while (this.updating) await new Promise((r) => setTimeout(r, 100));
      return;
    }

    this.updating = true;
    try {
      const sol = await coingecko.getSolPrice();
      this.cache = {
        solUsd: sol.usd,
        sol24hChange: sol.usd_24h_change,
        updatedAt: now,
      };
    } finally {
      this.updating = false;
    }
  }
}

export const priceFeed = new PriceFeed(60_000); // Refresh every 60s
```

### Usage with Pump SDK

```typescript
import { OnlinePumpSdk, bondingCurveMarketCap } from "@pump-fun/pump-sdk";
import { priceFeed } from "./price-feed";

const bc = await onlineSdk.fetchBondingCurve(mint);

const marketCapSol = bondingCurveMarketCap({
  mintSupply: bc.tokenTotalSupply,
  virtualSolReserves: bc.virtualSolReserves,
  virtualTokenReserves: bc.virtualTokenReserves,
}).toNumber() / 1e9;

const marketCapUsd = await priceFeed.solToUsd(marketCapSol);
console.log(`Market cap: $${marketCapUsd.toFixed(2)}`);
```

---

## Step 4: Token Discovery

Find which Pump tokens are listed on CoinGecko and compare on-chain vs off-chain data:

```typescript
// src/discovery.ts
import { coingecko } from "./coingecko";
import { getEnrichedTokenData } from "./enriched-token";

/** Search CoinGecko for a token and check if it has an active bonding curve */
async function discoverPumpToken(query: string) {
  const results = await coingecko.search(query);

  // Filter to Solana tokens
  const solanaTokens = results.filter(
    (coin: any) =>
      coin.platforms?.solana ||
      coin.id?.includes("solana")
  );

  console.log(`Found ${solanaTokens.length} Solana tokens matching "${query}"`);

  for (const token of solanaTokens.slice(0, 5)) {
    console.log(`\n${token.name} (${token.symbol})`);
    console.log(`  CoinGecko ID: ${token.id}`);
    console.log(`  Market cap rank: ${token.market_cap_rank ?? "unranked"}`);

    // If we have a Solana contract address, check Pump
    if (token.platforms?.solana) {
      const enriched = await getEnrichedTokenData(token.platforms.solana);
      if (enriched) {
        console.log(`  Bonding curve: ${enriched.complete ? "GRADUATED" : "ACTIVE"}`);
        console.log(`  On-chain price: ${enriched.priceSol.toFixed(10)} SOL ($${enriched.priceUsd.toFixed(6)})`);
      } else {
        console.log(`  Not a Pump token (no bonding curve)`);
      }
    }
  }
}
```

---

## Step 5: Build a Price Comparison API

Compare Pump bonding curve price vs CoinGecko price for graduated tokens:

```typescript
// src/price-comparison.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk, bondingCurveMarketCap } from "@pump-fun/pump-sdk";
import { coingecko } from "./coingecko";

const connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
const onlineSdk = new OnlinePumpSdk(connection);

interface PriceComparison {
  mint: string;
  pumpPriceSol: number;
  pumpPriceUsd: number;
  coingeckoPriceUsd: number | null;
  premiumPercent: number | null;
  source: "bonding_curve" | "amm";
}

async function comparePrices(mintAddress: string): Promise<PriceComparison> {
  const mint = new PublicKey(mintAddress);

  const [bc, solPrice, cgToken] = await Promise.all([
    onlineSdk.fetchBondingCurve(mint),
    coingecko.getSolPrice(),
    coingecko.getTokenByContract(mintAddress),
  ]);

  const pumpPriceSol = bc.virtualTokenReserves.isZero()
    ? 0
    : bc.virtualSolReserves.toNumber() / bc.virtualTokenReserves.toNumber();

  const pumpPriceUsd = pumpPriceSol * solPrice.usd;

  const cgPriceUsd = cgToken?.market_data?.current_price?.usd ?? null;

  let premiumPercent: number | null = null;
  if (cgPriceUsd && cgPriceUsd > 0) {
    premiumPercent = ((pumpPriceUsd - cgPriceUsd) / cgPriceUsd) * 100;
  }

  return {
    mint: mintAddress,
    pumpPriceSol,
    pumpPriceUsd,
    coingeckoPriceUsd: cgPriceUsd,
    premiumPercent,
    source: bc.complete ? "amm" : "bonding_curve",
  };
}

// Usage
const comp = await comparePrices("TOKEN_MINT_ADDRESS");
console.log(`Pump price:     $${comp.pumpPriceUsd.toFixed(6)}`);
console.log(`CoinGecko price: $${comp.coingeckoPriceUsd?.toFixed(6) ?? "N/A"}`);
if (comp.premiumPercent !== null) {
  const label = comp.premiumPercent > 0 ? "premium" : "discount";
  console.log(`${Math.abs(comp.premiumPercent).toFixed(2)}% ${label} on Pump`);
}
```

---

## Step 6: Use in Next.js (from Tutorial 17)

Add CoinGecko data to your monitoring website:

```typescript
// src/app/api/enriched/[mint]/route.ts
import { NextResponse } from "next/server";
import { getEnrichedTokenData } from "@/lib/enriched-token";

export async function GET(
  _request: Request,
  { params }: { params: { mint: string } },
) {
  const data = await getEnrichedTokenData(params.mint);
  if (!data) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
```

---

## Step 7: Use in Telegram Bot (from Tutorial 18)

Add USD prices to bot responses:

```typescript
import { priceFeed } from "./price-feed";

// In your /price command handler:
bot.command("price", async (ctx) => {
  const mint = ctx.message.text.split(" ")[1];
  const info = await getTokenInfo(mint);
  if (!info) return ctx.reply("❌ Token not found");

  const solUsd = await priceFeed.getSolUsd();
  const priceUsd = info.priceSol * solUsd;
  const mcapUsd = info.marketCapSol * solUsd;

  ctx.reply(
    `📊 *Token* \`${info.mint.slice(0, 8)}...\`\n\n` +
    `💰 Price: \`${info.priceSol.toFixed(10)} SOL\` ($${priceUsd.toFixed(6)})\n` +
    `📈 Market Cap: \`${info.marketCapSol.toFixed(2)} SOL\` ($${mcapUsd.toFixed(2)})\n` +
    `📊 SOL/USD: $${solUsd.toFixed(2)}\n` +
    `🔖 Status: *${info.complete ? "GRADUATED" : "ACTIVE"}*`,
    { parse_mode: "Markdown" }
  );
});
```

---

## CoinGecko API Rate Limits

| Plan | Rate Limit | Key Required |
|------|-----------|-------------|
| Free | 10-30 req/min | No |
| Demo | 30 req/min | Yes (free) |
| Analyst | 500 req/min | Yes (paid) |
| Pro | 1000 req/min | Yes (paid) |

For most monitoring use cases, the free tier with caching is sufficient.

---

## What's Next?

- [Tutorial 17: Build a Monitoring Website](./17-monitoring-website.md) — the full web dashboard
- [Tutorial 18: Telegram Bot](./18-telegram-bot.md) — alerts and commands
- [Tutorial 05: Bonding Curve Math](./05-bonding-curve-math.md) — understand the pricing model
