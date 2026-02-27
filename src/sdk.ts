import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
} from "@pump-fun/pump-swap-sdk";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
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
  feeProgramGlobalPda,
  socialFeePda as socialFeePdaHelper,
  AMM_GLOBAL_CONFIG_PDA,
  AMM_FEE_CONFIG_PDA,
  PUMP_AMM_EVENT_AUTHORITY_PDA,
} from "./pda";
import {
  BondingCurve,
  FeeConfig,
  Global,
  GlobalVolumeAccumulator,
  UserVolumeAccumulator,
  Shareholder,
  SharingConfig,
  Pool,
  AmmGlobalConfig,
  FeeProgramGlobal,
  SocialFeePda as SocialFeePdaAccount,
  DistributeCreatorFeesEvent,
  MinimumDistributableFeeEvent,
  TradeEvent,
  CreateEvent,
  CompleteEvent,
  CompletePumpAmmMigrationEvent,
  SetCreatorEvent,
  CollectCreatorFeeEvent,
  ClaimTokenIncentivesEvent,
  ClaimCashbackEvent,
  ExtendAccountEvent,
  InitUserVolumeAccumulatorEvent,
  SyncUserVolumeAccumulatorEvent,
  CloseUserVolumeAccumulatorEvent,
  AdminSetCreatorEvent,
  MigrateBondingCurveCreatorEvent,
  AmmBuyEvent,
  AmmSellEvent,
  DepositEvent,
  WithdrawEvent,
  CreatePoolEvent,
  CreateFeeSharingConfigEvent,
  UpdateFeeSharesEvent,
  ResetFeeSharingConfigEvent,
  RevokeFeeSharingAuthorityEvent,
  TransferFeeSharingAuthorityEvent,
  SocialFeePdaCreatedEvent,
  SocialFeePdaClaimedEvent,
} from "./state";

/** Create an Anchor Program instance for the Pump bonding curve program. */
export function getPumpProgram(connection: Connection): Program<Pump> {
  return new Program(
    pumpIdl as Pump,
    new AnchorProvider(connection, null as any, {}),
  );
}

/** Pump bonding curve program ID. */
export const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);

/** Create an Anchor Program instance for the PumpAMM graduated pool program. */
export function getPumpAmmProgram(connection: Connection): Program<PumpAmm> {
  return new Program(
    PumpAmmIdl as PumpAmm,
    new AnchorProvider(connection, null as any, {}),
  );
}

/** Create an Anchor Program instance for the PumpFees fee-sharing program. */
export function getPumpFeeProgram(connection: Connection): Program<PumpFees> {
  return new Program(
    PumpFeesIdl as PumpFees,
    new AnchorProvider(connection, null as any, {}),
  );
}

/** PumpAMM graduated pool program ID. */
export const PUMP_AMM_PROGRAM_ID = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
);

/** Mayhem mode program ID. */
export const MAYHEM_PROGRAM_ID = new PublicKey(
  "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e",
);

/** PumpFees fee-sharing program ID. */
export const PUMP_FEE_PROGRAM_ID = new PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
);

/** Account size in bytes for a bonding curve account. */
export const BONDING_CURVE_NEW_SIZE = 151;

/** PUMP token mint address used for token incentive rewards. */
export const PUMP_TOKEN_MINT = new PublicKey(
  "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
);

/** Maximum number of shareholders allowed in a fee-sharing config. */
export const MAX_SHAREHOLDERS = 10;

