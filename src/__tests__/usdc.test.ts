import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  AccountInfo,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { USDC_MINT, QUOTE_MINTS, isNativeQuote } from "../quoteMints";
import { getPumpProgram, PUMP_SDK, BONDING_CURVE_NEW_SIZE } from "../sdk";
import { bondingCurvePda, creatorVaultPda } from "../pda";
import pumpIdl from "../idl/pump.json";
import {
  BUYBACK_FEE_RECIPIENTS,
  pickBuybackFeeRecipient,
  BREAKING_FEE_RECIPIENTS,
  getFeeRecipient,
} from "../fees";
import { makeGlobal, makeBondingCurve } from "./fixtures";

describe("quoteMints", () => {
  it("exposes the canonical mainnet USDC mint (6 decimals, SPL Token program)", () => {
    expect(USDC_MINT.toBase58()).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(QUOTE_MINTS.USDC.mint.equals(USDC_MINT)).toBe(true);
    expect(QUOTE_MINTS.USDC.decimals).toBe(6);
    expect(QUOTE_MINTS.USDC.tokenProgram.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(QUOTE_MINTS.USDC.tokenProgram.equals(TOKEN_2022_PROGRAM_ID)).toBe(false);
  });
  it("models wSOL with 9 decimals under the SPL Token program", () => {
    expect(QUOTE_MINTS.wSOL.mint.equals(NATIVE_MINT)).toBe(true);
    expect(QUOTE_MINTS.wSOL.decimals).toBe(9);
    expect(QUOTE_MINTS.wSOL.tokenProgram.equals(TOKEN_PROGRAM_ID)).toBe(true);
  });
  it("isNativeQuote distinguishes wSOL from USDC", () => {
    expect(isNativeQuote(NATIVE_MINT)).toBe(true);
    expect(isNativeQuote(USDC_MINT)).toBe(false);
  });
});

describe("bundled IDL: buy_v2", () => {
  // Assert against the raw bundled IDL JSON: Anchor's Program constructor
  // (v0.31) normalizes instruction/field names to camelCase, so program.idl
  // would expose "buyV2"/"maxSolCost" instead of the on-disk snake_case names.
  // The program is still constructed to prove the bundled IDL loads cleanly.
  const program = getPumpProgram(new Connection("http://localhost:8899"));
  it("includes buy_v2 with the official discriminator and exactly 2 args", () => {
    expect(program.idl.instructions.some((i) => i.name === "buyV2")).toBe(true);
    const ix = (pumpIdl.instructions as any[]).find((i) => i.name === "buy_v2");
    expect(ix).toBeDefined();
    expect(ix.discriminator).toEqual([184, 23, 238, 97, 103, 197, 211, 61]);
    expect(ix.args.map((a: any) => a.name)).toEqual(["amount", "max_sol_cost"]);
    expect(ix.accounts).toHaveLength(27);
  });
});

describe("buyback fee recipients", () => {
  it("are the 8 official buyback recipients (same set as BREAKING_FEE_RECIPIENTS)", () => {
    expect(BUYBACK_FEE_RECIPIENTS.map((p) => p.toBase58())).toEqual(
      BREAKING_FEE_RECIPIENTS.map((p) => p.toBase58()),
    );
    expect(BUYBACK_FEE_RECIPIENTS).toHaveLength(8);
    expect(BUYBACK_FEE_RECIPIENTS[0]!.toBase58()).toBe(
      "5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD",
    );
  });
  it("pickBuybackFeeRecipient returns one of the set", () => {
    for (let i = 0; i < 100; i++) {
      const picked = pickBuybackFeeRecipient();
      expect(BUYBACK_FEE_RECIPIENTS.some((p) => p.equals(picked))).toBe(true);
    }
  });
});

describe("createV2Instruction quote mint", () => {
  const mint = new Keypair().publicKey;
  const creator = new Keypair().publicKey;
  const user = new Keypair().publicKey;
  const baseArgs = { mint, name: "n", symbol: "n", uri: "u", creator, user, mayhemMode: false };

  it("SOL (default): exactly 16 accounts, no remaining accounts appended", async () => {
    const ix = await PUMP_SDK.createV2Instruction(baseArgs);
    expect(ix.keys).toHaveLength(16);
  });
  it("explicit NATIVE_MINT behaves like SOL (16 accounts)", async () => {
    const ix = await PUMP_SDK.createV2Instruction({ ...baseArgs, quoteMint: NATIVE_MINT });
    expect(ix.keys).toHaveLength(16);
  });
  it("USDC: appends exactly the 3 quote remaining accounts in order", async () => {
    const ix = await PUMP_SDK.createV2Instruction({ ...baseArgs, quoteMint: USDC_MINT });
    expect(ix.keys).toHaveLength(19);
    const [r0, r1, r2] = ix.keys.slice(16);
    expect(r0!.pubkey.equals(USDC_MINT)).toBe(true);
    expect(r0!.isWritable).toBe(false);
    expect(r1!.pubkey.equals(getAssociatedTokenAddressSync(USDC_MINT, bondingCurvePda(mint), true, TOKEN_PROGRAM_ID))).toBe(true);
    expect(r1!.isWritable).toBe(true);
    expect(r2!.pubkey.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(r2!.isWritable).toBe(false);
  });
  it("threads an explicit non-default quoteTokenProgram into createV2Instruction", async () => {
    // Stand-in: drive the quote program off USDC's default (TOKEN_PROGRAM_ID) so
    // the threading is observable. R2 (the quote_token_program remaining account)
    // must equal it, and R1 (associated_quote_bonding_curve) must be the ATA
    // derived *with* that program (a different ATA than the default would yield).
    const ix = await PUMP_SDK.createV2Instruction({
      mint, name: "n", symbol: "n", uri: "u", creator, user, mayhemMode: false,
      quoteMint: USDC_MINT, quoteTokenProgram: TOKEN_2022_PROGRAM_ID,
    });
    expect(ix.keys).toHaveLength(19);
    const [, r1, r2] = ix.keys.slice(16);
    expect(r2!.pubkey.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    expect(
      r1!.pubkey.equals(
        getAssociatedTokenAddressSync(USDC_MINT, bondingCurvePda(mint), true, TOKEN_2022_PROGRAM_ID),
      ),
    ).toBe(true);
  });
});

describe("createV2AndBuyInstructions USDC quoteAmount", () => {
  const mint = new Keypair().publicKey;
  const creator = new Keypair().publicKey;
  const user = new Keypair().publicKey;

  it("encodes quoteAmount (not solAmount) as the buy_v2 cap", async () => {
    const quoteAmount = new BN("12345678");
    const ixs = await PUMP_SDK.createV2AndBuyInstructions({
      global: makeGlobal(), mint, name: "n", symbol: "n", uri: "u",
      creator, user, amount: new BN("15000000000000"), mayhemMode: false,
      solAmount: new BN("999"), // deliberately different from quoteAmount
      quoteMint: USDC_MINT, quoteTokenProgram: TOKEN_PROGRAM_ID, quoteAmount,
    });
    const buyLeg = ixs.at(-1)!;
    // buy_v2 data = disc[8] + amount u64 (LE) [8,16) + max_sol_cost u64 (LE) [16,24).
    // max_sol_cost is the quote cap; assert it is the quoteAmount we passed, not solAmount.
    expect(buyLeg.data).toHaveLength(24);
    expect([...buyLeg.data.slice(0, 8)]).toEqual([184, 23, 238, 97, 103, 197, 211, 61]);
    const capLE = buyLeg.data.subarray(16, 24);
    expect(new BN(capLE, "le").toString()).toBe(quoteAmount.toString());
  });
});

describe("createV2AndBuyInstructions tx-size / ALT constraint", () => {
  // OPERATIONAL FINDING: the atomic USDC `create_v2 + buy_v2` instruction set is
  // too large for a single legacy/v0 transaction without an Address Lookup Table —
  // its combined unique account set is larger, and the compiled v0 message
  // serializes to MORE than the 1232-byte packet limit. The SOL path fits without
  // one. Senders launching a USDC coin with a dev-buy MUST attach an ALT.
  //
  // NOTE: compileToV0Message()/serialize() do NOT throw at this size (the RangeError
  // only fires above ~256 account keys), so we assert the measured byte size and the
  // unique-account count directly rather than relying on a throw.
  const PACKET_DATA_SIZE = 1232; // Solana max serialized transaction size.
  const mint = new Keypair().publicKey;
  const creator = new Keypair().publicKey;
  const user = new Keypair().publicKey;
  const common = {
    global: makeGlobal(), mint, name: "n", symbol: "n", uri: "u",
    creator, user, amount: new BN("15000000000000"), mayhemMode: false,
  };

  function uniqueAccounts(ixs: { programId: PublicKey; keys: { pubkey: PublicKey }[] }[]): number {
    const seen = new Set<string>();
    for (const ix of ixs) {
      seen.add(ix.programId.toBase58());
      for (const k of ix.keys) seen.add(k.pubkey.toBase58());
    }
    return seen.size;
  }

  function serializedV0Size(ixs: any[]): number {
    const message = new TransactionMessage({
      payerKey: user,
      recentBlockhash: "11111111111111111111111111111111", // dummy blockhash
      instructions: ixs,
    }).compileToV0Message();
    return new VersionedTransaction(message).serialize().length;
  }

  it("SOL fits in one legacy tx but USDC needs an Address Lookup Table", async () => {
    const solIxs = await PUMP_SDK.createV2AndBuyInstructions({ ...common, solAmount: new BN("430000000") });
    const usdcIxs = await PUMP_SDK.createV2AndBuyInstructions({
      ...common, solAmount: new BN(0),
      quoteMint: USDC_MINT, quoteTokenProgram: TOKEN_PROGRAM_ID, quoteAmount: new BN("15000000"),
    });

    const solUnique = uniqueAccounts(solIxs);
    const usdcUnique = uniqueAccounts(usdcIxs);
    // Measured (deterministic given fixed keypairs): SOL=24, USDC=32 unique accounts.
    expect(usdcUnique).toBeGreaterThan(solUnique);
    expect(usdcUnique).toBeGreaterThanOrEqual(32);

    const solSize = serializedV0Size(solIxs);
    const usdcSize = serializedV0Size(usdcIxs);
    // Measured (deterministic): SOL=1084 bytes (fits), USDC=1361 bytes (exceeds 1232).
    expect(solSize).toBeLessThanOrEqual(PACKET_DATA_SIZE);
    expect(usdcSize).toBeGreaterThan(PACKET_DATA_SIZE);
  });
});

describe("buyV2 builder (USDC)", () => {
  const mint = new Keypair().publicKey;
  const creator = new Keypair().publicKey;
  const user = new Keypair().publicKey;

  it("builds buy_v2 with 27 accounts, 2-arg data, USDC quote wiring", async () => {
    const ix = await PUMP_SDK.buyV2({
      user, mint, creator,
      amount: new BN("15000000000000"),
      quoteAmount: new BN("15000000"),
      quoteMint: USDC_MINT,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
      feeRecipient: getFeeRecipient(makeGlobal(), false),
      buybackFeeRecipient: pickBuybackFeeRecipient(),
    });
    expect(ix.keys).toHaveLength(27);
    expect(ix.keys[2]!.pubkey.equals(USDC_MINT)).toBe(true);
    expect(ix.keys[3]!.pubkey.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    expect(ix.keys[4]!.pubkey.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(ix.keys[13]!.isSigner).toBe(true);
    expect(ix.keys[12]!.pubkey.equals(getAssociatedTokenAddressSync(USDC_MINT, bondingCurvePda(mint), true, TOKEN_PROGRAM_ID))).toBe(true);
    expect(ix.keys[16]!.pubkey.equals(creatorVaultPda(creator))).toBe(true);
    expect(ix.data).toHaveLength(24);
    expect([...ix.data.slice(0, 8)]).toEqual([184, 23, 238, 97, 103, 197, 211, 61]);
  });
});

describe("getBuyInstructionRaw routing", () => {
  const mint = new Keypair().publicKey;
  const creator = new Keypair().publicKey;
  const user = new Keypair().publicKey;

  it("SOL (default): emits legacy buy (disc 0x66063d12), unchanged", async () => {
    const ix = await PUMP_SDK.getBuyInstructionRaw({
      user, mint, creator, amount: new BN(1), solAmount: new BN(1),
      feeRecipient: getFeeRecipient(makeGlobal(), false),
    });
    expect([...ix.data.slice(0, 8)]).toEqual([102, 6, 61, 18, 1, 218, 235, 234]);
    expect(ix.keys.at(-1)!.isWritable).toBe(true); // breaking fee recipient appended last
  });
  it("USDC: routes to buy_v2 (disc 0xb817ee…)", async () => {
    const ix = await PUMP_SDK.getBuyInstructionRaw({
      user, mint, creator, amount: new BN("15000000000000"), solAmount: new BN("15000000"),
      feeRecipient: getFeeRecipient(makeGlobal(), false),
      quoteMint: USDC_MINT, quoteTokenProgram: TOKEN_PROGRAM_ID,
    });
    expect([...ix.data.slice(0, 8)]).toEqual([184, 23, 238, 97, 103, 197, 211, 61]);
    expect(ix.keys).toHaveLength(27);
  });
});

describe("buyInstructions routing (USDC)", () => {
  const mint = new Keypair().publicKey;
  const creator = new Keypair().publicKey;
  const user = new Keypair().publicKey;

  // A "new" bonding curve account (data >= BONDING_CURVE_NEW_SIZE) so the legacy
  // path would not prepend extendAccount — though the USDC branch returns before
  // that check anyway. Shape mirrors makeBcAccountInfo in onlineSdk.test.ts.
  function makeBcAccountInfo(): AccountInfo<Buffer> {
    return {
      data: Buffer.alloc(BONDING_CURVE_NEW_SIZE),
      executable: false,
      lamports: 1_000_000,
      owner: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
      rentEpoch: 0,
    };
  }

  it("prepends user base + quote ATA creates and ends with buy_v2", async () => {
    const ixs = await PUMP_SDK.buyInstructions({
      global: makeGlobal(),
      bondingCurveAccountInfo: makeBcAccountInfo(),
      bondingCurve: makeBondingCurve({ creator, isMayhemMode: false }),
      associatedUserAccountInfo: null,
      mint,
      user,
      amount: new BN("15000000000000"),
      solAmount: new BN("15000000"),
      slippage: 1,
      tokenProgram: TOKEN_PROGRAM_ID,
      quoteMint: USDC_MINT,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
    });

    // Last instruction is buy_v2 (27 accounts, official discriminator).
    const last = ixs.at(-1)!;
    expect([...last.data.slice(0, 8)]).toEqual([184, 23, 238, 97, 103, 197, 211, 61]);
    expect(last.keys).toHaveLength(27);

    // At least 2 ATA-program create instructions precede it: the user's base
    // Token-2022 ATA and the user's USDC quote ATA. Without these, a standalone
    // USDC buy for a fresh wallet would fail.
    const ataCreates = ixs.filter((ix) =>
      ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID),
    );
    expect(ataCreates.length).toBeGreaterThanOrEqual(2);

    // The base ATA create targets the user's Token-2022 ATA for the base mint.
    const baseAta = getAssociatedTokenAddressSync(mint, user, true, TOKEN_2022_PROGRAM_ID);
    expect(
      ataCreates.some((ix) => ix.keys.some((k) => k.pubkey.equals(baseAta))),
    ).toBe(true);

    // The quote ATA create targets the user's USDC (SPL Token) ATA.
    const quoteAta = getAssociatedTokenAddressSync(USDC_MINT, user, true, TOKEN_PROGRAM_ID);
    expect(
      ataCreates.some((ix) => ix.keys.some((k) => k.pubkey.equals(quoteAta))),
    ).toBe(true);
  });

  it("still creates the quote ATA when the base ATA already exists", async () => {
    const ixs = await PUMP_SDK.buyInstructions({
      global: makeGlobal(),
      bondingCurveAccountInfo: makeBcAccountInfo(),
      bondingCurve: makeBondingCurve({ creator, isMayhemMode: false }),
      // base ATA present -> skip base create, but quote create must remain.
      associatedUserAccountInfo: makeBcAccountInfo(),
      mint,
      user,
      amount: new BN("15000000000000"),
      solAmount: new BN("15000000"),
      slippage: 1,
      tokenProgram: TOKEN_PROGRAM_ID,
      quoteMint: USDC_MINT,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
    });

    const last = ixs.at(-1)!;
    expect([...last.data.slice(0, 8)]).toEqual([184, 23, 238, 97, 103, 197, 211, 61]);

    const quoteAta = getAssociatedTokenAddressSync(USDC_MINT, user, true, TOKEN_PROGRAM_ID);
    const ataCreates = ixs.filter((ix) =>
      ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID),
    );
    expect(ataCreates.length).toBeGreaterThanOrEqual(1);
    expect(
      ataCreates.some((ix) => ix.keys.some((k) => k.pubkey.equals(quoteAta))),
    ).toBe(true);
  });
});

describe("createV2AndBuyInstructions", () => {
  const mint = new Keypair().publicKey;
  const creator = new Keypair().publicKey;
  const user = new Keypair().publicKey;
  const common = {
    global: makeGlobal(), mint, name: "n", symbol: "n", uri: "u",
    creator, user, amount: new BN("15000000000000"), mayhemMode: false,
  };
  it("SOL: 4 instructions, create_v2 has 16 keys, buy leg is legacy buy", async () => {
    const ixs = await PUMP_SDK.createV2AndBuyInstructions({ ...common, solAmount: new BN("430000000") });
    expect(ixs).toHaveLength(4);
    expect(ixs[0]!.keys).toHaveLength(16);
    expect([...ixs[3]!.data.slice(0, 8)]).toEqual([102, 6, 61, 18, 1, 218, 235, 234]);
  });
  it("USDC: create_v2 has 19 keys; user USDC ATA created; buy leg is buy_v2 capped by quoteAmount", async () => {
    const ixs = await PUMP_SDK.createV2AndBuyInstructions({
      ...common, solAmount: new BN(0),
      quoteMint: USDC_MINT, quoteTokenProgram: TOKEN_PROGRAM_ID, quoteAmount: new BN("15000000"),
    });
    expect(ixs[0]!.keys).toHaveLength(19);
    const buyLeg = ixs.at(-1)!;
    expect([...buyLeg.data.slice(0, 8)]).toEqual([184, 23, 238, 97, 103, 197, 211, 61]);
    expect(buyLeg.keys).toHaveLength(27);
    // the user's USDC ATA is created (associated-token-program ix targeting the user's USDC ATA)
    const userUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, user, true, TOKEN_PROGRAM_ID);
    expect(ixs.some((ix) => ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) && ix.keys.some((k) => k.pubkey.equals(userUsdcAta)))).toBe(true);
  });
});
