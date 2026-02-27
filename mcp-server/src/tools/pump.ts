/**
 * Pump Protocol MCP Tool Implementations
 *
 * Provides the full Pump SDK surface as MCP tools:
 *   - Token creation, buying, selling
 *   - Bonding curve price quoting
 *   - Fee calculation and sharing
 *   - Token incentives / volume rewards
 *   - On-chain state reading
 *   - PDA derivation
 *   - Migration
 *
 * SECURITY: Uses only official @solana/web3.js and @pump-fun/pump-sdk.
 */

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import {
  PUMP_SDK,
  OnlinePumpSdk,
  // Bonding curve math
  getBuyTokenAmountFromSolAmount,
  getBuySolAmountFromTokenAmount,
  getSellSolAmountFromTokenAmount,
  bondingCurveMarketCap,
  newBondingCurve,
  // Fee helpers
  isCreatorUsingSharingConfig,
  // PDA derivation
  bondingCurvePda,
  creatorVaultPda,
  ammCreatorVaultPda,
  canonicalPumpPoolPda,
  feeSharingConfigPda,
  userVolumeAccumulatorPda,
  GLOBAL_PDA,
  AMM_GLOBAL_PDA,
  // Token incentives (pure math)
  totalUnclaimedTokens,
  currentDayTokens,
  // Constants
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  MAYHEM_PROGRAM_ID,
} from "@pump-fun/pump-sdk";
import type {
  Global,
  BondingCurve,
  FeeConfig,
} from "@pump-fun/pump-sdk";

interface Fees {
  lpFeeBps: BN;
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}

interface FeeTier {
  marketCapLamportsThreshold: BN;
  fees: Fees;
}

import type { ServerState, ToolResult } from "../types/index.js";

// ---------------------------------------------------------------------------
// Constants not exported from @pump-fun/pump-sdk
// ---------------------------------------------------------------------------

const MAX_SHAREHOLDERS = 10;
const PUMP_TOKEN_MINT = new PublicKey(
  "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
);

// ---------------------------------------------------------------------------
// Fee helpers (re-implemented locally — not exported from the SDK)
// ---------------------------------------------------------------------------

const ONE_BILLION_SUPPLY = new BN(1_000_000_000_000_000);

function ceilDiv(a: BN, b: BN): BN {
  return a.add(b.subn(1)).div(b);
}

function feeFromAmount(amount: BN, feeBasisPoints: BN): BN {
  return ceilDiv(amount.mul(feeBasisPoints), new BN(10_000));
}

function getFee({
  global,
  feeConfig,
  mintSupply,
  bondingCurve,
  amount,
  isNewBondingCurve,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  bondingCurve: BondingCurve;
  amount: BN;
  isNewBondingCurve: boolean;
}): BN {
  const { virtualSolReserves, virtualTokenReserves, isMayhemMode } =
    bondingCurve;
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig,
    mintSupply: isMayhemMode ? mintSupply : ONE_BILLION_SUPPLY,
    virtualSolReserves,
    virtualTokenReserves,
  });

  return feeFromAmount(amount, protocolFeeBps).add(
    isNewBondingCurve || !PublicKey.default.equals(bondingCurve.creator)
      ? feeFromAmount(amount, creatorFeeBps)
      : new BN(0),
  );
}

interface CalculatedFeesBps {
  protocolFeeBps: BN;
  creatorFeeBps: BN;
}

function computeFeesBps({
  global,
  feeConfig,
  mintSupply,
  virtualSolReserves,
  virtualTokenReserves,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  mintSupply: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
}): CalculatedFeesBps {
  if (feeConfig != null) {
    const marketCap = bondingCurveMarketCap({
      mintSupply,
      virtualSolReserves,
      virtualTokenReserves,
    });

    return calculateFeeTier({
      feeTiers: feeConfig.feeTiers,
      marketCap,
    });
  }

  return {
    protocolFeeBps: global.feeBasisPoints,
    creatorFeeBps: global.creatorFeeBasisPoints,
  };
}

