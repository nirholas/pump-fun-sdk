import {
  BASE58_ALPHABET,
  MAX_VANITY_PATTERN_LENGTH,
  VanityMintMaxAttemptsError,
  VanityMintPatternError,
  estimateVanityMintAttempts,
  generateVanityMint,
} from "../vanityMint";

describe("vanityMint", () => {
  // ── estimateVanityMintAttempts ──────────────────────────────────────

  describe("estimateVanityMintAttempts", () => {
    it("returns 1 when no pattern is supplied", () => {
      expect(estimateVanityMintAttempts({})).toBe(1);
    });

    it("scales as 58^length for case-sensitive prefixes", () => {
      expect(estimateVanityMintAttempts({ prefix: "a" })).toBe(58);
      expect(estimateVanityMintAttempts({ prefix: "ab" })).toBe(58 * 58);
      expect(estimateVanityMintAttempts({ prefix: "abc" })).toBe(58 ** 3);
    });

    it("sums prefix and suffix lengths", () => {
      expect(estimateVanityMintAttempts({ prefix: "ab", suffix: "cd" })).toBe(
        58 ** 4,
      );
    });

    it("uses ~34 effective alphabet size when caseInsensitive", () => {
      expect(
        estimateVanityMintAttempts({ prefix: "ab", caseInsensitive: true }),
      ).toBe(34 * 34);
    });
  });

  // ── Validation ──────────────────────────────────────────────────────

  describe("validation", () => {
    it("rejects empty prefix and suffix", async () => {
      await expect(generateVanityMint({})).rejects.toThrow(
        VanityMintPatternError,
      );
    });

    it("rejects patterns containing '0'", async () => {
      await expect(
        generateVanityMint({ prefix: "a0b" }),
      ).rejects.toThrow(/Base58/);
    });

    it("rejects patterns containing 'O' (capital o)", async () => {
      await expect(
        generateVanityMint({ suffix: "pOmp" }),
      ).rejects.toThrow(/Base58/);
    });

    it("rejects patterns containing 'I' (capital i)", async () => {
      await expect(
        generateVanityMint({ prefix: "aIb" }),
      ).rejects.toThrow(/Base58/);
    });

    it("rejects patterns containing 'l' (lowercase L)", async () => {
      await expect(
        generateVanityMint({ suffix: "plmp" }),
      ).rejects.toThrow(/Base58/);
    });

    it("rejects patterns longer than MAX_VANITY_PATTERN_LENGTH", async () => {
      const tooLong = "a".repeat(MAX_VANITY_PATTERN_LENGTH + 1);
      await expect(generateVanityMint({ prefix: tooLong })).rejects.toThrow(
        /exceeds MAX_VANITY_PATTERN_LENGTH/,
      );
    });

    it("BASE58_ALPHABET contains exactly 58 characters", () => {
      expect(BASE58_ALPHABET).toHaveLength(58);
      expect(BASE58_ALPHABET).not.toMatch(/[0OIl]/);
    });
  });

  // ── Generation (short patterns only to keep tests fast) ──────────────

  describe("generation", () => {
    it("finds a mint whose address starts with a 1-char prefix", async () => {
      const result = await generateVanityMint({ prefix: "a" });
      expect(result.keypair.publicKey.toBase58().startsWith("a")).toBe(true);
      expect(result.attempts).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }, 30_000);

    it("finds a mint whose address ends with a 1-char suffix", async () => {
      const result = await generateVanityMint({ suffix: "p" });
      expect(result.keypair.publicKey.toBase58().endsWith("p")).toBe(true);
    }, 30_000);

    it("honours case-insensitive matching", async () => {
      const result = await generateVanityMint({
        prefix: "A",
        caseInsensitive: true,
      });
      expect(
        result.keypair.publicKey.toBase58().toLowerCase().startsWith("a"),
      ).toBe(true);
    }, 30_000);

    it("returns a keypair whose publicKey matches its secretKey", async () => {
      const { keypair } = await generateVanityMint({ prefix: "a" });
      // secretKey is 64 bytes: 32 seed + 32 pubkey. Last 32 bytes equal the pubkey.
      const pubkeyBytes = keypair.publicKey.toBytes();
      const tail = keypair.secretKey.slice(32);
      expect(Buffer.from(pubkeyBytes).equals(Buffer.from(tail))).toBe(true);
    }, 30_000);
  });

  // ── maxAttempts ─────────────────────────────────────────────────────

  describe("maxAttempts", () => {
    it("throws VanityMintMaxAttemptsError when exhausted", async () => {
      // Using a 4-character prefix (~11M expected attempts) with a tiny cap
      // forces exhaustion without running for long.
      await expect(
        generateVanityMint({ prefix: "abcd", maxAttempts: 100 }),
      ).rejects.toThrow(VanityMintMaxAttemptsError);
    }, 30_000);
  });

  // ── AbortSignal ─────────────────────────────────────────────────────

  describe("AbortSignal", () => {
    it("rejects immediately when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort(new Error("nope"));
      await expect(
        generateVanityMint({ prefix: "a", signal: controller.signal }),
      ).rejects.toThrow("nope");
    });

    it("aborts mid-grind", async () => {
      const controller = new AbortController();
      // Use a 4-char prefix (~11M expected attempts) so it doesn't complete
      // before the abort fires.
      const promise = generateVanityMint({
        prefix: "abcd",
        signal: controller.signal,
      });
      setTimeout(() => controller.abort(new Error("stop")), 50);
      await expect(promise).rejects.toThrow("stop");
    }, 30_000);
  });
});
