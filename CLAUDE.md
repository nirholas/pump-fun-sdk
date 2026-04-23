# Pump SDK — Claude Code Instructions

> TypeScript SDK for the Pump protocol on Solana. Bonding curve pricing, AMM migration, tiered fees, creator fee sharing, token incentives, vanity address generation.

## Behavior Rules

- **Act, don't ask.** If a task is clear, do it. Don't ask for permission or confirmation on reversible operations.
- **Read before editing.** Always read a file before modifying it. Never guess at contents.
- **Minimal changes.** Only change what's needed. Don't refactor surrounding code, add docstrings to untouched functions, or "improve" things you weren't asked to touch.
- **No hallucinating APIs.** If you're unsure whether a method exists, read the source. The SDK surface is defined in `src/index.ts`, `src/sdk.ts`, and `src/onlineSdk.ts`.
- **Use BN for all amounts.** Every token amount, SOL amount, fee, and reserve is `BN` (bn.js). Never use JavaScript `number` for financial math. `new BN(1_000_000_000)` not `1e9`.
- **Return TransactionInstruction[], never Transaction.** All instruction builders return arrays of instructions. Callers compose their own transactions.
- **v2, not v1.** `createInstruction` is deprecated. Always use `createV2Instruction`.

## Architecture (read this)

Two SDK classes, one offline, one online:

```
PumpSdk (offline)          OnlinePumpSdk (online)
├── decode*()              ├── fetch*() — RPC calls
├── *Instruction()         ├── wraps PumpSdk for instructions
├── *Instructions()        └── new OnlinePumpSdk(connection)
└── singleton: PUMP_SDK
```

**When to use which:**
- Building instructions without network? → `PUMP_SDK` (singleton)
- Need to fetch on-chain state first? → `new OnlinePumpSdk(connection)`
- OnlinePumpSdk uses PumpSdk internally — don't instantiate both

Three on-chain programs:

| Program | ID | Use |
|---------|-----|-----|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve create/buy/sell |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Post-graduation AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing/distribution |

## Official Pump Protocol Docs (MUST READ)

**Before modifying any on-chain interaction code**, read the relevant official docs in `docs/pump-public-docs/`. These are the canonical protocol specifications from pump-fun/pump-public-docs.

| Task | Read This File |
|------|---------------|
| Bonding curve buy/sell/create, Global/BondingCurve state | `docs/pump-public-docs/PUMP_PROGRAM_README.md` |
| Creator fees on bonding curve | `docs/pump-public-docs/PUMP_CREATOR_FEE_README.md` |
| AMM pool swap/deposit/withdraw, Pool/GlobalConfig state | `docs/pump-public-docs/PUMP_SWAP_README.md` |
| PumpSwap SDK methods & autocomplete helpers | `docs/pump-public-docs/PUMP_SWAP_SDK_README.md` |
| Creator fees on AMM pools | `docs/pump-public-docs/PUMP_SWAP_CREATOR_FEE_README.md` |
| Dynamic fee tiers, market-cap-based fee calculation | `docs/pump-public-docs/FEE_PROGRAM_README.md` |
| Cashback rewards, UserVolumeAccumulator PDA | `docs/pump-public-docs/PUMP_CASHBACK_README.md` |
| CU optimization, PDA bump effects | `docs/pump-public-docs/FAQ.md` |
| create_v2, Token2022, mayhem mode, social fees | `docs/pump-public-docs/README.md` |
| **2026-04-28 breaking fee-recipient upgrade** (trailing accounts on every buy/sell) | `docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md` |

## Code Examples

### Create a token
```typescript
import { PUMP_SDK } from "@nirholas/pump-sdk";

const ix = await PUMP_SDK.createV2Instruction({
  mint, name, symbol, uri, creator, user,
  mayhemMode: false, cashback: false,
});
```

### Buy tokens (needs on-chain state)
```typescript
import { PUMP_SDK, OnlinePumpSdk } from "@nirholas/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const online = new OnlinePumpSdk(connection);
const global = await online.fetchGlobal();
const { bondingCurve, bondingCurveAccountInfo, associatedUserAccountInfo } =
  await online.fetchBuyState(mint, user);

const ixs = await PUMP_SDK.buyInstructions({
  global, bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo,
  mint, user, solAmount, amount, slippage: 1, tokenProgram: TOKEN_PROGRAM_ID,
});
```

### Bonding curve math
```typescript
import { getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount } from "@nirholas/pump-sdk";

const tokens = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply, bondingCurve, amount });
const sol = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply, bondingCurve, amount });
```

### Fee sharing (shares must total 10,000 BPS)
```typescript
const ix = await PUMP_SDK.createFeeSharingConfig({
  mint,
  shareholders: [
    { address: creator, shareBps: 7000 },
    { address: partner, shareBps: 3000 },
  ],
  user,
});
```

## Import Paths

```typescript
// Core SDK
import { PUMP_SDK, PumpSdk, OnlinePumpSdk } from "@nirholas/pump-sdk";

// Constants
import { PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID } from "@nirholas/pump-sdk";

// Bonding curve math
import { getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount, newBondingCurve } from "@nirholas/pump-sdk";

// PDAs
import { bondingCurvePda, globalPda, feeSharingConfigPda } from "@nirholas/pump-sdk";

// State types
import type { BondingCurve, Global, FeeConfig, SharingConfig, Pool, Shareholder } from "@nirholas/pump-sdk";

// Fees
import { getFee, computeFeesBps, calculateFeeTier } from "@nirholas/pump-sdk";

// 2026-04-28 breaking fee-recipient upgrade
import {
  BREAKING_FEE_RECIPIENTS,
  pickBreakingFeeRecipient,
  buildAmmBreakingFeeRecipientAccounts,
} from "@nirholas/pump-sdk";

// Analytics
import { calculateBuyPriceImpact, getGraduationProgress, getTokenPrice } from "@nirholas/pump-sdk";

// Solana
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
```

