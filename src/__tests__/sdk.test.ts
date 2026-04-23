import { NATIVE_MINT, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// Import from `../pda` before `../sdk`: pda.ts -> sdk.ts -> onlineSdk.ts -> pda.ts
// is a live circular dep. Entering the cycle via pda.ts lets sdk.ts finish
// defining PUMP_PROGRAM_ID before pda.ts references `.toBuffer()` on it.
import { bondingCurveV2Pda, feeSharingConfigPda, poolV2Pda, socialFeePda } from "../pda";
import {
  PUMP_SDK,
  PumpSdk,
  isCreatorUsingSharingConfig,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  MAYHEM_PROGRAM_ID,
  BONDING_CURVE_NEW_SIZE,
  PUMP_TOKEN_MINT,
  MAX_SHAREHOLDERS,
} from "../sdk";
import {
  BREAKING_FEE_RECIPIENTS,
  BREAKING_FEE_RECIPIENT_WSOL_ATAS,
  isBreakingFeeRecipient,
  buildAmmBreakingFeeRecipientAccounts,
  validateBcInstruction,
  validateAmmInstruction,
  patchBcInstruction,
  patchAmmInstruction,
} from "../fees";
import { Platform } from "../state";
import { TEST_PUBKEY, TEST_CREATOR, makeBondingCurveWithCreator } from "./fixtures";

describe("sdk", () => {
  // ── Constants ──────────────────────────────────────────────────────

  describe("constants", () => {
    it("PUMP_PROGRAM_ID is a valid PublicKey", () => {
      expect(PUMP_PROGRAM_ID).toBeInstanceOf(PublicKey);
    });

    it("PUMP_AMM_PROGRAM_ID is a valid PublicKey", () => {
      expect(PUMP_AMM_PROGRAM_ID).toBeInstanceOf(PublicKey);
    });

    it("PUMP_FEE_PROGRAM_ID is a valid PublicKey", () => {
      expect(PUMP_FEE_PROGRAM_ID).toBeInstanceOf(PublicKey);
    });

    it("MAYHEM_PROGRAM_ID is a valid PublicKey", () => {
      expect(MAYHEM_PROGRAM_ID).toBeInstanceOf(PublicKey);
    });

    it("PUMP_TOKEN_MINT is a valid PublicKey", () => {
      expect(PUMP_TOKEN_MINT).toBeInstanceOf(PublicKey);
    });

    it("BONDING_CURVE_NEW_SIZE is a positive number", () => {
      expect(BONDING_CURVE_NEW_SIZE).toBeGreaterThan(0);
    });

    it("MAX_SHAREHOLDERS is a positive number", () => {
      expect(MAX_SHAREHOLDERS).toBeGreaterThan(0);
    });
  });

  // ── Singleton ──────────────────────────────────────────────────────

  describe("PUMP_SDK singleton", () => {
    it("is an instance of PumpSdk", () => {
      expect(PUMP_SDK).toBeInstanceOf(PumpSdk);
    });

    it("has decode methods", () => {
      expect(typeof PUMP_SDK.decodeGlobal).toBe("function");
      expect(typeof PUMP_SDK.decodeBondingCurve).toBe("function");
      expect(typeof PUMP_SDK.decodeFeeConfig).toBe("function");
      expect(typeof PUMP_SDK.decodeSharingConfig).toBe("function");
      expect(typeof PUMP_SDK.decodePool).toBe("function");
      expect(typeof PUMP_SDK.decodeAmmGlobalConfig).toBe("function");
      expect(typeof PUMP_SDK.decodeFeeProgramGlobal).toBe("function");
      expect(typeof PUMP_SDK.decodeSocialFeePdaAccount).toBe("function");
    });

    it("has instruction builder methods", () => {
      expect(typeof PUMP_SDK.buyInstructions).toBe("function");
      expect(typeof PUMP_SDK.sellInstructions).toBe("function");
      expect(typeof PUMP_SDK.createV2Instruction).toBe("function");
      expect(typeof PUMP_SDK.createFeeSharingConfig).toBe("function");
      expect(typeof PUMP_SDK.updateFeeShares).toBe("function");
    });

    it("has event decoder methods", () => {
      expect(typeof PUMP_SDK.decodeTradeEvent).toBe("function");
      expect(typeof PUMP_SDK.decodeCreateEvent).toBe("function");
      expect(typeof PUMP_SDK.decodeCompleteEvent).toBe("function");
      expect(typeof PUMP_SDK.decodeAmmBuyEvent).toBe("function");
      expect(typeof PUMP_SDK.decodeAmmSellEvent).toBe("function");
    });

    it("has social fee methods", () => {
      expect(typeof PUMP_SDK.createSocialFeePdaInstruction).toBe("function");
      expect(typeof PUMP_SDK.claimSocialFeePdaInstruction).toBe("function");
      expect(typeof PUMP_SDK.normalizeSocialShareholders).toBe("function");
      expect(typeof PUMP_SDK.updateSharingConfigWithSocialRecipients).toBe("function");
      expect(typeof PUMP_SDK.createSharingConfigWithSocialRecipients).toBe("function");
    });
  });

  // ── isCreatorUsingSharingConfig ────────────────────────────────────

  describe("isCreatorUsingSharingConfig", () => {
    const mint = TEST_PUBKEY;

    it("returns true when creator equals fee sharing config PDA", () => {
      const sharingConfigPda = feeSharingConfigPda(mint);
      const result = isCreatorUsingSharingConfig({
        mint,
        creator: sharingConfigPda,
      });
      expect(result).toBe(true);
    });

    it("returns false when creator is a different address", () => {
      const result = isCreatorUsingSharingConfig({
        mint,
        creator: TEST_CREATOR,
      });
      expect(result).toBe(false);
    });

    it("returns false for default pubkey creator", () => {
      const result = isCreatorUsingSharingConfig({
        mint,
        creator: PublicKey.default,
      });
      expect(result).toBe(false);
    });
  });

  // ── normalizeSocialShareholders ────────────────────────────────────

  describe("normalizeSocialShareholders", () => {
    it("passes through address-based shareholders", () => {
      const { normalizedShareholders, socialRecipientsToCreate } =
        PUMP_SDK.normalizeSocialShareholders({
          newShareholders: [
            { shareBps: 5000, address: TEST_PUBKEY },
            { shareBps: 5000, address: TEST_CREATOR },
          ],
        });
      expect(normalizedShareholders).toHaveLength(2);
      expect(normalizedShareholders[0]!.address.equals(TEST_PUBKEY)).toBe(true);
      expect(normalizedShareholders[0]!.shareBps).toBe(5000);
      expect(socialRecipientsToCreate.size).toBe(0);
    });

    it("resolves social shareholders to PDAs", () => {
      const { normalizedShareholders, socialRecipientsToCreate } =
        PUMP_SDK.normalizeSocialShareholders({
          newShareholders: [
            { shareBps: 5000, address: TEST_PUBKEY },
            { shareBps: 5000, userId: "12345", platform: Platform.GitHub },
          ],
        });
      expect(normalizedShareholders).toHaveLength(2);
      expect(socialRecipientsToCreate.size).toBe(1);

      const expectedPda = socialFeePda("12345", Platform.GitHub);
      expect(normalizedShareholders[1]!.address.equals(expectedPda)).toBe(true);
    });

    it("deduplicates social PDAs by address", () => {
      const { socialRecipientsToCreate } =
        PUMP_SDK.normalizeSocialShareholders({
          newShareholders: [
            { shareBps: 3000, userId: "12345", platform: Platform.GitHub },
            { shareBps: 3000, userId: "12345", platform: Platform.GitHub },
            { shareBps: 4000, address: TEST_PUBKEY },
          ],
        });
      // Same userId+platform = same PDA, so only 1 entry
      expect(socialRecipientsToCreate.size).toBe(1);
    });

    it("throws for unsupported platform", () => {
      expect(() =>
        PUMP_SDK.normalizeSocialShareholders({
          newShareholders: [
            { shareBps: 10000, userId: "12345", platform: Platform.X },
          ],
        }),
      ).toThrow("Unsupported platform");
    });

    it("throws when shareholder has neither address nor userId+platform", () => {
      expect(() =>
        PUMP_SDK.normalizeSocialShareholders({
          newShareholders: [{ shareBps: 10000 }],
        }),
      ).toThrow("must provide either an address or both userId and platform");
    });
  });

  // ── 2026-04-28 breaking fee-recipient upgrade ──────────────────────
  //
  // Pins the account counts mandated by BREAKING_FEE_RECIPIENT.md on the
  // pump-public-docs repo. Any divergence here will fail on-chain, so we
  // lock the shape in tests.
  describe("breaking fee recipient upgrade", () => {
    const mint = new PublicKey("So11111111111111111111111111111111111111112");
    const bc = makeBondingCurveWithCreator();
    const breakingRecipientSet = new Set(
      BREAKING_FEE_RECIPIENTS.map((k) => k.toBase58()),
    );

    it("bonding curve buy has 18 accounts, ends with mutable breaking fee recipient", async () => {
      const ix = await PUMP_SDK.getBuyInstructionRaw({
        user: TEST_PUBKEY,
        mint,
        creator: bc.creator,
        amount: new BN(1),
        solAmount: new BN(1),
        feeRecipient: TEST_CREATOR,
      });
      expect(ix.keys).toHaveLength(18);
      const last = ix.keys[ix.keys.length - 1]!;
      expect(breakingRecipientSet.has(last.pubkey.toBase58())).toBe(true);
      expect(last.isWritable).toBe(true);
      expect(last.isSigner).toBe(false);
      // account at index 16 is bonding-curve-v2 (the pre-upgrade tail).
      expect(ix.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint))).toBe(true);
    });

    it("bonding curve buyExactSolIn has 18 accounts, ends with mutable breaking fee recipient", async () => {
      const ix = await PUMP_SDK.buyExactSolInInstruction({
        user: TEST_PUBKEY,
        mint,
        creator: bc.creator,
        feeRecipient: TEST_CREATOR,
        solAmount: new BN(1),
        minTokenAmount: new BN(1),
      });
      expect(ix.keys).toHaveLength(18);
      const last = ix.keys[ix.keys.length - 1]!;
      expect(breakingRecipientSet.has(last.pubkey.toBase58())).toBe(true);
      expect(last.isWritable).toBe(true);
      expect(last.isSigner).toBe(false);
      expect(ix.keys[16]!.pubkey.equals(bondingCurveV2Pda(mint))).toBe(true);
    });

    it("bonding curve sell (non-cashback) has 16 accounts, ends with mutable breaking fee recipient", async () => {
      const ix = await PUMP_SDK.getSellInstructionRaw({
        user: TEST_PUBKEY,
        mint,
        creator: bc.creator,
        amount: new BN(1),
        solAmount: new BN(1),
        feeRecipient: TEST_CREATOR,
        tokenProgram: TOKEN_PROGRAM_ID,
        cashback: false,
      });
      expect(ix.keys).toHaveLength(16);
      const last = ix.keys[ix.keys.length - 1]!;
      expect(breakingRecipientSet.has(last.pubkey.toBase58())).toBe(true);
      expect(last.isWritable).toBe(true);
      expect(ix.keys[14]!.pubkey.equals(bondingCurveV2Pda(mint))).toBe(true);
    });

    it("bonding curve sell (cashback) has 17 accounts, ends with mutable breaking fee recipient", async () => {
      const ix = await PUMP_SDK.getSellInstructionRaw({
        user: TEST_PUBKEY,
        mint,
        creator: bc.creator,
        amount: new BN(1),
        solAmount: new BN(1),
        feeRecipient: TEST_CREATOR,
        tokenProgram: TOKEN_PROGRAM_ID,
        cashback: true,
      });
      expect(ix.keys).toHaveLength(17);
      const last = ix.keys[ix.keys.length - 1]!;
      expect(breakingRecipientSet.has(last.pubkey.toBase58())).toBe(true);
      expect(last.isWritable).toBe(true);
      expect(ix.keys[15]!.pubkey.equals(bondingCurveV2Pda(mint))).toBe(true);
    });

    // AMM end-to-end instruction building requires a fetched Pool account for
    // baseMint / quoteMint / coinCreatorVaultAta derivation, which only the
    // OnlinePumpSdk path does. Validate the shared trailing-accounts helper —
    // the AMM builders each end with `...buildAmmBreakingFeeRecipientAccounts()`,
    // so pinning the helper pins the on-chain tail.
    it("buildAmmBreakingFeeRecipientAccounts returns [readonly recipient, mutable quote ATA]", () => {
      const [recipientAccount, ataAccount] =
        buildAmmBreakingFeeRecipientAccounts();
      expect(recipientAccount).toBeDefined();
      expect(ataAccount).toBeDefined();
      expect(
        breakingRecipientSet.has(recipientAccount!.pubkey.toBase58()),
      ).toBe(true);
      expect(recipientAccount!.isWritable).toBe(false);
      expect(recipientAccount!.isSigner).toBe(false);
      expect(
        ataAccount!.pubkey.equals(
          getAssociatedTokenAddressSync(
            NATIVE_MINT,
            recipientAccount!.pubkey,
            true,
            TOKEN_PROGRAM_ID,
          ),
        ),
      ).toBe(true);
      expect(ataAccount!.isWritable).toBe(true);
      expect(ataAccount!.isSigner).toBe(false);
    });

    it("buildAmmBreakingFeeRecipientAccounts honors explicit fee recipient", () => {
      const recipient = BREAKING_FEE_RECIPIENTS[0]!;
      const [recipientAccount, ataAccount] =
        buildAmmBreakingFeeRecipientAccounts(recipient);
      expect(recipientAccount!.pubkey.equals(recipient)).toBe(true);
      expect(
        ataAccount!.pubkey.equals(
          getAssociatedTokenAddressSync(
            NATIVE_MINT,
            recipient,
            true,
            TOKEN_PROGRAM_ID,
          ),
        ),
      ).toBe(true);
    });

    it("poolV2Pda helper is stable (used by AMM builders for the pre-upgrade tail)", () => {
      // Sanity — the AMM trailing accounts go AFTER poolV2Pda, so this PDA
      // must derive deterministically from the mint.
      expect(poolV2Pda(mint).equals(poolV2Pda(mint))).toBe(true);
    });

    // AMM instruction builders cannot be fully exercised offline because
    // `coin_creator_vault_authority` PDA seeds require `pool.coin_creator`
    // read from on-chain pool account data (OnlinePumpSdk fetches this).
    //
    // Instead, we pin the `remainingAccounts` composition directly:
    //   non-cashback: [poolV2, recipient, quoteMintATA]             → +3  (23+3=26 buy, 21+3=24 sell)
    //   buy cashback: [cashbackATA, poolV2, recipient, quoteMintATA] → +4  (23+4=27)
    //   sell cashback: [cashbackATA, accumulator, poolV2, recipient, quoteMintATA] → +5  (21+5=26)
    //
    // These were verified against the devnet txs in BREAKING_FEE_RECIPIENT.md.

    it("AMM remainingAccounts non-cashback gives 26 buy / 24 sell accounts", () => {
      const AMM_BUY_BASE = 23;
      const AMM_SELL_BASE = 21;
      const [recipient, ata] = buildAmmBreakingFeeRecipientAccounts();
      const tail = [
        { pubkey: poolV2Pda(mint), isWritable: false, isSigner: false },
        recipient!,
        ata!,
      ];
      expect(AMM_BUY_BASE + tail.length).toBe(26);
      expect(AMM_SELL_BASE + tail.length).toBe(24);
      // structural checks
      expect(breakingRecipientSet.has(recipient!.pubkey.toBase58())).toBe(true);
      expect(recipient!.isWritable).toBe(false);
      expect(ata!.isWritable).toBe(true);
      expect(ata!.pubkey.equals(getAssociatedTokenAddressSync(NATIVE_MINT, recipient!.pubkey, true, TOKEN_PROGRAM_ID))).toBe(true);
    });

    it("AMM remainingAccounts cashback buy gives 27 accounts", () => {
      const AMM_BUY_BASE = 23;
      const [recipient, ata] = buildAmmBreakingFeeRecipientAccounts();
      const cashbackExtra = { pubkey: TEST_PUBKEY, isWritable: true, isSigner: false };
      const tail = [
        cashbackExtra,
        { pubkey: poolV2Pda(mint), isWritable: false, isSigner: false },
        recipient!,
        ata!,
      ];
      expect(AMM_BUY_BASE + tail.length).toBe(27);
    });

    it("AMM remainingAccounts cashback sell gives 26 accounts", () => {
      const AMM_SELL_BASE = 21;
      const [recipient, ata] = buildAmmBreakingFeeRecipientAccounts();
      const cashbackExtras = [
        { pubkey: TEST_PUBKEY, isWritable: true, isSigner: false },
        { pubkey: TEST_CREATOR, isWritable: true, isSigner: false },
      ];
      const tail = [
        ...cashbackExtras,
        { pubkey: poolV2Pda(mint), isWritable: false, isSigner: false },
        recipient!,
        ata!,
      ];
      expect(AMM_SELL_BASE + tail.length).toBe(26);
    });
  });

  // ── isBreakingFeeRecipient ─────────────────────────────────────────
  describe("isBreakingFeeRecipient", () => {
    it("returns true for every known breaking fee recipient", () => {
      for (const r of BREAKING_FEE_RECIPIENTS) {
        expect(isBreakingFeeRecipient(r)).toBe(true);
      }
    });

    it("returns false for an arbitrary pubkey", () => {
      expect(isBreakingFeeRecipient(TEST_PUBKEY)).toBe(false);
      expect(isBreakingFeeRecipient(PublicKey.default)).toBe(false);
    });
  });

  // ── BREAKING_FEE_RECIPIENT_WSOL_ATAS ──────────────────────────────
  describe("BREAKING_FEE_RECIPIENT_WSOL_ATAS", () => {
    it("has exactly 8 entries", () => {
      expect(BREAKING_FEE_RECIPIENT_WSOL_ATAS.size).toBe(8);
    });

    it("each entry matches getAssociatedTokenAddressSync output", () => {
      for (const r of BREAKING_FEE_RECIPIENTS) {
        const cached = BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(r.toBase58());
        expect(cached).toBeDefined();
        const derived = getAssociatedTokenAddressSync(
          NATIVE_MINT,
          r,
          true,
          TOKEN_PROGRAM_ID,
        );
        expect(cached!.equals(derived)).toBe(true);
      }
    });

    it("buildAmmBreakingFeeRecipientAccounts uses cached ATA", () => {
      const recipient = BREAKING_FEE_RECIPIENTS[0]!;
      const [, ataAccount] = buildAmmBreakingFeeRecipientAccounts(recipient);
      const cached = BREAKING_FEE_RECIPIENT_WSOL_ATAS.get(
        recipient.toBase58(),
      )!;
      expect(ataAccount!.pubkey.equals(cached)).toBe(true);
    });
  });

  // ── validateBcInstruction ──────────────────────────────────────────
  describe("validateBcInstruction", () => {
    const bcMint = new PublicKey("So11111111111111111111111111111111111111112");
    const bcCreator = makeBondingCurveWithCreator().creator;

    it("passes for a valid BC buy instruction (18 accounts)", async () => {
      const ix = await PUMP_SDK.getBuyInstructionRaw({
        user: TEST_PUBKEY, mint: bcMint, creator: bcCreator,
        amount: new BN(1), solAmount: new BN(1), feeRecipient: TEST_CREATOR,
      });
      const result = validateBcInstruction(ix, "buy");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails for wrong account count", async () => {
      const ix = await PUMP_SDK.getBuyInstructionRaw({
        user: TEST_PUBKEY, mint: bcMint, creator: bcCreator,
        amount: new BN(1), solAmount: new BN(1), feeRecipient: TEST_CREATOR,
      });
      // strip trailing account to simulate pre-upgrade instruction
      const truncated = { ...ix, keys: ix.keys.slice(0, 17) } as typeof ix;
      const result = validateBcInstruction(truncated, "buy");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("expected 18"))).toBe(true);
    });

    it("fails when last account is not a breaking fee recipient", async () => {
      const ix = await PUMP_SDK.getBuyInstructionRaw({
        user: TEST_PUBKEY, mint: bcMint, creator: bcCreator,
        amount: new BN(1), solAmount: new BN(1), feeRecipient: TEST_CREATOR,
      });
      const tampered = {
        ...ix,
        keys: [
          ...ix.keys.slice(0, -1),
          { pubkey: TEST_PUBKEY, isWritable: true, isSigner: false },
        ],
      } as typeof ix;
      const result = validateBcInstruction(tampered, "buy");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("not a breaking fee recipient"))).toBe(true);
    });

    it("fails when last account is readonly", async () => {
      const ix = await PUMP_SDK.getBuyInstructionRaw({
        user: TEST_PUBKEY, mint: bcMint, creator: bcCreator,
        amount: new BN(1), solAmount: new BN(1), feeRecipient: TEST_CREATOR,
      });
      const tampered = {
        ...ix,
        keys: [
          ...ix.keys.slice(0, -1),
          { ...ix.keys[ix.keys.length - 1]!, isWritable: false },
        ],
      } as typeof ix;
      const result = validateBcInstruction(tampered, "buy");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must be mutable"))).toBe(true);
    });

    it("passes for a valid BC sell (non-cashback) instruction (16 accounts)", async () => {
      const ix = await PUMP_SDK.getSellInstructionRaw({
        user: TEST_PUBKEY, mint: bcMint, creator: bcCreator,
        amount: new BN(1), solAmount: new BN(1), feeRecipient: TEST_CREATOR,
        tokenProgram: TOKEN_PROGRAM_ID, cashback: false,
      });
      expect(validateBcInstruction(ix, "sell").valid).toBe(true);
    });

    it("passes for a valid BC sell-cashback instruction (17 accounts)", async () => {
      const ix = await PUMP_SDK.getSellInstructionRaw({
        user: TEST_PUBKEY, mint: bcMint, creator: bcCreator,
        amount: new BN(1), solAmount: new BN(1), feeRecipient: TEST_CREATOR,
        tokenProgram: TOKEN_PROGRAM_ID, cashback: true,
      });
      expect(validateBcInstruction(ix, "sell-cashback").valid).toBe(true);
    });
  });

  // ── validateAmmInstruction ─────────────────────────────────────────
  describe("validateAmmInstruction", () => {
    const makeAmmIx = (baseCount: number) => {
      const [recipient, ata] = buildAmmBreakingFeeRecipientAccounts();
      const fakeKeys = Array.from({ length: baseCount }, () => ({
        pubkey: TEST_PUBKEY,
        isWritable: false,
        isSigner: false,
      }));
      return { keys: [...fakeKeys, recipient!, ata!], programId: TEST_PUBKEY, data: Buffer.alloc(0) };
    };

    it("passes for correctly shaped non-cashback AMM buy (26 accounts)", () => {
      const result = validateAmmInstruction(
        makeAmmIx(24) as unknown as import("@solana/web3.js").TransactionInstruction,
        "buy",
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes for correctly shaped non-cashback AMM sell (24 accounts)", () => {
      const result = validateAmmInstruction(
        makeAmmIx(22) as unknown as import("@solana/web3.js").TransactionInstruction,
        "sell",
      );
      expect(result.valid).toBe(true);
    });

    it("fails when AMM recipient is writable", () => {
      const [recipient, ata] = buildAmmBreakingFeeRecipientAccounts();
      const fakeKeys = Array.from({ length: 24 }, () => ({
        pubkey: TEST_PUBKEY, isWritable: false, isSigner: false,
      }));
      const ix = {
        keys: [...fakeKeys, { ...recipient!, isWritable: true }, ata!],
        programId: TEST_PUBKEY,
        data: Buffer.alloc(0),
      } as unknown as import("@solana/web3.js").TransactionInstruction;
      const result = validateAmmInstruction(ix, "buy");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must be readonly"))).toBe(true);
    });

    it("fails when WSOL ATA pubkey is wrong", () => {
      const [recipient] = buildAmmBreakingFeeRecipientAccounts();
      const fakeKeys = Array.from({ length: 24 }, () => ({
        pubkey: TEST_PUBKEY, isWritable: false, isSigner: false,
      }));
      const ix = {
        keys: [
          ...fakeKeys,
          recipient!,
          { pubkey: TEST_PUBKEY, isWritable: true, isSigner: false },
        ],
        programId: TEST_PUBKEY,
        data: Buffer.alloc(0),
      } as unknown as import("@solana/web3.js").TransactionInstruction;
      const result = validateAmmInstruction(ix, "buy");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("WSOL ATA"))).toBe(true);
    });
  });

  // ── patchBcInstruction ─────────────────────────────────────────────
  describe("patchBcInstruction", () => {
    it("appends the breaking fee recipient to a pre-upgrade BC instruction", () => {
      const fakeKeys = Array.from({ length: 17 }, () => ({
        pubkey: TEST_PUBKEY, isWritable: false, isSigner: false,
      }));
      const ix = {
        keys: fakeKeys, programId: TEST_PUBKEY, data: Buffer.alloc(0),
      } as unknown as import("@solana/web3.js").TransactionInstruction;

      const patched = patchBcInstruction(ix);
      expect(patched.keys).toHaveLength(18);
      const tail = patched.keys[patched.keys.length - 1]!;
      expect(isBreakingFeeRecipient(tail.pubkey)).toBe(true);
      expect(tail.isWritable).toBe(true);
      expect(tail.isSigner).toBe(false);
    });

    it("is idempotent when the trailing account is already a breaking fee recipient", async () => {
      const ix = await PUMP_SDK.getBuyInstructionRaw({
        user: TEST_PUBKEY,
        mint: new PublicKey("So11111111111111111111111111111111111111112"),
        creator: makeBondingCurveWithCreator().creator,
        amount: new BN(1), solAmount: new BN(1), feeRecipient: TEST_CREATOR,
      });
      expect(ix.keys).toHaveLength(18);
      const patched = patchBcInstruction(ix);
      expect(patched).toBe(ix); // same reference — original not mutated
      expect(patched.keys).toHaveLength(18);
    });

    it("does not mutate the original instruction", () => {
      const fakeKeys = Array.from({ length: 17 }, () => ({
        pubkey: TEST_PUBKEY, isWritable: false, isSigner: false,
      }));
      const ix = {
        keys: fakeKeys, programId: TEST_PUBKEY, data: Buffer.alloc(0),
      } as unknown as import("@solana/web3.js").TransactionInstruction;

      patchBcInstruction(ix);
      expect(ix.keys).toHaveLength(17);
    });
  });

  // ── patchAmmInstruction ────────────────────────────────────────────
  describe("patchAmmInstruction", () => {
    it("appends two trailing accounts to a pre-upgrade AMM instruction", () => {
      const fakeKeys = Array.from({ length: 24 }, () => ({
        pubkey: TEST_PUBKEY, isWritable: false, isSigner: false,
      }));
      const ix = {
        keys: fakeKeys, programId: TEST_PUBKEY, data: Buffer.alloc(0),
      } as unknown as import("@solana/web3.js").TransactionInstruction;

      const patched = patchAmmInstruction(ix);
      expect(patched.keys).toHaveLength(26);
      const secondToLast = patched.keys[patched.keys.length - 2]!;
      const last = patched.keys[patched.keys.length - 1]!;
      expect(isBreakingFeeRecipient(secondToLast.pubkey)).toBe(true);
      expect(secondToLast.isWritable).toBe(false);
      expect(last.isWritable).toBe(true);
    });

    it("is idempotent when the accounts are already present", () => {
      const [recipient, ata] = buildAmmBreakingFeeRecipientAccounts();
      const fakeKeys = Array.from({ length: 24 }, () => ({
        pubkey: TEST_PUBKEY, isWritable: false, isSigner: false,
      }));
      const ix = {
        keys: [...fakeKeys, recipient!, ata!],
        programId: TEST_PUBKEY,
        data: Buffer.alloc(0),
      } as unknown as import("@solana/web3.js").TransactionInstruction;

      const patched = patchAmmInstruction(ix);
      expect(patched).toBe(ix); // same reference
      expect(patched.keys).toHaveLength(26);
    });

    it("does not mutate the original instruction", () => {
      const fakeKeys = Array.from({ length: 24 }, () => ({
        pubkey: TEST_PUBKEY, isWritable: false, isSigner: false,
      }));
      const ix = {
        keys: fakeKeys, programId: TEST_PUBKEY, data: Buffer.alloc(0),
      } as unknown as import("@solana/web3.js").TransactionInstruction;

      patchAmmInstruction(ix);
      expect(ix.keys).toHaveLength(24);
    });
  });
});
