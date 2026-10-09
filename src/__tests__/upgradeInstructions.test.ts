/**
 * Builders, decoders and error lookups the October 2026 upgrade added: v3
 * curve trades, PumpSwap v2 trades, `multi_hop_swap`, fee sweeps, pump-coin
 * quote accounts in `create_v2`, decoders that tolerate older (shorter) and
 * newer (longer) layouts, and the new program error codes.
 */
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { BorshInstructionCoder } from "@coral-xyz/anchor";
import {
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { AccountInfo, TransactionInstruction } from "@solana/web3.js";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// Import from `../pda` before `../sdk` (see sdk.test.ts: pda.ts -> sdk.ts ->
// onlineSdk.ts -> pda.ts is a live cycle).
import {
  AMM_GLOBAL_CONFIG_PDA,
  AMM_GLOBAL_PDA,
  QUOTE_CONTROL_PDA,
  bondingCurvePda,
  canonicalPumpPoolPdaWithQuote,
  creatorVaultPda,
  userVolumeAccumulatorPda,
} from "../pda";
import {
  AMM_GLOBAL_CONFIG_SIZE,
  BONDING_CURVE_INITIALIZE_SIZE,
  BONDING_CURVE_SIZE,
  GLOBAL_SIZE,
  POOL_SIZE,
  PUMP_AMM_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_SDK,
  createV2QuoteRemainingAccounts,
  multiHopHopAccounts,
  multiHopRouteEnds,
  tradeV2Accounts,
  tradeV3Accounts,
} from "../sdk";
import type { MultiHopHop } from "../sdk";
import { poolQuoteTerms } from "../onlineSdk";
import { getBuybackFeeRecipientForTokenQuote } from "../fees";
import {
  CashbackCoinNotSupportedError,
  MultiHopDiscontinuousPathError,
  getPumpProgramError,
} from "../errors";
import pumpIdlJson from "../idl/pump.json";
import pumpAmmIdlJson from "../idl/pump_amm.json";
import type { Pump } from "../idl/pump";
import type { PumpAmm } from "../idl/pump_amm";
import { SweepFeeBucket } from "../state";
import type { Pool } from "../state";
import { TEST_CREATOR, makeBondingCurve, makeGlobal } from "./fixtures";

const provider = new AnchorProvider(null as any, null as any, {});
const pumpCoder = new Program(pumpIdlJson as Pump, provider).coder;
const ammCoder = new Program(pumpAmmIdlJson as PumpAmm, provider).coder;
const pumpInstructionCoder = pumpCoder.instruction as BorshInstructionCoder;

const USER = Keypair.generate().publicKey;
const MINT = Keypair.generate().publicKey;
const QUOTE_MINT = Keypair.generate().publicKey;
const COIN_A = Keypair.generate().publicKey;
const COIN_B = Keypair.generate().publicKey;

type IdlWithInstructions = {
  instructions: {
    name: string;
    discriminator: number[];
    accounts: unknown[];
  }[];
};

function idlInstruction(idl: IdlWithInstructions, name: string) {
  const found = idl.instructions.find((ix) => ix.name === name);
  if (!found) throw new Error(`IDL has no instruction ${name}`);
  return found;
}

/** Asserts `ix` is `name` with exactly the IDL's account list. */
function expectInstruction(
  ix: TransactionInstruction,
  idl: IdlWithInstructions,
  name: string,
  extraAccounts = 0,
) {
  const declared = idlInstruction(idl, name);
  expect(ix.data.subarray(0, 8)).toEqual(Buffer.from(declared.discriminator));
  expect(ix.keys).toHaveLength(declared.accounts.length + extraAccounts);
}

function accountInfo(
  data: Buffer,
  owner = PUMP_PROGRAM_ID,
): AccountInfo<Buffer> {
  return { data, owner, lamports: 1, executable: false, rentEpoch: 0 };
}

/** An all-zero account of `name` with its discriminator, `size` bytes long. */
function zeroAccount(
  idl: { accounts: { name: string; discriminator: number[] }[] },
  name: string,
  size: number,
): Buffer {
  const found = idl.accounts.find((account) => account.name === name);
  if (!found) throw new Error(`IDL has no account ${name}`);
  return Buffer.concat([
    Buffer.from(found.discriminator),
    Buffer.alloc(size - found.discriminator.length),
  ]);
}

const pumpIdl = pumpIdlJson as unknown as IdlWithInstructions & {
  accounts: { name: string; discriminator: number[] }[];
};
const ammIdl = pumpAmmIdlJson as unknown as IdlWithInstructions & {
  accounts: { name: string; discriminator: number[] }[];
};

describe("account sizes", () => {
  it("match the bundled IDLs", () => {
    expect(pumpCoder.accounts.size("bondingCurve")).toBe(BONDING_CURVE_SIZE);
    expect(pumpCoder.accounts.size("global")).toBe(GLOBAL_SIZE);
    expect(ammCoder.accounts.size("pool")).toBe(POOL_SIZE);
    expect(ammCoder.accounts.size("globalConfig")).toBe(AMM_GLOBAL_CONFIG_SIZE);
  });

  it("derive the PumpAMM GlobalConfig PDA from its real seed", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      PUMP_AMM_PROGRAM_ID,
    );
    expect(AMM_GLOBAL_PDA.equals(expected)).toBe(true);
    expect(AMM_GLOBAL_CONFIG_PDA.equals(expected)).toBe(true);
  });
});

