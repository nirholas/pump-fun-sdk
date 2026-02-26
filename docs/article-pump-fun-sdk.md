# pump-fun-sdk: The Reverse-Engineered Pumpfun Bonding Curve SDK Powering the Next Generation of Solana AI Agents

*By the pump-fun-sdk team — February 2026*

---

## Introduction: Why We Built pump-fun-sdk

Pumpfun changed the game for Solana. It transformed how tokens are launched, traded, and experienced on-chain. But until now, there was no open-source SDK that allowed developers—or AI agents—to programmatically interact with the Pumpfun protocol at the smart contract level. No way to create coins, buy, sell, claim creator fees, or manage bonding curves from your own code. No way for an AI assistant sitting inside Claude, Copilot, or any MCP-compatible system to autonomously interact with the Pumpfun ecosystem.

That's why we built **pump-fun-sdk** — the first and, as far as we know, the only fully reverse-engineered, open-source SDK for the Pumpfun protocol on GitHub.

The repository lives at [github.com/nirholas/pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk), and it is not just a library. It is an entire ecosystem: a TypeScript SDK for bonding curve math and on-chain interaction, a Rust-powered vanity address generator, an MCP (Model Context Protocol) server for Claude and other AI agents, shell scripts for batch operations, comprehensive tests across every layer, and thorough security audits. This is the infrastructure that makes it possible for AI agents to have wallets, generate vanity addresses, create tokens, trade on bonding curves, claim fees, distribute revenue to shareholders, and manage the entire lifecycle of a Pumpfun token — all programmatically, all open-source, all built on official Solana Labs libraries.

---

## The Reverse Engineering Story

Pumpfun is a closed-source protocol. The smart contracts are deployed on Solana, the IDL (Interface Definition Language) is publicly available on-chain, but there is no official SDK that exposes the full functionality to external developers. The bonding curve math, the fee calculations, the PDA (Program Derived Address) derivations, the state account structures, the instruction builders — all of it had to be reverse-engineered from the on-chain programs themselves.

### How We Did It

The process began with the Pumpfun program IDL. On Solana, Anchor-based programs publish their IDL, which describes the instruction set, account structures, and event definitions. We started there, pulling the IDL for three separate programs:

1. **Pump** (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) — The core Pumpfun program handling token creation, bonding curve trading, and migrations.
2. **PumpAMM** (`pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`) — The PumpSwap AMM program for graduated tokens that have migrated off the bonding curve.
3. **PumpFees** (`pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`) — The fee management program handling fee tiers, creator fees, and fee sharing configurations.

From these IDLs, we reconstructed every account structure: `Global`, `BondingCurve`, `FeeConfig`, `FeeTier`, `SharingConfig`, `Shareholder`, `GlobalVolumeAccumulator`, `UserVolumeAccumulator`, and more. We decoded the state layout byte-by-byte, mapping every field to its TypeScript type with proper BN (big number) handling for Solana's u64 and u128 values.

### The Bonding Curve Math

The heart of Pumpfun is its bonding curve — the automated market maker that determines token prices based on supply and demand. We reverse-engineered the exact mathematical formulas:

**Buy quote (tokens received for SOL spent):**

$$
\text{tokensOut} = \frac{\text{solAmount} \times \text{virtualTokenReserves}}{\text{virtualSolReserves} + \text{solAmount}}
$$

**Sell quote (SOL received for tokens sold):**

$$
\text{solOut} = \frac{\text{tokenAmount} \times \text{virtualSolReserves}}{\text{virtualTokenReserves} + \text{tokenAmount}}
$$

**Inverse buy (SOL needed for a specific token amount):**

$$
\text{solNeeded} = \frac{\text{tokenAmount} \times \text{virtualSolReserves}}{\text{virtualTokenReserves} - \text{tokenAmount}} + 1
$$

