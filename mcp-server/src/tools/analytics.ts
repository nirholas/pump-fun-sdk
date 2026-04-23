import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  PUMP_SDK,
  bondingCurveMarketCap,
} from "@nirholas/pump-sdk";
import type { OnlinePumpSdk } from "@nirholas/pump-sdk";
import { publicKeySchema } from "../utils/validation.js";
import { lamportsToSol, rawToTokens, formatBN } from "../utils/formatting.js";
import { success, error, getErrorMessage } from "../types.js";
import type { ToolResult } from "../types.js";

// ── get_bonding_curve_state ──
export const getBondingCurveStateSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getBondingCurveState(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getBondingCurveStateSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const bondingCurve = await sdk.fetchBondingCurve(mint);

    return success({
      virtualTokenReserves: formatBN(bondingCurve.virtualTokenReserves),
      virtualSolReserves: formatBN(bondingCurve.virtualSolReserves),
      realTokenReserves: formatBN(bondingCurve.realTokenReserves),
      realSolReserves: formatBN(bondingCurve.realSolReserves),
      tokenTotalSupply: formatBN(bondingCurve.tokenTotalSupply),
      complete: bondingCurve.complete,
      creator: bondingCurve.creator.toBase58(),
    });
  } catch (e: unknown) {
    return error(`Failed to get bonding curve state: ${getErrorMessage(e)}`);
  }
}

// ── get_token_info ──
export const getTokenInfoSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getTokenInfo(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getTokenInfoSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const bondingCurve = await sdk.fetchBondingCurve(mint);
    const marketCap = bondingCurveMarketCap({
      mintSupply: bondingCurve.virtualTokenReserves,
      virtualSolReserves: bondingCurve.virtualSolReserves,
      virtualTokenReserves: bondingCurve.virtualTokenReserves,
    });

    return success({
      mint: params.mint,
      creator: bondingCurve.creator.toBase58(),
      complete: bondingCurve.complete,
      marketCapLamports: formatBN(marketCap),
      marketCapSol: lamportsToSol(marketCap),
      virtualSolReserves: lamportsToSol(bondingCurve.virtualSolReserves),
      virtualTokenReserves: rawToTokens(bondingCurve.virtualTokenReserves),
    });
  } catch (e: unknown) {
    return error(`Failed to get token info: ${getErrorMessage(e)}`);
  }
}

// ── get_creator_profile ──
export const getCreatorProfileSchema = z.object({
  creator: publicKeySchema.describe("Creator wallet address"),
});

export async function getCreatorProfile(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getCreatorProfileSchema>
): Promise<ToolResult> {
  try {
    const creator = new PublicKey(params.creator);
    const vaultBalance = await sdk.getCreatorVaultBalanceBothPrograms(creator);

    return success({
      creator: params.creator,
      vaultBalanceLamports: formatBN(vaultBalance),
      vaultBalanceSol: lamportsToSol(vaultBalance),
      note: "Use RPC token accounts query for full launch history.",
    });
  } catch (e: unknown) {
    return error(`Failed to get creator profile: ${getErrorMessage(e)}`);
  }
}

// ── get_token_holders ──
export const getTokenHoldersSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getTokenHolders(
  _sdk: OnlinePumpSdk,
  params: z.infer<typeof getTokenHoldersSchema>
): Promise<ToolResult> {
  try {
    return success({
      mint: params.mint,
      note: "Token holder data requires RPC getProgramAccounts with token filter. Use getTokenLargestAccounts on your Solana connection for top holders.",
    });
  } catch (e: unknown) {
    return error(`Failed to get token holders: ${getErrorMessage(e)}`);
  }
}

// ── get_recent_trades ──
export const getRecentTradesSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getRecentTrades(
  _sdk: OnlinePumpSdk,
  params: z.infer<typeof getRecentTradesSchema>
): Promise<ToolResult> {
  try {
    return success({
      mint: params.mint,
      note: "Recent trades require parsing transaction history. Use getSignaturesForAddress on the bonding curve PDA and decode TradeEvent from each transaction's logs.",
    });
  } catch (e: unknown) {
    return error(`Failed to get recent trades: ${getErrorMessage(e)}`);
  }
}

// ── get_sol_usd_price ──
export const getSolUsdPriceSchema = z.object({});