describe("bonding curve v3 trades", () => {
  it("builds buy_v3, buy_exact_quote_in_v3 and sell_v3 with the IDL's 17 accounts", async () => {
    const params = {
      user: USER,
      mint: MINT,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
    };
    expectInstruction(
      await PUMP_SDK.getBuyV3InstructionRaw(params),
      pumpIdl,
      "buy_v3",
    );
    expectInstruction(
      await PUMP_SDK.getBuyExactQuoteInV3InstructionRaw({
        user: USER,
        mint: MINT,
        spendableQuoteIn: new BN(10_000_000),
        minTokensOut: new BN(1),
      }),
      pumpIdl,
      "buy_exact_quote_in_v3",
    );
    expectInstruction(
      await PUMP_SDK.getSellV3InstructionRaw(params),
      pumpIdl,
      "sell_v3",
    );
  });

  it("encodes buy_v3 args in program order", async () => {
    const ix = await PUMP_SDK.getBuyV3InstructionRaw({
      user: USER,
      mint: MINT,
      amount: new BN(123),
      quoteAmount: new BN(456),
      partialFill: true,
    });
    const decoded = pumpInstructionCoder.decode(ix.data);
    expect(decoded?.name).toBe("buyV3");
    const data = decoded?.data as {
      amount: BN;
      maxSolCost: BN;
      partialFill: { 0: boolean };
    };
    expect(data.amount.eqn(123)).toBe(true);
    expect(data.maxSolCost.eqn(456)).toBe(true);
    // `partial_fill` is the IDL's `OptionBool` tuple struct.
    expect(data.partialFill).toEqual({ 0: true });
  });

  it("pays a SOL curve's buyback to the wallet and a token curve's to its ATA", () => {
    const recipient = Keypair.generate().publicKey;
    const sol = tradeV3Accounts({
      user: USER,
      mint: MINT,
      quoteMint: PublicKey.default,
      buybackFeeRecipient: recipient,
    });
    expect(sol.quoteMint.equals(NATIVE_MINT)).toBe(true);
    expect(sol.buybackFeeRecipient.equals(recipient)).toBe(true);

    const token = tradeV3Accounts({
      user: USER,
      mint: MINT,
      quoteMint: QUOTE_MINT,
      buybackFeeRecipient: recipient,
    });
    expect(
      token.buybackFeeRecipient.equals(
        getAssociatedTokenAddressSync(
          QUOTE_MINT,
          recipient,
          true,
          TOKEN_PROGRAM_ID,
        ),
      ),
    ).toBe(true);
    expect(
      token.associatedQuoteBondingCurve.equals(
        getAssociatedTokenAddressSync(
          QUOTE_MINT,
          bondingCurvePda(MINT),
          true,
          TOKEN_PROGRAM_ID,
        ),
      ),
    ).toBe(true);
  });

  it("creates the user's ATA and the buyback ATA before a token-quoted buy", async () => {
    const instructions = await PUMP_SDK.buyV3Instructions({
      bondingCurve: makeBondingCurve({
        quoteMint: QUOTE_MINT,
        creator: TEST_CREATOR,
      }),
      associatedUserAccountInfo: null,
      mint: MINT,
      user: USER,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
      slippage: 1,
    });
    expect(instructions).toHaveLength(3);
    const last = instructions[
      instructions.length - 1
    ] as TransactionInstruction;
    expectInstruction(last, pumpIdl, "buy_v3");
    // 1% slippage on the quote cap, in 0.1% steps.
    const decoded = pumpInstructionCoder.decode(last.data)?.data as {
      maxSolCost: BN;
    };
    expect(decoded.maxSolCost.eqn(10_100_000)).toBe(true);
  });

  it("needs no extra instruction before a SOL-quoted buy into an existing ATA", async () => {
    const instructions = await PUMP_SDK.buyV3Instructions({
      bondingCurve: makeBondingCurve({ creator: TEST_CREATOR }),
      associatedUserAccountInfo: accountInfo(
        Buffer.alloc(165),
        TOKEN_2022_PROGRAM_ID,
      ),
      mint: MINT,
      user: USER,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
      slippage: 1,
    });
    expect(instructions).toHaveLength(1);
  });

  it("refuses cashback coins (6094)", async () => {
    await expect(
      PUMP_SDK.sellV3Instructions({
        bondingCurve: makeBondingCurve({ isCashbackCoin: true }),
        mint: MINT,
        user: USER,
        amount: new BN(1),
        quoteAmount: new BN(1),
        slippage: 1,
      }),
    ).rejects.toThrow(CashbackCoinNotSupportedError);
  });
});

/** The key `ix` passes for the IDL account `name` (fixed accounts only). */
function keyFor(
  ix: TransactionInstruction,
  idl: IdlWithInstructions,
  instruction: string,
  name: string,
) {
  const accounts = idlInstruction(idl, instruction).accounts as {
    name: string;
  }[];
  const index = accounts.findIndex((account) => account.name === name);
  if (index < 0) throw new Error(`${instruction} has no account ${name}`);
  return ix.keys[index]!;
}

