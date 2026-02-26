import { Program } from "@coral-xyz/anchor";
import {
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  PumpAmmAdminSdk,
} from "@pump-fun/pump-swap-sdk";
import {
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  PublicKeyInitData,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";

import { Pump } from "./idl/pump";
import { PumpAmm } from "./idl/pump_amm";
import {
  bondingCurvePda,
  canonicalPumpPoolPda,
  creatorVaultPda,
  feeSharingConfigPda,
  GLOBAL_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  PUMP_FEE_CONFIG_PDA,
  userVolumeAccumulatorPda,
} from "./pda";
import {
  getPumpAmmProgram,
  getPumpProgram,
  PUMP_SDK,
  PUMP_TOKEN_MINT,
} from "./sdk";
import {
  BondingCurve,
  FeeConfig,
  Global,
  GlobalVolumeAccumulator,
  MinimumDistributableFeeEvent,
  UserVolumeAccumulator,
  UserVolumeAccumulatorTotalStats,
} from "./state";
import { currentDayTokens, totalUnclaimedTokens } from "./tokenIncentives";

export const OFFLINE_PUMP_PROGRAM = getPumpProgram(null as any as Connection);

export class OnlinePumpSdk {
  private readonly connection: Connection;
  private readonly pumpProgram: Program<Pump>;
  private readonly offlinePumpProgram: Program<Pump>;
  private readonly pumpAmmProgram: Program<PumpAmm>;
  private readonly pumpAmmSdk: OnlinePumpAmmSdk;
  private readonly pumpAmmAdminSdk: PumpAmmAdminSdk;

  constructor(connection: Connection) {
    this.connection = connection;

    this.pumpProgram = getPumpProgram(connection);
    this.offlinePumpProgram = OFFLINE_PUMP_PROGRAM;
    this.pumpAmmProgram = getPumpAmmProgram(connection);

    this.pumpAmmSdk = new OnlinePumpAmmSdk(connection);
    this.pumpAmmAdminSdk = new PumpAmmAdminSdk(connection);
  }

  async fetchGlobal(): Promise<Global> {
    return await this.pumpProgram.account.global.fetch(GLOBAL_PDA);
  }

  async fetchFeeConfig(): Promise<FeeConfig> {
    return await this.pumpProgram.account.feeConfig.fetch(PUMP_FEE_CONFIG_PDA);
  }

  async fetchBondingCurve(mint: PublicKeyInitData): Promise<BondingCurve> {
    return await this.pumpProgram.account.bondingCurve.fetch(
      bondingCurvePda(mint),
    );
  }

  async fetchBuyState(
    mint: PublicKey,
    user: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ) {
    const [bondingCurveAccountInfo, associatedUserAccountInfo] =
      await this.connection.getMultipleAccountsInfo([
        bondingCurvePda(mint),
        getAssociatedTokenAddressSync(mint, user, true, tokenProgram),
      ]);

    if (!bondingCurveAccountInfo) {
      throw new Error(
        `Bonding curve account not found for mint: ${mint.toBase58()}`,
      );
    }

    const bondingCurve = PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);
    return { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo };
  }

  async fetchSellState(
    mint: PublicKey,
    user: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ) {
    const [bondingCurveAccountInfo, associatedUserAccountInfo] =
      await this.connection.getMultipleAccountsInfo([
        bondingCurvePda(mint),
        getAssociatedTokenAddressSync(mint, user, true, tokenProgram),
      ]);

    if (!bondingCurveAccountInfo) {
      throw new Error(
        `Bonding curve account not found for mint: ${mint.toBase58()}`,
      );
    }

    if (!associatedUserAccountInfo) {
      throw new Error(
        `Associated token account not found for mint: ${mint.toBase58()} and user: ${user.toBase58()}`,
      );
    }

    const bondingCurve = PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);
    return { bondingCurveAccountInfo, bondingCurve };
  }

  async fetchGlobalVolumeAccumulator(): Promise<GlobalVolumeAccumulator> {
    return await this.pumpProgram.account.globalVolumeAccumulator.fetch(
      GLOBAL_VOLUME_ACCUMULATOR_PDA,
    );
  }

  async fetchUserVolumeAccumulator(
    user: PublicKey,
  ): Promise<UserVolumeAccumulator | null> {
    return await this.pumpProgram.account.userVolumeAccumulator.fetchNullable(
      userVolumeAccumulatorPda(user),
    );
  }

  async fetchUserVolumeAccumulatorTotalStats(
    user: PublicKey,
  ): Promise<UserVolumeAccumulatorTotalStats> {
    const userVolumeAccumulator = (await this.fetchUserVolumeAccumulator(
      user,
    )) ?? {
      totalUnclaimedTokens: new BN(0),
      totalClaimedTokens: new BN(0),
      currentSolVolume: new BN(0),
    };

    const userVolumeAccumulatorAmm =
      (await this.pumpAmmSdk.fetchUserVolumeAccumulator(user)) ?? {
        totalUnclaimedTokens: new BN(0),
        totalClaimedTokens: new BN(0),
        currentSolVolume: new BN(0),
      };

    return {
      totalUnclaimedTokens: userVolumeAccumulator.totalUnclaimedTokens.add(
        userVolumeAccumulatorAmm.totalUnclaimedTokens,
      ),
      totalClaimedTokens: userVolumeAccumulator.totalClaimedTokens.add(
        userVolumeAccumulatorAmm.totalClaimedTokens,
      ),
      currentSolVolume: userVolumeAccumulator.currentSolVolume.add(
        userVolumeAccumulatorAmm.currentSolVolume,
      ),
    };
  }

  async collectCoinCreatorFeeInstructions(
    coinCreator: PublicKey,
    feePayer?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const quoteMint = NATIVE_MINT;
    const quoteTokenProgram = TOKEN_PROGRAM_ID;

    const coinCreatorVaultAuthority = coinCreatorVaultAuthorityPda(coinCreator);
    const coinCreatorVaultAta = coinCreatorVaultAtaPda(
      coinCreatorVaultAuthority,
      quoteMint,
      quoteTokenProgram,
    );

    const coinCreatorTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      coinCreator,
      true,
      quoteTokenProgram,
    );
    const [coinCreatorVaultAtaAccountInfo, coinCreatorTokenAccountInfo] =
      await this.connection.getMultipleAccountsInfo([
        coinCreatorVaultAta,
        coinCreatorTokenAccount,
      ]);

    return [
      await this.offlinePumpProgram.methods
        .collectCreatorFee()
        .accountsPartial({
          creator: coinCreator,
        })
        .instruction(),
      ...(await PUMP_AMM_SDK.collectCoinCreatorFee(
        {
          coinCreator,
          quoteMint,
          quoteTokenProgram,
          coinCreatorVaultAuthority,
          coinCreatorVaultAta,
          coinCreatorTokenAccount,
          coinCreatorVaultAtaAccountInfo,
          coinCreatorTokenAccountInfo,
        },
        feePayer,
      )),
    ];
  }

  async adminSetCoinCreatorInstructions(
    newCoinCreator: PublicKey,
    mint: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const global = await this.fetchGlobal();

    return [
      await this.offlinePumpProgram.methods
        .adminSetCreator(newCoinCreator)
        .accountsPartial({
          adminSetCreatorAuthority: global.adminSetCreatorAuthority,
          mint,
        })
        .instruction(),
      await this.pumpAmmAdminSdk.adminSetCoinCreator(mint, newCoinCreator),
    ];
  }

  async getCreatorVaultBalance(creator: PublicKey): Promise<BN> {
    const creatorVault = creatorVaultPda(creator);
    const accountInfo = await this.connection.getAccountInfo(creatorVault);

    if (accountInfo === null) {
      return new BN(0);
    }

    const rentExemptionLamports =
      await this.connection.getMinimumBalanceForRentExemption(
        accountInfo.data.length,
      );

    if (accountInfo.lamports < rentExemptionLamports) {
      return new BN(0);
    }

    return new BN(accountInfo.lamports - rentExemptionLamports);
  }

  async getCreatorVaultBalanceBothPrograms(creator: PublicKey): Promise<BN> {
    const balance = await this.getCreatorVaultBalance(creator);
    const ammBalance =
      await this.pumpAmmSdk.getCoinCreatorVaultBalance(creator);
    return balance.add(ammBalance);
  }

  async adminUpdateTokenIncentives(
    startTime: BN,
    endTime: BN,
    dayNumber: BN,
    tokenSupplyPerDay: BN,
    secondsInADay: BN = new BN(86_400),
    mint: PublicKey = PUMP_TOKEN_MINT,
    tokenProgram: PublicKey = TOKEN_2022_PROGRAM_ID,
  ): Promise<TransactionInstruction> {
    const { authority } = await this.fetchGlobal();

    return await this.offlinePumpProgram.methods
      .adminUpdateTokenIncentives(
        startTime,
        endTime,
        secondsInADay,
        dayNumber,
        tokenSupplyPerDay,
      )
      .accountsPartial({
        authority,
        mint,
        tokenProgram,
      })
      .instruction();
  }

  async adminUpdateTokenIncentivesBothPrograms(
    startTime: BN,
    endTime: BN,
    dayNumber: BN,
    tokenSupplyPerDay: BN,
    secondsInADay: BN = new BN(86_400),
    mint: PublicKey = PUMP_TOKEN_MINT,
    tokenProgram: PublicKey = TOKEN_2022_PROGRAM_ID,
  ): Promise<TransactionInstruction[]> {
    return [
      await this.adminUpdateTokenIncentives(
        startTime,
        endTime,
        dayNumber,
        tokenSupplyPerDay,
        secondsInADay,
        mint,
        tokenProgram,
      ),
      await this.pumpAmmAdminSdk.adminUpdateTokenIncentives(
        startTime,
        endTime,
        dayNumber,
        tokenSupplyPerDay,
        secondsInADay,
        mint,
        tokenProgram,
      ),
    ];
  }

  async claimTokenIncentives(
    user: PublicKey,
    payer: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const { mint } = await this.fetchGlobalVolumeAccumulator();

    if (mint.equals(PublicKey.default)) {
      return [];
    }

    const [mintAccountInfo, userAccumulatorAccountInfo] =
      await this.connection.getMultipleAccountsInfo([
        mint,
        userVolumeAccumulatorPda(user),
      ]);

    if (!mintAccountInfo) {
      return [];
    }

    if (!userAccumulatorAccountInfo) {
      return [];
    }

    return [
      await this.offlinePumpProgram.methods
        .claimTokenIncentives()
        .accountsPartial({
          user,
          payer,
          mint,
          tokenProgram: mintAccountInfo.owner,
        })
        .instruction(),
    ];
  }

  async claimTokenIncentivesBothPrograms(
    user: PublicKey,
    payer: PublicKey,
  ): Promise<TransactionInstruction[]> {
    return [
      ...(await this.claimTokenIncentives(user, payer)),
      ...(await this.pumpAmmSdk.claimTokenIncentives(user, payer)),
    ];
  }

  async getTotalUnclaimedTokens(user: PublicKey): Promise<BN> {
    const [
      globalVolumeAccumulatorAccountInfo,
      userVolumeAccumulatorAccountInfo,
    ] = await this.connection.getMultipleAccountsInfo([
      GLOBAL_VOLUME_ACCUMULATOR_PDA,
      userVolumeAccumulatorPda(user),
    ]);

    if (
      !globalVolumeAccumulatorAccountInfo ||
      !userVolumeAccumulatorAccountInfo
    ) {
      return new BN(0);
    }

    const globalVolumeAccumulator = PUMP_SDK.decodeGlobalVolumeAccumulator(
      globalVolumeAccumulatorAccountInfo,
    );
    const userVolumeAccumulator = PUMP_SDK.decodeUserVolumeAccumulator(
      userVolumeAccumulatorAccountInfo,
    );

    return totalUnclaimedTokens(globalVolumeAccumulator, userVolumeAccumulator);
  }

  async getTotalUnclaimedTokensBothPrograms(user: PublicKey): Promise<BN> {
    return (await this.getTotalUnclaimedTokens(user)).add(
      await this.pumpAmmSdk.getTotalUnclaimedTokens(user),
    );
  }

  async getCurrentDayTokens(user: PublicKey): Promise<BN> {
    const [
      globalVolumeAccumulatorAccountInfo,
      userVolumeAccumulatorAccountInfo,
    ] = await this.connection.getMultipleAccountsInfo([
      GLOBAL_VOLUME_ACCUMULATOR_PDA,
      userVolumeAccumulatorPda(user),
    ]);

    if (
      !globalVolumeAccumulatorAccountInfo ||
      !userVolumeAccumulatorAccountInfo
    ) {
      return new BN(0);
    }

    const globalVolumeAccumulator = PUMP_SDK.decodeGlobalVolumeAccumulator(
      globalVolumeAccumulatorAccountInfo,
    );
    const userVolumeAccumulator = PUMP_SDK.decodeUserVolumeAccumulator(
      userVolumeAccumulatorAccountInfo,
    );

    return currentDayTokens(globalVolumeAccumulator, userVolumeAccumulator);
  }

  async getCurrentDayTokensBothPrograms(user: PublicKey): Promise<BN> {
    return (await this.getCurrentDayTokens(user)).add(
      await this.pumpAmmSdk.getCurrentDayTokens(user),
    );
  }

  async syncUserVolumeAccumulatorBothPrograms(
    user: PublicKey,
  ): Promise<TransactionInstruction[]> {
    return [
      await PUMP_SDK.syncUserVolumeAccumulator(user),
      await PUMP_AMM_SDK.syncUserVolumeAccumulator(user),
    ];
  }

  /**
   * Gets the minimum distributable fee for a token's fee sharing configuration.
   *
   * This method handles both graduated (AMM) and non-graduated (bonding curve) tokens.
   * For graduated tokens, it automatically consolidates fees from the AMM vault before
   * calculating the minimum distributable fee.
   *
   * @param mint - The mint address of the token
   * @param simulationSigner - Optional signer address for transaction simulation.
   *                           Must have a non-zero SOL balance. Defaults to a known funded address.
   * @returns The minimum distributable fee information including whether distribution is possible
   */
  async getMinimumDistributableFee(
    mint: PublicKey,
    simulationSigner: PublicKey = new PublicKey(
      "UqN2p5bAzBqYdHXcgB6WLtuVrdvmy9JSAtgqZb3CMKw",
    ),
  ): Promise<MinimumDistributableFeeResult> {
    const sharingConfigPubkey = feeSharingConfigPda(mint);
    const poolAddress = canonicalPumpPoolPda(mint);
    const coinCreatorVaultAuthority =
      coinCreatorVaultAuthorityPda(sharingConfigPubkey);
    const ammVaultAta = coinCreatorVaultAtaPda(
      coinCreatorVaultAuthority,
      NATIVE_MINT,
      TOKEN_PROGRAM_ID,
    );

    const [sharingConfigAccountInfo, poolAccountInfo, ammVaultAtaInfo] =
      await this.connection.getMultipleAccountsInfo([
        sharingConfigPubkey,
        poolAddress,
        ammVaultAta,
      ]);

    if (!sharingConfigAccountInfo) {
      throw new Error(`Sharing config not found for mint: ${mint.toBase58()}`);
    }

    const sharingConfig = PUMP_SDK.decodeSharingConfig(
      sharingConfigAccountInfo,
    );

    const instructions: TransactionInstruction[] = [];

    const isGraduated = poolAccountInfo !== null;
    if (isGraduated && ammVaultAtaInfo) {
      // Consolidate fees from AMM to bonding curve program for distribution
      const transferCreatorFeesToPumpIx = await this.pumpAmmProgram.methods
        .transferCreatorFeesToPump()
        .accountsPartial({
          wsolMint: NATIVE_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
          coinCreator: sharingConfigPubkey,
        })
        .instruction();
      instructions.push(transferCreatorFeesToPumpIx);
    }

    const getMinFeeIx = await PUMP_SDK.getMinimumDistributableFee({
      mint,
      sharingConfig,
      sharingConfigAddress: sharingConfigPubkey,
    });
    instructions.push(getMinFeeIx);

    const { blockhash } = await this.connection.getLatestBlockhash();

    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: simulationSigner,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(),
    );

    const result = await this.connection.simulateTransaction(tx);

    let minimumDistributableFee: MinimumDistributableFeeEvent = {
      minimumRequired: new BN(0),
      distributableFees: new BN(0),
      canDistribute: false,
    };

    if (!result.value.err) {
      const [data, encoding] = result.value.returnData?.data ?? [];
      if (data) {
        const buffer = Buffer.from(data, encoding as BufferEncoding);
        minimumDistributableFee =
          PUMP_SDK.decodeMinimumDistributableFee(buffer);
      }
    }

    return {
      ...minimumDistributableFee,
      isGraduated,
    };
  }

  /**
   * Gets the instructions to distribute creator fees for a token's fee sharing configuration.
   *
   * This method handles both graduated (AMM) and non-graduated (bonding curve) tokens.
   * For graduated tokens, it automatically includes an instruction to consolidate fees
   * from the AMM vault before distributing.
   *
   * @param mint - The mint address of the token
   * @returns The instructions to distribute creator fees and whether the token is graduated
   */
  async buildDistributeCreatorFeesInstructions(
    mint: PublicKey,
  ): Promise<DistributeCreatorFeeResult> {
    const sharingConfigPubkey = feeSharingConfigPda(mint);
    const poolAddress = canonicalPumpPoolPda(mint);
    const coinCreatorVaultAuthority =
      coinCreatorVaultAuthorityPda(sharingConfigPubkey);
    const ammVaultAta = coinCreatorVaultAtaPda(
      coinCreatorVaultAuthority,
      NATIVE_MINT,
      TOKEN_PROGRAM_ID,
    );

    const [sharingConfigAccountInfo, poolAccountInfo, ammVaultAtaInfo] =
      await this.connection.getMultipleAccountsInfo([
        sharingConfigPubkey,
        poolAddress,
        ammVaultAta,
      ]);

    if (!sharingConfigAccountInfo) {
      throw new Error(`Sharing config not found for mint: ${mint.toBase58()}`);
    }

    const sharingConfig = PUMP_SDK.decodeSharingConfig(
      sharingConfigAccountInfo,
    );

    const instructions: TransactionInstruction[] = [];

    const isGraduated = poolAccountInfo !== null;
    if (isGraduated && ammVaultAtaInfo) {
      // Consolidate fees from AMM to bonding curve program for distribution
      const transferCreatorFeesToPumpIx = await this.pumpAmmProgram.methods
        .transferCreatorFeesToPump()
        .accountsPartial({
          wsolMint: NATIVE_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
          coinCreator: sharingConfigPubkey,
        })
        .instruction();
      instructions.push(transferCreatorFeesToPumpIx);
    }

    const distributeCreatorFeesIx = await PUMP_SDK.distributeCreatorFees({
      mint,
      sharingConfig,
      sharingConfigAddress: sharingConfigPubkey,
    });
    instructions.push(distributeCreatorFeesIx);

    return {
      instructions,
      isGraduated,
    };
  }
}

export interface MinimumDistributableFeeResult extends MinimumDistributableFeeEvent {
  isGraduated: boolean;
}

export interface DistributeCreatorFeeResult {
  instructions: TransactionInstruction[];
  isGraduated: boolean;
}

