# Tutorial 17: Build a Token Monitoring Website

> Create a real-time Next.js dashboard that monitors Pump tokens — prices, market caps, bonding curve progress, and claim status.

## What We're Building

A web dashboard that:
- Displays live bonding curve state for any token
- Shows market cap, price, and graduation progress
- Tracks unclaimed incentives and creator vault balances
- Auto-refreshes every 10 seconds

```
┌──────────────────────────────────────────────────────┐
│  Pump Token Monitor                      [Devnet ●]  │
├──────────────────────────────────────────────────────┤
│  Token: ABC...xyz                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Price    │ │ Mkt Cap  │ │ Progress │ │ Status  │ │
│  │ 0.00034  │ │ 12.4 SOL │ │ ████░ 78%│ │ ACTIVE  │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
│                                                      │
│  Bonding Curve Reserves    │  Your Claims            │
│  SOL:   8.2 / 85.0        │  Unclaimed: 1,240 PUMP  │
│  Token: 220M / 1B         │  Today:     340 PUMP    │
│  Real SOL: 8.2            │  Vault:     0.42 SOL    │
└──────────────────────────────────────────────────────┘
```

---

## Step 1: Project Setup

```bash
npx create-next-app@latest pump-monitor --typescript --tailwind --app --src-dir
cd pump-monitor
npm install @pump-fun/pump-sdk @solana/web3.js @coral-xyz/anchor bn.js
```

---

## Step 2: SDK Data Layer

Create a server-side module that fetches all token data:

```typescript
// src/lib/pump.ts
import { Connection, PublicKey } from "@solana/web3.js";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  bondingCurveMarketCap,
  bondingCurvePda,
  feeSharingConfigPda,
  userVolumeAccumulatorPda,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  totalUnclaimedTokens,
  currentDayTokens,
} from "@pump-fun/pump-sdk";
import BN from "bn.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);
const onlineSdk = new OnlinePumpSdk(connection);

export interface TokenData {
  mint: string;
  price: number;
  marketCapSol: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  realSolReserves: number;
  realTokenReserves: number;
  tokenTotalSupply: number;
  complete: boolean;
  creator: string;
  isMayhemMode: boolean;
  progressPercent: number;
}

export async function getTokenData(mintAddress: string): Promise<TokenData | null> {
  try {
    const mint = new PublicKey(mintAddress);
    const bc = await onlineSdk.fetchBondingCurve(mint);

    const price = bc.virtualTokenReserves.isZero()
      ? 0
      : bc.virtualSolReserves.toNumber() / bc.virtualTokenReserves.toNumber();

    let marketCapSol = 0;
    if (!bc.virtualTokenReserves.isZero()) {
      const mcLamports = bondingCurveMarketCap({
        mintSupply: bc.tokenTotalSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      marketCapSol = mcLamports.toNumber() / 1e9;
    }

    // Progress = realSolReserves out of ~85 SOL graduation threshold
    const GRADUATION_SOL = 85;
    const realSol = bc.realSolReserves.toNumber() / 1e9;
    const progressPercent = Math.min(100, (realSol / GRADUATION_SOL) * 100);

    return {
      mint: mintAddress,
      price,
      marketCapSol,
      virtualSolReserves: bc.virtualSolReserves.toNumber() / 1e9,
      virtualTokenReserves: bc.virtualTokenReserves.toNumber() / 1e6,
      realSolReserves: realSol,
      realTokenReserves: bc.realTokenReserves.toNumber() / 1e6,
      tokenTotalSupply: bc.tokenTotalSupply.toNumber() / 1e6,
      complete: bc.complete,
      creator: bc.creator.toBase58(),
      isMayhemMode: bc.isMayhemMode,
      progressPercent,
    };
  } catch {
    return null;
  }
}

export interface ClaimData {
  unclaimedTokens: string;
  todayTokens: string;
  totalClaimed: string;
  currentVolumeSol: number;
  needsSync: boolean;
  creatorVaultSol: number;
}

export async function getClaimData(
  userAddress: string,
): Promise<ClaimData> {
  const user = new PublicKey(userAddress);

  const [unclaimed, today, stats, rawAcc, vaultBalance] = await Promise.all([
    onlineSdk.getTotalUnclaimedTokensBothPrograms(user),
    onlineSdk.getCurrentDayTokensBothPrograms(user),
    onlineSdk.fetchUserVolumeAccumulatorTotalStats(user),
    onlineSdk.fetchUserVolumeAccumulator(user),
    onlineSdk.getCreatorVaultBalanceBothPrograms(user),
  ]);

  return {
    unclaimedTokens: unclaimed.toString(),
    todayTokens: today.toString(),
    totalClaimed: stats.totalClaimedTokens.toString(),
    currentVolumeSol: stats.currentSolVolume.toNumber() / 1e9,
    needsSync: rawAcc?.needsClaim ?? false,
    creatorVaultSol: vaultBalance.toNumber() / 1e9,
  };
}

export async function getMultipleTokens(mints: string[]): Promise<(TokenData | null)[]> {
  const pdas = mints.map((m) => bondingCurvePda(new PublicKey(m)));
  const accounts = await connection.getMultipleAccountsInfo(pdas);

  return mints.map((mintAddr, i) => {
    const info = accounts[i];
    if (!info) return null;

    const bc = PUMP_SDK.decodeBondingCurveNullable(info);
    if (!bc) return null;

    const price = bc.virtualTokenReserves.isZero()
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
      mint: mintAddr,
      price,
      marketCapSol,
      virtualSolReserves: bc.virtualSolReserves.toNumber() / 1e9,
      virtualTokenReserves: bc.virtualTokenReserves.toNumber() / 1e6,
      realSolReserves: realSol,
      realTokenReserves: bc.realTokenReserves.toNumber() / 1e6,
      tokenTotalSupply: bc.tokenTotalSupply.toNumber() / 1e6,
      complete: bc.complete,
      creator: bc.creator.toBase58(),
      isMayhemMode: bc.isMayhemMode,
      progressPercent: Math.min(100, (realSol / 85) * 100),
    };
  });
}
```

