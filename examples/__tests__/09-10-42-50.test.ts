/**
 * Offline tests for the mayhem/cashback launch examples (09, 10) and the
 * AMM & Advanced examples (42-50).
 *
 * Every network call in those examples lives inside its main(); the exported
 * logic is pure, so it runs here against fixture state with no RPC. The
 * instruction builders and event coders are exercised for real, so a change
 * in the IDL or in the SDK's validation shows up as a failure here rather
 * than as a rejected transaction.
 */
import {
  MAX_SHAREHOLDERS,
  PUMP_SDK,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  Platform,
  canonicalPumpPoolPda,
  creatorVaultPda,
  currentDayTokens,
  estimateVanityMintAttempts,
  feeSharingConfigPda,
  generateVanityMint,
  socialFeePda,
  totalUnclaimedTokens,
  type AmmBuyQuote,
  type AmmSellQuote,
  type GlobalVolumeAccumulator,
  type Shareholder,
  type UserVolumeAccumulator,
} from "@nirholas/pump-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { TEST_CREATOR, makeGlobal } from "../../src/__tests__/fixtures";

import {
  accountIndex,
  buildMayhemPair,
  diffInstructions,
  mayhemAccounts,
  main as example09,
} from "../09-mayhem-mode";
import {
  cashbackAccumulators,
  encodeClaimCashbackEvent,
  readCashbackPosition,
  main as example10,
} from "../10-cashback-token";
import {
  interpretAmmSellQuote,
  main as example42,
  roundTripLossBps,
} from "../42-amm-sell";
import {
  depositRatio,
  main as example43,
  slippageHeadroomBps,
} from "../43-amm-deposit";
import {
  main as example44,
  slippageFloorBps,
  withdrawShare,
} from "../44-amm-withdraw";
import {
  compareVenuePrices,
  main as example45,
  spotPriceLamports,
} from "../45-canonical-pool";
import {
  evenSplit,
  evenSplitUnchecked,
  invalidSplits,
  splitTotalBps,
  main as example46,
} from "../46-fee-sharing-create";
import {
  encodeDistributeCreatorFeesEvent,
  encodeMinimumDistributableFeeEvent,
  payoutSplit,
  main as example47,
} from "../47-fee-sharing-distribute";
import {
  CLAIM_WORTH_IT_LAMPORTS,
  splitVaultBalances,
  worthClaiming,
  main as example48,
} from "../48-creator-fees";
import {
  incentiveWindow,
  projectedDayShare,
  remainingProgramSupply,
  main as example49,
} from "../49-token-incentives";
import {
  estimateSeconds,
  matchesVanityPattern,
  unmatchableCharacters,
  main as example50,
} from "../50-vanity-mint";

/** Every example's entry point, gathered so the walkthroughs stay runnable. */
const exampleMains = {
  example09,
  example10,
  example42,
  example43,
  example44,
  example45,
  example46,
  example47,
  example48,
  example49,
  example50,
};

const SOL = (n: number) => new BN(n).mul(new BN(1_000_000_000));
const TOKENS = (n: number) => new BN(n).mul(new BN(1_000_000));

const wallet = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey;

