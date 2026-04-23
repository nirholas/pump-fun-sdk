import { Program } from "@coral-xyz/anchor";
import {
  buyQuoteInput,
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  PumpAmmAdminSdk,
  sellBaseInput,
  type DepositBaseResult,
  type DepositQuoteResult,
  type WithdrawResult,
  type WithdrawAutocompleteResult,
  type DepositQuoteAndLpTokenFromBaseResult,
  type DepositBaseAndLpTokenFromQuoteResult,
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
import {
  getBuyTokenAmountFromSolAmount,
  getTokenAmountForTargetSol,
  getSellSolAmountFromTokenAmount,
  maxSafeSellAmount,
  validateSellAmount,
} from "./bondingCurve";
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
import { computeFeesBps } from "./fees";
import {
  getPumpAmmProgram,
  getPumpFeeProgram,
  getPumpProgram,
  PUMP_SDK,
  PUMP_TOKEN_MINT,
} from "./sdk";
import {
  AdminSetCreatorEvent,
  AmmBuyEvent,
  AmmGlobalConfig,
  AmmSellEvent,
  BondingCurve,
  ClaimCashbackEvent,
  ClaimTokenIncentivesEvent,
  CloseUserVolumeAccumulatorEvent,
  CollectCreatorFeeEvent,
  CompleteEvent,
  CompletePumpAmmMigrationEvent,
  CreateEvent,
  CreateFeeSharingConfigEvent,
  CreatePoolEvent,
  DepositEvent,
  DistributeCreatorFeesEvent,
  ExtendAccountEvent,
  FeeConfig,
  FeeProgramGlobal,
  Global,
  GlobalVolumeAccumulator,
  InitUserVolumeAccumulatorEvent,
  MigrateBondingCurveCreatorEvent,
  MinimumDistributableFeeEvent,
  Pool,
  ResetFeeSharingConfigEvent,
  RevokeFeeSharingAuthorityEvent,
  SetCreatorEvent,
  SocialFeePda,
  SocialFeePdaClaimedEvent,
  SocialFeePdaCreatedEvent,
  SyncUserVolumeAccumulatorEvent,
  TradeEvent,
  TransferFeeSharingAuthorityEvent,
  UpdateFeeSharesEvent,
  UserVolumeAccumulator,
  UserVolumeAccumulatorTotalStats,
  WithdrawEvent,
} from "./state";
import { currentDayTokens, totalUnclaimedTokens } from "./tokenIncentives";
import {
  createFallbackConnection,
  type FallbackConfig,
} from "./fallback";

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

  /**
   * Create an OnlinePumpSdk with automatic RPC failover.
   *
   * @example
   * ```ts
   * const sdk = OnlinePumpSdk.withFallback([
   *   'https://my-primary-rpc.com',
   *   'https://api.mainnet-beta.solana.com',
   * ]);
   * ```
   */
  static withFallback(
    endpoints: string[],
    connectionConfig?: import("@solana/web3.js").ConnectionConfig,
    fallbackConfig?: FallbackConfig,
  ): OnlinePumpSdk {
    const connection = createFallbackConnection(
      endpoints,
      connectionConfig,
      fallbackConfig,
    );
    return new OnlinePumpSdk(connection);
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
    tokenProgram?: PublicKey,
  ) {
    // Auto-detect token program from mint account owner if not provided
    if (!tokenProgram) {
      const mintInfo = await this.connection.getAccountInfo(mint);
      tokenProgram = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;
    }

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
    return { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo: associatedUserAccountInfo ?? null, tokenProgram };
  }

  async fetchSellState(
    mint: PublicKey,
    user: PublicKey,
    tokenProgram?: PublicKey,
  ) {
    // Auto-detect token program from mint account owner if not provided
    if (!tokenProgram) {
      const mintInfo = await this.connection.getAccountInfo(mint);
      tokenProgram = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;
    }

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
    return { bondingCurveAccountInfo, bondingCurve, tokenProgram };
  }

  /**
   * Fetch required state and build instructions to buy tokens on the bonding curve.
   *
   * Convenience wrapper that calls `fetchGlobal()` and delegates to `PUMP_SDK.buyInstructions()`.
   * Use this when you already have the result of `fetchBuyState()`.
   *
   * @param params - Buy parameters (spread fetchBuyState result + mint, user, amount, solAmount, slippage)
   * @returns TransactionInstruction[] — compose into a transaction and send
   */
  async buyInstructions({
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
    bondingCurveAccountInfo: AccountInfo<Buffer>;
    bondingCurve: BondingCurve;
    associatedUserAccountInfo: AccountInfo<Buffer> | null;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const global = await this.fetchGlobal();
    return PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo,
      bondingCurve,
      associatedUserAccountInfo,
      mint,
      user,
      amount,
      solAmount,
      slippage,
      tokenProgram,
    });
  }

  /**
   * Fetch required state and build instructions to sell tokens on the bonding curve.
   *
   * Convenience wrapper that calls `fetchGlobal()` and delegates to `PUMP_SDK.sellInstructions()`.
   * Use this when you already have the result of `fetchSellState()`.
   *
   * @param params - Sell parameters (spread fetchSellState result + mint, user, amount, solAmount, slippage)
   * @returns TransactionInstruction[] — compose into a transaction and send
   */
  async sellInstructions({
    bondingCurveAccountInfo,
    bondingCurve,
    mint,
    user,
    amount,
    solAmount,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
    cashback = false,
  }: {
    bondingCurveAccountInfo: AccountInfo<Buffer>;
    bondingCurve: BondingCurve;
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    solAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    cashback?: boolean;
  }): Promise<TransactionInstruction[]> {
    const global = await this.fetchGlobal();
    return PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo,
      bondingCurve,
      mint,
      user,
      amount,
      solAmount,
      slippage,
      tokenProgram,
      cashback,
    });
  }

  /**
   * Sell `totalAmount` tokens, splitting into multiple transactions when the
   * amount would overflow the on-chain u64 multiply (AnchorError 6024).
   *
   * Each chunk is sent via the caller-provided `sendTx`. State is refetched
   * between chunks so reserves — and therefore the max safe chunk size —
   * stay current as earlier chunks land.
   *
   * Returns the signature of every chunk in order.
   */
  async sellChunked({
    mint,
    user,
    totalAmount,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
    cashback = false,
    sendTx,
  }: {
    mint: PublicKey;
    user: PublicKey;
    totalAmount: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    cashback?: boolean;
    sendTx: (ixs: TransactionInstruction[]) => Promise<string>;
  }): Promise<string[]> {
    const signatures: string[] = [];
    let remaining = totalAmount;

    while (remaining.gtn(0)) {
      const [sellState, global, feeConfig] = await Promise.all([
        this.fetchSellState(mint, user, tokenProgram),
        this.fetchGlobal(),
        this.fetchFeeConfig(),
      ]);

      const maxChunk = maxSafeSellAmount(sellState.bondingCurve.virtualSolReserves);
      const chunk = remaining.lte(maxChunk) ? remaining : maxChunk;

      const solAmount = getSellSolAmountFromTokenAmount({
        global,
        feeConfig,
        mintSupply: sellState.bondingCurve.tokenTotalSupply,
        bondingCurve: sellState.bondingCurve,
        amount: chunk,
      });

      const ixs = await PUMP_SDK.sellInstructions({
        global,
        bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
        bondingCurve: sellState.bondingCurve,
        mint,
        user,
        amount: chunk,
        solAmount,
        slippage,
        tokenProgram,
        cashback,
      });

      signatures.push(await sendTx(ixs));
      remaining = remaining.sub(chunk);
    }

    return signatures;
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
    tokenProgram,
  }: {
    mint: PublicKey;
    user: PublicKey;
    slippage?: number;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    // Auto-detect token program from mint account owner when not provided
    if (!tokenProgram) {
      const mintInfo = await this.connection.getAccountInfo(mint);
      tokenProgram = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;
    }

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

    const solAmount = getSellSolAmountFromTokenAmount({
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
   * Fetch all state and produce a full pre-trade sell quote.
   *
   * Returns the net SOL out, fees deducted, price impact, the max single-tx
   * safe sell amount, and whether the requested amount would overflow.
   *
   * @param mint - Token mint address
   * @param user - Seller wallet
   * @param amount - Token amount to quote (raw units)
   * @param tokenProgram - Token program (default: TOKEN_PROGRAM_ID)
   */
  async quoteBuy({
    mint,
    user,
    solAmount,
  }: {
    mint: PublicKey;
    user: PublicKey;
    solAmount: BN;
  }): Promise<BuyQuote> {
    const [buyState, global, feeConfig] = await Promise.all([
      this.fetchBuyState(mint, user),
      this.fetchGlobal(),
      this.fetchFeeConfig(),
    ]);

    const { bondingCurve } = buyState;
    const impact = calculateBuyPriceImpact({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      solAmount,
    });

    // Fee = sol * totalFeeBps / (totalFeeBps + 10_000)
    // This follows from: fee = netInput * totalFeeBps/10_000, netInput + fee = solAmount
    const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      virtualSolReserves: bondingCurve.virtualSolReserves,
      virtualTokenReserves: bondingCurve.virtualTokenReserves,
    });
    const isCreatorSet = !bondingCurve.creator.equals(PublicKey.default);
    const totalFeeBps = protocolFeeBps.add(isCreatorSet ? creatorFeeBps : new BN(0));
    const feesLamports = totalFeeBps.isZero()
      ? new BN(0)
      : solAmount.mul(totalFeeBps).div(totalFeeBps.addn(10_000));

    return {
      tokensOut: impact.outputAmount,
      feesLamports,
      priceImpactBps: impact.impactBps,
      priceAfter: impact.priceAfter,
      priceBefore: impact.priceBefore,
    };
  }

  /**
   * Buy tokens by specifying a SOL amount to spend.
   *
   * Combines `fetchBuyState`, bonding curve math, and `buyInstructions` into
   * a single call. Useful when you know the SOL budget and want the SDK to
   * compute the expected token output automatically.
   *
   * @param mint - Token mint address
   * @param user - Buyer wallet
   * @param solAmount - SOL to spend in lamports
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async buyBySolAmount({
    mint,
    user,
    solAmount,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    solAmount: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const [buyState, global, feeConfig] = await Promise.all([
      this.fetchBuyState(mint, user),
      this.fetchGlobal(),
      this.fetchFeeConfig(),
    ]);

    const tokensOut = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: buyState.bondingCurve.tokenTotalSupply,
      bondingCurve: buyState.bondingCurve,
      amount: solAmount,
    });

    return PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
      bondingCurve: buyState.bondingCurve,
      associatedUserAccountInfo: buyState.associatedUserAccountInfo,
      mint,
      user,
      amount: tokensOut,
      solAmount,
      slippage,
      tokenProgram: buyState.tokenProgram,
    });
  }

  /**
   * Buy tokens, automatically routing to the bonding curve or PumpAMM pool
   * depending on whether the token has graduated.
   *
   * - Bonding curve: uses the standard buy flow with slippage-protected quote
   * - AMM: computes `minBaseAmountOut` via `buyQuoteInput` and delegates to
   *   `PUMP_AMM_SDK.buyInstructions`
   *
   * @param mint - Token mint address
   * @param user - Buyer wallet
   * @param quoteAmountIn - SOL to spend in lamports
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async routedBuyInstructions({
    mint,
    user,
    quoteAmountIn,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    quoteAmountIn: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const [buyState, global, feeConfig] = await Promise.all([
      this.fetchBuyState(mint, user),
      this.fetchGlobal(),
      this.fetchFeeConfig(),
    ]);

    if (buyState.bondingCurve.complete) {
      const swapState = await this.pumpAmmSdk.swapSolanaState(
        canonicalPumpPoolPda(mint),
        user,
      );
      // slippage * 100: PUMP_AMM_SDK expects percentage (1 = 1%), not decimal
      return PUMP_AMM_SDK.buyQuoteInput(swapState, quoteAmountIn, slippage * 100);
    }

    // Still on bonding curve
    const tokensOut = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: buyState.bondingCurve.tokenTotalSupply,
      bondingCurve: buyState.bondingCurve,
      amount: quoteAmountIn,
    });

    return PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
      bondingCurve: buyState.bondingCurve,
      associatedUserAccountInfo: buyState.associatedUserAccountInfo,
      mint,
      user,
      amount: tokensOut,
      solAmount: quoteAmountIn,
      slippage,
      tokenProgram: buyState.tokenProgram,
    });
  }

  /**
   * Sell tokens, automatically routing to the bonding curve or PumpAMM pool
   * depending on whether the token has graduated.
   *
   * - Bonding curve: uses the standard sell flow with slippage-protected quote
   * - AMM: computes `minQuoteAmountOut` from constant-product math and delegates
   *   to `PUMP_AMM_SDK.sellInstructions`
   *
   * @param mint - Token mint address
   * @param user - Seller wallet
   * @param baseAmountIn - Token amount to sell (raw units)
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   * @param cashback - Opt in to cashback (default: false)
   * @param tokenProgram - Token program (default: auto-detected)
   */
  async routedSellInstructions({
    mint,
    user,
    baseAmountIn,
    slippage,
    cashback = false,
    tokenProgram,
  }: {
    mint: PublicKey;
    user: PublicKey;
    baseAmountIn: BN;
    slippage: number;
    cashback?: boolean;
    tokenProgram?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const [sellState, global, feeConfig] = await Promise.all([
      this.fetchSellState(mint, user, tokenProgram),
      this.fetchGlobal(),
      this.fetchFeeConfig(),
    ]);

    if (sellState.bondingCurve.complete) {
      const swapState = await this.pumpAmmSdk.swapSolanaState(
        canonicalPumpPoolPda(mint),
        user,
      );
      return PUMP_AMM_SDK.sellBaseInput(swapState, baseAmountIn, slippage * 100);
    }

    // Still on bonding curve
    const solAmount = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: sellState.bondingCurve.tokenTotalSupply,
      bondingCurve: sellState.bondingCurve,
      amount: baseAmountIn,
    });

    return PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint,
      user,
      amount: baseAmountIn,
      solAmount,
      slippage,
      tokenProgram: sellState.tokenProgram,
      cashback,
    });
  }

  /**
   * Fetch bonding curves for multiple mints in a single RPC call.
   *
   * Returns a `Map<mintBase58, BondingCurve | null>` — `null` means the
   * account does not exist on-chain. Ordering is preserved relative to
   * the input array.
   *
   * @param mints - Array of token mint public keys
   */
  async fetchMultipleBondingCurves(
    mints: PublicKey[],
  ): Promise<Map<string, BondingCurve | null>> {
    const pdas = mints.map((m) => bondingCurvePda(m));
    const accounts = await this.connection.getMultipleAccountsInfo(pdas);
    const result = new Map<string, BondingCurve | null>();
    for (let i = 0; i < mints.length; i++) {
      const mint = mints[i];
      const info = accounts[i];
      if (!mint) continue;
      result.set(
        mint.toBase58(),
        info ? PUMP_SDK.decodeBondingCurve(info) : null,
      );
    }
    return result;
  }

  /**
   * Fetch a confirmed transaction and decode every Pump program event from its
   * logs. Events from all three programs (Pump, PumpAMM, PumpFees) are
   * included. Unrecognised log entries are silently skipped.
   *
   * @param signature - Transaction signature to parse
   * @param commitment - Commitment level (default: "confirmed")
   * @returns Array of strongly-typed events in log order
   */
  async parseTransactionEvents(
    signature: string,
    commitment: "confirmed" | "finalized" = "confirmed",
  ): Promise<PumpEvent[]> {
    const tx = await this.connection.getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta?.logMessages) return [];

    const events: PumpEvent[] = [];
    for (const log of tx.meta.logMessages) {
      if (!log.startsWith("Program data: ")) continue;
      const data = Buffer.from(log.slice("Program data: ".length), "base64");
      if (data.length < 8) continue;
      const decoded = tryDecodePumpEvent(data);
      if (decoded) events.push(decoded);
    }
    return events;
  }

  async quoteSell({
    mint,
    user,
    amount,
    tokenProgram,
  }: {
    mint: PublicKey;
    user: PublicKey;
    amount: BN;
    tokenProgram?: PublicKey;
  }): Promise<SellQuote> {
    const [sellState, global, feeConfig] = await Promise.all([
      this.fetchSellState(mint, user, tokenProgram),
      this.fetchGlobal(),
      this.fetchFeeConfig(),
    ]);

    const { bondingCurve } = sellState;
    const impact = calculateSellPriceImpact({
      global,
      feeConfig,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      tokenAmount: amount,
    });

    // Gross SOL before fees: amount * vSol / (vToken + amount)
    const grossSol = bondingCurve.virtualTokenReserves.add(amount).isZero()
      ? new BN(0)
      : amount
          .mul(bondingCurve.virtualSolReserves)
          .div(bondingCurve.virtualTokenReserves.add(amount));

    const feesLamports = BN.max(new BN(0), grossSol.sub(impact.outputAmount));
    const maxSafeAmount = maxSafeSellAmount(bondingCurve.virtualSolReserves);

    return {
      solOut: impact.outputAmount,
      feesLamports,
      priceImpactBps: impact.impactBps,
      priceBefore: impact.priceBefore,
      priceAfter: impact.priceAfter,
      maxSafeAmount,
      willOverflow: amount.gt(maxSafeAmount),
    };
  }

  /**
   * Build sell instructions for a percentage of the user's current balance.
   *
   * @param mint - Token mint address
   * @param user - Seller wallet
   * @param percent - Percentage to sell, 0–100 (decimals accepted, e.g. 33.5)
   * @param slippage - Slippage tolerance in percent (e.g. 0.05 for 5%)
   * @param tokenProgram - Token program (default: TOKEN_PROGRAM_ID)
   * @param cashback - Enable cashback volume tracking (default: false)
   * @returns TransactionInstruction[] — empty if balance is zero
   */
  async sellByPercentage({
    mint,
    user,
    percent,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
    cashback = false,
  }: {
    mint: PublicKey;
    user: PublicKey;
    percent: number;
    slippage: number;
    tokenProgram?: PublicKey;
    cashback?: boolean;
  }): Promise<TransactionInstruction[]> {
    if (percent <= 0 || percent > 100) {
      throw new Error(`percent must be between 0 (exclusive) and 100, got ${percent}`);
    }

    const balance = await this.getTokenBalance(mint, user, tokenProgram);
    if (balance.isZero()) return [];

    // Scale to avoid floating-point truncation: work in basis points
    const bps = Math.round(percent * 100);
    const amount = balance.muln(bps).divn(10_000);
    if (amount.isZero()) return [];

    const [sellState, global, feeConfig] = await Promise.all([
      this.fetchSellState(mint, user, tokenProgram),
      this.fetchGlobal(),
      this.fetchFeeConfig(),
    ]);

    const solAmount = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: sellState.bondingCurve.tokenTotalSupply,
      bondingCurve: sellState.bondingCurve,
      amount,
    });

    return PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint,
      user,
      amount,
      solAmount,
      slippage,
      tokenProgram,
      cashback,
    });
  }

  /**
   * Build sell instructions that yield approximately `targetSol` lamports.
   *
   * Uses binary search over the bonding curve quote to find the minimum token
   * amount that produces at least `targetSol` after fees. The result is
   * bounded by `maxSafeSellAmount`, so it is always safe for a single tx.
   * If the full safe limit is still less than `targetSol`, the limit is used
   * and you'll receive less than requested — check `quoteSell` first.
   *
   * @param mint - Token mint address
   * @param user - Seller wallet
   * @param targetSol - Desired SOL out in lamports
   * @param slippage - Slippage tolerance in percent
   * @param tokenProgram - Token program (default: TOKEN_PROGRAM_ID)
   * @param cashback - Enable cashback volume tracking (default: false)
   */
  async sellToTargetSol({
    mint,
    user,
    targetSol,
    slippage,
    tokenProgram = TOKEN_PROGRAM_ID,
    cashback = false,
  }: {
    mint: PublicKey;
    user: PublicKey;
    targetSol: BN;
    slippage: number;
    tokenProgram?: PublicKey;
    cashback?: boolean;
  }): Promise<TransactionInstruction[]> {
    const [sellState, global, feeConfig] = await Promise.all([
      this.fetchSellState(mint, user, tokenProgram),
      this.fetchGlobal(),
      this.fetchFeeConfig(),
    ]);

    const amount = getTokenAmountForTargetSol({
      global,
      feeConfig,
      mintSupply: sellState.bondingCurve.tokenTotalSupply,
      bondingCurve: sellState.bondingCurve,
      targetSol,
    });

    if (amount.isZero()) return [];

    validateSellAmount(amount, sellState.bondingCurve);

    const solAmount = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: sellState.bondingCurve.tokenTotalSupply,
      bondingCurve: sellState.bondingCurve,
      amount,
    });

    return PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint,
      user,
      amount,
      solAmount,
      slippage,
      tokenProgram,
      cashback,
    });
  }

  // ─── AMM Trading Wrappers ────────────────────────────────────────────

  /**
   * Buy tokens on a graduated AMM pool.
   *
   * Accepts either the high-level `{ solAmount, slippageBps }` form used in
   * tutorials, or the low-level `{ quoteAmountIn, minBaseAmountOut }` form for
   * callers that have already computed slippage externally.
   *
   * @param mint        - Token mint (must be graduated)
   * @param user        - Buyer wallet
   * @param solAmount   - SOL to spend in lamports (alias: quoteAmountIn)
   * @param slippageBps - Slippage tolerance in basis points (e.g. 500 = 5%)
   */
  async ammBuyInstructions({
    mint,
    user,
    solAmount,
    quoteAmountIn,
    slippageBps,
    slippage,
    minBaseAmountOut,
  }: {
    mint: PublicKey;
    user: PublicKey;
    solAmount?: BN;
    quoteAmountIn?: BN;
    slippageBps?: number;
    slippage?: number;
    minBaseAmountOut?: BN;
  }): Promise<TransactionInstruction[]> {
    const quoteIn = solAmount ?? quoteAmountIn;
    if (!quoteIn) throw new Error("ammBuyInstructions: solAmount is required");
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.swapSolanaState(poolKey, user);
    if (minBaseAmountOut !== undefined) {
      return PUMP_AMM_SDK.buyInstructions(state, minBaseAmountOut, quoteIn);
    }
    const slippagePct =
      slippageBps !== undefined ? slippageBps / 100 : (slippage ?? 0.01) * 100;
    return PUMP_AMM_SDK.buyQuoteInput(state, quoteIn, slippagePct);
  }

  /**
   * Sell tokens on a graduated AMM pool.
   *
   * Accepts either the high-level `{ tokenAmount, slippageBps }` form or the
   * low-level `{ baseAmountIn, minQuoteAmountOut }` form.
   *
   * @param mint        - Token mint (must be graduated)
   * @param user        - Seller wallet
   * @param tokenAmount - Tokens to sell in raw units (alias: baseAmountIn)
   * @param slippageBps - Slippage tolerance in basis points (e.g. 500 = 5%)
   */
  async ammSellInstructions({
    mint,
    user,
    tokenAmount,
    baseAmountIn,
    slippageBps,
    slippage,
    minQuoteAmountOut,
  }: {
    mint: PublicKey;
    user: PublicKey;
    tokenAmount?: BN;
    baseAmountIn?: BN;
    slippageBps?: number;
    slippage?: number;
    minQuoteAmountOut?: BN;
  }): Promise<TransactionInstruction[]> {
    const baseIn = tokenAmount ?? baseAmountIn;
    if (!baseIn) throw new Error("ammSellInstructions: tokenAmount is required");
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.swapSolanaState(poolKey, user);
    if (minQuoteAmountOut !== undefined) {
      return PUMP_AMM_SDK.sellInstructions(state, baseIn, minQuoteAmountOut);
    }
    const slippagePct =
      slippageBps !== undefined ? slippageBps / 100 : (slippage ?? 0.01) * 100;
    return PUMP_AMM_SDK.sellBaseInput(state, baseIn, slippagePct);
  }

  // ─── AMM Liquidity Operations ─────────────────────────────────────────

  /**
   * Deposit liquidity into a graduated AMM pool.
   * Specify the exact LP token amount you want out; slippage guards max base/quote in.
   */
  async ammDepositInstructions({
    mint,
    user,
    lpTokenOut,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    lpTokenOut: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.depositInstructions(state, lpTokenOut, slippage);
  }

  /**
   * Withdraw liquidity from a graduated AMM pool.
   * Specify the LP token amount to burn; slippage guards min base/quote out.
   */
  async ammWithdrawInstructions({
    mint,
    user,
    lpTokenIn,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    lpTokenIn: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.withdrawInstructions(state, lpTokenIn, slippage);
  }

  /**
   * Quote a deposit using base token amount as input.
   * Returns the quote amount and LP tokens you'll receive, plus slippage-adjusted maxes.
   */
  async quoteAmmDepositBaseIn({
    mint,
    user,
    base,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    base: BN;
    slippage: number;
  }): Promise<DepositBaseResult> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.depositBaseInput(state, base, slippage);
  }

  /**
   * Quote a deposit using quote (SOL) amount as input.
   * Returns the base tokens and LP tokens you'll receive, plus slippage-adjusted maxes.
   */
  async quoteAmmDepositQuoteIn({
    mint,
    user,
    quote,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    quote: BN;
    slippage: number;
  }): Promise<DepositQuoteResult> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.depositQuoteInput(state, quote, slippage);
  }

  /**
   * Quote how much base and quote (SOL) you'll receive for a given LP token burn.
   * Returns min amounts after slippage is applied.
   */
  async quoteAmmWithdraw({
    mint,
    user,
    lpToken,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    lpToken: BN;
    slippage: number;
  }): Promise<WithdrawResult> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.withdrawInputs(state, lpToken, slippage);
  }

  /**
   * UI autocomplete: given a base token input, calculate quote and LP out.
   * Does NOT include slippage maxes — use quoteAmmDepositBaseIn for those.
   */
  async ammDepositAutocompleteFromBase({
    mint,
    user,
    base,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    base: BN;
    slippage: number;
  }): Promise<DepositQuoteAndLpTokenFromBaseResult> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.depositAutocompleteQuoteAndLpTokenFromBase(
      state,
      base,
      slippage,
    );
  }

  /**
   * UI autocomplete: given a quote (SOL) input, calculate base and LP out.
   * Does NOT include slippage maxes — use quoteAmmDepositQuoteIn for those.
   */
  async ammDepositAutocompleteFromQuote({
    mint,
    user,
    quote,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    quote: BN;
    slippage: number;
  }): Promise<DepositBaseAndLpTokenFromQuoteResult> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.depositAutocompleteBaseAndLpTokenFromQuote(
      state,
      quote,
      slippage,
    );
  }

  /**
   * UI autocomplete: given an LP token amount to burn, calculate base and quote out.
   * Returns display amounts without slippage applied.
   */
  async ammWithdrawAutocomplete({
    mint,
    user,
    lpToken,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    lpToken: BN;
    slippage: number;
  }): Promise<WithdrawAutocompleteResult> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.withdrawAutoCompleteBaseAndQuoteFromLpToken(
      state,
      lpToken,
      slippage,
    );
  }

  /**
   * Get the user's LP token balance for a graduated pool.
   */
  async getLpTokenBalance(mint: PublicKey, user: PublicKey): Promise<BN> {
    const pool = await this.fetchPool(mint);
    return this.getTokenBalance(pool.lpMint, user, TOKEN_PROGRAM_ID);
  }

  /**
   * Buy tokens on a graduated AMM pool by specifying the SOL amount to spend.
   * Slippage, fee deduction, and wSOL wrapping are handled by PUMP_AMM_SDK internally.
   *
   * @param mint - Token mint (must be graduated)
   * @param user - Buyer wallet
   * @param quoteAmountIn - SOL to spend in lamports
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async ammBuyBySolAmount({
    mint,
    user,
    quoteAmountIn,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    quoteAmountIn: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const swapState = await this.pumpAmmSdk.swapSolanaState(
      canonicalPumpPoolPda(mint),
      user,
    );
    return PUMP_AMM_SDK.buyQuoteInput(swapState, quoteAmountIn, slippage * 100);
  }

  /**
   * Sell an exact token amount on a graduated AMM pool.
   * Min SOL output and wSOL unwrapping are handled by PUMP_AMM_SDK internally.
   *
   * @param mint - Token mint (must be graduated)
   * @param user - Seller wallet
   * @param baseAmountIn - Tokens to sell (raw units)
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async ammSellByTokenAmount({
    mint,
    user,
    baseAmountIn,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    baseAmountIn: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const swapState = await this.pumpAmmSdk.swapSolanaState(
      canonicalPumpPoolPda(mint),
      user,
    );
    return PUMP_AMM_SDK.sellBaseInput(swapState, baseAmountIn, slippage * 100);
  }

  /**
   * Pre-trade buy quote for a graduated AMM pool.
   * Computes expected tokens out and protocol fees using exact on-chain math,
   * without building any instructions.
   *
   * @param mint - Token mint (must be graduated)
   * @param user - Buyer wallet (needed to resolve swap state)
   * @param quoteAmountIn - SOL to spend in lamports
   */
  async ammQuoteBuy({
    mint,
    user,
    quoteAmountIn,
  }: {
    mint: PublicKey;
    user: PublicKey;
    quoteAmountIn: BN;
  }): Promise<AmmBuyQuote> {
    const swapState = await this.pumpAmmSdk.swapSolanaState(
      canonicalPumpPoolPda(mint),
      user,
    );
    const result = buyQuoteInput({
      quote: quoteAmountIn,
      slippage: 0,
      baseReserve: swapState.poolBaseAmount,
      quoteReserve: swapState.poolQuoteAmount,
      globalConfig: swapState.globalConfig,
      baseMintAccount: swapState.baseMintAccount,
      baseMint: mint,
      coinCreator: swapState.pool.coinCreator,
      creator: swapState.pool.creator,
      feeConfig: swapState.feeConfig,
    });
    return {
      tokensOut: result.base,
      solSpent: quoteAmountIn,
      feesLamports: BN.max(new BN(0), quoteAmountIn.sub(result.internalQuoteWithoutFees)),
      poolBaseAmount: swapState.poolBaseAmount,
      poolQuoteAmount: swapState.poolQuoteAmount,
    };
  }

  /**
   * Pre-trade sell quote for a graduated AMM pool.
   * Computes expected SOL out and protocol fees using exact on-chain math,
   * without building any instructions.
   *
   * @param mint - Token mint (must be graduated)
   * @param user - Seller wallet (needed to resolve swap state)
   * @param baseAmountIn - Tokens to sell (raw units)
   */
  async ammQuoteSell({
    mint,
    user,
    baseAmountIn,
  }: {
    mint: PublicKey;
    user: PublicKey;
    baseAmountIn: BN;
  }): Promise<AmmSellQuote> {
    const swapState = await this.pumpAmmSdk.swapSolanaState(
      canonicalPumpPoolPda(mint),
      user,
    );
    const result = sellBaseInput({
      base: baseAmountIn,
      slippage: 0,
      baseReserve: swapState.poolBaseAmount,
      quoteReserve: swapState.poolQuoteAmount,
      globalConfig: swapState.globalConfig,
      baseMintAccount: swapState.baseMintAccount,
      baseMint: mint,
      coinCreator: swapState.pool.coinCreator,
      creator: swapState.pool.creator,
      feeConfig: swapState.feeConfig,
    });
    return {
      solOut: result.uiQuote,
      tokensSold: baseAmountIn,
      feesLamports: BN.max(new BN(0), result.internalQuoteAmountOut.sub(result.uiQuote)),
      poolBaseAmount: swapState.poolBaseAmount,
      poolQuoteAmount: swapState.poolQuoteAmount,
    };
  }

  /**
   * Fetch AMM pools for multiple mints in a single RPC call.
   *
   * Returns a `Map<mintBase58, Pool | null>` — `null` means the token has not
   * graduated or the pool account does not exist. Ordering matches input array.
   *
   * @param mints - Array of token mint public keys
   */
  async fetchMultiplePools(mints: PublicKey[]): Promise<Map<string, Pool | null>> {
    const pdas = mints.map((m) => canonicalPumpPoolPda(m));
    const accounts = await this.connection.getMultipleAccountsInfo(pdas);
    const result = new Map<string, Pool | null>();
    for (let i = 0; i < mints.length; i++) {
      const mint = mints[i];
      const info = accounts[i];
      if (!mint) continue;
      result.set(mint.toBase58(), info ? PUMP_AMM_SDK.decodePool(info) : null);
    }
    return result;
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
   * Fetch the fee sharing config for a token mint. Throws if not found.
   *
   * A sharing config exists when the creator has set up multi-recipient fee
   * splitting via `createFeeSharingConfig`. Check `BondingCurve.creator` or
   * `Pool.coinCreator` — if it equals `feeSharingConfigPda(mint)`, the config
   * is active and this method will return it.
   */
  async fetchSharingConfig(mint: PublicKey) {
    const pda = feeSharingConfigPda(mint);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) {
      throw new Error(
        `Sharing config not found for mint: ${mint.toBase58()}. ` +
          `Use fetchSharingConfigNullable() if the config may not exist.`,
      );
    }
    return PUMP_SDK.decodeSharingConfig(accountInfo);
  }

  /**
   * Fetch the fee sharing config for a token mint, returning null if it doesn't exist.
   *
   * Safe to call regardless of whether the creator has set up fee sharing.
   */
  async fetchSharingConfigNullable(mint: PublicKey) {
    const accountInfo = await this.connection.getAccountInfo(
      feeSharingConfigPda(mint),
    );
    if (!accountInfo) return null;
    return PUMP_SDK.decodeSharingConfig(accountInfo);
  }

  /**
   * Fetch fee sharing configs for multiple mints in a single RPC call.
   * Returns a map from mint base58 → config (or null if the mint has no config).
   *
   * @example
   * const configs = await sdk.fetchMultipleSharingConfigs([mintA, mintB]);
   * for (const [mint, config] of configs) {
   *   if (config) console.log(mint, "has", config.shareholders.length, "shareholders");
   * }
   */
  async fetchMultipleSharingConfigs(mints: PublicKey[]) {
    const pdas = mints.map(feeSharingConfigPda);
    const accountInfos = await this.connection.getMultipleAccountsInfo(pdas);
    const result = new Map<string, ReturnType<typeof PUMP_SDK.decodeSharingConfig> | null>();
    for (const [i, mint] of mints.entries()) {
      const info = accountInfos[i];
      result.set(
        mint.toBase58(),
        info ? PUMP_SDK.decodeSharingConfig(info) : null,
      );
    }
    return result;
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

  // ─── AMM Liquidity (Deposit / Withdraw) ─────────────────────────────

  /**
   * Fetch the user's LP token balance for a graduated AMM pool.
   *
   * LP tokens are standard SPL tokens in the user's ATA for the pool's LP
   * mint. They represent a proportional share of the pool's base + quote
   * reserves.
   *
   * @param mint - The graduated token's mint address
   * @param user - User wallet
   */
  async fetchLpBalance(mint: PublicKey, user: PublicKey): Promise<BN> {
    const pool = await this.fetchPool(mint);
    return this.getTokenBalance(pool.lpMint, user, TOKEN_PROGRAM_ID);
  }

  /**
   * Quote a deposit into a graduated AMM pool, specifying how many base
   * tokens (the traded token) you want to contribute.
   *
   * Returns the proportional SOL (quote) required and the LP tokens you'd
   * receive. No transaction is built — use `depositByBaseAmount` to execute.
   *
   * @param mint - Token mint address
   * @param baseAmount - Base tokens to deposit (raw units)
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async quoteDepositByBase(
    mint: PublicKey,
    baseAmount: BN,
    slippage: number,
  ): Promise<DepositQuoteAndLpTokenFromBaseResult> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(
      poolKey,
      PublicKey.default,
    );
    return PUMP_AMM_SDK.depositAutocompleteQuoteAndLpTokenFromBase(
      state,
      baseAmount,
      slippage * 100,
    );
  }

  /**
   * Quote a withdrawal from a graduated AMM pool.
   *
   * Returns the minimum base (tokens) and quote (SOL) you'd receive for
   * burning `lpAmount` LP tokens at the current reserves. No transaction
   * is built — use `withdrawByLpAmount` to execute.
   *
   * @param mint - Token mint address
   * @param lpAmount - LP tokens to redeem
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async quoteWithdraw(
    mint: PublicKey,
    lpAmount: BN,
    slippage: number,
  ): Promise<WithdrawAutocompleteResult> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(
      poolKey,
      PublicKey.default,
    );
    return PUMP_AMM_SDK.withdrawAutoCompleteBaseAndQuoteFromLpToken(
      state,
      lpAmount,
      slippage * 100,
    );
  }

  /**
   * Build instructions to deposit liquidity into a graduated AMM pool,
   * specifying the base token (the graduated token) amount to contribute.
   *
   * The SDK computes the proportional SOL required from current reserves and
   * applies slippage tolerance to both inputs. Includes WSOL wrapping and
   * LP ATA creation if needed.
   *
   * @param mint - Token mint address
   * @param user - Depositor wallet
   * @param baseAmount - Base tokens to deposit (raw units)
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async depositByBaseAmount({
    mint,
    user,
    baseAmount,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    baseAmount: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    const { lpToken } = PUMP_AMM_SDK.depositAutocompleteQuoteAndLpTokenFromBase(
      state,
      baseAmount,
      slippage * 100,
    );
    return PUMP_AMM_SDK.depositInstructions(state, lpToken, slippage * 100);
  }

  /**
   * Build instructions to deposit liquidity into a graduated AMM pool,
   * specifying the SOL (quote) amount to contribute.
   *
   * The SDK computes the proportional base tokens required from current
   * reserves and applies slippage tolerance to both inputs. Includes WSOL
   * wrapping and LP ATA creation if needed.
   *
   * @param mint - Token mint address
   * @param user - Depositor wallet
   * @param quoteAmount - SOL to deposit in lamports
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async depositByQuoteAmount({
    mint,
    user,
    quoteAmount,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    quoteAmount: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    const { lpToken } = PUMP_AMM_SDK.depositAutocompleteBaseAndLpTokenFromQuote(
      state,
      quoteAmount,
      slippage * 100,
    );
    return PUMP_AMM_SDK.depositInstructions(state, lpToken, slippage * 100);
  }

  /**
   * Build instructions to withdraw liquidity from a graduated AMM pool.
   *
   * Burns lpAmount LP tokens and returns proportional base (tokens) and
   * quote (SOL) to the user's wallet, with WSOL unwrapping included.
   *
   * @param mint - Token mint address
   * @param user - Withdrawer wallet
   * @param lpAmount - LP tokens to redeem
   * @param slippage - Slippage tolerance as a decimal (0.01 = 1%)
   */
  async withdrawByLpAmount({
    mint,
    user,
    lpAmount,
    slippage,
  }: {
    mint: PublicKey;
    user: PublicKey;
    lpAmount: BN;
    slippage: number;
  }): Promise<TransactionInstruction[]> {
    const poolKey = canonicalPumpPoolPda(mint);
    const state = await this.pumpAmmSdk.liquiditySolanaState(poolKey, user);
    return PUMP_AMM_SDK.withdrawInstructions(state, lpAmount, slippage * 100);
  }
}

