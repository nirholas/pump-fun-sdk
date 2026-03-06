# 🚀 Pump Fun SDK — SperaxOS Plugin API Reference

Interactive demo: [`plugin-demo.html`](../../website/plugin-demo.html) | Live: [`plugin.delivery/api/pump-fun-sdk`](https://plugin.delivery/api/pump-fun-sdk)

---

## Base URL

```
https://plugin.delivery/api/pump-fun-sdk
```

All endpoints accept `POST` with `Content-Type: application/json`.

---

## Endpoints

### 1. `getBondingCurve` — Bonding Curve State

Fetch the on-chain bonding curve for a token — reserves, price, graduation status.

```bash
curl -X POST 'https://plugin.delivery/api/pump-fun-sdk/bonding-curve' \
  -H 'Content-Type: application/json' \
  -d '{"mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mint` | string | Yes | Solana token mint public key |

**Sample Response:**
```json
{
  "mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  "virtualSolReserves": "30000000000",
  "virtualTokenReserves": "1073000000000000",
  "realSolReserves": "0",
  "realTokenReserves": "793100000000000",
  "complete": false,
  "currentPriceSOL": "0.000000027959",
  "graduationProgress": "0.00%"
}
```

---

### 2. `getPriceQuote` — Buy/Sell Price Quote

Calculate the output amount for a buy or sell using the constant-product AMM formula.

```bash
# Buy quote: how many tokens for 1 SOL?
curl -X POST 'https://plugin.delivery/api/pump-fun-sdk/price-quote' \
  -H 'Content-Type: application/json' \
  -d '{"mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", "side": "buy", "amount": "1000000000"}'
```

```bash
# Sell quote: how much SOL for 1M tokens?
curl -X POST 'https://plugin.delivery/api/pump-fun-sdk/price-quote' \
  -H 'Content-Type: application/json' \
  -d '{"mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", "side": "sell", "amount": "1000000000000"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mint` | string | Yes | Solana token mint public key |
| `side` | string | Yes | `"buy"` or `"sell"` |
| `amount` | string | Yes | Input amount in lamports (buy) or raw tokens (sell) |

**Sample Response (buy):**
```json
{
  "side": "buy",
  "inputAmount": "1000000000",
  "outputAmount": "34567890123456",
  "pricePerToken": "0.000000028935",
  "priceImpact": "3.24%",
  "fee": "10000000",
  "feeBps": 100
}
```

---

### 3. `getMarketCap` — Market Cap in SOL & USD

Calculate market cap from the bonding curve price × circulating supply, with USD conversion.

```bash
curl -X POST 'https://plugin.delivery/api/pump-fun-sdk/market-cap' \
  -H 'Content-Type: application/json' \
  -d '{"mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mint` | string | Yes | Solana token mint public key |

**Sample Response:**
```json
{
  "mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  "priceSOL": "0.000000027959",
  "circulatingSupply": "1000000000000000",
  "marketCapSOL": "27.959",
  "solPriceUSD": 178.50,
  "marketCapUSD": "4990.68"
}
```

---

### 4. `getFeeTier` — Fee Tier Calculator

Determine which fee tier applies for a given SOL trade amount. The protocol uses 5 tiers.

```bash
curl -X POST 'https://plugin.delivery/api/pump-fun-sdk/fee-tier' \
  -H 'Content-Type: application/json' \
  -d '{"solAmount": "1.5"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `solAmount` | string | Yes | Trade size in SOL (e.g. `"1.5"`) |

**Sample Response:**
```json
{
  "inputSOL": "1.5",
  "tierName": "Standard",
  "feeBps": 100,
  "feePercent": "1.00%",
  "feeSOL": "0.015",
  "allTiers": [
    { "name": "Micro",    "maxSOL": "0.1",  "bps": 25,  "percent": "0.25%" },
    { "name": "Small",    "maxSOL": "1",    "bps": 50,  "percent": "0.50%" },
    { "name": "Standard", "maxSOL": "10",   "bps": 100, "percent": "1.00%" },
    { "name": "Large",    "maxSOL": "100",  "bps": 150, "percent": "1.50%" },
    { "name": "Whale",    "maxSOL": "∞",    "bps": 200, "percent": "2.00%" }
  ]
}
```

---

### 5. `getTokenIncentives` — PUMP Token Rewards

Query the PUMP token incentive schedule and optional per-wallet volume stats.

```bash
# Global incentive stats
curl -X POST 'https://plugin.delivery/api/pump-fun-sdk/token-incentives' \
  -H 'Content-Type: application/json' \
  -d '{}'

# Per-wallet stats
curl -X POST 'https://plugin.delivery/api/pump-fun-sdk/token-incentives' \
  -H 'Content-Type: application/json' \
  -d '{"wallet": "YourWalletPublicKeyHere"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet` | string | No | Solana wallet public key for per-user stats |

**Sample Response:**
```json
{
  "currentDay": 142,
  "dailyAllocation": "1000000000000",
  "yearOneDaily": "1369863013698",
  "totalSupply": "1000000000000000000",
  "schedule": [
    { "year": 1, "annualAllocation": "500000000000000000", "dailyAllocation": "1369863013698" },
    { "year": 2, "annualAllocation": "250000000000000000", "dailyAllocation": "684931506849" },
    { "year": 3, "annualAllocation": "125000000000000000", "dailyAllocation": "342465753424" },
    { "year": 4, "annualAllocation": "125000000000000000", "dailyAllocation": "342465753424" }
  ]
}
```

---

### 6. `getFeeSharing` — Fee Sharing Config

Look up the fee sharing configuration for a token — creator vault, shareholder BPS splits.

```bash
curl -X POST 'https://plugin.delivery/api/pump-fun-sdk/fee-sharing' \
  -H 'Content-Type: application/json' \
  -d '{"mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mint` | string | Yes | Solana token mint public key |

**Sample Response:**
```json
{
  "mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  "creatorVault": "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  "totalShares": 10000,
  "shareholders": [
    { "address": "CReaToR...abc", "sharesBps": 5000 },
    { "address": "PaRtNeR...xyz", "sharesBps": 3000 },
    { "address": "CoMmUn1...def", "sharesBps": 2000 }
  ]
}
```

---

## Using with JavaScript / TypeScript

```typescript
const API = 'https://plugin.delivery/api/pump-fun-sdk';

// Get bonding curve state
const res = await fetch(`${API}/bonding-curve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' }),
});
const data = await res.json();
console.log(data);

