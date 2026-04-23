# Breaking Fee Recipient Upgrade — Runnable Examples

> Examples for the **2026-04-28** breaking program upgrade. See [Tutorial 45](../../tutorials/45-breaking-fee-recipient-upgrade.md) for the full guide.

## Scripts

### `verify-accounts.ts` — CI-safe, no keypair needed

Runs entirely offline. Builds every affected instruction type and asserts exact account counts, positions, and mutability flags match the spec. Use this in your CI pipeline before the cutover.

```bash
npx ts-node pumpkit/examples/breaking-fee-recipient/verify-accounts.ts
```

Expected output — every line ✓:

```
Bonding curve buy (getBuyInstructionRaw):
  ✓  Total accounts = 18 (got 18)
  ✓  Index 16 = bonding-curve-v2
  ✓  Index 17 (last) = breaking fee recipient
  ✓  Index 17 is mutable
  ✓  Index 17 is not a signer
...
✓ All 30 checks passed. You are ready for the 2026-04-28 cutover.
```

---

### `devnet-buy-sell.ts` — end-to-end devnet confirmation

Sends a real buy + sell to the devnet programs. The devnet programs already accept the new accounts, so this proves your integration works end-to-end against the same bytecode that will be on mainnet.

```bash
# Get devnet SOL first if needed:
solana airdrop 2 <your-wallet-pubkey> --url devnet

# Run:
WALLET_SECRET_KEY=<base58-private-key> \
PUMP_TEST_MINT=<active-devnet-bonding-curve-mint> \
  npx ts-node pumpkit/examples/breaking-fee-recipient/devnet-buy-sell.ts
```

Optional env vars:

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | RPC endpoint |
| `SOL_AMOUNT` | `10000000` (0.01 SOL) | Lamports to spend on the buy |

---

## The 8 new fee recipients

These are the 8 pubkeys introduced by the upgrade (all equivalent — pick any one per transaction):

```
5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD
9M4giFFMxmFGXtc3feFzRai56WbBqehoSeRE5GK7gf7
GXPFM2caqTtQYC2cJ5yJRi9VDkpsYZXzYdwYpGnLmtDL
3BpXnfJaUTiwXnJNe7Ej1rcbzqTTQUvLShZaWazebsVR
5cjcW9wExnJJiqgLjq7DEG75Pm6JBgE1hNv4B2vHXUW6
EHAAiTxcdDwQ3U4bU6YcMsQGaekdzLS3B5SmYo46kJtL
5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD
A7hAgCzFw14fejgCp387JUJRMNyz4j89JKnhtKU8piqW
```

Exported from the SDK as:
```typescript
import { BREAKING_FEE_RECIPIENTS, pickBreakingFeeRecipient } from "@nirholas/pump-sdk";
```
