/**
 * Example 07: Sell All
 *
 * Category: Token Lifecycle
 *
 * The full exit: OnlinePumpSdk.sellAllInstructions sells the wallet's
 * entire balance and closes the token account to reclaim its rent. This
 * example also explains maxSafeSellAmount, the bound that decides when a
 * balance is too wide for one sell instruction to carry.
 *
 * Run: npm run example 07
 */
import {
  OnlinePumpSdk,
  getSellSolAmountFromTokenAmount,
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

export interface SellAllPlan {
  /** SOL the whole balance is worth at current reserves, after fees. */
  solOut: BN;
  /** Largest amount a single sell instruction can carry without overflow. */
  maxSafe: BN;
  /** True when the balance exceeds maxSafe: use sellChunked, not one tx. */
  needsChunking: boolean;
}

/**
 * Plan a full exit offline.
 *
 * `maxSafeSellAmount` bounds what a single sell instruction can carry: the
 * program widens the sell multiply to u128, so the binding limit is the
 * token amount's own u64 field width. A balance wider than that needs
 * chunking, which this plan reports before anything is signed.
 *
 * A failing sell is worth distinguishing from a too-large one. AnchorError
 * 6024 that strikes intermittently at sizes that usually work is slippage:
 * reserves drift between quote and landing slot, and the abort happens
 * after your tokens already moved in that same transaction (rolled back,
 * but you paid the fee). Chunking does not fix that; slippage headroom and
 * quoting near send time do.
 */
export function computeSellAllPlan({
  global,
  feeConfig,
  bondingCurve,
  balance,
}: {
  global: Global;
  feeConfig: FeeConfig | null;
  bondingCurve: BondingCurve;
  balance: BN;
}): SellAllPlan {
  const maxSafe = maxSafeSellAmount(bondingCurve.virtualQuoteReserves);
  const solOut = getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: balance,
  });
  return {
    solOut,
    maxSafe,
    needsChunking: balance.gt(maxSafe),
  };
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

  heading("Exit planning (offline math, live global state)");
  const demoCurve = newBondingCurve(global);
  const smallBalance = new BN(150_000_000); // 150 tokens
  const small = computeSellAllPlan({
    global,
    feeConfig,
    bondingCurve: demoCurve,
    balance: smallBalance,
  });
  row("Balance", formatTokens(smallBalance));
  row("Worth (after fees)", formatSol(small.solOut));
  row("Max safe single sell", formatTokens(small.maxSafe));
  row("Needs chunking", small.needsChunking);

  const wholeBag = small.maxSafe.muln(3);
  const big = computeSellAllPlan({
    global,
    feeConfig,
    bondingCurve: demoCurve,
    balance: wholeBag,
  });
  row("Balance (large holder)", formatTokens(wholeBag));
  row("Needs chunking", big.needsChunking);
  console.log("Why the limit exists: a token amount is a u64 on-chain, so a");
  console.log("balance wider than that cannot be carried by one instruction and");
  console.log("sellChunked splits it across transactions. The sell multiply");
  console.log("itself is widened to u128, so ordinary positions never hit it.");

  heading("sellAllInstructions (the one-call online flow)");
  try {
    const ixs = await online.sellAllInstructions({
      mint,
      user: wallet.publicKey,
      slippage: 1,
    });
    if (ixs.length === 0) {
      console.log("Returned 0 instructions: this wallet has no token account for");
      console.log("the mint. Nothing to sell, nothing to close.");
    } else {
      row("Instruction count", ixs.length);
      console.log("The final instruction is always closeAccount: after a full");
      console.log("exit the empty token account is closed and its rent (about");
      console.log("0.002 SOL) returns to the wallet.");
    }
  } catch (err) {
    console.log("sellAllInstructions threw (needs a live bonding curve account):");
    console.log(`  ${err instanceof Error ? err.message : String(err)}`);
    console.log("Set MINT=<mint> of an un-graduated token to see the full path.");
  }

  heading("Next step (not performed here)");
  console.log("Compose, sign, send. This example never broadcasts a transaction.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
