/**
 * x402 Server Example — Express API with USDC paywalls on Solana
 *
 * Run:
 *   npx ts-node examples/server-example.ts
 */

import express from 'express';
import { x402Paywall, createPaywalls } from '../src/server.js';

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Public route — no payment required
// ---------------------------------------------------------------------------

app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to the x402 demo API',
    endpoints: {
      '/': 'This page (free)',
      '/premium': '$0.01 USDC — Premium data',
      '/api/basic': '$0.001 USDC — Basic tier',
      '/api/pro': '$0.10 USDC — Pro tier',
    },
  });
});

// ---------------------------------------------------------------------------
// Single paywalled route — $0.01 USDC
// ---------------------------------------------------------------------------

app.get(
  '/premium',
  x402Paywall({
    payTo: '11111111111111111111111111111111', // Replace with your address
    amount: '10000', // 0.01 USDC
    network: 'solana-devnet',
    description: 'Access to premium market data',
    mimeType: 'application/json',
  }),
  (_req, res) => {
    res.json({
      premium: true,
      data: {
        price: 142.50,
        volume: '1.2M',
        trend: 'bullish',
        timestamp: new Date().toISOString(),
      },
    });
  }
);

// ---------------------------------------------------------------------------
// Multiple paywalled routes using createPaywalls
// ---------------------------------------------------------------------------

const paywalls = createPaywalls({
  payTo: '11111111111111111111111111111111', // Replace with your address
  network: 'solana-devnet',
  routes: [
    {
      path: '/api/basic',
      amount: '1000', // $0.001
      description: 'Basic API access',
    },
    {
      path: '/api/pro',
      amount: '100000', // $0.10
      description: 'Pro API access with full data',
    },
  ],
});

for (const { path, middleware } of paywalls) {
  app.get(path, middleware, (_req, res) => {
    res.json({
      tier: path,
      data: `Data for ${path}`,
      timestamp: new Date().toISOString(),
    });
  });
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3402;

app.listen(PORT, () => {
  console.log(`x402 demo server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Try:');
  console.log(`  curl http://localhost:${PORT}/`);
  console.log(`  curl http://localhost:${PORT}/premium  → 402 Payment Required`);
});

