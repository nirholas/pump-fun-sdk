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
// Payment scheme
// ---------------------------------------------------------------------------

/**
 * A payment scheme describes *how* the server expects to be paid.
 *
 * - `"exact"` — pay the exact amount in a single SPL-token transfer.
 */
export type PaymentScheme = 'exact';

// ---------------------------------------------------------------------------
// Network identifiers
// ---------------------------------------------------------------------------

/** Supported Solana networks for x402 */
export type SolanaNetwork =
  | 'solana-mainnet'
  | 'solana-devnet'
  | 'solana-testnet';

// ---------------------------------------------------------------------------
// 402 Response — what the server sends back
// ---------------------------------------------------------------------------

/**
 * A single accepted payment option included in the 402 response.
 */
export interface PaymentAccept {
  /** Payment scheme (currently only "exact") */
  scheme: PaymentScheme;

  /** Network identifier */
  network: SolanaNetwork;

  /**
   * Maximum amount required, in the token's **base units** (string to avoid
   * floating-point issues). For USDC (6 decimals) "1000000" = $1.00.
   */
  maxAmountRequired: string;

  /** The resource URL being gated */
  resource: string;

  /** Human-readable description of the payment */
  description?: string;

  /** Expected MIME type of the resource */
  mimeType?: string;

  /**
   * Solana address (Base58) that should receive the payment.
   */
  payTo: string;

  /**
   * SPL token mint address (Base58).
   * Defaults to USDC on the chosen network.
   */
  token: string;

  /** Extra opaque data the server may include (passed back in payment) */
  extra?: Record<string, unknown>;
}

/**
 * The JSON body / `X-PAYMENT-REQUIRED` header the server returns on 402.
 */
export interface PaymentRequiredResponse {
  /** Protocol version */
  x402Version: number;

  /** One or more accepted payment methods */
  accepts: PaymentAccept[];

  /** Optional server-generated nonce for replay protection */
  nonce?: string;

  /** Optional expiry (ISO-8601) after which the payment offer is void */
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Payment payload — what the client sends
// ---------------------------------------------------------------------------

/**
 * A completed payment payload that the client attaches to the retry request.
 */
export interface PaymentPayload {
  /** Protocol version (must match the server's) */
  x402Version: number;

  /** Which payment scheme was used */
  scheme: PaymentScheme;

  /** Network the payment was made on */
  network: SolanaNetwork;

  /**
   * The serialised + signed Solana transaction (Base64).
   * This is a **partially-signed** transaction — the facilitator or server
   * may need to submit it.
   */
  transaction: string;

  /** Amount actually paid (base units) */
  amount: string;

  /** Token mint used */
  token: string;

  /** Payer's Solana address */
  payer: string;

  /** Recipient address */
  payTo: string;

  /** Resource URL being accessed */
  resource: string;

  /** Server nonce echoed back */
  nonce?: string;
}

// ---------------------------------------------------------------------------
// Facilitator types
// ---------------------------------------------------------------------------

/** Result returned by the facilitator after verifying + settling a payment */
export interface SettlementResult {
  /** Whether the payment is valid and was (or will be) settled */
  success: boolean;

  /** On-chain transaction signature (after submission) */
  txSignature?: string;

  /** Human-readable error when success = false */
  error?: string;

  /** Network the settlement happened on */
  network?: SolanaNetwork;

  /** The payer address */
  payer?: string;

  /** Amount settled (base units) */
  amount?: string;
}

/** Verification-only result (no on-chain submission) */
export interface VerificationResult {
  /** Whether the payment payload is valid */
  valid: boolean;

  /** Reason for invalidity */
  error?: string;

  /** Decoded amount from the transaction */
  amount?: string;

  /** Decoded payer */
  payer?: string;

  /** Decoded recipient */
  payTo?: string;
}

// ---------------------------------------------------------------------------
// Middleware options
// ---------------------------------------------------------------------------

/** Options for the Express server middleware */
export interface X402MiddlewareOptions {
  /** Solana address to receive payments */
  payTo: string;

  /**
   * Amount required in token base units.
   * For USDC: "1000000" = $1.00
   */
  amount: string;

  /** SPL token mint. Defaults to USDC on mainnet. */
  token?: string;

  /** Network. Defaults to "solana-mainnet". */
  network?: SolanaNetwork;

  /** Description shown to the payer */
  description?: string;

  /** MIME type of the gated resource */
  mimeType?: string;

  /**
   * Facilitator URL that verifies + settles payments.
   * If omitted, the middleware will verify payments locally.
   */
  facilitatorUrl?: string;

  /**
   * Custom verify function. If provided, overrides both local verification
   * and facilitator URL.
   */
  verify?: (payment: PaymentPayload) => Promise<VerificationResult>;

  /** Extra data to include in the payment required response */
  extra?: Record<string, unknown>;

  /** Nonce generator for replay protection */
  generateNonce?: () => string;

  /** Payment offer TTL in seconds. Defaults to 300 (5 min). */
  expiresInSeconds?: number;
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

/** Options for the x402-aware HTTP client */
export interface X402ClientOptions {
  /**
   * A Solana `Keypair`-compatible signer object.
   * Must have `.publicKey` (PublicKey) and `.secretKey` (Uint8Array).
   */
  signer: {
    publicKey: { toBase58(): string; toBytes(): Uint8Array };
    secretKey: Uint8Array;
  };

  /** RPC endpoint URL. Defaults to mainnet-beta. */
  rpcUrl?: string;

  /** Network tag (must match server). Defaults to "solana-mainnet". */
  network?: SolanaNetwork;

  /**
   * Maximum amount (in base units) the client is willing to pay
   * per request. Requests exceeding this are rejected client-side.
   */
  maxPaymentAmount?: string;

  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof globalThis.fetch;

  /** Whether to automatically retry on 402 (default true) */
  autoRetry?: boolean;
}

// ---------------------------------------------------------------------------
// HTTP header constants
// ---------------------------------------------------------------------------

/** Header the server sets on a 402 response */
export const X402_PAYMENT_REQUIRED_HEADER = 'x-payment-required';

/** Header the client sets when retrying with payment */
export const X402_PAYMENT_HEADER = 'x-payment';

/** Header containing the settlement transaction signature */
export const X402_SETTLEMENT_HEADER = 'x-payment-settlement';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Emitted when the client handles a 402 response */
export interface PaymentEvent {
  type: 'payment_created' | 'payment_sent' | 'payment_failed';
  resource: string;
  amount: string;
  token: string;
  network: SolanaNetwork;
  payer: string;
  payTo: string;
  error?: string;
  txSignature?: string;
}

/** Event listener type */
export type PaymentEventListener = (event: PaymentEvent) => void;
