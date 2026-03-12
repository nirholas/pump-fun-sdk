# PumpKit Documentation

> Complete documentation for building PumpFun Telegram bots with PumpKit.

## Framework Documentation

| Doc | Description |
|-----|-------------|
| [Architecture](architecture.md) | System design, module map, data flow diagrams |
| [Getting Started](getting-started.md) | Setup, configuration, build your first bot |
| [Core API](core-api.md) | `@pumpkit/core` module reference (10 modules) |
| [Monitor Bot](monitor-bot.md) | Feature spec, 12 commands, REST API, configuration |
| [Tracker Bot](tracker-bot.md) | Call tracking, rankings, PNL cards, multi-chain |
| [Deployment](deployment.md) | Railway, Docker, Vercel deployment guides |
| [npm Packages](npm-packages.md) | Package publishing roadmap (coming soon) |

## Pump Protocol Reference

Official documentation from pump-fun/pump-public-docs:

| Doc | Description |
|-----|-------------|
| [Protocol Index](pump-protocol/) | All official specs + Anchor IDL files |

Covers: Bonding curve program, PumpSwap AMM, Fee program, Creator fees, Cashback, create_v2, Token2022, Mayhem mode.

## Guides

Deep dives into specific protocol topics:

| Guide | Description |
|-------|-------------|
| [Events Reference](guides/events-reference.md) | 20+ on-chain event types with full field mappings |
| [Bonding Curve Math](guides/bonding-curve-math.md) | Constant-product formula, buy/sell calculations |
| [Fee Tiers](guides/fee-tiers.md) | Market-cap-based dynamic fee selection algorithm |
| [Fee Sharing](guides/fee-sharing.md) | Multi-shareholder fee distribution setup |
| [Social Fees](guides/social-fees.md) | GitHub identity-based fee sharing and PDAs |
| [Cashback](guides/cashback.md) | Trader cashback opt-in system |
| [Token Incentives](guides/token-incentives.md) | Volume-based PUMP token reward calculation |
| [Mayhem Mode](guides/mayhem-mode.md) | Alternate vault routing, Token2022 support |
| [End-to-End Workflow](guides/end-to-end-workflow.md) | Complete token lifecycle walkthrough |
| [Analytics](guides/analytics.md) | Price impact, graduation progress, market cap |
| [Security](guides/security.md) | Crypto library rules, key management |

## Reference

| Doc | Description |
|-----|-------------|
| [Glossary](reference/glossary.md) | 60+ protocol and SDK terms |
| [Code Examples](reference/examples.md) | 20+ practical code samples |
| [Error Reference](reference/errors.md) | Custom SDK error classes and fixes |
| [RPC Best Practices](reference/rpc-best-practices.md) | Provider selection, batching, rate limiting |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |
| [Support](support.md) | Getting help, bug reports, feature requests |
| [Roadmap](roadmap.md) | Where PumpKit is headed |

## Additional Docs

| Doc | Description |
|-----|-------------|
| [Migration](migration.md) | SDK version upgrade guide with breaking changes |
| [Ecosystem](ecosystem.md) | Complete ecosystem overview — SDK, bots, dashboards, tools |
| [Admin Operations](admin-operations.md) | Protocol admin operations |
| [AMM Trading](amm-trading.md) | PumpSwap AMM trading guide |
| [CLI Guide](cli-guide.md) | Command-line interface reference |
| [DeFi Agents](defi-agents.md) | AI DeFi agent integration |
| [SDK Integration](sdk-integration.md) | SDK integration patterns |
| [Channel Bot Architecture](channel-bot-architecture.md) | Channel bot system design |
| [Performance](performance.md) | Benchmarks and optimization tips |
| [Testing](testing.md) | Test patterns and fixtures |

## Community & About

| Doc | Description |
|-----|-------------|
| [Adopters](adopters.md) | Community members using PumpKit in production |
| [Governance](governance.md) | BDFL governance model & decision process |
| [Vision](vision.md) | Project vision & AI agent thesis |
| [Article: Pump Fun SDK](article-pump-fun-sdk.md) | Deep-dive article about the SDK ecosystem |

## External References

Large reference documents kept in the parent repo:

| Doc | Description |
|-----|-------------|
| [Solana Docs Reference](../../docs/solana-official-llms.txt.md) | 3,800+ Solana documentation links |
| [SolanaAppKit](../../docs/solanaappkit.md) | Mobile DeFi integration guide |

## Tutorials

30 hands-on guides: [tutorials/](../tutorials/)

## Examples

Reference implementations and dashboards: [examples/](../examples/)
