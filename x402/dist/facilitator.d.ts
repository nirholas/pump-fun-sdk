/**
 * x402 Facilitator — Payment Verification & Settlement (Solana)
 *
 * Verifies x402 payment transactions and optionally submits them on-chain.
 *
 * Can be used:
 * - **Locally** inside the server middleware (verifyPaymentLocal)
 * - **As a standalone service** (X402Facilitator class)
 */
import { SendOptions } from '@solana/web3.js';
import type { PaymentPayload, VerificationResult, SettlementResult, SolanaNetwork } from './types.js';
/**
 * Verify a payment payload locally by deserialising the transaction
 * and checking its instructions.
 *
 * This does NOT submit the transaction — use `X402Facilitator.settle()`
 * for that.
 */
export declare function verifyPaymentLocal(payment: PaymentPayload, network: SolanaNetwork): Promise<VerificationResult>;
export interface FacilitatorOptions {
    /** Solana RPC endpoint */
    rpcUrl?: string;
    /** Network */
    network?: SolanaNetwork;
    /** Options passed to sendRawTransaction */
    sendOptions?: SendOptions;
    /** Whether to wait for confirmation after submission */
    waitForConfirmation?: boolean;
    /** Maximum allowed age of the transaction blockhash (seconds) */
    maxBlockhashAge?: number;
}
/**
 * A facilitator verifies and settles x402 payments on Solana.
 *
 * ```ts
 * const facilitator = new X402Facilitator({
 *   network: 'solana-devnet',
 * });
 *
 * // Verify only
 * const result = await facilitator.verify(paymentPayload);
 *
 * // Verify + submit on-chain
 * const settlement = await facilitator.settle(paymentPayload);
 * console.log(settlement.txSignature);
 * ```
 */
export declare class X402Facilitator {
    private readonly connection;
    private readonly network;
    private readonly sendOptions;
    private readonly waitForConfirmation;
    constructor(options?: FacilitatorOptions);
    /**
     * Verify a payment payload without submitting it.
     */
    verify(payment: PaymentPayload): Promise<VerificationResult>;
    /**
     * Verify and submit a payment transaction on-chain.
     */
    settle(payment: PaymentPayload): Promise<SettlementResult>;
    /**
     * Check the status of a previously settled transaction.
     */
    getSettlementStatus(txSignature: string): Promise<{
        confirmed: boolean;
        slot?: number;
        error?: string;
    }>;
}
/** Create a new facilitator instance */
export declare function createFacilitator(options?: FacilitatorOptions): X402Facilitator;
//# sourceMappingURL=facilitator.d.ts.map