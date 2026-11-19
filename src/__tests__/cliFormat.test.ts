/**
 * Tests for the CLI's rendering layer.
 *
 * `--json` is a contract: scripts parse it. The two bugs guarded here both shipped
 * silently once and produced output that looked fine to a human and was wrong to a
 * machine: BN values leaking out in hexadecimal, and the SDK's scaled spot price
 * being printed as if it were SOL per token (off by 1000).
 */

import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

import {
  formatBps,
  formatCompact,
  formatScaledPrice,
  formatSol,
  formatTokens,
  lamportsToSol,
  meter,
  plainText,
  normalizeForJson,
  rawToTokens,
  setColorEnabled,
  shortAddress,
  solToLamports,
  toJson,
  tokensToRaw,
} from "../cli/format";

beforeAll(() => {
  // Colour codes would make every string assertion below unreadable.
  setColorEnabled(false);
});

describe("cli/format", () => {
  describe("normalizeForJson", () => {
    it("renders BN in base 10, not the hex that BN.toJSON would emit", () => {
      // BN.prototype.toJSON returns a padded hex string, so a naive
      // JSON.stringify replacer never sees the BN at all.
      expect(normalizeForJson(new BN(0))).toBe("0");
      expect(normalizeForJson(new BN(255))).toBe("255");
      expect(normalizeForJson(new BN("1000000000000000"))).toBe(
        "1000000000000000",
      );
    });

    it("renders public keys as base58", () => {
      const key = PublicKey.default;
      expect(normalizeForJson(key)).toBe(key.toBase58());
    });

    it("walks nested objects and arrays", () => {
      const value = normalizeForJson({
        outer: { inner: new BN(42), list: [new BN(1), new BN(2)] },
      }) as { outer: { inner: string; list: string[] } };

      expect(value.outer.inner).toBe("42");
      expect(value.outer.list).toEqual(["1", "2"]);
    });

    it("passes plain scalars through untouched", () => {
      expect(normalizeForJson(7)).toBe(7);
      expect(normalizeForJson("hello")).toBe("hello");
      expect(normalizeForJson(true)).toBe(true);
      expect(normalizeForJson(undefined)).toBeNull();
    });

    it("survives a full round trip through toJson", () => {
      const parsed: unknown = JSON.parse(
        toJson({ marketCap: new BN("1234500000000"), mint: PublicKey.default }),
      );
      expect(parsed).toEqual({
        marketCap: "1234500000000",
        mint: PublicKey.default.toBase58(),
      });
    });
  });

  describe("formatScaledPrice", () => {
    it("divides the scaled spot price down to SOL per whole token", () => {
      // 1e12 scaled units is exactly 1 SOL per token.
      expect(formatScaledPrice(new BN("1000000000000"))).toBe("1 SOL");
      expect(formatScaledPrice(new BN("500000000000"))).toBe("0.5 SOL");
    });

    it("does not agree with formatSol, which would be the 1000x bug", () => {
      const scaled = new BN("93703");
      expect(formatScaledPrice(scaled)).not.toBe(formatSol(scaled));
    });

    it("renders zero cleanly", () => {
      expect(formatScaledPrice(new BN(0))).toBe("0 SOL");
    });
  });

  describe("lamport and token conversions", () => {
    it("round-trips SOL through lamports", () => {
      expect(lamportsToSol(solToLamports(1.5))).toBeCloseTo(1.5, 9);
      expect(solToLamports(1).toString()).toBe("1000000000");
    });

    it("round-trips whole tokens through raw units", () => {
      expect(rawToTokens(tokensToRaw(1234.5))).toBeCloseTo(1234.5, 6);
      expect(tokensToRaw(1).toString()).toBe("1000000");
    });

    it("formats SOL without trailing zero noise", () => {
      expect(formatSol(new BN("1500000000"))).toBe("1.5 SOL");
      expect(formatSol(new BN(0))).toBe("0 SOL");
    });

    it("uses exponent notation rather than rounding tiny amounts to zero", () => {
      expect(formatSol(new BN(1))).toContain("e-");
    });
  });

  describe("compact numbers", () => {
    it("abbreviates by magnitude", () => {
      expect(formatCompact(1_500)).toBe("1.5K");
      expect(formatCompact(2_400_000)).toBe("2.4M");
      expect(formatCompact(3_000_000_000)).toBe("3B");
      expect(formatCompact(1_000_000_000_000)).toBe("1T");
    });

    it("formats a one billion token supply as 1B", () => {
      expect(formatTokens(new BN("1000000000000000"))).toBe("1B");
    });
  });

  describe("formatBps", () => {
    it("converts basis points to a percentage", () => {
      expect(formatBps(10_000)).toBe("100%");
      expect(formatBps(125)).toBe("1.25%");
      expect(formatBps(0)).toBe("0%");
    });
  });

  describe("meter", () => {
    it("clamps out-of-range fractions instead of drawing a broken bar", () => {
      expect(meter(-1, 10)).toContain("0.00%");
      expect(meter(2, 10)).toContain("100.00%");
      expect(meter(0.5, 10)).toContain("50.00%");
    });

    it("draws exactly the requested width", () => {
      const bar = meter(0.5, 20).split(" ")[0] ?? "";
      expect([...bar]).toHaveLength(20);
    });
  });

  describe("shortAddress", () => {
    it("elides the middle of a long address", () => {
      const short = shortAddress("FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump");
      expect(short.startsWith("FeMbDo")).toBe(true);
      expect(short.endsWith("JVJpump")).toBe(false);
      expect(short).toContain("…");
    });

    it("leaves short strings alone", () => {
      expect(shortAddress("abc")).toBe("abc");
    });
  });
});

describe("plainText", () => {
  it("leaves ordinary names, including non-Latin text and emoji, untouched", () => {
    expect(plainText("Pump Coin 🚀 ポンプ")).toBe("Pump Coin 🚀 ポンプ");
  });

  it("neutralises ANSI colour, cursor and OSC title sequences", () => {
    const hostile = "\u001b[2K\u001b[1A\u001b[32mSAFE\u001b]0;pwned\u0007";
    const cleaned = plainText(hostile);
    expect(cleaned).not.toContain("\u001b");
    expect(cleaned).not.toContain("\u0007");
    expect(cleaned).toContain("SAFE");
  });

  it("replaces 8-bit C1 controls, DEL, CR and newlines", () => {
    expect(plainText("a\u009b31mb\u007fc\rd\ne")).toBe("a�31mb�c�d�e");
  });
});
