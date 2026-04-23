import { z } from "zod";
import { PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { PUMP_SDK } from "@nirholas/pump-sdk";
import type { OnlinePumpSdk } from "@nirholas/pump-sdk";
import { publicKeySchema, bnStringSchema, slippageSchema } from "../utils/validation.js";
import { instructionsToJson } from "../utils/formatting.js";
import { success, error, getErrorMessage } from "../types.js";
import type { ToolResult } from "../types.js";

/** Well-known SPL Token Program ID */
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// ── build_buy_instructions ──
export const buildBuySchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("Buyer wallet address"),
  solAmount: bnStringSchema.describe("SOL amount in lamports to spend"),
  slippage: slippageSchema,
});

export async function buildBuyInstructions(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildBuySchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const solAmount = new BN(params.solAmount);

    const global = await sdk.fetchGlobal();
    const feeConfig = await sdk.fetchFeeConfig();
    const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo, tokenProgram } =
      await sdk.fetchBuyState(mint, user);

    const { getBuyTokenAmountFromSolAmount } = await import("@nirholas/pump-sdk");
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      amount: solAmount,
    });

    const instructions = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo,
      bondingCurve,
      associatedUserAccountInfo: associatedUserAccountInfo ?? null,
      mint,
      user,
      amount,
      solAmount,
      slippage: params.slippage,
      tokenProgram,
    });

    return success({
      instructions: instructionsToJson(instructions),
      estimatedTokensOut: amount.toString(),
      slippage: params.slippage,
    });
  } catch (e: unknown) {
    return error(`Failed to build buy instructions: ${getErrorMessage(e)}`);
  }
}

// ── build_sell_instructions ──
export const buildSellSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("Seller wallet address"),
  tokenAmount: bnStringSchema.describe("Token amount in raw units to sell"),
  slippage: slippageSchema,
});

export async function buildSellInstructions(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildSellSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const amount = new BN(params.tokenAmount);

    const global = await sdk.fetchGlobal();
    const feeConfig = await sdk.fetchFeeConfig();
    const { bondingCurveAccountInfo, bondingCurve } =
      await sdk.fetchSellState(mint, user);

    const { getSellSolAmountFromTokenAmount } = await import("@nirholas/pump-sdk");
    const solAmount = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      amount,
    });

    const instructions = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo,
      bondingCurve,
      mint,
      user,
      amount,
      solAmount,
      slippage: params.slippage,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    return success({
      instructions: instructionsToJson(instructions),
      estimatedSolOut: solAmount.toString(),
      slippage: params.slippage,
    });
  } catch (e: unknown) {
    return error(`Failed to build sell instructions: ${getErrorMessage(e)}`);
  }
}

// ── build_create_token ──
export const buildCreateTokenSchema = z.object({
  name: z.string().min(1).max(32).describe("Token name"),
  symbol: z.string().min(1).max(10).describe("Token symbol"),
  uri: z.string().url().describe("Metadata JSON URI"),
  creator: publicKeySchema.describe("Creator wallet address"),
});

export async function buildCreateToken(
  _sdk: OnlinePumpSdk,
  params: z.infer<typeof buildCreateTokenSchema>
): Promise<ToolResult> {
  try {
    const creator = new PublicKey(params.creator);
    const mint = Keypair.generate();

    const instruction = await PUMP_SDK.createV2Instruction({
      mint: mint.publicKey,
      name: params.name,
      symbol: params.symbol,
      uri: params.uri,
      creator,
      user: creator,
      mayhemMode: false,
    });

    return success({
      instructions: instructionsToJson([instruction]),
      mintAddress: mint.publicKey.toBase58(),
      mintSecretKey: Array.from(mint.secretKey),
      note: "The mint keypair must sign the transaction. Include mintSecretKey as a signer.",
    });
  } catch (e: unknown) {
    return error(`Failed to build create token instructions: ${getErrorMessage(e)}`);
  }
}

// ── build_create_and_buy ──
export const buildCreateAndBuySchema = z.object({
  name: z.string().min(1).max(32).describe("Token name"),
  symbol: z.string().min(1).max(10).describe("Token symbol"),
  uri: z.string().url().describe("Metadata JSON URI"),
  creator: publicKeySchema.describe("Creator wallet address"),
  solAmount: bnStringSchema.describe("SOL to spend on initial buy (lamports)"),
});

export async function buildCreateAndBuy(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildCreateAndBuySchema>
): Promise<ToolResult> {
  try {
    const creator = new PublicKey(params.creator);
    const mint = Keypair.generate();
    const solAmount = new BN(params.solAmount);

    const global = await sdk.fetchGlobal();
    const feeConfig = await sdk.fetchFeeConfig();
    const { getBuyTokenAmountFromSolAmount } = await import("@nirholas/pump-sdk");
    // Pass null so getBuyTokenAmountFromSolAmount treats this as a new curve
    // and uses global.tokenTotalSupply for the mint supply (correct for create+buy).
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: null,
      bondingCurve: null,
      amount: solAmount,
    });

    const instructions = await PUMP_SDK.createV2AndBuyInstructions({
      global,
      mint: mint.publicKey,
      name: params.name,
      symbol: params.symbol,
      uri: params.uri,
      creator,
      user: creator,
      amount,
      solAmount,
      mayhemMode: false,
    });

    return success({
      instructions: instructionsToJson(instructions),
      mintAddress: mint.publicKey.toBase58(),
      mintSecretKey: Array.from(mint.secretKey),
      estimatedTokensOut: amount.toString(),
      note: "The mint keypair must sign the transaction.",
    });
  } catch (e: unknown) {
    return error(`Failed to build create+buy instructions: ${getErrorMessage(e)}`);
  }
}