function calculateFeeTier({
  feeTiers,
  marketCap,
}: {
  feeTiers: FeeTier[];
  marketCap: BN;
}): Fees {
  const firstTier = feeTiers[0];

  if (marketCap.lt(firstTier.marketCapLamportsThreshold)) {
    return firstTier.fees;
  }

  for (const tier of feeTiers.slice().reverse()) {
    if (marketCap.gte(tier.marketCapLamportsThreshold)) {
      return tier.fees;
    }
  }

  return firstTier.fees;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}
function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function bnToString(bn: BN): string {
  return bn.toString(10);
}

function parseBN(value: unknown, name: string): BN | null {
  if (value === undefined || value === null || value === "") return null;
  try {
    return new BN(String(value));
  } catch {
    return null;
  }
}

function requireBN(value: unknown, name: string): BN {
  const bn = parseBN(value, name);
  if (!bn) throw new Error(`Invalid ${name}: must be a numeric string`);
  return bn;
}

function requirePubkey(value: unknown, name: string): PublicKey {
  if (!value || typeof value !== "string")
    throw new Error(`${name} is required`);
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`Invalid ${name}: not a valid Solana public key`);
  }
}

function getConnection(rpcUrl?: string): Connection {
  const url =
    rpcUrl ||
    process.env.SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}

function formatLamports(lamports: BN | number): string {
  const val = typeof lamports === "number" ? lamports : lamports.toNumber();
  return `${(val / 1e9).toFixed(9)} SOL (${val} lamports)`;
}