These formulas use virtual reserves — the bonding curve starts with `initialVirtualTokenReserves` and `initialVirtualSolReserves` defined in the Global account, creating a predetermined price curve that every token follows from launch.

### Fee Architecture

The fee system was one of the more complex pieces to reverse-engineer. Pumpfun uses a tiered fee structure based on market capitalization:

- **Protocol fees** go to the Pumpfun treasury
- **Creator fees** go to the token creator's vault
- **LP fees** apply post-graduation on the AMM

Fee tiers are stored in a `FeeConfig` account with market cap thresholds in lamports. As a token's market cap grows (calculated from the bonding curve's virtual reserves and mint supply), different fee rates apply. We implemented the exact `calculateFeeTier` function that matches the on-chain Rust implementation, iterating through tiers and selecting the appropriate one based on the current market cap.

### PDA Derivations

Every account on Solana needs a deterministic address. We reverse-engineered every PDA seed:

- `bondingCurvePda`: `["bonding-curve", mint.toBuffer()]`
- `creatorVaultPda`: `["creator-vault", creator.toBuffer()]`
- `feeSharingConfigPda`: `["fee-sharing-config", mint.toBuffer()]`
- `userVolumeAccumulatorPda`: `["user", user.toBuffer()]`
- `canonicalPumpPoolPda` for AMM pools
- `globalParamsPda`, `mayhemStatePda`, `solVaultPda`, `tokenVaultPda` for internal state

Each of these had to be discovered by analyzing on-chain transactions and matching the derived addresses against known account states.

---

## Architecture: A Multi-Language, Multi-Layer Toolkit

pump-fun-sdk is not a single library. It is a layered architecture spanning three languages and multiple paradigms:

### Layer 1: Core TypeScript SDK (`src/`)

The core SDK at version 1.28.0 is published as `@pump-fun/pump-sdk`. It provides:

- **`PumpSdk`** — The offline SDK class that builds transaction instructions without requiring a network connection. It can construct `create`, `buy`, `sell`, `createAndBuy`, `collectCoinCreatorFee`, `distributeCreatorFees`, and `claimTokenIncentives` instructions.
- **`OnlinePumpSdk`** — The online SDK that wraps `PumpSdk` with network fetching capabilities. It can fetch global state, bonding curves, fee configs, volume accumulators, and build complete transaction instruction sets with all necessary account lookups.
- **Bonding curve math** — Pure functions for calculating buy/sell amounts, market caps, and fee decomposition.
- **Fee calculation** — Full implementation of the tiered fee system including protocol fees, creator fees, and the fee sharing distribution model.
- **Token incentives** — Volume-based token incentive calculations with daily accumulation and claim logic.
- **State types** — Complete TypeScript interfaces for every on-chain account: `Global`, `BondingCurve`, `FeeConfig`, `SharingConfig`, `Shareholder`, `GlobalVolumeAccumulator`, `UserVolumeAccumulator`, and event types.
- **PDA utilities** — Every program-derived address function needed to interact with the protocol.

The SDK depends on:
- `@coral-xyz/anchor` for program interaction
- `@pump-fun/pump-swap-sdk` for AMM/PumpSwap integration
- `@solana/spl-token` for SPL token operations
- `@solana/web3.js` for Solana primitives
- `bn.js` for big number arithmetic

### Layer 2: Rust Vanity Address Generator (`rust/`)

A high-performance Solana vanity address generator written in Rust. This is not a toy — it is a multi-threaded, memory-safe tool that uses Rayon for parallel generation across all CPU cores. Features include:

- **Prefix and suffix matching** for Base58 addresses
- **Case-insensitive mode** for broader matching
- **Configurable thread count** for resource management
- **Automatic memory zeroization** via the `zeroize` crate for private key security
- **Solana CLI compatible output** — generated keypairs work directly with `solana config set --keypair`
- **Batch generation** for creating multiple vanity addresses
- **Dry-run estimation** to predict generation times before committing resources
- **Comprehensive benchmarks** for performance validation

