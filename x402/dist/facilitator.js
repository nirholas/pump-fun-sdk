/**
 * x402 Facilitator — Payment Verification & Settlement (Solana)
 *
 * Verifies x402 payment transactions and optionally submits them on-chain.
 *
 * Can be used:
 * - **Locally** inside the server middleware (verifyPaymentLocal)
 * - **As a standalone service** (X402Facilitator class)
 */
import { Connection, Transaction, PublicKey, } from '@solana/web3.js';
import { X402_VERSION } from './types.js';
import { getDefaultRpcUrl } from './constants.js';
// ---------------------------------------------------------------------------
// Local verification (no on-chain submission)
// ---------------------------------------------------------------------------
/**
 * Verify a payment payload locally by deserialising the transaction
 * and checking its instructions.
 *
 * This does NOT submit the transaction — use `X402Facilitator.settle()`
 * for that.
 */
export async function verifyPaymentLocal(payment, network) {
    // Version check
    if (payment.x402Version !== X402_VERSION) {
        return {
            valid: false,
            error: `Unsupported x402 version: ${payment.x402Version}`,
        };
    }
    // Scheme check
    if (payment.scheme !== 'exact') {
        return {
            valid: false,
            error: `Unsupported payment scheme: ${payment.scheme}`,
        };
    }
    // Network check
    if (payment.network !== network) {
        return {
            valid: false,
            error: `Network mismatch: expected ${network}, got ${payment.network}`,
        };
    }
    // Deserialise the transaction
    let transaction;
    try {
        const buffer = Buffer.from(payment.transaction, 'base64');
        transaction = Transaction.from(buffer);
    }
    catch (error) {
        return {
            valid: false,
            error: `Failed to deserialise transaction: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    // Verify the transaction has at least one signature
    if (!transaction.signatures.length) {
        return {
            valid: false,
            error: 'Transaction has no signatures',
        };
    }
    // Verify the fee payer matches the declared payer
    const feePayer = transaction.feePayer;
    if (!feePayer || feePayer.toBase58() !== payment.payer) {
        return {
            valid: false,
            error: `Fee payer mismatch: expected ${payment.payer}, got ${feePayer?.toBase58() ?? 'none'}`,
        };
    }
    // Verify the transaction has a token transfer instruction
    // Look for the SPL Token transfer instruction
    const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const hasTokenTransfer = transaction.instructions.some((ix) => ix.programId.equals(tokenProgramId) && ix.data.length > 0);
    if (!hasTokenTransfer) {
        return {
            valid: false,
            error: 'Transaction does not contain a token transfer instruction',
        };
    }
    // Verify the first signature is valid (the payer's signature)
    const signerPubkey = new PublicKey(payment.payer);
    const signature = transaction.signatures[0];
    if (!signature ||
        !signature.publicKey.equals(signerPubkey)) {
        return {
            valid: false,
            error: 'Transaction not signed by the declared payer',
        };
    }
    return {
        valid: true,
        amount: payment.amount,
        payer: payment.payer,
        payTo: payment.payTo,
    };
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
export class X402Facilitator {
    connection;
    network;
    sendOptions;
    waitForConfirmation;
    constructor(options = {}) {
        this.network = options.network ?? 'solana-mainnet';
        this.connection = new Connection(options.rpcUrl ?? getDefaultRpcUrl(this.network), 'confirmed');
        this.sendOptions = options.sendOptions ?? {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        };
        this.waitForConfirmation = options.waitForConfirmation ?? true;
    }
    /**
     * Verify a payment payload without submitting it.
     */
    async verify(payment) {
        return verifyPaymentLocal(payment, this.network);
    }
    /**
     * Verify and submit a payment transaction on-chain.
     */
    async settle(payment) {
        // First verify
        const verification = await this.verify(payment);
        if (!verification.valid) {
            return {
                success: false,
                error: verification.error,
                network: this.network,
            };
        }
        // Deserialise and submit
        try {
            const buffer = Buffer.from(payment.transaction, 'base64');
            const txSignature = await this.connection.sendRawTransaction(buffer, this.sendOptions);
            if (this.waitForConfirmation) {
                const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
                await this.connection.confirmTransaction({
                    signature: txSignature,
                    blockhash,
                    lastValidBlockHeight,
                }, 'confirmed');
            }
            return {
                success: true,
                txSignature,
                network: this.network,
                payer: payment.payer,
                amount: payment.amount,
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Settlement failed: ${error instanceof Error ? error.message : String(error)}`,
                network: this.network,
                payer: payment.payer,
                amount: payment.amount,
            };
        }
    }
    /**
     * Check the status of a previously settled transaction.
     */
    async getSettlementStatus(txSignature) {
        try {
            const status = await this.connection.getSignatureStatus(txSignature);
            if (!status.value) {
                return { confirmed: false, error: 'Transaction not found' };
            }
            return {
                confirmed: status.value.confirmationStatus === 'confirmed' ||
                    status.value.confirmationStatus === 'finalized',
                slot: status.value.slot,
            };
        }
        catch (error) {
            return {
                confirmed: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/** Create a new facilitator instance */
export function createFacilitator(options) {
    return new X402Facilitator(options);
}
//# sourceMappingURL=facilitator.js.map