// ── build_amm_swap ──
export const buildAmmSwapSchema = z.object({
  mint: publicKeySchema.describe("Token mint address (must be graduated)"),
  user: publicKeySchema.describe("User wallet address"),
  amount: bnStringSchema.describe("Input amount"),
  minOutput: bnStringSchema.describe("Minimum output amount (slippage protection)"),
  side: z.enum(["buy", "sell"]).describe("Trade side"),
});

export async function buildAmmSwap(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildAmmSwapSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const amount = new BN(params.amount);
    const minOutput = new BN(params.minOutput);

    // Use OnlinePumpSdk wrappers — they fetch pool state (including coin_creator)
    // before building instructions, which the offline PUMP_SDK builders cannot do.
    let instructions;
    if (params.side === "buy") {
      instructions = await sdk.ammBuyInstructions({
        mint,
        user,
        quoteAmountIn: amount,
        minBaseAmountOut: minOutput,
      });
    } else {
      instructions = await sdk.ammSellInstructions({
        mint,
        user,
        baseAmountIn: amount,
        minQuoteAmountOut: minOutput,
      });
    }

    return success({
      instructions: instructionsToJson(instructions),
      side: params.side,
    });
  } catch (e: unknown) {
    return error(`Failed to build AMM swap: ${getErrorMessage(e)}`);
  }
}

// ── build_routed_buy ──
// Automatically routes to bonding curve or PumpAMM based on graduation status.
export const buildRoutedBuySchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("Buyer wallet address"),
  solAmount: bnStringSchema.describe("SOL to spend in lamports"),
  slippage: z.number().min(0).max(1).default(0.05).describe("Slippage tolerance (0.05 = 5%)"),
});

export async function buildRoutedBuy(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildRoutedBuySchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const quoteAmountIn = new BN(params.solAmount);

    const instructions = await sdk.routedBuyInstructions({
      mint, user, quoteAmountIn, slippage: params.slippage,
    });

    const bc = await sdk.fetchBondingCurve(mint).catch(() => null);
    return success({
      instructions: instructionsToJson(instructions),
      route: bc?.complete ? "PumpAMM" : "bonding-curve",
      slippage: params.slippage,
    });
  } catch (e: unknown) {
    return error(`Failed to build routed buy: ${getErrorMessage(e)}`);
  }
}

// ── build_routed_sell ──
export const buildRoutedSellSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("Seller wallet address"),
  tokenAmount: bnStringSchema.describe("Token amount in raw units to sell"),
  slippage: z.number().min(0).max(1).default(0.05).describe("Slippage tolerance (0.05 = 5%)"),
  cashback: z.boolean().default(false).describe("Enable cashback volume tracking"),
});

export async function buildRoutedSell(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildRoutedSellSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const baseAmountIn = new BN(params.tokenAmount);

    const instructions = await sdk.routedSellInstructions({
      mint, user, baseAmountIn, slippage: params.slippage, cashback: params.cashback,
    });

    const bc = await sdk.fetchBondingCurve(mint).catch(() => null);
    return success({
      instructions: instructionsToJson(instructions),
      route: bc?.complete ? "PumpAMM" : "bonding-curve",
      slippage: params.slippage,
      cashback: params.cashback,
    });
  } catch (e: unknown) {
    return error(`Failed to build routed sell: ${getErrorMessage(e)}`);
  }
}

// ── build_buy_by_sol_amount ──
// Buy on the bonding curve spending exactly a SOL budget; SDK computes token output.
export const buildBuyBySolAmountSchema = z.object({
  mint: publicKeySchema.describe("Token mint address (must be on bonding curve, not graduated)"),
  user: publicKeySchema.describe("Buyer wallet address"),
  solAmount: bnStringSchema.describe("SOL to spend in lamports"),
  slippage: z.number().min(0).max(1).default(0.05).describe("Slippage tolerance (0.05 = 5%)"),
});

export async function buildBuyBySolAmount(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildBuyBySolAmountSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);

    const instructions = await sdk.buyBySolAmount({
      mint, user, solAmount: new BN(params.solAmount), slippage: params.slippage,
    });

    return success({
      instructions: instructionsToJson(instructions),
      slippage: params.slippage,
    });
  } catch (e: unknown) {
    return error(`Failed to build buy-by-sol-amount: ${getErrorMessage(e)}`);
  }
}

