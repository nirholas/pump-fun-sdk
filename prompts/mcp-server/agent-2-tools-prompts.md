# Agent 2: MCP Tools & Prompts Implementation

## Role
You are a Claude Opus 4.5 agent responsible for implementing all MCP tools and prompts. These are the primary interaction points that AI assistants will use to perform Solana wallet operations.

## Context
Agent 1 has created the server core with handler stubs. You will implement the actual tool logic and prompt templates. The tools must use ONLY official Solana libraries (@solana/web3.js).

## Dependencies
```typescript
// You can ONLY use these for cryptographic operations:
import { Keypair, PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl'; // Bundled with @solana/web3.js
import bs58 from 'bs58'; // Bundled with @solana/web3.js
```

---

## Your Deliverables

### 1. Tool Index
**src/tools/index.ts**:
```typescript
import { ServerState, ToolResult } from '../types/index.js';
import { generateKeypair } from './generate.js';
import { generateVanity } from './vanity.js';
import { signMessage } from './sign.js';
import { verifySignature } from './verify.js';
import { validateAddress } from './validate.js';
import { estimateVanityTime } from './estimate.js';
import { restoreKeypair } from './restore.js';

type ToolHandler = (
  args: Record<string, unknown>,
  state: ServerState
) => Promise<ToolResult>;

const toolHandlers: Record<string, ToolHandler> = {
  generate_keypair: generateKeypair,
  generate_vanity: generateVanity,
  sign_message: signMessage,
  verify_signature: verifySignature,
  validate_address: validateAddress,
  estimate_vanity_time: estimateVanityTime,
  restore_keypair: restoreKeypair,
};

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  state: ServerState
): Promise<ToolResult> {
  const handler = toolHandlers[name];
  
  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  return handler(args, state);
}
```

### 2. Generate Keypair Tool
**src/tools/generate.ts**:
```typescript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ServerState, ToolResult } from '../types/index.js';
import { z } from 'zod';

const GenerateSchema = z.object({
  saveId: z.string().optional(),
});

export async function generateKeypair(
  args: Record<string, unknown>,
  state: ServerState
): Promise<ToolResult> {
  const parsed = GenerateSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { saveId } = parsed.data;

  // Generate using official Solana library
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const secretKeyBase58 = bs58.encode(keypair.secretKey);

  // Optionally save for later reference
  if (saveId) {
    state.generatedKeypairs.set(saveId, {
      publicKey,
      secretKey: keypair.secretKey.slice(), // Copy the array
    });
  }

  const result = {
    publicKey,
    secretKey: secretKeyBase58,
    keypairArray: JSON.stringify(Array.from(keypair.secretKey)),
  };

  // Include saveId in response if provided
  const responseText = saveId
    ? `Generated keypair (saved as "${saveId}"):\n\nPublic Key: ${publicKey}\n\nSecret Key (Base58): ${secretKeyBase58}\n\n⚠️ SECURITY WARNING: Store the secret key securely and NEVER share it.`
    : `Generated keypair:\n\nPublic Key: ${publicKey}\n\nSecret Key (Base58): ${secretKeyBase58}\n\nKeypair Array (for Solana CLI):\n${result.keypairArray}\n\n⚠️ SECURITY WARNING: Store the secret key securely and NEVER share it.`;

  return {
    content: [{ type: 'text', text: responseText }],
  };
}
```