describe("bonding curve v2 trades", () => {
  const FEE_RECIPIENT = Keypair.generate().publicKey;
  const RESERVED_RECIPIENT = Keypair.generate().publicKey;
  const global = makeGlobal({
    feeRecipient: FEE_RECIPIENT,
    feeRecipients: [FEE_RECIPIENT],
    reservedFeeRecipient: RESERVED_RECIPIENT,
    reservedFeeRecipients: [RESERVED_RECIPIENT],
  });

  it("builds buy_v2 and buy_exact_quote_in_v2 with 27 accounts and sell_v2 with 26", async () => {
    const params = {
      user: USER,
      mint: MINT,
      creator: TEST_CREATOR,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
    };
    const buy = await PUMP_SDK.getBuyV2InstructionRaw(params);
    expectInstruction(buy, pumpIdl, "buy_v2");
    expect(buy.keys).toHaveLength(27);
    expectInstruction(
      await PUMP_SDK.getBuyExactQuoteInV2InstructionRaw({
        user: USER,
        mint: MINT,
        creator: TEST_CREATOR,
        spendableQuoteIn: new BN(10_000_000),
        minTokensOut: new BN(1),
      }),
      pumpIdl,
      "buy_exact_quote_in_v2",
    );
    const sell = await PUMP_SDK.getSellV2InstructionRaw(params);
    expectInstruction(sell, pumpIdl, "sell_v2");
    expect(sell.keys).toHaveLength(26);
  });

  it("encodes buy_v2 and buy_exact_quote_in_v2 args in program order", async () => {
    const buy = pumpInstructionCoder.decode(
      (
        await PUMP_SDK.getBuyV2InstructionRaw({
          user: USER,
          mint: MINT,
          creator: TEST_CREATOR,
          amount: new BN(123),
          quoteAmount: new BN(456),
          partialFill: true,
        })
      ).data,
    );
    expect(buy?.name).toBe("buyV2");
    const buyData = buy?.data as {
      amount: BN;
      maxSolCost: BN;
      partialFill: { 0: boolean };
    };
    expect(buyData.amount.eqn(123)).toBe(true);
    expect(buyData.maxSolCost.eqn(456)).toBe(true);
    expect(buyData.partialFill).toEqual({ 0: true });

    const exact = pumpInstructionCoder.decode(
      (
        await PUMP_SDK.getBuyExactQuoteInV2InstructionRaw({
          user: USER,
          mint: MINT,
          creator: TEST_CREATOR,
          spendableQuoteIn: new BN(789),
          minTokensOut: new BN(10),
        })
      ).data,
    );
    expect(exact?.name).toBe("buyExactQuoteInV2");
    const exactData = exact?.data as {
      spendableQuoteIn: BN;
      minTokensOut: BN;
      partialFill: { 0: boolean };
    };
    expect(exactData.spendableQuoteIn.eqn(789)).toBe(true);
    expect(exactData.minTokensOut.eqn(10)).toBe(true);
    expect(exactData.partialFill).toEqual({ 0: false });
  });

  it("pays the fee recipient, buyback wallet and creator vault in WSOL on a SOL curve", async () => {
    const buyback = Keypair.generate().publicKey;
    const ix = await PUMP_SDK.getBuyV2InstructionRaw({
      user: USER,
      mint: MINT,
      creator: TEST_CREATOR,
      amount: new BN(1),
      quoteAmount: new BN(1),
      feeRecipient: FEE_RECIPIENT,
      buybackFeeRecipient: buyback,
      quoteMint: PublicKey.default,
    });
    const key = (name: string) => keyFor(ix, pumpIdl, "buy_v2", name);
    const wsolAta = (owner: PublicKey) =>
      getAssociatedTokenAddressSync(NATIVE_MINT, owner, true, TOKEN_PROGRAM_ID);
    const creatorVault = creatorVaultPda(TEST_CREATOR);

    expect(key("quote_mint").pubkey.equals(NATIVE_MINT)).toBe(true);
    expect(key("fee_recipient").pubkey.equals(FEE_RECIPIENT)).toBe(true);
    expect(
      key("associated_quote_fee_recipient").pubkey.equals(
        wsolAta(FEE_RECIPIENT),
      ),
    ).toBe(true);
    expect(key("buyback_fee_recipient").pubkey.equals(buyback)).toBe(true);
    expect(
      key("associated_quote_buyback_fee_recipient").pubkey.equals(
        wsolAta(buyback),
      ),
    ).toBe(true);
    expect(key("bonding_curve").pubkey.equals(bondingCurvePda(MINT))).toBe(
      true,
    );
    expect(key("creator_vault").pubkey.equals(creatorVault)).toBe(true);
    expect(
      key("associated_creator_vault").pubkey.equals(wsolAta(creatorVault)),
    ).toBe(true);
    expect(
      key("associated_user_volume_accumulator").pubkey.equals(
        wsolAta(userVolumeAccumulatorPda(USER)),
      ),
    ).toBe(true);
    expect(
      key("associated_base_user").pubkey.equals(
        getAssociatedTokenAddressSync(MINT, USER, true, TOKEN_2022_PROGRAM_ID),
      ),
    ).toBe(true);
    expect(key("user").isSigner).toBe(true);
    expect(key("user").isWritable).toBe(true);
  });

  it("defaults a token quote's buyback to the first listed wallet's ATA", async () => {
    const accounts = tradeV2Accounts({
      user: USER,
      mint: MINT,
      creator: TEST_CREATOR,
      quoteMint: QUOTE_MINT,
    });
    const recipient = getBuybackFeeRecipientForTokenQuote();
    expect(accounts.buybackFeeRecipient.equals(recipient)).toBe(true);
    expect(
      accounts.associatedQuoteBuybackFeeRecipient.equals(
        getAssociatedTokenAddressSync(
          QUOTE_MINT,
          recipient,
          true,
          TOKEN_PROGRAM_ID,
        ),
      ),
    ).toBe(true);
    expect(
      accounts.associatedQuoteBondingCurve.equals(
        getAssociatedTokenAddressSync(
          QUOTE_MINT,
          bondingCurvePda(MINT),
          true,
          TOKEN_PROGRAM_ID,
        ),
      ),
    ).toBe(true);
  });

  it("creates the user's ATA and the buyback ATA before a token-quoted buy", async () => {
    const instructions = await PUMP_SDK.buyV2Instructions({
      global,
      bondingCurve: makeBondingCurve({
        quoteMint: QUOTE_MINT,
        creator: TEST_CREATOR,
      }),
      associatedUserAccountInfo: null,
      mint: MINT,
      user: USER,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
      slippage: 1,
    });
    expect(instructions).toHaveLength(3);
    const last = instructions[2] as TransactionInstruction;
    expectInstruction(last, pumpIdl, "buy_v2");
    // 1% slippage on the quote cap, in 0.1% steps.
    const decoded = pumpInstructionCoder.decode(last.data)?.data as {
      maxSolCost: BN;
    };
    expect(decoded.maxSolCost.eqn(10_100_000)).toBe(true);
    expect(
      keyFor(last, pumpIdl, "buy_v2", "fee_recipient").pubkey.equals(
        FEE_RECIPIENT,
      ),
    ).toBe(true);
  });

  it("needs no extra instruction before a SOL-quoted buy into an existing ATA", async () => {
    const instructions = await PUMP_SDK.buyExactQuoteInV2Instructions({
      global,
      bondingCurve: makeBondingCurve({ creator: TEST_CREATOR }),
      associatedUserAccountInfo: accountInfo(
        Buffer.alloc(165),
        TOKEN_2022_PROGRAM_ID,
      ),
      mint: MINT,
      user: USER,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
      slippage: 1,
    });
    expect(instructions).toHaveLength(1);
    const decoded = pumpInstructionCoder.decode(instructions[0]!.data)
      ?.data as { spendableQuoteIn: BN; minTokensOut: BN };
    expect(decoded.spendableQuoteIn.eqn(10_000_000)).toBe(true);
    expect(decoded.minTokensOut.eqn(990_000)).toBe(true);
  });

  it("pays a mayhem coin's fee to a reserved recipient", async () => {
    const [ix] = await PUMP_SDK.sellV2Instructions({
      global,
      bondingCurve: makeBondingCurve({
        creator: TEST_CREATOR,
        isMayhemMode: true,
      }),
      mint: MINT,
      user: USER,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
      slippage: 1,
    });
    expect(
      keyFor(ix!, pumpIdl, "sell_v2", "fee_recipient").pubkey.equals(
        RESERVED_RECIPIENT,
      ),
    ).toBe(true);
    const decoded = pumpInstructionCoder.decode(ix!.data)?.data as {
      minSolOutput: BN;
    };
    expect(decoded.minSolOutput.eqn(9_900_000)).toBe(true);
  });

  it("trades cashback coins, which v3 refuses", async () => {
    const bondingCurve = makeBondingCurve({
      creator: TEST_CREATOR,
      isCashbackCoin: true,
    });
    const buy = await PUMP_SDK.buyV2Instructions({
      global,
      bondingCurve,
      associatedUserAccountInfo: null,
      mint: MINT,
      user: USER,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
      slippage: 1,
    });
    expectInstruction(buy[buy.length - 1]!, pumpIdl, "buy_v2");
    const sell = await PUMP_SDK.sellV2Instructions({
      global,
      bondingCurve,
      mint: MINT,
      user: USER,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
      slippage: 1,
    });
    expect(sell).toHaveLength(1);
    expectInstruction(sell[0]!, pumpIdl, "sell_v2");
  });

  it("creates the seller's and the buyback quote ATAs before a token-quoted sell", async () => {
    const instructions = await PUMP_SDK.sellV2Instructions({
      global,
      bondingCurve: makeBondingCurve({
        quoteMint: QUOTE_MINT,
        creator: TEST_CREATOR,
      }),
      mint: MINT,
      user: USER,
      amount: new BN(1_000_000),
      quoteAmount: new BN(10_000_000),
      slippage: 1,
    });
    expect(instructions).toHaveLength(3);
    expectInstruction(instructions[2]!, pumpIdl, "sell_v2");
  });
});