// ── build_sell_all ──
export const buildSellAllSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("Seller wallet address"),
  slippage: z.number().min(0).max(1).default(0.05).describe("Slippage tolerance (0.05 = 5%)"),
  cashback: z.boolean().default(false).describe("Enable cashback volume tracking"),
});

export async function buildSellAll(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildSellAllSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);

    const instructions = await sdk.sellAllInstructions({
      mint, user, slippage: params.slippage, cashback: params.cashback,
    });

    if (instructions.length === 0) {
      return success({ instructions: [], note: "No tokens to sell — balance is zero." });
    }

    return success({
      instructions: instructionsToJson(instructions),
      slippage: params.slippage,
      cashback: params.cashback,
    });
  } catch (e: unknown) {
    return error(`Failed to build sell-all: ${getErrorMessage(e)}`);
  }
}

// ── build_sell_by_percentage ──
export const buildSellByPercentageSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("Seller wallet address"),
  percent: z.number().min(0.01).max(100).describe("Percentage of balance to sell (0.01–100)"),
  slippage: z.number().min(0).max(1).default(0.05).describe("Slippage tolerance (0.05 = 5%)"),
  cashback: z.boolean().default(false).describe("Enable cashback volume tracking"),
});

export async function buildSellByPercentage(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildSellByPercentageSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);

    const instructions = await sdk.sellByPercentage({
      mint, user, percent: params.percent, slippage: params.slippage, cashback: params.cashback,
    });

    if (instructions.length === 0) {
      return success({ instructions: [], note: "No tokens to sell — balance is zero." });
    }

    return success({
      instructions: instructionsToJson(instructions),
      percent: params.percent,
      slippage: params.slippage,
      cashback: params.cashback,
    });
  } catch (e: unknown) {
    return error(`Failed to build sell-by-percentage: ${getErrorMessage(e)}`);
  }
}

// ── build_sell_to_target_sol ──
export const buildSellToTargetSolSchema = z.object({
  mint: publicKeySchema.describe("Token mint address (must be on bonding curve)"),
  user: publicKeySchema.describe("Seller wallet address"),
  targetSol: bnStringSchema.describe("Desired SOL output in lamports"),
  slippage: z.number().min(0).max(1).default(0.05).describe("Slippage tolerance (0.05 = 5%)"),
  cashback: z.boolean().default(false).describe("Enable cashback volume tracking"),
});

export async function buildSellToTargetSol(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildSellToTargetSolSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);

    const instructions = await sdk.sellToTargetSol({
      mint, user, targetSol: new BN(params.targetSol), slippage: params.slippage, cashback: params.cashback,
    });

    if (instructions.length === 0) {
      return success({ instructions: [], note: "Could not reach target SOL with current balance — balance is zero or too small." });
    }

    return success({
      instructions: instructionsToJson(instructions),
      targetSolLamports: params.targetSol,
      slippage: params.slippage,
      cashback: params.cashback,
    });
  } catch (e: unknown) {
    return error(`Failed to build sell-to-target-sol: ${getErrorMessage(e)}`);
  }
}

// ── build_sell_chunked ──
// For very large sells that exceed the safe single-tx limit.
export const buildSellChunkedSchema = z.object({
  mint: publicKeySchema.describe("Token mint address (must be on bonding curve)"),
  user: publicKeySchema.describe("Seller wallet address"),
  tokenAmount: bnStringSchema.describe("Total tokens to sell in raw units"),
  slippage: z.number().min(0).max(1).default(0.05).describe("Slippage tolerance per chunk (0.05 = 5%)"),
});

export async function buildSellChunked(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof buildSellChunkedSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const totalAmount = new BN(params.tokenAmount);

    const instructionGroups = await sdk.sellChunked({
      mint, user, totalAmount, slippage: params.slippage,
    });

    return success({
      chunks: instructionGroups.length,
      transactionGroups: instructionGroups.map((ixs, i) => ({
        chunk: i + 1,
        instructions: instructionsToJson(ixs),
      })),
      slippage: params.slippage,
      note: "Send each chunk as a separate transaction. Must be sent in order.",
    });
  } catch (e: unknown) {
    return error(`Failed to build chunked sell: ${getErrorMessage(e)}`);
  }
}

// ── build_migrate_instructions ──
export const buildMigrateSchema = z.object({
  mint: publicKeySchema.describe("Token mint address to graduate"),
  user: publicKeySchema.describe("User triggering migration"),
  withdrawAuthority: publicKeySchema.describe("Withdraw authority address"),
});

export async function buildMigrateInstructions(
  _sdk: OnlinePumpSdk,
  params: z.infer<typeof buildMigrateSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const withdrawAuthority = new PublicKey(params.withdrawAuthority);

    const instruction = await PUMP_SDK.migrateInstruction({
      withdrawAuthority,
      mint,
      user,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    return success({
      instructions: instructionsToJson([instruction]),
      note: "This migrates the token from bonding curve to PumpAMM pool.",
    });
  } catch (e: unknown) {
    return error(`Failed to build migrate instructions: ${getErrorMessage(e)}`);
  }
}