function serializeInstructions(instructions: any[]): string {
  return JSON.stringify(
    instructions.map((ix: any) => ({
      programId: ix.programId.toBase58(),
      keys: ix.keys.map((k: any) => ({
        pubkey: k.pubkey.toBase58(),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })),
      data: bs58.encode(ix.data),
    })),
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Tool Dispatcher
// ---------------------------------------------------------------------------

export async function handlePumpToolCall(
  name: string,
  args: Record<string, unknown>,
  state: ServerState,
): Promise<ToolResult> {
  try {
    switch (name) {
      // ── Price Quoting ───────────────────────────────────────────────
      case "quote_buy":
        return await handleQuoteBuy(args);
      case "quote_sell":
        return await handleQuoteSell(args);
      case "quote_buy_cost":
        return await handleQuoteBuyCost(args);

      // ── Bonding Curve ───────────────────────────────────────────────
      case "get_market_cap":
        return await handleGetMarketCap(args);
      case "get_bonding_curve":
        return await handleGetBondingCurve(args);

      // ── Token Lifecycle ─────────────────────────────────────────────
      case "build_create_token":
        return await handleBuildCreateToken(args);
      case "build_create_and_buy":
        return await handleBuildCreateAndBuy(args);
      case "build_buy":
        return await handleBuildBuy(args);
      case "build_sell":
        return await handleBuildSell(args);
      case "build_migrate":
        return await handleBuildMigrate(args);

      // ── Fee System ──────────────────────────────────────────────────
      case "calculate_fees":
        return await handleCalculateFees(args);
      case "get_fee_tier":
        return await handleGetFeeTier(args);
      case "build_create_fee_sharing":
        return await handleBuildCreateFeeSharing(args);
      case "build_update_fee_shares":
        return await handleBuildUpdateFeeShares(args);
      case "build_distribute_fees":
        return await handleBuildDistributeFees(args);
      case "get_creator_vault_balance":
        return await handleGetCreatorVaultBalance(args);
      case "build_collect_creator_fees":
        return await handleBuildCollectCreatorFees(args);

      // ── Token Incentives ────────────────────────────────────────────
      case "build_init_volume_tracker":
        return await handleBuildInitVolumeTracker(args);
      case "build_claim_incentives":
        return await handleBuildClaimIncentives(args);
      case "get_unclaimed_rewards":
        return await handleGetUnclaimedRewards(args);
      case "get_volume_stats":
        return await handleGetVolumeStats(args);

      // ── PDA Derivation ──────────────────────────────────────────────
      case "derive_pda":
        return handleDerivePda(args);

      // ── On-Chain State ──────────────────────────────────────────────
      case "fetch_global_state":
        return await handleFetchGlobalState(args);
      case "fetch_fee_config":
        return await handleFetchFeeConfig(args);

      // ── Program Info ────────────────────────────────────────────────
      case "get_program_ids":
        return handleGetProgramIds();

      default:
        return err(`Unknown pump tool: ${name}`);
    }
  } catch (error) {
    return err(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ============================================================================
// PRICE QUOTING
// ============================================================================

async function handleQuoteBuy(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const solAmount = requireBN(args.solAmount, "solAmount");
  const rpcUrl = args.rpcUrl as string | undefined;
  const mintStr = args.mint as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();

  let bondingCurve = null;
  let mintSupply = null;

  if (mintStr) {
    const mint = new PublicKey(mintStr);
    const bc = await sdk.fetchBondingCurve(mint);
    if (bc) {
      bondingCurve = bc;
      mintSupply = bc.tokenTotalSupply;
    }
  }

  const tokenAmount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply,
    bondingCurve,
    amount: solAmount,
  });

  return ok(
    `🛒 Buy Quote\n\nInput: ${formatLamports(solAmount)}\nTokens received: ${bnToString(tokenAmount)}\n${mintStr ? `Mint: ${mintStr}` : "(New token — no existing bonding curve)"}\n\nThis is the expected token amount before slippage.`,
  );
}

async function handleQuoteSell(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tokenAmount = requireBN(args.tokenAmount, "tokenAmount");
  const mint = requirePubkey(args.mint, "mint");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();
  const bondingCurve = await sdk.fetchBondingCurve(mint);

  if (!bondingCurve) return err("Bonding curve not found for this mint");

  const solAmount = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: tokenAmount,
  });

  return ok(
    `💰 Sell Quote\n\nInput: ${bnToString(tokenAmount)} tokens\nSOL received: ${formatLamports(solAmount)}\nMint: ${mint.toBase58()}\n\nThis is the expected SOL amount before slippage.`,
  );
}

async function handleQuoteBuyCost(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tokenAmount = requireBN(args.tokenAmount, "tokenAmount");
  const mint = requirePubkey(args.mint, "mint");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();
  const bondingCurve = await sdk.fetchBondingCurve(mint);

  if (!bondingCurve) return err("Bonding curve not found for this mint");

  const solAmount = getBuySolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: tokenAmount,
  });

  return ok(
    `💸 Buy Cost Quote\n\nDesired tokens: ${bnToString(tokenAmount)}\nSOL cost: ${formatLamports(solAmount)}\nMint: ${mint.toBase58()}\n\nThis is the SOL required (including fees) to buy the specified token amount.`,
  );
}

// ============================================================================
// BONDING CURVE
// ============================================================================

async function handleGetMarketCap(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const mint = requirePubkey(args.mint, "mint");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const bondingCurve = await sdk.fetchBondingCurve(mint);

  if (!bondingCurve) return err("Bonding curve not found for this mint");

  const marketCap = bondingCurveMarketCap({
    mintSupply: bondingCurve.tokenTotalSupply,
    virtualSolReserves: bondingCurve.virtualSolReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });

  return ok(
    `📊 Market Cap\n\nMint: ${mint.toBase58()}\nMarket Cap: ${formatLamports(marketCap)}\nGraduated: ${bondingCurve.complete ? "Yes ✅" : "No"}\nVirtual SOL Reserves: ${formatLamports(bondingCurve.virtualSolReserves)}\nVirtual Token Reserves: ${bnToString(bondingCurve.virtualTokenReserves)}`,
  );
}