### 3. Vanity Address Generator
**src/tools/vanity.ts**:
```typescript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ServerState, ToolResult } from '../types/index.js';
import { z } from 'zod';
import { PrefixSchema, SuffixSchema } from '../utils/validation.js';

const VanitySchema = z.object({
  prefix: PrefixSchema.optional(),
  suffix: SuffixSchema.optional(),
  caseInsensitive: z.boolean().default(false),
  timeout: z.number().min(1).max(300).default(60),
  saveId: z.string().optional(),
}).refine(
  (data) => data.prefix || data.suffix,
  { message: 'At least one of prefix or suffix must be specified' }
);

export async function generateVanity(
  args: Record<string, unknown>,
  state: ServerState
): Promise<ToolResult> {
  const parsed = VanitySchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { prefix, suffix, caseInsensitive, timeout, saveId } = parsed.data;
  
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  let attempts = 0;

  const matchPrefix = prefix
    ? caseInsensitive
      ? prefix.toLowerCase()
      : prefix
    : null;
  const matchSuffix = suffix
    ? caseInsensitive
      ? suffix.toLowerCase()
      : suffix
    : null;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const checkAddress = caseInsensitive ? address.toLowerCase() : address;

    const prefixMatch = !matchPrefix || checkAddress.startsWith(matchPrefix);
    const suffixMatch = !matchSuffix || checkAddress.endsWith(matchSuffix);

    if (prefixMatch && suffixMatch) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const secretKeyBase58 = bs58.encode(keypair.secretKey);

      if (saveId) {
        state.generatedKeypairs.set(saveId, {
          publicKey: address,
          secretKey: keypair.secretKey.slice(),
        });
      }

      const pattern = [
        prefix ? `prefix "${prefix}"` : null,
        suffix ? `suffix "${suffix}"` : null,
      ]
        .filter(Boolean)
        .join(' and ');

      return {
        content: [
          {
            type: 'text',
            text: `✅ Found vanity address with ${pattern}!\n\nPublic Key: ${address}\n\nSecret Key (Base58): ${secretKeyBase58}\n\nAttempts: ${attempts.toLocaleString()}\nTime: ${elapsed}s\nRate: ${Math.round(attempts / parseFloat(elapsed)).toLocaleString()} keys/sec\n\n⚠️ SECURITY WARNING: Store the secret key securely and NEVER share it.`,
          },
        ],
      };
    }

    // Yield control periodically to prevent blocking
    if (attempts % 10000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  return {
    content: [
      {
        type: 'text',
        text: `⏱️ Timeout after ${elapsed}s (${attempts.toLocaleString()} attempts)\n\nPattern not found. Try:\n- A shorter prefix/suffix\n- Case-insensitive matching\n- A longer timeout`,
      },
    ],
    isError: false, // Not an error, just didn't find a match
  };
}
```

### 4. Sign Message Tool
**src/tools/sign.ts**:
```typescript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { ServerState, ToolResult } from '../types/index.js';
import { z } from 'zod';

const SignSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  keypairId: z.string().optional(),
  privateKey: z.string().optional(),
}).refine(
  (data) => data.keypairId || data.privateKey,
  { message: 'Either keypairId or privateKey must be provided' }
);

export async function signMessage(
  args: Record<string, unknown>,
  state: ServerState
): Promise<ToolResult> {
  const parsed = SignSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { message, keypairId, privateKey } = parsed.data;

  let secretKey: Uint8Array;
  let publicKeyStr: string;

  try {
    if (keypairId) {
      const stored = state.generatedKeypairs.get(keypairId);
      if (!stored) {
        return {
          content: [{ type: 'text', text: `Keypair "${keypairId}" not found. Generate one first or provide a privateKey.` }],
          isError: true,
        };
      }
      secretKey = stored.secretKey;
      publicKeyStr = stored.publicKey;
    } else if (privateKey) {
      const decoded = bs58.decode(privateKey);
      if (decoded.length !== 64) {
        return {
          content: [{ type: 'text', text: 'Invalid private key length. Expected 64 bytes (Base58 encoded).' }],
          isError: true,
        };
      }
      secretKey = decoded;
      const keypair = Keypair.fromSecretKey(secretKey);
      publicKeyStr = keypair.publicKey.toBase58();
    } else {
      return {
        content: [{ type: 'text', text: 'No keypair provided' }],
        isError: true,
      };
    }

    // Sign the message using nacl (from @solana/web3.js)
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, secretKey);
    const signatureBase58 = bs58.encode(signature);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Message signed successfully!\n\nPublic Key: ${publicKeyStr}\n\nMessage: "${message}"\n\nSignature (Base58): ${signatureBase58}\n\nTo verify, use the verify_signature tool with:\n- message: "${message}"\n- signature: "${signatureBase58}"\n- publicKey: "${publicKeyStr}"`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}
```

### 5. Verify Signature Tool
**src/tools/verify.ts**:
```typescript
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { ServerState, ToolResult } from '../types/index.js';
import { z } from 'zod';
import { SolanaAddressSchema } from '../utils/validation.js';

const VerifySchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  publicKey: SolanaAddressSchema,
});

export async function verifySignature(
  args: Record<string, unknown>,
  state: ServerState
): Promise<ToolResult> {
  const parsed = VerifySchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { message, signature, publicKey } = parsed.data;

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const pubKeyObj = new PublicKey(publicKey);
    const pubKeyBytes = pubKeyObj.toBytes();

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubKeyBytes
    );

    if (isValid) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Signature is VALID!\n\nPublic Key: ${publicKey}\nMessage: "${message}"\nSignature: ${signature.substring(0, 20)}...`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Signature is INVALID!\n\nThe signature does not match the message and public key.\n\nPossible causes:\n- Wrong public key\n- Message was modified\n- Signature is corrupted`,
          },
        ],
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}
```

### 6. Validate Address Tool
**src/tools/validate.ts**:
```typescript
import { PublicKey } from '@solana/web3.js';
import { ServerState, ToolResult } from '../types/index.js';
import { z } from 'zod';

