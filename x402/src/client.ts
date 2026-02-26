/**
 * x402 Client for Solana
 *
 * A fetch-compatible HTTP client that automatically handles HTTP 402
 * Payment Required responses by creating and attaching USDC payments.
 *
 * Usage:
 * ```ts
 * import { X402Client } from '@pump-fun/x402/client';
 * import { Keypair } from '@solana/web3.js';
 *
 * const client = new X402Client({
 *   signer: Keypair.generate(),
 *   network: 'solana-devnet',
 * });
 *
 * const response = await client.fetch('https://api.example.com/premium');
 * const data = await response.json();
 * ```
 */

import { Connection } from '@solana/web3.js';

import type {
  PaymentRequiredResponse,
  PaymentPayload,
  PaymentAccept,
  X402ClientOptions,
  PaymentEvent,
  PaymentEventListener,
  SolanaNetwork,
} from './types.js';
import {
  X402_PAYMENT_REQUIRED_HEADER,
  X402_PAYMENT_HEADER,
  X402_VERSION,
} from './types.js';
import { getDefaultRpcUrl, getUsdcMint } from './constants.js';
import { createPaymentTransaction, encodePayment } from './payment.js';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class X402Client {
  private readonly signer: X402ClientOptions['signer'];
  private readonly connection: Connection;
  private readonly network: SolanaNetwork;
  private readonly maxPaymentAmount: bigint | null;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly autoRetry: boolean;
  private listeners: PaymentEventListener[] = [];

  constructor(options: X402ClientOptions) {
    this.signer = options.signer;
    this.network = options.network ?? 'solana-mainnet';
    this.connection = new Connection(
      options.rpcUrl ?? getDefaultRpcUrl(this.network),
      'confirmed'
    );
    this.maxPaymentAmount = options.maxPaymentAmount
      ? BigInt(options.maxPaymentAmount)
      : null;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.autoRetry = options.autoRetry ?? true;
  }

  // -------------------------------------------------------------------------
  // Event system
  // -------------------------------------------------------------------------

  /** Register an event listener for payment events */
  on(listener: PaymentEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: PaymentEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors
      }
    }
  }

  // -------------------------------------------------------------------------
  // Main fetch method
  // -------------------------------------------------------------------------

  /**
   * Make an HTTP request. If the server responds with 402, the client will:
   *
   * 1. Parse the payment requirements from the response
   * 2. Build & sign a USDC transfer transaction
   * 3. Re-send the request with the `X-PAYMENT` header
   *
   * @param url    - Request URL
   * @param init   - Standard fetch RequestInit options
   * @returns The final Response (either the original or the paid response)
   */
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    // Make the initial request
    const response = await this.fetchFn(url, init);

    // Not a 402 → return as-is
    if (response.status !== 402) {
      return response;
    }

    // Parse payment requirements
    const paymentRequired = await this.parsePaymentRequired(response);
    if (!paymentRequired) {
      return response; // Can't parse → return the raw 402
    }

    // Find a compatible accept option (Solana + our network)
    const accept = this.selectAcceptOption(paymentRequired);
    if (!accept) {
      this.emit({
        type: 'payment_failed',
        resource: url,
        amount: '0',
        token: '',
        network: this.network,
        payer: this.signer.publicKey.toBase58(),
        payTo: '',
        error: 'No compatible payment option found',
      });
      return response;
    }

    // Check spending limit
    if (
      this.maxPaymentAmount !== null &&
      BigInt(accept.maxAmountRequired) > this.maxPaymentAmount
    ) {
      this.emit({
        type: 'payment_failed',
        resource: url,
        amount: accept.maxAmountRequired,
        token: accept.token,
        network: accept.network,
        payer: this.signer.publicKey.toBase58(),
        payTo: accept.payTo,
        error: `Amount ${accept.maxAmountRequired} exceeds max ${this.maxPaymentAmount.toString()}`,
      });
      return response;
    }

    // Build the payment
    let payment: PaymentPayload;
    try {
      payment = await createPaymentTransaction({
        accept,
        signer: this.signer,
        connection: this.connection,
        nonce: paymentRequired.nonce,
      });

      this.emit({
        type: 'payment_created',
        resource: url,
        amount: payment.amount,
        token: payment.token,
        network: payment.network,
        payer: payment.payer,
        payTo: payment.payTo,
      });
    } catch (error) {
      this.emit({
        type: 'payment_failed',
        resource: url,
        amount: accept.maxAmountRequired,
        token: accept.token,
        network: accept.network,
        payer: this.signer.publicKey.toBase58(),
        payTo: accept.payTo,
        error: error instanceof Error ? error.message : String(error),
      });
      return response;
    }

    if (!this.autoRetry) {
      // Caller will handle it manually
      return response;
    }

    // Retry with payment header
    const encodedPayment = encodePayment(payment);
    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set(X402_PAYMENT_HEADER, encodedPayment);

    const retryResponse = await this.fetchFn(url, {
      ...init,
      headers: retryHeaders,
    });

    this.emit({
      type: 'payment_sent',
      resource: url,
      amount: payment.amount,
      token: payment.token,
      network: payment.network,
      payer: payment.payer,
      payTo: payment.payTo,
    });

    return retryResponse;
  }

  // -------------------------------------------------------------------------
  // Convenience methods
  // -------------------------------------------------------------------------

  /** GET request with automatic 402 handling */
  async get(url: string, headers?: Record<string, string>): Promise<Response> {
    return this.fetch(url, { method: 'GET', headers });
  }

  /** POST request with automatic 402 handling */
  async post(
    url: string,
    body?: BodyInit | null,
    headers?: Record<string, string>
  ): Promise<Response> {
    return this.fetch(url, { method: 'POST', body, headers });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Parse the 402 response to extract payment requirements.
   *
   * Checks both the `X-PAYMENT-REQUIRED` header and the response body.
   */
  private async parsePaymentRequired(
    response: Response
  ): Promise<PaymentRequiredResponse | null> {
    // Try header first
    const headerValue = response.headers.get(X402_PAYMENT_REQUIRED_HEADER);
    if (headerValue) {
      try {
        const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
        return JSON.parse(decoded) as PaymentRequiredResponse;
      } catch {
        // Fall through to body parsing
      }
    }

    // Try body
    try {
      const body = await response.json();
      if (body && typeof body === 'object' && 'x402Version' in body) {
        return body as PaymentRequiredResponse;
      }
    } catch {
      // Not JSON
    }

    return null;
  }

  /**
   * Pick the best matching accept option from the 402 response.
   */
  private selectAcceptOption(
    paymentRequired: PaymentRequiredResponse
  ): PaymentAccept | null {
    // Prefer exact match on our network
    const match = paymentRequired.accepts.find(
      (a) => a.network === this.network && a.scheme === 'exact'
    );
    if (match) return match;

    // Fall back to any Solana network with exact scheme
    return (
      paymentRequired.accepts.find(
        (a) => a.network.startsWith('solana') && a.scheme === 'exact'
      ) ?? null
    );
  }

  /** Get the current payer address */
  getPayerAddress(): string {
    return this.signer.publicKey.toBase58();
  }

  /** Get the network this client is configured for */
  getNetwork(): SolanaNetwork {
    return this.network;
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new x402-aware HTTP client.
 *
 * ```ts
 * const client = createX402Client({
 *   signer: myKeypair,
 *   network: 'solana-devnet',
 *   maxPaymentAmount: '5000000', // max $5 USDC per request
 * });
 * ```
 */
export function createX402Client(options: X402ClientOptions): X402Client {
  return new X402Client(options);
}