export type {
  DepositBaseResult,
  DepositQuoteResult,
  WithdrawResult,
  WithdrawAutocompleteResult,
  DepositQuoteAndLpTokenFromBaseResult,
  DepositBaseAndLpTokenFromQuoteResult,
} from "@pump-fun/pump-swap-sdk";

export interface MinimumDistributableFeeResult extends MinimumDistributableFeeEvent {
  isGraduated: boolean;
}

export interface DistributeCreatorFeeResult {
  instructions: TransactionInstruction[];
  isGraduated: boolean;
}

export interface AmmBuyQuote {
  /** Expected tokens received after all AMM fees, in raw token units. */
  tokensOut: BN;
  /** SOL spent (lamports). */
  solSpent: BN;
  /** Protocol + LP + creator fees deducted (lamports). */
  feesLamports: BN;
  /** Pool base token reserve at quote time. */
  poolBaseAmount: BN;
  /** Pool quote (SOL) reserve at quote time. */
  poolQuoteAmount: BN;
}

export interface AmmSellQuote {
  /** Net SOL received after all AMM fees, in lamports. */
  solOut: BN;
  /** Tokens sold (raw units). */
  tokensSold: BN;
  /** Protocol + LP + creator fees deducted (lamports). */
  feesLamports: BN;
  /** Pool base token reserve at quote time. */
  poolBaseAmount: BN;
  /** Pool quote (SOL) reserve at quote time. */
  poolQuoteAmount: BN;
}

