# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Pump SDK 2 holder-reward launches with correct holder-vault routing for an
  atomic create-and-buy transaction.
- `holderRewardsPda`, `adminCtoInstruction`, and
  `distributeFeeToHoldersInstruction`.
- Runnable offline example 51 and dedicated tests for launch encoding, global
  gating, CTO conversion, and multi-holder payouts.
- `pump create --holder-reward` for simulation-first holder-reward launches.

### Changed

- Synced the Pump IDL to the deployed 47-instruction program and upgraded
  `@pump-fun/pump-swap-sdk` to 1.20.
- New cashback launches now fail locally with `CashbackDeprecatedError`;
  trading and claims for existing cashback coins remain supported.
- Replaced retired admin-set-creator event handling with the unified CTO and
  holder-distribution events.

## [1.36.0] - 2026-08-04

Ships a command-line interface, and fixes three bugs it surfaced along the way.

### Added

- **The `pump` CLI.** `npm install -g @nirholas/pump-sdk` now puts a `pump` binary on your PATH, built on the same instruction builders the SDK exports. Full reference: [docs/cli.md](docs/cli.md). Walkthrough: [tutorial 45](tutorials/45-cli-quickstart.md).
  - **Read** (no wallet, no configuration): `curve`, `price`, `pool`, `global`, `quote buy|sell`, `watch`, `events`, `pda`.
  - **Trade**: `buy`, `sell`, `create`, routing automatically between the bonding curve and PumpAMM.
  - **Earn**: `fees`, `fees claim`, `incentives`, `incentives claim`, each covering both programs in one transaction.
  - **Operate**: `vanity`, `doctor`, `config`.
  - Every command supports `--json` and writes nothing else to stdout in that mode, so pipes into `jq` are always safe.
  - Every write path simulates first, prints the exact terms, and requires an explicit confirmation. `--simulate` sends nothing, `--yes` skips the prompt for scripts, and a non-interactive invocation with neither refuses rather than spending funds unattended.
- **`formatScaledPrice`, `normalizeForJson`** and the rest of the CLI rendering layer, exported from `@nirholas/pump-sdk/cli` for anyone building on top of it.

### Fixed

- **Reading a graduated token no longer throws `Division by zero`.** Migration zeroes every reserve field on the bonding curve account, so `getTokenPrice`, `getBondingCurveSummary`, and by extension `OnlinePumpSdk.fetchTokenPrice` and `fetchBondingCurveSummary` failed for the entire population of migrated tokens. They now report a graduated curve (zero prices, `isGraduated: true`) and callers can branch on that. `pump curve` goes further and prices those tokens from their AMM pool.
- **`computeFeesBps` no longer throws on a zeroed curve.** A migrated token's market cap is undefined rather than invalid, so it now selects the base fee tier instead of dividing by zero. This affected every fee lookup for a migrated token.
- **Price impact results are no longer misread as SOL.** `PriceImpactResult.priceBefore` and `priceAfter` are lamports per raw token unit scaled by 1e9, which is 1000x a SOL-per-token figure. The new `formatScaledPrice` helper converts them correctly, and the CLI's quote output uses it.

### Changed

- `commander`, `picocolors`, and `bs58` moved into runtime dependencies (the CLI needs them). `bs58` was previously a dev dependency.

## [1.32.0] - 2026-04-23