describe("multi_hop_curve_swap", () => {
  function curveSwapInstruction(
    amountIn: BN,
    hopFees: Buffer,
    extra: number,
  ): TransactionInstruction {
    const keys = idlInstruction(pumpIdl, "multi_hop_curve_swap").accounts.map(
      () => ({
        pubkey: Keypair.generate().publicKey,
        isSigner: false,
        isWritable: false,
      }),
    );
    for (let i = 0; i < extra; i++) {
      keys.push({
        pubkey: Keypair.generate().publicKey,
        isSigner: false,
        isWritable: true,
      });
    }
    return {
      programId: PUMP_PROGRAM_ID,
      keys,
      data: pumpInstructionCoder.encode("multiHopCurveSwap", {
        amountIn,
        hopFees,
      }),
    } as TransactionInstruction;
  }

  it("reads the amount, fee plan and named accounts of PumpSwap's CPI", () => {
    const ix = curveSwapInstruction(new BN(5_000), Buffer.from([1, 2, 3]), 5);
    const call = PUMP_SDK.decodeMultiHopCurveSwapInstruction(ix);
    expect(call).not.toBeNull();
    expect(call!.amountIn.eqn(5_000)).toBe(true);
    expect([...call!.hopFees]).toEqual([1, 2, 3]);
    expect(call!.user.equals(ix.keys[3]!.pubkey)).toBe(true);
    expect(call!.sourceAuthority.equals(ix.keys[4]!.pubkey)).toBe(true);
    expect(call!.source.equals(ix.keys[5]!.pubkey)).toBe(true);
    expect(call!.destination.equals(ix.keys[6]!.pubkey)).toBe(true);
    expect(call!.buybackFeeRecipient.equals(ix.keys[7]!.pubkey)).toBe(true);
    expect(call!.remainingAccounts).toHaveLength(5);
  });

  it("returns null for other pump instructions and other programs", async () => {
    const buy = await PUMP_SDK.getBuyV2InstructionRaw({
      user: USER,
      mint: MINT,
      creator: TEST_CREATOR,
      amount: new BN(1),
      quoteAmount: new BN(1),
    });
    expect(PUMP_SDK.decodeMultiHopCurveSwapInstruction(buy)).toBeNull();
    const ix = curveSwapInstruction(new BN(1), Buffer.alloc(0), 0);
    expect(
      PUMP_SDK.decodeMultiHopCurveSwapInstruction({
        ...ix,
        programId: PUMP_AMM_PROGRAM_ID,
      } as TransactionInstruction),
    ).toBeNull();
  });

  it("is declared CPI-only: PumpSwap's global_config must sign", () => {
    const accounts = idlInstruction(pumpIdl, "multi_hop_curve_swap")
      .accounts as { name: string; signer?: boolean }[];
    const config = accounts.find(
      (account) => account.name === "pump_amm_global_config",
    );
    expect(config?.signer).toBe(true);
    expect(accounts).toHaveLength(13);
  });
});

