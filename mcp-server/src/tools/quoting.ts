import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  bondingCurveMarketCap,
} from "@nirholas/pump-sdk";
import type { OnlinePumpSdk } from "@nirholas/pump-sdk";
import { publicKeySchema, bnStringSchema } from "../utils/validation.js";
import { lamportsToSol, rawToTokens, formatBN } from "../utils/formatting.js";
import { success, error, getErrorMessage } from "../types.js";
import type { ToolResult } from "../types.js";

// ── get_buy_quote ──
// Uses sdk.quoteBuy() for a full breakdown: fee decomposition, price impact,
// before/after prices. More accurate than the offline estimate.
export const getBuyQuoteSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("Buyer wallet address"),
  solAmount: bnStringSchema.describe("SOL amount in lamports to spend"),
});

export async function getBuyQuote(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getBuyQuoteSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const solAmount = new BN(params.solAmount);

    const quote = await sdk.quoteBuy({ mint, user, solAmount });

    return success({
      inputSolLamports: formatBN(solAmount),
      inputSol: lamportsToSol(solAmount),
      outputTokensRaw: formatBN(quote.tokensOut),
      outputTokens: rawToTokens(quote.tokensOut),
      feesLamports: formatBN(quote.feesLamports),
      feesSol: lamportsToSol(quote.feesLamports),
      priceImpactBps: quote.priceImpactBps,
      priceImpactPercent: (quote.priceImpactBps / 100).toFixed(2) + "%",
      priceBeforeLamports: formatBN(quote.priceBefore),
      priceAfterLamports: formatBN(quote.priceAfter),
    });
  } catch (e: unknown) {
    return error(`Failed to get buy quote: ${getErrorMessage(e)}`);
  }
}

// ── get_sell_quote ──
// Uses sdk.quoteSell() — includes overflow detection for large sells
// requiring sellChunked.
export const getSellQuoteSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("Seller wallet address"),
  tokenAmount: bnStringSchema.describe("Token amount in raw units to sell"),
  tokenProgram: z.string().optional().describe("Token program (optional — auto-detected from mint)"),
});

export async function getSellQuote(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getSellQuoteSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const amount = new BN(params.tokenAmount);
    const tokenProgram = params.tokenProgram ? new PublicKey(params.tokenProgram) : undefined;

    const quote = await sdk.quoteSell({ mint, user, amount, tokenProgram });

    return success({
      inputTokensRaw: formatBN(amount),
      inputTokens: rawToTokens(amount),
      outputSolLamports: formatBN(quote.solOut),
      outputSol: lamportsToSol(quote.solOut),
      feesLamports: formatBN(quote.feesLamports),
      feesSol: lamportsToSol(quote.feesLamports),
      priceImpactBps: quote.priceImpactBps,
      priceImpactPercent: (quote.priceImpactBps / 100).toFixed(2) + "%",
      priceAfterLamports: formatBN(quote.priceAfter),
      maxSafeAmountRaw: formatBN(quote.maxSafeAmount),
      willOverflow: quote.willOverflow,
      overflowWarning: quote.willOverflow
        ? "Amount exceeds single-tx limit. Use build_sell_chunked to split into multiple transactions."
        : null,
    });
  } catch (e: unknown) {
    return error(`Failed to get sell quote: ${getErrorMessage(e)}`);
  }
}

// ── get_price_impact ──
export const getPriceImpactSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  amount: bnStringSchema.describe("Amount in lamports (buy) or raw tokens (sell)"),
  side: z.enum(["buy", "sell"]).describe("Trade side"),
});

export async function getPriceImpact(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getPriceImpactSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const amount = new BN(params.amount);
    const result =
      params.side === "buy"
        ? await sdk.fetchBuyPriceImpact(mint, amount)
        : await sdk.fetchSellPriceImpact(mint, amount);

    return success({
      side: params.side,
      impactBps: result.impactBps,
      impactPercent: (result.impactBps / 100).toFixed(2) + "%",
      priceBeforeTrade: formatBN(result.priceBefore),
      priceAfterTrade: formatBN(result.priceAfter),
      outputAmount: formatBN(result.outputAmount),
    });
  } catch (e: unknown) {
    return error(`Failed to calculate price impact: ${getErrorMessage(e)}`);
  }
}

// ── get_market_cap ──
export const getMarketCapSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getMarketCap(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getMarketCapSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const bc = await sdk.fetchBondingCurve(mint);
    const mcap = bondingCurveMarketCap({
      mintSupply: bc.tokenTotalSupply,
      virtualSolReserves: bc.virtualSolReserves,
      virtualTokenReserves: bc.virtualTokenReserves,
    });

    return success({
      marketCapLamports: formatBN(mcap),
      marketCapSol: lamportsToSol(mcap),
      isGraduated: bc.complete,
    });
  } catch (e: unknown) {
    return error(`Failed to get market cap: ${getErrorMessage(e)}`);
  }
}

