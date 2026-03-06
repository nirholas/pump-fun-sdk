import { Connection } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import type { ToolResult, ServerState } from "../types.js";
import { error } from "../types.js";

// Quoting tools
import {
  getBuyQuoteSchema, getBuyQuote,
  getSellQuoteSchema, getSellQuote,
  getPriceImpactSchema, getPriceImpact,
  getMarketCapSchema, getMarketCap,
  getTokenPriceSchema, getTokenPriceTool,
  getBondingCurveSummarySchema, getBondingCurveSummaryTool,
  getGraduationProgressSchema, getGraduationProgressTool,
  getAmmQuoteSchema, getAmmQuote,
} from "./quoting.js";

// Trading tools
import {
  buildBuySchema, buildBuyInstructions,
  buildSellSchema, buildSellInstructions,
  buildCreateTokenSchema, buildCreateToken,
  buildCreateAndBuySchema, buildCreateAndBuy,
  buildAmmSwapSchema, buildAmmSwap,
  buildMigrateSchema, buildMigrateInstructions,
} from "./trading.js";

// Fee tools
import {
  getFeeTierSchema, getFeeTier,
  getFeeBreakdownSchema, getFeeBreakdown,
  getCreatorVaultBalanceSchema, getCreatorVaultBalance,
  getMinDistributableSchema, getMinDistributableFee,
  buildCollectFeesSchema, buildCollectCreatorFees,
  buildDistributeFeesSchema, buildDistributeFees,
  getFeeSharingConfigSchema, getFeeSharingConfig,
  buildUpdateFeeSharesSchema, buildUpdateFeeShares,
} from "./fees.js";

// Analytics tools
import {
  getBondingCurveStateSchema, getBondingCurveState,
  getTokenInfoSchema, getTokenInfo,
  getCreatorProfileSchema, getCreatorProfile,
  getTokenHoldersSchema, getTokenHolders,
  getRecentTradesSchema, getRecentTrades,
  getSolUsdPriceSchema, getSolUsdPrice,
  getGraduationStatusSchema, getGraduationStatus,
} from "./analytics.js";

// AMM tools
import {
  getAmmPoolSchema, getAmmPool,
  getAmmReservesSchema, getAmmReserves,
  getAmmPriceSchema, getAmmPrice,
  buildAmmDepositSchema, buildAmmDeposit,
  buildAmmWithdrawSchema, buildAmmWithdraw,
} from "./amm.js";

// Social fees tools
import {
  buildCreateFeeSharingSchema, buildCreateFeeSharing,
  buildUpdateShareholdersSchema, buildUpdateShareholders,
  buildRevokeAdminSchema, buildRevokeAdmin,
  getShareholdersSchema, getShareholders,
  getDistributableAmountSchema, getDistributableAmount,
  buildClaimShareSchema, buildClaimShare,
} from "./social-fees.js";

// Wallet tools
import {
  generateKeypairSchema, generateKeypair,
  generateVanityAddressSchema, generateVanityAddress,
  validateAddressSchema, validateAddress,
  estimateVanityTimeSchema, estimateVanityTime,
  restoreKeypairSchema, restoreKeypair,
  signMessageSchema, signMessage,
  verifySignatureSchema, verifySignature,
} from "./wallet.js";

// Token incentives tools
import {
  getUnclaimedTokensSchema, getUnclaimedTokens,
  getCurrentDayTokensSchema, getCurrentDayTokens,
  getVolumeStatsSchema, getVolumeStats,
  buildClaimIncentivesSchema, buildClaimIncentives,
  buildClaimCashbackSchema, buildClaimCashback,
} from "./token-incentives.js";

// Metadata tools
import {
  searchTokensSchema, searchTokens,
  getTokenMetadataUriSchema, getTokenMetadataUri,
  getTokenSocialsSchema, getTokenSocials,
} from "./metadata.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (sdk: OnlinePumpSdk, params: any) => Promise<ToolResult>;
}

