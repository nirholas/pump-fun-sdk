# Next.js Website — PWA with Client-Side Solana Cryptography

## Skill Description

Build and maintain the project's marketing and tools website — a Next.js 14 App Router application with client-side Solana cryptography, dark/light theming, PWA support, and interactive tool components, deployed on Vercel.

## Context

The website serves as both a marketing page and an interactive tool hub where users can generate wallets, create vanity addresses, sign/verify messages, and validate addresses entirely in the browser. All cryptographic operations happen client-side — no private keys ever leave the browser. The site uses Tailwind CSS with a Solana-branded design system and framer-motion animations.

## Key Files

### App Router Pages
- `website/src/app/page.tsx` — landing page (hero, features grid, stats)
- `website/src/app/layout.tsx` — root layout (Navigation, Footer, ThemeProvider, ServiceWorker)
- `website/src/app/globals.css` — Tailwind directives, CSS variables, custom effects
- `website/src/app/docs/page.tsx` — documentation page
- `website/src/app/examples/page.tsx` — examples page
- `website/src/app/mcp/page.tsx` — MCP server info page
- `website/src/app/tools/page.tsx` — interactive tools hub

### Components
- `website/src/components/Navigation.tsx` — sticky nav with mobile menu, 5 links, theme toggle
- `website/src/components/Footer.tsx` — GitHub links, @nichxbt, license, disclaimer
- `website/src/components/ThemeProvider.tsx` — dark/light mode context
- `website/src/components/ServiceWorkerRegistrar.tsx` — PWA service worker registration

### Interactive Tools (10 components)
- `website/src/components/tools/GenerateWallet.tsx` — standard keypair generation
- `website/src/components/tools/VanityGenerator.tsx` — vanity address generation
- `website/src/components/tools/SignMessage.tsx` — message signing
- `website/src/components/tools/VerifySignature.tsx` — signature verification
- `website/src/components/tools/Validate.tsx` — address validation
- `website/src/components/tools/RestoreWallet.tsx` — keypair restoration from private key
- `website/src/components/tools/DifficultyEstimator.tsx` — vanity pattern difficulty calculator
- `website/src/components/tools/BatchGenerator.tsx` — multiple keypair generation
- `website/src/components/tools/Base58Converter.tsx` — Base58 encoding/decoding
- `website/src/components/tools/ExplorerLink.tsx` — Solana Explorer link generator

### Utilities
- `website/src/lib/utils.ts` — Base58 validation, bytesToHex, formatNumber, formatDuration

### Configuration
- `website/package.json` — Next.js 14, React 18, Solana deps
- `website/next.config.js` — webpack fallbacks for Node.js built-ins
- `website/tailwind.config.ts` — Solana branding, custom animations
- `website/postcss.config.js` — PostCSS with Tailwind and Autoprefixer
- `website/tsconfig.json` — TypeScript configuration
- `website/public/` — static assets, manifest, service worker
- `vercel.json` — Vercel deployment config (`{ "framework": "nextjs" }`)

## Key Concepts

### Client-Side Cryptography

All crypto runs in the browser — no server calls:

```typescript
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Generate
const keypair = Keypair.generate();

// Sign
const message = new TextEncoder().encode(text);
const signature = nacl.sign.detached(message, keypair.secretKey);

// Verify
const isValid = nacl.sign.detached.verify(message, signature, publicKeyBytes);
```

### Next.js Webpack Fallbacks

Browser bundles need Node.js built-ins disabled:

```javascript
// next.config.js
module.exports = {
    reactStrictMode: true,
    webpack: (config) => {
        config.resolve.fallback = {
            fs: false,
            net: false,
            tls: false,
            crypto: false,
        };
        return config;
    },
};
```

### Component Pattern

All tool components use `'use client'` directive and follow this pattern:

```typescript
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function ToolComponent() {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const handleAction = async () => {
        setLoading(true);
        try {
            // Crypto operation
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* UI */}
        </motion.div>
    );
}
```

### Design System

**Solana brand colors:**
```typescript
// tailwind.config.ts
colors: {
    solana: {
        purple: '#9945FF',
        green: '#14F195',
    },
    dark: {
        900: '#0a0a0f',
        800: '#12121a',
        700: '#1a1a2e',
        600: '#252540',
    }
}
```

**Custom animations:**
- `pulse-slow` — subtle background pulsing
- `glow` — neon glow effect for highlights
- `scan` — scanning line animation
- `float` — gentle floating motion
- `gradient` — animated gradient backgrounds
- `fade-in` / `slide-up` — entrance animations

**Font:** JetBrains Mono for code elements

**Dark mode:** CSS class strategy via `ThemeProvider` context

### PWA Support

- Service worker registered via `ServiceWorkerRegistrar` component
- Manifest file in `public/`
- Offline fallback page at `offline.html`
- App installable on mobile devices

### Page Structure

```
layout.tsx (root)
├── Navigation (sticky, desktop + mobile)
├── ThemeProvider (dark/light context)
├── ServiceWorkerRegistrar
├── {page content}
└── Footer
```

**5 routes:**
- `/` — Hero section, features grid, statistics
- `/tools` — 10 interactive tool components
- `/docs` — Documentation
- `/examples` — Code examples
- `/mcp` — MCP server information

## Patterns to Follow

- Use `'use client'` directive on all interactive components
- Never send private keys to any server — all crypto is client-side
- Use `framer-motion` for all animations — consistent API
- Wrap async operations in try/catch with loading states
- Use Tailwind's `dark:` variant for dark mode styles
- Keep tool components self-contained (each in its own file)
- Use `clsx` for conditional class merging
- Validate all user input (Base58, address format) before crypto operations
- Format large numbers and durations using utility functions from `lib/utils.ts`

## Common Pitfalls

- `@solana/web3.js` uses Node.js `crypto` module — must set webpack fallback to `false`
- `Keypair.generate()` uses browser's `crypto.getRandomValues()` — works without node `crypto`
- `bs58` v6 is ESM-only — may need dynamic import in certain contexts
- framer-motion tree-shaking: import only needed components to reduce bundle size
- Service worker caching can serve stale versions — implement proper cache invalidation
- Private keys displayed in the browser should have a copy-to-clipboard-only UX, not persistent display
- Mobile Safari may not support all Web Crypto API features — test on real devices

## Dependencies

| Package | Purpose |
|---------|---------|
| `next` (14.x) | Framework |
| `react` (18.x) | UI library |
| `@solana/web3.js` | Solana crypto operations |
| `tweetnacl` | Ed25519 signing/verification |
| `bs58` | Base58 encoding/decoding |
| `framer-motion` | Animations |
| `@tsparticles/react` | Particle background effects |
| `lucide-react` | Icon library |
| `clsx` | Class name merging |
| `tailwindcss` (3.4) | Utility-first CSS |

## Deployment

- Hosted on Vercel with `vercel.json: { "framework": "nextjs" }`
- Automatic deploys from `main` branch
- No server-side secrets needed (client-side only)
- Static optimization for marketing pages, client rendering for tools