/**
 * Offline-first SDK for building Pump protocol transaction instructions.
 *
 * All methods return `TransactionInstruction[]` and require no RPC connection.
 * Use the pre-built singleton {@link PUMP_SDK} instead of constructing directly.
 */
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

  // ─── Buy Exact SOL In ───────────────────────────────────────────────

  /**
   * Buy tokens by specifying the exact SOL amount to spend.
   * More intuitive for users who think in SOL terms.
   *
   * @param params.user - The buyer's public key
   * @param params.mint - The token mint address
   * @param params.creator - The token creator
   * @param params.feeRecipient - Fee recipient address
   * @param params.solAmount - Exact SOL amount to spend (lamports)
   * @param params.minTokenAmount - Minimum tokens to receive (slippage protection)
   * @param params.tokenProgram - Token program (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
   */
  async buyExactSolInInstruction({
    user,
    mint,
    creator,
    feeRecipient,
    solAmount,
    minTokenAmount,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    user: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
    feeRecipient: PublicKey;
    solAmount: BN;
    minTokenAmount: BN;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction> {
    const associatedUser = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      tokenProgram,
    );
    return await this.offlinePumpProgram.methods
      .buyExactSolIn(solAmount, minTokenAmount)
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

  // ─── Mayhem Mode ────────────────────────────────────────────────────

  /**
   * Set virtual parameters for mayhem mode on a bonding curve.
   */
  async setMayhemVirtualParamsInstruction({
    authority,
    mint,
    virtualSolReserves,
    virtualTokenReserves,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    virtualSolReserves: BN;
    virtualTokenReserves: BN;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setMayhemVirtualParams(virtualSolReserves, virtualTokenReserves)
      .accountsPartial({
        authority,
        mint,
      })
      .instruction();
  }

  /**
   * Toggle mayhem mode on/off for the protocol.
   */
  async toggleMayhemModeInstruction({
    authority,
    enabled,
  }: {
    authority: PublicKey;
    enabled: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .toggleMayhemMode(enabled)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Toggle cashback feature on/off.
   */
  async toggleCashbackEnabledInstruction({
    authority,
    enabled,
  }: {
    authority: PublicKey;
    enabled: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .toggleCashbackEnabled(enabled)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Toggle the create_v2 instruction on/off.
   */
  async toggleCreateV2Instruction({
    authority,
    enabled,
  }: {
    authority: PublicKey;
    enabled: boolean;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .toggleCreateV2(enabled)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  // ─── Creator Management ─────────────────────────────────────────────

  /**
   * Migrate bonding curve creator to a new address.
   */
  async migrateBondingCurveCreatorInstruction({
    authority,
    mint,
    newCreator,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    newCreator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .migrateBondingCurveCreator(newCreator)
      .accountsPartial({
        authority,
        mint,
      })
      .instruction();
  }

  /**
   * Set the Metaplex creator metadata for a token.
   */
  async setMetaplexCreatorInstruction({
    authority,
    mint,
    creator,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    creator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setMetaplexCreator(creator)
      .accountsPartial({
        authority,
        mint,
      })
      .instruction();
  }

  /**
   * Set reserved fee recipients for the protocol.
   */
  async setReservedFeeRecipientsInstruction({
    authority,
    recipients,
  }: {
    authority: PublicKey;
    recipients: PublicKey[];
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .setReservedFeeRecipients(recipients)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  /**
   * Update the global authority address.
   */
  async updateGlobalAuthorityInstruction({
    authority,
    newAuthority,
  }: {
    authority: PublicKey;
    newAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpProgram.methods
      .updateGlobalAuthority(newAuthority)
      .accountsPartial({
        authority,
      })
      .instruction();
  }

  // ─── PumpAMM Instructions ──────────────────────────────────────────

  /**
   * Buy tokens on a graduated AMM pool.
   */
  async ammBuyInstruction({
    user,
    pool,
    mint,
    baseAmountOut,
    maxQuoteAmountIn,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    baseAmountOut: BN;
    maxQuoteAmountIn: BN;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const userQuoteAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      user,
      true,
      TOKEN_PROGRAM_ID,
    );
    return await this.offlinePumpAmmProgram.methods
      .buy(baseAmountOut, maxQuoteAmountIn)
      .accountsPartial({
        user,
        pool,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
      })
      .instruction();
  }

  /**
   * Buy tokens on AMM by specifying exact SOL (quote) input.
   */
  async ammBuyExactQuoteInInstruction({
    user,
    pool,
    mint,
    quoteAmountIn,
    minBaseAmountOut,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    quoteAmountIn: BN;
    minBaseAmountOut: BN;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const userQuoteAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      user,
      true,
      TOKEN_PROGRAM_ID,
    );
    return await this.offlinePumpAmmProgram.methods
      .buyExactQuoteIn(quoteAmountIn, minBaseAmountOut)
      .accountsPartial({
        user,
        pool,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
      })
      .instruction();
  }

  /**
   * Sell tokens on a graduated AMM pool.
   */
  async ammSellInstruction({
    user,
    pool,
    mint,
    baseAmountIn,
    minQuoteAmountOut,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    baseAmountIn: BN;
    minQuoteAmountOut: BN;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const userQuoteAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      user,
      true,
      TOKEN_PROGRAM_ID,
    );
    return await this.offlinePumpAmmProgram.methods
      .sell(baseAmountIn, minQuoteAmountOut)
      .accountsPartial({
        user,
        pool,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
      })
      .instruction();
  }

  /**
   * Deposit liquidity into an AMM pool (LP provision).
   */
  async ammDepositInstruction({
    user,
    pool,
    mint,
    maxBaseAmountIn,
    maxQuoteAmountIn,
    minLpTokenAmountOut,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    maxBaseAmountIn: BN;
    maxQuoteAmountIn: BN;
    minLpTokenAmountOut: BN;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const userQuoteAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      user,
      true,
      TOKEN_PROGRAM_ID,
    );
    return await this.offlinePumpAmmProgram.methods
      .deposit(maxBaseAmountIn, maxQuoteAmountIn, minLpTokenAmountOut)
      .accountsPartial({
        user,
        pool,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
      })
      .instruction();
  }

  /**
   * Withdraw liquidity from an AMM pool.
   */
  async ammWithdrawInstruction({
    user,
    pool,
    mint,
    lpTokenAmountIn,
    minBaseAmountOut,
    minQuoteAmountOut,
  }: {
    user: PublicKey;
    pool: PublicKey;
    mint: PublicKey;
    lpTokenAmountIn: BN;
    minBaseAmountOut: BN;
    minQuoteAmountOut: BN;
  }): Promise<TransactionInstruction> {
    const userBaseAta = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    const userQuoteAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      user,
      true,
      TOKEN_PROGRAM_ID,
    );
    return await this.offlinePumpAmmProgram.methods
      .withdraw(lpTokenAmountIn, minBaseAmountOut, minQuoteAmountOut)
      .accountsPartial({
        user,
        pool,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
      })
      .instruction();
  }

  /**
   * Migrate AMM pool coin creator to a new address.
   */
  async ammMigratePoolCoinCreatorInstruction({
    authority,
    pool,
    newCreator,
  }: {
    authority: PublicKey;
    pool: PublicKey;
    newCreator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .migratePoolCoinCreator(newCreator)
      .accountsPartial({
        authority,
        pool,
      })
      .instruction();
  }

  /**
   * Transfer creator fees from AMM pool to the Pump program.
   */
  async ammTransferCreatorFeesToPumpInstruction({
    pool,
    mint,
  }: {
    pool: PublicKey;
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .transferCreatorFeesToPump()
      .accountsPartial({
        pool,
        mint,
      })
      .instruction();
  }

  /**
   * Collect creator fees from an AMM pool.
   */
  async ammCollectCoinCreatorFeeInstruction({
    creator,
    pool,
  }: {
    creator: PublicKey;
    pool: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .collectCoinCreatorFee()
      .accountsPartial({
        coinCreator: creator,
        pool,
      })
      .instruction();
  }

  /**
   * Set the coin creator for an AMM pool.
   */
  async ammSetCoinCreatorInstruction({
    authority,
    pool,
    coinCreator,
  }: {
    authority: PublicKey;
    pool: PublicKey;
    coinCreator: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .setCoinCreator(coinCreator)
      .accountsPartial({
        authority,
        pool,
      })
      .instruction();
  }

  /**
   * Claim cashback from AMM trading.
   */
  async ammClaimCashbackInstruction({
    user,
  }: {
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .claimCashback()
      .accountsPartial({
        user,
      })
      .instruction();
  }

  /**
   * Sync user volume accumulator on the AMM program.
   */
  async ammSyncUserVolumeAccumulatorInstruction(
    user: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.offlinePumpAmmProgram.methods
      .syncUserVolumeAccumulator()
      .accountsPartial({ user })
      .instruction();
  }

  // ─── PumpFees Instructions ─────────────────────────────────────────

  /**
   * Create a social fee PDA for referral/social fee sharing.
   */
  async createSocialFeePdaInstruction({
    payer,
    authority,
    user,
  }: {
    payer: PublicKey;
    authority: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .createSocialFeePda()
      .accountsPartial({
        payer,
        authority,
        user,
      })
      .instruction();
  }

  /**
   * Claim accumulated social/referral fees.
   */
  async claimSocialFeePdaInstruction({
    authority,
    user,
  }: {
    authority: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .claimSocialFeePda()
      .accountsPartial({
        authority,
        user,
      })
      .instruction();
  }

  /**
   * Reset a fee sharing configuration.
   */
  async resetFeeSharingConfigInstruction({
    authority,
    mint,
  }: {
    authority: PublicKey;
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .resetFeeSharingConfig()
      .accountsPartial({
        authority,
        mint,
      })
      .instruction();
  }

  /**
   * Transfer fee sharing authority to a new address.
   */
  async transferFeeSharingAuthorityInstruction({
    authority,
    mint,
    newAuthority,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    newAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .transferFeeSharingAuthority(newAuthority)
      .accountsPartial({
        authority,
        mint,
      })
      .instruction();
  }

  /**
   * Permanently revoke fee sharing authority.
   * After this, no one can modify the fee sharing configuration.
   */
  async revokeFeeSharingAuthorityInstruction({
    authority,
    mint,
  }: {
    authority: PublicKey;
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .revokeFeeSharingAuthority()
      .accountsPartial({
        authority,
        mint,
      })
      .instruction();
  }

  /**
   * Set the claim rate limit for anti-abuse throttling.
   */
  async setClaimRateLimitInstruction({
    admin,
    claimRateLimit,
  }: {
    admin: PublicKey;
    claimRateLimit: BN;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .setClaimRateLimit(claimRateLimit)
      .accountsPartial({
        admin,
      })
      .instruction();
  }

  /**
   * Set the social claim authority.
   */
  async setSocialClaimAuthorityInstruction({
    admin,
    socialClaimAuthority,
  }: {
    admin: PublicKey;
    socialClaimAuthority: PublicKey;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .setSocialClaimAuthority(socialClaimAuthority)
      .accountsPartial({
        admin,
      })
      .instruction();
  }

  /**
   * Upsert (create or update) fee tiers for the protocol.
   */
  async upsertFeeTiersInstruction({
    admin,
    feeTiers,
  }: {
    admin: PublicKey;
    feeTiers: Array<{
      marketCapLamportsThreshold: BN;
      fees: { lpFeeBps: BN; protocolFeeBps: BN; creatorFeeBps: BN };
    }>;
  }): Promise<TransactionInstruction> {
    return await this.offlinePumpFeeProgram.methods
      .upsertFeeTiers(feeTiers)
      .accountsPartial({
        admin,
      })
      .instruction();
  }
}

/** Pre-built singleton instance of {@link PumpSdk}. Use this instead of `new PumpSdk()`. */
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

