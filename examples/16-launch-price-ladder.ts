/**
 * Example 16: Launch Price Ladder
 *
 * Category: Curve Math & Fees
 *
 * Starts from newBondingCurve(global), then simulates a sequence of buys
 * by applying each quote to the virtual and real reserves with BN math,
 * printing spot price and market cap after every step. This is constant
 * product curve mechanics end to end: why early buyers get more tokens
 * per SOL and why the price can only ratchet up while people buy.
 *
 * Run: npm run example 16
 */
import {
  bondingCurveMarketCap,
  computeFeesBps,
  getBuyTokenAmountFromSolAmount,
  newBondingCurve,
} from "@nirholas/pump-sdk";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type { BondingCurve, Global } from "@nirholas/pump-sdk";

import { EXAMPLE_CREATOR, mainnetGlobal } from "./_lib/curveState";
import { formatSol, formatTokens, heading, row } from "./_lib/format";

/** Lamports per 1,000,000 whole tokens (1e12 base units), pure BN. */
export function spotPriceLamportsPerMillionTokens(bondingCurve: BondingCurve): BN {
  return bondingCurve.virtualQuoteReserves
    .mul(new BN("1000000000000"))
    .div(bondingCurve.virtualTokenReserves);
}

export interface BuyApplication {
  /** Tokens the buyer receives for this step's SOL spend. */
  tokensOut: BN;
  /** The fee-stripped SOL that actually enters the reserves. */
  solIntoReserves: BN;
  /** The curve state after the buy. */
  curve: BondingCurve;
}

/**
 * Apply one buy to a bonding curve, exactly as the program does:
 *
 * 1. Strip fees from the spend: input = (sol - 1) * 10000 / (feeBps + 10000).
 * 2. Quote tokens out with the constant product: input * vTok / (vSol + input).
 * 3. Move reserves: vSol and realSol up by input, vTok and realTok down by
 *    the tokens sold.
 *
 * Returns a new curve; the input curve is not mutated.
 */
export function applyBuy(
  global: Global,
  bondingCurve: BondingCurve,
  solIn: BN,
): BuyApplication {
  const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
    global,
    feeConfig: null,
    mintSupply: global.tokenTotalSupply,
    virtualQuoteReserves: bondingCurve.virtualQuoteReserves,
    virtualTokenReserves: bondingCurve.virtualTokenReserves,
  });
  const totalFeeBps = protocolFeeBps.add(
    PublicKey.default.equals(bondingCurve.creator) ? new BN(0) : creatorFeeBps,
  );
  const solIntoReserves = solIn
    .subn(1)
    .muln(10_000)
    .div(totalFeeBps.addn(10_000));

  const tokensOut = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig: null,
    mintSupply: global.tokenTotalSupply,
    bondingCurve,
    amount: solIn,
  });

  return {
    tokensOut,
    solIntoReserves,
    curve: {
      ...bondingCurve,
      virtualQuoteReserves: bondingCurve.virtualQuoteReserves.add(solIntoReserves),
      virtualTokenReserves: bondingCurve.virtualTokenReserves.sub(tokensOut),
      realQuoteReserves: bondingCurve.realQuoteReserves.add(solIntoReserves),
      realTokenReserves: bondingCurve.realTokenReserves.sub(tokensOut),
    },
  };
}

export interface LadderStep {
  buyIndex: number;
  solIn: BN;
  tokensOut: BN;
  spotPrice: BN;
  marketCap: BN;
  curve: BondingCurve;
}

/**
 * Simulate a sequence of buys from a fresh launch and record the price
 * ladder they climb.
 */
export function simulateBuySequence(global: Global, buys: BN[]): LadderStep[] {
  // A live curve always has its creator set, so creator fees apply from
  // the first post-launch trade.
  let curve: BondingCurve = { ...newBondingCurve(global), creator: EXAMPLE_CREATOR };
  const steps: LadderStep[] = [];

  buys.forEach((solIn, index) => {
    const applied = applyBuy(global, curve, solIn);
    curve = applied.curve;
    steps.push({
      buyIndex: index + 1,
      solIn,
      tokensOut: applied.tokensOut,
      spotPrice: spotPriceLamportsPerMillionTokens(curve),
      marketCap: bondingCurveMarketCap({
        mintSupply: global.tokenTotalSupply,
        virtualQuoteReserves: curve.virtualQuoteReserves,
        virtualTokenReserves: curve.virtualTokenReserves,
      }),
      curve,
    });
  });

  return steps;
}

export async function main(): Promise<void> {
  const global = mainnetGlobal();
  const start = newBondingCurve(global);

  heading("Launch state (newBondingCurve)");
  row("Virtual SOL", formatSol(start.virtualQuoteReserves));
  row("Virtual tokens", formatTokens(start.virtualTokenReserves, 0));
  row("Spot price", `${formatSol(spotPriceLamportsPerMillionTokens(start), 6)} per 1M tokens`);

  heading("Ten buys of 1 SOL each");
  console.log(
    `${"buy".padEnd(6)}${"tokens out".padEnd(24)}${"spot / 1M tokens".padEnd(22)}market cap`,
  );
  const buys = Array.from({ length: 10 }, () => new BN("1000000000"));
  for (const step of simulateBuySequence(global, buys)) {
    console.log(
      `${String(step.buyIndex).padEnd(6)}${formatTokens(step.tokensOut, 0).padEnd(24)}${formatSol(
        step.spotPrice,
        6,
      ).padEnd(22)}${formatSol(step.marketCap, 2)}`,
    );
  }

  console.log("\nEach identical 1 SOL buy receives fewer tokens than the one");
  console.log("before it: the fee-stripped SOL raises virtualSolReserves while");
  console.log("tokens leave virtualTokenReserves, so the ratio (the price) only");
  console.log("moves up. Nothing about this needs an oracle; the reserves ARE");
  console.log("the price.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