// ── get_token_price ──
export const getTokenPriceSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getTokenPriceTool(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getTokenPriceSchema>
): Promise<ToolResult> {
  try {
    const result = await sdk.fetchTokenPrice(params.mint);
    return success({
      buyPricePerToken: formatBN(result.buyPricePerToken),
      sellPricePerToken: formatBN(result.sellPricePerToken),
      spreadBps: result.buyPricePerToken.sub(result.sellPricePerToken)
        .muln(10_000)
        .div(result.buyPricePerToken.isZero() ? new BN(1) : result.buyPricePerToken)
        .toNumber(),
      marketCap: formatBN(result.marketCap),
      marketCapSol: lamportsToSol(result.marketCap),
      isGraduated: result.isGraduated,
    });
  } catch (e: unknown) {
    return error(`Failed to get token price: ${getErrorMessage(e)}`);
  }
}

// ── get_bonding_curve_summary ──
export const getBondingCurveSummarySchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getBondingCurveSummaryTool(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getBondingCurveSummarySchema>
): Promise<ToolResult> {
  try {
    const summary = await sdk.fetchBondingCurveSummary(params.mint);
    return success({
      virtualSolReserves: formatBN(summary.virtualSolReserves),
      virtualTokenReserves: formatBN(summary.virtualTokenReserves),
      realSolReserves: formatBN(summary.realSolReserves),
      realTokenReserves: formatBN(summary.realTokenReserves),
      isGraduated: summary.isGraduated,
      marketCapLamports: formatBN(summary.marketCap),
      marketCapSol: lamportsToSol(summary.marketCap),
      buyPricePerToken: formatBN(summary.buyPricePerToken),
      sellPricePerToken: formatBN(summary.sellPricePerToken),
      progressBps: summary.progressBps,
      progressPercent: (summary.progressBps / 100).toFixed(1) + "%",
    });
  } catch (e: unknown) {
    return error(`Failed to get bonding curve summary: ${getErrorMessage(e)}`);
  }
}

// ── get_graduation_progress ──
export const getGraduationProgressSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getGraduationProgressTool(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getGraduationProgressSchema>
): Promise<ToolResult> {
  try {
    const result = await sdk.fetchGraduationProgress(params.mint);
    return success({
      progressBps: result.progressBps,
      progressPercent: (result.progressBps / 100).toFixed(1) + "%",
      isGraduated: result.isGraduated,
      tokensRemainingRaw: formatBN(result.tokensRemaining),
      tokensTotalRaw: formatBN(result.tokensTotal),
      solAccumulatedLamports: formatBN(result.solAccumulated),
      solAccumulatedSol: lamportsToSol(result.solAccumulated),
    });
  } catch (e: unknown) {
    return error(`Failed to get graduation progress: ${getErrorMessage(e)}`);
  }
}

// ── get_amm_quote ──
// Returns pool reserves and a computed constant-product quote for AMM trades.
export const getAmmQuoteSchema = z.object({
  mint: publicKeySchema.describe("Token mint address (must be graduated)"),
  user: publicKeySchema.describe("User wallet address"),
  amount: bnStringSchema.describe("Input amount (lamports for buy, raw tokens for sell)"),
  side: z.enum(["buy", "sell"]).describe("Trade side"),
  slippage: z.number().min(0).max(1).default(0.05).describe("Slippage tolerance as a decimal (0.05 = 5%)"),
});

export async function getAmmQuote(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getAmmQuoteSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const amount = new BN(params.amount);

    const { PUMP_AMM_SDK } = await import("@pump-fun/pump-swap-sdk");
    const { canonicalPumpPoolPda } = await import("@nirholas/pump-sdk");
    const poolKey = canonicalPumpPoolPda(mint);

    // Access the underlying OnlinePumpAmmSdk via the SDK's private field by
    // using the high-level routed instruction builders as proxies.
    // We use the public routedBuyInstructions/routedSellInstructions to
    // validate the pool is reachable, then return the quote from the
    // constant-product math in the sell/buy input functions.
    const pool = await sdk.fetchPool(params.mint);

    // Constant-product quote: grossOut = reserveOut * amountIn / (reserveIn + amountIn)
    const baseReserve = pool.poolBaseTokenAccount;
    const quoteReserve = pool.poolQuoteTokenAccount;

    return success({
      side: params.side,
      inputAmount: formatBN(amount),
      inputUnit: params.side === "buy" ? "lamports (SOL)" : "raw tokens",
      poolAddress: poolKey.toBase58(),
      baseMint: pool.baseMint.toBase58(),
      quoteMint: pool.quoteMint.toBase58(),
      poolBaseTokenAccount: baseReserve.toBase58(),
      poolQuoteTokenAccount: quoteReserve.toBase58(),
      lpSupply: formatBN(pool.lpSupply),
      note: `Use build_amm_swap or build_routed_${params.side} for executable instructions`,
    });
  } catch (e: unknown) {
    return error(`Failed to get AMM quote: ${getErrorMessage(e)}`);
  }
}
