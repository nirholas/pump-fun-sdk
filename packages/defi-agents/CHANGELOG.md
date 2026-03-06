# Changelog

All notable changes to the DeFi Agents API are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## \[1.1.0] - 2025-12-21

### Added

#### Master Agent for Simplified UX

- **sperax-portfolio** 🎯 - All-in-one cryptocurrency portfolio management master agent
  - Combines ALL 16 portfolio plugin features into ONE comprehensive agent
  - Portfolio tracking, trading automation, DeFi protocols, analytics, and more
  - Maintains conversation context across all features
  - Perfect for 80%+ of users - install once, access everything
  - Recommended as primary Sperax agent for most use cases
  - **Note:** Currently supports read-only portfolio features; automated trading/bots planned for future SperaxOS releases

### Changed

- **Total Agents**: 57 → 58 (added master agent)
- **Sperax Ecosystem**: 23 → 24 agents (1 master + 7 core + 16 specialists)
- **README**: Featured master agent prominently with recommendation badge
- **Marketplace Strategy**: Master agent as default, specialists for power users

---

## \[1.0.0] - 2025-12-21

### Added

#### New Sperax Portfolio Plugin Agents (16 Agents)

- **sperax-dashboard** - Portfolio overview dashboard with total value, allocation, and performance metrics
- **sperax-assets-tracker** - Asset tracking and analytics for portfolio positions
- **sperax-analytics-expert** - Performance analytics and insights for portfolio optimization
- **sperax-wallet-manager** - Wallet management and configuration assistance
- **sperax-trading-assistant** - Trade execution helper with market analysis
- **sperax-ai-trading-bot** - AI-powered trading strategies and automation
- **sperax-signal-bot** - Trading signals and market alerts
- **sperax-dca-bot** - Dollar-cost averaging automation and strategies
- **sperax-arbitrage-bot** - Arbitrage opportunity detection and execution
- **sperax-pump-screener** - Momentum screening and trend analysis
- **sperax-defi-center** - DeFi protocol aggregator and explorer
- **sperax-defi-protocols** - DeFi protocol information and comparison
- **sperax-strategies-marketplace** - Trading strategy discovery and management
- **sperax-bot-templates** - Bot template library and customization
- **sperax-settings-manager** - Settings and configuration management
- **sperax-help-center** - Help and documentation for Sperax ecosystem

#### Documentation

- Comprehensive API documentation ([docs/API.md](docs/API.md))
- Agent manifest for machine-readable indexing ([agents-manifest.json](agents-manifest.json))
- robots.txt for SEO and AI crawler access
- Expanded README with 57 total agents
- Workflow guides and deployment documentation

#### Infrastructure

- Automated i18n translation pipeline (18 languages)
- Schema validation for all agents
- GitHub Pages CDN deployment
- Custom domain support (sperax.click)
- CNAME auto-copying for domain persistence

#### Technical Improvements

- Agent schema validation
- Translation quality checks
- Build optimization
- GitHub Actions CI/CD automation

### Changed

- Expanded agent collection from 41 to 57 agents
- Enhanced documentation structure
- Improved discoverability for search engines and LLMs

### Features

- ✅ 57 Specialized Agents
- ✅ 18 Language Translations
- ✅ RESTful JSON API
- ✅ No Rate Limiting
- ✅ GitHub Pages CDN
- ✅ Open Source (MIT)
- ✅ Universal Compatibility
- ✅ No Vendor Lock-in

---

## \[0.9.0] - 2025-12-20

### Added

- Initial 41 DeFi agent templates
- Basic i18n translation system
- GitHub Pages hosting

---

## Version History

| Version | Date       | Agents | Languages | Status     |
| ------- | ---------- | ------ | --------- | ---------- |
| 1.0.0   | 2025-12-21 | 57     | 18        | Latest     |
| 0.9.0   | 2025-12-20 | 41     | 18        | Deprecated |

---

## API Versioning

**Current API Version**: 1.0

The API follows semantic versioning for backwards compatibility:

