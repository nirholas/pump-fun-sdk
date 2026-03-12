# Tutorial 4: Understanding PumpFun Events

> How the Pump protocol emits events and how PumpKit decodes them from transaction logs.

## Event Architecture

PumpFun programs emit events via **Anchor CPI self-invoke** — the program calls itself with a special `__event_authority` PDA, and the event data appears in `Program data:` log lines encoded as base64.

```
Transaction logs:
  Program pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ invoke [1]
  Program log: Instruction: ClaimSocialFeePda
  Program data: MhLBQe3S6uw...base64...
  Program pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ success
```

## Three Programs

| Program | ID | Events |
|---------|-----|--------|
| **Pump** | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Create, Trade, Complete |
| **PumpAMM** | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Swap, Deposit, Withdraw |
| **PumpFees** | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | SocialFeePdaClaimed, DistributeCreatorFees, CreateFeeSharingConfig |

## Event Discriminators

Every Anchor event starts with an 8-byte discriminator (first 8 bytes of `sha256("event:EventName")`). PumpKit uses hex-encoded discriminators to match events:

```typescript
// Fee claim events
const SOCIAL_FEE_PDA_CLAIMED = '3212c141edd2eaec';
const DISTRIBUTE_CREATOR_FEES = 'a537817004b3ca28';
const COLLECT_CREATOR_FEE     = '7a027f010ebf0caf';
const COLLECT_COIN_CREATOR_FEE = 'e8f5c2eeeada3a59';
const CLAIM_CASHBACK           = 'e2d6f62107f293e5';

// Config events
const CREATE_FEE_SHARING_CONFIG = '8569aac8b874fb58';
const UPDATE_FEE_SHARES         = '15bac4b85be4e1cb';

// Token lifecycle events
const CREATE_EVENT    = '1b72a94ddeeb9d47';
const CREATE_V2_EVENT = 'e6bac494664dd2fd';
const TRADE_EVENT     = 'bddb7fd34ee661ee';
const COMPLETE_EVENT  = 'bdc0b22f7bd533b4';
```

## Instruction Discriminators

PumpKit also matches instructions (not just events) to detect claim types:

```typescript
const CLAIM_INSTRUCTIONS = [
  { discriminator: 'e115fb85a11ec7e2', claimType: 'claim_social_fee_pda', programId: PUMP_FEE_PROGRAM_ID },
  { discriminator: 'f47b7f51bbc3f7e0', claimType: 'collect_creator_fee', programId: PUMP_PROGRAM_ID },
  { discriminator: '7a4980ff1b6ed39c', claimType: 'collect_coin_creator_fee', programId: PUMP_AMM_PROGRAM_ID },
  { discriminator: '46d98b6e3e6544c0', claimType: 'distribute_creator_fees', programId: PUMP_FEE_PROGRAM_ID },
  { discriminator: 'c2076f17a4d40d73', claimType: 'claim_cashback', programId: PUMP_FEE_PROGRAM_ID },
];
```

## SocialFeePdaClaimed Event Layout

The most complex event to parse:

```
Offset  Size  Field
0       8     Discriminator (3212c141edd2eaec)
8       8     Timestamp (i64 LE)
16      4     user_id length (u32 LE)
20      N     user_id (UTF-8 string, e.g. "12345678")
20+N    1     platform (u8: 0=pump, 1=twitter, 2=github)
21+N    32    social_fee_pda (pubkey)
53+N    32    recipient (pubkey)
85+N    32    social_claim_authority (pubkey)
117+N   8     amount_claimed (u64 LE)
125+N   8     claimable_before (u64 LE)
133+N   8     lifetime_claimed (u64 LE)
141+N   8     recipient_balance_before (u64 LE)
149+N   8     recipient_balance_after (u64 LE)
```

### Parsing Example

```typescript
function parseSocialFeeClaim(bytes: Buffer) {
    let offset = 16; // skip disc + timestamp

    // user_id: Borsh string (4-byte length prefix + UTF-8)
    const uidLen = bytes.readUInt32LE(offset);
    offset += 4;
    const userId = bytes.subarray(offset, offset + uidLen).toString('utf8');
    offset += uidLen;

    // platform: u8
    const platform = bytes[offset]!;
    offset += 1;

    // social_fee_pda: pubkey
    const socialFeePda = new PublicKey(bytes.subarray(offset, offset + 32)).toBase58();
    offset += 32;

    // recipient: pubkey
    const recipient = new PublicKey(bytes.subarray(offset, offset + 32)).toBase58();
    offset += 32;

    // skip social_claim_authority
    offset += 32;

    // amount_claimed: u64
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const amountLamports = Number(view.getBigUint64(offset, true));
    offset += 8;

    // skip claimable_before
    offset += 8;

    // lifetime_claimed: u64
    const lifetimeLamports = Number(view.getBigUint64(offset, true));

    return {
        userId,
        platform,       // 2 = GitHub
        socialFeePda,
        recipient,
        amountLamports,
        lifetimeLamports,
    };
}
```

## Monitoring Strategies

### WebSocket (Real-Time)

```typescript
connection.onLogs(
    new PublicKey(PUMP_FEE_PROGRAM_ID),
    (logInfo) => {
        for (const line of logInfo.logs) {
            if (line.includes('Program data:')) {
                const b64 = line.split('Program data: ')[1];
                const bytes = Buffer.from(b64, 'base64');
                const disc = bytes.subarray(0, 8).toString('hex');
                // Match discriminator and parse event...
            }
        }
    },
    'confirmed',
);
```

### HTTP Polling (Fallback)

```typescript
// Poll for recent signatures
const sigs = await connection.getSignaturesForAddress(
    new PublicKey(PUMP_FEE_PROGRAM_ID),
    { limit: 20 },
    'confirmed',
);

// Fetch and parse each transaction
for (const sig of sigs) {
    const tx = await connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
    });
    // Parse instructions and log events...
}
```

## Key Gotcha: Fake Claims

A `claim_social_fee_pda` instruction can be called without a matching `SocialFeePdaClaimed` event being emitted — this happens when the PDA has nothing to claim. PumpKit detects these as "fake claims" (amount = 0) and marks them with a ⚠️ badge.

## Next Steps

- [Tutorial 5: RPC Best Practices](./05-rpc-best-practices.md) — rate limits, fallback, batching
- See the [Official Pump IDL files](https://github.com/pump-fun/pump-public-docs) for complete instruction/event definitions
