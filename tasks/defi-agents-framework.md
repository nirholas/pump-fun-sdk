# Task: DeFi Agent Framework for PumpFun

## Goal

Build a production-grade framework that lets autonomous AI agents reason about and execute DeFi strategies on the Pump protocol — including bonding curve trading, AMM swaps, fee harvesting, and portfolio management — with on-chain execution, risk controls, and LLM-readable state.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 LLM / Agent Runtime               │
│  (Claude, GPT-4o, local model via Ollama, etc.)  │
└────────────────────┬─────────────────────────────┘
                     │  Tool calls
┌────────────────────▼─────────────────────────────┐
│              PumpDeFiAgent (new class)            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │StrategyEngine│  │ RiskManager  │  │Portfolio │ │
│  └──────┬──────┘  └──────┬───────┘  └────┬─────┘ │
└─────────┼────────────────┼───────────────┼────────┘
          │                │               │
┌─────────▼────────────────▼───────────────▼────────┐
│         PumpAgent (on-chain execution)             │
│         OnlinePumpSdk (state + instructions)       │
└────────────────────────────────────────────────────┘
```

## Core Classes

### `src/defi/strategy.ts`

```typescript
export type Strategy =
  | { type: "momentum"; mint: PublicKey; entryThresholdPct: number; exitThresholdPct: number }
  | { type: "graduation-snipe"; watchlist: PublicKey[]; buyAtPct: number }
  | { type: "fee-harvest"; mint: PublicKey; minFeeThresholdLamports: BN }
  | { type: "dca-buy"; mint: PublicKey; intervalMs: number; amountLamports: BN; maxBuys: number }
  | { type: "copy-trade"; watchAddress: PublicKey; copyBuys: boolean; copySells: boolean };

export interface StrategyResult {
  executed: boolean;
  action?: "buy" | "sell" | "harvest" | "skip";
  reason: string;        // human-readable explanation for LLM
  signatures: string[];
}
```

### `src/defi/risk.ts`

```typescript
export interface RiskLimits {
  maxPositionLamports: BN;       // max SOL in any single token
  maxTotalExposureLamports: BN;  // max SOL across all positions
  maxSlippagePct: number;        // refuse trades with higher slippage
  maxPriceImpactPct: number;     // refuse if buy moves price > X%
  minLiquidityLamports: BN;      // refuse if curve has less SOL than this
  stopLossPct: number;           // auto-sell if position down X%
  takeProfitPct: number;         // auto-sell if position up X%
}

export class RiskManager {
  check(action: "buy" | "sell", mint: PublicKey, amount: BN, state: BondingCurve, limits: RiskLimits): {
    allowed: boolean;
    reason: string;
  };
}
```

### `src/defi/portfolio.ts`

```typescript
export interface Position {
  mint: PublicKey;
  tokenBalance: BN;
  entryPriceLamports: BN;  // average entry price
  entryTimestamp: number;
  unrealizedPnlLamports: BN;
  realizedPnlLamports: BN;
}

export class Portfolio {
  async getPositions(connection: Connection, owner: PublicKey): Promise<Position[]>;
  async getTotalValueLamports(connection: Connection, owner: PublicKey): Promise<BN>;
  async exportCSV(): Promise<string>;
  async exportJSON(): Promise<object>;
}
```

### `src/defi/agent.ts` — `PumpDeFiAgent`

```typescript
export class PumpDeFiAgent {
  constructor(config: {
    connection: Connection;
    keypair: Keypair;
    riskLimits: RiskLimits;
    strategies: Strategy[];
  });

  /** Run one tick of all registered strategies */
  async tick(): Promise<StrategyResult[]>;

  /** Start autonomous loop with configurable interval */
  start(intervalMs?: number): void;

  /** Stop the loop gracefully */
  stop(): void;

  /** Get current portfolio state as LLM-readable JSON */
  async portfolioSnapshot(): Promise<object>;

