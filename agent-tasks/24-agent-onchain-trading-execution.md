# Task 24: Agent On-Chain Trading & Execution Layer

## Context

You are working in the `pump-fun-sdk` repository. The goal of this task is to build the execution layer that allows autonomous agents (LLM-driven bots, strategy runners, schedulers) to submit real transactions against the Pump protocol on Solana mainnet. Today, the SDK emits `TransactionInstruction[]` via `PumpSdk` / `OnlinePumpSdk`, but there is no opinionated, production-grade helper for taking those instructions and actually landing them on-chain reliably.

## Background

Pump-protocol trades have three failure modes agents must handle:
1. **Simulation failures** — bonding curve state changed, slippage exceeded, insufficient SOL/tokens
2. **Landing failures** — compute budget too low, priority fee too low for congestion, blockhash expired
3. **Execution failures** — Anchor custom errors (6003 `tooLittleSolReceived`, 6023 `notEnoughTokensToSell`, 6024 `overflow`) reported after on-chain execution

Agents must also choose:
- Regular RPC submission vs Jito bundles (for MEV protection on high-value trades)
- Priority fee auto-tuning (read recent fee percentiles from RPC)
- Compute unit budget estimation (simulate → CU used + 20% buffer)
- Retry strategy on expiration/blockhash errors

## Objective

Create an **AgentExecutor** module that takes `TransactionInstruction[]` plus a signing callback, and returns a signature (or structured failure). It must work with both direct RPC and Jito.

## What to Create

### 1. New File: `src/agent/executor.ts`

```typescript
export interface AgentSigner {
  publicKey: PublicKey;
  signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;
}

export interface ExecuteOptions {
  instructions: TransactionInstruction[];
  signer: AgentSigner;
  connection: Connection;
  priorityFeeMicroLamports?: number | 'auto';
  computeUnitLimit?: number | 'auto';
  maxRetries?: number;           // default 3
  skipPreflight?: boolean;       // default false
  lookupTables?: AddressLookupTableAccount[];
  jito?: { endpoint: string; tipLamports: number; tipAccount: PublicKey };
}

export interface ExecuteResult {
  signature: string;
  slot: number;
  computeUnitsConsumed: number;
  landingPath: 'rpc' | 'jito';
  priorityFeePaid: number;
  attempts: number;
}

export interface ExecuteFailure {
  kind: 'simulation' | 'blockhash' | 'send' | 'confirm' | 'program';
  error: Error;
  logs?: string[];
  programErrorCode?: number;   // Anchor custom error code if decoded
  programErrorName?: string;   // e.g. "tooLittleSolReceived"
  attempts: number;
}

export async function executeAgentTrade(
  opts: ExecuteOptions,
): Promise<{ ok: true; result: ExecuteResult } | { ok: false; failure: ExecuteFailure }>;
```

Behavior:
- Build `VersionedTransaction` with `TransactionMessage.compileToV0Message(lookupTables)`
- Call `connection.simulateTransaction` with `sigVerify: false` — fail fast on simulation error with decoded program logs
- Auto CU: use `simulateTransaction.value.unitsConsumed * 1.2` rounded up
- Auto priority fee: call `connection.getRecentPrioritizationFees` → 75th percentile, fall back to 10_000 microlamports floor
- Prepend `ComputeBudgetProgram.setComputeUnitLimit` + `setComputeUnitPrice` instructions
- If `jito` option set: send as Jito bundle via the standard `/api/v1/bundles` endpoint, include tip transfer
- Otherwise `connection.sendRawTransaction` with retry on expired blockhash
- Confirm with `connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight })` at `confirmed` commitment
- Decode Anchor error codes from logs: parse lines matching `Program log: AnchorError.*Error Code: (\w+)\. Error Number: (\d+)`

### 2. New File: `src/agent/errors.ts`

Export a mapping of Pump program error codes → friendly names (derived from `src/idl/pump.ts`):
```typescript
export const PUMP_ERRORS: Record<number, { name: string; recoverable: boolean }> = {
  6003: { name: 'tooLittleSolReceived', recoverable: true },    // retry with lower slippage expectations
  6023: { name: 'notEnoughTokensToSell', recoverable: false },
  6024: { name: 'overflow', recoverable: false },
  // ... extract the full list from src/idl/pump.ts errors[] array
};

export function classifyProgramError(logs: string[]): { code: number; name: string } | null;
```

### 3. New File: `src/agent/priorityFees.ts`

```typescript
export async function getRecommendedPriorityFee(
  connection: Connection,
  writableAccounts: PublicKey[],
  percentile?: number,  // default 75
): Promise<number>;
```

Call `connection.getRecentPrioritizationFees({ lockedWritableAccounts })` and return the percentile.

### 4. New File: `src/agent/index.ts`

Barrel export:
```typescript
export * from './executor';
export * from './errors';
export * from './priorityFees';
```

### 5. Wire into `src/index.ts`

Add: `export * from './agent';`

### 6. Tests: `src/__tests__/agent-executor.test.ts`

Jest unit tests (mock Connection):
- `classifyProgramError` decodes Anchor log lines correctly
- `executeAgentTrade` returns simulation failure when Connection.simulateTransaction returns `err`
- Auto CU path calls `setComputeUnitLimit` with `unitsConsumed * 1.2`
- Auto priority fee path queries `getRecentPrioritizationFees`
- Jito path sends via bundle endpoint and includes tip transfer

## Rules

- `src/agent/` is a new directory — keep it isolated from existing `sdk.ts` / `onlineSdk.ts`
- `AgentSigner` interface is the only coupling to private keys — this module never touches keypairs directly
- Return `TransactionInstruction[]` from instruction builders; this module is the ONLY one that wraps into `VersionedTransaction`
- Use `BN` for all amounts — never `number` for lamports/tokens
- Do not use `npx tsc --noEmit`. Run `npm run typecheck` to verify
- All dependencies must already be in package.json (`@solana/web3.js` is present)

## Files to Read Before Starting

- `src/sdk.ts` — how instructions are built today
- `src/onlineSdk.ts` — existing RPC-aware wrapper patterns
- `src/idl/pump.ts` — `errors` array for error code mapping
- `docs/pump-public-docs/FAQ.md` — CU optimization guidance
- `src/index.ts` — current public surface
