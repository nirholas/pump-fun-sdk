import type { ServerState, ResourceResult } from "../types.js";
import { MCP_VERSION } from "../types.js";
import { ALL_TOOLS } from "../tools/index.js";

const SERVER_START_TIME = new Date().toISOString();

export function readConfigResource(state: ServerState): ResourceResult {
  const config = {
    version: "1.0.0",
    mcpVersion: MCP_VERSION,
    capabilities: {
      toolCount: ALL_TOOLS.length,
      toolCategories: {
        wallet: ["generate_keypair", "generate_vanity_address", "validate_address", "estimate_vanity_time", "restore_keypair", "sign_message", "verify_signature"],
        quoting: ["get_buy_quote", "get_sell_quote", "get_price_impact", "get_market_cap", "get_token_price", "get_bonding_curve_summary", "get_graduation_progress", "get_amm_quote"],
        trading: ["build_buy_instructions", "build_sell_instructions", "build_create_token", "build_create_and_buy", "build_amm_swap", "build_migrate_instructions"],
        fees: ["get_fee_tier", "get_fee_breakdown", "get_creator_vault_balance", "get_minimum_distributable_fee", "build_collect_creator_fees", "build_distribute_fees", "get_fee_sharing_config", "build_update_fee_shares"],
        analytics: ["get_bonding_curve_state", "get_token_info", "get_creator_profile", "get_token_holders", "get_recent_trades", "get_sol_usd_price", "get_graduation_status"],
        amm: ["get_amm_pool", "get_amm_reserves", "get_amm_price", "build_amm_deposit", "build_amm_withdraw"],
        socialFees: ["build_create_fee_sharing", "build_update_shareholders", "build_revoke_admin", "get_shareholders", "get_distributable_amount", "build_claim_share"],
        incentives: ["get_unclaimed_tokens", "get_current_day_tokens", "get_volume_stats", "build_claim_incentives", "build_claim_cashback"],
        metadata: ["search_tokens", "get_token_metadata_uri", "get_token_socials"],
      },
      resources: ["solana://config", "solana://keypair/{id}", "solana://address/{pubkey}"],
      prompts: ["create_wallet", "security_audit", "batch_generate"],
    },
    session: {
      keypairsInMemory: state.generatedKeypairs.size,
      startedAt: SERVER_START_TIME,
    },
    security: {
      privateKeyExposure: "never",
      inputValidation: "zod-strict",
      memoryZeroization: "on_shutdown",
      allowedCryptoLibraries: ["@solana/web3.js", "tweetnacl", "bs58"],
    },
    performance: {
      vanityKeysPerSecond: 15000,
      maxVanityTimeout: 300,
      sdkInstructionGeneration: "<1ms",
    },
  };

  return {
    contents: [
      {
        uri: "solana://config",
        mimeType: "application/json",
        text: JSON.stringify(config, null, 2),
      },
    ],
  };
}
