# Task 25: Agent Wallet & Key Management

## Context

You are working in the `pump-fun-sdk` repository. Task 24 introduces `AgentSigner` — an interface that abstracts signing. This task builds the concrete signers: local keypair, AWS KMS, Turnkey, and multisig (Squads). Agents need a way to hold keys safely so that a compromised strategy process cannot exfiltrate funds.

## Background

The SDK's security rules (from `CLAUDE.md`) are strict:
- ONLY official Solana Labs crypto (`@solana/web3.js`, `solana-sdk`, `solana-keygen`)
- Zeroize key material after use
- File permissions `0600` for keypairs
- No network calls for key generation

Agents in production use three patterns:
1. **Hot keypair on disk** — cheap, low-value bots
2. **Remote signer** (KMS / Turnkey / Fireblocks) — medium-value, audit trail required
3. **Multisig via Squads** — high-value or shared agent treasuries

## Objective

Create signer implementations conforming to the `AgentSigner` interface from `src/agent/executor.ts`.

## What to Create

### 1. `src/agent/signers/keypair.ts`

```typescript
export class KeypairSigner implements AgentSigner {
  readonly publicKey: PublicKey;
  private readonly keypair: Keypair;

  private constructor(keypair: Keypair) { this.keypair = keypair; this.publicKey = keypair.publicKey; }

  static fromFile(path: string): KeypairSigner;          // fs.statSync must show mode 0o600, else throw
  static fromBytes(secretKey: Uint8Array): KeypairSigner;
  static fromBase58(secret: string): KeypairSigner;

  async signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;

  zeroize(): void;   // fill keypair.secretKey with zeros, invalidate instance
}
```

- Refuse to load if `fs.statSync(path).mode & 0o077 !== 0` (world/group-readable)
- `zeroize()` must overwrite `keypair.secretKey` in place

### 2. `src/agent/signers/kms.ts`

```typescript
export interface KmsSignerConfig {
  kmsClient: unknown;  // @aws-sdk/client-kms KMSClient - keep dependency optional
  keyId: string;
  publicKey: PublicKey;  // pre-derived from KMS key (ed25519 public key)
}

export class KmsSigner implements AgentSigner {
  constructor(config: KmsSignerConfig);
  async signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;
}
```

- Use `Sign` command with `MessageType: 'DIGEST'` and signing algorithm `EDDSA`
- Attach signature to transaction via `tx.addSignature(publicKey, signatureBytes)`
- Declare `@aws-sdk/client-kms` as `peerDependenciesMeta.optional = true`

### 3. `src/agent/signers/turnkey.ts`

```typescript
export interface TurnkeySignerConfig {
  client: unknown;      // @turnkey/http TurnkeyClient
  organizationId: string;
  signWith: string;     // wallet address or private key id
  publicKey: PublicKey;
}

export class TurnkeySigner implements AgentSigner { /* ... */ }
```

- Use `activity.type = 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'`
- Encoding: `PAYLOAD_ENCODING_HEXADECIMAL`, hash function: `HASH_FUNCTION_NOT_APPLICABLE` (Solana signs the message directly)

### 4. `src/agent/signers/squads.ts`

```typescript
export class SquadsSigner implements AgentSigner {
  constructor(params: {
    multisigPda: PublicKey;
    member: AgentSigner;        // the executing member's signer
    connection: Connection;
    vaultIndex?: number;        // default 0
  });

  // Instead of signing directly, this wraps the original instructions
  // into a Squads vault_transaction_create + proposal_create + approval.
  async signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;

  // Manual flow for multisig review
  async proposeFromInstructions(ixs: TransactionInstruction[]): Promise<{ proposalPda: PublicKey; signature: string }>;
  async approve(proposalPda: PublicKey): Promise<string>;
  async execute(proposalPda: PublicKey): Promise<string>;
}
```

Reference: `@sqds/multisig` SDK. This is for treasuries where a single agent cannot unilaterally execute.

### 5. `src/agent/signers/index.ts`

```typescript
export { KeypairSigner } from './keypair';
export { KmsSigner, type KmsSignerConfig } from './kms';
export { TurnkeySigner, type TurnkeySignerConfig } from './turnkey';
export { SquadsSigner } from './squads';
```

### 6. Tests: `src/__tests__/agent-signers.test.ts`

- `KeypairSigner.fromFile` rejects world-readable file (use `fs.chmodSync(tmp, 0o644)` in test)
- `KeypairSigner.zeroize` overwrites the secret
- `KeypairSigner.signTransaction` produces a valid ed25519 signature verifiable against `publicKey`
- Mock KMS/Turnkey clients to verify signature is attached via `tx.addSignature`

### 7. Update `src/agent/index.ts`

Re-export: `export * from './signers';`

## Rules

- Peer dependencies (`@aws-sdk/client-kms`, `@turnkey/http`, `@sqds/multisig`) must be optional — the SDK must build without them
- Never log secret material, even at debug level
- `zeroize()` semantics: after calling, subsequent `signTransaction` must throw
- File-permission check is mandatory for `fromFile` — use `fs.constants.S_IRWXG | S_IRWXO`
- All signers must support VersionedTransaction (no legacy Transaction)

## Files to Read Before Starting

- `src/agent/executor.ts` (created in Task 24) — `AgentSigner` interface
- `src/index.ts` — barrel pattern
- `package.json` — peerDependencies + optional peer deps pattern