async function handleGetBondingCurve(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const mint = requirePubkey(args.mint, "mint");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const bondingCurve = await sdk.fetchBondingCurve(mint);
  if (!bondingCurve) return err("Bonding curve not found for this mint");

  return ok(
    `📈 Bonding Curve State\n\nMint: ${mint.toBase58()}\nComplete (graduated): ${bondingCurve.complete ? "Yes ✅" : "No"}\nVirtual SOL Reserves: ${formatLamports(bondingCurve.virtualSolReserves)}\nVirtual Token Reserves: ${bnToString(bondingCurve.virtualTokenReserves)}\nReal SOL Reserves: ${formatLamports(bondingCurve.realSolReserves)}\nReal Token Reserves: ${bnToString(bondingCurve.realTokenReserves)}\nToken Total Supply: ${bnToString(bondingCurve.tokenTotalSupply)}\nCreator: ${bondingCurve.creator?.toBase58() ?? "N/A"}`,
  );
}

// ============================================================================
// TOKEN LIFECYCLE — INSTRUCTION BUILDERS
// ============================================================================

async function handleBuildCreateToken(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const creator = requirePubkey(args.creator, "creator");
  const name = args.name as string;
  const symbol = args.symbol as string;
  const uri = args.uri as string;
  const mayhemMode = (args.mayhemMode as boolean) ?? false;

  if (!name) return err("name is required");
  if (!symbol) return err("symbol is required");
  if (!uri) return err("uri is required");

  // Generate a mint keypair — the caller needs to sign with it
  const mint = Keypair.generate();

  const instruction = await PUMP_SDK.createV2Instruction({
    mint: mint.publicKey,
    name,
    symbol,
    uri,
    creator,
    user: creator,
    mayhemMode,
  });

  return ok(
    `🚀 Create Token Instruction Built\n\nMint Public Key: ${mint.publicKey.toBase58()}\nMint Secret Key (Base58): ${bs58.encode(mint.secretKey)}\nName: ${name}\nSymbol: ${symbol}\nURI: ${uri}\nCreator: ${creator.toBase58()}\nMayhem Mode: ${mayhemMode}\n\n⚠️ The mint keypair must sign the transaction. Save the secret key above.\n\nInstruction:\n${serializeInstructions([instruction])}`,
  );
}

async function handleBuildCreateAndBuy(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const creator = requirePubkey(args.creator, "creator");
  const name = args.name as string;
  const symbol = args.symbol as string;
  const uri = args.uri as string;
  const solAmount = requireBN(args.solAmount, "solAmount");
  const mayhemMode = (args.mayhemMode as boolean) ?? false;

  if (!name) return err("name is required");
  if (!symbol) return err("symbol is required");
  if (!uri) return err("uri is required");

  const mint = Keypair.generate();
  const rpcUrl = args.rpcUrl as string | undefined;
  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();

  const tokenAmount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: null,
    bondingCurve: null,
    amount: solAmount,
  });

  const instructions = await PUMP_SDK.createV2AndBuyInstructions({
    global,
    mint: mint.publicKey,
    name,
    symbol,
    uri,
    creator,
    user: creator,
    amount: tokenAmount,
    solAmount,
    mayhemMode,
    cashback: false,
  });

  return ok(
    `🚀 Create + Buy Instructions Built\n\nMint Public Key: ${mint.publicKey.toBase58()}\nMint Secret Key (Base58): ${bs58.encode(mint.secretKey)}\nName: ${name}\nSymbol: ${symbol}\nSOL Amount: ${formatLamports(solAmount)}\nTokens to Receive: ${bnToString(tokenAmount)}\nInstructions Count: ${instructions.length}\n\n⚠️ The mint keypair must sign the transaction.\n\nInstructions:\n${serializeInstructions(instructions)}`,
  );
}

