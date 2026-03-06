# Tutorial 33: Error Handling & Validation Patterns

> Handle every SDK error correctly — validate fee shares, catch transaction failures, and build resilient applications.

## Prerequisites

- Node.js 18+
- `@pump-fun/pump-sdk` installed

```bash
npm install @pump-fun/pump-sdk @solana/web3.js bn.js
```

## SDK Error Types

The Pump SDK throws typed errors for validation failures:

| Error | When It Throws |
|-------|---------------|
| `NoShareholdersError` | Empty shareholders array |
| `TooManyShareholdersError` | More than 10 shareholders |
| `ZeroShareError` | A shareholder has 0 or negative BPS |
| `InvalidShareTotalError` | Shares don't total exactly 10,000 BPS |
| `DuplicateShareholderError` | Same address appears twice |
| `ShareCalculationOverflowError` | Math overflow in share calculation |
| `PoolRequiredForGraduatedError` | Missing pool for graduated token |
| `VanityError` | Invalid prefix/suffix for vanity generation |

## Step 1: Fee Sharing Validation

Fee sharing has the strictest validation — catch errors before they hit the chain:

```typescript
import { PUMP_SDK } from "@pump-fun/pump-sdk";
import {
  NoShareholdersError,
  TooManyShareholdersError,
  ZeroShareError,
  InvalidShareTotalError,
  DuplicateShareholderError,
  PoolRequiredForGraduatedError,
} from "@pump-fun/pump-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";

const creator = Keypair.generate();
const mint = Keypair.generate();

// ❌ ERROR: No shareholders
try {
  await PUMP_SDK.updateFeeShares({
    authority: creator.publicKey,
    mint: mint.publicKey,
    currentShareholders: [],
    newShareholders: [], // Empty!
  });
} catch (err) {
  if (err instanceof NoShareholdersError) {
    console.log("Need at least 1 shareholder");
  }
}

// ❌ ERROR: Too many shareholders (max 10)
try {
  const tooMany = Array.from({ length: 11 }, (_, i) => ({
    address: Keypair.generate().publicKey,
    shareBps: 909, // 11 × 909 = 9,999 (also wrong total)
  }));

  await PUMP_SDK.updateFeeShares({
    authority: creator.publicKey,
    mint: mint.publicKey,
    currentShareholders: [],
    newShareholders: tooMany,
  });
} catch (err) {
  if (err instanceof TooManyShareholdersError) {
    console.log(`Max ${err.max} shareholders, got ${err.count}`);
  }
}

// ❌ ERROR: Zero share
try {
  await PUMP_SDK.updateFeeShares({
    authority: creator.publicKey,
    mint: mint.publicKey,
    currentShareholders: [],
    newShareholders: [
      { address: creator.publicKey, shareBps: 10000 },
      { address: Keypair.generate().publicKey, shareBps: 0 }, // Zero!
    ],
  });
} catch (err) {
  if (err instanceof ZeroShareError) {
    console.log(`Zero share for: ${err.address}`);
  }
}

// ❌ ERROR: Shares don't total 10,000
try {
  await PUMP_SDK.updateFeeShares({
    authority: creator.publicKey,
    mint: mint.publicKey,
    currentShareholders: [],
    newShareholders: [
      { address: creator.publicKey, shareBps: 5000 },
      { address: Keypair.generate().publicKey, shareBps: 3000 }, // 8000 ≠ 10000
    ],
  });
} catch (err) {
  if (err instanceof InvalidShareTotalError) {
    console.log(`Shares total ${err.total}, must be 10,000`);
  }
}

// ❌ ERROR: Duplicate address
try {
  await PUMP_SDK.updateFeeShares({
    authority: creator.publicKey,
    mint: mint.publicKey,
    currentShareholders: [],
    newShareholders: [
      { address: creator.publicKey, shareBps: 5000 },
      { address: creator.publicKey, shareBps: 5000 }, // Duplicate!
    ],
  });
} catch (err) {
  if (err instanceof DuplicateShareholderError) {
    console.log("Each shareholder must have a unique address");
  }
}
```

## Step 2: Validate Before Submitting

Build a pre-validation helper:

```typescript
interface Shareholder {
  address: PublicKey;
  shareBps: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateShareholders(shareholders: Shareholder[]): ValidationResult {
  const errors: string[] = [];

  if (shareholders.length === 0) {
    errors.push("At least 1 shareholder required");
  }

  if (shareholders.length > 10) {
    errors.push(`Maximum 10 shareholders, got ${shareholders.length}`);
  }

  const addresses = new Set<string>();
  let total = 0;

  for (const s of shareholders) {
    if (s.shareBps <= 0) {
      errors.push(`Zero/negative share for ${s.address.toBase58()}`);
    }
    total += s.shareBps;

    const addr = s.address.toBase58();
    if (addresses.has(addr)) {
      errors.push(`Duplicate address: ${addr}`);
    }
    addresses.add(addr);
  }

  if (total !== 10_000 && shareholders.length > 0) {
    errors.push(`Shares total ${total}, must be 10,000 (100%)`);
  }

  return { valid: errors.length === 0, errors };
}

// Usage
const result = validateShareholders([
  { address: creator.publicKey, shareBps: 7000 },
  { address: Keypair.generate().publicKey, shareBps: 3000 },
]);

if (result.valid) {
  console.log("Configuration is valid");
} else {
  console.log("Errors:", result.errors);
}
```

## Step 3: Handle Graduated Token Errors