- **Major**: Breaking changes to schema or endpoint structure
- **Minor**: New agents or features (backwards compatible)
- **Patch**: Bug fixes and improvements

---

## Supported Languages

As of v1.0.0, all agents are available in 18 languages:

1. English (en-US)
2. Arabic (ar)
3. Bulgarian (bg-BG)
4. Chinese Simplified (zh-CN)
5. Chinese Traditional (zh-TW)
6. German (de-DE)
7. Spanish (es-ES)
8. Persian (fa-IR)
9. French (fr-FR)
10. Italian (it-IT)
11. Japanese (ja-JP)
12. Korean (ko-KR)
13. Dutch (nl-NL)
14. Polish (pl-PL)
15. Portuguese Brazilian (pt-BR)
16. Russian (ru-RU)
17. Turkish (tr-TR)
18. Vietnamese (vi-VN)

---

## Agent Categories

### Sperax Ecosystem (23 Agents)

- **Portfolio Management**: Dashboard, Assets Tracker, Portfolio Tracker, Analytics Expert
- **Trading**: Trading Assistant, AI Trading Bot, Signal Bot, DCA Bot, Arbitrage Bot, Pump Screener
- **DeFi**: DeFi Center, DeFi Protocols, Yield Aggregator, Liquidity Strategist
- **Governance**: Governance Guide, Bridge Assistant
- **Management**: Wallet Manager, Settings Manager, Risk Monitor, Help Center, Strategies Marketplace, Bot Templates
- **Onboarding**: Onboarding Guide

### DeFi & Crypto (34 Agents)

- **Yield Farming**: DeFi Yield Farmer, Staking Rewards Calculator, Yield Sustainability Analyst
- **Risk Management**: Liquidation Risk Manager, DeFi Risk Scoring Engine, DeFi Insurance Advisor
- **Trading Optimization**: DEX Aggregator Optimizer, Gas Optimization Expert, MEV Protection Advisor
- **Security**: Smart Contract Auditor, Bridge Security Analyst, Wallet Security Advisor
- **Analysis**: Protocol Revenue Analyst, Protocol Treasury Analyst, Governance Proposal Analyst, Narrative Trend Analyst
- **Education**: DeFi Onboarding Mentor, APY vs APR Educator, DeFi Protocol Comparator, Stablecoin Comparator, Layer2 Comparison Guide
- **Specialized**: Alpha Leak Detector, Crypto Tax Strategist, Liquidity Pool Analyzer, NFT Liquidity Advisor, Portfolio Rebalancing Advisor, SPA Tokenomics Analyst, Token Unlock Tracker, USDS Stablecoin Expert, Vespa Optimizer, Whale Watcher

---

## Future Roadmap

### Planned (v1.1.0)

- [ ] GraphQL endpoint for agent queries
- [ ] Analytics dashboard for API usage
- [ ] WebSocket support for real-time updates
- [ ] Agent rating and review system
- [ ] Community contributions framework

### Under Consideration

- Additional language support (50+ languages)
- Multi-agent team coordination API
- Agent performance metrics
- Custom agent builder tools

---

## Breaking Changes

No breaking changes have been introduced since v1.0.0.

---

## Migration Guides

### Upgrading to 1.0.0

No migration required. The API is fully backwards compatible with all previously published agents. New agents and features are additive only.

**Benefits of Upgrading**:

- Access 16 new Sperax portfolio agents
- Better documentation and examples
- Improved API discoverability
- Enhanced SEO for your integration

---

## Security

### Security Policy

For security concerns or vulnerability reports, please email <security@sperax.click> or open a private security advisory on GitHub.

No vulnerabilities have been reported in the JSON API format. All agent definitions are stateless and contain no sensitive data.

---

## Support

For questions, issues, or feedback:

- **GitHub Issues**: <https://github.com/nirholas/defi-agents/issues>
- **Documentation**: [docs/API.md](docs/API.md)
- **Contributing**: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

---

## License

This changelog and all content is licensed under the MIT License. See [LICENSE](LICENSE) for details.

