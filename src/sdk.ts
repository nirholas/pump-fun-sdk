import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
} from "@pump-fun/pump-swap-sdk";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  AccountInfo,
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { getStaticRandomFeeRecipient } from "./bondingCurve";
import {
  NoShareholdersError,
  TooManyShareholdersError,
  ZeroShareError,
  InvalidShareTotalError,
  DuplicateShareholderError,
} from "./errors";
import { getFeeRecipient } from "./fees";
import { Pump } from "./idl/pump";
import pumpIdl from "./idl/pump.json";
import { PumpAmm } from "./idl/pump_amm";
import PumpAmmIdl from "./idl/pump_amm.json";
import { PumpFees } from "./idl/pump_fees";
import PumpFeesIdl from "./idl/pump_fees.json";
import { OFFLINE_PUMP_PROGRAM } from "./onlineSdk";
import {
  bondingCurvePda,
  canonicalPumpPoolPda,
  creatorVaultPda,
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
  pumpPoolAuthorityPda,
  feeSharingConfigPda,
  userVolumeAccumulatorPda,
} from "./pda";
import {
  BondingCurve,
  FeeConfig,
  Global,
  GlobalVolumeAccumulator,
  UserVolumeAccumulator,
  Shareholder,
  SharingConfig,
  DistributeCreatorFeesEvent,
  MinimumDistributableFeeEvent,
} from "./state";

export function getPumpProgram(connection: Connection): Program<Pump> {
  return new Program(
    pumpIdl as Pump,
    new AnchorProvider(connection, null as any, {}),
  );
}

export const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);

export function getPumpAmmProgram(connection: Connection): Program<PumpAmm> {
  return new Program(
    PumpAmmIdl as PumpAmm,
    new AnchorProvider(connection, null as any, {}),
  );
}

export function getPumpFeeProgram(connection: Connection): Program<PumpFees> {
  return new Program(
    PumpFeesIdl as PumpFees,
    new AnchorProvider(connection, null as any, {}),
  );
}

export const PUMP_AMM_PROGRAM_ID = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
);

export const MAYHEM_PROGRAM_ID = new PublicKey(
  "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e",
);

export const PUMP_FEE_PROGRAM_ID = new PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
);

export const BONDING_CURVE_NEW_SIZE = 151;

export const PUMP_TOKEN_MINT = new PublicKey(
  "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
);

export const MAX_SHAREHOLDERS = 10;

export class PumpSdk {
  private readonly offlinePumpProgram: Program<Pump>;
  private readonly offlinePumpFeeProgram: Program<PumpFees>;
  private readonly offlinePumpAmmProgram: Program<PumpAmm>;

  constructor() {
    this.offlinePumpProgram = OFFLINE_PUMP_PROGRAM;
    // Create offline programs for fee and AMM
    this.offlinePumpFeeProgram = new Program(
      PumpFeesIdl as PumpFees,
      new AnchorProvider(null as any, null as any, {}),
    );
    this.offlinePumpAmmProgram = new Program(
      PumpAmmIdl as PumpAmm,
      new AnchorProvider(null as any, null as any, {}),
    );
  }

  decodeGlobal(accountInfo: AccountInfo<Buffer>): Global {
    return this.offlinePumpProgram.coder.accounts.decode<Global>(
      "global",
      accountInfo.data,
    );
  }

  decodeFeeConfig(accountInfo: AccountInfo<Buffer>): FeeConfig {
    return this.offlinePumpProgram.coder.accounts.decode<FeeConfig>(
      "feeConfig",
      accountInfo.data,
    );
  }

  decodeBondingCurve(accountInfo: AccountInfo<Buffer>): BondingCurve {
    return this.offlinePumpProgram.coder.accounts.decode<BondingCurve>(
      "bondingCurve",
      accountInfo.data,
    );
  }

  decodeBondingCurveNullable(
    accountInfo: AccountInfo<Buffer>,
  ): BondingCurve | null {
    try {
      const data = accountInfo.data;
      // Ensure buffer is at least 82 bytes
      if (data.length < 82) {
        const padded = Buffer.alloc(82);
        data.copy(padded);
        accountInfo = {
          ...accountInfo,
          data: padded,
        };
      }

      return this.decodeBondingCurve(accountInfo);
    } catch (error) {
      console.warn("Failed to decode bonding curve", error);
      return null;
    }
  }

  decodeGlobalVolumeAccumulator(
    accountInfo: AccountInfo<Buffer>,
  ): GlobalVolumeAccumulator {
    return this.offlinePumpProgram.coder.accounts.decode<GlobalVolumeAccumulator>(
      "globalVolumeAccumulator",
      accountInfo.data,
    );
  }

