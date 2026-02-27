---
name: pump-website
description: "Next.js 14 documentation website for the Pump SDK — interactive tool components for bonding curve visualization, fee calculation, vanity generation, keypair verification, client-side Solana cryptography, PWA support, and Vercel deployment."
metadata:
  openclaw:
    homepage: https://github.com/nirholas/pump-fun-sdk
---

# Next.js Website — Interactive Documentation & Tools

Next.js 14 App Router documentation website with interactive Solana tool components, client-side cryptography, and PWA support.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, features, architecture diagram |
| `/tools` | Interactive SDK tools (bonding curve, fees, vanity) |
| `/docs` | Documentation browser |
| `/api` | API reference |
| `/offline` | PWA offline fallback |

## Interactive Tool Components

| Component | Purpose |
|-----------|---------|
| `BondingCurveCalculator` | Visualize buy/sell quotes with live curve |
| `FeeCalculator` | Calculate tiered fees by market cap |
| `MarketCapCalculator` | Compute market cap from reserves |
| `VanityGenerator` | Generate vanity addresses in-browser |
| `KeypairVerifier` | Verify keypair integrity |
| `AddressValidator` | Validate Solana addresses |
| `SlippageCalculator` | Calculate max cost / min received |
| `PDADeriver` | Derive PDAs for any program |
| `Base58Encoder` | Encode/decode Base58 |
| `TokenLifecycleVisualizer` | Interactive lifecycle state diagram |

## Client-Side Solana Cryptography

All crypto runs client-side using `@solana/web3.js`:

```typescript
'use client';
import { Keypair } from '@solana/web3.js';

export function VanityGenerator() {
    const generate = () => {
        const kp = Keypair.generate();
        // ... match pattern
    };
}
```

## Webpack Fallbacks

```javascript
// next.config.js
webpack: (config) => {
    config.resolve.fallback = {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
    };
    return config;
}
```

## Design System

Solana-inspired color palette:
- Primary: `#9945FF` (Solana purple)
- Secondary: `#14F195` (Solana green)
- Background: `#0E0E10` (dark)
- Surface: `#1A1A2E`

## PWA Support

- Service worker for offline access
- `offline.html` fallback page
- App manifest for installability

## Patterns to Follow

- All interactive components use `'use client'` directive
- Crypto operations never leave the browser
- Use React state for all computed values
- Lazy-load heavy components (crypto libraries)

## Common Pitfalls

- Node.js crypto modules need browser polyfills via webpack fallbacks
- `@solana/web3.js` is large — tree-shake or lazy-load
- SSR will fail for crypto components — ensure client-only rendering
- Service worker caching may serve stale content — version your cache
