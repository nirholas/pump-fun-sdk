import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import BN from "bn.js";

import { CashbackDeprecatedError, HolderRewardDisabledError } from "../errors";
import { creatorVaultPda, holderRewardsPda } from "../pda";
import { PUMP_PROGRAM_ID, PUMP_SDK } from "../sdk";
import { makeGlobal } from "./fixtures";

describe("Pump SDK 2 holder rewards", () => {
  const mint = Keypair.generate().publicKey;
  const creator = Keypair.generate().publicKey;

  const create = (holderReward: boolean) =>
    PUMP_SDK.createV2Instruction({
      mint,
      name: "Holder Test",
      symbol: "HOLD",
      uri: "https://example.com/holder.json",
      creator,
      user: creator,
      mayhemMode: false,
      holderReward,
    });

  it("encodes the trailing holder-reward flag", async () => {
    const [regular, holder] = await Promise.all([create(false), create(true)]);
    expect(regular.data.length).toBe(holder.data.length);
    expect(regular.data.at(-1)).toBe(0);
    expect(holder.data.at(-1)).toBe(1);
  });

  it("routes a launch-and-buy through the holder creator vault", async () => {
    const instructions = await PUMP_SDK.createV2AndBuyInstructions({
      global: makeGlobal(),
      mint,
      name: "Holder Test",
      symbol: "HOLD",
      uri: "https://example.com/holder.json",
      creator,
      user: creator,
      amount: new BN(1_000_000),
      solAmount: new BN(100_000),
      mayhemMode: false,
      holderReward: true,
    });
    const vault = creatorVaultPda(holderRewardsPda(mint));
    expect(instructions.at(-1)!.keys.some(({ pubkey }) => pubkey.equals(vault))).toBe(true);
  });

  it("fails before construction when the global holder gate is off", async () => {
    await expect(
      PUMP_SDK.createV2AndBuyInstructions({
        global: makeGlobal({ isHolderRewardEnabled: false }),
        mint,
        name: "Holder Test",
        symbol: "HOLD",
        uri: "https://example.com/holder.json",
        creator,
        user: creator,
        amount: new BN(1),
        solAmount: new BN(1),
        mayhemMode: false,
        holderReward: true,
      }),
    ).rejects.toBeInstanceOf(HolderRewardDisabledError);
  });

  it("rejects new cashback launches", async () => {
    await expect(
      PUMP_SDK.createV2Instruction({
        mint,
        name: "Old Mode",
        symbol: "OLD",
        uri: "https://example.com/old.json",
        creator,
        user: creator,
        mayhemMode: false,
        cashback: true,
      }),
    ).rejects.toBeInstanceOf(CashbackDeprecatedError);
  });

  it("builds a paired-account holder distribution", async () => {
    const recipients = [
      { owner: Keypair.generate().publicKey, amount: new BN(60) },
      { owner: Keypair.generate().publicKey, amount: new BN(40) },
    ];
    const instruction = await PUMP_SDK.distributeFeeToHoldersInstruction({
      holderRewardClaimAuthority: creator,
      mint,
      quoteMint: NATIVE_MINT,
      recipients,
    });
    expect(instruction.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    for (const { owner } of recipients) {
      expect(instruction.keys.some(({ pubkey, isWritable }) => pubkey.equals(owner) && isWritable)).toBe(true);
    }
  });

  it("builds the unified CTO path and makes a wallet creator writable", async () => {
    const instruction = await PUMP_SDK.adminCtoInstruction({
      adminSetCreatorAuthority: creator,
      mint,
      currentCreator: creator,
      isHolderReward: true,
    });
    expect(instruction.programId.equals(PUMP_PROGRAM_ID)).toBe(true);
    expect(instruction.keys.some(({ pubkey, isWritable }) => pubkey.equals(creator) && isWritable)).toBe(true);
    expect(instruction.keys.some(({ pubkey }) => pubkey.equals(TOKEN_2022_PROGRAM_ID))).toBe(false);
  });
});