// Get fee tier for 5 SOL trade
const feeRes = await fetch(`${API}/fee-tier`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ solAmount: '5' }),
});
console.log(await feeRes.json());
```

## Using with Python

```python
import requests

API = "https://plugin.delivery/api/pump-fun-sdk"

# Get bonding curve
resp = requests.post(f"{API}/bonding-curve", json={
    "mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"
})
print(resp.json())

# Get price quote
resp = requests.post(f"{API}/price-quote", json={
    "mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    "side": "buy",
    "amount": "1000000000"
})
print(resp.json())
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Missing required field: mint"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid parameters) |
| 500 | Upstream RPC or calculation error |

---

## Rate Limits

The plugin.delivery gateway applies per-IP rate limits. For high-volume use, deploy your own instance:

```bash
cd packages/plugin.delivery
cp .env.example .env
# Edit .env with your Solana RPC endpoint
vercel dev   # local development
vercel --prod  # production deploy
```

---

## Links

- [Interactive Demo](../../website/plugin-demo.html)
- [Plugin Manifest](../../packages/plugin.delivery/public/pump-fun-sdk/manifest.json)
- [SperaxOS / Plugin Delivery](https://plugin.delivery)
- [Pump Fun SDK](https://github.com/nicholasxuu/pump-fun-sdk)