export interface SellQuote {
  /** Net SOL received after all fees, in lamports. */
  solOut: BN;
  /** Total fees deducted (protocol + creator), in lamports. */
  feesLamports: BN;
  /** Price impact of the sell in basis points (100 bps = 1%). */
  priceImpactBps: number;
  /** Spot price per token before the sell executes, in lamports. */
  priceBefore: BN;
  /** Spot price per token after the sell executes, in lamports. */
  priceAfter: BN;
  /** Maximum tokens safely sellable in a single instruction without overflow. */
  maxSafeAmount: BN;
  /** True if the requested amount exceeds maxSafeAmount and requires sellChunked. */
  willOverflow: boolean;
}

export interface BuyQuote {
  /** Expected tokens received after all fees, in raw token units. */
  tokensOut: BN;
  /** Total fees deducted (protocol + creator), in lamports. */
  feesLamports: BN;
  /** Price impact of the buy in basis points (100 bps = 1%). */
  priceImpactBps: number;
  /** Spot price per token before the buy executes, in lamports. */
  priceBefore: BN;
  /** Spot price per token after the buy executes, in lamports. */
  priceAfter: BN;
}

export type PumpEvent =
  // ── Pump bonding curve ──────────────────────────────────────────────
  | { type: "trade"; data: TradeEvent }
  | { type: "create"; data: CreateEvent }
  | { type: "complete"; data: CompleteEvent }
  | { type: "completePumpAmmMigration"; data: CompletePumpAmmMigrationEvent }
  | { type: "setCreator"; data: SetCreatorEvent }
  | { type: "collectCreatorFee"; data: CollectCreatorFeeEvent }
  | { type: "claimCashback"; data: ClaimCashbackEvent }
  | { type: "claimTokenIncentives"; data: ClaimTokenIncentivesEvent }
  | { type: "extendAccount"; data: ExtendAccountEvent }
  | { type: "initUserVolumeAccumulator"; data: InitUserVolumeAccumulatorEvent }
  | { type: "syncUserVolumeAccumulator"; data: SyncUserVolumeAccumulatorEvent }
  | { type: "closeUserVolumeAccumulator"; data: CloseUserVolumeAccumulatorEvent }
  | { type: "adminSetCreator"; data: AdminSetCreatorEvent }
  | { type: "migrateBondingCurveCreator"; data: MigrateBondingCurveCreatorEvent }
  | { type: "distributeCreatorFees"; data: DistributeCreatorFeesEvent }
  // ── PumpAMM ─────────────────────────────────────────────────────────
  | { type: "ammBuy"; data: AmmBuyEvent }
  | { type: "ammSell"; data: AmmSellEvent }
  | { type: "deposit"; data: DepositEvent }
  | { type: "withdraw"; data: WithdrawEvent }
  | { type: "createPool"; data: CreatePoolEvent }
  // ── PumpFees ─────────────────────────────────────────────────────────
  | { type: "createFeeSharingConfig"; data: CreateFeeSharingConfigEvent }
  | { type: "updateFeeShares"; data: UpdateFeeSharesEvent }
  | { type: "resetFeeSharingConfig"; data: ResetFeeSharingConfigEvent }
  | { type: "revokeFeeSharingAuthority"; data: RevokeFeeSharingAuthorityEvent }
  | { type: "transferFeeSharingAuthority"; data: TransferFeeSharingAuthorityEvent }
  | { type: "socialFeePdaCreated"; data: SocialFeePdaCreatedEvent }
  | { type: "socialFeePdaClaimed"; data: SocialFeePdaClaimedEvent };

