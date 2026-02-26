import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
// Tool definitions - Agent 2 will implement these
export const TOOLS = [
    {
        name: 'generate_keypair',
        description: 'Generate a new Solana keypair',
        inputSchema: {
            type: 'object',
            properties: {
                saveId: {
                    type: 'string',
                    description: 'Optional ID to save the keypair for later reference',
                },
            },
            required: [],
        },
    },
    {
        name: 'generate_vanity',
        description: 'Generate a Solana vanity address with custom prefix/suffix',
        inputSchema: {
            type: 'object',
            properties: {
                prefix: {
                    type: 'string',
                    description: 'Desired address prefix (Base58 characters only)',
                },
                suffix: {
                    type: 'string',
                    description: 'Desired address suffix (Base58 characters only)',
                },
                caseInsensitive: {
                    type: 'boolean',
                    description: 'Whether to match case-insensitively',
                    default: false,
                },
                timeout: {
                    type: 'number',
                    description: 'Maximum time in seconds to search',
                    default: 60,
                },
            },
            required: [],
        },
    },
    {
        name: 'sign_message',
        description: 'Sign a message with a keypair',
        inputSchema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    description: 'The message to sign',
                },
                keypairId: {
                    type: 'string',
                    description: 'ID of a previously generated keypair',
                },
                privateKey: {
                    type: 'string',
                    description: 'Base58-encoded private key (alternative to keypairId)',
                },
            },
            required: ['message'],
        },
    },
    {
        name: 'verify_signature',
        description: 'Verify a message signature',
        inputSchema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    description: 'The original message',
                },
                signature: {
                    type: 'string',
                    description: 'Base58-encoded signature',
                },
                publicKey: {
                    type: 'string',
                    description: 'Base58-encoded public key',
                },
            },
            required: ['message', 'signature', 'publicKey'],
        },
    },
    {
        name: 'validate_address',
        description: 'Validate a Solana address format',
        inputSchema: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The Solana address to validate',
                },
            },
            required: ['address'],
        },
    },
    {
        name: 'estimate_vanity_time',
        description: 'Estimate time to find a vanity address',
        inputSchema: {
            type: 'object',
            properties: {
                prefix: {
                    type: 'string',
                    description: 'Desired prefix',
                },
                suffix: {
                    type: 'string',
                    description: 'Desired suffix',
                },
                caseInsensitive: {
                    type: 'boolean',
                    default: false,
                },
            },
            required: [],
        },
    },
    {
        name: 'restore_keypair',
        description: 'Restore a keypair from seed phrase or private key',
        inputSchema: {
            type: 'object',
            properties: {
                seedPhrase: {
                    type: 'string',
                    description: '12 or 24 word BIP39 seed phrase',
                },
                privateKey: {
                    type: 'string',
                    description: 'Base58-encoded private key',
                },
                saveId: {
                    type: 'string',
                    description: 'Optional ID to save the keypair',
                },
            },
            required: [],
        },
    },
];
export function registerToolHandlers(server, state) {
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async (_request, _extra) => {
        return {
            tools: TOOLS.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
            })),
        };
    });
    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request, _extra) => {
        const { name, arguments: args } = request.params;
        // Import tool implementations dynamically
        const { handleToolCall } = await import('../tools/index.js');
        try {
            const result = await handleToolCall(name, args || {}, state);
            return result;
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=tools.js.map