# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- ROADMAP.md — public roadmap with quarterly milestones
- VISION.md — project vision and principles
- GOVERNANCE.md — BDFL governance model
- SUPPORT.md — how to get help
- FAQ.md — frequently asked questions
- ADOPTERS.md — who's using pump-fun-sdk
- ACKNOWLEDGMENTS.md — credits and thanks
- docs/TROUBLESHOOTING.md — common issues and fixes
- docs/MIGRATION.md — version upgrade guide
- GitHub Actions CI workflow — build, test, lint across Node 18/20/22
- GitHub Actions release workflow — npm publish and Rust binary releases
- GitHub Actions security workflow — npm audit, cargo audit, CodeQL, dependency review
- GitHub Actions stale issue management
- Discussion templates — Ideas, Q&A, Show & Tell
- Issue template config with contact links
- Documentation improvement issue template
- Question issue template
- .all-contributorsrc for contributor tracking
- Comprehensive CONTRIBUTING.md with code style, commit conventions, testing guide
- Upgraded SECURITY.md with full security policy
- Upgraded PR template with detailed checklist

## [1.0.0] - 2026-02-11

### Added

- Initial release
- Core TypeScript SDK (`PumpSdk` and `OnlinePumpSdk`)
- Bonding curve math — buy/sell quoting, market cap calculation
- Fee system — tiered fees based on market cap, creator fees
- Fee sharing — distribute creator fees to up to 10 shareholders
- Token incentives — volume-based reward calculation and claiming
- PDA derivation utilities for all three programs
- Full TypeScript state types for on-chain accounts
- Rust vanity address generator with Rayon multi-threading
- TypeScript vanity address generator with programmatic API
- MCP server for AI agent wallet operations
- Shell scripts for batch generation and verification
- Security audits for CLI, Rust, and TypeScript
- Comprehensive test suite (unit, integration, fuzz, stress, benchmark)
- Documentation: getting started, architecture, API reference, examples
- GitHub templates: bug report, feature request, PR template
- CI/CD configuration
