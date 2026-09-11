/**
 * Example 04: Sell Tokens
 *
 * Category: Token Lifecycle
 *
 * The canonical bonding curve sell flow: quote the SOL a token amount
 * returns after fees, then build slippage-protected sell instructions
 * from explicit state. Includes the pre-flight check that refuses an
 * amount the on-chain token field cannot represent.
 *
 * Run: npm run example 04
 */
import {
  PUMP_SDK,
  PUMP_PROGRAM_ID,
  BONDING_CURVE_NEW_SIZE,
  OnlinePumpSdk,
  bondingCurvePda,
  getSellSolAmountFromTokenAmount,
  maxSafeSellAmount,
  newBondingCurve,
  type BondingCurve,
  type FeeConfig,
  type Global,
} from "@nirholas/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AccountInfo,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { findActiveCurveMint } from "./_lib/discovery";
import { formatSol, formatTokens, heading, row } from "./_lib/format";
import { loadWallet } from "./_lib/wallet";

/** Quote the SOL received for selling a token amount (all fees deducted). */
export function quoteSellSol({
  global,
  feeConfig,
  bondingCurve,
  amount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  bondingCurve: BondingCurve;
  amount: BN;
}): BN {
  return getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount,
  });
}

/**
 * Build the sell instruction list from explicit state. Pure compute: no RPC.
 *
 * `PUMP_SDK.sellInstructions` first validates the amount against the u64
 * overflow bound (throws SellOverflowError instead of letting the chain
 * abort after tokens moved), prepends extendAccount for old curve
 * accounts, and applies `slippage` (percent) as the minimum acceptable
 * SOL out: quoted SOL minus slippage%.
 */
export async function buildSellInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  mint,
  user,
  amount,
  solAmount,
  slippage,
  tokenProgram = TOKEN_PROGRAM_ID,
  cashback = false,
}: {
  global: Global;
  bondingCurveAccountInfo: AccountInfo<Buffer>;
  bondingCurve: BondingCurve;
  mint: PublicKey;
  user: PublicKey;
  amount: BN;
  solAmount: BN;
  slippage: number;
  tokenProgram?: PublicKey;
  cashback?: boolean;
}): Promise<TransactionInstruction[]> {
  return await PUMP_SDK.sellInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram,
    cashback,
  });
}

export async function main(): Promise<void> {
  const connection = getConnection();
  const online = new OnlinePumpSdk(connection);
  const wallet = loadWallet();
  // Discover a token actively trading on its curve (MINT env overrides).
  const { mint } = await findActiveCurveMint(connection);

  heading("Setup");
  row("Mint", mint.toBase58());
  row("Wallet", wallet.publicKey.toBase58());

  const [global, feeConfig] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
  ]);

  const curveInfo = await connection.getAccountInfo(bondingCurvePda(mint));
  const decoded = curveInfo ? PUMP_SDK.decodeBondingCurveNullable(curveInfo) : null;

  let bondingCurve: BondingCurve;
  let bondingCurveAccountInfo: AccountInfo<Buffer>;

  if (curveInfo && decoded && !decoded.complete && !decoded.virtualTokenReserves.isZero()) {
    heading("Live bonding curve state");
    bondingCurve = decoded;
    bondingCurveAccountInfo = curveInfo;
    row("Virtual SOL reserves", formatSol(bondingCurve.virtualQuoteReserves));
    row("Virtual token reserves", formatTokens(bondingCurve.virtualTokenReserves));
    try {
      // fetchSellState additionally requires the seller's token account to
      // exist (you cannot sell tokens you do not hold).
      const state = await online.fetchSellState(mint, wallet.publicKey);
      bondingCurveAccountInfo = state.bondingCurveAccountInfo;
      row("Seller token account", "exists");
    } catch {
      row("Seller token account", "missing (this wallet holds none; building anyway)");
    }
  } else {
    heading("Bonding curve status");
    if (!curveInfo || !decoded) {
      console.log("No bonding curve account exists for this mint. Set MINT=<mint>");
      console.log("to target a live curve token.");
    } else {
      console.log("This token graduated to a PumpAMM pool; curve sells are disabled.");
    }
    console.log("Demonstrating the compute step on a brand-new curve derived from");
    console.log("live global state via newBondingCurve(global).");
    bondingCurve = newBondingCurve(global);
    bondingCurveAccountInfo = {
      data: Buffer.alloc(BONDING_CURVE_NEW_SIZE),
      executable: false,
      lamports: 0,
      owner: PUMP_PROGRAM_ID,
    };
  }

  const maxSafe = maxSafeSellAmount(bondingCurve.virtualQuoteReserves);
  const amount = BN.min(new BN(100_000_000), maxSafe); // up to 100 tokens
  const slippage = 1; // percent

  heading("Quote");
  const solOut = quoteSellSol({ global, feeConfig, bondingCurve, amount });
  row("Sell", formatTokens(amount));
  row("SOL received (after fees)", formatSol(solOut));
  row("Max safe single-tx sell", formatTokens(maxSafe));

  heading("Slippage");
  const minSolOut = solOut.sub(solOut.muln(slippage * 100).divn(10_000));
  console.log(`slippage: ${slippage} sets the floor: the sell aborts rather than`);
  console.log(`return less than ${formatSol(minSolOut)} for these tokens.`);

  const ixs = await buildSellInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    mint,
    user: wallet.publicKey,
    amount,
    solAmount: solOut,
    slippage,
  });

  heading("Sell instructions");
  row("Instruction count", ixs.length);
  ixs.forEach((ix, i) => {
    const kind = ix.programId.equals(PUMP_PROGRAM_ID) ? "pump" : "other";
    row(`${i + 1}. ${kind}`, `${ix.keys.length} accounts, ${ix.data.length} data bytes`);
  });

  heading("Next step (not performed here)");
  console.log("Compose, sign, send. This example never broadcasts a transaction.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