function tryDecodePumpEvent(data: Buffer): PumpEvent | null {
  const decoders: Array<() => PumpEvent | null> = [
    // Pump bonding curve
    () => { const d = PUMP_SDK.decodeTradeEvent(data); return d ? { type: "trade", data: d } : null; },
    () => { const d = PUMP_SDK.decodeCreateEvent(data); return d ? { type: "create", data: d } : null; },
    () => { const d = PUMP_SDK.decodeCompleteEvent(data); return d ? { type: "complete", data: d } : null; },
    () => { const d = PUMP_SDK.decodeCompletePumpAmmMigrationEvent(data); return d ? { type: "completePumpAmmMigration", data: d } : null; },
    () => { const d = PUMP_SDK.decodeSetCreatorEvent(data); return d ? { type: "setCreator", data: d } : null; },
    () => { const d = PUMP_SDK.decodeCollectCreatorFeeEvent(data); return d ? { type: "collectCreatorFee", data: d } : null; },
    () => { const d = PUMP_SDK.decodeClaimCashbackEvent(data); return d ? { type: "claimCashback", data: d } : null; },
    () => { const d = PUMP_SDK.decodeClaimTokenIncentivesEvent(data); return d ? { type: "claimTokenIncentives", data: d } : null; },
    () => { const d = PUMP_SDK.decodeExtendAccountEvent(data); return d ? { type: "extendAccount", data: d } : null; },
    () => { const d = PUMP_SDK.decodeInitUserVolumeAccumulatorEvent(data); return d ? { type: "initUserVolumeAccumulator", data: d } : null; },
    () => { const d = PUMP_SDK.decodeSyncUserVolumeAccumulatorEvent(data); return d ? { type: "syncUserVolumeAccumulator", data: d } : null; },
    () => { const d = PUMP_SDK.decodeCloseUserVolumeAccumulatorEvent(data); return d ? { type: "closeUserVolumeAccumulator", data: d } : null; },
    () => { const d = PUMP_SDK.decodeAdminSetCreatorEvent(data); return d ? { type: "adminSetCreator", data: d } : null; },
    () => { const d = PUMP_SDK.decodeMigrateBondingCurveCreatorEvent(data); return d ? { type: "migrateBondingCurveCreator", data: d } : null; },
    () => { const d = PUMP_SDK.decodeDistributeCreatorFeesEvent(data); return d ? { type: "distributeCreatorFees", data: d } : null; },
    // PumpAMM
    () => { const d = PUMP_SDK.decodeAmmBuyEvent(data); return d ? { type: "ammBuy", data: d } : null; },
    () => { const d = PUMP_SDK.decodeAmmSellEvent(data); return d ? { type: "ammSell", data: d } : null; },
    () => { const d = PUMP_SDK.decodeDepositEvent(data); return d ? { type: "deposit", data: d } : null; },
    () => { const d = PUMP_SDK.decodeWithdrawEvent(data); return d ? { type: "withdraw", data: d } : null; },
    () => { const d = PUMP_SDK.decodeCreatePoolEvent(data); return d ? { type: "createPool", data: d } : null; },
    // PumpFees
    () => { const d = PUMP_SDK.decodeCreateFeeSharingConfigEvent(data); return d ? { type: "createFeeSharingConfig", data: d } : null; },
    () => { const d = PUMP_SDK.decodeUpdateFeeSharesEvent(data); return d ? { type: "updateFeeShares", data: d } : null; },
    () => { const d = PUMP_SDK.decodeResetFeeSharingConfigEvent(data); return d ? { type: "resetFeeSharingConfig", data: d } : null; },
    () => { const d = PUMP_SDK.decodeRevokeFeeSharingAuthorityEvent(data); return d ? { type: "revokeFeeSharingAuthority", data: d } : null; },
    () => { const d = PUMP_SDK.decodeTransferFeeSharingAuthorityEvent(data); return d ? { type: "transferFeeSharingAuthority", data: d } : null; },
    () => { const d = PUMP_SDK.decodeSocialFeePdaCreatedEvent(data); return d ? { type: "socialFeePdaCreated", data: d } : null; },
    () => { const d = PUMP_SDK.decodeSocialFeePdaClaimedEvent(data); return d ? { type: "socialFeePdaClaimed", data: d } : null; },
  ];
  for (const decode of decoders) {
    try {
      const result = decode();
      if (result) return result;
    } catch {
      // discriminator mismatch — try next
    }
  }
  return null;
}


