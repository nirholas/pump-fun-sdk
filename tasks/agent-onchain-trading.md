# Task: On-Chain Trading Execution for AI Agents

## Goal

Enable AI agents (LLM-driven bots, MCP tools, automated strategies) to **actually sign and broadcast Solana transactions** — not just build instructions. This is the missing layer between "SDK builds instructions" and "agent executes a trade."

## Current State

The SDK builds `TransactionInstruction[]`. Agents currently must implement their own:
- Keypair/wallet management
- Transaction construction + blockhash fetch
- Priority fee estimation
- Signing + sending
- Confirmation polling + retry

This is too much boilerplate for an agent. We need a `PumpAgent` class that wraps it all.

## Design

### `src/agent.ts` — New File

```typescript
import {
  Connection,
  Keypair,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";
import { OnlinePumpSdk, PUMP_SDK } from "./onlineSdk";
import { getSellSolAmountFromTokenAmount, getBuyTokenAmountFromSolAmount } from "./bondingCurve";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface AgentTradeResult {
  signature: string;
  slot: number;
  mint: PublicKey;
  action: "buy" | "sell";
  amountIn: BN;   // SOL for buy, tokens for sell
  amountOut: BN;  // tokens for buy, SOL for sell (estimated)
}

export interface AgentConfig {
  connection: Connection;
  keypair: Keypair;
  /** Default slippage in percent, e.g. 5 for 5%. Default: 5 */
  slippagePct?: number;
  /** Compute unit price in micro-lamports. Default: 100_000 */
  priorityFee?: number;
  /** Max retries on transient errors. Default: 3 */
  maxRetries?: number;
}

/**
 * PumpAgent — executes real on-chain buy/sell transactions.
 *
 * Designed for AI agent use: minimal setup, sensible defaults,
 * structured return values for the LLM to reason about.
 *
 * Security:
 * - Keypair stays in memory only; never logged or serialized
 * - All amounts validated before broadcast
 * - Overflow pre-check before sell
 */
export class PumpAgent {
  private online: OnlinePumpSdk;
  private keypair: Keypair;
  private slippagePct: number;
  private priorityFee: number;
  private maxRetries: number;

  constructor({ connection, keypair, slippagePct = 5, priorityFee = 100_000, maxRetries = 3 }: AgentConfig) {
    this.online = new OnlinePumpSdk(connection);
    this.keypair = keypair;
    this.slippagePct = slippagePct;
    this.priorityFee = priorityFee;
    this.maxRetries = maxRetries;
  }

  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  /**
   * Buy tokens on the bonding curve using an exact SOL amount.
   * @param mint Token mint address
   * @param solLamports SOL to spend (in lamports, use `new BN(0.1e9)` for 0.1 SOL)
   */
  async buy(mint: PublicKey, solLamports: BN): Promise<AgentTradeResult> {
    const [buyState, global, feeConfig] = await Promise.all([
      this.online.fetchBuyState(mint, this.keypair.publicKey),
      this.online.fetchGlobal(),
      this.online.fetchFeeConfig(),
    ]);

    const estimatedTokens = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: buyState.bondingCurve.tokenTotalSupply,
      bondingCurve: buyState.bondingCurve,
      amount: solLamports,
    });

    const ixs = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
      bondingCurve: buyState.bondingCurve,
      associatedUserAccountInfo: buyState.associatedUserAccountInfo,
      mint,
      user: this.keypair.publicKey,
      amount: estimatedTokens,
      solAmount: solLamports,
      slippage: this.slippagePct,
      tokenProgram: buyState.tokenProgram,
    });

    const sig = await this.sendTransaction(ixs);
    return {
      signature: sig,
      slot: 0,
      mint,
      action: "buy",
      amountIn: solLamports,
      amountOut: estimatedTokens,
    };
  }

  /**
   * Sell an exact token amount back to the bonding curve.
   * Automatically chunks if amount would overflow on-chain.
   * @param mint Token mint address
   * @param tokenAmount Raw token units (6 decimals): 1 token = new BN(1_000_000)
   */
  async sell(mint: PublicKey, tokenAmount: BN): Promise<AgentTradeResult[]> {
    return this.online.sellChunked({
      mint,
      user: this.keypair.publicKey,
      totalAmount: tokenAmount,
      slippage: this.slippagePct,
      sendTx: (ixs) => this.sendTransaction(ixs),
    });
  }

  /**
   * Sell ALL tokens the agent holds for a given mint.
   */
  async sellAll(mint: PublicKey): Promise<AgentTradeResult[]> {
    const sellState = await this.online.fetchSellState(mint, this.keypair.publicKey);
    const { amount } = this.decodeTokenBalance(sellState.associatedUserAccountInfo);
    if (amount.isZero()) throw new Error("No tokens to sell");
    return this.sell(mint, amount);
  }

  /**
   * Get current SOL balance of the agent wallet.
   */
  async solBalance(): Promise<BN> {
    const lamports = await this.online["connection"].getBalance(this.keypair.publicKey);
    return new BN(lamports);
  }

  private decodeTokenBalance(ataInfo: import("@solana/web3.js").AccountInfo<Buffer> | null): { amount: BN } {
    if (!ataInfo) return { amount: new BN(0) };
    // SPL token account: amount is at bytes 64-72 (little-endian u64)
    const amount = new BN(ataInfo.data.slice(64, 72), "le");
    return { amount };
  }

  private async sendTransaction(ixs: TransactionInstruction[], attempt = 0): Promise<string> {
    const connection = this.online["connection"];

    const computeIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: this.priorityFee }),
    ];

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const message = new TransactionMessage({
      payerKey: this.keypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [...computeIxs, ...ixs],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([this.keypair]);

    const sig = await connection.sendTransaction(tx, { skipPreflight: false });

    const result = await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    if (result.value.err) {
      if (attempt < this.maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        return this.sendTransaction(ixs, attempt + 1);
      }
      throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
    }

    return sig;
  }
}
```

