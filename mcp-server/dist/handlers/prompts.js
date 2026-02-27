import { ListPromptsRequestSchema, GetPromptRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
// Prompt definitions - Agent 2 will implement these
export const PROMPTS = [
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
    {
        name: 'launch_token',
        description: 'Step-by-step guided workflow to create and launch a new token on the Pump bonding curve, optionally buying initial supply',
        arguments: [
            {
                name: 'name',
                description: 'Token name',
                required: true,
            },
            {
                name: 'symbol',
                description: 'Token symbol (ticker)',
                required: true,
            },
            {
                name: 'buyAmount',
                description: 'SOL amount in lamports to buy during creation (optional, omit to create only)',
                required: false,
            },
        ],
    },
    {
        name: 'trade_token',
        description: 'Guided workflow for buying or selling a token on the Pump bonding curve with price quotes and slippage protection',
        arguments: [
            {
                name: 'action',
                description: 'Trade action: "buy" or "sell"',
                required: true,
            },
            {
                name: 'mint',
                description: 'Token mint address',
                required: true,
            },
            {
                name: 'amount',
                description: 'Amount in lamports (for buy) or tokens (for sell)',
                required: true,
            },
        ],
    },
    {
        name: 'setup_fee_sharing',
        description: 'Guided workflow to create a fee sharing config and add shareholders for a token',
        arguments: [
            {
                name: 'mint',
                description: 'Token mint address',
                required: true,
            },
        ],
    },
    {
        name: 'claim_rewards',
        description: 'Guided workflow to check and claim token incentive rewards and creator fees',
        arguments: [
            {
                name: 'user',
                description: 'User wallet public key',
                required: true,
            },
        ],
    },
    {
        name: 'token_analysis',
        description: 'Comprehensive analysis of a token: bonding curve state, market cap, price quotes, graduation status, and fee tier',
        arguments: [
            {
                name: 'mint',
                description: 'Token mint address to analyze',
                required: true,
            },
        ],
    },
];
export function registerPromptHandlers(server, state) {
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
                role: msg.role,
                content: msg.content,
            })),
        };
    });
}
//# sourceMappingURL=prompts.js.map