export async function getSolUsdPrice(
  _sdk: OnlinePumpSdk,
  _params: z.infer<typeof getSolUsdPriceSchema>
): Promise<ToolResult> {
  try {
    const response = await fetch(
      "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112"
    );
    if (!response.ok) {
      return error(`Jupiter API error: HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      data: Record<string, { price: string }>;
    };
    const solPrice =
      data.data["So11111111111111111111111111111111111111112"]?.price;

    return success({
      solUsdPrice: solPrice ?? "unavailable",
      source: "Jupiter Price API v2",
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return error(`Failed to get SOL/USD price: ${getErrorMessage(e)}`);
  }
}

// ── get_graduation_status ──
export const getGraduationStatusSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function getGraduationStatus(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getGraduationStatusSchema>
): Promise<ToolResult> {
  try {
    const graduated = await sdk.isGraduated(params.mint);
    const progress = await sdk.fetchGraduationProgress(params.mint);

    return success({
      mint: params.mint,
      graduated,
      progressBps: progress.progressBps,
      isGraduated: progress.isGraduated,
      tokensRemaining: formatBN(progress.tokensRemaining),
      solAccumulated: formatBN(progress.solAccumulated),
    });
  } catch (e: unknown) {
    return error(`Failed to get graduation status: ${getErrorMessage(e)}`);
  }
}

// ── get_token_balance ──
export const getTokenBalanceSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
  user: publicKeySchema.describe("User wallet address"),
  tokenProgram: z.string().optional().describe("Token program (optional — auto-detected from mint)"),
});

export async function getTokenBalance(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getTokenBalanceSchema>
): Promise<ToolResult> {
  try {
    const mint = new PublicKey(params.mint);
    const user = new PublicKey(params.user);
    const tokenProgram = params.tokenProgram ? new PublicKey(params.tokenProgram) : undefined;

    const balance = await sdk.getTokenBalance(mint, user, tokenProgram);

    return success({
      mint: params.mint,
      user: params.user,
      balanceRaw: formatBN(balance),
      balanceTokens: rawToTokens(balance),
    });
  } catch (e: unknown) {
    return error(`Failed to get token balance: ${getErrorMessage(e)}`);
  }
}

// ── is_graduated ──
export const isGraduatedSchema = z.object({
  mint: publicKeySchema.describe("Token mint address"),
});

export async function isGraduatedTool(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof isGraduatedSchema>
): Promise<ToolResult> {
  try {
    const graduated = await sdk.isGraduated(params.mint);
    return success({ mint: params.mint, graduated });
  } catch (e: unknown) {
    return error(`Failed to check graduation: ${getErrorMessage(e)}`);
  }
}

// ── fetch_multiple_bonding_curves ──
export const fetchMultipleBondingCurvesSchema = z.object({
  mints: z.array(publicKeySchema).min(1).max(100).describe("Array of token mint addresses (max 100)"),
});

export async function fetchMultipleBondingCurves(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof fetchMultipleBondingCurvesSchema>
): Promise<ToolResult> {
  try {
    const mints = params.mints.map((m) => new PublicKey(m));
    const results = await sdk.fetchMultipleBondingCurves(mints);

    const data: Record<string, unknown> = {};
    for (const [mint, bc] of results.entries()) {
      data[mint] = bc
        ? {
            virtualSolReserves: formatBN(bc.virtualSolReserves),
            virtualTokenReserves: formatBN(bc.virtualTokenReserves),
            realTokenReserves: formatBN(bc.realTokenReserves),
            complete: bc.complete,
            creator: bc.creator.toBase58(),
            isMayhemMode: bc.isMayhemMode,
          }
        : null;
    }

    return success({ count: mints.length, bondingCurves: data });
  } catch (e: unknown) {
    return error(`Failed to fetch bonding curves: ${getErrorMessage(e)}`);
  }
}

// ── parse_transaction_events ──
export const parseTransactionEventsSchema = z.object({
  signature: z.string().describe("Transaction signature to decode"),
});

export async function parseTransactionEvents(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof parseTransactionEventsSchema>
): Promise<ToolResult> {
  try {
    const events = await sdk.parseTransactionEvents(params.signature);
    return success({
      signature: params.signature,
      eventCount: events.length,
      events: events.map((e) => ({ type: e.type, data: e.data })),
    });
  } catch (e: unknown) {
    return error(`Failed to parse transaction events: ${getErrorMessage(e)}`);
  }
}

// ── get_pool_by_address ──
export const getPoolByAddressSchema = z.object({
  poolAddress: publicKeySchema.describe("PumpAMM pool account address"),
});

export async function getPoolByAddress(
  sdk: OnlinePumpSdk,
  params: z.infer<typeof getPoolByAddressSchema>
): Promise<ToolResult> {
  try {
    const pool = await sdk.fetchPoolByAddress(params.poolAddress);
    return success({
      poolAddress: params.poolAddress,
      baseMint: pool.baseMint.toBase58(),
      quoteMint: pool.quoteMint.toBase58(),
      lpMint: pool.lpMint.toBase58(),
      lpSupply: formatBN(pool.lpSupply),
      creator: pool.creator.toBase58(),
      coinCreator: pool.coinCreator.toBase58(),
      poolBaseTokenAccount: pool.poolBaseTokenAccount.toBase58(),
      poolQuoteTokenAccount: pool.poolQuoteTokenAccount.toBase58(),
    });
  } catch (e: unknown) {
    return error(`Failed to fetch pool by address: ${getErrorMessage(e)}`);
  }
}
