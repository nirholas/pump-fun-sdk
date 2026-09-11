/**
 * Example 08: Sell to a Target SOL Amount
 *
 * Category: Token Lifecycle
 *
 * "I need 2 SOL back" is a target, not a token amount. This example uses
 * getTokenAmountForTargetSol, a binary search over the sell quote, to
 * find the minimum tokens to part with, and shows sellToTargetSol and
 * sellChunked for exits a single transaction cannot carry.
 *
 * Run: npm run example 08
 */
import {
  OnlinePumpSdk,
  getSellSolAmountFromTokenAmount,
  getTokenAmountForTargetSol,
  maxSafeSellAmount,
  newBondingCurve,
  type BondingCurve,
  type FeeConfig,
  type Global,
} from "@nirholas/pump-sdk";
import BN from "bn.js";

import { getConnection } from "./_lib/connection";
import { findActiveCurveMint } from "./_lib/discovery";
import { formatSol, formatTokens, heading, row } from "./_lib/format";
import { loadWallet } from "./_lib/wallet";

/**
 * Minimum token amount whose sell quote reaches `targetSol` lamports after
 * fees. Binary search over the bonding curve, bounded by both the real
 * token reserves and maxSafeSellAmount, so the result is always valid for
 * a single sell instruction. When even the bounded maximum cannot reach
 * the target, that maximum is returned; quote it back to detect the case.
 */
export function tokensForTargetSol({
  global,
  feeConfig,
  bondingCurve,
  targetSol,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  bondingCurve: BondingCurve;
  targetSol: BN;
}): BN {
  return getTokenAmountForTargetSol({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    targetSol,
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

  heading("Target math (offline, live global state)");
  const bondingCurve = newBondingCurve(global);
  const targetSol = new BN(500_000_000); // 0.5 SOL
  const amount = tokensForTargetSol({ global, feeConfig, bondingCurve, targetSol });
  const check = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount,
  });
  row("Target", formatSol(targetSol));
  row("Tokens to sell", formatTokens(amount));
  row("Actual SOL out", formatSol(check));
  row("Single-tx safe bound", formatTokens(maxSafeSellAmount(bondingCurve.virtualQuoteReserves)));
  console.log("The search returns the MINIMUM tokens that reach the target, so");
  console.log("actual SOL out lands just above it, never below (unless the safe");
  console.log("bound itself cannot reach the target; then the bound is returned).");

  heading("sellToTargetSol (the one-call online flow)");
  try {
    const ixs = await online.sellToTargetSol({
      mint,
      user: wallet.publicKey,
      targetSol,
      slippage: 1,
    });
    row("Instruction count", ixs.length);
  } catch (err) {
    console.log("sellToTargetSol threw (the seller must hold this token on a live");
    console.log(`curve): ${err instanceof Error ? err.message : String(err)}`);
    console.log("The target math above is the pure core of the same flow.");
  }

  heading("Large exits: sellChunked");
  console.log("When the amount exceeds the single-tx safe bound, sellChunked");
  console.log("splits the exit and re-fetches reserves between chunks, since each");
  console.log("landed chunk moves the curve and changes the next safe bound:");
  console.log("");
  console.log("  await online.sellChunked({");
  console.log("    mint,             // token mint");
  console.log("    user,             // seller wallet");
  console.log("    totalAmount,      // BN, the whole exit");
  console.log("    slippage: 1,      // percent, applied per chunk");
  console.log("    tokenProgram,     // optional, default TOKEN_PROGRAM_ID");
  console.log("    cashback: false,  // optional cashback opt-in per chunk");
  console.log("    sendTx,           // async (ixs) => signature, YOUR sender");
  console.log("  });");
  console.log("");
  console.log("It returns every chunk's signature in order. You keep custody of");
  console.log("signing and sending; the SDK never broadcasts on its own.");

  heading("Next step (not performed here)");
  console.log("Compose, sign, send. This example never broadcasts a transaction.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
