/**
 * Example 03: Buy Tokens
 *
 * Category: Token Lifecycle
 *
 * The canonical bonding curve buy flow: quote how many tokens a SOL
 * budget purchases, then build slippage-protected buy instructions from
 * explicit on-chain state. Fetching state (network) and computing the
 * trade (pure math) are separate steps, so the compute step is fully
 * testable offline.
 *
 * Run: npm run example 03
 */
import {
  PUMP_SDK,
  PUMP_PROGRAM_ID,
  BONDING_CURVE_NEW_SIZE,
  OnlinePumpSdk,
  bondingCurvePda,
  getBuyTokenAmountFromSolAmount,
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
import { isEphemeral, loadWallet } from "./_lib/wallet";

/** Quote how many tokens a SOL amount buys on the given curve (fees included). */
export function quoteBuyTokens({
  global,
  feeConfig,
  bondingCurve,
  solAmount,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  bondingCurve: BondingCurve;
  solAmount: BN;
}): BN {
  return getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: solAmount,
  });
}

/**
 * Build the buy instruction list from explicit state. Pure compute: no RPC.
 *
 * `PUMP_SDK.buyInstructions` prepends an extendAccount instruction when the
 * curve account predates the current layout, and an idempotent
 * create-associated-token-account instruction when the buyer has no token
 * account yet. `slippage` is in percent: 1 means the transaction may spend
 * up to 1% more SOL than quoted before it aborts.
 */
export async function buildBuyInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  associatedUserAccountInfo,
  mint,
  user,
  amount,
  solAmount,
  slippage,
  tokenProgram = TOKEN_PROGRAM_ID,
}: {
  global: Global;
  bondingCurveAccountInfo: AccountInfo<Buffer>;
  bondingCurve: BondingCurve;
  associatedUserAccountInfo: AccountInfo<Buffer> | null;
  mint: PublicKey;
  user: PublicKey;
  amount: BN;
  solAmount: BN;
  slippage: number;
  tokenProgram?: PublicKey;
}): Promise<TransactionInstruction[]> {
  return await PUMP_SDK.buyInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram,
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
  row("Wallet source", isEphemeral() ? "ephemeral (generated for this run)" : "PUMP_WALLET env");

  const [global, feeConfig] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
  ]);

  const curveInfo = await connection.getAccountInfo(bondingCurvePda(mint));
  const decoded = curveInfo ? PUMP_SDK.decodeBondingCurveNullable(curveInfo) : null;

  let bondingCurve: BondingCurve;
  let bondingCurveAccountInfo: AccountInfo<Buffer>;
  let associatedUserAccountInfo: AccountInfo<Buffer> | null = null;
  let tokenProgram: PublicKey = TOKEN_PROGRAM_ID;

  if (curveInfo && decoded && !decoded.complete && !decoded.virtualTokenReserves.isZero()) {
    heading("Live bonding curve state");
    const state = await online.fetchBuyState(mint, wallet.publicKey);
    bondingCurve = state.bondingCurve;
    bondingCurveAccountInfo = state.bondingCurveAccountInfo;
    associatedUserAccountInfo = state.associatedUserAccountInfo;
    tokenProgram = state.tokenProgram;
    row("Virtual SOL reserves", formatSol(bondingCurve.virtualQuoteReserves));
    row("Virtual token reserves", formatTokens(bondingCurve.virtualTokenReserves));
    row("Buyer token account exists", associatedUserAccountInfo !== null);
  } else {
    heading("Bonding curve status");
    if (!curveInfo || !decoded) {
      console.log("No bonding curve account exists for this mint (the PUMP token");
      console.log("itself never traded on a curve). Set MINT=<mint> to target a");
      console.log("live curve token.");
    } else {
      console.log("This token's curve is complete: it graduated to a PumpAMM pool,");
      console.log("so bonding curve buys are disabled. Use the AMM examples to trade it.");
    }
    console.log("Demonstrating the same compute step on a brand-new curve derived");
    console.log("from live global state via newBondingCurve(global).");
    bondingCurve = newBondingCurve(global);
    bondingCurveAccountInfo = {
      data: Buffer.alloc(BONDING_CURVE_NEW_SIZE),
      executable: false,
      lamports: 0,
      owner: PUMP_PROGRAM_ID,
    };
  }

  const solAmount = new BN(100_000_000); // 0.1 SOL
  const slippage = 1; // percent

  heading("Quote");
  const tokensOut = quoteBuyTokens({ global, feeConfig, bondingCurve, solAmount });
  row("Spend", formatSol(solAmount));
  row("Tokens received", formatTokens(tokensOut));

  heading("Slippage");
  const maxSpend = solAmount.add(solAmount.muln(slippage * 100).divn(10_000));
  console.log("Between quoting and landing on-chain, other buys move the curve.");
  console.log(`slippage: ${slippage} caps the damage: the buy aborts rather than`);
  console.log(`spend more than ${formatSol(maxSpend)} for the quoted tokens.`);

  const ixs = await buildBuyInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user: wallet.publicKey,
    amount: tokensOut,
    solAmount,
    slippage,
    tokenProgram,
  });

  heading("Buy instructions");
  row("Instruction count", ixs.length);
  ixs.forEach((ix, i) => {
    const kind = ix.programId.equals(PUMP_PROGRAM_ID) ? "pump" : "token/ata";
    row(`${i + 1}. ${kind}`, `${ix.keys.length} accounts, ${ix.data.length} data bytes`);
  });

  heading("Next step (not performed here)");
  console.log("Compose these instructions into a transaction, sign with the wallet,");
  console.log("and send it. This example never broadcasts anything.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