const ValidateSchema = z.object({
  address: z.string().min(1),
});

export async function validateAddress(
  args: Record<string, unknown>,
  state: ServerState
): Promise<ToolResult> {
  const parsed = ValidateSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { address } = parsed.data;

  // Check length first
  if (address.length < 32 || address.length > 44) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Invalid address: Wrong length (${address.length} characters)\n\nSolana addresses are typically 32-44 characters.`,
        },
      ],
    };
  }

  // Check for invalid Base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(address)) {
    const invalidChars = address
      .split('')
      .filter((c) => !base58Regex.test(c))
      .filter((v, i, a) => a.indexOf(v) === i);
    return {
      content: [
        {
          type: 'text',
          text: `❌ Invalid address: Contains invalid characters: ${invalidChars.join(', ')}\n\nBase58 does not include: 0, O, I, l`,
        },
      ],
    };
  }

  try {
    // Use Solana's PublicKey to validate
    const pubKey = new PublicKey(address);
    const isOnCurve = PublicKey.isOnCurve(pubKey.toBytes());

    return {
      content: [
        {
          type: 'text',
          text: `✅ Valid Solana address!\n\nAddress: ${address}\nLength: ${address.length} characters\nOn Ed25519 curve: ${isOnCurve ? 'Yes (standard keypair)' : 'No (PDA or special address)'}\n\n${
            isOnCurve
              ? 'This appears to be a standard wallet address.'
              : 'This appears to be a Program Derived Address (PDA) or system address.'
          }`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Invalid address: ${error instanceof Error ? error.message : 'Failed to parse as Solana public key'}`,
        },
      ],
    };
  }
}
```

### 7. Estimate Vanity Time Tool
**src/tools/estimate.ts**:
```typescript
import { ServerState, ToolResult } from '../types/index.js';
import { z } from 'zod';
import { PrefixSchema, SuffixSchema } from '../utils/validation.js';

const EstimateSchema = z.object({
  prefix: PrefixSchema.optional(),
  suffix: SuffixSchema.optional(),
  caseInsensitive: z.boolean().default(false),
});

// Base58 alphabet size
const BASE58_SIZE = 58;
const CASE_INSENSITIVE_SIZE = 34; // Only unique chars when case-folded

export async function estimateVanityTime(
  args: Record<string, unknown>,
  state: ServerState
): Promise<ToolResult> {
  const parsed = EstimateSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { prefix, suffix, caseInsensitive } = parsed.data;

  if (!prefix && !suffix) {
    return {
      content: [{ type: 'text', text: 'Specify at least one of prefix or suffix' }],
      isError: true,
    };
  }

  const alphabetSize = caseInsensitive ? CASE_INSENSITIVE_SIZE : BASE58_SIZE;
  const prefixLen = prefix?.length || 0;
  const suffixLen = suffix?.length || 0;

  // Calculate probability
  // For prefix: 1/58^n (or 1/34^n for case-insensitive)
  // For suffix: same
  // Combined: multiply the probabilities
  const prefixProbability = prefixLen > 0 ? Math.pow(alphabetSize, prefixLen) : 1;
  const suffixProbability = suffixLen > 0 ? Math.pow(alphabetSize, suffixLen) : 1;
  const totalAttempts = prefixProbability * suffixProbability;

  // Estimate keys per second (conservative for single-threaded JS)
  const keysPerSecond = 15000; // ~15k keys/sec in Node.js
  const estimatedSeconds = totalAttempts / keysPerSecond;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)} minutes`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hours`;
    if (seconds < 31536000) return `${(seconds / 86400).toFixed(1)} days`;
    return `${(seconds / 31536000).toFixed(1)} years`;
  };

  const patternDesc = [
    prefix ? `prefix "${prefix}" (${prefixLen} chars)` : null,
    suffix ? `suffix "${suffix}" (${suffixLen} chars)` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  const difficultyTable = `
| Length | Case-Sensitive | Case-Insensitive |
|--------|----------------|------------------|
| 1 char | ~58 attempts | ~34 attempts |
| 2 char | ~3,364 attempts | ~1,156 attempts |
| 3 char | ~195,112 attempts | ~39,304 attempts |
| 4 char | ~11.3M attempts | ~1.3M attempts |
| 5 char | ~656M attempts | ~45M attempts |
| 6 char | ~38B attempts | ~1.5B attempts |
`;

  return {
    content: [
      {
        type: 'text',
        text: `📊 Vanity Address Estimation\n\nPattern: ${patternDesc}\nCase-insensitive: ${caseInsensitive}\n\n**Expected attempts:** ${totalAttempts.toLocaleString()}\n**Estimated time:** ${formatTime(estimatedSeconds)} (at ~${keysPerSecond.toLocaleString()} keys/sec)\n\n${difficultyTable}\n\n💡 Tips:\n- Each additional character makes it ~58x harder\n- Case-insensitive matching is ~1.7x faster per character\n- The Rust implementation is ~10x faster than TypeScript`,
      },
    ],
  };
}
```

### 8. Restore Keypair Tool
**src/tools/restore.ts**:
```typescript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ServerState, ToolResult } from '../types/index.js';
import { z } from 'zod';

