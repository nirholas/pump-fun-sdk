# Frequently Asked Questions

> Quick answers to common questions about pump-fun-sdk.

---

## General

### What is pump-fun-sdk?

A community TypeScript SDK for the [Pump](https://pump.fun) protocol on Solana. It lets you create tokens, trade on bonding curves, collect creator fees, distribute fees to shareholders, and earn volume-based rewards — all programmatically.

### Is this an official Pumpfun SDK?

No. This is a community-built SDK, not affiliated with or endorsed by Pump.fun. It is published as `@pump-fun/pump-sdk` on npm. It was reverse-engineered from the on-chain Pumpfun programs and provides the same functionality as the protocol interface. The IDLs (Interface Definition Languages) were extracted directly from the deployed Solana programs.

### Is it free to use?

Yes. pump-fun-sdk is open-source under the [MIT License](LICENSE). Use it for personal projects, commercial products, bots, agents — anything.

### What languages are supported?

- **TypeScript/JavaScript** — Core SDK, vanity generator, MCP server
- **Rust** — High-performance vanity address generator
- **Shell** — Batch scripts, verification tools, test runners

---

## Installation

### How do I install it?

```bash
npm install @pump-fun/pump-sdk
```

You'll also need peer dependencies:

```bash
npm install @solana/web3.js @coral-xyz/anchor @solana/spl-token bn.js
```

### Does it work with yarn/pnpm/bun?

Yes. Any Node.js package manager works:

```bash
yarn add @pump-fun/pump-sdk
pnpm add @pump-fun/pump-sdk
bun add @pump-fun/pump-sdk
```

### What Node.js version do I need?

Node.js 18 or later. We recommend the latest LTS.

### Does it work in the browser?

The core SDK can work in browser environments, but some features (like file-based keypair storage) are Node.js only. The bonding curve math and instruction building are fully browser-compatible.

---

## SDK Usage

### What's the difference between PumpSdk and OnlinePumpSdk?

| | PumpSdk | OnlinePumpSdk |
|--|---------|---------------|
| Needs connection? | No | Yes |
| Builds instructions? | Yes | Yes |
| Fetches on-chain state? | No | Yes |
| Singleton available? | `PUMP_SDK` | Create with `new OnlinePumpSdk(connection)` |

Use `PumpSdk` (via `PUMP_SDK`) when you already have the on-chain data. Use `OnlinePumpSdk` when you need to fetch state from the network.

### How do I calculate buy/sell amounts?

```typescript
import { getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount } from "@pump-fun/pump-sdk";

// How many tokens for 0.1 SOL?
const tokensOut = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply, bondingCurve, amount: solAmount });

// How much SOL for selling 1000 tokens?
const solOut = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply, bondingCurve, amount: tokenAmount });
```

### What does slippage mean?

Slippage is the maximum percentage price movement you're willing to accept. A slippage of `1` means 1%. If the price moves more than 1% between when you build the transaction and when it executes, the transaction will fail to protect you.

### What happens when a token graduates?

When the bonding curve fills up (`bondingCurve.complete === true`), the token migrates to a PumpSwap AMM pool. Post-graduation:

- Trading uses the AMM pool instead of the bonding curve
- Creator fees are still collected but from the AMM
- You may need to use `transferCreatorFeesToPump` before claiming

The SDK handles this automatically in methods with `BothPrograms` in the name.

### Can I create tokens on devnet?

Yes. Pass a devnet connection:

```typescript
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const sdk = new OnlinePumpSdk(connection);
```

---

## Fee Sharing

### How does fee sharing work?

Token creators can split their creator fees among up to 10 shareholders. Each shareholder gets a percentage defined in basis points (BPS). 10,000 BPS = 100%.

### Can I change shareholders after setting them?

Yes, if the admin hasn't revoked their authority. Use `updateFeeShares` to modify the shareholder list.

### What happens if I don't set up fee sharing?

All creator fees go to the creator's vault as normal. Fee sharing is opt-in.

---

## Vanity Addresses

### What is a vanity address?

A Solana address that starts or ends with specific characters you choose. For example, an address starting with `PUMP` or ending with `SDK`.

### How long does it take to generate?

It depends on pattern length:

| Pattern Length | Approximate Time |
|---------------|-----------------|
| 1 character | Instant |
| 2 characters | < 1 second |
| 3 characters | ~2 seconds |
| 4 characters | ~2 minutes |
| 5 characters | ~2 hours |

The Rust generator is significantly faster than TypeScript.

### Is it safe?

Yes. We use only official Solana keypair generation (`solana-sdk` in Rust, `@solana/web3.js` in TypeScript). Private keys are automatically zeroized from memory. No third-party cryptographic code.

---

## MCP Server

### What is MCP?

Model Context Protocol — Anthropic's open standard for connecting AI assistants (like Claude) to external tools. Our MCP server gives Claude the ability to generate wallets, sign messages, and manage Solana addresses.

### How do I set it up with Claude Desktop?

Add this to your Claude Desktop config:

```json
{
  "mcpServers": {
    "solana-wallet": {
      "command": "node",
      "args": ["/path/to/pump-fun-sdk/mcp-server/dist/index.js"]
    }
  }
}
```

### Are my private keys safe with the MCP server?

Yes. Private keys are:

- Never logged or written to disk
- Zeroized from memory on shutdown
- Never exposed through MCP resources (only public keys are accessible)
- Generated using official Solana libraries only

---

## Security

### Should I use this in production?

The SDK is published on npm and used in production applications. However, you should:

- Always review code that handles private keys
- Use the security checklist in [SECURITY_CHECKLIST.md](security/SECURITY_CHECKLIST.md)
- Test thoroughly on devnet before mainnet
- Never commit keypair files to version control

### How do I report a vulnerability?

See [SECURITY.md](SECURITY.md). Do NOT open a public issue. Use GitHub's private security advisory feature or email the maintainer directly.

---

## Contributing

### How do I contribute?

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version:

1. Fork → Branch → Code → Test → PR
2. Follow existing code style
3. Update docs if you add features

### Can AI agents contribute?

Yes! We actively use AI agents (via SperaxOS and GitHub Copilot) to improve the codebase. If you have an agent that can write and test code, point it at the repo.

---

*Don't see your question? [Open a discussion](https://github.com/nirholas/pump-fun-sdk/discussions).*