describe("example 09: mayhem mode", () => {
  const launch = {
    mint,
    name: "Mayhem Example",
    symbol: "MHEX",
    uri: "https://example.com/metadata.json",
    creator: wallet,
    user: wallet,
  };

  it("derives all four Mayhem PDAs and threads them into the instruction", async () => {
    const { plain } = await buildMayhemPair(launch);
    const accounts = mayhemAccounts(mint);
    for (const account of Object.values(accounts)) {
      expect(accountIndex(plain, account)).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives each mint its own mayhem state and token vault", () => {
    const a = mayhemAccounts(mint);
    const b = mayhemAccounts(Keypair.generate().publicKey);
    expect(a.mayhemState.equals(b.mayhemState)).toBe(false);
    expect(a.tokenVault.equals(b.tokenVault)).toBe(false);
    // Global params and the SOL vault are program-wide, not per mint.
    expect(a.globalParams.equals(b.globalParams)).toBe(true);
    expect(a.solVault.equals(b.solVault)).toBe(true);
  });

  it("changes exactly one data byte and no accounts when mayhem is on", async () => {
    const { plain, mayhem } = await buildMayhemPair(launch);
    const diff = diffInstructions(plain, mayhem);
    expect(diff.accountsIdentical).toBe(true);
    expect(diff.sameDataLength).toBe(true);
    expect(diff.changedDataOffsets).toHaveLength(1);
    const offset = diff.changedDataOffsets[0]!;
    expect(plain.data[offset]).toBe(0);
    expect(mayhem.data[offset]).toBe(1);
  });

  it("reports no diff against itself", async () => {
    const { plain } = await buildMayhemPair(launch);
    const diff = diffInstructions(plain, plain);
    expect(diff.accountsIdentical).toBe(true);
    expect(diff.changedDataOffsets).toEqual([]);
  });

  it("returns -1 for an account the instruction does not reference", async () => {
    const { plain } = await buildMayhemPair(launch);
    expect(accountIndex(plain, Keypair.generate().publicKey)).toBe(-1);
  });
});

describe("example 10: cashback tokens", () => {
  it("derives a different accumulator per program", () => {
    const accumulators = cashbackAccumulators(wallet);
    expect(accumulators.bondingCurve.equals(accumulators.amm)).toBe(false);
  });

  it("derives a different accumulator per trader", () => {
    const other = cashbackAccumulators(Keypair.generate().publicKey);
    expect(
      cashbackAccumulators(wallet).bondingCurve.equals(other.bondingCurve),
    ).toBe(false);
  });

  it("rejects deprecated cashback launches", async () => {
    const params = {
      mint,
      name: "Cashback Example",
      symbol: "CBEX",
      uri: "https://example.com/metadata.json",
      creator: wallet,
      user: wallet,
      mayhemMode: false,
    };
    await expect(
      PUMP_SDK.createV2Instruction({ ...params, cashback: true }),
    ).rejects.toThrow("Cashback launches are deprecated");
  });

  it("round trips a ClaimCashbackEvent through the program's coder", () => {
    const event = {
      user: wallet,
      amount: new BN(250_000),
      timestamp: new BN(1_700_000_000),
      totalClaimed: new BN(1_750_000),
      totalCashbackEarned: new BN(2_000_000),
    };
    const decoded = PUMP_SDK.decodeClaimCashbackEvent(
      encodeClaimCashbackEvent(event),
    );
    expect(decoded.user.equals(wallet)).toBe(true);
    expect(decoded.amount.eq(event.amount)).toBe(true);
    expect(decoded.totalCashbackEarned.eq(event.totalCashbackEarned)).toBe(true);
  });

  it("reads outstanding cashback and the claimed share", () => {
    const position = readCashbackPosition({
      user: wallet,
      amount: new BN(250_000),
      timestamp: new BN(1_700_000_000),
      totalClaimed: new BN(1_750_000),
      totalCashbackEarned: new BN(2_000_000),
    });
    expect(position.outstanding.eq(new BN(250_000))).toBe(true);
    expect(position.claimedShareBps.eq(new BN(8_750))).toBe(true);
  });

  it("never reports negative outstanding cashback", () => {
    const position = readCashbackPosition({
      user: wallet,
      amount: new BN(0),
      timestamp: new BN(1_700_000_000),
      totalClaimed: new BN(2_000_000),
      totalCashbackEarned: new BN(1_000_000),
    });
    expect(position.outstanding.isZero()).toBe(true);
  });

  it("reports a zero share for a trader who never earned anything", () => {
    const position = readCashbackPosition({
      user: wallet,
      amount: new BN(0),
      timestamp: new BN(1_700_000_000),
      totalClaimed: new BN(0),
      totalCashbackEarned: new BN(0),
    });
    expect(position.claimedShareBps.isZero()).toBe(true);
  });
});

describe("example 42: AMM sell", () => {
  // Spot on these reserves is 1,000 lamports per whole token, so 1,000 tokens
  // are worth 1,000,000 lamports gross; the fill pays 990,000 after fees.
  const quote: AmmSellQuote = {
    solOut: new BN(990_000),
    tokensSold: TOKENS(1_000),
    feesLamports: new BN(10_000),
    poolBaseAmount: TOKENS(100_000_000),
    poolQuoteAmount: SOL(100),
  };

  it("prices the fill below spot", () => {
    const breakdown = interpretAmmSellQuote(quote);
    expect(breakdown.effectivePriceLamports.lt(breakdown.spotPriceLamports)).toBe(
      true,
    );
    expect(breakdown.discountToSpotBps.gtn(0)).toBe(true);
  });

  it("expresses fees as a share of the gross payout", () => {
    const breakdown = interpretAmmSellQuote(quote);
    const gross = quote.solOut.add(quote.feesLamports);
    expect(breakdown.feeBpsOfGross.eq(quote.feesLamports.muln(10_000).div(gross))).toBe(
      true,
    );
  });

  it("rejects a quote that sold nothing", () => {
    expect(() =>
      interpretAmmSellQuote({ ...quote, tokensSold: new BN(0) }),
    ).toThrow(/zero tokens/);
  });

  it("rejects an empty pool", () => {
    expect(() =>
      interpretAmmSellQuote({ ...quote, poolQuoteAmount: new BN(0) }),
    ).toThrow(/no liquidity/);
  });

  it("measures the round trip as the gap between SOL in and SOL out", () => {
    const buy: AmmBuyQuote = {
      tokensOut: TOKENS(1_000),
      solSpent: SOL(1),
      feesLamports: new BN(1_000_000),
      poolBaseAmount: quote.poolBaseAmount,
      poolQuoteAmount: quote.poolQuoteAmount,
    };
    const loss = roundTripLossBps(buy, { ...quote, solOut: new BN(980_000_000) });
    expect(loss.eq(new BN(200))).toBe(true);
  });

  it("rejects a round trip measured against a zero-SOL buy", () => {
    const buy: AmmBuyQuote = {
      tokensOut: new BN(0),
      solSpent: new BN(0),
      feesLamports: new BN(0),
      poolBaseAmount: quote.poolBaseAmount,
      poolQuoteAmount: quote.poolQuoteAmount,
    };
    expect(() => roundTripLossBps(buy, quote)).toThrow(/zero SOL/);
  });
});

describe("example 43: AMM deposit", () => {
  const deposit = {
    base: TOKENS(1_000),
    quote: SOL(1),
    lpToken: new BN(500_000),
    lpSupply: new BN(4_500_000),
  };

  it("prices the deposit per whole token", () => {
    const ratio = depositRatio(deposit);
    expect(
      ratio.quotePerTokenLamports.eq(
        deposit.quote.mul(new BN(1_000_000)).div(deposit.base),
      ),
    ).toBe(true);
  });

  it("computes the share of the pool after the LP tokens are minted", () => {
    const ratio = depositRatio(deposit);
    // 500,000 of 5,000,000 post-mint supply = 10%.
    expect(ratio.shareOfPoolBps.eq(new BN(1_000))).toBe(true);
  });

  it("gives the whole pool to the first depositor", () => {
    const ratio = depositRatio({ ...deposit, lpSupply: new BN(0) });
    expect(ratio.shareOfPoolBps.eq(new BN(10_000))).toBe(true);
  });

  it("rejects a one-sided deposit", () => {
    expect(() => depositRatio({ ...deposit, base: new BN(0) })).toThrow(
      /no base side/,
    );
  });

  it("reads slippage headroom as basis points above the quote", () => {
    expect(
      slippageHeadroomBps(new BN(1_000_000), new BN(1_010_000)).eq(new BN(100)),
    ).toBe(true);
  });

  it("reports no headroom when the max is at or below the quote", () => {
    expect(slippageHeadroomBps(new BN(1_000_000), new BN(900_000)).isZero()).toBe(
      true,
    );
    expect(slippageHeadroomBps(new BN(0), new BN(10)).isZero()).toBe(true);
  });
});

describe("example 44: AMM withdraw", () => {
  const position = {
    lpToken: new BN(1_000),
    lpSupply: new BN(100_000),
    poolBase: TOKENS(1_000_000),
    poolQuote: SOL(500),
  };

  it("pays out reserves pro rata", () => {
    const share = withdrawShare(position);
    expect(share.base.eq(TOKENS(10_000))).toBe(true);
    expect(share.quote.eq(SOL(5))).toBe(true);
    expect(share.shareOfPoolBps.eq(new BN(100))).toBe(true);
  });

  it("returns the whole pool for the whole LP supply", () => {
    const share = withdrawShare({ ...position, lpToken: position.lpSupply });
    expect(share.base.eq(position.poolBase)).toBe(true);
    expect(share.quote.eq(position.poolQuote)).toBe(true);
    expect(share.shareOfPoolBps.eq(new BN(10_000))).toBe(true);
  });

  it("rejects burning more LP tokens than exist", () => {
    expect(() =>
      withdrawShare({ ...position, lpToken: new BN(100_001) }),
    ).toThrow(/more LP tokens/);
  });

  it("rejects a pool with no LP supply", () => {
    expect(() => withdrawShare({ ...position, lpSupply: new BN(0) })).toThrow(
      /no LP supply/,
    );
  });

  it("reads the slippage floor as basis points below the quote", () => {
    expect(
      slippageFloorBps(new BN(1_000_000), new BN(990_000)).eq(new BN(100)),
    ).toBe(true);
    expect(slippageFloorBps(new BN(0), new BN(0)).isZero()).toBe(true);
  });
});

describe("example 45: canonical pool", () => {
  const global = makeGlobal();
  const virtualTokenOffset = global.initialVirtualTokenReserves.sub(
    global.initialRealTokenReserves,
  );

  it("derives a distinct canonical pool per mint", () => {
    expect(
      canonicalPumpPoolPda(mint).equals(
        canonicalPumpPoolPda(Keypair.generate().publicKey),
      ),
    ).toBe(false);
  });

  it("prices a pool as quote over base per whole token", () => {
    expect(spotPriceLamports(TOKENS(1_000_000), SOL(100)).eq(new BN(100_000))).toBe(
      true,
    );
  });

  it("rejects a pool with no base reserve", () => {
    expect(() => spotPriceLamports(new BN(0), SOL(1))).toThrow(/no price/);
  });

  it("prices the AMM above the curve above the crossover", () => {
    const comparison = compareVenuePrices({
      baseReserve: TOKENS(100_000_000),
      quoteReserve: SOL(100),
      virtualSolOffset: global.initialVirtualSolReserves,
      virtualTokenOffset,
    });
    expect(
      comparison.ammSpotLamports.gt(comparison.crossoverPriceLamports),
    ).toBe(true);
    expect(comparison.ammSpotLamports.gt(comparison.curveSpotLamports)).toBe(true);
    expect(comparison.differenceBps.gtn(0)).toBe(true);
  });

  it("prices the AMM below the curve under the crossover", () => {
    const comparison = compareVenuePrices({
      baseReserve: TOKENS(100_000_000),
      quoteReserve: SOL(1),
      virtualSolOffset: global.initialVirtualSolReserves,
      virtualTokenOffset,
    });
    expect(
      comparison.ammSpotLamports.lt(comparison.crossoverPriceLamports),
    ).toBe(true);
    expect(comparison.differenceBps.ltn(0)).toBe(true);
  });

  it("agrees with itself at the crossover ratio", () => {
    const comparison = compareVenuePrices({
      baseReserve: virtualTokenOffset,
      quoteReserve: global.initialVirtualSolReserves,
      virtualSolOffset: global.initialVirtualSolReserves,
      virtualTokenOffset,
    });
    expect(
      comparison.ammSpotLamports.eq(comparison.curveSpotLamports),
    ).toBe(true);
    expect(comparison.differenceBps.isZero()).toBe(true);
  });

  it("narrows the gap as both reserves grow past the virtual offsets", () => {
    const small = compareVenuePrices({
      baseReserve: TOKENS(100_000_000),
      quoteReserve: SOL(100),
      virtualSolOffset: global.initialVirtualSolReserves,
      virtualTokenOffset,
    });
    // Same price, ten times the depth: the fixed offsets matter ten times less.
    const large = compareVenuePrices({
      baseReserve: TOKENS(1_000_000_000),
      quoteReserve: SOL(1_000),
      virtualSolOffset: global.initialVirtualSolReserves,
      virtualTokenOffset,
    });
    expect(small.ammSpotLamports.eq(large.ammSpotLamports)).toBe(true);
    expect(large.differenceBps.lt(small.differenceBps)).toBe(true);
  });
});

describe("example 46: fee sharing config", () => {
  const holders = [
    Keypair.generate().publicKey,
    Keypair.generate().publicKey,
    Keypair.generate().publicKey,
  ];

  it("always sums an even split to exactly 10,000 bps", () => {
    for (let count = 1; count <= MAX_SHAREHOLDERS; count += 1) {
      const addresses = Array.from(
        { length: count },
        () => Keypair.generate().publicKey,
      );
      expect(splitTotalBps(evenSplit(addresses))).toBe(10_000);
    }
  });

  it("gives the indivisible remainder to the first shareholder", () => {
    const split = evenSplit(holders);
    expect(split[0]!.shareBps).toBe(3_334);
    expect(split[1]!.shareBps).toBe(3_333);
    expect(split[2]!.shareBps).toBe(3_333);
  });

  it("rejects an empty or oversized even split", () => {
    expect(() => evenSplit([])).toThrow(/at least one/);
    expect(() =>
      evenSplit(
        Array.from(
          { length: MAX_SHAREHOLDERS + 1 },
          () => Keypair.generate().publicKey,
        ),
      ),
    ).toThrow(/at most/);
  });

  it("still sums an unchecked oversized split to 10,000 bps", () => {
    const addresses = Array.from(
      { length: MAX_SHAREHOLDERS + 1 },
      () => Keypair.generate().publicKey,
    );
    expect(splitTotalBps(evenSplitUnchecked(addresses))).toBe(10_000);
  });

  it("builds createFeeSharingConfig against the fee program", async () => {
    const ix = await PUMP_SDK.createFeeSharingConfig({
      creator: wallet,
      mint,
      pool: null,
    });
    expect(ix.programId.equals(PUMP_FEE_PROGRAM_ID)).toBe(true);
    expect(
      ix.keys.some((key) => key.pubkey.equals(feeSharingConfigPda(mint))),
    ).toBe(true);
  });

  it("builds updateFeeShares for a valid split", async () => {
    const ix = await PUMP_SDK.updateFeeShares({
      authority: wallet,
      mint,
      currentShareholders: [wallet],
      newShareholders: evenSplit(holders),
    });
    expect(ix.programId.equals(PUMP_FEE_PROGRAM_ID)).toBe(true);
    expect(ix.data.length).toBeGreaterThan(0);
  });

  it("rejects every invalid split the SDK enforces", async () => {
    const cases = invalidSplits(holders);
    expect(cases).toHaveLength(5);
    for (const { label, shareholders } of cases) {
      await expect(
        PUMP_SDK.updateFeeShares({
          authority: wallet,
          mint,
          currentShareholders: [wallet],
          newShareholders: shareholders,
        }),
      ).rejects.toThrow();
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("resolves a social shareholder to the same PDA socialFeePda derives", () => {
    const { normalizedShareholders, socialRecipientsToCreate } =
      PUMP_SDK.normalizeSocialShareholders({
        newShareholders: [
          { address: wallet, shareBps: 6_000 },
          { userId: "octocat", platform: Platform.GitHub, shareBps: 4_000 },
        ],
      });
    expect(normalizedShareholders).toHaveLength(2);
    expect(socialRecipientsToCreate.size).toBe(1);
    expect(
      normalizedShareholders[1]!.address.equals(
        socialFeePda("octocat", Platform.GitHub),
      ),
    ).toBe(true);
  });
});

describe("example 47: fee sharing distribution", () => {
  const shareholders: Shareholder[] = [
    { address: Keypair.generate().publicKey, shareBps: 5_000 },
    { address: Keypair.generate().publicKey, shareBps: 3_000 },
    { address: Keypair.generate().publicKey, shareBps: 2_000 },
  ];

  it("pays each shareholder their floored share", () => {
    const split = payoutSplit(new BN(1_000_000), shareholders);
    expect(split.payouts[0]!.eq(new BN(500_000))).toBe(true);
    expect(split.payouts[1]!.eq(new BN(300_000))).toBe(true);
    expect(split.payouts[2]!.eq(new BN(200_000))).toBe(true);
    expect(split.remainder.isZero()).toBe(true);
  });

  it("conserves every lamport between payouts and remainder", () => {
    for (const amount of [1, 7, 9_999, 123_457, 1_000_000_001]) {
      const distributed = new BN(amount);
      const split = payoutSplit(distributed, shareholders);
      const paid = split.payouts.reduce((t, p) => t.add(p), new BN(0));
      expect(paid.add(split.remainder).eq(distributed)).toBe(true);
      expect(split.remainder.gten(0)).toBe(true);
    }
  });

  it("never pays a shareholder more than their exact share", () => {
    const distributed = new BN(123_457);
    const split = payoutSplit(distributed, shareholders);
    split.payouts.forEach((payout, i) => {
      const exact = distributed.muln(shareholders[i]!.shareBps);
      expect(payout.muln(10_000).lte(exact)).toBe(true);
    });
  });

  it("distributes nothing when there is nothing to distribute", () => {
    const split = payoutSplit(new BN(0), shareholders);
    expect(split.payouts.every((p) => p.isZero())).toBe(true);
    expect(split.remainder.isZero()).toBe(true);
  });

  it("round trips a DistributeCreatorFeesEvent", () => {
    const decoded = PUMP_SDK.decodeDistributeCreatorFeesEvent(
      encodeDistributeCreatorFeesEvent({
        timestamp: new BN(1_700_000_000),
        mint,
        sharingConfig: feeSharingConfigPda(mint),
        admin: wallet,
        shareholders,
        distributed: new BN(2_500_000),
      }),
    );
    expect(decoded.shareholders).toHaveLength(3);
    expect(decoded.distributed.eq(new BN(2_500_000))).toBe(true);
    expect(decoded.sharingConfig.equals(feeSharingConfigPda(mint))).toBe(true);
  });

  it("round trips a MinimumDistributableFeeEvent", () => {
    const decoded = PUMP_SDK.decodeMinimumDistributableFee(
      encodeMinimumDistributableFeeEvent({
        minimumRequired: new BN(1_000_000),
        distributableFees: new BN(2_500_000),
        canDistribute: true,
      }),
    );
    expect(decoded.canDistribute).toBe(true);
    expect(decoded.minimumRequired.eq(new BN(1_000_000))).toBe(true);
  });

  it("derives the payout vault from the config PDA, not the creator", () => {
    const config = feeSharingConfigPda(mint);
    expect(creatorVaultPda(config).equals(creatorVaultPda(TEST_CREATOR))).toBe(
      false,
    );
  });

  it("builds distributeCreatorFees with one remaining account per shareholder", async () => {
    const config = feeSharingConfigPda(mint);
    const ix = await PUMP_SDK.distributeCreatorFees({
      mint,
      sharingConfig: {
        version: 2,
        mint,
        admin: wallet,
        adminRevoked: false,
        shareholders,
      },
      sharingConfigAddress: config,
    });
    expect(ix.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    for (const shareholder of shareholders) {
      expect(
        ix.keys.some((key) => key.pubkey.equals(shareholder.address)),
      ).toBe(true);
    }
  });
});

describe("example 48: creator fees", () => {
  it("reads the AMM balance as the difference between the two calls", () => {
    const split = splitVaultBalances(new BN(600_000), new BN(1_000_000));
    expect(split.amm.eq(new BN(400_000))).toBe(true);
    expect(split.total.eq(new BN(1_000_000))).toBe(true);
    expect(split.bondingCurveShareBps.eq(new BN(6_000))).toBe(true);
  });

  it("handles a creator with nothing in either vault", () => {
    const split = splitVaultBalances(new BN(0), new BN(0));
    expect(split.amm.isZero()).toBe(true);
    expect(split.bondingCurveShareBps.isZero()).toBe(true);
  });

  it("rejects a combined balance below the bonding curve balance", () => {
    expect(() => splitVaultBalances(new BN(1_000), new BN(500))).toThrow(
      /disagree/,
    );
  });

  it("gates a claim on the fee floor", () => {
    expect(worthClaiming(CLAIM_WORTH_IT_LAMPORTS)).toBe(true);
    expect(worthClaiming(CLAIM_WORTH_IT_LAMPORTS.subn(1))).toBe(false);
  });

  it("builds a collect against the Pump program", async () => {
    const ix = await PUMP_SDK.collectCreatorFeeInstruction({
      creator: TEST_CREATOR,
    });
    expect(ix.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    expect(
      ix.keys.some((key) => key.pubkey.equals(creatorVaultPda(TEST_CREATOR))),
    ).toBe(true);
  });

  it("derives distinct vaults per program", () => {
    expect(PUMP_AMM_PROGRAM_ID.equals(PUMP_PROGRAM_ID)).toBe(false);
  });
});

describe("example 49: token incentives", () => {
  const DAY = 86_400;
  const START = 1_700_000_000;

  function accumulator(
    overrides: Partial<GlobalVolumeAccumulator> = {},
  ): GlobalVolumeAccumulator {
    return {
      startTime: new BN(START),
      endTime: new BN(START + DAY * 9),
      secondsInADay: new BN(DAY),
      mint: PublicKey.default,
      totalTokenSupply: Array.from({ length: 10 }, () => TOKENS(1_000)),
      solVolumes: Array.from({ length: 10 }, () => SOL(100)),
      ...overrides,
    };
  }

  function userAccumulator(
    overrides: Partial<UserVolumeAccumulator> = {},
  ): UserVolumeAccumulator {
    return {
      user: wallet,
      needsClaim: false,
      totalUnclaimedTokens: new BN(0),
      totalClaimedTokens: new BN(0),
      currentSolVolume: SOL(1),
      lastUpdateTimestamp: new BN(START),
      ...overrides,
    };
  }

  it("reports an unconfigured schedule instead of dividing by zero", () => {
    const window = incentiveWindow(
      accumulator({
        startTime: new BN(0),
        endTime: new BN(0),
        secondsInADay: new BN(0),
      }),
      START,
    );
    expect(window.configured).toBe(false);
    expect(window.dayIndex).toBe(0);
    expect(window.secondsRemainingInDay.isZero()).toBe(true);
  });

  it("places a timestamp in the right day", () => {
    expect(incentiveWindow(accumulator(), START).dayIndex).toBe(0);
    expect(incentiveWindow(accumulator(), START + DAY).dayIndex).toBe(1);
    expect(incentiveWindow(accumulator(), START + DAY * 9).dayIndex).toBe(9);
  });

  it("counts down the seconds left in the current day", () => {
    const window = incentiveWindow(accumulator(), START + DAY + 400);
    expect(window.dayStart.eq(new BN(START + DAY))).toBe(true);
    expect(window.secondsRemainingInDay.eq(new BN(DAY - 400))).toBe(true);
  });

  it("marks a schedule that has not started and one that has ended", () => {
    expect(incentiveWindow(accumulator(), START - 1).started).toBe(false);
    expect(incentiveWindow(accumulator(), START + DAY * 20).ended).toBe(true);
    expect(incentiveWindow(accumulator(), START).finalDayIndex).toBe(9);
  });

  it("matches currentDayTokens for a trader inside the window", () => {
    const global = accumulator();
    const user = userAccumulator();
    const projected = projectedDayShare({
      userSolVolume: user.currentSolVolume,
      daySolVolume: global.solVolumes[0]!,
      dayTokenSupply: global.totalTokenSupply[0]!,
    });
    expect(currentDayTokensFor(global, user)).toBe(projected.toString());
  });

  it("projects nothing from a day with no volume", () => {
    expect(
      projectedDayShare({
        userSolVolume: SOL(1),
        daySolVolume: new BN(0),
        dayTokenSupply: TOKENS(1_000),
      }).isZero(),
    ).toBe(true);
  });

  it("sums the supply still to be handed out", () => {
    const global = accumulator();
    expect(remainingProgramSupply(global, 0).eq(TOKENS(10_000))).toBe(true);
    expect(remainingProgramSupply(global, 9).eq(TOKENS(1_000))).toBe(true);
    expect(remainingProgramSupply(global, 10).isZero()).toBe(true);
  });

  it("derives a per-user accumulator on each program", () => {
    const accumulators = cashbackAccumulators(wallet);
    expect(accumulators.bondingCurve.equals(accumulators.amm)).toBe(false);
  });

  it("reports zero unclaimed for a trader who never traded", () => {
    const global = accumulator();
    const user = userAccumulator({
      currentSolVolume: new BN(0),
      lastUpdateTimestamp: new BN(START),
    });
    expect(totalUnclaimedTokensFor(global, user)).toBe("0");
  });
});

/** currentDayTokens as a string, so BN identity does not confuse a failure. */
function currentDayTokensFor(
  global: GlobalVolumeAccumulator,
  user: UserVolumeAccumulator,
): string {
  return currentDayTokens(global, user, global.startTime.toNumber()).toString();
}

/** totalUnclaimedTokens as a string, for the same reason. */
function totalUnclaimedTokensFor(
  global: GlobalVolumeAccumulator,
  user: UserVolumeAccumulator,
): string {
  return totalUnclaimedTokens(
    global,
    user,
    global.startTime.toNumber(),
  ).toString();
}

describe("example 50: vanity mints", () => {
  it("finds a keypair whose address satisfies the predicate", async () => {
    const pattern = { suffix: "a" };
    const result = await generateVanityMint({ ...pattern, maxAttempts: 100_000 });
    expect(
      matchesVanityPattern(result.keypair.publicKey.toBase58(), pattern),
    ).toBe(true);
    expect(result.attempts).toBeGreaterThan(0);
  }, 30_000);

  it("honours a case-insensitive match", async () => {
    const pattern = { suffix: "A", caseInsensitive: true };
    const result = await generateVanityMint({ ...pattern, maxAttempts: 100_000 });
    const address = result.keypair.publicKey.toBase58();
    expect(matchesVanityPattern(address, pattern)).toBe(true);
    expect(address.toLowerCase().endsWith("a")).toBe(true);
  }, 30_000);

  it("accepts any address when the pattern is empty", () => {
    expect(matchesVanityPattern("anything", {})).toBe(true);
    expect(matchesVanityPattern("anything", { prefix: "", suffix: "" })).toBe(
      true,
    );
  });

  it("rejects an address that misses either end of the pattern", () => {
    expect(matchesVanityPattern("abcxyz", { prefix: "abc", suffix: "xyz" })).toBe(
      true,
    );
    expect(matchesVanityPattern("abcxyz", { prefix: "abd" })).toBe(false);
    expect(matchesVanityPattern("abcxyz", { suffix: "xyw" })).toBe(false);
    expect(matchesVanityPattern("abcxyz", { prefix: "ABC" })).toBe(false);
  });

  it("names the characters Base58 cannot produce", () => {
    expect(unmatchableCharacters("p0mp")).toEqual(["0"]);
    expect(unmatchableCharacters("pOImp")).toEqual(["O", "I"]);
    expect(unmatchableCharacters("pump")).toEqual([]);
  });

  it("scales the cost estimate by 58 per character", () => {
    expect(estimateVanityMintAttempts({ suffix: "ws" })).toBe(58 * 58);
    expect(estimateSeconds({ suffix: "ws" }, 3_364)).toBeCloseTo(1);
    expect(estimateSeconds({ suffix: "ws" }, 0)).toBe(Infinity);
  });
});

describe("every example exports a runnable main", () => {
  it.each([
    ["09", exampleMains.example09],
    ["10", exampleMains.example10],
    ["42", exampleMains.example42],
    ["43", exampleMains.example43],
    ["44", exampleMains.example44],
    ["45", exampleMains.example45],
    ["46", exampleMains.example46],
    ["47", exampleMains.example47],
    ["48", exampleMains.example48],
    ["49", exampleMains.example49],
    ["50", exampleMains.example50],
  ])("example %s", (_n, main: unknown) => {
    expect(typeof main).toBe("function");
  });
});
