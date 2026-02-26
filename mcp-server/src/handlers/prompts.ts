import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerState, PromptDefinition } from '../types/index.js';

// Prompt definitions - Agent 2 will implement these
export const PROMPTS: PromptDefinition[] = [
  {
    name: 'create_wallet',
    description: 'Guided workflow to create a new Solana wallet',
    arguments: [
      {
        name: 'type',
        description: 'Type of wallet: "standard" or "vanity"',
        required: false,
      },
    ],
  },
  {
    name: 'security_audit',
    description: 'Security best practices checklist for wallet management',
    arguments: [],
  },
  {
    name: 'batch_generate',
    description: 'Generate multiple keypairs at once',
    arguments: [
      {
        name: 'count',
        description: 'Number of keypairs to generate',
        required: true,
      },
    ],
  },
];

export function registerPromptHandlers(server: Server, state: ServerState): void {
  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async (_request, _extra) => {
    return {
      prompts: PROMPTS,
    };
  });

  // Get prompt content - Agent 2 will implement
  server.setRequestHandler(GetPromptRequestSchema, async (request, _extra) => {
    const { name, arguments: args } = request.params;

    const { handleGetPrompt } = await import('../prompts/index.js');
    const result = await handleGetPrompt(name, args || {}, state);
    // Return type that matches SDK expectations
    return {
      description: result.description,
      messages: result.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    };
  });
}
