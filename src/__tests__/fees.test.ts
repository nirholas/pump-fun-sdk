import { NATIVE_MINT, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import {
  BREAKING_FEE_RECIPIENT_WSOL_ATAS,
  BREAKING_FEE_RECIPIENTS,
  buildAmmBreakingFeeRecipientAccounts,
  calculateFeeTier,
  computeFeesBps,
  getFee,
  isBreakingFeeRecipient,
  ONE_BILLION_SUPPLY,
  patchAmmInstruction,
  patchBcInstruction,
  pickBreakingFeeRecipient,
  validateAmmInstruction,
  validateBcInstruction,
} from "../fees";

import {
  makeGlobal,
  makeBondingCurve,
  makeFeeConfig,
  makeBondingCurveWithCreator,
} from "./fixtures";

const global = makeGlobal();
const mintSupply = global.tokenTotalSupply;
const bc = makeBondingCurve();

describe("fees", () => {
  // ── computeFeesBps ─────────────────────────────────────────────────

  describe("computeFeesBps", () => {
    it("uses global defaults when feeConfig is null", () => {
      const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
        global,
        feeConfig: null,
        mintSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      expect(protocolFeeBps.eq(global.feeBasisPoints)).toBe(true);
      expect(creatorFeeBps.eq(global.creatorFeeBasisPoints)).toBe(true);
    });

    it("uses tiered fees from feeConfig when provided", () => {
      const feeConfig = makeFeeConfig();
      const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
        global,
        feeConfig,
        mintSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      // At initial state the market cap is ~28 SOL, which is below 100 SOL tier
      // so the first tier (200 bps protocol, 100 bps creator) applies
      expect(protocolFeeBps.eq(new BN(200))).toBe(true);
      expect(creatorFeeBps.eq(new BN(100))).toBe(true);
    });
  });

  // ── calculateFeeTier ───────────────────────────────────────────────

  describe("calculateFeeTier", () => {
    const feeConfig = makeFeeConfig();

    it("throws for empty feeTiers", () => {
      expect(() =>
        calculateFeeTier({ feeTiers: [], marketCap: new BN(0) }),
      ).toThrow("feeTiers must not be empty");
    });

    it("selects lowest tier for small market cap", () => {
      const result = calculateFeeTier({
        feeTiers: feeConfig.feeTiers,
        marketCap: new BN(50_000_000_000), // 50 SOL
      });
      expect(result.protocolFeeBps.eq(new BN(200))).toBe(true);
    });

    it("selects mid tier when threshold met", () => {
      const result = calculateFeeTier({
        feeTiers: feeConfig.feeTiers,
        marketCap: new BN("100000000000"), // exactly 100 SOL
      });
      expect(result.protocolFeeBps.eq(new BN(100))).toBe(true);
    });

    it("selects highest tier for large market cap", () => {
      const result = calculateFeeTier({
        feeTiers: feeConfig.feeTiers,
        marketCap: new BN("5000000000000"), // 5000 SOL
      });
      expect(result.protocolFeeBps.eq(new BN(50))).toBe(true);
    });

    it("returns first tier fees when below first threshold", () => {
      const tiers = [
        {
          marketCapLamportsThreshold: new BN("1000000000000"),
          fees: {
            lpFeeBps: new BN(0),
            protocolFeeBps: new BN(100),
            creatorFeeBps: new BN(50),
          },
        },
      ];
      // Market cap below the only tier threshold
      const result = calculateFeeTier({
        feeTiers: tiers,
        marketCap: new BN(0),
      });
      expect(result.protocolFeeBps.eq(new BN(100))).toBe(true);
    });
  });

  // ── getFee ─────────────────────────────────────────────────────────

  describe("getFee", () => {
    it("calculates fee for a trade amount (no creator)", () => {
      const amount = new BN("1000000000"); // 1 SOL
      const result = getFee({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount,
        isNewBondingCurve: false,
      });
      // Only protocol fee (1%), creator is default pubkey so no creator fee
      // ceil(1_000_000_000 * 100 / 10_000) = 10_000_000
      expect(result.eq(new BN(10_000_000))).toBe(true);
    });

    it("includes creator fee when creator is set", () => {
      const amount = new BN("1000000000");
      const bcWithCreator = makeBondingCurveWithCreator();
      const result = getFee({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bcWithCreator,
        amount,
        isNewBondingCurve: false,
      });
      // Protocol (1%) + Creator (0.5%) = 1.5%
      // ceil(1B * 100 / 10000) + ceil(1B * 50 / 10000) = 10M + 5M = 15M
      expect(result.eq(new BN(15_000_000))).toBe(true);
    });

    it("includes creator fee for new bonding curves", () => {
      const amount = new BN("1000000000");
      const result = getFee({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount,
        isNewBondingCurve: true,
      });
      // New bonding curve always includes creator fee
      expect(result.eq(new BN(15_000_000))).toBe(true);
    });
  });

  // ── ONE_BILLION_SUPPLY ─────────────────────────────────────────────

  describe("ONE_BILLION_SUPPLY", () => {
    it("equals 1e15 (1B tokens with 6 decimals)", () => {
      expect(ONE_BILLION_SUPPLY.eq(new BN("1000000000000000"))).toBe(true);
    });
  });

  // ── 2026-04-28 breaking fee recipient constants ────────────────────

  describe("BREAKING_FEE_RECIPIENTS", () => {
    it("has exactly 8 unique pubkeys", () => {
      expect(BREAKING_FEE_RECIPIENTS).toHaveLength(8);
      expect(new Set(BREAKING_FEE_RECIPIENTS.map((k) => k.toBase58())).size).toBe(8);
    });

    it("BREAKING_FEE_RECIPIENT_WSOL_ATAS matches getAssociatedTokenAddressSync for each", () => {
      expect(BREAKING_FEE_RECIPIENT_WSOL_ATAS.size).toBe(8);
      for (const r of BREAKING_FEE_RECIPIENTS) {
        const expected = getAssociatedTokenAddressSync(NATIVE_MINT, r, true, TOKEN_PROGRAM_ID);
        expect(BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(r.toBase58())?.equals(expected)).toBe(true);
      }
    });

    it("isBreakingFeeRecipient accepts all 8 and rejects arbitrary keys", () => {
      for (const r of BREAKING_FEE_RECIPIENTS) {
        expect(isBreakingFeeRecipient(r)).toBe(true);
      }
      expect(isBreakingFeeRecipient(Keypair.generate().publicKey)).toBe(false);
      expect(isBreakingFeeRecipient(PublicKey.default)).toBe(false);
    });

    it("pickBreakingFeeRecipient always returns a known recipient", () => {
      for (let i = 0; i < 30; i++) {
        expect(isBreakingFeeRecipient(pickBreakingFeeRecipient())).toBe(true);
      }
    });

    it("buildAmmBreakingFeeRecipientAccounts returns [readonly recipient, mutable ATA from map]", () => {
      const r = BREAKING_FEE_RECIPIENTS[0]!;
      const [rec, ata] = buildAmmBreakingFeeRecipientAccounts(r);
      expect(rec!.pubkey.equals(r)).toBe(true);
      expect(rec!.isWritable).toBe(false);
      expect(ata!.pubkey.equals(BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(r.toBase58())!)).toBe(true);
      expect(ata!.isWritable).toBe(true);
    });
  });

  // ── validateBcInstruction ──────────────────────────────────────────

  describe("validateBcInstruction", () => {
    const programId = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
    const data = Buffer.alloc(0);
    const fake = (w = false) => ({ pubkey: Keypair.generate().publicKey, isWritable: w, isSigner: false });
    const goodTail = () => ({ pubkey: BREAKING_FEE_RECIPIENTS[0]!, isWritable: true, isSigner: false });

    it("valid buy (18 accounts)", () => {
      const ix = new TransactionInstruction({ keys: [...Array(17).fill(null).map(() => fake()), goodTail()], programId, data });
      const r = validateBcInstruction(ix, "buy");
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it("invalid buy — wrong count", () => {
      const ix = new TransactionInstruction({ keys: [...Array(16).fill(null).map(() => fake()), goodTail()], programId, data });
      const r = validateBcInstruction(ix, "buy");
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("expected 18"))).toBe(true);
    });

    it("invalid buy — tail not a breaking fee recipient", () => {
      const ix = new TransactionInstruction({ keys: [...Array(17).fill(null).map(() => fake()), fake(true)], programId, data });
      const r = validateBcInstruction(ix, "buy");
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("not a breaking fee recipient"))).toBe(true);
    });

    it("invalid buy — tail is readonly", () => {
      const ix = new TransactionInstruction({ keys: [...Array(17).fill(null).map(() => fake()), { pubkey: BREAKING_FEE_RECIPIENTS[0]!, isWritable: false, isSigner: false }], programId, data });
      const r = validateBcInstruction(ix, "buy");
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.includes("must be mutable"))).toBe(true);
    });

    it("valid sell (16)", () => {
      const ix = new TransactionInstruction({ keys: [...Array(15).fill(null).map(() => fake()), goodTail()], programId, data });
      expect(validateBcInstruction(ix, "sell").valid).toBe(true);
    });

    it("valid sell-cashback (17)", () => {
      const ix = new TransactionInstruction({ keys: [...Array(16).fill(null).map(() => fake()), goodTail()], programId, data });
      expect(validateBcInstruction(ix, "sell-cashback").valid).toBe(true);
    });
  });

  // ── validateAmmInstruction ─────────────────────────────────────────

  describe("validateAmmInstruction", () => {
    const programId = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
    const data = Buffer.alloc(0);
    const fake = () => ({ pubkey: Keypair.generate().publicKey, isWritable: false, isSigner: false });
    const goodPair = () => {
      const r = BREAKING_FEE_RECIPIENTS[0]!;
      return [
        { pubkey: r, isWritable: false, isSigner: false },
        { pubkey: BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(r.toBase58())!, isWritable: true, isSigner: false },
      ];
    };

    it.each([
      ["buy", 24, 26] as const,
      ["buy-cashback", 25, 27] as const,
      ["sell", 22, 24] as const,
      ["sell-cashback", 24, 26] as const,
    ])("valid AMM %s (%i base + 2 trailing = %i total)", (kind, base, expected) => {
      const ix = new TransactionInstruction({ keys: [...Array(base).fill(null).map(() => fake()), ...goodPair()], programId, data });
      const r = validateAmmInstruction(ix, kind);
      expect(r.valid).toBe(true);
      expect(ix.keys).toHaveLength(expected);
    });

    it("invalid — wrong ATA for recipient", () => {
      const r = BREAKING_FEE_RECIPIENTS[0]!;
      const keys = [
        ...Array(24).fill(null).map(() => fake()),
        { pubkey: r, isWritable: false, isSigner: false },
        { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
      ];
      const ix = new TransactionInstruction({ keys, programId, data });
      const result = validateAmmInstruction(ix, "buy");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("does not match expected ATA"))).toBe(true);
    });
  });

  // ── patchBcInstruction ─────────────────────────────────────────────

  describe("patchBcInstruction", () => {
    const programId = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
    const data = Buffer.from([1, 2, 3]);
    const fake = () => ({ pubkey: Keypair.generate().publicKey, isWritable: false, isSigner: false });

    it("appends a mutable breaking fee recipient to pre-upgrade instruction", () => {
      const ix = new TransactionInstruction({ keys: Array(15).fill(null).map(() => fake()), programId, data });
      const patched = patchBcInstruction(ix);
      expect(patched.keys).toHaveLength(16);
      expect(isBreakingFeeRecipient(patched.keys[15]!.pubkey)).toBe(true);
      expect(patched.keys[15]!.isWritable).toBe(true);
    });

    it("is idempotent — returns the same object if already patched", () => {
      const ix = new TransactionInstruction({
        keys: [...Array(15).fill(null).map(() => fake()), { pubkey: BREAKING_FEE_RECIPIENTS[0]!, isWritable: true, isSigner: false }],
        programId, data,
      });
      expect(patchBcInstruction(ix)).toBe(ix);
    });

    it("preserves programId and data buffer", () => {
      const ix = new TransactionInstruction({ keys: [fake()], programId, data });
      const patched = patchBcInstruction(ix);
      expect(patched.programId.equals(programId)).toBe(true);
      expect(patched.data).toEqual(data);
    });
  });

  // ── patchAmmInstruction ────────────────────────────────────────────

  describe("patchAmmInstruction", () => {
    const programId = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
    const data = Buffer.from([7, 8, 9]);
    const fake = () => ({ pubkey: Keypair.generate().publicKey, isWritable: false, isSigner: false });

    it("appends readonly recipient + mutable WSOL ATA", () => {
      const ix = new TransactionInstruction({ keys: Array(22).fill(null).map(() => fake()), programId, data });
      const patched = patchAmmInstruction(ix);
      expect(patched.keys).toHaveLength(24);
      const rec = patched.keys[22]!;
      const ata = patched.keys[23]!;
      expect(isBreakingFeeRecipient(rec.pubkey)).toBe(true);
      expect(rec.isWritable).toBe(false);
      expect(ata.isWritable).toBe(true);
      expect(ata.pubkey.equals(BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(rec.pubkey.toBase58())!)).toBe(true);
    });

    it("is idempotent — returns the same object if already patched", () => {
      const r = BREAKING_FEE_RECIPIENTS[0]!;
      const ix = new TransactionInstruction({
        keys: [
          ...Array(22).fill(null).map(() => fake()),
          { pubkey: r, isWritable: false, isSigner: false },
          { pubkey: BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(r.toBase58())!, isWritable: true, isSigner: false },
        ],
        programId, data,
      });
      expect(patchAmmInstruction(ix)).toBe(ix);
    });
  });
});
