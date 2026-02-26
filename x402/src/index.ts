/**
 * @pump-fun/x402 — x402 Payment Protocol for Solana
 *
 * HTTP 402 Payment Required protocol implementation using USDC on Solana.
 *
 * @module
 */

// Types
export type {
  PaymentScheme,
  SolanaNetwork,
  PaymentAccept,
  PaymentRequiredResponse,
  PaymentPayload,
  SettlementResult,
  VerificationResult,
  X402MiddlewareOptions,
  X402ClientOptions,
  PaymentEvent,
  PaymentEventListener,
} from './types.js';

export {
  X402_VERSION,
  X402_PAYMENT_REQUIRED_HEADER,
  X402_PAYMENT_HEADER,
  X402_SETTLEMENT_HEADER,
} from './types.js';

// Constants
export {
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
  USDC_MINT_TESTNET,
  USDC_DECIMALS,
  DEFAULT_NETWORK,
  DEFAULT_EXPIRES_SECONDS,
  getUsdcMint,
  getDefaultRpcUrl,
} from './constants.js';

// Payment utilities
export {
  createPaymentTransaction,
  encodePayment,
  decodePayment,
  usdcToBaseUnits,
  baseUnitsToUsdc,
  generateNonce,
} from './payment.js';

// Client
export { X402Client, createX402Client } from './client.js';

// Server middleware
export { x402Paywall, createPaywalls } from './server.js';

// Facilitator
export {
  verifyPaymentLocal,
  X402Facilitator,
  createFacilitator,
} from './facilitator.js';