Prepares the SDK for the **2026-04-28, 16:00 UTC** breaking on-chain program upgrade to the Pump bonding curve and PumpSwap AMM programs. See [docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md](docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md) for the protocol spec and [docs/MIGRATION.md](docs/MIGRATION.md#upgrading-to-v1320-latest) for call-site guidance.

Upstream breaking release: `@pump-fun/pump-sdk@1.33.0`, `@pump-fun/pump-swap-sdk@1.15.0`.

### Changed — BREAKING (protocol, not SDK surface)

- **All buy/sell instruction builders now append trailing fee-recipient accounts** required by the 2026-04-28 on-chain upgrade. The SDK surface is unchanged — callers using `PUMP_SDK.*` get the fix automatically. Affected builders:
  - Bonding curve: `buyInstructions`, `sellInstructions`, `buyExactSolInInstruction`, `getBuyInstructionRaw`, `getSellInstructionRaw`, `createV2AndBuyInstructions`, `createAndBuyInstructions` — append one of 8 new fee recipients as a **mutable** trailing account after `bonding-curve-v2`.
  - PumpAMM: `ammBuyInstruction`, `ammBuyExactQuoteInInstruction`, `ammSellInstruction` — append a **readonly** fee recipient + **mutable** quote-mint (WSOL) ATA after `pool-v2`. Applies to every AMM buy/sell, including pools that did not graduate from a bonding curve.
  - `OnlinePumpSdk` wrappers delegate to the above, so `buyInstructions`, `sellInstructions`, and `sellChunked` are all covered.
- **New account totals:**
  | Instruction | Before | After |
  |-------------|--------|-------|
  | BC `buy` / `buy_exact_sol_in` | 17 | **18** |
  | BC `sell` (non-cashback) | 15 | **16** |
  | BC `sell` (cashback) | 16 | **17** |
  | AMM `buy` / `buy_exact_quote_in` (non-cashback) | 24 | **26** |
  | AMM `buy` / `buy_exact_quote_in` (cashback) | 25 | **27** |
  | AMM `sell` (non-cashback) | 22 | **24** |
  | AMM `sell` (cashback) | 24 | **26** |

### Added

- **`BREAKING_FEE_RECIPIENTS`** (`PublicKey[]`) — the 8 new shared fee recipient pubkeys introduced by the upgrade.
- **`pickBreakingFeeRecipient()`** — selects one of the 8 at random; used internally by every buy/sell builder.
- **`buildAmmBreakingFeeRecipientAccounts(recipient?)`** — builds the two trailing AMM accounts (readonly recipient + mutable WSOL ATA) under `TOKEN_PROGRAM_ID`. Exported so manual-instruction builders share the same source of truth as the SDK.
- **[docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md](docs/pump-public-docs/BREAKING_FEE_RECIPIENT.md)** — mirror of the upstream upgrade spec.
- **[docs/MIGRATION.md](docs/MIGRATION.md)** — v1.32.0 migration section with account-count deltas and the raw remaining-accounts pattern for manual builders.

### Fixed

- `src/__tests__/sdk.test.ts` could not load due to a pre-existing circular dependency (`sdk → onlineSdk → pda` with `PUMP_PROGRAM_ID` used before definition). Reordered imports so `../pda` resolves the cycle before the static `PUMP_PROGRAM_ID` references. Every jest suite now runs.

### Test coverage

- 9 new tests in `src/__tests__/sdk.test.ts` pin the account counts and trailing-account shapes for every upgraded path.
- `src/__tests__/exports.test.ts` asserts the 3 new public exports.

## [1.31.0] - 2026-03-12

### Added

- **Core SDK — Token program auto-detection** in `OnlinePumpSdk`
  - `fetchBuyState` and `fetchSellState` now auto-detect Token Program vs Token-2022 from the mint account owner when `tokenProgram` is not provided
  - `fetchBuyState` now returns `tokenProgram` and normalizes `associatedUserAccountInfo` to `null` (was `undefined`)
  - `fetchSellState` now returns `tokenProgram` in its result
- **Core SDK — Convenience wrappers** on `OnlinePumpSdk`
  - `buyInstructions()` — fetches global state and builds buy instructions in one call
  - `sellInstructions()` — fetches global state and builds sell instructions in one call
- **Lair-TG** — unified Telegram bot platform for DeFi intelligence (`lair-tg/`)
  - Config, data sources, formatters, health check, logger, and type definitions
  - Dockerfile and Railway deployment config
- **PumpKit framework** (`pumpkit/`) — major expansion
  - `@pumpkit/web` — React dashboard with Dashboard, CreateCoin, Docs, Home, Profile, Token pages
  - `useEventStream` hook for SSE connection with status tracking
  - WatchForm, WatchList, StatsBar, EventCard, CopyButton components
  - Chart functionality with cleanup and resize handling
  - Fee Distribution Monitor for detecting distribution events via WebSocket
  - 26 new tutorials (20–45) covering MCP server, WebSocket feeds, channel bot, mayhem mode, cross-program trading, DeFi agents, live dashboards, cashback, analytics, event parsing, shell scripts, Rust vanity, plugin delivery, error handling, AMM liquidity, admin management, x402, security auditing, testing, AI enrichment, claim bot, and channel feed bot
  - CI workflow with testing step
  - Makefile, contributing guidelines, and monorepo setup instructions
  - Mock event feed, Packages page
  - Comprehensive documentation: core API, deployment, getting started, monitor bot, tracker bot
- **Channel-bot enhancements**
  - Graduation event support with enriched token data (holders, recent volume, replies, KotH timestamp)
  - Event monitor and feed logging
  - Support for multiple linked tokens in claim feed formatting
  - Token disambiguation by market cap
  - Same-name token detection and fetching
- **Claim-bot enhancements**
  - `ClaimMonitor` for tracking fee claim transactions in Pump programs
  - `RpcClaimMonitor` for direct Solana RPC monitoring
  - Social fee claim support with WebSocket broadcasting
  - GitHub social fee claims — first claim badge, lifetime claimed amounts, fake claim detection
  - GitHub claim card with token image, name/ticker/mcap header, creator card style
  - GitHub repo info fetching, clickable repository links, developer profile enrichment
  - Social-fee-index for CA resolution on claims
  - `FEED_CLAIMS` env var gating for clean graduation/claims split
- **Outsiders Bot** (`outsiders-bot/`)
  - Core functionality: health check server, logging, token service
  - Comprehensive setup guide, bot information, and privacy policy
- **X/Twitter integration**
  - Refactored to use Twitter's internal GraphQL API with cookie-based authentication via `xactions`
  - `createdAt` and `tweetCount` fields on `XProfile` interface
  - Influencer tier logic
- **Website** (`website/`) — PumpOS web desktop
  - Full HTML/CSS/JS implementation with Vercel deployment config
- **Live dashboards** — enhanced `dashboard.html` with viewer count
- **Documentation**
  - Governance, adopters, migration guide, development guide, FAQ, roadmap, support, vision docs
  - API reference documentation
  - Skills for Carbon indexing, React Native Pager View, Pump Segments SDK, Transfer Hook Authority
- **Tests**
  - Integration test for `OnlinePumpSdk` buy/sell flow on mainnet
  - Event types and templates formatting tests
  - Health and logger tests for PumpKit
- **pumpfun-site** — token creation page (`create.html`) and token launchpad HTML/CSS

### Changed

- `fetchBuyState` `tokenProgram` parameter changed from default `TOKEN_PROGRAM_ID` to optional with auto-detection (non-breaking — callers omitting the param get the same behavior)
- `fetchSellState` `tokenProgram` parameter changed similarly
- Enhanced claim feed formatting with additional token holder, trade info, liquidity, and bundle detection
- Enhanced graduation feed formatting with trade data, compact stats, bot links
- Enhanced GitHub claim feed with creator profile, holders, trades, liquidity context
- Updated live dashboards with deployment sections and viewer counts
- Specified `packageManager` field in root `package.json`
- Node.js engine requirement remains `>=18.0.0`

### Fixed

- Fixed token program detection for associated token address in buy flow
- Fixed social fee claim detection using Anchor instruction log matching
- Fixed GitHub user ID list fallback widened to `per_page=20` for deleted account gaps
- Fixed Twitter community URL display (show "Community" link correctly)
- Fixed graduation card formatting — compact stats, no tree, correct Twitter community URLs
- Fixed GitHub claim card — creator card style with `↳`, compact meta, clean footer
- Fixed `formatCompact` — removed unnecessary condition
- Removed redundant environment variables from Turbo configuration
- Removed unused `types` configuration from `tsconfig.json`
- Replaced forbidden `npx tsc --noEmit` with `npm run typecheck` in development docs

### Removed

- Deprecated Twitter API v2 integration (replaced by GraphQL API via `xactions`)
- Unused social fee claim parsing logic from ClaimMonitor
- Creator fee claim tracking (GitHub claims only now)
- Unused image files (Screenshot, `a.png`)

## [1.30.0] - 2026-03-06

### Added

- MCP server initial implementation with validation schemas and tutorial documentation
- New tools for token metadata, social fees, and wallet management
- New tools for analytics, fees, metadata, token incentives
- Screenshot automation for sectbot pages using Playwright
- Release workflow for automated deployment and testing
- Comprehensive documentation for RPC best practices, plugin delivery, error handling, and AMM liquidity operations
- Tutorials for advanced analytics, event parsing, cross-program trading, DeFi agents integration, live dashboard deployment, cashback, and social fee PDAs
- Fee sharing setup and error handling to create-and-buy tutorial

### Changed

- Updated `package.json` to require Node.js 18 or higher
- Enhanced claim feed formatting with additional token holder and trade info
- Enhanced token info with GitHub URLs and token holder/trade info fetching
- Enhanced user experience with pulse animation on logo for first-time visitors

### Fixed

- Channel-bot: fixed corrupted `formatters.ts`, fixed Dockerfile (`npm ci` -> `npm install` for missing lock file)

## [1.29.0]

### Added

- x402 payment protocol — HTTP 402 micropayments with Solana USDC
  - Client, server, and facilitator implementations
  - Example code for all three roles
- Channel-bot — Telegram channel monitoring bot
  - Axiom/@nich referral, GMGN referral
  - Scam count, Fee Recipient section
  - Status by @handle, blockquote description, top coin MC
  - Dockerfile, Railway deployment config

## [1.28.0]

### Added

- TypeScript vanity address generator (educational reference implementation)
  - Generator, matcher, security, validation modules
  - Format utilities and base58 encoding
  - Comprehensive test suite (generator, integration, matcher, security, validation)
  - Basic usage and batch generation examples
  - Worker threads support

## [1.27.0]

### Added

- 19 hands-on tutorial guides covering the full SDK
  - Token creation, buying, selling, analytics
  - Fee sharing, migration, token incentives
  - Working with PDAs, trading bot patterns
  - Offline vs online SDK, vanity addresses
  - x402 paywalled APIs, decoding accounts
  - Monitoring claims, monitoring website
  - Telegram bot integration, CoinGecko integration

## [1.26.0]

### Added

- Social fee PDA support — referral fee accounts linked to social identities
- `createSocialFeePdaInstruction` for creating social referral accounts
- `claimSocialFeePdaInstruction` for claiming accumulated social fees
- `normalizeSocialShareholders` for resolving social IDs to PDA addresses
- `Platform` enum (`Pump`, `X`, `GitHub`)

## [1.25.0]

### Added

- Cashback feature — fee rebates on trades
- `claimCashbackInstruction` for claiming accumulated cashback
- `ammClaimCashbackInstruction` for AMM cashback claims
- `cashback` parameter on `createV2Instruction`, `sellInstructions`, AMM instructions
- `toggleCashbackEnabledInstruction` admin control

## [1.24.0]

### Added

- Mayhem Mode — randomized bonding curve parameters
- `toggleMayhemModeInstruction` admin control
- `setMayhemVirtualParamsInstruction` for setting mayhem parameters
- Mayhem-specific PDAs (`getGlobalParamsPda`, `getMayhemStatePda`, `getSolVaultPda`, `getTokenVaultPda`)

## [1.23.0]

### Added

- Token incentives — volume-based $PUMP token rewards
- `initUserVolumeAccumulator`, `syncUserVolumeAccumulator`, `closeUserVolumeAccumulator`
- `claimTokenIncentives`, `claimTokenIncentivesBothPrograms`
- `getTotalUnclaimedTokens`, `getTotalUnclaimedTokensBothPrograms`
- `getCurrentDayTokens`, `getCurrentDayTokensBothPrograms`
- `totalUnclaimedTokens()` and `currentDayTokens()` pure calculation functions
- Admin `adminUpdateTokenIncentives` and `adminUpdateTokenIncentivesBothPrograms`

## [1.22.0]

### Added

- Analytics module (`analytics.ts`)
  - `calculateBuyPriceImpact` — price impact for buy trades
  - `calculateSellPriceImpact` — price impact for sell trades
  - `getGraduationProgress` — bonding curve completion percentage
  - `getTokenPrice` — current buy/sell price per token
  - `getBondingCurveSummary` — complete bonding curve overview
- Online SDK analytics fetchers (`fetchBondingCurveSummary`, `fetchGraduationProgress`, `fetchTokenPrice`, `fetchBuyPriceImpact`, `fetchSellPriceImpact`)

## [1.21.0]

### Added

- Fee sharing system (PumpFees program integration)
  - `createFeeSharingConfig` — create fee distribution config
  - `updateFeeShares` — update shareholder allocations
  - `distributeCreatorFees` — distribute accumulated fees
  - `getMinimumDistributableFee` — check distribution threshold
  - `buildDistributeCreatorFeesInstructions` — convenience builder
- Custom error types for fee validation (`NoShareholdersError`, `TooManyShareholdersError`, `ZeroShareError`, `InvalidShareTotalError`, `DuplicateShareholderError`, `PoolRequiredForGraduatedError`, `ShareCalculationOverflowError`)

## [1.20.0]

### Added

- PumpAMM integration — trading on graduated pools
  - `ammBuyInstruction`, `ammBuyExactQuoteInInstruction`, `ammSellInstruction`
  - `ammDepositInstruction`, `ammWithdrawInstruction` (LP operations)
  - `ammCollectCoinCreatorFeeInstruction`
  - `ammMigratePoolCoinCreatorInstruction`, `ammSetCoinCreatorInstruction`
  - `ammTransferCreatorFeesToPumpInstruction`
- Pool state decoding (`decodePool`, `decodeAmmGlobalConfig`)

## [1.19.0]

### Added

- Tiered fee system based on market cap thresholds
- `FeeConfig` and `FeeTier` types
- `calculateFeeTier` for tier lookup
- `computeFeesBps` for current fee rate calculation

## [1.18.0]

### Added

- `createV2Instruction` with `mayhemMode` support
- `buyExactSolInInstruction` for exact-SOL-input buys

### Deprecated

- `createInstruction` (v1) — use `createV2Instruction` instead

## [1.17.0]

### Added

- Creator fee collection
  - `collectCoinCreatorFeeInstructions`
  - `getCreatorVaultBalance`, `getCreatorVaultBalanceBothPrograms`
- `setCreator` and `migrateBondingCurveCreatorInstruction`
- `adminSetCoinCreatorInstructions`

## [1.16.0]

### Added

- `isGraduated` convenience method
- `sellAllInstructions` to sell entire token balance
- `getTokenBalance` helper

## [1.15.0]

### Added

- `OnlinePumpSdk` — RPC-dependent extension of PumpSdk
  - `fetchGlobal`, `fetchFeeConfig`, `fetchBondingCurve`
  - `fetchBuyState`, `fetchSellState` (batch state fetching)
  - `fetchPool`, `fetchPoolByAddress`

## [1.14.0]

### Added

- Event decoders for all Pump, PumpAMM, and PumpFees program events
  - Trade, Create, Complete, Migration, SetCreator events
  - AMM Buy, Sell, Deposit, Withdraw, CreatePool events
  - Fee sharing config events

## [1.13.0]

### Added

- Comprehensive PDA module (`pda.ts`)
  - All static PDAs (GLOBAL_PDA, AMM_GLOBAL_PDA, etc.)
  - Derived PDAs (bondingCurvePda, creatorVaultPda, canonicalPumpPoolPda, etc.)

## [1.12.0]

### Added

- Bonding curve math module (`bondingCurve.ts`)
  - `getBuyTokenAmountFromSolAmount`
  - `getBuySolAmountFromTokenAmount`
  - `getSellSolAmountFromTokenAmount`
  - `bondingCurveMarketCap`
  - `newBondingCurve`

## [1.11.0]

### Added

- Core `PumpSdk` class with offline instruction builders
  - `createInstruction` (v1)
  - `buyInstructions`, `sellInstructions`
  - `migrateInstruction`
  - Account decoders
- `PUMP_SDK` singleton
- State types (`Global`, `BondingCurve`, `Pool`)
- Anchor IDL integration (Pump, PumpAMM, PumpFees)

## [1.0.0]

### Added

- Initial release
- Pump program instruction builders
- Basic bonding curve math
- PDA derivation
- TypeScript types for all account state