Every keypair is generated using `solana_sdk::signer::keypair::Keypair::new()` — the exact same cryptographic primitives used by the official Solana CLI. No third-party crypto. No shortcuts.

### Layer 3: TypeScript Vanity Generator (`typescript/`)

A TypeScript implementation of the same vanity address generator, using `@solana/web3.js`'s `Keypair.generate()`. This provides:

- **Programmatic API** for integration into Node.js applications
- **CLI interface** with the same options as the Rust version
- **Progress callbacks** for real-time feedback during generation
- **File verification** to ensure written keypairs are valid
- **Secure file permissions** (0600) on output files

### Layer 4: MCP Server (`mcp-server/`)

This is where pump-fun-sdk meets AI agents. The Model Context Protocol (MCP) server exposes Solana wallet operations as tools that any MCP-compatible AI assistant — Claude, Copilot, Gemini, or any other — can invoke directly.

**Available Tools:**
- `generate_keypair` — Create a new Solana keypair
- `generate_vanity` — Generate a vanity address with custom prefix/suffix
- `sign_message` — Sign arbitrary messages with a keypair
- `verify_signature` — Verify message signatures
- `validate_address` — Check if a Solana address is valid
- `estimate_vanity_time` — Predict how long a vanity generation will take
- `restore_keypair` — Recover a keypair from a seed phrase or private key

**Available Resources:**
- `solana://config` — Server configuration
- `solana://keypair/{id}` — Access generated keypairs (public key only — private keys are never exposed through resources)
- `solana://address/{pubkey}` — Address information and validation

**Available Prompts:**
- `create_wallet` — Guided wallet creation workflow
- `security_audit` — Security best practices checklist
- `batch_generate` — Generate multiple keypairs with guidance

The MCP server is built with the official `@modelcontextprotocol/sdk` and communicates over stdio transport, making it compatible with Claude Desktop, VS Code extensions, and any MCP client.

Security is paramount: private keys are never logged to disk, keys are zeroized from memory on shutdown (`secretKey.fill(0)`), all inputs are strictly validated, and only official Solana libraries are used for cryptographic operations.

---

## OpenClaw and the Claude Ecosystem

### What is OpenClaw?

OpenClaw is the open-source standard for building AI agent plugins and skills. It defines a format — compatible with Claude's tool-use architecture — for packaging capabilities that AI agents can discover, load, and execute. Think of it as the app store architecture for AI agents: instead of apps, you have skills; instead of APIs, you have tool definitions; instead of manual integration, agents can autonomously discover and use new capabilities.

pump-fun-sdk is designed to work within this ecosystem. The MCP server is essentially an OpenClaw-compatible skill that gives any Claude-powered agent (or any MCP-compatible agent) the ability to:

1. **Generate wallets** — Create new Solana keypairs with optional vanity addresses
2. **Manage keys securely** — Sign messages, verify signatures, validate addresses
3. **Interact with Pumpfun** — Create tokens, buy, sell, claim fees, distribute revenue (via the core SDK)
4. **Operate autonomously** — An agent running in SperaxOS, for example, can be given access to the pump-fun-sdk MCP server and autonomously manage a portfolio of Pumpfun tokens

### Claude and MCP: The Bridge Between AI and Blockchain

The Model Context Protocol is Anthropic's open standard for connecting AI assistants to external tools and data sources. It solves a fundamental problem: how do you give an AI agent access to the real world without compromising security or requiring bespoke integrations?

pump-fun-sdk's MCP server is a concrete answer to that question for the Solana/Pumpfun ecosystem. When you configure Claude Desktop (or any MCP client) to use our server:

