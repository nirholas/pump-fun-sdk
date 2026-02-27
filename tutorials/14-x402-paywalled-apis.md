# Tutorial 14: x402 Paywalled APIs with Solana

> Gate your API behind USDC micropayments using the x402 HTTP 402 protocol.

## What is x402?

x402 turns the dormant HTTP 402 ("Payment Required") status code into a real payment protocol. When a client hits a paywalled endpoint, the server returns 402 with payment instructions. The client pays with USDC on Solana and retries — all automatically.

```
Client                          Server
  │  GET /premium                │
  │─────────────────────────────►│
  │  402 + payment instructions  │
  │◄─────────────────────────────│
  │  (signs USDC transfer)       │
  │  GET /premium + X-PAYMENT    │
  │─────────────────────────────►│
  │  200 OK + premium data       │
  │◄─────────────────────────────│
```

## Installation

```bash
cd x402/
npm install
npm run build
```

## Part 1: Build a Paywalled Server

```typescript
import express from "express";
import { x402Paywall } from "@pump-fun/x402/server";

const app = express();

// Free endpoint
app.get("/", (_req, res) => {
  res.json({ message: "Welcome! /premium costs $0.01 USDC" });
});

// Paywalled endpoint — $0.01 USDC
app.get("/premium",
  x402Paywall({
    payTo: "YOUR_SOLANA_ADDRESS",  // Where payments go
    amount: "10000",                // 0.01 USDC (6 decimals)
    network: "solana-devnet",
    description: "Premium market data",
  }),
  (_req, res) => {
    res.json({
      premium: true,
      data: { price: 142.50, volume: "1.2M" },
    });
  }
);

app.listen(3402, () => console.log("Server on :3402"));
```

### What Happens When a Client Hits `/premium`

Without payment, the server returns:

```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "solana-devnet",
    "maxAmountRequired": "10000",
    "resource": "/premium",
    "payTo": "YOUR_SOLANA_ADDRESS",
    "token": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "description": "Premium market data"
  }],
  "nonce": "random-nonce",
  "expiresAt": "2026-02-26T12:05:00.000Z"
}
```

## Part 2: Build an Auto-Paying Client

```typescript
import { Keypair } from "@solana/web3.js";
import { X402Client } from "@pump-fun/x402/client";

// Your funded wallet
const signer = Keypair.generate(); // Use a real funded keypair!

const client = new X402Client({
  signer,
  network: "solana-devnet",
  maxPaymentAmount: "1000000", // Max $1 per request
});

// Listen for payment events
client.on((event) => {
  console.log(`[${event.type}] ${event.resource} — ${event.amount} base units`);
});

// Fetch automatically handles 402 → pay → retry
const response = await client.fetch("http://localhost:3402/premium");
const data = await response.json();
console.log(data); // { premium: true, data: { price: 142.50, volume: "1.2M" } }
```

## Part 3: Multiple Pricing Tiers

```typescript
import { createPaywalls } from "@pump-fun/x402/server";

const paywalls = createPaywalls({
  payTo: "YOUR_SOLANA_ADDRESS",
  network: "solana-devnet",
  routes: [
    { path: "/api/basic",      amount: "1000",    description: "Basic — $0.001" },
    { path: "/api/standard",   amount: "10000",   description: "Standard — $0.01" },
    { path: "/api/premium",    amount: "100000",   description: "Premium — $0.10" },
    { path: "/api/enterprise", amount: "1000000",  description: "Enterprise — $1.00" },
  ],
});

for (const { path, middleware } of paywalls) {
  app.get(path, middleware, (_req, res) => {
    res.json({ tier: path, data: "..." });
  });
}
```

## Part 4: Payment Verification with a Facilitator

For production, use a standalone facilitator service to verify and settle payments:

```typescript
import { X402Facilitator } from "@pump-fun/x402/facilitator";

const facilitator = new X402Facilitator({
  network: "solana-devnet",
  waitForConfirmation: true,
});

// Verify a payment without submitting
const result = await facilitator.verify(paymentPayload);
console.log(result.valid); // true/false

// Verify AND submit on-chain
const settlement = await facilitator.settle(paymentPayload);
console.log(settlement.txSignature); // On-chain tx signature
```

### Using a Remote Facilitator

Point your server middleware at a facilitator service:

```typescript
app.get("/premium",
  x402Paywall({
    payTo: "YOUR_ADDRESS",
    amount: "10000",
    facilitatorUrl: "http://facilitator.example.com",
  }),
  handler
);
```

## Part 5: Utility Functions

```typescript
import {
  usdcToBaseUnits,
  baseUnitsToUsdc,
  encodePayment,
  decodePayment,
  generateNonce,
} from "@pump-fun/x402";

// Convert human-readable to base units
usdcToBaseUnits("1.50");     // "1500000"
usdcToBaseUnits("0.01");     // "10000"

// Convert back
baseUnitsToUsdc("1500000");  // "1.5"
baseUnitsToUsdc("10000");    // "0.01"

// Generate replay-protection nonce
const nonce = generateNonce(); // Random Base58 string
```

## Use Cases

| Use Case | Amount | Description |
|----------|--------|-------------|
| AI agent API access | $0.001 | Per-request pricing for LLM tools |
| Premium market data | $0.01 | Real-time price feeds |
| Content paywalls | $0.10 | Articles, research reports |
| Compute-heavy APIs | $1.00 | Image generation, model inference |

## What's Next?

- [Tutorial 15: Decoding On-Chain Accounts](./15-decoding-accounts.md)
- [Tutorial 11: Building a Trading Bot](./11-trading-bot.md)
