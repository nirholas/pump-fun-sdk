import { z } from "zod";
import { PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { PUMP_SDK, canonicalPumpPoolPda } from "@pump-fun/pump-sdk";
import type { OnlinePumpSdk } from "@pump-fun/pump-sdk";
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
    const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
      await sdk.fetchBuyState(mint, user);

    const { getBuyTokenAmountFromSolAmount } = await import("@pump-fun/pump-sdk");
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: bondingCurve.virtualTokenReserves,
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

    const { getSellSolAmountFromTokenAmount } = await import("@pump-fun/pump-sdk");
    const solAmount = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: bondingCurve.virtualTokenReserves,
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
      mayhemMode: false,
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
    const { newBondingCurve, getBuyTokenAmountFromSolAmount } = await import("@pump-fun/pump-sdk");
    const freshCurve = newBondingCurve(global);

    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: freshCurve.virtualTokenReserves,
      bondingCurve: freshCurve,
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
    const poolAddress = canonicalPumpPoolPda(mint);
    const amount = new BN(params.amount);
    const minOutput = new BN(params.minOutput);

    let instruction;
    if (params.side === "buy") {
      instruction = await PUMP_SDK.ammBuyExactQuoteInInstruction({
        user,
        pool: poolAddress,
        mint,
        quoteAmountIn: amount,
        minBaseAmountOut: minOutput,
      });
    } else {
      instruction = await PUMP_SDK.ammSellInstruction({
        user,
        pool: poolAddress,
        mint,
        baseAmountIn: amount,
        minQuoteAmountOut: minOutput,
      });
    }

    return success({
      instructions: instructionsToJson([instruction]),
      side: params.side,
    });
  } catch (e: unknown) {
    return error(`Failed to build AMM swap: ${getErrorMessage(e)}`);
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
    });

    return success({
      instructions: instructionsToJson([instruction]),
      note: "This migrates the token from bonding curve to PumpAMM pool.",
    });
  } catch (e: unknown) {
    return error(`Failed to build migrate instructions: ${getErrorMessage(e)}`);
  }
}