```json
{
  "mcpServers": {
    "solana-wallet": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

Claude gains the ability to generate Solana wallets, create vanity addresses, sign transactions, and — when combined with the core SDK — interact with every aspect of the Pumpfun protocol through natural language.

Imagine telling Claude: *"Generate a vanity address starting with 'PUMP' and create a new token on Pumpfun with it."* With pump-fun-sdk's MCP server and the core SDK, that becomes a real, executable workflow.

### SperaxOS Integration

SperaxOS is an AI-powered DeFi operating system that uses agent teams with coordinators. pump-fun-sdk is being integrated into SperaxOS, which means:

- Agent teams can manage Pumpfun tokens collaboratively
- Fee claiming becomes a natural language command: *"Claim my creator fees"*
- Fee distribution to shareholders happens automatically
- Portfolio management across bonding curve and graduated (AMM) tokens is unified
- Voice commands via TTS can trigger on-chain operations

The integration follows the OpenClaw/Claude format, making it plug-and-play for any SperaxOS agent team.

---

## Deep Dive: The SDK in Action

### Creating a Token

```typescript
import { PumpSdk } from "@pump-fun/pump-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const sdk = new PumpSdk(connection);

const mint = PublicKey.unique();
const creator = myWallet.publicKey;

// Create the token
const instruction = await sdk.createInstruction({
  mint,
  name: "My AI Agent Token",
  symbol: "AGENT",
  uri: "https://arweave.net/metadata.json",
  creator,
  user: creator,
});

// Or create and immediately buy
const global = await sdk.fetchGlobal();
const solAmount = new BN(0.5 * 10 ** 9); // 0.5 SOL

const instructions = await sdk.createAndBuyInstructions({
  global,
  mint,
  name: "My AI Agent Token",
  symbol: "AGENT",
  uri: "https://arweave.net/metadata.json",
  creator,
  user: creator,
  solAmount,
  amount: getBuyTokenAmountFromSolAmount(global, null, solAmount),
});
```

### Buying on the Bonding Curve

```typescript
const mint = new PublicKey("...");
const user = myWallet.publicKey;

const global = await sdk.fetchGlobal();
const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
  await sdk.fetchBuyState(mint, user);

const solAmount = new BN(0.1 * 10 ** 9); // 0.1 SOL

const instructions = await sdk.buyInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  associatedUserAccountInfo,
  mint,
  user,
  solAmount,
  amount: getBuyTokenAmountFromSolAmount(global, bondingCurve, solAmount),
  slippage: 1, // 1% slippage tolerance
});
```

### Selling Tokens

```typescript
const { bondingCurveAccountInfo, bondingCurve } = await sdk.fetchSellState(mint, user);
const amount = new BN(15_828);

const instructions = await sdk.sellInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  mint,
  user,
  amount,
  solAmount: getSellSolAmountFromTokenAmount(global, bondingCurve, amount),
  slippage: 1,
});
```

### Claiming Creator Fees

```typescript
// Check accumulated fees across both Pump and PumpSwap programs
const totalFees = await sdk.getCreatorVaultBalanceBothPrograms(creator);
console.log(`Total claimable: ${totalFees.toString()} lamports`);

// Build claim instructions
const claimInstructions = await sdk.collectCoinCreatorFeeInstructions(creator);
```

### Fee Sharing and Distribution

One of the most powerful features in pump-fun-sdk is fee sharing. Token creators can set up automatic fee distribution to multiple shareholders:

```typescript
import { OnlinePumpSdk, isCreatorUsingSharingConfig } from "@pump-fun/pump-sdk";

const onlineSdk = new OnlinePumpSdk(connection);
const mint = new PublicKey("...");

// Check if fee sharing is configured
const usingSharingConfig = isCreatorUsingSharingConfig({ mint, creator });

