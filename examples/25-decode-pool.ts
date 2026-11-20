/**
 * Example 25: Decode an AMM Pool
 *
 * Category: Accounts & Events
 *
 * Decodes a live PumpAMM Pool account with decodePool and the program's
 * GlobalConfig with decodeAmmGlobalConfig, then reads them together: is
 * this the canonical pool for its mint, what does a swap actually pay in
 * fees, and does the coin creator route fees through a sharing config.
 *
 * Run: npm run example 25
 */
import {
  AMM_GLOBAL_CONFIG_PDA,
  CANONICAL_POOL_INDEX,
  PUMP_SDK,
  canonicalPumpPoolPda,
  isCreatorUsingSharingConfig,
  type AmmGlobalConfig,
  type Pool,
} from "@nirholas/pump-sdk";
import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { findGraduatedMint } from "./_lib/discovery";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

/**
 * Run one RPC call, retrying once when the endpoint answers 429.
 *
 * The public mainnet endpoint rate limits aggressively, and a single 429
 * in the middle of a read-only walkthrough is not a real failure. Shared
 * by the sibling live examples (25 to 32) so the pacing and the message a
 * reader sees are identical everywhere.
 */
export async function withRpcRetry<T>(
  label: string,
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!isRateLimited(error)) throw error;
    console.log(
      `${label}: RPC answered 429 (rate limited). Retrying once in 2s. ` +
        "Set PUMP_RPC_URL to a dedicated endpoint to avoid this.",
    );
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    return await call();
  }
}

/** True when an RPC error is a rate limit rather than a real fault. */
export function isRateLimited(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("429") ||
    /too many requests/i.test(message) ||
    /rate limit/i.test(message)
  );
}

/** Everything a reader wants to know about a pool, derived from its state. */
export interface PoolInterpretation {
  /** The pool lives at the canonical PDA for its base mint. */
  isCanonical: boolean;
  /** The pool prices its token in wrapped SOL. */
  quoteIsWrappedSol: boolean;
  /** LP tokens exist, so the migration deposit landed. */
  hasLiquidity: boolean;
  /** A coin creator is set and therefore earns creator fees. */
  hasCoinCreator: boolean;
  /** The coin creator address IS the mint's fee sharing config PDA. */
  creatorFeesShared: boolean;
  /** LP + protocol + coin creator fee, in basis points of the quote leg. */
  totalFeeBps: BN;
  /** Fee split, in basis points, exactly as GlobalConfig stores it. */
  lpFeeBps: BN;
  protocolFeeBps: BN;
  coinCreatorFeeBps: BN;
  /** Every AMM instruction is currently enabled for this program. */
  allInstructionsEnabled: boolean;
}

/**
 * Interpret a decoded pool against the program's global config. Pure: no
 * RPC, no floats.
 *
 * The two accounts answer different halves of the same question. The Pool
 * says who the token is and who earns creator fees; the GlobalConfig says
 * what a swap costs, because the fee rates live on the program, not on the
 * pool. `disableFlags` is a program-wide bitmask that the AMM currently
 * leaves at zero (see https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_SWAP_README.md), so a
 * non-zero value means some instruction has been switched off globally.
 */
export function interpretPool({
  pool,
  poolAddress,
  globalConfig,
}: {
  pool: Pool;
  poolAddress: PublicKey;
  globalConfig: AmmGlobalConfig;
}): PoolInterpretation {
  const lpFeeBps = globalConfig.lpFeeBasisPoints;
  const protocolFeeBps = globalConfig.protocolFeeBasisPoints;
  const coinCreatorFeeBps = globalConfig.coinCreatorFeeBasisPoints;

  return {
    isCanonical:
      pool.index === CANONICAL_POOL_INDEX &&
      canonicalPumpPoolPda(pool.baseMint).equals(poolAddress),
    quoteIsWrappedSol: pool.quoteMint.equals(NATIVE_MINT),
    hasLiquidity: !pool.lpSupply.isZero(),
    hasCoinCreator: !pool.coinCreator.equals(PublicKey.default),
    creatorFeesShared: isCreatorUsingSharingConfig({
      mint: pool.baseMint,
      creator: pool.coinCreator,
    }),
    totalFeeBps: lpFeeBps.add(protocolFeeBps).add(coinCreatorFeeBps),
    lpFeeBps,
    protocolFeeBps,
    coinCreatorFeeBps,
    allInstructionsEnabled: globalConfig.disableFlags === 0,
  };
}