```typescript
// ❌ ERROR: Pool required for graduated token
try {
  const bc = await onlineSdk.fetchBondingCurve(mint.publicKey);

  if (bc.complete) {
    // Must provide pool parameter for graduated tokens
    await PUMP_SDK.createFeeSharingConfig({
      creator: creator.publicKey,
      mint: mint.publicKey,
      pool: null, // Wrong! Need the pool address
    });
  }
} catch (err) {
  if (err instanceof PoolRequiredForGraduatedError) {
    console.log("Graduated tokens require a pool address");
    // Fix: fetch the pool and pass it
    const pool = await onlineSdk.fetchPool(mint.publicKey);
    // Retry with pool address
  }
}
```

## Step 4: Transaction Error Handling

Handle Solana transaction-level errors:

```typescript
import {
  Connection,
  TransactionMessage,
  VersionedTransaction,
  SendTransactionError,
} from "@solana/web3.js";

async function sendWithRetry(
  connection: Connection,
  tx: VersionedTransaction,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sig = await connection.sendTransaction(tx, {
        skipPreflight: false,
        maxRetries: 2,
      });

      // Wait for confirmation
      const result = await connection.confirmTransaction(sig, "confirmed");

      if (result.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
      }

      return sig;
    } catch (err: any) {
      lastError = err;

      if (err instanceof SendTransactionError) {
        const logs = err.logs;
        console.error(`Attempt ${attempt} failed:`);

        // Parse common on-chain errors
        if (logs?.some((l: string) => l.includes("insufficient funds"))) {
          throw new Error("Insufficient SOL balance");
        }
        if (logs?.some((l: string) => l.includes("SlippageExceeded"))) {
          throw new Error("Slippage tolerance exceeded — price moved too much");
        }
        if (logs?.some((l: string) => l.includes("BondingCurveComplete"))) {
          throw new Error("Token has graduated — use AMM trading");
        }
        if (logs?.some((l: string) => l.includes("AccountNotFound"))) {
          throw new Error("Account not found — token may not exist");
        }
      }

      // Retry on transient errors
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error("Transaction failed after all retries");
}
```

## Step 5: RPC Error Handling

```typescript
async function safeFetchBondingCurve(mint: PublicKey) {
  try {
    return await onlineSdk.fetchBondingCurve(mint);
  } catch (err: any) {
    if (err.message?.includes("Account does not exist")) {
      throw new Error(`Token ${mint.toBase58()} not found — it may not exist on Pump`);
    }
    if (err.message?.includes("429")) {
      throw new Error("RPC rate limited — try again in a few seconds");
    }
    if (err.message?.includes("timeout")) {
      throw new Error("RPC timeout — network may be congested");
    }
    throw err;
  }
}
```

## Step 6: Vanity Generator Errors

```typescript
import { VanityError, VanityErrorType } from "@pump-fun/pump-sdk";

try {
  // Invalid prefix containing '0' (not in Base58)
  generateVanityAddress({ prefix: "0xDead" });
} catch (err) {
  if (err instanceof VanityError) {
    switch (err.type) {
      case VanityErrorType.InvalidPrefix:
        console.log("Prefix contains non-Base58 characters (avoid 0, O, I, l)");
        break;
      case VanityErrorType.InvalidSuffix:
        console.log("Suffix contains non-Base58 characters");
        break;
      case VanityErrorType.Cancelled:
        console.log("Generation was cancelled");
        break;
      case VanityErrorType.GenerationFailed:
        console.log("Generation failed unexpectedly");
        break;
    }
  }
}
```

## Step 7: Comprehensive Error Handler

```typescript
function handlePumpError(err: unknown): string {
  if (err instanceof NoShareholdersError) {
    return "Please add at least one shareholder";
  }
  if (err instanceof TooManyShareholdersError) {
    return `Too many shareholders (max ${err.max})`;
  }
  if (err instanceof ZeroShareError) {
    return `Shareholder ${err.address} must have a positive share`;
  }
  if (err instanceof InvalidShareTotalError) {
    return `Shares total ${err.total} bps — must be exactly 10,000 (100%)`;
  }
  if (err instanceof DuplicateShareholderError) {
    return "Remove duplicate shareholder addresses";
  }
  if (err instanceof PoolRequiredForGraduatedError) {
    return "This token has graduated — provide the AMM pool address";
  }
  if (err instanceof VanityError) {
    return `Vanity generation error: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred";
}

// Usage in a try/catch
try {
  await PUMP_SDK.updateFeeShares({ /* ... */ });
} catch (err) {
  const message = handlePumpError(err);
  console.error("Error:", message);
  // Show to user in UI, log to monitoring, etc.
}
```

## Common Pitfalls

| Mistake | Fix |
|---------|-----|
| Using JavaScript `number` for amounts | Use `BN` from bn.js |
| Forgetting slippage on buys/sells | Always set `slippageBps` (e.g., 500 = 5%) |
| Not checking `bc.complete` before trading | Check graduation status first |
| Passing `null` pool for graduated tokens | Fetch pool with `fetchPool()` |
| Shares not totaling 10,000 BPS | Use the validation helper above |
| Not re-fetching state before trades | Bonding curve state changes every trade |

## Next Steps

- See [Tutorial 07](./07-fee-sharing.md) for fee sharing setup
- See [Tutorial 24](./24-cross-program-trading.md) for handling graduated tokens
- See [Tutorial 28](./28-analytics-price-quotes.md) for analytics that avoid these errors