---

## Step 3: API Routes

```typescript
// src/app/api/token/[mint]/route.ts
import { NextResponse } from "next/server";
import { getTokenData } from "@/lib/pump";

export async function GET(
  _request: Request,
  { params }: { params: { mint: string } },
) {
  const data = await getTokenData(params.mint);
  if (!data) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=10" },
  });
}
```

```typescript
// src/app/api/claims/[user]/route.ts
import { NextResponse } from "next/server";
import { getClaimData } from "@/lib/pump";

export async function GET(
  _request: Request,
  { params }: { params: { user: string } },
) {
  const data = await getClaimData(params.user);
  return NextResponse.json(data);
}
```

```typescript
// src/app/api/tokens/route.ts
import { NextResponse } from "next/server";
import { getMultipleTokens } from "@/lib/pump";

export async function POST(request: Request) {
  const { mints } = await request.json();
  if (!Array.isArray(mints) || mints.length > 20) {
    return NextResponse.json({ error: "Provide 1-20 mints" }, { status: 400 });
  }
  const tokens = await getMultipleTokens(mints);
  return NextResponse.json(tokens);
}
```

---

## Step 4: React Hooks

```typescript
// src/hooks/useTokenData.ts
"use client";
import { useState, useEffect } from "react";
import type { TokenData } from "@/lib/pump";

export function useTokenData(mint: string | null, refreshInterval = 10_000) {
  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) return;
    let active = true;

    async function fetchData() {
      try {
        const res = await fetch(`/api/token/${mint}`);
        if (!res.ok) throw new Error("Token not found");
        const json = await res.json();
        if (active) {
          setData(json);
          setError(null);
        }
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => { active = false; clearInterval(interval); };
  }, [mint, refreshInterval]);

  return { data, loading, error };
}
```

---

## Step 5: Dashboard UI

