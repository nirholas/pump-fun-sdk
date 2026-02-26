/**
 * x402 Payment Utilities for Solana
 *
 * Creates and encodes USDC transfer transactions for x402 payments.
 */
import { Connection } from '@solana/web3.js';
import type { PaymentAccept, PaymentPayload } from './types.js';
export interface CreatePaymentOptions {
    /** The payment-required details from the server */
    accept: PaymentAccept;
    /** Payer's keypair */
    signer: {
        publicKey: {
            toBase58(): string;
            toBytes(): Uint8Array;
        };
        secretKey: Uint8Array;
    };
    /** Solana RPC connection */
    connection: Connection;
    /** Optional server-provided nonce */
    nonce?: string;
}
/**
 * Build, sign, and serialise a USDC transfer transaction for an x402 payment.
 *
 * The transaction is **fully signed** by the payer but NOT submitted to the
 * network — the facilitator or server does that after verification.
 */
export declare function createPaymentTransaction(opts: CreatePaymentOptions): Promise<PaymentPayload>;
/** Encode a PaymentPayload to a Base64 string for the X-PAYMENT header */
export declare function encodePayment(payload: PaymentPayload): string;
/** Decode a Base64-encoded X-PAYMENT header back into a PaymentPayload */
export declare function decodePayment(encoded: string): PaymentPayload;
/**
 * Convert a human-readable USDC amount (e.g. "1.50") to base units ("1500000").
 */
export declare function usdcToBaseUnits(amount: string | number): string;
/**
 * Convert base units (e.g. "1500000") to a human-readable USDC string ("1.50").
 */
export declare function baseUnitsToUsdc(baseUnits: string | bigint): string;
/**
 * Generate a random nonce string for replay protection.
 */
export declare function generateNonce(): string;
//# sourceMappingURL=payment.d.ts.map