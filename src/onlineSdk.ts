import { Program } from "@coral-xyz/anchor";
import {
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  PumpAmmAdminSdk,
} from "@pump-fun/pump-swap-sdk";
import {
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  AccountInfo,
  Connection,
  PublicKey,
  PublicKeyInitData,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";

import {
  calculateBuyPriceImpact,
  calculateSellPriceImpact,
  getBondingCurveSummary,
  getGraduationProgress,
  getTokenPrice,
} from "./analytics";
import type {
  BondingCurveSummary,
  GraduationProgress,
  PriceImpactResult,
  TokenPriceInfo,
} from "./analytics";
import { Pump } from "./idl/pump";
import { PumpAmm } from "./idl/pump_amm";
import { PumpFees } from "./idl/pump_fees";
import {
  AMM_GLOBAL_CONFIG_PDA,
  bondingCurvePda,
  canonicalPumpPoolPda,
  creatorVaultPda,
  feeProgramGlobalPda,
  feeSharingConfigPda,
  GLOBAL_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  PUMP_FEE_CONFIG_PDA,
  socialFeePda,
  userVolumeAccumulatorPda,
} from "./pda";
import {
  getPumpAmmProgram,
  getPumpFeeProgram,
  getPumpProgram,
  PUMP_SDK,
  PUMP_TOKEN_MINT,
} from "./sdk";
import {
  AmmGlobalConfig,
  BondingCurve,
  FeeConfig,
  FeeProgramGlobal,
  Global,
  GlobalVolumeAccumulator,
  MinimumDistributableFeeEvent,
  Pool,
  SocialFeePda,
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
  private readonly pumpFeeProgram: Program<PumpFees>;
  private readonly pumpAmmSdk: OnlinePumpAmmSdk;
  private readonly pumpAmmAdminSdk: PumpAmmAdminSdk;

  constructor(connection: Connection) {
    this.connection = connection;

    this.pumpProgram = getPumpProgram(connection);
    this.offlinePumpProgram = OFFLINE_PUMP_PROGRAM;
    this.pumpAmmProgram = getPumpAmmProgram(connection);
    this.pumpFeeProgram = getPumpFeeProgram(connection);

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
    const accountInfos =
      await this.connection.getMultipleAccountsInfo([
        coinCreatorVaultAta,
        coinCreatorTokenAccount,
      ]);
    const coinCreatorVaultAtaAccountInfo = accountInfos[0] ?? null;
    const coinCreatorTokenAccountInfo = accountInfos[1] ?? null;

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

  // ── Analytics & Convenience ───────────────────────────────────────────

  /**
   * Fetch bonding curve state, global, and fee config, then return a full
   * summary including market cap, graduation progress, and token price.
   *
   * @param mint - The token mint address
   * @returns Comprehensive bonding curve summary
   */
  async fetchBondingCurveSummary(
    mint: PublicKeyInitData,
  ): Promise<BondingCurveSummary> {
    const mintPk = new PublicKey(mint);
    const [global, feeConfig, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchFeeConfig(),
      this.fetchBondingCurve(mintPk),
    ]);

    return getBondingCurveSummary({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
    });
  }

  /**
   * Fetch graduation progress for a token — how close it is to moving to AMM.
   *
   * @param mint - The token mint address
   * @returns Graduation progress details (0-10000 bps)
   */
  async fetchGraduationProgress(
    mint: PublicKeyInitData,
  ): Promise<GraduationProgress> {
    const [global, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchBondingCurve(mint),
    ]);
    return getGraduationProgress(global, bondingCurve);
  }

  /**
   * Fetch current token price (cost to buy/sell 1 whole token).
   *
   * @param mint - The token mint address
   * @returns Buy and sell price per token in lamports, plus market cap
   */
  async fetchTokenPrice(
    mint: PublicKeyInitData,
  ): Promise<TokenPriceInfo> {
    const mintPk = new PublicKey(mint);
    const [global, feeConfig, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchFeeConfig(),
      this.fetchBondingCurve(mintPk),
    ]);

    return getTokenPrice({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
    });
  }

  /**
   * Calculate price impact for a buy trade on a specific token.
   *
   * @param mint - Token mint address
   * @param solAmount - SOL to spend in lamports
   * @returns Price impact details including before/after prices and impact in bps
   */
  async fetchBuyPriceImpact(
    mint: PublicKeyInitData,
    solAmount: BN,
  ): Promise<PriceImpactResult> {
    const mintPk = new PublicKey(mint);
    const [global, feeConfig, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchFeeConfig(),
      this.fetchBondingCurve(mintPk),
    ]);

    return calculateBuyPriceImpact({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      solAmount,
    });
  }

  /**
   * Calculate price impact for a sell trade on a specific token.
   *
   * @param mint - Token mint address
   * @param tokenAmount - Token amount to sell (raw units)
   * @returns Price impact details including before/after prices and impact in bps
   */
  async fetchSellPriceImpact(
    mint: PublicKeyInitData,
    tokenAmount: BN,
  ): Promise<PriceImpactResult> {
    const mintPk = new PublicKey(mint);
    const [global, feeConfig, bondingCurve] = await Promise.all([
      this.fetchGlobal(),
      this.fetchFeeConfig(),
      this.fetchBondingCurve(mintPk),
    ]);

    return calculateSellPriceImpact({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      tokenAmount,
    });
  }

  /**
   * Build instructions to sell a user's entire token balance and close the ATA
   * to reclaim rent.
   *
   * @param mint - Token mint address
   * @param user - User wallet public key
   * @param slippage - Slippage tolerance in percent (default: 1%)
   * @param tokenProgram - Token program (default: TOKEN_PROGRAM_ID)
   * @returns Sell + close ATA instructions, or empty array if user has no balance
   */
  async sellAllInstructions({
    mint,
    user,
    slippage = 1,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    mint: PublicKey;
    user: PublicKey;
    slippage?: number;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const associatedUser = getAssociatedTokenAddressSync(
      mint,
      user,
      true,
      tokenProgram,
    );

    const [bondingCurveAccountInfo, accountInfo, globalState] =
      await Promise.all([
        this.connection.getAccountInfo(bondingCurvePda(mint)),
        this.connection.getAccountInfo(associatedUser),
        this.fetchGlobal(),
      ]);

    if (!bondingCurveAccountInfo) {
      throw new Error(
        `Bonding curve account not found for mint: ${mint.toBase58()}`,
      );
    }

    if (!accountInfo) {
      return []; // No token account — nothing to sell
    }

    // Parse the token balance from the account data
    // SPL Token account data layout: mint (32) + owner (32) + amount (8)
    const amount = new BN(accountInfo.data.subarray(64, 72), "le");
    if (amount.isZero()) {
      // Zero balance — just close the account to reclaim rent
      return [
        createCloseAccountInstruction(
          associatedUser,
          user,
          user,
          [],
          tokenProgram,
        ),
      ];
    }

    const bondingCurve = PUMP_SDK.decodeBondingCurve(bondingCurveAccountInfo);
    const feeConfig = await this.fetchFeeConfig();

    const solAmount = (await import("./bondingCurve")).getSellSolAmountFromTokenAmount({
      global: globalState,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      amount,
    });

    const sellIxs = await PUMP_SDK.sellInstructions({
      global: globalState,
      bondingCurveAccountInfo,
      bondingCurve,
      mint,
      user,
      amount,
      solAmount,
      slippage,
      tokenProgram,
      mayhemMode: bondingCurve.isMayhemMode,
    });

    // Close the ATA after selling to reclaim rent
    sellIxs.push(
      createCloseAccountInstruction(
        associatedUser,
        user,
        user,
        [],
        tokenProgram,
      ),
    );

    return sellIxs;
  }

  /**
   * Check if a token has graduated to the AMM by checking if its
   * canonical pool account exists on-chain.
   *
   * @param mint - Token mint address
   * @returns true if the token has a live AMM pool
   */
  async isGraduated(mint: PublicKeyInitData): Promise<boolean> {
    const poolAddress = canonicalPumpPoolPda(new PublicKey(mint));
    const accountInfo = await this.connection.getAccountInfo(poolAddress);
    return accountInfo !== null;
  }

  // ─── AMM / Fee Program Fetchers ──────────────────────────────────────

  /**
   * Fetch a graduated AMM pool account by mint address.
   */
  async fetchPool(mint: PublicKeyInitData): Promise<Pool> {
    const poolAddress = canonicalPumpPoolPda(new PublicKey(mint));
    return await this.pumpAmmProgram.account.pool.fetch(poolAddress);
  }

  /**
   * Fetch a graduated AMM pool account by pool address.
   */
  async fetchPoolByAddress(poolAddress: PublicKeyInitData): Promise<Pool> {
    return await this.pumpAmmProgram.account.pool.fetch(
      new PublicKey(poolAddress),
    );
  }

  /**
   * Fetch the AMM global config account.
   */
  async fetchAmmGlobalConfig(): Promise<AmmGlobalConfig> {
    return await this.pumpAmmProgram.account.globalConfig.fetch(
      AMM_GLOBAL_CONFIG_PDA,
    );
  }

  /**
   * Fetch the PumpFees program global account.
   */
  async fetchFeeProgramGlobal(): Promise<FeeProgramGlobal> {
    return await (this.pumpFeeProgram.account as any).feeProgramGlobal.fetch(
      feeProgramGlobalPda(),
    );
  }

  /**
   * Fetch a social fee PDA account by user ID and platform.
   */
  async fetchSocialFeePda(
    userId: string,
    platform: number,
  ): Promise<SocialFeePda> {
    return await (this.pumpFeeProgram.account as any).socialFeePda.fetch(
      socialFeePda(userId, platform),
    );
  }

  /**
   * Get a user's token balance for a specific mint.
   *
   * @param mint - Token mint address
   * @param user - User wallet public key
   * @param tokenProgram - Token program (default: TOKEN_PROGRAM_ID)
   * @returns Token balance in raw units, or BN(0) if no account exists
   */
  async getTokenBalance(
    mint: PublicKey,
    user: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ): Promise<BN> {
    const ata = getAssociatedTokenAddressSync(mint, user, true, tokenProgram);
    const accountInfo = await this.connection.getAccountInfo(ata);
    if (!accountInfo) return new BN(0);
    // SPL Token account data layout: mint (32) + owner (32) + amount (8)
    return new BN(accountInfo.data.subarray(64, 72), "le");
  }
}

export interface MinimumDistributableFeeResult extends MinimumDistributableFeeEvent {
  isGraduated: boolean;
}

export interface DistributeCreatorFeeResult {
  instructions: TransactionInstruction[];
  isGraduated: boolean;
}

