import { Connection, Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction, PublicKey, SendTransactionError } from '@solana/web3.js';
import BN from 'bn.js';
import { PUMP_SDK } from '@pump-fun/pump-sdk';
import { OnlinePumpSdk } from '@pump-fun/pump-sdk';
import { getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount } from '@pump-fun/pump-sdk';
import { getGraduationProgress } from '@pump-fun/pump-sdk';
import { logger } from '../logger.js';

export interface ExecuteResult {
  success: boolean;
  signature?: string;
  error?: string;
  solAmount: BN;
  tokenAmount: BN;
  price: number;
}

/**
 * Transaction executor — wraps the pump-fun-sdk offline instruction builders
 * with signing, simulation, and submission.
 *
 * Each bot instance gets its own Executor with its own wallet keypair.
 */
export class Executor {
  private readonly connection: Connection;
  private readonly onlineSdk: OnlinePumpSdk;
  private readonly wallet: Keypair;
  private readonly defaultSlippage: number;
  private readonly maxRetries: number;

  constructor(opts: {
    connection: Connection;
    wallet: Keypair;
    defaultSlippage?: number;
    maxRetries?: number;
  }) {
    this.connection = opts.connection;
    this.wallet = opts.wallet;
    this.defaultSlippage = opts.defaultSlippage ?? 0.05; // 5%
    this.maxRetries = opts.maxRetries ?? 2;
    this.onlineSdk = new OnlinePumpSdk(this.connection);
  }

  get publicKey(): PublicKey {
    return this.wallet.publicKey;
  }

  /** Buy tokens on the bonding curve */
  async buy(mint: PublicKey, solAmount: BN, slippage?: number): Promise<ExecuteResult> {
    const slip = slippage ?? this.defaultSlippage;
    try {
      // Fetch on-chain state
      const [buyState, global, feeConfig] = await Promise.all([
        this.onlineSdk.fetchBuyState(mint, this.wallet.publicKey),
        this.onlineSdk.fetchGlobal(),
        this.onlineSdk.fetchFeeConfig(),
      ]);

      const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = buyState;

      // Check if token has graduated
      if (bondingCurve.complete) {
        return this.ammBuy(mint, solAmount, slippage);
      }

      // Calculate token amount from SOL
      const mintSupply = bondingCurve.tokenTotalSupply;
      const tokenAmount = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig,
        mintSupply,
        bondingCurve,
        amount: solAmount,
      });

      if (tokenAmount.isZero()) {
        return { success: false, error: 'Zero token output', solAmount, tokenAmount, price: 0 };
      }

      // Build instructions
      const instructions = await PUMP_SDK.buyInstructions({
        global,
        bondingCurveAccountInfo,
        bondingCurve,
        associatedUserAccountInfo,
        mint,
        user: this.wallet.publicKey,
        amount: tokenAmount,
        solAmount,
        slippage: slip,
      });

      const price = solAmount.toNumber() / tokenAmount.toNumber();
      const signature = await this.sendTransaction(instructions);