async function handleBuildBuy(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const mint = requirePubkey(args.mint, "mint");
  const user = requirePubkey(args.user, "user");
  const solAmount = requireBN(args.solAmount, "solAmount");
  const slippage = (args.slippage as number) ?? 2;
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();
  const {
    bondingCurveAccountInfo,
    bondingCurve,
    associatedUserAccountInfo,
  } = await sdk.fetchBuyState(mint, user);

  const tokenAmount = getBuyTokenAmountFromSolAmount({
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
    associatedUserAccountInfo,
    mint,
    user,
    solAmount,
    amount: tokenAmount,
    slippage,
    tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  });

  return ok(
    `🛒 Buy Instructions Built\n\nMint: ${mint.toBase58()}\nUser: ${user.toBase58()}\nSOL Amount: ${formatLamports(solAmount)}\nTokens to Receive: ${bnToString(tokenAmount)}\nSlippage: ${slippage}%\nInstructions Count: ${instructions.length}\n\nInstructions:\n${serializeInstructions(instructions)}`,
  );
}

async function handleBuildSell(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const mint = requirePubkey(args.mint, "mint");
  const user = requirePubkey(args.user, "user");
  const tokenAmount = requireBN(args.tokenAmount, "tokenAmount");
  const slippage = (args.slippage as number) ?? 1;
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();
  const { bondingCurveAccountInfo, bondingCurve } = await sdk.fetchSellState(
    mint,
    user,
  );

  const solAmount = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: tokenAmount,
  });

  const instructions = await PUMP_SDK.sellInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    mint,
    user,
    amount: tokenAmount,
    solAmount,
    slippage,
    tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    mayhemMode: false,
  });

  return ok(
    `💰 Sell Instructions Built\n\nMint: ${mint.toBase58()}\nUser: ${user.toBase58()}\nTokens to Sell: ${bnToString(tokenAmount)}\nSOL to Receive: ${formatLamports(solAmount)}\nSlippage: ${slippage}%\nInstructions Count: ${instructions.length}\n\nInstructions:\n${serializeInstructions(instructions)}`,
  );
}

async function handleBuildMigrate(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const mint = requirePubkey(args.mint, "mint");
  const user = requirePubkey(args.user, "user");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);
  const global = await sdk.fetchGlobal();

  const instruction = await PUMP_SDK.migrateInstruction({
    withdrawAuthority: global.withdrawAuthority,
    mint,
    user,
    tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  });

  return ok(
    `🎓 Migrate Instruction Built\n\nMint: ${mint.toBase58()}\nUser: ${user.toBase58()}\nPool PDA: ${canonicalPumpPoolPda(mint).toBase58()}\n\nThis migrates a graduated token from the bonding curve to an AMM pool.\n\nInstruction:\n${serializeInstructions([instruction])}`,
  );
}

// ============================================================================
// FEE SYSTEM
// ============================================================================

async function handleCalculateFees(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const amount = requireBN(args.amount, "amount");
  const mint = requirePubkey(args.mint, "mint");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const global = await sdk.fetchGlobal();
  const feeConfig = await sdk.fetchFeeConfig();
  const bondingCurve = await sdk.fetchBondingCurve(mint);

  if (!bondingCurve) return err("Bonding curve not found");

  const marketCap = bondingCurveMarketCap({
    mintSupply: bondingCurve.tokenTotalSupply,
    virtualSolReserves: bondingCurve.virtualSolReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });

  const fee = getFee({ global, feeConfig, mintSupply: bondingCurve.tokenTotalSupply, bondingCurve, amount, isNewBondingCurve: false });
  const feesBps = computeFeesBps({ global, feeConfig, mintSupply: bondingCurve.tokenTotalSupply, virtualSolReserves: bondingCurve.virtualSolReserves, virtualTokenReserves: bondingCurve.virtualTokenReserves });

  return ok(
    `💸 Fee Calculation\n\nAmount: ${formatLamports(amount)}\nMint: ${mint.toBase58()}\nMarket Cap: ${formatLamports(marketCap)}\n\nTotal Fee: ${formatLamports(fee)}\nFee BPS:\n  Protocol Fee: ${feesBps.protocolFeeBps.toString()} bps\n  Creator Fee: ${feesBps.creatorFeeBps.toString()} bps`,
  );
}