  /** Natural language explanation of last tick decisions */
  async explainLastTick(): Promise<string>;
}
```

## Strategy Implementations

### Momentum Strategy

```
1. Fetch bonding curve every tick
2. Compute 5-minute price change %
3. If price rose > entryThresholdPct AND no position → BUY
4. If price fell > exitThresholdPct AND have position → SELL
5. Always check RiskManager before executing
```

### Graduation Snipe

```
1. Watch a list of mints for getGraduationProgress() > buyAtPct
2. When threshold hit, buy a fixed SOL amount
3. Set a take-profit target (e.g. 2x AMM listing price)
4. After migration, switch to PumpSwap sell
```

### DCA Buy

```
1. Every intervalMs, buy amountLamports of SOL worth of tokens
2. Average down the entry price
3. After maxBuys purchases, stop and wait for take-profit
```

### Copy Trade

```
1. Subscribe to WebSocket for TradeEvents on watchAddress
2. Mirror each buy/sell proportionally to agent wallet size
3. Respect all risk limits before executing
```

### Fee Harvest

```
1. Check creator fee vault balance via OnlinePumpSdk
2. If balance > minFeeThresholdLamports, call collectCreatorFee()
3. Optionally compound: re-invest harvested fees into DCA buy
```

## MCP Tools for Strategy Control

These let Claude (or any LLM) control the agent via natural language:

| Tool | Description |
|------|-------------|
| `agent_add_strategy` | Register a new strategy (params: strategy JSON) |
| `agent_remove_strategy` | Remove strategy by ID |
| `agent_list_strategies` | List active strategies and their state |
| `agent_portfolio` | Get full portfolio snapshot |
| `agent_pnl` | Get realized + unrealized PnL |
| `agent_pause` | Pause all strategy execution |
| `agent_resume` | Resume execution |
| `agent_risk_limits` | Get/set risk limits |
| `agent_explain` | Natural language explanation of recent decisions |

## Event System

```typescript
// All agent actions emit typed events for logging/webhooks
agent.on("trade", (result: AgentTradeResult) => { ... });
agent.on("risk-blocked", (reason: string, action: object) => { ... });
agent.on("strategy-error", (strategy: Strategy, error: Error) => { ... });
agent.on("position-opened", (position: Position) => { ... });
agent.on("position-closed", (position: Position, pnl: BN) => { ... });
```

## Example Agent Session (LLM interaction)

```
Claude: "I want to run a momentum strategy on token <MINT> — buy when up 10% in 5 min, sell when down 5%"

→ MCP tool: agent_add_strategy({
    type: "momentum",
    mint: "<MINT>",
    entryThresholdPct: 10,
    exitThresholdPct: 5
  })

Claude: "What's my current PnL?"
→ MCP tool: agent_pnl() → "+0.45 SOL realized, -0.12 SOL unrealized"

Claude: "Stop the momentum strategy and sell all positions"
→ agent_remove_strategy("momentum-<MINT>")
→ agent_sell_all("<MINT>")
```

## File Layout

```
src/defi/
  agent.ts         — PumpDeFiAgent class
  strategy.ts      — Strategy types + implementations
  risk.ts          — RiskManager
  portfolio.ts     — Portfolio tracking
  events.ts        — EventEmitter types
  index.ts         — exports

mcp-server/tools/
  agent-trading.ts — MCP tool handlers for all agent_ tools
```

## Environment Variables

```env
AGENT_PRIVATE_KEY=...
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
AGENT_RISK_MAX_POSITION_SOL=1
AGENT_RISK_MAX_TOTAL_SOL=5
AGENT_RISK_STOP_LOSS_PCT=20
AGENT_RISK_TAKE_PROFIT_PCT=100
AGENT_TICK_INTERVAL_MS=60000
WEBHOOK_URL=https://your-webhook.com/agent-events  # optional
```

## Acceptance Criteria

- [ ] `PumpDeFiAgent` executes momentum strategy on devnet without errors
- [ ] Risk limits block a trade that would exceed `maxPositionLamports`
- [ ] Portfolio snapshot returns valid JSON with correct token balances
- [ ] All 8 MCP tools callable from Claude Desktop
- [ ] Strategy events fire correctly (trade, risk-blocked, position-closed)
- [ ] `npm run typecheck` and `npm test` pass
- [ ] Integration test: `tests/integration/test-defi-agent-momentum.ts`

## Security

- Private key ONLY from env var, never from CLI args
- All trade amounts validated by `validateSellAmount` before broadcast  
- RiskManager consulted before EVERY on-chain action — no bypasses
- Emergency stop: `AGENT_EMERGENCY_STOP=true` env var halts all execution
- Audit log: every trade written to `agent-audit.jsonl` with timestamp + tx sig