## Key Types

```typescript
interface BondingCurve {
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;       // true = graduated to AMM, bonding curve trading disabled
  creator: PublicKey;
  isMayhemMode: boolean;
}

interface Shareholder {
  address: PublicKey;
  shareBps: number;        // Basis points. All shareholders must sum to exactly 10,000
}

interface Global {
  initialized: boolean;
  authority: PublicKey;
  feeRecipient: PublicKey;
  initialVirtualTokenReserves: BN;
  initialVirtualSolReserves: BN;
  initialRealTokenReserves: BN;
  tokenTotalSupply: BN;
  feeBasisPoints: BN;
  // ... more fields, read src/state.ts for full definition
}
```

## Common Pitfalls (DO NOT make these mistakes)

1. **Using `createInstruction`** — DEPRECATED. Use `createV2Instruction`.
2. **Using `number` for amounts** — WRONG. Use `new BN(...)`. Always.
3. **Trading on a graduated curve** — Check `bondingCurve.complete`. If `true`, use AMM methods.
4. **Shares not summing to 10,000** — Fee sharing config requires exactly 10,000 BPS total.
5. **Returning `Transaction` instead of `TransactionInstruction[]`** — SDK returns instructions, not transactions.
6. **Calling `npx tsc --noEmit`** — FORBIDDEN. Use `npm run typecheck`.
7. **Not extending accounts before migration** — `BONDING_CURVE_NEW_SIZE = 151`, accounts may need extension.
8. **Importing from internal paths** — Import from `@nirholas/pump-sdk`, not `@nirholas/pump-sdk/dist/...`.
9. **Hand-rolling buy/sell without the breaking fee recipient** — After the 2026-04-28 upgrade, every bonding curve buy/sell must carry one of 8 mutable trailing fee recipients (`pickBreakingFeeRecipient()`), and every AMM buy/sell must carry that recipient **plus** its quote-mint ATA (`buildAmmBreakingFeeRecipientAccounts()`). Using `PUMP_SDK.*` and `OnlinePumpSdk` gets this right automatically. See `docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md`.

## Project Layout

| Directory | What it is |
|-----------|-----------|
| `src/` | Core SDK: instruction builders, bonding curve math, PDAs, state types, events, analytics |
| `src/__tests__/` | Jest unit tests with fixture helpers in `fixtures.ts` |
| `src/idl/` | Anchor IDL JSON + generated TypeScript types for all 3 programs |
| `rust/` | Rust vanity address generator (rayon + solana-sdk, 100K+ keys/sec) |
| `typescript/` | TypeScript vanity generator (educational, ~1K keys/sec) |
| `mcp-server/` | MCP server (55 tools, 4 resources, 5 prompts) |
| `telegram-bot/` | PumpFun Telegram bot |
| `websocket-server/` | WebSocket relay server |
| `live/` | Browser dashboards (HTML/JS) |
| `scripts/` | Bash wrappers for solana-keygen |
| `docs/` | Documentation |
| `tests/` | Integration tests |
| `website/` | PumpOS web desktop |

## Build & Test Commands

```bash
npm run build          # tsup --clean --dts
npm run dev            # tsup --watch
npm test               # jest
npm run test:coverage  # jest --coverage
npm run lint           # eslint --cache --quiet
npm run lint:fix       # eslint --cache --fix --quiet
npm run typecheck      # tsc --noEmit (use THIS, never npx tsc)
```

## TypeScript Config

- Target: ES2020, Module: CommonJS, Strict mode
- `noUncheckedIndexedAccess: true` — array/object index access returns `T | undefined`
- `noUnusedLocals: true`, `noUnusedParameters: true` — no dead code
- Source is in `src/`, output to `dist/`

## Test Patterns

Tests live in `src/__tests__/`. Use existing fixtures:

```typescript
import { TEST_PUBKEY, makeGlobal, makeBondingCurve, makeFeeConfig } from "./fixtures";

describe("myFeature", () => {
  it("does the thing", () => {
    const global = makeGlobal();
    const bc = makeBondingCurve({ complete: false });
    // ... test logic
  });
});
```

## Security Rules

1. **ONLY** official Solana Labs crypto: `solana-sdk`, `@solana/web3.js`, `solana-keygen`
2. Zeroize all key material after use
3. File permissions `0600` for keypairs
4. No network calls for key generation

## Skills

See `.github/skills/` for 28 skill documents. Each has `applyTo` frontmatter — loaded only when editing matching files. Read the relevant skill before working in an unfamiliar area.

## Terminal Management (MANDATORY)

> **CRITICAL: Every terminal you open MUST be killed after use. No exceptions.**

- **Always use background terminals** (`isBackground: true`) for every command
- **Always kill the terminal** after the command completes — never leave terminals open
- If a terminal seems unresponsive, kill it and create a new one

## Forbidden Commands

- **NEVER run `npx tsc --noEmit`** — use `npm run typecheck` instead