      logger.info(`BUY ${mint.toBase58().slice(0, 8)}… | ${(solAmount.toNumber() / 1e9).toFixed(4)} SOL → ${tokenAmount.toString()} tokens | sig=${signature.slice(0, 16)}…`);
      return { success: true, signature, solAmount, tokenAmount, price };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`BUY FAILED ${mint.toBase58().slice(0, 8)}…: ${msg}`);
      return { success: false, error: msg, solAmount, tokenAmount: new BN(0), price: 0 };
    }
  }

  /** Sell tokens on the bonding curve */
  async sell(mint: PublicKey, tokenAmount?: BN, slippage?: number): Promise<ExecuteResult> {
    const slip = slippage ?? this.defaultSlippage;
    try {
      // If no amount specified, sell all
      if (!tokenAmount) {
        return this.sellAll(mint, slippage);
      }

      const [sellState, global, feeConfig] = await Promise.all([
        this.onlineSdk.fetchSellState(mint, this.wallet.publicKey),
        this.onlineSdk.fetchGlobal(),
        this.onlineSdk.fetchFeeConfig(),
      ]);

      const { bondingCurveAccountInfo, bondingCurve } = sellState;

      // Check if graduated → route to AMM
      if (bondingCurve.complete) {
        return this.ammSell(mint, tokenAmount, slippage);
      }

      const mintSupply = bondingCurve.tokenTotalSupply;
      const solAmount = getSellSolAmountFromTokenAmount({
        global,
        feeConfig,
        mintSupply,
        bondingCurve,
        amount: tokenAmount,
      });

      const instructions = await PUMP_SDK.sellInstructions({
        global,
        bondingCurveAccountInfo,
        bondingCurve,
        mint,
        user: this.wallet.publicKey,
        amount: tokenAmount,
        solAmount,
        slippage: slip,
      });

      const price = solAmount.toNumber() / tokenAmount.toNumber();
      const signature = await this.sendTransaction(instructions);

      logger.info(`SELL ${mint.toBase58().slice(0, 8)}… | ${tokenAmount.toString()} tokens → ${(solAmount.toNumber() / 1e9).toFixed(4)} SOL | sig=${signature.slice(0, 16)}…`);
      return { success: true, signature, solAmount, tokenAmount, price };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`SELL FAILED ${mint.toBase58().slice(0, 8)}…: ${msg}`);
      return { success: false, error: msg, solAmount: new BN(0), tokenAmount: tokenAmount ?? new BN(0), price: 0 };
    }
  }

  /** Sell entire token balance */
  async sellAll(mint: PublicKey, slippage?: number): Promise<ExecuteResult> {
    try {
      const balance = await this.onlineSdk.getTokenBalance(mint, this.wallet.publicKey);
      if (balance.isZero()) {
        return { success: false, error: 'Zero balance', solAmount: new BN(0), tokenAmount: new BN(0), price: 0 };
      }

      const instructions = await this.onlineSdk.sellAllInstructions({
        mint,
        user: this.wallet.publicKey,
        slippage: slippage ?? this.defaultSlippage,
      });

      const signature = await this.sendTransaction(instructions);

      logger.info(`SELL ALL ${mint.toBase58().slice(0, 8)}… | ${balance.toString()} tokens | sig=${signature.slice(0, 16)}…`);
      return { success: true, signature, solAmount: new BN(0), tokenAmount: balance, price: 0 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`SELL ALL FAILED ${mint.toBase58().slice(0, 8)}…: ${msg}`);
      return { success: false, error: msg, solAmount: new BN(0), tokenAmount: new BN(0), price: 0 };
    }
  }

  /** Buy on AMM (for graduated tokens) */
  private async ammBuy(mint: PublicKey, solAmount: BN, slippage?: number): Promise<ExecuteResult> {
    const slip = slippage ?? this.defaultSlippage;
    try {
      const pool = await this.onlineSdk.fetchPool(mint);
      const poolPda = this.getPoolPda(mint);
      const minBaseOut = solAmount.muln(Math.floor((1 - slip) * 10000)).divn(10000);

      const instruction = await PUMP_SDK.ammBuyExactQuoteInInstruction({
        user: this.wallet.publicKey,
        pool: poolPda,
        mint,
        quoteAmountIn: solAmount,
        minBaseAmountOut: minBaseOut,
      });

      const signature = await this.sendTransaction([instruction]);
      logger.info(`AMM BUY ${mint.toBase58().slice(0, 8)}… | ${(solAmount.toNumber() / 1e9).toFixed(4)} SOL | sig=${signature.slice(0, 16)}…`);
      return { success: true, signature, solAmount, tokenAmount: minBaseOut, price: 0 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`AMM BUY FAILED: ${msg}`);
      return { success: false, error: msg, solAmount, tokenAmount: new BN(0), price: 0 };
    }
  }

  /** Sell on AMM (for graduated tokens) */
  private async ammSell(mint: PublicKey, tokenAmount: BN, slippage?: number): Promise<ExecuteResult> {
    const slip = slippage ?? this.defaultSlippage;
    try {
      const poolPda = this.getPoolPda(mint);
      const minQuoteOut = new BN(0); // Accept any SOL amount (slippage applied in instruction)

      const instruction = await PUMP_SDK.ammSellInstruction({
        user: this.wallet.publicKey,
        pool: poolPda,
        mint,
        baseAmountIn: tokenAmount,
        minQuoteAmountOut: minQuoteOut,
      });

      const signature = await this.sendTransaction([instruction]);
      logger.info(`AMM SELL ${mint.toBase58().slice(0, 8)}… | ${tokenAmount.toString()} tokens | sig=${signature.slice(0, 16)}…`);
      return { success: true, signature, solAmount: new BN(0), tokenAmount, price: 0 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`AMM SELL FAILED: ${msg}`);
      return { success: false, error: msg, solAmount: new BN(0), tokenAmount, price: 0 };
    }
  }

  /** Get SOL balance of the wallet */
  async getSolBalance(): Promise<BN> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return new BN(balance);
  }

  /** Get token balance for a mint */
  async getTokenBalance(mint: PublicKey): Promise<BN> {
    return this.onlineSdk.getTokenBalance(mint, this.wallet.publicKey);
  }

  /** Build, sign, and send a transaction with retry */
  private async sendTransaction(instructions: TransactionInstruction[]): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

        const messageV0 = new TransactionMessage({
          payerKey: this.wallet.publicKey,
          recentBlockhash: blockhash,
          instructions,
        }).compileToV0Message();

        const tx = new VersionedTransaction(messageV0);
        tx.sign([this.wallet]);

        const signature = await this.connection.sendTransaction(tx, {
          skipPreflight: false,
          maxRetries: 2,
        });

        // Wait for confirmation
        const confirmation = await this.connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed'
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        return signature;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          logger.warn(`TX attempt ${attempt + 1} failed: ${lastError.message} — retrying…`);
        }
      }
    }

    throw lastError ?? new Error('Transaction failed after retries');
  }

  /** Derive the canonical PumpAMM pool PDA for a mint */
  private getPoolPda(mint: PublicKey): PublicKey {
    const PUMP_AMM_PROGRAM = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), mint.toBuffer()],
      PUMP_AMM_PROGRAM,
    );
    return pda;
  }
}
