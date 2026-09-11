import BN from "bn.js";

import { totalUnclaimedTokens, currentDayTokens } from "../tokenIncentives";
import type { GlobalVolumeAccumulator, UserVolumeAccumulator } from "../state";

import { TEST_PUBKEY } from "./fixtures";

const DAY_SECONDS = 86400;
const START_TIME = 1_700_000_000; // fixed timestamp for tests

function makeGlobalVolume(
  overrides: Partial<GlobalVolumeAccumulator> = {},
): GlobalVolumeAccumulator {
  return {
    startTime: new BN(START_TIME),
    endTime: new BN(START_TIME + DAY_SECONDS * 30), // 30 day program
    secondsInADay: new BN(DAY_SECONDS),
    mint: TEST_PUBKEY,
    totalTokenSupply: [new BN("1000000000000"), new BN("1000000000000")],
    solVolumes: [new BN("100000000000"), new BN("200000000000")], // 100 SOL, 200 SOL
    ...overrides,
  };
}

function makeUserVolume(
  overrides: Partial<UserVolumeAccumulator> = {},
): UserVolumeAccumulator {
  return {
    user: TEST_PUBKEY,
    needsClaim: false,
    totalUnclaimedTokens: new BN(0),
    totalClaimedTokens: new BN(0),
    currentSolVolume: new BN("10000000000"), // 10 SOL
    lastUpdateTimestamp: new BN(START_TIME + 100), // during day 0
    ...overrides,
  };
}

describe("tokenIncentives", () => {
  // ── totalUnclaimedTokens ───────────────────────────────────────────

  describe("totalUnclaimedTokens", () => {
    it("returns 0 when startTime is 0", () => {
      const gv = makeGlobalVolume({ startTime: new BN(0) });
      const uv = makeUserVolume();
      expect(totalUnclaimedTokens(gv, uv, START_TIME + 100).eq(new BN(0))).toBe(true);
    });

    it("returns 0 when endTime is 0", () => {
      const gv = makeGlobalVolume({ endTime: new BN(0) });
      const uv = makeUserVolume();
      expect(totalUnclaimedTokens(gv, uv, START_TIME + 100).eq(new BN(0))).toBe(true);
    });

    it("returns 0 when current time is before start", () => {
      const gv = makeGlobalVolume();
      const uv = makeUserVolume();
      expect(totalUnclaimedTokens(gv, uv, START_TIME - 100).eq(new BN(0))).toBe(true);
    });

    it("returns 0 when lastUpdateTimestamp is before startTime", () => {
      const gv = makeGlobalVolume();
      const uv = makeUserVolume({
        lastUpdateTimestamp: new BN(START_TIME - 1),
      });
      expect(totalUnclaimedTokens(gv, uv, START_TIME + DAY_SECONDS + 100).eq(new BN(0))).toBe(true);
    });

    it("calculates rewards when day has advanced beyond last update", () => {
      const gv = makeGlobalVolume();
      const uv = makeUserVolume({
        currentSolVolume: new BN("10000000000"), // 10 SOL
        lastUpdateTimestamp: new BN(START_TIME + 100), // day 0
      });
      // Query at day 1 — should allocate day 0 rewards
      const timestamp = START_TIME + DAY_SECONDS + 100;
      const result = totalUnclaimedTokens(gv, uv, timestamp);
      // user contributed 10 SOL out of 100 SOL total → 10% of 1T tokens = 100B
      expect(result.eq(new BN("100000000000"))).toBe(true);
    });

    it("includes existing unclaimed tokens", () => {
      const gv = makeGlobalVolume();
      const existing = new BN("500000000000");
      const uv = makeUserVolume({
        totalUnclaimedTokens: existing,
        lastUpdateTimestamp: new BN(START_TIME + 100),
      });
      const timestamp = START_TIME + DAY_SECONDS + 100;
      const result = totalUnclaimedTokens(gv, uv, timestamp);
      // existing + new rewards
      expect(result.gt(existing)).toBe(true);
    });

    it("returns existing unclaimed when same day (no advance)", () => {
      const gv = makeGlobalVolume();
      const existing = new BN("500000000000");
      const uv = makeUserVolume({
        totalUnclaimedTokens: existing,
        lastUpdateTimestamp: new BN(START_TIME + 100),
      });
      // Still in day 0
      const result = totalUnclaimedTokens(gv, uv, START_TIME + 200);
      expect(result.eq(existing)).toBe(true);
    });
  });

  // ── currentDayTokens ──────────────────────────────────────────────

  describe("currentDayTokens", () => {
    it("returns 0 when startTime is 0", () => {
      const gv = makeGlobalVolume({ startTime: new BN(0) });
      const uv = makeUserVolume();
      expect(currentDayTokens(gv, uv, START_TIME + 100).eq(new BN(0))).toBe(true);
    });

    it("returns 0 when current time before start", () => {
      const gv = makeGlobalVolume();
      const uv = makeUserVolume();
      expect(currentDayTokens(gv, uv, START_TIME - 100).eq(new BN(0))).toBe(true);
    });

    it("returns 0 when current time after end", () => {
      const gv = makeGlobalVolume();
      const uv = makeUserVolume();
      expect(currentDayTokens(gv, uv, START_TIME + DAY_SECONDS * 31).eq(new BN(0))).toBe(true);
    });

    it("returns 0 when user is on a different day than current", () => {
      const gv = makeGlobalVolume();
      const uv = makeUserVolume({
        lastUpdateTimestamp: new BN(START_TIME + 100), // day 0
      });
      // We're on day 1
      expect(currentDayTokens(gv, uv, START_TIME + DAY_SECONDS + 100).eq(new BN(0))).toBe(true);
    });

    it("calculates current day rewards correctly", () => {
      const gv = makeGlobalVolume();
      const uv = makeUserVolume({
        currentSolVolume: new BN("10000000000"), // 10 SOL
        lastUpdateTimestamp: new BN(START_TIME + 100), // day 0
      });
      // Still day 0
      const result = currentDayTokens(gv, uv, START_TIME + 200);
      // 10 / 100 * 1T = 100B
      expect(result.eq(new BN("100000000000"))).toBe(true);
    });

    it("returns 0 when sol volume for the day is 0", () => {
      const gv = makeGlobalVolume({
        solVolumes: [new BN(0), new BN("200000000000")],
      });
      const uv = makeUserVolume({
        lastUpdateTimestamp: new BN(START_TIME + 100),
      });
      expect(currentDayTokens(gv, uv, START_TIME + 200).eq(new BN(0))).toBe(true);
    });
  });
});
