import type { ServerState, PromptResult } from "../types.js";

export const PROMPT_DEFINITIONS = [
  {
    name: "create_token",
    description:
      "Step-by-step guide to create a new token on PumpFun with createV2",
    arguments: [
      {
        name: "name",
        description: "Token name",
        required: true,
      },
      {
        name: "symbol",
        description: "Token symbol (ticker)",
        required: true,
      },
    ],
  },
  {
    name: "buy_token",
    description: "Guide to buy tokens on a bonding curve or AMM pool",
    arguments: [
      {
        name: "mint",
        description: "Token mint address to buy",
        required: true,
      },
      {
        name: "amount",
        description: "SOL amount to spend (e.g. '0.1')",
        required: true,
      },
    ],
  },
  {
    name: "setup_fee_sharing",
    description:
      "Configure fee sharing for a token with multiple shareholders",
    arguments: [
      {
        name: "mint",
        description: "Token mint address",
        required: true,
      },
    ],
  },
  {
    name: "check_portfolio",
    description:
      "Analyze a wallet's PumpFun portfolio: unclaimed fees, token incentives, cashback",
    arguments: [
      {
        name: "wallet",
        description: "Wallet address to check",
        required: true,
      },
    ],
  },
  {
    name: "graduation_check",
    description:
      "Check if a token is close to graduating and what happens next",
    arguments: [
      {
        name: "mint",
        description: "Token mint address to check",
        required: true,
      },
    ],
  },
];

export function handleGetPrompt(
  name: string,
  args: Record<string, string>,
  _state: ServerState,
): PromptResult {
  switch (name) {
    case "create_token":
      return {
        description: `Create a new PumpFun token: ${args.name} ($${args.symbol})`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `I want to create a new token on PumpFun:`,
                `- Name: ${args.name}`,
                `- Symbol: ${args.symbol}`,
                ``,
                `Please help me:`,
                `1. Generate a new keypair for the token mint using the generate_keypair tool`,
                `2. Build the createV2 instructions using build_create_token`,
                `3. Optionally add an initial buy with build_create_and_buy`,
                `4. Explain the transaction I need to sign`,
                ``,
                `Note: I'll need to upload metadata (name, symbol, image) to Arweave/IPFS first to get a URI.`,
              ].join("\n"),
            },
          },
        ],
      };

    case "buy_token":
      return {
        description: `Buy tokens for mint ${args.mint}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `I want to buy tokens: mint ${args.mint}, spending ${args.amount} SOL.`,
                ``,
                `Please:`,
                `1. Check if the token has graduated using get_graduation_status`,
                `2. If NOT graduated: get a buy quote with get_buy_quote, then build instructions with build_buy_instructions`,
                `3. If graduated: get an AMM quote with get_amm_quote, then build swap with build_amm_swap`,
                `4. Show me the price impact using get_price_impact`,
                `5. Explain the transaction and slippage settings`,
              ].join("\n"),
            },
          },
        ],
      };

    case "setup_fee_sharing":
      return {
        description: `Setup fee sharing for ${args.mint}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `I want to configure fee sharing for token ${args.mint}.`,
                ``,
                `Please help me:`,
                `1. Check current fee sharing with get_fee_sharing_config`,
                `2. Help me define shareholders (addresses + BPS allocations, must total 10000)`,
                `3. Build the create/update instructions with build_create_fee_sharing or build_update_shareholders`,
                `4. Explain the distribution process and how to claim`,
                ``,
                `Shares must total exactly 10,000 BPS (100%). Max 8 shareholders.`,
              ].join("\n"),
            },
          },
        ],
      };

    case "check_portfolio":
      return {
        description: `Portfolio check for ${args.wallet}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Analyze my PumpFun portfolio for wallet ${args.wallet}:`,
                ``,
                `1. Check creator vault balance with get_creator_vault_balance`,
                `2. Check unclaimed token incentives with get_unclaimed_tokens`,
                `3. Check current day token earnings with get_current_day_tokens`,
                `4. Check volume stats with get_volume_stats`,
                `5. Summarize what I can claim and the total value`,
              ].join("\n"),
            },
          },
        ],
      };

    case "graduation_check":
      return {
        description: `Graduation check for ${args.mint}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Check graduation status for token ${args.mint}:`,
                ``,
                `1. Get graduation progress with get_graduation_progress`,
                `2. Get bonding curve summary with get_bonding_curve_summary`,
                `3. If graduated, show the AMM pool info with get_amm_pool`,
                `4. If not graduated, show how much SOL is needed to graduate`,
                `5. Explain what happens during graduation (migration to PumpAMM)`,
              ].join("\n"),
            },
          },
        ],
      };

    default:
      return {
        description: "Unknown prompt",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Unknown prompt: ${name}. Available prompts: create_token, buy_token, setup_fee_sharing, check_portfolio, graduation_check`,
            },
          },
        ],
      };
  }
}
