# Glossary

Key terms and concepts used throughout the Pump SDK documentation.

---

## Protocol Terms

| Term | Definition |
|------|-----------|
| **Bonding Curve** | An automated market maker (AMM) that prices tokens using a mathematical formula. On PumpFun, it uses the constant-product formula ($x \cdot y = k$). As tokens are bought, the price increases; as they're sold, the price decreases. |
| **Constant Product** | The AMM formula where the product of two reserves stays constant: $\text{virtualTokenReserves} \times \text{virtualSolReserves} = k$. Every trade moves along this curve. |
| **Graduation** | When a bonding curve reaches 100% completion, the token "graduates" — liquidity migrates from the bonding curve to the PumpAMM for open market trading. |
| **Virtual Reserves** | The starting token and SOL amounts that define the bonding curve's shape. Not "real" liquidity — they're constants used in the pricing formula. |
| **Real Reserves** | Actual SOL and tokens deposited in the bonding curve from trades. |
| **PumpAMM** | The graduated AMM pool. Tokens that complete their bonding curve migrate here for traditional LP-style trading. |
| **Migration** | The on-chain process of moving a completed bonding curve's liquidity to PumpAMM. |

## Fee Terms

| Term | Definition |
|------|-----------|
| **Fee Tier** | The fee percentage applied to trades, determined by the token's position on the bonding curve. Earlier in the curve = higher fees. |
| **Creator Fee** | A portion of trading fees that accumulates in the token creator's vault. |
| **Creator Vault** | An on-chain account (PDA) that holds accumulated creator fees until claimed. |
| **Fee Sharing** | A system where the token creator can split their accumulated fees among up to 10 shareholders using basis point (BPS) allocations. |
| **BPS (Basis Points)** | One hundredth of a percentage point (1 BPS = 0.01%). Fee shares are specified in BPS, where 10,000 BPS = 100%. |
| **Cashback** | SOL returned to traders on v2-created tokens as a trading incentive. |
| **CTO (Creator Takeover)** | When the fee recipient for a token changes — the creator redirects fees to a different wallet. |
| **Distributable Fee** | The minimum SOL amount that must accumulate in a creator vault before distribution to shareholders is allowed. |

## Token Incentive Terms

| Term | Definition |
|------|-----------|
| **Token Incentives** | Volume-based rewards paid in PUMP governance tokens. Traders earn PUMP proportional to their SOL trading volume. |
| **Volume Accumulator** | An on-chain account tracking a user's cumulative trading volume for reward calculation. |
| **PUMP Token** | The governance token of the PumpFun protocol, distributed as volume-based incentives. |
| **Unclaimed Tokens** | PUMP tokens a user has earned but not yet claimed. |
| **Current Day Tokens** | A preview of PUMP tokens being accumulated for the current day (not yet finalized). |

## SDK Terms

| Term | Definition |
|------|-----------|
| **PumpSdk** | The offline SDK class that builds `TransactionInstruction[]` without a network connection. Singleton available as `PUMP_SDK`. |
| **OnlinePumpSdk** | Extends `PumpSdk` with RPC fetchers. Reads on-chain state, then builds instructions. Requires a `Connection`. |
| **TransactionInstruction** | A Solana instruction object containing program ID, account keys, and data. Multiple instructions are bundled into a `Transaction` for submission. |
| **PDA (Program Derived Address)** | A deterministic address derived from seeds and a program ID. Used to create accounts owned by programs without requiring a private key. |
| **IDL (Interface Definition Language)** | JSON files describing a Solana program's instructions, accounts, and types. Used by Anchor to generate typed clients. |
| **BN (BigNumber)** | The `bn.js` library used for arbitrary-precision integer math. All financial amounts in the SDK use `BN` — never JavaScript `number`. |
| **Anchor** | A Solana development framework. The Pump SDK uses `@coral-xyz/anchor` for instruction encoding/decoding via IDLs. |
| **BothPrograms** | Methods on `OnlinePumpSdk` that aggregate data across both Pump and PumpAMM programs (e.g., `getCreatorVaultBalanceBothPrograms`). |

## Solana Terms

| Term | Definition |
|------|-----------|
| **Lamport** | The smallest unit of SOL. 1 SOL = 1,000,000,000 (10⁹) lamports. |
| **Commitment** | The level of finality when querying Solana: `processed` (fastest, may revert), `confirmed` (66%+ validators), `finalized` (irreversible). |
| **RPC** | Remote Procedure Call — the API for communicating with Solana validator nodes. |
| **Mint** | A token's unique address on Solana. Also called "mint address" or "token address". |
| **SPL Token** | Solana Program Library Token — the standard token program on Solana. |
| **Mint Authority** | The account authorized to mint new tokens. Revoking mint authority (setting to null) means no more tokens can be created. |
| **Freeze Authority** | The account authorized to freeze token accounts. A non-null freeze authority is a red flag — tokens can be locked. |
| **Compute Units** | A measure of computational resources consumed by a transaction. Solana charges fees based on compute units. |
| **Priority Fee** | An additional fee paid to validators to prioritize transaction inclusion. Higher priority fee = faster processing. |

## Infrastructure Terms

| Term | Definition |
|------|-----------|
| **MCP (Model Context Protocol)** | A protocol for connecting AI assistants to external tools and data sources. The MCP server exposes 53 Pump SDK tools to Claude, Copilot, and other assistants. |
| **Channel Bot** | A read-only Telegram bot that broadcasts PumpFun events to a channel (no interactive commands). Currently runs at `@pumpfunclaims`. |
| **Telegram Bot** | An interactive Telegram bot with commands for watching wallets, monitoring events, and querying data. |
| **WebSocket Relay** | A server that polls PumpFun's API and subscribes to Solana RPC logs, then broadcasts parsed events to browser clients. |
| **x402** | HTTP 402 payment protocol — gate any API behind automated Solana USDC micropayments. |

## Vanity Generator Terms

| Term | Definition |
|------|-----------|
| **Vanity Address** | A Solana address (public key) that contains a specific prefix or suffix (e.g., `SOLabc...`). Generated by brute-force keypair generation. |
| **Prefix** | The starting characters of a desired vanity address. Each additional character increases generation time exponentially. |
| **Suffix** | The ending characters of a desired vanity address. Suffixes ending in `pump` are popular for PumpFun tokens. |
| **Zeroization** | Overwriting key material in memory after use to prevent extraction. Critical for security — both Rust and TypeScript generators do this. |

## DeFi Agent Terms

| Term | Definition |
|------|-----------|
| **SperaxOS** | An AI plugin platform that hosts function-calling agents. Agents are JSON definitions consumed by the platform. |
| **Plugin** | An API endpoint that an agent can call. Plugins are defined by OpenAPI specs or custom JSON schemas. |
| **Function Calling** | An LLM capability where the model can invoke external functions/APIs based on user intent. |
| **i18n** | Internationalization — the DeFi agents support 18 languages, auto-translated via OpenAI. |
