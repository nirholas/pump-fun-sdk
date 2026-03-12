# PumpFun & Solana Glossary

> Key terms used throughout PumpKit documentation and code.

## Pump Protocol

| Term | Definition |
|------|-----------|
| **Bonding Curve** | A mathematical pricing function where token price increases as supply is purchased. Pump uses a constant-product curve: `k = virtualSolReserves × virtualTokenReserves`. |
| **Graduation** | When a bonding curve has received enough SOL, the token "graduates" — `bondingCurve.complete = true` — and migrates to a PumpAMM liquidity pool. |
| **Migration** | The process of moving a graduated token from the bonding curve to the AMM. Liquidity is seeded automatically. |
| **PumpAMM** | Pump's Automated Market Maker. Handles post-graduation trading via liquidity pools. Program: `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`. |
| **PumpFees** | The fee program managing dynamic fee tiers and creator fee distribution. Program: `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`. |
| **CTO** | Creator Takeover — when a token's creator fee recipient is changed (redirected to a new address). |
| **Mayhem Mode** | An alternate fee routing mode set at token creation. Uses a different fee recipient address. |
| **Fee Sharing** | Splitting creator fees among up to 10 shareholders, each receiving a percentage in basis points (BPS). |
| **Social Fees** | Fee collection via social identity (e.g., Twitter handle) instead of a Solana wallet address. |
| **Cashback** | Volume-based PUMP token rewards. Users earn rewards based on trading volume tracked by `UserVolumeAccumulator`. |
| **Fee Tier** | Dynamic fee rates based on a pool's market cap. Higher market cap → potentially different fee rates. |

## Solana

| Term | Definition |
|------|-----------|
| **SOL** | Solana's native token. 1 SOL = 1,000,000,000 lamports. |
| **Lamports** | The smallest unit of SOL (like satoshis for Bitcoin). |
| **PDA** | Program Derived Address — a deterministic address derived from seeds and a program ID. Not a keypair — cannot sign. |
| **RPC** | Remote Procedure Call — the API interface for querying Solana blockchain state. |
| **WebSocket (WSS)** | Persistent connection for real-time Solana event subscriptions (log monitoring, account changes). |
| **Transaction Instruction** | A single operation in a Solana transaction. PumpKit's SDK returns `TransactionInstruction[]`. |
| **SPL Token** | Solana Program Library Token — the standard token program. |
| **Token-2022** | The newer Solana token program with extended features. Some Pump tokens use this. |

## Telegram Bot

| Term | Definition |
|------|-----------|
| **grammy** | The TypeScript Telegram bot framework used by PumpKit. |
| **BotFather** | Telegram's official bot for creating and managing bot tokens. |
| **Polling** | Long-polling mode where the bot asks Telegram for updates. Simpler than webhooks. |
| **Webhook** | Telegram pushes updates to your server via HTTP POST. Better for production. |
| **Chat ID** | Unique identifier for a Telegram chat (user DM, group, or channel). |
| **Parse Mode** | `HTML` — PumpKit uses HTML formatting for Telegram messages (bold, links, code blocks). |
| **Channel** | A broadcast-only Telegram chat. Bot must be added as admin to post. |

## Tracker Bot

| Term | Definition |
|------|-----------|
| **Call** | A user's token pick/recommendation. Tracked by pasting a contract address (CA) in a group. |
| **ATH** | All-Time High — the peak price a called token reaches after the call. |
| **Multiplier** | ATH price ÷ entry price. A 5x means the token reached 5× the price at call time. |
| **PNL Card** | A shareable image showing a call's performance (entry, ATH, gain, rank). |
| **Win Rate** | Percentage of calls that hit ≥ 2× multiplier. |
| **Points** | Reputation score: -1 (< 1×), 0 (1–2×), +1 (2–5×), +2 (5–10×), +3 (10–50×), +4 (50–100×), +5 (100×+). |
| **Rank** | Tier based on total points: Amateur → Novice → Contender → Guru → Oracle. |
| **Hardcore Mode** | Competitive mode where users below a minimum win rate are auto-kicked from the group. |
| **Auto Mode** | Calls are automatically registered when a token CA is detected in a message (with 30s cancel window). |
| **Button Mode** | User chooses Alpha/Gamble/Skip via inline buttons when a CA is detected. |

## Financial Math

| Term | Definition |
|------|-----------|
| **BN** | `bn.js` — arbitrary-precision integer library. All PumpKit financial amounts use BN. |
| **BPS** | Basis Points — 1 BPS = 0.01%. Fee shares sum to 10,000 BPS (100%). |
| **Slippage** | Maximum acceptable price movement. The SDK computes slippage-adjusted bounds for buy/sell. |
| **Price Impact** | How much a trade moves the price, measured in basis points. |
| **Virtual Reserves** | The virtual SOL and token amounts in the bonding curve formula. Include phantom liquidity. |
| **Real Reserves** | The actual SOL and tokens deposited in the bonding curve. |
| **Market Cap** | `tokenPrice × totalSupply`. Used to determine fee tiers. |

## Infrastructure

| Term | Definition |
|------|-----------|
| **Turborepo** | Monorepo build orchestrator. Runs tasks in dependency order with caching. |
| **Railway** | Cloud hosting platform. PumpKit bots deploy here at ~$5/mo. |
| **SSE** | Server-Sent Events — one-way real-time HTTP streaming from server to client. |
| **Webhook** | Outbound HTTP POST sent when an event occurs (claim, launch, graduation). |
| **Health Check** | HTTP endpoint (`GET /health`) returning bot status. Used by monitoring services. |
| **DexScreener** | Price data API used by the tracker bot for token prices and charts. |
