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
import type { X402ClientOptions, PaymentEventListener, SolanaNetwork } from './types.js';
export declare class X402Client {
    private readonly signer;
    private readonly connection;
    private readonly network;
    private readonly maxPaymentAmount;
    private readonly fetchFn;
    private readonly autoRetry;
    private listeners;
    constructor(options: X402ClientOptions);
    /** Register an event listener for payment events */
    on(listener: PaymentEventListener): () => void;
    private emit;
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
    fetch(url: string, init?: RequestInit): Promise<Response>;
    /** GET request with automatic 402 handling */
    get(url: string, headers?: Record<string, string>): Promise<Response>;
    /** POST request with automatic 402 handling */
    post(url: string, body?: BodyInit | null, headers?: Record<string, string>): Promise<Response>;
    /**
     * Parse the 402 response to extract payment requirements.
     *
     * Checks both the `X-PAYMENT-REQUIRED` header and the response body.
     */
    private parsePaymentRequired;
    /**
     * Pick the best matching accept option from the 402 response.
     */
    private selectAcceptOption;
    /** Get the current payer address */
    getPayerAddress(): string;
    /** Get the network this client is configured for */
    getNetwork(): SolanaNetwork;
}
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
export declare function createX402Client(options: X402ClientOptions): X402Client;
//# sourceMappingURL=client.d.ts.map