const RestoreSchema = z.object({
  seedPhrase: z.string().optional(),
  privateKey: z.string().optional(),
  saveId: z.string().optional(),
}).refine(
  (data) => data.seedPhrase || data.privateKey,
  { message: 'Either seedPhrase or privateKey must be provided' }
);

export async function restoreKeypair(
  args: Record<string, unknown>,
  state: ServerState
): Promise<ToolResult> {
  const parsed = RestoreSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { seedPhrase, privateKey, saveId } = parsed.data;

  try {
    let keypair: Keypair;

    if (privateKey) {
      // Restore from Base58-encoded private key
      const decoded = bs58.decode(privateKey);
      if (decoded.length !== 64) {
        return {
          content: [
            {
              type: 'text',
              text: `Invalid private key: Expected 64 bytes, got ${decoded.length}`,
            },
          ],
          isError: true,
        };
      }
      keypair = Keypair.fromSecretKey(decoded);
    } else if (seedPhrase) {
      // Note: @solana/web3.js doesn't have built-in BIP39 support
      // We'd need an additional library for seed phrase recovery
      // For security, we recommend using the official Solana CLI for seed phrases
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ Seed phrase recovery is not supported in this MCP server.\n\nFor security reasons, seed phrase recovery should be done using the official Solana CLI:\n\n\`\`\`bash\nsolana-keygen recover -o wallet.json\n\`\`\`\n\nOr provide the Base58-encoded private key directly.`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: 'text', text: 'No recovery method provided' }],
        isError: true,
      };
    }

    const publicKey = keypair.publicKey.toBase58();

    if (saveId) {
      state.generatedKeypairs.set(saveId, {
        publicKey,
        secretKey: keypair.secretKey.slice(),
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Keypair restored successfully!\n\nPublic Key: ${publicKey}\n\n${saveId ? `Saved as "${saveId}" for later use.` : 'Use saveId parameter to save for later reference.'}\n\n⚠️ The private key was verified but is not displayed for security.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}
```

---

### 9. Prompts Implementation

**src/prompts/index.ts**:
```typescript
import { ServerState, PromptResult } from '../types/index.js';
import { getCreateWalletPrompt } from './create-wallet.js';
import { getSecurityAuditPrompt } from './security.js';
import { getBatchGeneratePrompt } from './batch.js';

type PromptHandler = (
  args: Record<string, unknown>,
  state: ServerState
) => Promise<PromptResult>;

const promptHandlers: Record<string, PromptHandler> = {
  create_wallet: getCreateWalletPrompt,
  security_audit: getSecurityAuditPrompt,
  batch_generate: getBatchGeneratePrompt,
};

export async function handleGetPrompt(
  name: string,
  args: Record<string, unknown>,
  state: ServerState
): Promise<PromptResult> {
  const handler = promptHandlers[name];

  if (!handler) {
    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: `Unknown prompt: ${name}` },
        },
      ],
    };
  }

  return handler(args, state);
}
```

**src/prompts/create-wallet.ts**:
```typescript
import { ServerState, PromptResult } from '../types/index.js';
import { z } from 'zod';

const ArgsSchema = z.object({
  type: z.enum(['standard', 'vanity']).optional().default('standard'),
});

