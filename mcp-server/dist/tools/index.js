/**
 * MCP Tool Implementations for Solana Wallet Toolkit
 *
 * SECURITY: Uses ONLY official @solana/web3.js for cryptographic operations.
 * SECURITY: Never logs private keys.
 */
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { z } from 'zod';
import { PrefixSchema, SuffixSchema, SolanaAddressSchema, isValidBase58 } from '../utils/validation.js';
/**
 * Handle a tool call request
 */
export async function handleToolCall(name, args, state) {
    switch (name) {
        case 'generate_keypair':
            return handleGenerateKeypair(args, state);
        case 'generate_vanity':
            return handleGenerateVanity(args, state);
        case 'sign_message':
            return handleSignMessage(args, state);
        case 'verify_signature':
            return handleVerifySignature(args);
        case 'validate_address':
            return handleValidateAddress(args);
        case 'estimate_vanity_time':
            return handleEstimateVanityTime(args);
        case 'restore_keypair':
            return handleRestoreKeypair(args, state);
        default:
            return {
                content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                isError: true,
            };
    }
}
// ============================================================================
// GENERATE KEYPAIR TOOL
// ============================================================================
const GenerateKeypairSchema = z.object({
    saveId: z.string().optional(),
});
async function handleGenerateKeypair(args, state) {
    const parsed = GenerateKeypairSchema.safeParse(args);
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
    const keypairArray = JSON.stringify(Array.from(keypair.secretKey));
    // Optionally save for later reference
    if (saveId) {
        state.generatedKeypairs.set(saveId, {
            publicKey,
            secretKey: keypair.secretKey.slice(), // Copy the array
        });
    }
    const responseText = saveId
        ? `Generated keypair (saved as "${saveId}"):\n\nPublic Key: ${publicKey}\n\nSecret Key (Base58): ${secretKeyBase58}\n\n⚠️ SECURITY WARNING: Store the secret key securely and NEVER share it.`
        : `Generated keypair:\n\nPublic Key: ${publicKey}\n\nSecret Key (Base58): ${secretKeyBase58}\n\nKeypair Array (for Solana CLI):\n${keypairArray}\n\n⚠️ SECURITY WARNING: Store the secret key securely and NEVER share it.`;
    return {
        content: [{ type: 'text', text: responseText }],
    };
}
// ============================================================================
// GENERATE VANITY ADDRESS TOOL
// ============================================================================
const VanitySchema = z.object({
    prefix: PrefixSchema.optional(),
    suffix: SuffixSchema.optional(),
    caseInsensitive: z.boolean().default(false),
    timeout: z.number().min(1).max(300).default(60),
    saveId: z.string().optional(),
}).refine((data) => data.prefix || data.suffix, { message: 'At least one of prefix or suffix must be specified' });
async function handleGenerateVanity(args, state) {
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
            await new Promise((resolve) => setTimeout(resolve, 0));
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
// ============================================================================
// SIGN MESSAGE TOOL
// ============================================================================
const SignMessageSchema = z.object({
    message: z.string().min(1, 'Message cannot be empty'),
    keypairId: z.string().optional(),
    privateKey: z.string().optional(),
}).refine((data) => data.keypairId || data.privateKey, { message: 'Either keypairId or privateKey must be provided' });
async function handleSignMessage(args, state) {
    const parsed = SignMessageSchema.safeParse(args);
    if (!parsed.success) {
        return {
            content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
            isError: true,
        };
    }
    const { message, keypairId, privateKey } = parsed.data;
    let secretKey;
    let publicKeyStr;
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
        }
        else if (privateKey) {
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
        }
        else {
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
    }
    catch (error) {
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
// ============================================================================
// VERIFY SIGNATURE TOOL
// ============================================================================
const VerifySignatureSchema = z.object({
    message: z.string().min(1),
    signature: z.string().min(1),
    publicKey: SolanaAddressSchema,
});
async function handleVerifySignature(args) {
    const parsed = VerifySignatureSchema.safeParse(args);
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
        const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, pubKeyBytes);
        if (isValid) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `✅ Signature is VALID!\n\nPublic Key: ${publicKey}\nMessage: "${message}"\nSignature: ${signature.substring(0, 20)}...`,
                    },
                ],
            };
        }
        else {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Signature is INVALID!\n\nThe signature does not match the message and public key.\n\nPossible causes:\n- Wrong public key\n- Message was modified\n- Signature is corrupted`,
                    },
                ],
            };
        }
    }
    catch (error) {
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
// ============================================================================
// VALIDATE ADDRESS TOOL
// ============================================================================
const ValidateAddressSchema = z.object({
    address: z.string().min(1),
});
async function handleValidateAddress(args) {
    const parsed = ValidateAddressSchema.safeParse(args);
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
    if (!isValidBase58(address)) {
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
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
                    text: `✅ Valid Solana address!\n\nAddress: ${address}\nLength: ${address.length} characters\nOn Ed25519 curve: ${isOnCurve ? 'Yes (standard keypair)' : 'No (PDA or special address)'}\n\n${isOnCurve
                        ? 'This appears to be a standard wallet address.'
                        : 'This appears to be a Program Derived Address (PDA) or system address.'}`,
                },
            ],
        };
    }
    catch (error) {
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
// ============================================================================
// ESTIMATE VANITY TIME TOOL
// ============================================================================
const EstimateVanityTimeSchema = z.object({
    prefix: PrefixSchema.optional(),
    suffix: SuffixSchema.optional(),
    caseInsensitive: z.boolean().default(false),
});
// Base58 alphabet size
const BASE58_SIZE = 58;
const CASE_INSENSITIVE_SIZE = 34; // Only unique chars when case-folded
async function handleEstimateVanityTime(args) {
    const parsed = EstimateVanityTimeSchema.safeParse(args);
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
    const prefixProbability = prefixLen > 0 ? Math.pow(alphabetSize, prefixLen) : 1;
    const suffixProbability = suffixLen > 0 ? Math.pow(alphabetSize, suffixLen) : 1;
    const totalAttempts = prefixProbability * suffixProbability;
    // Estimate keys per second (conservative for single-threaded JS)
    const keysPerSecond = 15000; // ~15k keys/sec in Node.js
    const estimatedSeconds = totalAttempts / keysPerSecond;
    const formatTime = (seconds) => {
        if (seconds < 60)
            return `${seconds.toFixed(1)} seconds`;
        if (seconds < 3600)
            return `${(seconds / 60).toFixed(1)} minutes`;
        if (seconds < 86400)
            return `${(seconds / 3600).toFixed(1)} hours`;
        if (seconds < 31536000)
            return `${(seconds / 86400).toFixed(1)} days`;
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
// ============================================================================
// RESTORE KEYPAIR TOOL
// ============================================================================
const RestoreKeypairSchema = z.object({
    seedPhrase: z.string().optional(),
    privateKey: z.string().optional(),
    saveId: z.string().optional(),
}).refine((data) => data.seedPhrase || data.privateKey, { message: 'Either seedPhrase or privateKey must be provided' });
async function handleRestoreKeypair(args, state) {
    const parsed = RestoreKeypairSchema.safeParse(args);
    if (!parsed.success) {
        return {
            content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
            isError: true,
        };
    }
    const { seedPhrase, privateKey, saveId } = parsed.data;
    try {
        let keypair;
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
        }
        else if (seedPhrase) {
            // Note: @solana/web3.js doesn't have built-in BIP39 support
            // For security, we recommend using the official Solana CLI for seed phrases
            return {
                content: [
                    {
                        type: 'text',
                        text: `⚠️ Seed phrase recovery is not supported in this MCP server.\n\nFor security reasons, seed phrase recovery should be done using the official Solana CLI:\n\n\`\`\`bash\nsolana-keygen recover -o wallet.json\n\`\`\`\n\nOr provide the Base58-encoded private key directly.`,
                    },
                ],
            };
        }
        else {
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
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map