```tsx
// src/app/page.tsx
"use client";
import { useState } from "react";
import { useTokenData } from "@/hooks/useTokenData";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-gray-400 text-xs uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-gray-500 text-sm mt-1">{sub}</div>}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-gray-800 rounded-full h-3 mt-2">
      <div
        className="h-3 rounded-full transition-all duration-500"
        style={{
          width: `${percent}%`,
          background: percent >= 100
            ? "linear-gradient(90deg, #22c55e, #16a34a)"
            : "linear-gradient(90deg, #6366f1, #8b5cf6)",
        }}
      />
    </div>
  );
}

export default function Dashboard() {
  const [mintInput, setMintInput] = useState("");
  const [activeMint, setActiveMint] = useState<string | null>(null);
  const { data, loading, error } = useTokenData(activeMint);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Pump Token Monitor</h1>
        <p className="text-gray-400 mb-6">Real-time bonding curve monitoring powered by @pump-fun/pump-sdk</p>

        {/* Search */}
        <div className="flex gap-2 mb-8">
          <input
            type="text"
            placeholder="Enter token mint address..."
            value={mintInput}
            onChange={(e) => setMintInput(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm
                       focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => setActiveMint(mintInput.trim())}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg text-sm font-medium"
          >
            Monitor
          </button>
        </div>

        {loading && activeMint && (
          <div className="text-gray-400 text-center py-12">Loading token data...</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Status banner */}
            <div className="flex items-center gap-3 mb-6">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                data.complete
                  ? "bg-green-900/40 text-green-400 border border-green-800"
                  : "bg-indigo-900/40 text-indigo-400 border border-indigo-800"
              }`}>
                {data.complete ? "GRADUATED" : "ACTIVE"}
              </span>
              {data.isMayhemMode && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-900/40 text-orange-400 border border-orange-800">
                  MAYHEM MODE
                </span>
              )}
              <span className="text-gray-500 text-sm font-mono">
                {data.mint.slice(0, 8)}...{data.mint.slice(-6)}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Price"
                value={`${data.price.toFixed(8)} SOL`}
                sub={`per token`}
              />
              <StatCard
                label="Market Cap"
                value={`${data.marketCapSol.toFixed(2)} SOL`}
              />
              <StatCard
                label="Real SOL Reserves"
                value={`${data.realSolReserves.toFixed(4)} SOL`}
              />
              <StatCard
                label="Creator"
                value={`${data.creator.slice(0, 8)}...`}
              />
            </div>

            {/* Graduation progress */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Graduation Progress</span>
                <span className="text-sm font-mono">{data.progressPercent.toFixed(1)}%</span>
              </div>
              <ProgressBar percent={data.progressPercent} />
              <div className="flex justify-between text-gray-500 text-xs mt-2">
                <span>{data.realSolReserves.toFixed(2)} SOL</span>
                <span>~85 SOL</span>
              </div>
            </div>

            {/* Reserves detail */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-gray-400 text-sm mb-3">Virtual Reserves</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">SOL</span>
                    <span>{data.virtualSolReserves.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tokens</span>
                    <span>{(data.virtualTokenReserves / 1e3).toFixed(1)}K</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-gray-400 text-sm mb-3">Real Reserves</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">SOL</span>
                    <span>{data.realSolReserves.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tokens</span>
                    <span>{(data.realTokenReserves / 1e3).toFixed(1)}K</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
```

---

## Step 6: Environment Variables

```bash
# .env.local
SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## Step 7: Run It

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deployment

```bash
# Vercel (recommended for Next.js)
npx vercel

# Or build and serve
npm run build && npm start
```

Set `SOLANA_RPC_URL` in your deployment environment to a production RPC endpoint (Helius, QuickNode, etc.) for mainnet monitoring.

---

## What's Next?

- [Tutorial 18: Telegram Bot for Pump Tokens](./18-telegram-bot.md) — get alerts in Telegram
- [Tutorial 19: CoinGecko Integration](./19-coingecko-integration.md) — price feeds and token discovery