async function handleGetFeeTier(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const marketCapLamports = requireBN(args.marketCapLamports, "marketCapLamports");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);
  const feeConfig = await sdk.fetchFeeConfig();

  const tier = calculateFeeTier({ feeTiers: feeConfig.feeTiers, marketCap: marketCapLamports });

  return ok(
    `📊 Fee Tier\n\nMarket Cap: ${formatLamports(marketCapLamports)}\n\nApplicable Fees:\n  LP Fee: ${tier.lpFeeBps.toString()} bps\n  Protocol Fee: ${tier.protocolFeeBps.toString()} bps\n  Creator Fee: ${tier.creatorFeeBps.toString()} bps`,
  );
}

async function handleBuildCreateFeeSharing(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const creator = requirePubkey(args.creator, "creator");
  const mint = requirePubkey(args.mint, "mint");

  const instruction = await PUMP_SDK.createFeeSharingConfig({
    creator,
    mint,
    pool: null,
  });

  return ok(
    `📋 Fee Sharing Config Created\n\nCreator: ${creator.toBase58()}\nMint: ${mint.toBase58()}\nConfig PDA: ${feeSharingConfigPda(mint).toBase58()}\n\nInstruction:\n${serializeInstructions([instruction])}`,
  );
}

async function handleBuildUpdateFeeShares(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const authority = requirePubkey(args.authority, "authority");
  const mint = requirePubkey(args.mint, "mint");
  const shareholders = args.shareholders as
    | Array<{ address: string; shareBps: number }>
    | undefined;

  if (
    !shareholders ||
    !Array.isArray(shareholders) ||
    shareholders.length === 0
  )
    return err("shareholders array is required");
  if (shareholders.length > MAX_SHAREHOLDERS)
    return err(`Maximum ${MAX_SHAREHOLDERS} shareholders allowed`);

  const totalBps = shareholders.reduce((sum, s) => sum + s.shareBps, 0);
  if (totalBps !== 10000)
    return err(`Shares must total 10,000 bps (got ${totalBps})`);

  const newShareholders = shareholders.map((s) => ({
    address: new PublicKey(s.address),
    shareBps: s.shareBps,
  }));

  const instruction = await PUMP_SDK.updateFeeShares({
    authority,
    mint,
    currentShareholders: [],
    newShareholders,
  });

  return ok(
    `📝 Fee Shares Updated\n\nMint: ${mint.toBase58()}\nAuthority: ${authority.toBase58()}\nShareholders:\n${shareholders.map((s) => `  ${s.address}: ${s.shareBps} bps (${(s.shareBps / 100).toFixed(1)}%)`).join("\n")}\n\nInstruction:\n${serializeInstructions([instruction])}`,
  );
}

async function handleBuildDistributeFees(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const mint = requirePubkey(args.mint, "mint");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const result = await sdk.getMinimumDistributableFee(mint);

  if (!result.canDistribute) {
    return ok(
      `⚠️ Cannot distribute fees yet\n\nMint: ${mint.toBase58()}\nMinimum not met. Accumulate more trading fees first.`,
    );
  }

  const { instructions } =
    await sdk.buildDistributeCreatorFeesInstructions(mint);

  return ok(
    `💸 Distribute Fees Instructions Built\n\nMint: ${mint.toBase58()}\nInstructions Count: ${instructions.length}\n\nInstructions:\n${serializeInstructions(instructions)}`,
  );
}

async function handleGetCreatorVaultBalance(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const creator = requirePubkey(args.creator, "creator");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const balance = await sdk.getCreatorVaultBalanceBothPrograms(creator);

  return ok(
    `💎 Creator Vault Balance\n\nCreator: ${creator.toBase58()}\nTotal Balance (Pump + AMM): ${formatLamports(balance)}\n\nPump Vault PDA: ${creatorVaultPda(creator).toBase58()}\nAMM Vault PDA: ${ammCreatorVaultPda(creator).toBase58()}`,
  );
}

