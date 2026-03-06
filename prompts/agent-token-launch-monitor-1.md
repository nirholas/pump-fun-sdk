# Agent 1: Token Launch Monitor — Core Monitor Class

## Objective

Create a `TokenLaunchMonitor` class in the existing `telegram-bot/src/` directory that monitors the PumpFun Pump program for **new token creation** (`createV2`) transactions in real-time, fetches token metadata, and filters for tokens with GitHub links.

## Context

The existing telegram-bot at `telegram-bot/src/` already has a `PumpFunMonitor` class in `monitor.ts` that monitors fee claim events via WebSocket (`connection.onLogs`) with HTTP polling fallback. Study that file carefully — your new monitor follows the same dual-mode pattern but detects **token launches** instead of fee claims.

**Key existing files to study first:**
- `telegram-bot/src/monitor.ts` — Existing monitor pattern (WebSocket + polling). Mirror this architecture.
- `telegram-bot/src/types.ts` — Existing types, program IDs, config. Add your new types here.
- `telegram-bot/src/config.ts` — Config loader. Add any new env vars here.
- `src/sdk.ts` — The `createV2` instruction builder. Look at the method signature for field names (name, symbol, uri, creator, mayhemMode, cashback).

## Architecture

### On-Chain Detection

The Pump program ID is `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`.

When a new token is created via `createV2`, the transaction logs will contain:
1. A `Program log: Instruction: CreateV2` entry
2. Program data logs with the Anchor event discriminator for `CreateEvent`

**Detection strategy (in priority order):**
1. **Log keyword match**: Check if logs contain `"Instruction: Create"` (covers both `Create` and `CreateV2`)
2. **Instruction discriminator match**: Decode the first 8 bytes of instruction data and match against the `createV2` Anchor discriminator
3. **Account heuristic**: New token creations always include a new mint account and a bonding curve PDA

### Metadata Fetching

The `uri` parameter in `createV2` points to a JSON metadata file (usually on IPFS via `https://ipfs.io/ipfs/...` or `https://cf-ipfs.com/ipfs/...` or Arweave). Fetch this JSON and extract:

```typescript
interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  // Some creators put GitHub in description or website field
}
```

### GitHub Link Detection

Check ALL text fields in the metadata for GitHub URLs:
- `website` field containing `github.com`
- `description` field containing `github.com`
- `twitter` field (unlikely but check)
- Any other string fields

## Files to Create/Modify

### 1. Create `telegram-bot/src/token-launch-monitor.ts`

```typescript
/**
 * PumpFun Telegram Bot — Token Launch Monitor
 *
 * Monitors the Pump program for new token creation (createV2) transactions.
 * Detects new launches in real-time via WebSocket or polling fallback.
 * Fetches token metadata and filters for GitHub-linked tokens.
 */
```

The class should:

- **Constructor**: Accept `BotConfig` and an `onTokenLaunch` callback
- **`start()`**: Try WebSocket first, fall back to polling (same pattern as `PumpFunMonitor`)
- **`stop()`**: Clean up subscriptions and timers
- **`getState()`**: Return `TokenLaunchMonitorState`
- **WebSocket mode**: Subscribe to `onLogs` for `PUMP_PROGRAM_ID` only, filter for create instructions
- **Polling mode**: Use `getSignaturesForAddress` on `PUMP_PROGRAM_ID`, process new transactions
- **`processTransaction(signature)`**: Fetch parsed transaction, detect if it's a create, extract fields
- **`fetchMetadata(uri)`**: HTTP GET the metadata URI with timeout (5s), parse JSON, extract GitHub links
- **Dedup**: Track processed signatures in a `Set<string>` with max 10,000 entries (same eviction as existing monitor)

Key implementation details:
- Use `connection.getParsedTransaction()` to get the parsed tx
- Extract the mint address from the transaction's account keys (it's the newly created mint)
- Extract the creator address (the transaction signer / fee payer)
- Extract name, symbol, uri from the instruction data if possible, OR from the token metadata account
- Fetch the metadata URI with a try/catch and timeout — don't block on slow IPFS gateways
- Rate limit metadata fetches (PumpFun can have 10+ launches per minute on mainnet)

```typescript
export interface TokenLaunchEvent {
  /** Transaction signature */
  txSignature: string;
  /** Solana slot */
  slot: number;
  /** Block timestamp (unix seconds) */
  timestamp: number;
  /** The new token's mint address */
  mintAddress: string;
  /** Token creator wallet */
  creatorWallet: string;
  /** Token name (from tx data or metadata) */
  name: string;
  /** Token symbol/ticker */
  symbol: string;
  /** Metadata URI */
  metadataUri: string;
  /** Whether this token has a GitHub link */
  hasGithub: boolean;
  /** Extracted GitHub URL(s) */
  githubUrls: string[];
  /** Whether mayhem mode is enabled */
  mayhemMode: boolean;
  /** Full metadata JSON (if fetched successfully) */
  metadata?: Record<string, unknown>;
}

export interface TokenLaunchMonitorState {
  isRunning: boolean;
  mode: 'websocket' | 'polling';
  tokensDetected: number;
  tokensWithGithub: number;
  lastSlot: number;
  startedAt: number;
  /** Whether to only notify for GitHub-linked tokens */
  githubOnly: boolean;
}
```

### 2. Modify `telegram-bot/src/types.ts`

Add the `createV2` instruction discriminator. To find it: the Anchor discriminator for `createV2` is the first 8 bytes of `sha256("global:create_v2")`. Add it as a constant:

```typescript
/** Anchor discriminator for createV2 instruction (first 8 bytes of sha256("global:create_v2")) */
export const CREATE_V2_DISCRIMINATOR = '...'; // compute this

/** Anchor discriminator for create instruction (first 8 bytes of sha256("global:create")) */  
export const CREATE_DISCRIMINATOR = '...'; // compute this
```

Also add to the `BotConfig` interface:
```typescript
/** Whether to enable the token launch monitor */
enableLaunchMonitor: boolean;
/** Only notify for tokens with GitHub links (default: false = notify all) */
githubOnlyFilter: boolean;
/** IPFS gateway base URL for metadata fetching */
ipfsGateway: string;
```

### 3. Modify `telegram-bot/src/config.ts`

Add loading of new env vars:
```
ENABLE_LAUNCH_MONITOR=true
GITHUB_ONLY_FILTER=false  
IPFS_GATEWAY=https://cf-ipfs.com/ipfs/
```

## Constraints

- Follow the exact same code style as `monitor.ts` — same logging patterns, error handling, JSDoc style
- Use the existing `log` logger from `./logger.js`
- Do NOT install new dependencies — use Node's built-in `fetch` (available in Node 18+) for HTTP requests
- Handle metadata fetch failures gracefully — the token launch event should still be emitted even if metadata fetch fails
- Include proper TypeScript types for everything
- Add dedup tracking identical to the existing monitor's `processedSignatures` pattern
- The discriminator hex strings should be computed correctly — verify by checking against the IDL in `src/idl/pump.json`

## Testing

After creating the files, verify there are no TypeScript errors by examining the types. Don't try to run the bot (no Telegram token available), but make sure the code compiles cleanly.

## Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command
- **Always kill the terminal** after the command completes
- Do not reuse foreground shell sessions
