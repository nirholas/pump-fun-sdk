/**
 * x402 Server Middleware for Express (Solana)
 *
 * Protects Express routes with HTTP 402 Payment Required.
 * When a client sends a valid x402 payment, the request proceeds.
 *
 * Usage:
 * ```ts
 * import express from 'express';
 * import { x402Paywall } from '@pump-fun/x402/server';
 *
 * const app = express();
 *
 * app.get('/premium',
 *   x402Paywall({
 *     payTo: 'RecipientSolanaAddress',
 *     amount: '1000000', // $1 USDC
 *     description: 'Premium API access',
 *   }),
 *   (req, res) => {
 *     res.json({ data: 'premium content' });
 *   }
 * );
 * ```
 */
import { X402_VERSION, X402_PAYMENT_REQUIRED_HEADER, X402_PAYMENT_HEADER, } from './types.js';
import { getUsdcMint, DEFAULT_NETWORK, DEFAULT_EXPIRES_SECONDS, } from './constants.js';
import { decodePayment, generateNonce } from './payment.js';
import { verifyPaymentLocal } from './facilitator.js';
// ---------------------------------------------------------------------------
// Paywall middleware
// ---------------------------------------------------------------------------
/**
 * Express middleware that gates a route with x402 payments.
 *
 * Returns HTTP 402 with payment instructions if no valid payment is attached.
 * When a valid `X-PAYMENT` header is present, the request proceeds.
 */
export function x402Paywall(options) {
    const { payTo, amount, description, mimeType, facilitatorUrl, verify: customVerify, extra, expiresInSeconds = DEFAULT_EXPIRES_SECONDS, } = options;
    const network = options.network ?? DEFAULT_NETWORK;
    const token = options.token ?? getUsdcMint(network).toBase58();
    const nonceFn = options.generateNonce ?? generateNonce;
    return async (req, res, next) => {
        // Check for payment header
        const paymentHeader = req.headers[X402_PAYMENT_HEADER] ??
            req.headers[X402_PAYMENT_HEADER.toLowerCase()];
        if (!paymentHeader) {
            // No payment — return 402
            return send402(req, res, {
                payTo,
                amount,
                token,
                network,
                description,
                mimeType,
                extra,
                nonceFn,
                expiresInSeconds,
            });
        }
        // Decode and verify the payment
        let payment;
        try {
            payment = decodePayment(paymentHeader);
        }
        catch {
            res.status(400).json({
                error: 'Invalid X-PAYMENT header — could not decode',
            });
            return;
        }
        // Validate basic fields
        if (payment.x402Version !== X402_VERSION) {
            res.status(400).json({
                error: `Unsupported x402 version: ${payment.x402Version}`,
            });
            return;
        }
        if (payment.payTo !== payTo) {
            res.status(400).json({ error: 'Payment recipient mismatch' });
            return;
        }
        if (BigInt(payment.amount) < BigInt(amount)) {
            res.status(402).json({ error: 'Insufficient payment amount' });
            return;
        }
        // Verify the payment
        let result;
        try {
            if (customVerify) {
                result = await customVerify(payment);
            }
            else if (facilitatorUrl) {
                result = await verifyViaFacilitator(facilitatorUrl, payment);
            }
            else {
                result = await verifyPaymentLocal(payment, network);
            }
        }
        catch (error) {
            res.status(500).json({
                error: 'Payment verification failed',
                details: error instanceof Error ? error.message : String(error),
            });
            return;
        }
        if (!result.valid) {
            res.status(402).json({
                error: 'Payment verification failed',
                details: result.error,
            });
            return;
        }
        // Payment is valid — proceed
        next();
    };
}
function send402(req, res, opts) {
    const resource = req.originalUrl ?? req.url;
    const nonce = opts.nonceFn();
    const expiresAt = new Date(Date.now() + opts.expiresInSeconds * 1000).toISOString();
    const body = {
        x402Version: X402_VERSION,
        accepts: [
            {
                scheme: 'exact',
                network: opts.network,
                maxAmountRequired: opts.amount,
                resource,
                description: opts.description,
                mimeType: opts.mimeType,
                payTo: opts.payTo,
                token: opts.token,
                extra: opts.extra,
            },
        ],
        nonce,
        expiresAt,
    };
    // Also set the header (base64-encoded) for programmatic clients
    const headerValue = Buffer.from(JSON.stringify(body)).toString('base64');
    res
        .status(402)
        .set(X402_PAYMENT_REQUIRED_HEADER, headerValue)
        .json(body);
}
// ---------------------------------------------------------------------------
// External facilitator verification
// ---------------------------------------------------------------------------
async function verifyViaFacilitator(facilitatorUrl, payment) {
    const url = facilitatorUrl.replace(/\/$/, '') + '/verify';
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment),
    });
    if (!response.ok) {
        return {
            valid: false,
            error: `Facilitator returned ${response.status}: ${await response.text()}`,
        };
    }
    return (await response.json());
}
/**
 * Create paywall middleware for multiple routes at once.
 *
 * ```ts
 * const paywalls = createPaywalls({
 *   payTo: 'RecipientAddress',
 *   network: 'solana-devnet',
 *   routes: [
 *     { path: '/api/premium', amount: '1000000', description: 'Premium' },
 *     { path: '/api/vip', amount: '5000000', description: 'VIP' },
 *   ],
 * });
 *
 * for (const { path, middleware } of paywalls) {
 *   app.use(path, middleware);
 * }
 * ```
 */
export function createPaywalls(config) {
    return config.routes.map((route) => ({
        path: route.path,
        middleware: x402Paywall({
            payTo: config.payTo,
            amount: route.amount,
            network: config.network,
            token: config.token,
            facilitatorUrl: config.facilitatorUrl,
            description: route.description,
            mimeType: route.mimeType,
        }),
    }));
}
//# sourceMappingURL=server.js.map