describe("fee sweeps", () => {
  it("builds the pump sweeps with the IDL's 13 accounts", async () => {
    const protocol = await PUMP_SDK.sweepProtocolFeeInstruction({
      payer: USER,
      mint: MINT,
      recipient: USER,
      quoteMint: PublicKey.default,
    });
    expectInstruction(protocol, pumpIdl, "sweep_protocol_fee");
    expect(protocol.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    const creator = await PUMP_SDK.sweepCreatorFeeInstruction({
      payer: USER,
      mint: MINT,
      creator: TEST_CREATOR,
      quoteMint: QUOTE_MINT,
    });
    expectInstruction(creator, pumpIdl, "sweep_creator_fee");
  });

  it("builds the PumpAMM sweeps with the IDL's 12 accounts against the canonical pool", async () => {
    const protocol = await PUMP_SDK.ammSweepProtocolFeeInstruction({
      payer: USER,
      mint: MINT,
      recipient: USER,
    });
    expectInstruction(protocol, ammIdl, "sweep_protocol_fee");
    expect(protocol.programId.equals(PUMP_AMM_PROGRAM_ID)).toBe(true);
    const pool = canonicalPumpPoolPdaWithQuote(MINT, NATIVE_MINT);
    expect(protocol.keys.some((key) => key.pubkey.equals(pool))).toBe(true);
    expectInstruction(
      await PUMP_SDK.ammSweepCreatorFeeInstruction({
        payer: USER,
        mint: MINT,
        coinCreator: TEST_CREATOR,
      }),
      ammIdl,
      "sweep_creator_fee",
    );
  });
});

describe("PumpSwap v2 trades", () => {
  it("builds buy_v2, buy_exact_quote_in_v2 and sell_v2 with the IDL's 17 accounts", async () => {
    const pool = canonicalPumpPoolPdaWithQuote(MINT, NATIVE_MINT);
    expectInstruction(
      await PUMP_SDK.ammBuyV2Instruction({
        user: USER,
        pool,
        mint: MINT,
        baseAmountOut: new BN(1000),
        maxQuoteAmountIn: new BN(2000),
      }),
      ammIdl,
      "buy_v2",
    );
    expectInstruction(
      await PUMP_SDK.ammBuyExactQuoteInV2Instruction({
        user: USER,
        pool,
        mint: MINT,
        spendableQuoteIn: new BN(2000),
        minBaseAmountOut: new BN(1000),
      }),
      ammIdl,
      "buy_exact_quote_in_v2",
    );
    expectInstruction(
      await PUMP_SDK.ammSellV2Instruction({
        user: USER,
        pool,
        mint: MINT,
        baseAmountIn: new BN(1000),
        minQuoteAmountOut: new BN(1),
      }),
      ammIdl,
      "sell_v2",
    );
  });
});

describe("multi_hop_swap", () => {
  // SOL -> COIN_A (on its curve) -> COIN_B (on its pool, quoted in COIN_A).
  const hops: MultiHopHop[] = [
    {
      venue: "curve",
      baseMint: COIN_A,
      quoteMint: PublicKey.default,
      baseTokenProgram: TOKEN_2022_PROGRAM_ID,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
    },
    {
      venue: "pool",
      baseMint: COIN_B,
      quoteMint: COIN_A,
      baseTokenProgram: TOKEN_2022_PROGRAM_ID,
      quoteTokenProgram: TOKEN_2022_PROGRAM_ID,
    },
  ];

  it("reads a buy route from SOL (as WSOL) up to the last coin", () => {
    const { input, output, currency } = multiHopRouteEnds(hops, "buy");
    expect(input.mint.equals(NATIVE_MINT)).toBe(true);
    expect(input.tokenProgram.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(output.mint.equals(COIN_B)).toBe(true);
    expect(currency.mint.equals(NATIVE_MINT)).toBe(true);
  });

  it("reads the reversed route as a sell down to SOL", () => {
    const { input, output, currency } = multiHopRouteEnds(
      [...hops].reverse(),
      "sell",
    );
    expect(input.mint.equals(COIN_B)).toBe(true);
    expect(output.mint.equals(NATIVE_MINT)).toBe(true);
    expect(currency.mint.equals(NATIVE_MINT)).toBe(true);
  });

  it("refuses a route whose hops do not chain (6084)", () => {
    expect(() => multiHopRouteEnds([...hops].reverse(), "buy")).toThrow(
      MultiHopDiscontinuousPathError,
    );
    expect(() => multiHopRouteEnds([], "buy")).toThrow(/at least one hop/);
  });

  it("sends each hop as base mint, quote mint, venue and its two vaults", () => {
    const [curveHop, poolHop] = hops as [MultiHopHop, MultiHopHop];
    const curveKeys = multiHopHopAccounts(curveHop);
    expect(curveKeys).toHaveLength(5);
    expect(curveKeys[1]?.pubkey.equals(NATIVE_MINT)).toBe(true);
    expect(curveKeys[2]?.pubkey.equals(bondingCurvePda(COIN_A))).toBe(true);
    const poolKeys = multiHopHopAccounts(poolHop);
    const pool = canonicalPumpPoolPdaWithQuote(COIN_B, COIN_A);
    expect(poolKeys[2]?.pubkey.equals(pool)).toBe(true);
    expect(
      poolKeys[4]?.pubkey.equals(
        getAssociatedTokenAddressSync(
          COIN_A,
          pool,
          true,
          TOKEN_2022_PROGRAM_ID,
        ),
      ),
    ).toBe(true);
  });

  it("appends five accounts per hop to the IDL's 16", async () => {
    const ix = await PUMP_SDK.multiHopSwapInstruction({
      user: USER,
      hops,
      side: "buy",
      amountIn: new BN(1_000_000_000),
      minAmountOut: new BN(1),
    });
    expectInstruction(ix, ammIdl, "multi_hop_swap", 5 * hops.length);
  });

  it("wraps no SOL when the route starts on a curve, and closes WSOL after", async () => {
    const instructions = await PUMP_SDK.multiHopSwapInstructions({
      user: USER,
      hops,
      side: "buy",
      amountIn: new BN(1_000_000_000),
      minAmountOut: new BN(1),
    });
    // WSOL ATA, output ATA, buyback ATA, the swap, WSOL close.
    expect(instructions).toHaveLength(5);
    expectInstruction(
      instructions[3] as TransactionInstruction,
      ammIdl,
      "multi_hop_swap",
      5 * hops.length,
    );
  });
});

describe("create_v2 quote mints", () => {
  const base = {
    mint: MINT,
    name: "Name",
    symbol: "SYM",
    uri: "https://example.com/meta.json",
    creator: TEST_CREATOR,
    user: USER,
    mayhemMode: false,
  };

  it("sends no remaining accounts for a SOL curve", async () => {
    expectInstruction(
      await PUMP_SDK.createV2Instruction(base),
      pumpIdl,
      "create_v2",
    );
  });

  it("selects a listed quote mint with four remaining accounts", async () => {
    const ix = await PUMP_SDK.createV2Instruction({
      ...base,
      quoteMint: QUOTE_MINT,
    });
    expectInstruction(ix, pumpIdl, "create_v2", 4);
    const tail = ix.keys.slice(-4);
    expect(tail[0]?.pubkey.equals(QUOTE_MINT)).toBe(true);
    expect(tail[1]?.isWritable).toBe(true);
    expect(tail[3]?.pubkey.equals(QUOTE_CONTROL_PDA)).toBe(true);
  });

  it("adds a pump coin's curve, and its pool and vaults once it migrated", () => {
    const pool = {
      pool: Keypair.generate().publicKey,
      baseVault: Keypair.generate().publicKey,
      quoteVault: Keypair.generate().publicKey,
    };
    const curveOnly = createV2QuoteRemainingAccounts({
      mint: MINT,
      quoteMint: COIN_A,
      quoteTokenProgram: TOKEN_2022_PROGRAM_ID,
      pumpQuote: {},
    });
    expect(curveOnly).toHaveLength(5);
    expect(curveOnly[4]?.pubkey.equals(bondingCurvePda(COIN_A))).toBe(true);
    const migrated = createV2QuoteRemainingAccounts({
      mint: MINT,
      quoteMint: COIN_A,
      quoteTokenProgram: TOKEN_2022_PROGRAM_ID,
      pumpQuote: { pool },
    });
    expect(migrated.map((meta) => meta.pubkey.toBase58()).slice(5)).toEqual([
      pool.pool.toBase58(),
      pool.baseVault.toBase58(),
      pool.quoteVault.toBase58(),
    ]);
  });

  it("buys a token-quoted launch with buy_v3", async () => {
    const instructions = await PUMP_SDK.createV2AndBuyInstructions({
      ...base,
      global: makeGlobal(),
      amount: new BN(1_000_000),
      solAmount: new BN(5_000_000),
      quoteMint: QUOTE_MINT,
    });
    expectInstruction(
      instructions[0] as TransactionInstruction,
      pumpIdl,
      "create_v2",
      4,
    );
    expectInstruction(
      instructions[instructions.length - 1] as TransactionInstruction,
      pumpIdl,
      "buy_v3",
    );
  });
});

describe("decoders across layouts", () => {
  it("reads a 49-byte initial bonding curve with the newer fields at defaults", () => {
    const curve = PUMP_SDK.decodeBondingCurve(
      accountInfo(
        zeroAccount(pumpIdl, "BondingCurve", BONDING_CURVE_INITIALIZE_SIZE),
      ),
    );
    expect(curve.quoteMint.equals(PublicKey.default)).toBe(true);
    expect(curve.depth).toBe(0);
    expect(curve.creatorFee.isZero()).toBe(true);
    expect(() =>
      PUMP_SDK.decodeBondingCurve(
        accountInfo(zeroAccount(pumpIdl, "BondingCurve", 48)),
      ),
    ).toThrow(/at least 49/);
  });

  it("reads a Global written before max_curve_depth", () => {
    const global = PUMP_SDK.decodeGlobal(
      accountInfo(zeroAccount(pumpIdl, "Global", GLOBAL_SIZE - 40)),
    );
    expect(global.maxCurveDepth).toBe(0);
  });

  it("keeps a pool's virtual quote reserves signed", async () => {
    const zero = PUMP_SDK.decodePool(
      accountInfo(zeroAccount(ammIdl, "Pool", 211), PUMP_AMM_PROGRAM_ID),
    );
    expect(zero.virtualQuoteReserves.isZero()).toBe(true);
    const pool: Pool = {
      ...zero,
      quoteMint: QUOTE_MINT,
      virtualQuoteReserves: new BN("-12345678901234"),
      creatorFeeBps: new BN(40),
      isMayhemMode: true,
    };
    const data = await ammCoder.accounts.encode("pool", pool);
    const decoded = PUMP_SDK.decodePool(accountInfo(data, PUMP_AMM_PROGRAM_ID));
    expect(decoded.virtualQuoteReserves.toString()).toBe("-12345678901234");
    const terms = poolQuoteTerms(decoded);
    expect(terms.virtualQuoteReserves.isNeg()).toBe(true);
    expect(terms.quoteMint.equals(QUOTE_MINT)).toBe(true);
    expect(terms.isMayhemMode).toBe(true);
    expect(terms.creatorFeeBps.eqn(40)).toBe(true);
  });

  it("reads QuoteControl entries and ignores the pre-allocated tail", async () => {
    const data = await pumpCoder.accounts.encode("quoteControl", {
      admin: USER,
      reservesAdmin: USER,
      reserved: new Array<number>(32).fill(0),
      mints: [{ mint: QUOTE_MINT, initialVirtualQuoteReserves: new BN(5000) }],
    });
    const quoteControl = PUMP_SDK.decodeQuoteControl(
      accountInfo(Buffer.concat([data, Buffer.alloc(400)])),
    );
    expect(quoteControl.mints).toHaveLength(1);
    expect(quoteControl.mints[0]?.mint.equals(QUOTE_MINT)).toBe(true);
    expect(PUMP_SDK.decodeQuoteControlNullable(null)).toBeNull();
    const overclaimed = Buffer.from(data);
    overclaimed.writeUInt32LE(50, 8 + 32 + 32 + 32);
    expect(() => PUMP_SDK.decodeQuoteControl(accountInfo(overclaimed))).toThrow(
      /entries declared/,
    );
  });

  it("decodes the new events, ignoring fields a later deploy appends", () => {
    const post = pumpCoder.types.encode("postCompleteBuyEvent", {
      user: USER,
      mint: MINT,
      bondingCurve: bondingCurvePda(MINT),
      quoteMint: NATIVE_MINT,
      timestamp: new BN(1),
      baseOut: new BN(2),
      quoteIn: new BN(3),
      feeBasisPoints: new BN(4),
      fee: new BN(5),
      creatorFeeBasisPoints: new BN(6),
      creatorFee: new BN(7),
      buybackFee: new BN(8),
      poolBaseReservesBefore: new BN(9),
      poolQuoteReservesBefore: new BN(10),
      poolBaseReservesAfter: new BN(11),
      poolQuoteReservesAfter: new BN(12),
    });
    const decoded = PUMP_SDK.decodePostCompleteBuyEvent(
      Buffer.concat([post, Buffer.alloc(16, 7)]),
    );
    expect(decoded.baseOut.eqn(2)).toBe(true);
    expect(decoded.poolQuoteReservesAfter.eqn(12)).toBe(true);

    const sweep = pumpCoder.types.encode("sweepBondingCurveFeeEvent", {
      timestamp: new BN(1),
      mint: MINT,
      bondingCurve: bondingCurvePda(MINT),
      quoteMint: NATIVE_MINT,
      recipient: USER,
      amount: new BN(99),
      bucket: SweepFeeBucket.Creator,
    });
    const sweepEvent = PUMP_SDK.decodeSweepBondingCurveFeeEvent(sweep);
    expect(sweepEvent.amount.eqn(99)).toBe(true);
    expect(sweepEvent.bucket).toBe(SweepFeeBucket.Creator);
  });

  it("decodes a TradeEvent from before the quote fields existed", () => {
    // Every TradeEvent layout is a prefix of the current one. Dropping the
    // last 80 bytes gives the layout before the quote fields, holder rewards
    // and `creator_fee_unclaimed`.
    const full = pumpCoder.types.encode("tradeEvent", {
      ...zeroedEvent(pumpIdlJson, "TradeEvent"),
      mint: MINT,
      user: USER,
      solAmount: new BN(42),
      quoteAmount: new BN(42),
      creatorFeeUnclaimed: new BN(5),
    });
    const decodedFull = PUMP_SDK.decodeTradeEvent(full);
    expect(decodedFull.quoteAmount.eqn(42)).toBe(true);
    expect(decodedFull.creatorFeeUnclaimed.eqn(5)).toBe(true);
    const older = PUMP_SDK.decodeTradeEvent(full.subarray(0, full.length - 80));
    expect(older.mint.equals(MINT)).toBe(true);
    expect(older.solAmount.eqn(42)).toBe(true);
    expect(older.quoteAmount.isZero()).toBe(true);
    expect(older.creatorFeeUnclaimed.isZero()).toBe(true);
  });
});

describe("program errors", () => {
  it("names the codes the upgrade added on every program", () => {
    expect(getPumpProgramError("pump", 6095)?.name).toBe("CreatorFeesNotSwept");
    expect(getPumpProgramError("pump", 6105)?.name).toBe("CurveDepthExceeded");
    expect(getPumpProgramError(PUMP_AMM_PROGRAM_ID, 6084)?.name).toBe(
      "MultiHopDiscontinuousPath",
    );
    expect(getPumpProgramError("pumpFees", 6033)?.name).toBe(
      "PoolCreatorFeesNotSwept",
    );
  });

  it("returns undefined for framework codes and unknown programs", () => {
    expect(getPumpProgramError("pump", 3012)).toBeUndefined();
    expect(getPumpProgramError(USER, 6000)).toBeUndefined();
  });
});

/** Every field of an IDL struct type at its zero value, camelCased. */
function zeroedEvent(
  idl: { types: { name: string; type: unknown }[] },
  name: string,
): Record<string, unknown> {
  const declared = idl.types.find((type) => type.name === name);
  if (!declared) throw new Error(`IDL has no type ${name}`);
  const { fields } = declared.type as {
    fields: { name: string; type: unknown }[];
  };
  const camel = (value: string) =>
    value.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  const zero = (type: unknown): unknown => {
    if (type === "pubkey") return PublicKey.default;
    if (type === "bool") return false;
    if (type === "string") return "";
    if (typeof type === "string") {
      return /^[ui](8|16|32)$/.test(type) ? 0 : new BN(0);
    }
    const shape = type as {
      array?: [unknown, number];
      vec?: unknown;
      option?: unknown;
    };
    if (shape.array)
      return new Array(shape.array[1]).fill(zero(shape.array[0]));
    if (shape.vec !== undefined) return [];
    if (shape.option !== undefined) return null;
    throw new Error(
      `zeroedEvent: unsupported field type ${JSON.stringify(type)}`,
    );
  };
  return Object.fromEntries(
    fields.map((field) => [camel(field.name), zero(field.type)]),
  );
}
