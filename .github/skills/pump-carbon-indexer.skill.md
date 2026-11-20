---
applyTo: "**"
---
# Carbon — Solana Indexing Framework (sevenlabs-hq/carbon)

## Skill Description

Reference the official Carbon indexing framework documentation when building Solana indexers, decoding on-chain instructions/accounts, or setting up data pipelines. Carbon is maintained by sevenlabs-hq and provides the infrastructure for indexing Pump protocol transactions.

**Repository:** [sevenlabs-hq/carbon](https://github.com/sevenlabs-hq/carbon)

## When to Use

- Building a Solana indexer or data pipeline
- Decoding Pump, PumpSwap, or PumpFees program instructions/accounts
- Working with Yellowstone gRPC, Helius LaserStream, or RPC datasources
- Generating decoders from Anchor/Codama IDL files
- Processing historical or real-time Solana transactions
- Building monitoring/alerting systems for on-chain events

## What is Carbon

Carbon is a lightweight Rust indexing framework for Solana. It provides a modular pipeline: **Datasource → Decoder → Processor**. You source data from Solana (RPC, gRPC, snapshots), decode it with program-specific decoders, and process it with custom handlers.

## Architecture

| Component | Directory | Purpose |
|-----------|-----------|---------|
| Core framework | `crates/core/` | Pipeline orchestration, traits (`AccountDecoder`, `InstructionDecoder`, `Processor`) |
| CLI | `packages/cli/` | `carbon-cli` — generate decoders from IDL, scaffold projects |
| Codama renderer | `packages/renderer/` | Generate Rust decoder code from Codama IDL |
| Decoders | `decoders/` | 50+ program-specific decoders (published crates) |
| Datasources | `datasources/` | RPC, gRPC, snapshot ingestion crates |
| Metrics | `metrics/` | Log-based and Prometheus metrics |
| Examples | `examples/` | Working indexer projects (Jupiter, Raydium, Meteora, PumpSwap, etc.) |

## Pump-Specific Decoders

| Crate | Program | Program ID |
|-------|---------|------------|
| `carbon-pumpfun-decoder` | Pump (bonding curve) | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| `carbon-pump-swap-decoder` | PumpSwap (AMM) | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` |
| `carbon-pump-fees-decoder` | PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` |

## Available Datasources

| Crate | Description | Cost |
|-------|-------------|------|
| `carbon-block-subscribe` | `blockSubscribe` via Solana WS RPC | Cheap (RPC only) |
| `carbon-program-subscribe` | `programSubscribe` via Solana WS RPC | Cheap (RPC only) |
| `carbon-transaction-crawler` | Historical TX crawl via RPC | Cheap (RPC only) |
| `carbon-validator-snapshot-datasource` | Validator snapshot processing | Cheap (storage) |
| `carbon-yellowstone-grpc-datasource` | Yellowstone gRPC (real-time) | Medium (gRPC provider) |
| `carbon-helius-laserstream-datasource` | Helius LaserStream (never-miss) | Medium (Helius plan) |
| `carbon-stream-message-datasource` | Generic message stream | Varies |

## CLI Usage

```bash
# Install
npm install -g @sevenlabs-hq/carbon-cli

# Generate decoder from Anchor IDL
carbon-cli parse --idl my_program.json --out-dir ./src/decoders

# Generate decoder from on-chain program
carbon-cli parse --idl LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo -u mainnet-beta --out-dir ./decoders

# Scaffold a full indexer project
carbon-cli scaffold --name my-project --out-dir ./project --idl ./idl.json --data-source yellowstone-grpc
```

## Decoder Structure

Every decoder follows this pattern:

```
decoders/your-program-decoder/
├── Cargo.toml
├── README.md
├── src/
│   ├── lib.rs
│   ├── accounts/
│   │   └── mod.rs          # AccountDecoder impl
│   ├── instructions/
│   │   └── mod.rs          # InstructionDecoder impl
│   └── types/
│       └── mod.rs          # Borsh types
└── tests/
    └── fixtures/           # JSON test fixtures
```

## Key Traits

```rust
// Decode accounts from raw bytes
trait AccountDecoder {
    type AccountType;
    fn decode_account(&self, account: &Account) -> Option<DecodedAccount<Self::AccountType>>;
}

// Decode instructions from raw bytes
trait InstructionDecoder {
    type InstructionType;
    fn decode_instruction(&self, ix: &Instruction) -> Option<DecodedInstruction<Self::InstructionType>>;
}

// Process decoded data
trait Processor {
    async fn process(&mut self, data: DecodedData) -> CarbonResult<()>;
}
```

## Critical Rules

1. Use `#[carbon(discriminator = "0x...")]` macro for instruction discriminators
2. Implement `ArrangeAccounts` for every instruction to map accounts by name
3. All decoders check `instruction.program_id == PROGRAM_ID` before decoding
4. Feature flags: `serde`, `postgres`, `graphql` for optional functionality
5. Use `carbon-test-utils::read_instruction()` for fixture-based testing