function zodToJsonSchema(schema: any): Record<string, unknown> {
  // Extract Zod schema shape for MCP tool registration
  const shape = schema._def?.typeName === "ZodObject" ? schema.shape : {};
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const field = value as any;
    const desc = field._def?.description ?? field.description ?? "";
    const isOptional = field._def?.typeName === "ZodOptional" || field._def?.typeName === "ZodDefault";

    let type = "string";
    const innerDef = field._def?.typeName === "ZodOptional"
      ? field._def.innerType._def
      : field._def?.typeName === "ZodDefault"
        ? field._def.innerType._def
        : field._def;

    if (innerDef?.typeName === "ZodNumber") type = "number";
    else if (innerDef?.typeName === "ZodBoolean") type = "boolean";
    else if (innerDef?.typeName === "ZodArray") type = "array";
    else if (innerDef?.typeName === "ZodEnum") type = "string";

    properties[key] = { type, description: desc };

    if (innerDef?.typeName === "ZodEnum" && innerDef.values) {
      properties[key].enum = innerDef.values;
    }

    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

// Wallet tools don't need SDK, wrap them to match the interface
function walletToolHandler(fn: (params: any) => Promise<ToolResult>) {
  return (_sdk: OnlinePumpSdk, params: any) => fn(params);
}

export const ALL_TOOLS: ToolDefinition[] = [
  // ── Quoting (8) ──
  {
    name: "get_buy_quote",
    description: "Calculate how many tokens you receive for a given SOL amount on the bonding curve",
    inputSchema: zodToJsonSchema(getBuyQuoteSchema),
    handler: getBuyQuote,
  },
  {
    name: "get_sell_quote",
    description: "Calculate how much SOL you receive for selling a given number of tokens",
    inputSchema: zodToJsonSchema(getSellQuoteSchema),
    handler: getSellQuote,
  },
  {
    name: "get_price_impact",
    description: "Calculate the price impact percentage of a buy or sell trade",
    inputSchema: zodToJsonSchema(getPriceImpactSchema),
    handler: getPriceImpact,
  },
  {
    name: "get_market_cap",
    description: "Get the current market cap of a token on the bonding curve in SOL",
    inputSchema: zodToJsonSchema(getMarketCapSchema),
    handler: getMarketCap,
  },
  {
    name: "get_token_price",
    description: "Get the current buy and sell price per token, including spread",
    inputSchema: zodToJsonSchema(getTokenPriceSchema),
    handler: getTokenPriceTool,
  },
  {
    name: "get_bonding_curve_summary",
    description: "Get a comprehensive summary of a token's bonding curve: reserves, market cap, price, graduation progress",
    inputSchema: zodToJsonSchema(getBondingCurveSummarySchema),
    handler: getBondingCurveSummaryTool,
  },
  {
    name: "get_graduation_progress",
    description: "Check how close a token is to graduating from bonding curve to AMM pool",
    inputSchema: zodToJsonSchema(getGraduationProgressSchema),
    handler: getGraduationProgressTool,
  },
  {
    name: "get_amm_quote",
    description: "Get a quote for trading a graduated token on PumpAMM",
    inputSchema: zodToJsonSchema(getAmmQuoteSchema),
    handler: getAmmQuote,
  },

  // ── Trading (6) ──
  {
    name: "build_buy_instructions",
    description: "Build transaction instructions to buy tokens on the bonding curve with SOL",
    inputSchema: zodToJsonSchema(buildBuySchema),
    handler: buildBuyInstructions,
  },
  {
    name: "build_sell_instructions",
    description: "Build transaction instructions to sell tokens back to the bonding curve for SOL",
    inputSchema: zodToJsonSchema(buildSellSchema),
    handler: buildSellInstructions,
  },
  {
    name: "build_create_token",
    description: "Build instructions to launch a new token on PumpFun with createV2",
    inputSchema: zodToJsonSchema(buildCreateTokenSchema),
    handler: buildCreateToken,
  },
  {
    name: "build_create_and_buy",
    description: "Build instructions to launch a new token AND make the initial buy in a single transaction",
    inputSchema: zodToJsonSchema(buildCreateAndBuySchema),
    handler: buildCreateAndBuy,
  },
  {
    name: "build_amm_swap",
    description: "Build swap instructions for graduated tokens on PumpAMM (buy or sell)",
    inputSchema: zodToJsonSchema(buildAmmSwapSchema),
    handler: buildAmmSwap,
  },
  {
    name: "build_migrate_instructions",
    description: "Build instructions to migrate (graduate) a token from bonding curve to PumpAMM",
    inputSchema: zodToJsonSchema(buildMigrateSchema),
    handler: buildMigrateInstructions,
  },

  // ── Fees (8) ──
  {
    name: "get_fee_tier",
    description: "Get the current fee tier (buy/sell fee percentages) based on token market cap",
    inputSchema: zodToJsonSchema(getFeeTierSchema),
    handler: getFeeTier,
  },
  {
    name: "get_fee_breakdown",
    description: "Decompose fees for a specific trade amount into platform, creator, and referral components",
    inputSchema: zodToJsonSchema(getFeeBreakdownSchema),
    handler: getFeeBreakdown,
  },
  {
    name: "get_creator_vault_balance",
    description: "Check how much SOL a creator has accumulated in their fee vault across both programs",
    inputSchema: zodToJsonSchema(getCreatorVaultBalanceSchema),
    handler: getCreatorVaultBalance,
  },
  {
    name: "get_minimum_distributable_fee",
    description: "Check the minimum fee threshold required before distribution to shareholders",
    inputSchema: zodToJsonSchema(getMinDistributableSchema),
    handler: getMinDistributableFee,
  },
  {
    name: "build_collect_creator_fees",
    description: "Build instructions for a creator to collect accumulated fees from both Pump and PumpAMM",
    inputSchema: zodToJsonSchema(buildCollectFeesSchema),
    handler: buildCollectCreatorFees,
  },
  {
    name: "build_distribute_fees",
    description: "Build instructions to distribute accumulated fees to all shareholders",
    inputSchema: zodToJsonSchema(buildDistributeFeesSchema),
    handler: buildDistributeFees,
  },
  {
    name: "get_fee_sharing_config",
    description: "Get the fee sharing configuration for a token",
    inputSchema: zodToJsonSchema(getFeeSharingConfigSchema),
    handler: getFeeSharingConfig,
  },
  {
    name: "build_update_fee_shares",
    description: "Build instructions to update shareholder allocation (BPS must total 10000)",
    inputSchema: zodToJsonSchema(buildUpdateFeeSharesSchema),
    handler: buildUpdateFeeShares,
  },

  // ── Analytics (7) ──
  {
    name: "get_bonding_curve_state",
    description: "Get raw bonding curve account data: reserves, supply, completion status, creator",
    inputSchema: zodToJsonSchema(getBondingCurveStateSchema),
    handler: getBondingCurveState,
  },
  {
    name: "get_token_info",
    description: "Get token information: creator, market cap, reserves, graduation status",
    inputSchema: zodToJsonSchema(getTokenInfoSchema),
    handler: getTokenInfo,
  },
  {
    name: "get_creator_profile",
    description: "Get creator profile including vault balance and fee earnings",
    inputSchema: zodToJsonSchema(getCreatorProfileSchema),
    handler: getCreatorProfile,
  },
  {
    name: "get_token_holders",
    description: "Get holder information for a token (guidance for RPC query)",
    inputSchema: zodToJsonSchema(getTokenHoldersSchema),
    handler: getTokenHolders,
  },
  {
    name: "get_recent_trades",
    description: "Get guidance on fetching recent trades from transaction history",
    inputSchema: zodToJsonSchema(getRecentTradesSchema),
    handler: getRecentTrades,
  },
  {
    name: "get_sol_usd_price",
    description: "Get the current SOL/USD price from Jupiter Price API",
    inputSchema: zodToJsonSchema(getSolUsdPriceSchema),
    handler: getSolUsdPrice,
  },
  {
    name: "get_graduation_status",
    description: "Check whether a token has graduated to AMM and its progress percentage",
    inputSchema: zodToJsonSchema(getGraduationStatusSchema),
    handler: getGraduationStatus,
  },

  // ── AMM (5) ──
  {
    name: "get_amm_pool",
    description: "Get PumpAMM pool state for a graduated token: reserves, LP supply, mint addresses",
    inputSchema: zodToJsonSchema(getAmmPoolSchema),
    handler: getAmmPool,
  },
  {
    name: "get_amm_reserves",
    description: "Get current pool reserves in both token and SOL units",
    inputSchema: zodToJsonSchema(getAmmReservesSchema),
    handler: getAmmReserves,
  },
  {
    name: "get_amm_price",
    description: "Get the current token price derived from AMM pool reserves",
    inputSchema: zodToJsonSchema(getAmmPriceSchema),
    handler: getAmmPrice,
  },
  {
    name: "build_amm_deposit",
    description: "Build instructions to deposit liquidity into a PumpAMM pool",
    inputSchema: zodToJsonSchema(buildAmmDepositSchema),
    handler: buildAmmDeposit,
  },
  {
    name: "build_amm_withdraw",
    description: "Build instructions to withdraw liquidity from a PumpAMM pool",
    inputSchema: zodToJsonSchema(buildAmmWithdrawSchema),
    handler: buildAmmWithdraw,
  },

  // ── Social Fees (6) ──
  {
    name: "build_create_fee_sharing",
    description: "Build instructions to create a fee sharing config for a token (enables revenue sharing)",
    inputSchema: zodToJsonSchema(buildCreateFeeSharingSchema),
    handler: buildCreateFeeSharing,
  },
  {
    name: "build_update_shareholders",
    description: "Build instructions to update fee sharing shareholders and their BPS allocations",
    inputSchema: zodToJsonSchema(buildUpdateShareholdersSchema),
    handler: buildUpdateShareholders,
  },
  {
    name: "build_revoke_admin",
    description: "Build instructions to permanently lock fee sharing config (irreversible!)",
    inputSchema: zodToJsonSchema(buildRevokeAdminSchema),
    handler: buildRevokeAdmin,
  },
  {
    name: "get_shareholders",
    description: "List current shareholders and their fee share percentages for a token",
    inputSchema: zodToJsonSchema(getShareholdersSchema),
    handler: getShareholders,
  },
  {
    name: "get_distributable_amount",
    description: "Check the current distributable fee balance for a token's shareholders",
    inputSchema: zodToJsonSchema(getDistributableAmountSchema),
    handler: getDistributableAmount,
  },
  {
    name: "build_claim_share",
    description: "Build instructions to distribute accumulated fees to all shareholders",
    inputSchema: zodToJsonSchema(buildClaimShareSchema),
    handler: buildClaimShare,
  },

  // ── Wallet (5) ──
  {
    name: "generate_keypair",
    description: "Generate a new Solana keypair (Ed25519). Key material is zeroized after return.",
    inputSchema: zodToJsonSchema(generateKeypairSchema),
    handler: walletToolHandler(generateKeypair),
  },
  {
    name: "generate_vanity_address",
    description: "Generate a Solana keypair with a vanity prefix and/or suffix pattern",
    inputSchema: zodToJsonSchema(generateVanityAddressSchema),
    handler: walletToolHandler(generateVanityAddress),
  },
  {
    name: "validate_address",
    description: "Check if a string is a valid Solana address and whether it's on-curve or a PDA",
    inputSchema: zodToJsonSchema(validateAddressSchema),
    handler: walletToolHandler(validateAddress),
  },
  {
    name: "estimate_vanity_time",
    description: "Estimate how long it will take to generate a vanity address with a given pattern",
    inputSchema: zodToJsonSchema(estimateVanityTimeSchema),
    handler: walletToolHandler(estimateVanityTime),
  },
  {
    name: "restore_keypair",
    description: "Restore a Solana keypair from a 64-byte secret key array",
    inputSchema: zodToJsonSchema(restoreKeypairSchema),
    handler: walletToolHandler(restoreKeypair),
  },
  {
    name: "sign_message",
    description: "Sign an arbitrary message with a private key (Ed25519 detached signature). Key is zeroized after use.",
    inputSchema: zodToJsonSchema(signMessageSchema),
    handler: walletToolHandler(signMessage),
  },
  {
    name: "verify_signature",
    description: "Verify an Ed25519 message signature against a Solana public key",
    inputSchema: zodToJsonSchema(verifySignatureSchema),
    handler: walletToolHandler(verifySignature),
  },

  // ── Token Incentives (5) ──
  {
    name: "get_unclaimed_tokens",
    description: "Check how many PUMP token incentives a user has unclaimed across both programs",
    inputSchema: zodToJsonSchema(getUnclaimedTokensSchema),
    handler: getUnclaimedTokens,
  },
  {
    name: "get_current_day_tokens",
    description: "Preview the current day's projected token incentive earnings",
    inputSchema: zodToJsonSchema(getCurrentDayTokensSchema),
    handler: getCurrentDayTokens,
  },
  {
    name: "get_volume_stats",
    description: "Get aggregate volume accumulator stats for a user (total volume, claimed, unclaimed)",
    inputSchema: zodToJsonSchema(getVolumeStatsSchema),
    handler: getVolumeStats,
  },
  {
    name: "build_claim_incentives",
    description: "Build instructions to claim token incentives from both Pump and PumpAMM programs",
    inputSchema: zodToJsonSchema(buildClaimIncentivesSchema),
    handler: buildClaimIncentives,
  },
  {
    name: "build_claim_cashback",
    description: "Build instructions to claim accumulated cashback rewards",
    inputSchema: zodToJsonSchema(buildClaimCashbackSchema),
    handler: buildClaimCashback,
  },

  // ── Metadata (3) ──
  {
    name: "search_tokens",
    description: "Search PumpFun tokens by name or symbol (provides guidance for external APIs)",
    inputSchema: zodToJsonSchema(searchTokensSchema),
    handler: searchTokens,
  },
  {
    name: "get_token_metadata_uri",
    description: "Get guidance on fetching a token's metadata URI from Metaplex",
    inputSchema: zodToJsonSchema(getTokenMetadataUriSchema),
    handler: getTokenMetadataUri,
  },
  {
    name: "get_token_socials",
    description: "Get guidance on extracting social links from token metadata",
    inputSchema: zodToJsonSchema(getTokenSocialsSchema),
    handler: getTokenSocials,
  },
];

// ── MCP Protocol Exports ──

/**
 * Tool definitions in the format expected by the MCP ListTools handler.
 */
export const TOOL_DEFINITIONS = ALL_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  inputSchema: t.inputSchema,
}));

let _onlineSdk: OnlinePumpSdk | null = null;

function getOnlineSdk(): OnlinePumpSdk {
  if (_onlineSdk) return _onlineSdk;
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  _onlineSdk = new OnlinePumpSdk(connection);
  return _onlineSdk;
}

/**
 * Dispatch a tool call by name. Called by the MCP CallTool handler.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  _state: ServerState,
): Promise<ToolResult> {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) {
    return error(`Unknown tool: ${name}`);
  }
  const sdk = getOnlineSdk();
  return tool.handler(sdk, args);
}