export async function main(): Promise<void> {
  const connection = getConnection();

  heading("Finding a live pool");
  const { mint, pool: poolAddress } = await findGraduatedMint(connection);
  row("Base mint", mint.toBase58());
  row("Pool address", poolAddress.toBase58());

  // Two accounts, one RPC round trip.
  const [poolInfo, configInfo] = await withRpcRetry("pool + global config", () =>
    connection.getMultipleAccountsInfo([poolAddress, AMM_GLOBAL_CONFIG_PDA]),
  );
  if (!poolInfo) {
    throw new Error(`Pool account ${poolAddress.toBase58()} disappeared mid-run`);
  }
  if (!configInfo) {
    throw new Error(
      `PumpAMM global config ${AMM_GLOBAL_CONFIG_PDA.toBase58()} not found`,
    );
  }

  const pool = PUMP_SDK.decodePool(poolInfo);
  const globalConfig = PUMP_SDK.decodeAmmGlobalConfig(configInfo);

  heading("decodePool");
  row("Pool bump / index", `${pool.poolBump} / ${pool.index}`);
  row("Creator", pool.creator.toBase58());
  row("Coin creator", pool.coinCreator.toBase58());
  row("Base mint", pool.baseMint.toBase58());
  row("Quote mint", pool.quoteMint.toBase58());
  row("LP mint", pool.lpMint.toBase58());
  row("LP supply", pool.lpSupply.toString());
  row("Mayhem mode", pool.isMayhemMode);
  row("Cashback coin", pool.isCashbackCoin);

  heading("decodeAmmGlobalConfig");
  row("Admin", globalConfig.admin.toBase58());
  row("LP fee", `${globalConfig.lpFeeBasisPoints.toString()} bps`);
  row("Protocol fee", `${globalConfig.protocolFeeBasisPoints.toString()} bps`);
  row(
    "Coin creator fee",
    `${globalConfig.coinCreatorFeeBasisPoints.toString()} bps`,
  );
  row("Protocol fee recipients", globalConfig.protocolFeeRecipients.length);
  row("Disable flags", globalConfig.disableFlags);
  row("Cashback enabled", globalConfig.isCashbackEnabled);

  heading("Interpretation");
  const view = interpretPool({ pool, poolAddress, globalConfig });
  row("Canonical pool for mint", view.isCanonical);
  row("Quote leg is wSOL", view.quoteIsWrappedSol);
  row("Liquidity deposited", view.hasLiquidity);
  row("Coin creator set", view.hasCoinCreator);
  row("Creator fees shared", view.creatorFeesShared);
  row("Total swap fee", `${view.totalFeeBps.toString()} bps`);
  row("All instructions enabled", view.allInstructionsEnabled);

  heading("Reserves (token accounts, not the pool account)");
  const balances = await withRpcRetry("pool vault balances", () =>
    connection.getMultipleAccountsInfo([
      pool.poolBaseTokenAccount,
      pool.poolQuoteTokenAccount,
    ]),
  );
  const baseAmount = tokenAccountAmount(balances[0]?.data);
  const quoteAmount = tokenAccountAmount(balances[1]?.data);
  row("Base vault", formatTokens(baseAmount));
  row("Quote vault", formatSol(quoteAmount));
  console.log(
    "\nThe Pool account stores addresses, not balances: reserves live in the",
  );
  console.log(
    "two SPL token accounts it points at, which is why a quote reads three",
  );
  console.log("accounts and not one.");
}

/** Raw `amount` field of an SPL token account (u64 little endian at offset 64). */
function tokenAccountAmount(data: Buffer | undefined): BN {
  if (!data || data.length < 72) return new BN(0);
  return new BN(data.subarray(64, 72), "le");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