## MCP Tool Wrappers

Add to `mcp-server/` — expose `PumpAgent` actions as MCP tools so any MCP-compatible AI (Claude, etc.) can call them:

### Tool: `agent_buy`
```json
{
  "name": "agent_buy",
  "description": "Buy tokens on the Pump bonding curve. Executes a real on-chain transaction.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "mint": { "type": "string", "description": "Token mint address" },
      "solAmount": { "type": "string", "description": "SOL to spend in lamports (e.g. '100000000' = 0.1 SOL)" }
    },
    "required": ["mint", "solAmount"]
  }
}
```

### Tool: `agent_sell`
```json
{
  "name": "agent_sell",
  "description": "Sell exact token amount back to the bonding curve. Auto-chunks if needed.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "mint": { "type": "string" },
      "tokenAmount": { "type": "string", "description": "Raw token units (6 decimals)" }
    },
    "required": ["mint", "tokenAmount"]
  }
}
```

### Tool: `agent_sell_all`
```json
{
  "name": "agent_sell_all",
  "description": "Sell entire token balance for a given mint.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "mint": { "type": "string" }
    },
    "required": ["mint"]
  }
}
```

### Tool: `agent_sol_balance`
```json
{
  "name": "agent_sol_balance",
  "description": "Returns the agent wallet's current SOL balance in lamports.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

## Security Requirements

1. Keypair must be loaded from `AGENT_PRIVATE_KEY` env var (base58 encoded) — never hardcoded
2. Never log the private key, even in debug mode
3. Add spend limits: `MAX_SOL_PER_TRADE` env guard in MCP tool handler
4. Rate-limit: max N trades per minute configurable via env

## Environment Variables

```env
# Required
AGENT_PRIVATE_KEY=base58_encoded_private_key
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...

# Optional tuning
AGENT_SLIPPAGE_PCT=5
AGENT_PRIORITY_FEE_MICROLAMPORTS=100000
AGENT_MAX_SOL_PER_TRADE=1000000000
AGENT_MAX_RETRIES=3
```

## Exports

Add to `src/index.ts`:
```typescript
export { PumpAgent } from "./agent";
export type { AgentConfig, AgentTradeResult } from "./agent";
```

## Acceptance Criteria

- [ ] `PumpAgent.buy()` executes a real transaction on devnet and returns a valid signature
- [ ] `PumpAgent.sell()` chunked sell works for amounts above the safe threshold
- [ ] `PumpAgent.sellAll()` correctly reads on-chain token balance
- [ ] MCP tools registered and callable from Claude Desktop
- [ ] No private key ever appears in logs (`npm run lint` passes with no-console rule)
- [ ] `npm run typecheck` passes
- [ ] Integration test in `tests/integration/test-agent-buy-sell.ts` passes on devnet