async function handleBuildCollectCreatorFees(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const creator = requirePubkey(args.creator, "creator");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const instructions = await sdk.collectCoinCreatorFeeInstructions(creator);

  return ok(
    `💰 Collect Creator Fee Instructions Built\n\nCreator: ${creator.toBase58()}\nInstructions Count: ${instructions.length}\n\nInstructions:\n${serializeInstructions(instructions)}`,
  );
}

// ============================================================================
// TOKEN INCENTIVES / VOLUME REWARDS
// ============================================================================

async function handleBuildInitVolumeTracker(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const user = requirePubkey(args.user, "user");
  const payer = args.payer
    ? requirePubkey(args.payer, "payer")
    : user;

  const instruction = await PUMP_SDK.initUserVolumeAccumulator({
    payer,
    user,
  });

  return ok(
    `📊 Init Volume Tracker Instruction Built\n\nUser: ${user.toBase58()}\nPayer: ${payer.toBase58()}\nAccumulator PDA: ${userVolumeAccumulatorPda(user).toBase58()}\n\nInstruction:\n${serializeInstructions([instruction])}`,
  );
}

async function handleBuildClaimIncentives(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const user = requirePubkey(args.user, "user");
  const payer = args.payer
    ? requirePubkey(args.payer, "payer")
    : user;
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const instructions = await sdk.claimTokenIncentivesBothPrograms(user, payer);

  return ok(
    `🎁 Claim Incentives Instructions Built\n\nUser: ${user.toBase58()}\nPayer: ${payer.toBase58()}\nInstructions Count: ${instructions.length}\n\nInstructions:\n${serializeInstructions(instructions)}`,
  );
}

async function handleGetUnclaimedRewards(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const user = requirePubkey(args.user, "user");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const unclaimed = await sdk.getTotalUnclaimedTokensBothPrograms(user);
  const currentDay = await sdk.getCurrentDayTokensBothPrograms(user);

  return ok(
    `🎁 Token Incentive Rewards\n\nUser: ${user.toBase58()}\nTotal Unclaimed: ${bnToString(unclaimed)} tokens\nCurrent Day Earned: ${bnToString(currentDay)} tokens\n\nUse build_claim_incentives to claim these rewards.`,
  );
}

