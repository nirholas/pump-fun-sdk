# Troubleshooting

> Common issues and their solutions. Can't find your answer? [Open a discussion](https://github.com/nirholas/pump-fun-sdk/discussions).

---

## Installation Issues

### `Cannot find module '@pump-fun/pump-sdk'`

Make sure you've installed both the SDK and its peer dependencies:

```bash
npm install @pump-fun/pump-sdk @solana/web3.js @coral-xyz/anchor @solana/spl-token bn.js
```

### `Error: Cannot find module '@coral-xyz/anchor'`

Anchor is a peer dependency. Install it explicitly:

```bash
npm install @coral-xyz/anchor@^0.31.1
```

### TypeScript compilation errors about missing types

Ensure you have `@types/bn.js` if you're using strict TypeScript:

```bash
npm install -D @types/bn.js
```

### ESM vs CommonJS conflicts

The SDK ships both ESM and CJS builds. If you're getting import errors:

```typescript
// ESM (import)
import { PumpSdk, PUMP_SDK } from "@pump-fun/pump-sdk";

// CJS (require)
const { PumpSdk, PUMP_SDK } = require("@pump-fun/pump-sdk");
```

If you're in a `.mjs` file or `"type": "module"` in package.json, use the ESM import.

---

## Connection Issues

### `Error: failed to get info about account`

The bonding curve account may not exist yet. This happens when:

- The token hasn't been created on this network (mainnet vs devnet)
- The mint address is wrong
- The token has been fully migrated and the account was closed

```typescript
// Always check if the account exists
const bondingCurveAccountInfo = await connection.getAccountInfo(bondingCurvePda(mint));
if (!bondingCurveAccountInfo) {
  console.log("Token not found on this network");
}
```

### `Error: 429 Too Many Requests`

You're hitting RPC rate limits. Solutions:

1. Use a dedicated RPC provider (Helius, QuickNode, Triton)
2. Add delays between requests
3. Batch requests with `getMultipleAccountsInfo`

```typescript
// Instead of multiple individual fetches:
const [accountA, accountB] = await connection.getMultipleAccountsInfo([pdaA, pdaB]);
```

### `Error: Transaction simulation failed`

Common causes:

- **Insufficient SOL** — Make sure the signer has enough SOL for the transaction + fees
- **Slippage exceeded** — The price moved more than your slippage tolerance. Increase slippage or retry
- **Bonding curve completed** — The token graduated. Use AMM methods instead
- **Stale data** — Re-fetch the bonding curve state before building the transaction

---

## Bonding Curve Issues

### Buy returns 0 tokens

The bonding curve's `virtualTokenReserves` is 0, meaning the token has been fully migrated to AMM. Check:

```typescript
const bc = await sdk.fetchBondingCurve(mint);
if (bc.complete) {
  console.log("Token graduated — use AMM for trading");
}
if (bc.virtualTokenReserves.eq(new BN(0))) {
  console.log("Bonding curve migrated — no tokens left");
}
```

### Slippage calculation seems wrong

Remember:
- Slippage is in **percentage**, not basis points: `slippage: 1` = 1%, `slippage: 0.5` = 0.5%
- All amounts use `BN` — never JavaScript `number` for financial math
- SOL amounts are in **lamports** (1 SOL = 1,000,000,000 lamports)

```typescript
const solAmount = new BN(0.1 * 1e9); // 0.1 SOL in lamports — correct
const solAmount = 0.1;                // WRONG — don't use raw decimals
```

### Market cap calculation returns unexpected values

Market cap is calculated from virtual reserves and mint supply:

$$
\text{marketCap} = \frac{\text{mintSupply} \times \text{virtualSolReserves}}{\text{virtualTokenReserves}}
$$

If the bonding curve is in **Mayhem mode** (`isMayhemMode: true`), the actual mint supply is used instead of the standard 1 billion supply. This can significantly affect fee tier calculations.

---

## Fee Issues

### Creator fees show 0 balance

Possible causes:

1. **No trades have occurred** — Fees accumulate from trading activity
2. **Fees already claimed** — Check if `collectCoinCreatorFee` was already called
3. **Wrong creator address** — The creator vault is derived from the creator who launched the token
4. **Graduated token** — For graduated tokens, fees accumulate in the AMM vault. Use `getCreatorVaultBalanceBothPrograms` to check both

```typescript
// Check both programs
const balance = await sdk.getCreatorVaultBalanceBothPrograms(creator);
console.log("Total fees:", balance.toString());
```

### Fee distribution fails

Common issues:

- **Shares don't total 10,000 BPS** — All shareholder percentages must sum to exactly 10,000 (100%)
- **No distributable fees** — Check with `getMinimumDistributableFee` first
- **Admin revoked** — If `adminRevoked` is true, the sharing config can't be changed
- **Duplicate shareholders** — Each address can only appear once

```typescript
const result = await sdk.getMinimumDistributableFee(mint);
if (!result.canDistribute) {
  console.log(`Need ${result.minimumRequired.toString()} lamports, have ${result.distributableFees.toString()}`);
}
```

---

## Vanity Generator Issues

### Rust: `cargo build` fails

Make sure you have Rust 1.70+ installed:

```bash
rustup update stable
rustc --version
```

### Generation takes forever

Long prefixes/suffixes take exponentially longer. Use `--dry-run` to estimate:

```bash
solana-vanity --prefix PUMP --dry-run
```

Consider:
- Using `--ignore-case` to increase matches by ~32x for alphabetic patterns
- Reducing pattern length
- Using more threads: `--threads 0` (all CPUs)

### Keypair file won't load in Solana CLI

Ensure the file permissions are correct and the format matches:

```bash
# Check permissions
ls -la my-vanity-key.json

# Verify with solana-keygen
solana-keygen verify <EXPECTED_ADDRESS> my-vanity-key.json

# Set as default keypair
solana config set --keypair my-vanity-key.json
```

---

## MCP Server Issues

### Claude doesn't see the tools

1. Make sure the MCP server is built: `cd mcp-server && npm run build`
2. Check your Claude Desktop config path matches the actual `dist/index.js` location
3. Restart Claude Desktop after config changes
4. Check stderr for startup logs

### "Server disconnected" error

The MCP server communicates over stdio. Common causes:

- The server crashed — check stderr output
- Wrong path in config — use absolute paths
- Node.js not in PATH — use the full path to `node`

---

## GitHub Codespaces / AI Agent Issues

### Terminal seems unresponsive

Agent-spawned terminals in Codespaces may be hidden but still functional. If a terminal is stuck:

1. Kill the terminal
2. Create a new one
3. Always use `isBackground: true` for commands

### Agent stops working after running a command

This is the zombie terminal problem. See [auto-kill-terminal](https://github.com/nirholas/auto-kill-terminal) for the fix. The terminal management rules in this repo's AGENTS.md and CLAUDE.md already include the solution.

---

## Still Stuck?

1. Search [existing issues](https://github.com/nirholas/pump-fun-sdk/issues)
2. Check [Discussions](https://github.com/nirholas/pump-fun-sdk/discussions)
3. Open a [new issue](https://github.com/nirholas/pump-fun-sdk/issues/new?template=bug_report.md) with your error message, environment, and reproduction steps
