/**
 * x402 Protocol Types for Solana
 *
 * Implements the x402 HTTP 402 Payment Required protocol
 * for Solana-based USDC micropayments.
 *
 * @see https://www.x402.org
 */
// ---------------------------------------------------------------------------
// Protocol version
// ---------------------------------------------------------------------------
/** Current x402 protocol version */
export const X402_VERSION = 1;
// ---------------------------------------------------------------------------
// HTTP header constants
// ---------------------------------------------------------------------------
/** Header the server sets on a 402 response */
export const X402_PAYMENT_REQUIRED_HEADER = 'x-payment-required';
/** Header the client sets when retrying with payment */
export const X402_PAYMENT_HEADER = 'x-payment';
/** Header containing the settlement transaction signature */
export const X402_SETTLEMENT_HEADER = 'x-payment-settlement';
//# sourceMappingURL=types.js.map
