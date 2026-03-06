# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
