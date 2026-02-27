# Getting Started

A quick-start guide for integrating the Pump SDK into your TypeScript/JavaScript project.

<div align="center">
  <img src="assets/pump.svg" alt="Bonding curve price mechanics" width="720">
</div>

## Installation

```bash
npm install @pump-fun/pump-sdk
# or
yarn add @pump-fun/pump-sdk
# or
pnpm add @pump-fun/pump-sdk
```

### Peer Dependencies

The SDK depends on these Solana ecosystem packages:

```bash
npm install @solana/web3.js @coral-xyz/anchor @solana/spl-token bn.js
```

## Quick Start

### 1. Initialize the SDK

The SDK offers two modes of operation:

- **Offline (`PumpSdk`)** — builds transaction instructions without a network connection
- **Online (`OnlinePumpSdk`)** — fetches on-chain state and builds complete transactions

```typescript
import { Connection } from "@solana/web3.js";
import { PumpSdk, OnlinePumpSdk, PUMP_SDK } from "@pump-fun/pump-sdk";

// Option A: Use the pre-built singleton (offline only)
const offlineSdk = PUMP_SDK;

// Option B: Create an online SDK with a connection
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const sdk = new OnlinePumpSdk(connection);
```

### 2. Create a Token

```typescript
import { Keypair, PublicKey } from "@solana/web3.js";

const mint = Keypair.generate();
const creator = wallet.publicKey; // your wallet

const instruction = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "My Token",
  symbol: "MTK",
  uri: "https://example.com/metadata.json",
  creator,
  user: creator,
  mayhemMode: false,
});
```

### 3. Buy Tokens

```typescript
import BN from "bn.js";
import { getBuyTokenAmountFromSolAmount } from "@pump-fun/pump-sdk";

const mint = new PublicKey("...");
const user = wallet.publicKey;

const global = await sdk.fetchGlobal();
const feeConfig = await sdk.fetchFeeConfig();
const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
  await sdk.fetchBuyState(mint, user);

const solAmount = new BN(0.1 * 1e9); // 0.1 SOL in lamports
const tokenAmount = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: null,
  bondingCurve,
  amount: solAmount,
});

const instructions = await PUMP_SDK.buyInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  associatedUserAccountInfo,
  mint,
  user,
  solAmount,
  amount: tokenAmount,
  slippage: 1, // 1%
  tokenProgram: TOKEN_PROGRAM_ID,
});
```

### 4. Sell Tokens

```typescript
import { getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const { bondingCurveAccountInfo, bondingCurve } = await sdk.fetchSellState(
  mint,
  user,
);
const sellAmount = new BN(15_828);

const instructions = await PUMP_SDK.sellInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  mint,
  user,
  amount: sellAmount,
  solAmount: getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: sellAmount,
  }),
  slippage: 1,
  tokenProgram: TOKEN_PROGRAM_ID,
  mayhemMode: false,
});
```

### 5. Send a Transaction

```typescript
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const tx = new Transaction().add(...instructions);
const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);
console.log("Transaction:", signature);
```

## Next Steps

- [Examples](./examples.md) — practical code examples for common operations
- [Analytics Guide](./analytics.md) — price impact, graduation progress, token pricing
- [API Reference](./api-reference.md) — full class and function documentation
- [Architecture](./architecture.md) — how the SDK is structured
- [Bonding Curve Math](./bonding-curve-math.md) — virtual reserves, price formulas
- [Fee Sharing Guide](./fee-sharing.md) — set up creator fee distribution
- [Token Incentives Guide](./token-incentives.md) — volume-based token rewards
- [Tutorials](../tutorials/) — 19 hands-on guides covering every SDK feature
- [Migration Guide](./MIGRATION.md) — upgrading between versions
- [Troubleshooting](./TROUBLESHOOTING.md) — common issues and solutions
- [Tutorials](../tutorials/) — 19 hands-on guides covering every feature

### Ecosystem

- [MCP Server](../mcp-server/) — 47 tools for AI agents (Claude, GPT, Cursor)
- [Telegram Bot](../telegram-bot/) — fee claim monitor, CTO alerts, whale detection
- [WebSocket Relay](../websocket-server/) — real-time token launch feed for browsers
- [Live Dashboards](../live/) — browser-based token launch & trades monitoring
- [x402 Payments](../x402/) — HTTP 402 micropayments with Solana USDC
- [DeFi Agents](../packages/defi-agents/) — 58 AI agent definitions for DeFi workflows
- [PumpOS Website](../website/) — web desktop with 169 apps