async function handleGetVolumeStats(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const user = requirePubkey(args.user, "user");
  const rpcUrl = args.rpcUrl as string | undefined;

  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const stats = await sdk.fetchUserVolumeAccumulatorTotalStats(user);

  return ok(
    `📊 Volume Statistics\n\nUser: ${user.toBase58()}\nTotal SOL Volume: ${formatLamports(stats.currentSolVolume)}\nTotal Unclaimed Tokens: ${bnToString(stats.totalUnclaimedTokens)}\nTotal Claimed Tokens: ${bnToString(stats.totalClaimedTokens)}`,

  );
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

function handleDerivePda(args: Record<string, unknown>): ToolResult {
  const pdaType = args.type as string;
  const address = args.address as string | undefined;

  if (!pdaType) return err("type is required");

  try {
    let pda: PublicKey;
    let description: string;

    switch (pdaType) {
      case "bonding_curve": {
        const mint = requirePubkey(address, "address (mint)");
        pda = bondingCurvePda(mint);
        description = `Bonding curve account for mint ${mint.toBase58()}`;
        break;
      }
      case "creator_vault": {
        const creator = requirePubkey(address, "address (creator)");
        pda = creatorVaultPda(creator);
        description = `Creator vault for ${creator.toBase58()}`;
        break;
      }
      case "amm_creator_vault": {
        const creator = requirePubkey(address, "address (creator)");
        pda = ammCreatorVaultPda(creator);
        description = `AMM creator vault for ${creator.toBase58()}`;
        break;
      }
      case "canonical_pool": {
        const mint = requirePubkey(address, "address (mint)");
        pda = canonicalPumpPoolPda(mint);
        description = `Canonical AMM pool for mint ${mint.toBase58()}`;
        break;
      }
      case "fee_sharing_config": {
        const mint = requirePubkey(address, "address (mint)");
        pda = feeSharingConfigPda(mint);
        description = `Fee sharing config for mint ${mint.toBase58()}`;
        break;
      }
      case "user_volume_accumulator": {
        const user = requirePubkey(address, "address (user)");
        pda = userVolumeAccumulatorPda(user);
        description = `User volume accumulator for ${user.toBase58()}`;
        break;
      }
      case "global":
        pda = GLOBAL_PDA;
        description = "Global config account (Pump program)";
        break;
      case "amm_global":
        pda = AMM_GLOBAL_PDA;
        description = "Global config account (AMM program)";
        break;
      default:
        return err(
          `Unknown PDA type: ${pdaType}. Valid types: bonding_curve, creator_vault, amm_creator_vault, canonical_pool, fee_sharing_config, user_volume_accumulator, global, amm_global`,
        );
    }

    return ok(`🔑 PDA Derivation\n\nType: ${pdaType}\nPDA: ${pda.toBase58()}\n${description}`);
  } catch (error) {
    return err(
      `PDA derivation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ============================================================================
// ON-CHAIN STATE
// ============================================================================

async function handleFetchGlobalState(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const rpcUrl = args.rpcUrl as string | undefined;
  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const global = await sdk.fetchGlobal();

  return ok(
    `🌍 Global State\n\nGlobal PDA: ${GLOBAL_PDA.toBase58()}\nInitialized: ${global.initialized}\nAuthority: ${global.authority?.toBase58() ?? "N/A"}\nFee Recipient: ${global.feeRecipient?.toBase58() ?? "N/A"}\nInitial Virtual Token Reserves: ${bnToString(global.initialVirtualTokenReserves)}\nInitial Virtual SOL Reserves: ${bnToString(global.initialVirtualSolReserves)}\nInitial Real Token Reserves: ${bnToString(global.initialRealTokenReserves)}\nToken Total Supply: ${bnToString(global.tokenTotalSupply)}`,
  );
}

async function handleFetchFeeConfig(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const rpcUrl = args.rpcUrl as string | undefined;
  const connection = getConnection(rpcUrl);
  const sdk = new OnlinePumpSdk(connection);

  const feeConfig = await sdk.fetchFeeConfig();

  const tiers = feeConfig.feeTiers
    .map(
      (t: any, i: number) =>
        `  Tier ${i + 1}: Market Cap ≥ ${formatLamports(t.marketCapLamportsThreshold)} → LP: ${t.fees.lpFeeBps}bps, Protocol: ${t.fees.protocolFeeBps}bps, Creator: ${t.fees.creatorFeeBps}bps`,
    )
    .join("\n");

  return ok(
    `💰 Fee Configuration\n\nFlat Fees:\n  LP: ${feeConfig.flatFees.lpFeeBps} bps\n  Protocol: ${feeConfig.flatFees.protocolFeeBps} bps\n  Creator: ${feeConfig.flatFees.creatorFeeBps} bps\n\nFee Tiers:\n${tiers || "  No tiers configured"}`,
  );
}

// ============================================================================
// PROGRAM INFO
// ============================================================================

function handleGetProgramIds(): ToolResult {
  return ok(
    `🔗 Pump Protocol Program IDs\n\nPump: ${PUMP_PROGRAM_ID.toBase58()}\n  Token creation, bonding curve buy/sell\n\nPumpAMM: ${PUMP_AMM_PROGRAM_ID.toBase58()}\n  AMM pools for graduated tokens\n\nPumpFees: ${PUMP_FEE_PROGRAM_ID.toBase58()}\n  Fee sharing configuration & distribution\n\nMayhem: ${MAYHEM_PROGRAM_ID.toBase58()}\n  Alternate routing mode\n\nPump Token Mint: ${PUMP_TOKEN_MINT.toBase58()}\n  $PUMP incentive token\n\nMax Shareholders: ${MAX_SHAREHOLDERS}`,
  );
}
