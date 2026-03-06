<p align="center">
  <h1 align="center">Pump SDK</h1>
  <p align="center">
    TypeScript SDK for the Pump protocol on Solana — token creation, bonding curves, AMM pools, fee sharing, and volume rewards.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@pump-fun/pump-sdk"><img src="https://img.shields.io/npm/v/@pump-fun/pump-sdk.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://github.com/nirholas/pump-fun-sdk/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@pump-fun/pump-sdk.svg?style=flat-square" alt="license" /></a>
  <a href="https://www.npmjs.com/package/@pump-fun/pump-sdk"><img src="https://img.shields.io/npm/dm/@pump-fun/pump-sdk.svg?style=flat-square" alt="downloads" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Solana-1.98+-purple?style=flat-square&logo=solana" alt="Solana" />
</p>

---

## What is Pump SDK?

Pump SDK is the community TypeScript SDK for the [Pump.fun](https://pump.fun) protocol on Solana. It provides **offline-first instruction builders** for every on-chain operation — token creation, bonding curve trading, AMM pool management, tiered fee configuration, creator fee sharing, volume-based token incentives, and social referral fees.

The SDK never sends transactions itself. It returns `TransactionInstruction[]` that you compose into transactions with your preferred signing and sending strategy.

---

## ✨ Features

- **Offline Instruction Building** — Pure functions that return `TransactionInstruction[]` without requiring an RPC connection
- **Bonding Curve Math** — Buy/sell quoting, market cap calculation, graduation progress tracking
- **AMM Pool Trading** — Buy, sell, deposit, and withdraw on graduated PumpAMM pools
- **Tiered Fee System** — Dynamic protocol and creator fees based on market cap thresholds
- **Creator Fee Sharing** — Split creator fees among up to 10 shareholders with basis-point precision
- **Volume Rewards** — Track trading volume and claim $PUMP token incentives
- **Cashback & Mayhem Mode** — Special trading modes with fee rebates and randomized parameters
- **Social Fee PDAs** — Referral fee accounts linked to social identities (GitHub, X)
- **Event Decoding** — Decode all on-chain events from Pump, PumpAMM, and PumpFees programs
- **Analytics** — Price impact, token pricing, and bonding curve summary calculations
- **Dual Build** — Ships both CommonJS and ESM with full TypeScript declarations
- **Rust Vanity Generator** — Multi-threaded address generator at 100K+ keys/sec
- **TypeScript Vanity Generator** — Educational reference implementation

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Usage Examples](#-usage-examples)
  - [Create a Token](#create-a-token)
  - [Buy Tokens on the Bonding Curve](#buy-tokens-on-the-bonding-curve)
  - [Sell Tokens](#sell-tokens)
  - [Check Graduation Progress](#check-graduation-progress)
  - [Set Up Fee Sharing](#set-up-fee-sharing)
- [API Reference](#-api-reference)
- [On-Chain Programs](#-on-chain-programs)
- [Configuration](#-configuration)
- [Error Handling](#-error-handling)
- [FAQ](#-faq)
- [Architecture](#-architecture)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🚀 Quick Start

### Installation

```bash
# npm
npm install @pump-fun/pump-sdk

# yarn
yarn add @pump-fun/pump-sdk

# pnpm
pnpm add @pump-fun/pump-sdk
```

### Peer Dependencies

The SDK requires these Solana packages (install them if not already present):

```bash
npm install @solana/web3.js @solana/spl-token @coral-xyz/anchor bn.js
```

### Minimal Example

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

// 1. Create an online SDK instance
const connection = new Connection("https://api.mainnet-beta.solana.com");
const sdk = new OnlinePumpSdk(connection);

// 2. Fetch current token state
const mint = new PublicKey("YourTokenMintAddress...");
const summary = await sdk.fetchBondingCurveSummary(mint);

console.log("Market Cap:", summary.marketCap.toString(), "lamports");
console.log("Graduated:", summary.isGraduated);
console.log("Progress:", summary.progressBps / 100, "%");
```

---

## 📖 Usage Examples

### Create a Token

```typescript
import { Keypair } from "@solana/web3.js";
import { PUMP_SDK } from "@pump-fun/pump-sdk";

const mintKeypair = Keypair.generate();
const creator = wallet.publicKey;

const createIx = await PUMP_SDK.createV2Instruction({
  mint: mintKeypair.publicKey,
  name: "My Token",
  symbol: "MYTKN",
  uri: "https://arweave.net/metadata.json",
  creator,
  user: creator,
  mayhemMode: false,
});

// createIx is a TransactionInstruction — add to a Transaction and send
```

> **Warning**: Do NOT use `createInstruction` — it is deprecated (v1). Always use `createV2Instruction`.

### Buy Tokens on the Bonding Curve

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const sdk = new OnlinePumpSdk(connection);

const mint = new PublicKey("TokenMintAddress...");
const user = wallet.publicKey;

// Fetch all required state in one call
const buyState = await sdk.fetchBuyState(mint, user);

// Buy with 0.1 SOL
const solAmount = new BN(100_000_000); // 0.1 SOL in lamports

const buyIxs = await sdk.buyInstructions({
  ...buyState,
  mint,
  user,
  amount: new BN(0),      // set to 0 when using solAmount
  solAmount,
  slippage: 0.05,         // 5% slippage tolerance
});
// buyIxs is TransactionInstruction[] — compose into a Transaction
```

### Sell Tokens

```typescript
import BN from "bn.js";
import { getSellSolAmountFromTokenAmount, OnlinePumpSdk } from "@pump-fun/pump-sdk";

const sdk = new OnlinePumpSdk(connection);

// Fetch required state in parallel
const [sellState, global, feeConfig] = await Promise.all([
  sdk.fetchSellState(mint, user),
  sdk.fetchGlobal(),
  sdk.fetchFeeConfig(),
]);

const tokenAmount = new BN(1_000_000); // 1 token (6 decimals)
const expectedSol = getSellSolAmountFromTokenAmount({
  global,
  feeConfig,
  mintSupply: sellState.bondingCurve.tokenTotalSupply,
  bondingCurve: sellState.bondingCurve,
  amount: tokenAmount,
});

const sellIxs = await sdk.sellInstructions({
  ...sellState,
  mint,
  user,
  amount: tokenAmount,
  solAmount: expectedSol,
  slippage: 0.05,
});
```

> **Tip**: Use `sdk.sellAllInstructions({ mint, user })` to sell your entire balance in one call.

### Check Graduation Progress

```typescript
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

const sdk = new OnlinePumpSdk(connection);
const progress = await sdk.fetchGraduationProgress(mint);

console.log(`Progress: ${progress.progressBps / 100}%`);
console.log(`Graduated: ${progress.isGraduated}`);
console.log(`Tokens remaining: ${progress.tokensRemaining.toString()}`);
console.log(`SOL accumulated: ${progress.solAccumulated.toString()}`);
```

### Set Up Fee Sharing

```typescript
import { PublicKey } from "@solana/web3.js";
import { PUMP_SDK } from "@pump-fun/pump-sdk";

// Create a fee sharing config (creator only, before or after graduation)
const createConfigIx = await PUMP_SDK.createFeeSharingConfig({
  creator: wallet.publicKey,
  mint: tokenMint,
  pool: null,  // null for pre-graduation tokens
});

// Update shareholders (must total exactly 10,000 BPS = 100%)
const updateIx = await PUMP_SDK.updateFeeShares({
  authority: wallet.publicKey,
  mint: tokenMint,
  currentShareholders: [wallet.publicKey],
  newShareholders: [
    { address: wallet.publicKey, shareBps: 7000 },         // 70%
    { address: new PublicKey("Partner..."), shareBps: 3000 }, // 30%
  ],
});
```

> **Warning**: Shares must total **exactly** 10,000 BPS. The SDK throws `InvalidShareTotalError` otherwise. Maximum 10 shareholders.

---

## 📚 API Reference

See [docs/api-reference.md](./docs/api-reference.md) for the complete API documentation with full TypeScript signatures, parameters, and examples.

### Core Classes

| Class | Description |
|-------|-------------|
| `PumpSdk` | Offline instruction builder — no RPC connection required |
| `OnlinePumpSdk` | Extends `PumpSdk` with RPC fetchers for account state |
| `PUMP_SDK` | Pre-instantiated singleton of `PumpSdk` |

### Bonding Curve Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getBuyTokenAmountFromSolAmount(...)` | `BN` | Tokens received for a given SOL amount |
| `getBuySolAmountFromTokenAmount(...)` | `BN` | SOL cost for a given token amount |
| `getSellSolAmountFromTokenAmount(...)` | `BN` | SOL received for selling tokens |
| `bondingCurveMarketCap(...)` | `BN` | Current market cap in lamports |
| `newBondingCurve(global)` | `BondingCurve` | Fresh bonding curve from global config |

### Analytics Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `calculateBuyPriceImpact(...)` | `PriceImpactResult` | Price impact for a buy trade |
| `calculateSellPriceImpact(...)` | `PriceImpactResult` | Price impact for a sell trade |
| `getGraduationProgress(...)` | `GraduationProgress` | Bonding curve completion percentage |
| `getTokenPrice(...)` | `TokenPriceInfo` | Current buy/sell price per token |
| `getBondingCurveSummary(...)` | `BondingCurveSummary` | Complete bonding curve overview |

### Fee Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getFee(...)` | `BN` | Fee amount for a trade |
| `computeFeesBps(...)` | `CalculatedFeesBps` | Current fee basis points (protocol + creator) |
| `calculateFeeTier(...)` | `Fees` | Fee tier for a given market cap |

### Token Incentive Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `totalUnclaimedTokens(...)` | `BN` | Unclaimed $PUMP reward tokens |
| `currentDayTokens(...)` | `BN` | Tokens earned today |

---

## 🔗 On-Chain Programs

| Program | ID | Purpose |
|---------|----|---------|
| **Pump** | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve creation, buying, selling, migration |
| **PumpAMM** | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated AMM pools — trading, liquidity, fees |
| **PumpFees** | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing config and social fee PDAs |

---

## 🔧 Configuration

### Constructor

The SDK has no required environment variables. You configure it via the constructor:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `connection` | `Connection` | Only for `OnlinePumpSdk` | Solana RPC connection |

### Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PUMP_PROGRAM_ID` | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Main Pump program |
| `PUMP_AMM_PROGRAM_ID` | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | AMM program |
| `PUMP_FEE_PROGRAM_ID` | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee program |
| `PUMP_TOKEN_MINT` | `pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn` | $PUMP token mint |
| `MAX_SHAREHOLDERS` | `10` | Maximum shareholders in fee sharing |
| `ONE_BILLION_SUPPLY` | `1000000000000000` | 1B tokens with 6 decimals |
| `BONDING_CURVE_NEW_SIZE` | `151` | Bonding curve account size in bytes |

---

## ⚠️ Error Handling

The SDK defines typed errors for fee sharing validation:

| Error | Cause | Fix |
|-------|-------|-----|
| `NoShareholdersError` | Empty shareholders array | Provide at least 1 shareholder |
| `TooManyShareholdersError` | More than 10 shareholders | Reduce to ≤ 10 shareholders |
| `ZeroShareError` | A shareholder has 0 or negative BPS | Set all shares to positive values |
| `InvalidShareTotalError` | Shares don't sum to 10,000 BPS | Ensure shares total exactly 10,000 |
| `DuplicateShareholderError` | Same address appears twice | Remove duplicate addresses |
| `ShareCalculationOverflowError` | BPS sum exceeds safe integer range | Check share values |
| `PoolRequiredForGraduatedError` | `pool` is null for a graduated coin | Pass the pool address from `fetchPool()` |

### Common Pitfalls

> **Warning**: Never use JavaScript `number` for token or lamport amounts. Always use `BN` from bn.js. JavaScript numbers lose precision above 2^53.

> **Warning**: Check `bondingCurve.complete` before trading. If `true`, the token has graduated to AMM — use `ammBuyInstruction`/`ammSellInstruction` instead.

> **Warning**: `createInstruction` is deprecated. Use `createV2Instruction` for all new token creation.

---

## ❓ FAQ

**Q: Do I need an RPC connection to use the SDK?**
No. `PumpSdk` (and the `PUMP_SDK` singleton) builds instructions offline. Only use `OnlinePumpSdk` when you need to fetch on-chain state.

**Q: How do I know if a token has graduated to AMM?**
Check `bondingCurve.complete === true` or use `sdk.isGraduated(mint)`. Graduated tokens trade on PumpAMM, not the bonding curve.

**Q: What is `slippage` in buy/sell instructions?**
A decimal fraction (e.g., `0.05` = 5%). The SDK adjusts `maxSolCost` (buy) or `minSolOutput` (sell) to protect against price movement.

**Q: Why do amounts use `BN` instead of `number`?**
Solana token amounts (lamports, token units) regularly exceed JavaScript's safe integer limit (2^53). `BN` provides arbitrary-precision arithmetic.

**Q: What's the difference between Pump and PumpAMM programs?**
Pump handles the bonding curve phase (creation → graduation). PumpAMM handles post-graduation trading with constant-product AMM pools.

**Q: How does fee sharing work?**
Token creators can split their creator fees among up to 10 shareholders. Each shareholder gets a share in basis points (1/10,000). The total must equal exactly 10,000 BPS (100%).

**Q: What is Mayhem Mode?**
A special token creation mode with randomized bonding curve parameters. Tokens created with `mayhemMode: true` have unpredictable pricing dynamics.

**Q: Can I use the SDK in the browser?**
Yes. The SDK has no Node.js-specific dependencies. The ESM build works in modern browsers with a bundler.

---

## 🏗️ Architecture

See [docs/architecture.md](./docs/architecture.md) for detailed system design, data flow diagrams, and module explanations.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup
- Branch naming and commit conventions
- Testing requirements
- PR process

---

## 📄 License

[MIT](./LICENSE) © [nirholas](https://github.com/nirholas)

---

## 🙏 Acknowledgments

- **[Pump.fun](https://pump.fun)** — The protocol this SDK interfaces with
- **[Solana Labs](https://solana.com)** — Blockchain infrastructure and `@solana/web3.js`
- **[Coral (Anchor)](https://www.anchor-lang.com/)** — IDL-based program interaction via `@coral-xyz/anchor`
- **[bn.js](https://github.com/indutny/bn.js)** — Arbitrary-precision arithmetic for financial math
- **[@pump-fun/pump-swap-sdk](https://www.npmjs.com/package/@pump-fun/pump-swap-sdk)** — AMM swap integration
