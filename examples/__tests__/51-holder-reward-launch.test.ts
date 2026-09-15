import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  buildHolderRewardLaunch,
  main,
} from "../51-holder-reward-launch";

describe("example 51: holder-reward launch", () => {
  it("routes the first buy to the holder-reward creator vault", async () => {
    const { creatorVault, instructions } = await buildHolderRewardLaunch();
    const create = instructions[0]!;
    const buy = instructions.at(-1)!;

    expect(create.keys.some(({ pubkey }) => pubkey.equals(TOKEN_2022_PROGRAM_ID))).toBe(true);
    expect(buy.keys.some(({ pubkey }) => pubkey.equals(creatorVault))).toBe(true);
  });

  it("encodes holder reward as a distinct trailing create_v2 option", async () => {
    const { instructions } = await buildHolderRewardLaunch();
    const create = instructions[0]!;
    expect(create.data.at(-1)).toBe(1);
  });

  it("exports a runnable main", () => {
    expect(typeof main).toBe("function");
  });
});