if (usingSharingConfig) {
  // Check distributable fees
  const result = await onlineSdk.getMinimumDistributableFee(mint);
  console.log(`Distributable: ${result.distributableFees.toString()}`);
  console.log(`Can distribute: ${result.canDistribute}`);
  console.log(`Graduated: ${result.isGraduated}`);

  // Distribute to shareholders
  if (result.canDistribute) {
    const { instructions, isGraduated } =
      await onlineSdk.buildDistributeCreatorFeesInstructions(mint);
    // For graduated tokens, this includes transferCreatorFeesToPump + distributeCreatorFees
    // For non-graduated tokens, this includes distributeCreatorFees only
  }
}
```

### Token Incentives

The SDK includes full support for the volume-based token incentive program:

```typescript
const globalAccumulator = await sdk.fetchGlobalVolumeAccumulator();
const userAccumulator = await sdk.fetchUserVolumeAccumulator(user);

const unclaimed = totalUnclaimedTokens(globalAccumulator, userAccumulator);
const todayTokens = currentDayTokens(globalAccumulator, userAccumulator);

console.log(`Unclaimed tokens: ${unclaimed.toString()}`);
console.log(`Today's tokens: ${todayTokens.toString()}`);

// Claim
const claimInstructions = await sdk.claimTokenIncentivesInstructions(user);
```

---

## Vanity Address Generation: Give Your Agent an Identity

One of the most distinctive features of pump-fun-sdk is the integrated vanity address generator. Instead of your AI agent operating with a random, forgettable Solana address, you can generate an address that starts or ends with meaningful characters.

### Why Vanity Addresses Matter for Agents

In a world where AI agents are increasingly autonomous — managing wallets, executing trades, claiming fees — identity matters. A vanity address like `PUMP...` or `AGENT...` immediately communicates what the wallet is for. It's branding at the protocol level.

### Rust Performance

The Rust generator uses Rayon for multi-threaded search:

```bash
# Generate an address starting with "PUMP"
solana-vanity --prefix PUMP

# Estimate time first
solana-vanity --prefix PUMP --dry-run

# Generate with all CPUs
solana-vanity --prefix AG --suffix nt --threads 0

# Batch generate
solana-vanity --prefix A --count 10
```

**Performance characteristics:**
- 1-character prefix: instant (1 in 58 chance)
- 2-character prefix: < 1 second (1 in 3,364)
- 3-character prefix: ~2 seconds (1 in 195,112)
- 4-character prefix: ~2 minutes (1 in 11,316,496)
- 5-character prefix: ~2 hours (1 in 656,356,768)

All using Ed25519 from the official `solana-sdk` crate. The private key bytes are automatically zeroized when the keypair goes out of scope, ensuring no sensitive material lingers in memory.

### TypeScript Integration

For Node.js applications:

```typescript
import { VanityGenerator, saveKeypair } from 'solana-vanity-ts';

const generator = new VanityGenerator({
  prefix: 'PUMP',
  onProgress: (attempts, rate) => {
    console.log(`${attempts} attempts, ${rate}/sec`);
  },
});

