/**
 * Prompt implementations - Agent 2 will implement these
 * This file exports the handleGetPrompt function that returns prompt content
 */

import { ServerState, PromptResult } from '../types/index.js';

/**
 * Handle a get prompt request
 * @param name - The name of the prompt
 * @param args - The arguments passed to the prompt
 * @param state - The server state
 * @returns The prompt result with messages
 */
export async function handleGetPrompt(
  name: string,
  args: Record<string, unknown>,
  state: ServerState
): Promise<PromptResult> {
  switch (name) {
    case 'create_wallet':
      return handleCreateWalletPrompt(args, state);
    case 'security_audit':
      return handleSecurityAuditPrompt(state);
    case 'batch_generate':
      return handleBatchGeneratePrompt(args, state);
    default:
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Unknown prompt: ${name}`,
            },
          },
        ],
      };
  }
}

/**
 * Create wallet prompt - guides user through wallet creation
 */
async function handleCreateWalletPrompt(
  args: Record<string, unknown>,
  state: ServerState
): Promise<PromptResult> {
  const walletType = (args.type as string) || 'standard';

  if (walletType === 'vanity') {
    return {
      description: 'Create a vanity Solana wallet with a custom address prefix or suffix',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I want to create a vanity Solana wallet. Please help me:

1. First, explain what a vanity address is and the security considerations
2. Ask me what prefix or suffix I want (using Base58 characters only: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz)
3. Estimate how long it will take to find a matching address
4. Generate the vanity keypair when I confirm
5. Provide the public key and explain how to securely store the private key

IMPORTANT: Never display the private key in chat. Instead, explain secure storage options.`,
          },
        },
      ],
    };
  }

  return {
    description: 'Create a new standard Solana wallet',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I want to create a new Solana wallet. Please help me:

1. Generate a new keypair
2. Explain what the public key and private key are
3. Provide security best practices for storing the private key
4. Explain how I can use this wallet

IMPORTANT: Never display the private key in chat. Instead, explain secure storage options.`,
        },
      },
    ],
  };
}

/**
 * Security audit prompt - checklist for wallet security
 */
async function handleSecurityAuditPrompt(state: ServerState): Promise<PromptResult> {
  const keypairCount = state.generatedKeypairs.size;

  return {
    description: 'Security best practices checklist for Solana wallet management',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please perform a security audit of my wallet practices. Check the following:

## Current Session Status
- Generated keypairs in memory: ${keypairCount}

## Security Checklist
1. **Private Key Storage**: Am I storing private keys securely (hardware wallet, encrypted file)?
2. **Backup Strategy**: Do I have a secure backup of my seed phrase or private keys?
3. **Environment Security**: Am I generating keys on a secure, malware-free device?
4. **Network Security**: Am I using this toolkit offline or on a secure network?
5. **Key Lifecycle**: Are generated keys being properly cleared from memory when done?

Please ask me questions to assess my security posture and provide recommendations.`,
        },
      },
    ],
  };
}

/**
 * Batch generate prompt - generate multiple keypairs
 */
async function handleBatchGeneratePrompt(
  args: Record<string, unknown>,
  state: ServerState
): Promise<PromptResult> {
  const count = parseInt(String(args.count || '1'), 10);

  if (isNaN(count) || count < 1) {
    return {
      description: 'Generate multiple keypairs at once',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please specify a valid count (number) of keypairs to generate.',
          },
        },
      ],
    };
  }

  if (count > 100) {
    return {
      description: 'Generate multiple keypairs at once',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Warning: You requested ${count} keypairs. For security and performance reasons, the maximum is 100. Would you like to proceed with 100 keypairs instead?`,
          },
        },
      ],
    };
  }

  return {
    description: `Generate ${count} Solana keypairs`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I need to generate ${count} Solana keypairs. Please:

1. Generate ${count} keypairs using the generate_keypair tool
2. Save each with a unique ID (e.g., batch-1, batch-2, etc.)
3. Provide a summary with all public keys
4. Explain secure storage options for the private keys

IMPORTANT: 
- Never display private keys in chat
- Ensure all keypairs are securely stored
- Consider using the keypair IDs for later reference`,
        },
      },
    ],
  };
}