  decodeUserVolumeAccumulator(
    accountInfo: AccountInfo<Buffer>,
  ): UserVolumeAccumulator {
    return this.offlinePumpProgram.coder.accounts.decode<UserVolumeAccumulator>(
      "userVolumeAccumulator",
      accountInfo.data,
    );
  }

  decodeUserVolumeAccumulatorNullable(
    accountInfo: AccountInfo<Buffer>,
  ): UserVolumeAccumulator | null {
    try {
      return this.decodeUserVolumeAccumulator(accountInfo);
    } catch (error) {
      console.warn("Failed to decode user volume accumulator", error);
      return null;
    }
  }

  decodeSharingConfig(accountInfo: AccountInfo<Buffer>): SharingConfig {
    return this.offlinePumpFeeProgram.coder.accounts.decode<SharingConfig>(
      "sharingConfig",
      accountInfo.data,
    );
  }

  /**
   * @deprecated Use `createInstructionV2` instead.
   */
  async createInstruction({
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
  }: {
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .create(name, symbol, uri, creator)
      .accountsPartial({
        mint,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async createV2Instruction({
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    mayhemMode,
    cashback = false,
  }: {
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
    mayhemMode: boolean;
    cashback?: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .createV2(name, symbol, uri, creator, mayhemMode, [cashback ?? false])
      .accountsPartial({
        mint,
        user,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        mayhemProgramId: MAYHEM_PROGRAM_ID,
        globalParams: getGlobalParamsPda(),
        solVault: getSolVaultPda(),
        mayhemState: getMayhemStatePda(mint),
        mayhemTokenVault: getTokenVaultPda(mint),
      })
      .instruction();
  }

  async buyInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    associatedUserAccountInfo,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    global: Global;
    bondingCurveAccountInfo: AccountInfo<Buffer>;
    bondingCurve: BondingCurve;
    associatedUserAccountInfo: AccountInfo<Buffer> | null;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
    slippage: number;
    tokenProgram: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    if (bondingCurveAccountInfo.data.length < BONDING_CURVE_NEW_SIZE) {
      instructions.push(
        await this.extendAccountInstruction({
          account: bondingCurvePda(mint),
          user,
        }),
      );
    }

    const associatedUser = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      tokenProgram,
    );

    if (!associatedUserAccountInfo) {
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(
          user,
          associatedUser,
          user,
          mint,
          tokenProgram,
        ),
      );
    }

    instructions.push(
      await this.buyInstruction({
        global,
        mint,
        creator: bondingCurve.creator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage,
        tokenProgram,
        mayhemMode: bondingCurve.isMayhemMode,
      }),
    );

    return instructions;
  }

  async createV2AndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount,
    solAmount,
    mayhemMode,
    cashback = false,
  }: {
    global: Global;
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
    mayhemMode: boolean;
    cashback?: boolean;
  }): Promise<TransactionInstruction[]> {
    const associatedUser = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    return [
      await this.createV2Instruction({
        mint,
        name,
        symbol,
        uri,
        creator,
        user,
        mayhemMode,
        cashback,
      }),
      await this.extendAccountInstruction({
        account: bondingCurvePda(mint),
        user,
      }),
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        associatedUser,
        user,
        mint,
        TOKEN_2022_PROGRAM_ID,
      ),
      await this.buyInstruction({
        global,
        mint,
        creator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage: 1,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        mayhemMode,
      }),
    ];
  }

  /**
   * @deprecated Use `createV2AndBuyInstructions` instead.
   */
  async createAndBuyInstructions({
    global,
    mint,
    name,
    symbol,
    uri,
    creator,
    user,
    amount,
    solAmount,
  }: {
    global: Global;
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
  }): Promise<TransactionInstruction[]> {
    const associatedUser = getAssociatedTokenAddressSync(mint, user, true);
    return [
      await this.createInstruction({ mint, name, symbol, uri, creator, user }),
      await this.extendAccountInstruction({
        account: bondingCurvePda(mint),
        user,
      }),
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        associatedUser,
        user,
        mint,
      ),
      await this.buyInstruction({
        global,
        mint,
        creator,
        user,
        associatedUser,
        amount,
        solAmount,
        slippage: 1,
        tokenProgram: TOKEN_PROGRAM_ID,
        mayhemMode: false,
      }),
    ];
  }

  private async buyInstruction({
    global,
    mint,
    creator,
    user,
    associatedUser,
    amount,
    solAmount,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
    mayhemMode = false,
  }: {
    global: Global;
    mint: PublicKey;
    creator: PublicKey;
    user: PublicKey;
    associatedUser: PublicKey;
    amount: BN;
    solAmount: BN;
    slippage: number;
    tokenProgram: PublicKey;
    mayhemMode: boolean;
  }) {
    return await this.getBuyInstructionInternal({
      user,
      associatedUser,
      mint,
      creator,
      feeRecipient: getFeeRecipient(global, mayhemMode),
      amount,
      solAmount: solAmount.add(
        solAmount.mul(new BN(Math.floor(slippage * 10))).div(new BN(1000)),
      ),
      tokenProgram,
    });
  }

  async sellInstructions({
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
    mayhemMode = false,
    cashback = false,
  }: {
    global: Global;
    bondingCurveAccountInfo: AccountInfo<Buffer>;
    bondingCurve: BondingCurve;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
    slippage: number;
    tokenProgram: PublicKey;
    mayhemMode: boolean;
    cashback?: boolean;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    if (bondingCurveAccountInfo.data.length < BONDING_CURVE_NEW_SIZE) {
      instructions.push(
        await this.extendAccountInstruction({
          account: bondingCurvePda(mint),
          user,
        }),
      );
    }

    instructions.push(
      await this.getSellInstructionInternal({
        user,
        mint,
        creator: bondingCurve.creator,
        feeRecipient: getFeeRecipient(global, mayhemMode),
        amount,
        solAmount: solAmount.sub(
          solAmount.mul(new BN(Math.floor(slippage * 10))).div(new BN(1000)),
        ),
        tokenProgram,
        cashback,
      }),
    );

    return instructions;
  }

  async extendAccountInstruction({
    account,
    user,
  }: {
    account: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return this.offlinePumpProgram.methods
      .extendAccount()
      .accountsPartial({
        account,
        user,
      })
      .instruction();
  }

  async migrateInstruction({
    withdrawAuthority,
    mint,
    user,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    withdrawAuthority: PublicKey;
    mint: PublicKey;
    user: PublicKey;
    tokenProgram: PublicKey;
  }): Promise<TransactionInstruction> {
    const bondingCurve = bondingCurvePda(mint);
    const associatedBondingCurve = getAssociatedTokenAddressSync(
      mint,
      bondingCurve,
      true,
      tokenProgram,
    );

    const poolAuthority = pumpPoolAuthorityPda(mint);
    const poolAuthorityMintAccount = getAssociatedTokenAddressSync(
      mint,
      poolAuthority,
      true,
      tokenProgram,
    );

    const pool = canonicalPumpPoolPda(mint);
    const poolBaseTokenAccount = getAssociatedTokenAddressSync(
      mint,
      pool,
      true,
      tokenProgram,
    );
    return this.offlinePumpProgram.methods
      .migrate()
      .accountsPartial({
        mint,
        user,
        withdrawAuthority,
        associatedBondingCurve,
        poolAuthorityMintAccount,
        poolBaseTokenAccount,
      })
      .instruction();
  }

  async syncUserVolumeAccumulator(
    user: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .syncUserVolumeAccumulator()
      .accountsPartial({ user })
      .instruction();
  }

  async setCreator({
    mint,
    setCreatorAuthority,
    creator,
  }: {
    mint: PublicKey;
    setCreatorAuthority: PublicKey;
    creator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setCreator(creator)
      .accountsPartial({
        mint,
        setCreatorAuthority,
      })
      .instruction();
  }

  async initUserVolumeAccumulator({
    payer,
    user,
  }: {
    payer: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .initUserVolumeAccumulator()
      .accountsPartial({ payer, user })
      .instruction();
  }

  async closeUserVolumeAccumulator(
    user: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .closeUserVolumeAccumulator()
      .accountsPartial({ user })
      .instruction();
  }

  async getBuyInstructionRaw({
    user,
    mint,
    creator,
    amount,
    solAmount,
    feeRecipient = getStaticRandomFeeRecipient(),
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    amount: BN;
    solAmount: BN;
    feeRecipient: PublicKey;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.getBuyInstructionInternal({
      user,
      associatedUser: getAssociatedTokenAddressSync(
        mint,
        user,
        true,
        tokenProgram,
      ),
      mint,
      creator,
      feeRecipient,
      amount,
      solAmount,
    });
  }

  private async getBuyInstructionInternal({
    user,
    associatedUser,
    mint,
    creator,
    feeRecipient,
    amount,
    solAmount,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    user: PublicKey;
    associatedUser: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    feeRecipient: PublicKey;
    amount: BN;
    solAmount: BN;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .buy(amount, solAmount, { 0: true })
      .accountsPartial({
        feeRecipient,
        mint,
        associatedUser,
        user,
        creatorVault: creatorVaultPda(creator),
        tokenProgram,
      })
      .instruction();
  }

  async getSellInstructionRaw({
    user,
    mint,
    creator,
    amount,
    solAmount,
    feeRecipient = getStaticRandomFeeRecipient(),
    tokenProgram = TOKEN_PROGRAM_ID,
    cashback = false,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    amount: BN;
    solAmount: BN;
    feeRecipient: PublicKey;
    tokenProgram: PublicKey;
    cashback?: boolean;
  }): Promise<TransactionInstruction> {
    return await this.getSellInstructionInternal({
      user,
      mint,
      creator,
      feeRecipient,
      amount,
      solAmount,
      tokenProgram,
      cashback,
    });
  }

  private async getSellInstructionInternal({
    user,
    mint,
    creator,
    feeRecipient,
    amount,
    solAmount,
    tokenProgram,
    cashback = false,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    feeRecipient: PublicKey;
    amount: BN;
    solAmount: BN;
    tokenProgram: PublicKey;
    cashback?: boolean;
  }): Promise<TransactionInstruction> {
    const userVolumeAccumulator = userVolumeAccumulatorPda(user);
    return await this.offlinePumpProgram.methods
      .sell(amount, solAmount)
      .accountsPartial({
        feeRecipient,
        mint,
        associatedUser: getAssociatedTokenAddressSync(
          mint,
          user,
          true,
          tokenProgram,
        ),
        user,
        creatorVault: creatorVaultPda(creator),
        tokenProgram,
      })
      .remainingAccounts(
        cashback
          ? [
              {
                pubkey: userVolumeAccumulator,
                isWritable: true,
                isSigner: false,
              },
            ]
          : [],
      )
      .instruction();
  }

  /**
   * Creates a fee sharing configuration for a token.
   *
   * @param params - Parameters for creating a fee sharing configuration
   * @param params.creator - The creator of the token
   * @param params.mint - The mint address of the token
   * @param params.pool - The pool address of the token (null for ungraduated coins)
   */
  async createFeeSharingConfig({
    creator,
    mint,
    pool,
  }: {
    creator: PublicKey;
    mint: PublicKey;
    pool: PublicKey | null;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .createFeeSharingConfig()
      .accountsPartial({
        payer: creator,
        mint,
        pool,
      })
      .instruction();
  }

  /**
   * Updates the fee shares for a token's creator fee distribution.
   *
   * @param params - Parameters for updating fee shares
   * @param params.authority - The current authority that can modify the fee sharing config
   * @param params.mint - The mint address of the token
   * @param params.curShareholders - Array of current shareholders
   * @param params.newShareholders - Array of new shareholders and their share percentages
   * @requirements for newShareholders:
   * - Must contain at least 1 shareholder (cannot be empty)
   * - Maximum of 10 shareholders allowed
   * - Each shareholder must have a positive share (shareBps > 0)
   * - Total shares must equal exactly 10,000 basis points (100%)
   * - No duplicate addresses allowed
   * - shareBps is in basis points where 1 bps = 0.01% (e.g., 1500 = 15%)
   * @throws {NoShareholdersError} If shareholders array is empty
   * @throws {TooManyShareholdersError} If more than 10 shareholders
   * @throws {ZeroShareError} If any shareholder has zero or negative shares
   * @throws {InvalidShareTotalError} If total shares don't equal 10,000 basis points
   * @throws {DuplicateShareholderError} If duplicate addresses are found
   * @example
   * ```typescript
   * const instruction = await PUMP_SDK.updateFeeShares({
   *   authority: authorityPublicKey,
   *   mint: mintPublicKey,
   *   curShareholders: [wallet1, wallet2, wallet3],
   *   newShareholders: [
   *     { address: wallet1, shareBps: 5000 }, // 50%
   *     { address: wallet2, shareBps: 3000 }, // 30%
   *     { address: wallet3, shareBps: 2000 }, // 20%
   *   ]
   * });
   * ```
   */
  async updateFeeShares({
    authority,
    mint,
    currentShareholders,
    newShareholders,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    currentShareholders: PublicKey[];
    newShareholders: Shareholder[];
  }): Promise<TransactionInstruction> {
    if (newShareholders.length === 0) {
      throw new NoShareholdersError();
    }

    if (newShareholders.length > MAX_SHAREHOLDERS) {
      throw new TooManyShareholdersError(
        newShareholders.length,
        MAX_SHAREHOLDERS,
      );
    }

    let totalShares = 0;
    const addresses = new Set<string>();

    for (const shareholder of newShareholders) {
      if (shareholder.shareBps <= 0) {
        throw new ZeroShareError(shareholder.address.toString());
      }

      totalShares += shareholder.shareBps;
      addresses.add(shareholder.address.toString());
    }

    if (totalShares !== 10_000) {
      throw new InvalidShareTotalError(totalShares);
    }

    if (addresses.size !== newShareholders.length) {
      throw new DuplicateShareholderError();
    }

    const sharingConfigPda = feeSharingConfigPda(mint);
    const coinCreatorVaultAuthority =
      coinCreatorVaultAuthorityPda(sharingConfigPda);

    return await this.offlinePumpFeeProgram.methods
      .updateFeeShares(
        newShareholders.map((sh) => ({
          address: sh.address,
          shareBps: sh.shareBps,
        })),
      )
      .accountsPartial({
        authority,
        mint,
        coinCreatorVaultAta: coinCreatorVaultAtaPda(
          coinCreatorVaultAuthority,
          NATIVE_MINT,
          TOKEN_PROGRAM_ID,
        ),
      })
      .remainingAccounts(
        currentShareholders.map((pubkey) => ({
          pubkey,
          isWritable: true,
          isSigner: false,
        })),
      )
      .instruction();
  }

  decodeDistributeCreatorFeesEvent(data: Buffer): DistributeCreatorFeesEvent {
    return this.offlinePumpProgram.coder.types.decode<DistributeCreatorFeesEvent>(
      "distributeCreatorFeesEvent",
      data,
    );
  }

  async distributeCreatorFees({
    mint,
    sharingConfig,
    sharingConfigAddress,
  }: {
    mint: PublicKey;
    sharingConfig: SharingConfig;
    sharingConfigAddress: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .distributeCreatorFees()
      .accountsPartial({
        mint,
        creatorVault: creatorVaultPda(sharingConfigAddress),
      })
      .remainingAccounts(
        sharingConfig.shareholders.map((shareholder) => ({
          pubkey: shareholder.address,
          isWritable: true,
          isSigner: false,
        })),
      )
      .instruction();
  }

  decodeMinimumDistributableFee(data: Buffer): MinimumDistributableFeeEvent {
    return this.offlinePumpProgram.coder.types.decode<MinimumDistributableFeeEvent>(
      "minimumDistributableFeeEvent",
      data,
    );
  }

  async getMinimumDistributableFee({
    mint,
    sharingConfig,
    sharingConfigAddress,
  }: {
    mint: PublicKey;
    sharingConfig: SharingConfig;
    sharingConfigAddress: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .getMinimumDistributableFee()
      .accountsPartial({
        mint,
        creatorVault: creatorVaultPda(sharingConfigAddress),
      })
      .remainingAccounts(
        sharingConfig.shareholders.map((shareholder) => ({
          pubkey: shareholder.address,
          isWritable: true,
          isSigner: false,
        })),
      )
      .instruction();
  }

  async claimCashbackInstruction({
    user,
  }: {
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .claimCashback()
      .accountsPartial({
        user,
      })
      .instruction();
  }
}

export const PUMP_SDK = new PumpSdk();

/**
 * Checks if a creator has upgraded to using a fee sharing configuration.
 *
 * When a creator sets up fee sharing, the creator address in the BondingCurve or Pool
 * is replaced with the fee sharing config PDA address. This function checks if that
 * upgrade has occurred.
 *
 * @param params - Parameters for checking upgrade status
 * @param params.mint - The mint address of the token
 * @param params.creator - The creator address to check
 *                         - For ungraduated coins: use BondingCurve.creator
 *                         - For graduated coins: use Pool.coinCreator (from AMM pool)
 * @returns true if the creator has migrated to fee sharing config, false otherwise
 * @example
 * ```typescript
 * import { isCreatorUsingSharingConfig } from "@pump-fun/sdk";
 *
 * // For an ungraduated coin
 * const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda(mint));
 * const hasMigrated = isCreatorUsingSharingConfig({
 *   mint,
 *   creator: bondingCurve.creator
 * });
 *
 * // For a graduated coin
 * const pool = await ammProgram.account.pool.fetch(poolAddress);
 * const hasMigrated = isCreatorUsingSharingConfig({
 *   mint,
 *   creator: pool.coinCreator
 * });
 *
 * if (hasMigrated) {
 *   // Creator fees are distributed according to fee sharing config
 * } else {
 *   // Creator fees go directly to the creator address
 * }
 * ```
 */
export function isCreatorUsingSharingConfig({
  mint,
  creator,
}: {
  mint: PublicKey;
  creator: PublicKey;
}): boolean {
  return feeSharingConfigPda(mint).equals(creator);
}
