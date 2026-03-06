import {
  Platform,
  stringToPlatform,
  platformToString,
  SUPPORTED_SOCIAL_PLATFORMS,
} from "../state";

describe("state", () => {
  describe("Platform enum", () => {
    it("has expected values", () => {
      expect(Platform.Pump).toBe(0);
      expect(Platform.X).toBe(1);
      expect(Platform.GitHub).toBe(2);
    });
  });

  describe("SUPPORTED_SOCIAL_PLATFORMS", () => {
    it("includes GitHub", () => {
      expect(SUPPORTED_SOCIAL_PLATFORMS).toContain(Platform.GitHub);
    });
  });

  describe("stringToPlatform", () => {
    it("parses Pump", () => {
      expect(stringToPlatform("Pump")).toBe(Platform.Pump);
    });

    it("parses case-insensitively", () => {
      expect(stringToPlatform("github")).toBe(Platform.GitHub);
      expect(stringToPlatform("GITHUB")).toBe(Platform.GitHub);
      expect(stringToPlatform("  x  ")).toBe(Platform.X);
    });

    it("throws for unknown platform", () => {
      expect(() => stringToPlatform("invalid")).toThrow("Unknown platform");
    });
  });

  describe("platformToString", () => {
    it("returns name for valid platforms", () => {
      expect(platformToString(Platform.Pump)).toBe("Pump");
      expect(platformToString(Platform.X)).toBe("X");
      expect(platformToString(Platform.GitHub)).toBe("GitHub");
    });

    it("throws for invalid numeric value", () => {
      expect(() => platformToString(999 as Platform)).toThrow("Unknown platform value");
    });
  });
});