const result = await generator.generate();
console.log(`Found: ${result.publicKey}`);
saveKeypair(result.keypair, 'my-vanity-wallet.json');
```

---

## Security Model

Security is not an afterthought in pump-fun-sdk — it is foundational. The project includes dedicated security audits for every layer:

### Cryptographic Purity

The most important security property: **we use only official Solana Labs libraries for all cryptographic operations.** No third-party key generation. No custom Ed25519 implementations. No shortcuts.

- **Rust**: `solana-sdk` from [github.com/solana-labs/solana](https://github.com/solana-labs/solana)
- **TypeScript**: `@solana/web3.js` from [github.com/solana-labs/solana-web3.js](https://github.com/solana-labs/solana-web3.js)
- **Shell**: `solana-keygen` CLI

### Memory Safety

- Rust: `zeroize` crate for automatic memory cleanup of private keys
- TypeScript MCP server: `secretKey.fill(0)` on shutdown, keypair map cleared
- File permissions: 0600 on generated keypair files

### Input Validation

- All public key inputs validated as proper Base58
- Prefix/suffix patterns validated against Base58 charset (no O, no l, no 0)
- Slippage parameters bounded
- BN overflow checks on arithmetic

### Audit Documentation

The `security/` directory contains complete audit checklists and findings for:
- CLI operations
- Rust implementation
- TypeScript SDK

### Testing Matrix

The `tests/` directory contains:
- **Unit tests** for bonding curve math, fee calculations, PDA derivations
- **Integration tests** for keypair validity, output compatibility, security properties
- **Fuzz tests** (Python) for file operations and input validation
- **Stress tests** for long-running generation and rapid generation cycles
- **Benchmark comparisons** between Rust and TypeScript implementations
- **Scaling tests** to validate multi-threaded performance

---

## The Bigger Picture: AI Agents and DeFi

pump-fun-sdk exists at the intersection of two of the most transformative technologies of the decade: AI agents and decentralized finance.

### The Agent Economy

We are entering an era where AI agents manage real capital. They execute trades. They claim fees. They distribute revenue. They create tokens. They monitor markets. They respond to natural language commands from their operators.

pump-fun-sdk provides the infrastructure for this on the Pumpfun/Solana ecosystem. Through the MCP server, any Claude-compatible agent can:

1. **Create a wallet** with a memorable vanity address
2. **Launch a token** on Pumpfun with a single instruction
3. **Manage the bonding curve** — buying and selling with precise slippage control
4. **Claim creator fees** as they accumulate from trading
5. **Distribute revenue** to shareholders automatically
6. **Track incentives** through the volume accumulator system
7. **Report on positions** with real-time bonding curve state

### The Claim Bot Vision

One of the most immediate applications is the fee claim bot. Currently, claiming creator fees from Pumpfun requires navigating the protocol manually, signing transactions, and handling the differences between bonding curve tokens and graduated AMM tokens. With pump-fun-sdk:

```
User: "Claim my fees"
Agent: [calls sdk.collectCoinCreatorFeeInstructions(user)]
Agent: "Claimed 2.5 SOL in creator fees from 12 tokens. Transaction: 5xK..."
```

That's it. Natural language in, on-chain action out. The SDK handles the complexity of checking both the Pump and PumpSwap programs, consolidating graduated token fees, and building the correct instruction set.

### Fee Forwarding to Agents

This is where it gets really interesting. With fee sharing configs, a token creator can designate an AI agent's wallet as a shareholder. The agent automatically receives a percentage of creator fees. The agent can then use those fees to:

- Buy more of the token (compounding)
- Fund operations (hosting, compute, API calls)
- Distribute to community members
- Re-invest in new token launches

This creates a self-sustaining loop: the agent generates value, earns fees, and uses those fees to generate more value. All on-chain. All transparent. All autonomous.

---

## Technical Specifications

### Supported Programs

| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Core token creation and bonding curve trading |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Post-graduation AMM trading (PumpSwap) |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee tier management |
| Mayhem | `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e` | Mayhem mode for bonding curves |

### Account Types

| Account | Description |
|---------|-------------|
| `Global` | Protocol-wide parameters: initial reserves, fee basis points, authorities |
| `BondingCurve` | Per-token state: virtual/real reserves, completion status, creator, mayhem mode |
| `FeeConfig` | Fee tier definitions with market cap thresholds |
| `SharingConfig` | Per-token fee distribution configuration with shareholders |
| `GlobalVolumeAccumulator` | Protocol-wide volume tracking for token incentives |
| `UserVolumeAccumulator` | Per-user volume and unclaimed token tracking |

### Exported API

```typescript
// Core SDK
export { PumpSdk, OnlinePumpSdk }

// Bonding Curve Math
export { getBuyTokenAmountFromSolAmount, getBuySolAmountFromTokenAmount,
         getSellSolAmountFromTokenAmount, newBondingCurve, bondingCurveMarketCap }

// Programs
export { getPumpProgram, getPumpAmmProgram, getPumpFeeProgram }
export { PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID, MAYHEM_PROGRAM_ID }