export async function getCreateWalletPrompt(
  args: Record<string, unknown>,
  state: ServerState
): Promise<PromptResult> {
  const parsed = ArgsSchema.safeParse(args);
  const type = parsed.success ? parsed.data.type : 'standard';

  if (type === 'vanity') {
    return {
      description: 'Create a new Solana vanity wallet with a custom address',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I want to create a new Solana vanity wallet.

Please help me:
1. First, ask what prefix or suffix I want for my address
2. Estimate how long it will take using the estimate_vanity_time tool
3. If the estimate is reasonable, generate the vanity address using generate_vanity
4. Show me the public key and explain how to securely store the private key
5. Remind me about security best practices

Important security notes:
- Never share the private key
- Store it in a secure location
- Consider using a hardware wallet for large amounts`,
          },
        },
      ],
    };
  }

  return {
    description: 'Create a new Solana wallet',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I want to create a new Solana wallet.

Please help me:
1. Generate a new keypair using the generate_keypair tool
2. Explain what the public key and private key are
3. Tell me how to securely store my private key
4. Explain how to import this wallet into Phantom, Solflare, or Solana CLI

Important: After generating, remind me to:
- Write down or securely store the private key
- Never share the private key with anyone
- Consider using a hardware wallet for large amounts`,
        },
      },
    ],
  };
}
```

**src/prompts/security.ts**:
```typescript
import { ServerState, PromptResult } from '../types/index.js';

export async function getSecurityAuditPrompt(
  args: Record<string, unknown>,
  state: ServerState
): Promise<PromptResult> {
  const keypairCount = state.generatedKeypairs.size;

  return {
    description: 'Security best practices for Solana wallet management',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please perform a security audit for my Solana wallet setup.

Current session state:
- Keypairs in memory: ${keypairCount}

Check and advise on:

## 1. Key Storage
- Am I storing private keys securely?
- Should I use a hardware wallet?
- Is my seed phrase backup secure?

## 2. Transaction Security
- How to verify transaction details before signing?
- What are common phishing attacks?
- How to identify malicious dApps?

## 3. Operational Security
- Is my computer/phone secure?
- Am I using secure network connections?
- Do I have 2FA enabled where possible?

## 4. Recovery Planning
- Do I have a backup of my seed phrase?
- Is my backup stored in a secure location?
- Have I tested recovery?

## 5. Session Security
${keypairCount > 0 ? `⚠️ You have ${keypairCount} keypair(s) in memory. These will be cleared when the MCP server stops.` : '✅ No keypairs currently in memory.'}

Please provide specific recommendations based on best practices.`,
        },
      },
    ],
  };
}
```

**src/prompts/batch.ts**:
```typescript
import { ServerState, PromptResult } from '../types/index.js';
import { z } from 'zod';

const ArgsSchema = z.object({
  count: z.coerce.number().int().min(1).max(100),
});

export async function getBatchGeneratePrompt(
  args: Record<string, unknown>,
  state: ServerState
): Promise<PromptResult> {
  const parsed = ArgsSchema.safeParse(args);
  
  if (!parsed.success) {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please specify a valid count (1-100) for batch generation.',
          },
        },
      ],
    };
  }

  const { count } = parsed.data;

  return {
    description: `Generate ${count} Solana keypairs`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please generate ${count} Solana keypairs for me.

Instructions:
1. Use the generate_keypair tool ${count} times
2. Save each with IDs like "keypair-1", "keypair-2", etc.
3. Create a summary table showing:
   - Keypair ID
   - Public Key
   - (Private keys should NOT be in the table)
4. After generating all, remind me to securely export and store the private keys
5. Warn that these keypairs are only in memory until the MCP server stops

Security reminder:
- Each keypair should be backed up separately
- Consider the security implications of generating multiple keys at once
- These are suitable for testing; use hardware wallets for production`,
        },
      },
    ],
  };
}
```

---

## Testing Your Implementation

```bash
# Test tool invocation
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate_keypair","arguments":{}}}' | node dist/index.js

# Test vanity generation
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_vanity","arguments":{"prefix":"a","timeout":10}}}' | node dist/index.js
```

---

## Success Criteria

1. ✅ All 7 tools implemented and working
2. ✅ All 3 prompts implemented
3. ✅ Input validation on all tools
4. ✅ Proper error handling
5. ✅ Uses ONLY @solana/web3.js for crypto
6. ✅ No private key logging

---

## Security Checklist

- [ ] Never log private keys
- [ ] Validate all inputs with Zod
- [ ] Use official Solana libraries only
- [ ] Clear sensitive data after use
- [ ] Warn users about key security
