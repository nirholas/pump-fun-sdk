# Tutorial 13: Vanity Mints and the `pump` Suffix

> Grind a vanity mint keypair with the SDK and launch a token whose address looks just like one created on pump.fun.

## Why `...pump`?

Every token launched through the pump.fun UI has a mint address ending in
`pump`. This is not enforced by the on-chain program — it's purely cosmetic.
Pump.fun's frontend grinds keypairs off-chain until one with the desired
suffix appears, then uses that as the mint for `createV2`.

You can do the exact same thing from your own code. The SDK ships a
first-class helper for it.

## The Two-Step Flow

1. **Grind a vanity mint keypair** — any keypair whose public key ends in
   `pump` (or starts with `dev`, or whatever you want).
2. **Pass the keypair's public key** as the `mint` parameter to
   `PUMP_SDK.createV2Instruction`, and sign the transaction with both the
   payer wallet and the mint keypair.

## Grinding a Vanity Mint

```typescript
import { generateVanityMint, estimateVanityMintAttempts } from "@nirholas/pump-sdk";

// How hard is this?
const expected = estimateVanityMintAttempts({ suffix: "pump" });
console.log(`Expected attempts: ~${expected.toLocaleString()}`); // ~11,316,496

// Grind it.
const { keypair, attempts, durationMs } = await generateVanityMint({
  suffix: "pump",
  onProgress: ({ attempts, attemptsPerSecond }) => {
    process.stdout.write(
      `\r${attempts.toLocaleString()} attempts | ${attemptsPerSecond.toFixed(0)}/sec`,
    );
  },
});

console.log(`\nFound: ${keypair.publicKey.toBase58()}`);
console.log(`  ${attempts.toLocaleString()} attempts in ${(durationMs / 1000).toFixed(1)}s`);
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `prefix` | `string` | Match at the start of the address. |
| `suffix` | `string` | Match at the end of the address. Use `"pump"` for the pump.fun convention. |
| `caseInsensitive` | `boolean` | Match case-insensitively. Reduces difficulty ~3×. |
| `maxAttempts` | `number` | Abort with `VanityMintMaxAttemptsError` after N tries. |
| `signal` | `AbortSignal` | Cancel an in-flight grind. |
| `onProgress` | `(p) => void` | Fired every ~5000 attempts. |

At least one of `prefix` or `suffix` is required. Both are limited to 6
characters and must use Base58 alphabet characters (no `0`, `O`, `I`, or `l`).

### Difficulty Table

Each additional character multiplies attempts by ~58.

| Pattern        | Expected Attempts | Time in Node (~50K/s) | Time in Rust (~150K/s) |
|----------------|------------------:|----------------------:|-----------------------:|
| 1 char         | 58                | instant               | instant                |
| 2 chars        | 3,364             | <1s                   | <1s                    |
| 3 chars        | 195,112           | ~4s                   | ~1s                    |
| 4 chars (`pump`) | 11,316,496      | ~4 min                | ~75s                   |
| 5 chars        | ~656M             | ~4 hours              | ~75 min                |
| 6 chars        | ~38B              | days                  | ~3 hours               |

For `pump` and shorter, Node is fine. For 5+ chars use the Rust generator
at [`rust/`](../rust/) — it's multi-threaded and ~3× faster per core.

## Creating the Token

Once you have the vanity keypair, the rest is a normal `createV2` flow. The
mint keypair **must sign the transaction** to prove ownership of the address.

```typescript
import {
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { PUMP_SDK, OnlinePumpSdk, generateVanityMint } from "@nirholas/pump-sdk";

async function createTokenWithPumpSuffix(payer: Keypair, connection: Connection) {
  // 1. Grind the mint.
  const { keypair: mintKeypair } = await generateVanityMint({ suffix: "pump" });

  // 2. Build the create instruction.
  const createIx = await PUMP_SDK.createV2Instruction({
    mint: mintKeypair.publicKey,
    name: "My Token",
    symbol: "MINE",
    uri: "https://example.com/metadata.json",
    creator: payer.publicKey,
    user: payer.publicKey,
    mayhemMode: false,
    cashback: false,
  });

  // 3. Sign with BOTH keys and submit.
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([payer, mintKeypair]);  // ← mint keypair must sign

  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  // 4. Verify.
  const online = new OnlinePumpSdk(connection);
  const bondingCurve = await online.fetchBondingCurve(mintKeypair.publicKey);
  console.log("Token created:", mintKeypair.publicKey.toBase58());
  console.log("Creator:", bondingCurve.creator.toBase58());

  return mintKeypair;
}
```

## Create and Buy In One Transaction

Drop the create instruction into `createV2AndBuyInstructions` if you want to
simultaneously seed the bonding curve with an initial buy.

```typescript
import BN from "bn.js";

const global = await online.fetchGlobal();
const ixs = await PUMP_SDK.createV2AndBuyInstructions({
  global,
  mint: mintKeypair.publicKey,
  name: "My Token",
  symbol: "MINE",
  uri: "https://example.com/metadata.json",
  creator: payer.publicKey,
  user: payer.publicKey,
  amount: new BN("10000000000"),   // 10 tokens (6 decimals)
  solAmount: new BN("100000000"),  // 0.1 SOL
  mayhemMode: false,
  cashback: false,
});
// Same signing pattern: tx.sign([payer, mintKeypair]);
```

## Cancellation and Timeouts

Long grinds should be cancellable. `AbortSignal` works with both manual
cancellation and `AbortSignal.timeout`:

```typescript
// Cancel after 2 minutes regardless of progress.
const result = await generateVanityMint({
  suffix: "pump",
  signal: AbortSignal.timeout(120_000),
}).catch((err) => {
  if (err.name === "AbortError") {
    console.log("Grind timed out — try a shorter pattern or the Rust generator.");
    return null;
  }
  throw err;
});
```

Or bail out after a fixed attempt budget:

```typescript
await generateVanityMint({
  suffix: "pump",
  maxAttempts: 50_000_000,
});
// → VanityMintMaxAttemptsError if no match is found
```

## When to Use the Rust Generator Instead

The in-SDK generator is single-threaded and runs in Node's event loop — fine
for `pump` and shorter, but it will saturate one core and can't use the
others. For production workflows, demos that need to be snappy, or patterns
of 5+ characters, use the Rust generator:

```bash
cd rust/
cargo build --release
./target/release/pump-vanity --suffix pump
```

It writes a `solana-keygen`-compatible JSON keypair, which you can load with
`Keypair.fromSecretKey(Buffer.from(JSON.parse(fs.readFileSync(path, 'utf8'))))`
and feed into `createV2Instruction` the same way.

## Verifying the Match On-Chain

After the create transaction confirms, the on-chain bonding curve account
will be a PDA derived from your vanity mint. The mint address itself is
what shows up in explorers and dexes — which is the whole point.

```typescript
const bondingCurve = await online.fetchBondingCurve(mintKeypair.publicKey);

console.log(mintKeypair.publicKey.toBase58().endsWith("pump")); // true
console.log(bondingCurve.creator.equals(payer.publicKey));       // true
console.log(bondingCurve.complete);                               // false — active
```

## Full Runnable Example

A devnet end-to-end script lives at
[tests/integration/test-vanity-mint-create.ts](../tests/integration/test-vanity-mint-create.ts).
Run it with a funded devnet wallet:

```bash
WALLET_SECRET_KEY=<base58-key> VANITY_SUFFIX=pump \
  npx ts-node tests/integration/test-vanity-mint-create.ts
```

Set `VANITY_SUFFIX=pu` to iterate faster while testing — 2 characters grinds
in under a second.

## Security Notes

- The SDK generator uses `@solana/web3.js`'s `Keypair.generate`, which wraps
  `crypto.randomBytes` (Node's OS-level CSPRNG). No third-party randomness.
- The generated `secretKey` is a normal 64-byte Ed25519 secret. Store it
  with the same care as any other wallet key — file mode `0600`, never
  committed to source control, never logged.
- Never use a vanity generator you don't trust. Any process that generates
  keypairs has access to them; a malicious generator can exfiltrate yours.
  The SDK code is auditable in [src/vanityMint.ts](../src/vanityMint.ts).

## What's Next?

- [Tutorial 1: Create Your First Token](./01-create-token.md) — the full create flow without vanity.
- [Tutorial 4: Create and Buy in One Transaction](./04-create-and-buy.md)
- [Tutorial 31: Rust Vanity Deep Dive](./31-rust-vanity-deep-dive.md) — for fast 5+ char patterns.