// PDAs
export { bondingCurvePda, creatorVaultPda, feeSharingConfigPda,
         userVolumeAccumulatorPda, canonicalPumpPoolPda, GLOBAL_PDA,
         GLOBAL_VOLUME_ACCUMULATOR_PDA, PUMP_FEE_CONFIG_PDA }

// State Types
export { Global, BondingCurve, FeeConfig, SharingConfig, Shareholder,
         GlobalVolumeAccumulator, UserVolumeAccumulator,
         DistributeCreatorFeesEvent, MinimumDistributableFeeEvent }

// Token Incentives
export { totalUnclaimedTokens, currentDayTokens }

// Fee Sharing
export { isCreatorUsingSharingConfig }
```

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@coral-xyz/anchor` | ^0.31.1 | Solana program framework |
| `@pump-fun/pump-swap-sdk` | ^1.13.0 | PumpSwap AMM integration |
| `@solana/spl-token` | ^0.4.13 | SPL token operations |
| `@solana/web3.js` | ^1.98.2 | Solana web3 primitives |
| `bn.js` | ^5.2.2 | Big number arithmetic |

---

## Running the Project

### Prerequisites

- Node.js 18+
- Rust 1.70+ (for vanity generator)
- Solana CLI (optional, for keypair verification)

### Quick Start

```bash
# Clone
git clone https://github.com/nirholas/pump-fun-sdk.git
cd pump-fun-sdk

# Install TypeScript dependencies
npm install

# Build the SDK
npm run build

# Build the Rust vanity generator
cd rust && cargo build --release

# Build the MCP server
cd mcp-server && npm install && npm run build

# Run tests
npm test
cd rust && cargo test
```

### Using with Claude Desktop

```json
{
  "mcpServers": {
    "solana-wallet": {
      "command": "node",
      "args": ["/absolute/path/to/pump-fun-sdk/mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop, and Claude will have access to all Solana wallet tools.

---

## What's Next

pump-fun-sdk is actively maintained by AI agents running the codebase through SperaxOS. Yes, you read that right — agents are contributing to the SDK that powers agents. The roadmap includes:

- **Full PumpSwap AMM SDK integration** — complete trading on graduated pools
- **Telegram claim bot** — claim creator fees from Telegram with a single command
- **Enhanced MCP tools** — token creation, trading, and fee management directly from Claude
- **OpenClaw skill packages** — packaged skills for agent teams
- **On-chain analytics** — bonding curve monitoring, whale tracking, launch detection
- **Multi-agent coordination** — agents collaborating on portfolio management
- **Voice-to-chain** — speak to your agents, they execute on Solana

---

## Contributing

pump-fun-sdk is open-source under the MIT license. We are actively looking for collaborators:

- **Developers** — contribute features, fix bugs, improve performance
- **Security researchers** — audit the code, find vulnerabilities
- **AI/ML engineers** — build new MCP tools and agent capabilities
- **Content creators** — tutorials, videos, documentation
- **Community builders** — help grow the ecosystem

Give your agent the repo link to pump-fun-sdk and ask it to build a plugin using the standard OpenClaw / Claude format. It's that simple.

**Repository**: [github.com/nirholas/pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk)

**SperaxOS**: [chat.sperax.io/beta](https://chat.sperax.io/beta)

---

## Conclusion

pump-fun-sdk represents a new paradigm: open-source, reverse-engineered protocol SDKs designed not just for human developers, but for AI agents. It bridges the gap between natural language and on-chain execution. It turns "claim my fees" into a transaction. It turns "launch a token" into an instruction set. It turns "generate a vanity address for my agent" into a multi-threaded parallel search across all CPU cores.

This is infrastructure for the agent economy. Built on Solana. Powered by Pumpfun. Accessible through Claude. Open to everyone.

The trenches needed this. Now they have it.

---

*pump-fun-sdk is maintained by [@nichxbt](https://x.com/nichxbt) and the open-source community. Star the repo, fork it, build with it. Let's go.*
