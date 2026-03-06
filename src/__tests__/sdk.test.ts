import { PublicKey } from "@solana/web3.js";

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
import { Platform } from "../state";
import { feeSharingConfigPda, socialFeePda } from "../pda";
import { TEST_PUBKEY, TEST_CREATOR } from "./fixtures";

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
});
