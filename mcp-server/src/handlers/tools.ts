import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerState, ToolDefinition } from '../types/index.js';

// Tool definitions - Agent 2 will implement these
export const TOOLS: ToolDefinition[] = [
  // ── Wallet Tools ────────────────────────────────────────────────────
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

  // ── Price Quoting ───────────────────────────────────────────────────
  {
    name: 'quote_buy',
    description: 'Get a price quote: how many tokens you receive for a given SOL amount. Fetches on-chain state for accurate pricing.',
    inputSchema: {
      type: 'object',
      properties: {
        solAmount: { type: 'string', description: 'SOL amount in lamports (e.g. "500000000" for 0.5 SOL)' },
        mint: { type: 'string', description: 'Token mint address (omit for new token pricing)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['solAmount'],
    },
  },
  {
    name: 'quote_sell',
    description: 'Get a price quote: how much SOL you receive for selling a given token amount.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenAmount: { type: 'string', description: 'Token amount to sell (raw units)' },
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['tokenAmount', 'mint'],
    },
  },
  {
    name: 'quote_buy_cost',
    description: 'Get a price quote: how much SOL is needed to buy a specific token amount.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenAmount: { type: 'string', description: 'Desired token amount (raw units)' },
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['tokenAmount', 'mint'],
    },
  },

  // ── Bonding Curve ───────────────────────────────────────────────────
  {
    name: 'get_market_cap',
    description: 'Get the current market cap of a token from its bonding curve state.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_bonding_curve',
    description: 'Fetch the full bonding curve state for a token: reserves, supply, graduation status, creator.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint'],
    },
  },

  // ── Token Lifecycle ─────────────────────────────────────────────────
  {
    name: 'build_create_token',
    description: 'Build a createV2 instruction to launch a new token on the bonding curve. Returns a mint keypair and serialized instruction.',
    inputSchema: {
      type: 'object',
      properties: {
        creator: { type: 'string', description: 'Creator wallet public key' },
        name: { type: 'string', description: 'Token name' },
        symbol: { type: 'string', description: 'Token symbol' },
        uri: { type: 'string', description: 'Metadata URI (JSON with name, symbol, image, description)' },
        mayhemMode: { type: 'boolean', description: 'Use Mayhem routing (default: false)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['creator', 'name', 'symbol', 'uri'],
    },
  },
  {
    name: 'build_create_and_buy',
    description: 'Build instructions to create a new token AND buy in a single atomic transaction. Returns mint keypair and serialized instructions.',
    inputSchema: {
      type: 'object',
      properties: {
        creator: { type: 'string', description: 'Creator wallet public key' },
        name: { type: 'string', description: 'Token name' },
        symbol: { type: 'string', description: 'Token symbol' },
        uri: { type: 'string', description: 'Metadata URI' },
        solAmount: { type: 'string', description: 'SOL amount to buy in lamports' },
        mayhemMode: { type: 'boolean', description: 'Use Mayhem routing (default: false)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['creator', 'name', 'symbol', 'uri', 'solAmount'],
    },
  },
  {
    name: 'build_buy',
    description: 'Build buy instructions for an existing token on the bonding curve. Fetches on-chain state, calculates amounts, and returns serialized instructions.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'Buyer wallet public key' },
        solAmount: { type: 'string', description: 'SOL amount in lamports' },
        slippage: { type: 'number', description: 'Slippage tolerance in percent (default: 2)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint', 'user', 'solAmount'],
    },
  },
  {
    name: 'build_sell',
    description: 'Build sell instructions for a token on the bonding curve. Fetches on-chain state and returns serialized instructions.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'Seller wallet public key' },
        tokenAmount: { type: 'string', description: 'Token amount to sell (raw units)' },
        slippage: { type: 'number', description: 'Slippage tolerance in percent (default: 1)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint', 'user', 'tokenAmount'],
    },
  },
  {
    name: 'build_migrate',
    description: 'Build a migration instruction to move a graduated token from the bonding curve to an AMM pool.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'User wallet public key' },
      },
      required: ['mint', 'user'],
    },
  },

  // ── Fee System ──────────────────────────────────────────────────────
  {
    name: 'calculate_fees',
    description: 'Calculate the fee breakdown for a trade amount on a specific token, including LP, protocol, and creator fees.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: 'Trade amount in lamports' },
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['amount', 'mint'],
    },
  },
  {
    name: 'get_fee_tier',
    description: 'Look up the applicable fee tier for a given market cap.',
    inputSchema: {
      type: 'object',
      properties: {
        marketCapLamports: { type: 'string', description: 'Market cap in lamports' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['marketCapLamports'],
    },
  },
  {
    name: 'build_create_fee_sharing',
    description: 'Build an instruction to create a fee sharing config for a token, allowing the creator to split fees among shareholders.',
    inputSchema: {
      type: 'object',
      properties: {
        creator: { type: 'string', description: 'Creator wallet public key' },
        mint: { type: 'string', description: 'Token mint address' },
      },
      required: ['creator', 'mint'],
    },
  },
  {
    name: 'build_update_fee_shares',
    description: 'Build an instruction to update fee share distribution among shareholders. Shares must total exactly 10,000 bps (100%).',
    inputSchema: {
      type: 'object',
      properties: {
        authority: { type: 'string', description: 'Authority (creator) wallet public key' },
        mint: { type: 'string', description: 'Token mint address' },
        shareholders: {
          type: 'string',
          description: 'JSON array of shareholders: [{"address": "pubkey", "shareBps": 5000}, ...]. Must total 10000 bps.',
        },
      },
      required: ['authority', 'mint', 'shareholders'],
    },
  },
  {
    name: 'build_distribute_fees',
    description: 'Build instructions to distribute accumulated creator fees to shareholders.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_creator_vault_balance',
    description: 'Get the creator vault balance across both Pump and PumpAMM programs.',
    inputSchema: {
      type: 'object',
      properties: {
        creator: { type: 'string', description: 'Creator wallet public key' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['creator'],
    },
  },
  {
    name: 'build_collect_creator_fees',
    description: 'Build instructions to collect accumulated creator fees from both programs.',
    inputSchema: {
      type: 'object',
      properties: {
        creator: { type: 'string', description: 'Creator wallet public key' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['creator'],
    },
  },

  // ── Token Incentives ────────────────────────────────────────────────
  {
    name: 'build_init_volume_tracker',
    description: 'Build an instruction to initialize the user volume accumulator for token incentive tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'User wallet public key' },
        payer: { type: 'string', description: 'Payer wallet public key (defaults to user)' },
      },
      required: ['user'],
    },
  },
  {
    name: 'build_claim_incentives',
    description: 'Build instructions to claim token incentive rewards from both Pump and PumpAMM programs.',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'User wallet public key' },
        payer: { type: 'string', description: 'Payer wallet public key (defaults to user)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['user'],
    },
  },
  {
    name: 'get_unclaimed_rewards',
    description: 'Get total unclaimed token incentive rewards and current day earnings for a user.',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'User wallet public key' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['user'],
    },
  },
  {
    name: 'get_volume_stats',
    description: 'Get trading volume statistics for a user across both Pump and PumpAMM programs.',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'User wallet public key' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['user'],
    },
  },

  // ── PDA Derivation ──────────────────────────────────────────────────
  {
    name: 'derive_pda',
    description: 'Derive a Program Derived Address (PDA) for any Pump protocol account type: bonding_curve, creator_vault, amm_creator_vault, canonical_pool, fee_sharing_config, user_volume_accumulator, global, amm_global.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'PDA type: bonding_curve, creator_vault, amm_creator_vault, canonical_pool, fee_sharing_config, user_volume_accumulator, global, amm_global',
        },
        address: { type: 'string', description: 'Public key input (mint or user, depending on PDA type). Not needed for global/amm_global.' },
      },
      required: ['type'],
    },
  },

  // ── On-Chain State ──────────────────────────────────────────────────
  {
    name: 'fetch_global_state',
    description: 'Fetch the Pump protocol global state: authority, fee recipient, initial reserves, token supply.',
    inputSchema: {
      type: 'object',
      properties: {
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'fetch_fee_config',
    description: 'Fetch the on-chain fee configuration: flat fees and market-cap-based fee tiers.',
    inputSchema: {
      type: 'object',
      properties: {
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: [],
    },
  },

  // ── Program Info ────────────────────────────────────────────────────
  {
    name: 'get_program_ids',
    description: 'Get all Pump protocol program IDs: Pump, PumpAMM, PumpFees, Mayhem, and the $PUMP token mint.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ── Analytics & Convenience ─────────────────────────────────────────
  {
    name: 'get_price_impact',
    description: 'Calculate the price impact (slippage) of a buy or sell trade on a bonding curve token.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        side: { type: 'string', description: '"buy" or "sell" (default: "buy")' },
        solAmount: { type: 'string', description: 'SOL amount in lamports (for buy side)' },
        tokenAmount: { type: 'string', description: 'Token amount in raw units (for sell side)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_graduation_progress',
    description: 'Get how close a token is to graduating from the bonding curve to an AMM pool (0-100%).',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_token_price',
    description: 'Get the current buy and sell price per whole token (1 token = 10^6 raw units) in SOL.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_token_summary',
    description: 'Get a comprehensive summary of a token: price, market cap, graduation progress, and reserves — all in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'build_sell_all',
    description: 'Build instructions to sell a user\'s entire token balance and close the ATA to reclaim rent.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'User wallet public key' },
        slippage: { type: 'number', description: 'Slippage tolerance in percent (default: 1)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint', 'user'],
    },
  },
  {
    name: 'is_graduated',
    description: 'Check if a token has graduated from the bonding curve to an AMM pool.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_token_balance',
    description: 'Get a user\'s token balance for a specific mint.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'User wallet public key' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint', 'user'],
    },
  },

  // ── Buy Exact SOL ───────────────────────────────────────────────────
  {
    name: 'build_buy_exact_sol',
    description: 'Build a buy instruction with an exact SOL input amount (like a swap). Fetches bonding curve state to determine creator and fee recipient.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'Buyer wallet public key' },
        solAmount: { type: 'string', description: 'Exact SOL amount in lamports' },
        minTokenAmount: { type: 'string', description: 'Minimum tokens to receive (slippage protection)' },
        rpcUrl: { type: 'string', description: 'Custom Solana RPC URL (optional)' },
      },
      required: ['mint', 'user', 'solAmount', 'minTokenAmount'],
    },
  },

  // ── AMM Trading ─────────────────────────────────────────────────────
  {
    name: 'build_amm_buy',
    description: 'Build an AMM buy instruction for a graduated token. Specify exact tokens out and max SOL in.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'Buyer wallet public key' },
        pool: { type: 'string', description: 'AMM pool address' },
        baseAmountOut: { type: 'string', description: 'Desired token amount out (raw units)' },
        maxQuoteAmountIn: { type: 'string', description: 'Maximum SOL to spend in lamports' },
      },
      required: ['mint', 'user', 'pool', 'baseAmountOut', 'maxQuoteAmountIn'],
    },
  },
  {
    name: 'build_amm_sell',
    description: 'Build an AMM sell instruction for a graduated token. Specify exact tokens in and min SOL out.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'Seller wallet public key' },
        pool: { type: 'string', description: 'AMM pool address' },
        baseAmountIn: { type: 'string', description: 'Token amount to sell (raw units)' },
        minQuoteAmountOut: { type: 'string', description: 'Minimum SOL to receive in lamports' },
      },
      required: ['mint', 'user', 'pool', 'baseAmountIn', 'minQuoteAmountOut'],
    },
  },
  {
    name: 'build_amm_buy_exact_quote',
    description: 'Build an AMM buy instruction with exact SOL (quote) input. Specify exact SOL in and min tokens out.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'Buyer wallet public key' },
        pool: { type: 'string', description: 'AMM pool address' },
        quoteAmountIn: { type: 'string', description: 'Exact SOL amount in lamports' },
        minBaseAmountOut: { type: 'string', description: 'Minimum tokens to receive (raw units)' },
      },
      required: ['mint', 'user', 'pool', 'quoteAmountIn', 'minBaseAmountOut'],
    },
  },

  // ── AMM Liquidity ───────────────────────────────────────────────────
  {
    name: 'build_amm_deposit',
    description: 'Build an AMM deposit instruction to add liquidity to a graduated pool. Provide both tokens and SOL.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'Depositor wallet public key' },
        pool: { type: 'string', description: 'AMM pool address' },
        maxBaseAmountIn: { type: 'string', description: 'Max token amount to deposit (raw units)' },
        maxQuoteAmountIn: { type: 'string', description: 'Max SOL amount to deposit in lamports' },
        minLpTokenAmountOut: { type: 'string', description: 'Minimum LP tokens to receive' },
      },
      required: ['mint', 'user', 'pool', 'maxBaseAmountIn', 'maxQuoteAmountIn', 'minLpTokenAmountOut'],
    },
  },
  {
    name: 'build_amm_withdraw',
    description: 'Build an AMM withdraw instruction to remove liquidity from a graduated pool.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        user: { type: 'string', description: 'Withdrawer wallet public key' },
        pool: { type: 'string', description: 'AMM pool address' },
        lpTokenAmountIn: { type: 'string', description: 'LP token amount to burn' },
        minBaseAmountOut: { type: 'string', description: 'Minimum tokens to receive (raw units)' },
        minQuoteAmountOut: { type: 'string', description: 'Minimum SOL to receive in lamports' },
      },
      required: ['mint', 'user', 'pool', 'lpTokenAmountIn', 'minBaseAmountOut', 'minQuoteAmountOut'],
    },
  },

  // ── Cashback ────────────────────────────────────────────────────────
  {
    name: 'build_claim_cashback',
    description: 'Build an instruction to claim cashback rewards from the Pump bonding curve program.',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'User wallet public key' },
      },
      required: ['user'],
    },
  },
  {
    name: 'build_amm_claim_cashback',
    description: 'Build an instruction to claim cashback rewards from the PumpAMM program.',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'User wallet public key' },
      },
      required: ['user'],
    },
  },

  // ── Fee Sharing (Social Fees & Authority) ──────────────────────────
  {
    name: 'build_create_social_fee',
    description: 'Build an instruction to create a social fee PDA that links a user to a fee sharing authority.',
    inputSchema: {
      type: 'object',
      properties: {
        payer: { type: 'string', description: 'Payer wallet public key (pays rent)' },
        authority: { type: 'string', description: 'Fee sharing authority public key' },
        user: { type: 'string', description: 'User wallet public key' },
      },
      required: ['payer', 'authority', 'user'],
    },
  },
  {
    name: 'build_claim_social_fee',
    description: 'Build an instruction to claim accumulated social fees for a user.',
    inputSchema: {
      type: 'object',
      properties: {
        authority: { type: 'string', description: 'Fee sharing authority public key' },
        user: { type: 'string', description: 'User wallet public key' },
      },
      required: ['authority', 'user'],
    },
  },
  {
    name: 'build_reset_fee_sharing',
    description: 'Build an instruction to reset fee sharing config for a token mint.',
    inputSchema: {
      type: 'object',
      properties: {
        authority: { type: 'string', description: 'Current authority wallet public key' },
        mint: { type: 'string', description: 'Token mint address' },
      },
      required: ['authority', 'mint'],
    },
  },
  {
    name: 'build_transfer_fee_authority',
    description: 'Build an instruction to transfer fee sharing authority to a new wallet.',
    inputSchema: {
      type: 'object',
      properties: {
        authority: { type: 'string', description: 'Current authority wallet public key' },
        mint: { type: 'string', description: 'Token mint address' },
        newAuthority: { type: 'string', description: 'New authority wallet public key' },
      },
      required: ['authority', 'mint', 'newAuthority'],
    },
  },
  {
    name: 'build_revoke_fee_authority',
    description: 'Build an instruction to permanently revoke fee sharing authority. WARNING: This is irreversible!',
    inputSchema: {
      type: 'object',
      properties: {
        authority: { type: 'string', description: 'Current authority wallet public key' },
        mint: { type: 'string', description: 'Token mint address' },
      },
      required: ['authority', 'mint'],
    },
  },

  // ── Creator Management ──────────────────────────────────────────────
  {
    name: 'build_migrate_creator',
    description: 'Build an instruction to migrate bonding curve creator to a new wallet. Transfers future creator fees.',
    inputSchema: {
      type: 'object',
      properties: {
        authority: { type: 'string', description: 'Current authority (creator) wallet public key' },
        mint: { type: 'string', description: 'Token mint address' },
        newCreator: { type: 'string', description: 'New creator wallet public key' },
      },
      required: ['authority', 'mint', 'newCreator'],
    },
  },
];

export function registerToolHandlers(server: Server, state: ServerState): void {
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
      return result as any;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      } as any;
    }
  });
}

