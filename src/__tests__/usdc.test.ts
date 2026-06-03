import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair } from "@solana/web3.js";
import { USDC_MINT, QUOTE_MINTS, isNativeQuote } from "../quoteMints";
import { getPumpProgram, PUMP_SDK } from "../sdk";
import { bondingCurvePda } from "../pda";
import pumpIdl from "../idl/pump.json";
import {
  BUYBACK_FEE_RECIPIENTS,
  pickBuybackFeeRecipient,
  BREAKING_FEE_RECIPIENTS,
} from "../fees";

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
});
