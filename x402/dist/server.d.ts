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
import type { X402MiddlewareOptions, SolanaNetwork } from './types.js';
interface Req {
    url: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
    path?: string;
    originalUrl?: string;
}
interface Res {
    status(code: number): Res;
    set(header: string, value: string): Res;
    json(body: unknown): void;
    setHeader(name: string, value: string): void;
}
type NextFn = (err?: unknown) => void;
/**
 * Express middleware that gates a route with x402 payments.
 *
 * Returns HTTP 402 with payment instructions if no valid payment is attached.
 * When a valid `X-PAYMENT` header is present, the request proceeds.
 */
export declare function x402Paywall(options: X402MiddlewareOptions): (req: Req, res: Res, next: NextFn) => Promise<void>;
export interface PaywallRouteConfig {
    path: string;
    amount: string;
    description?: string;
    mimeType?: string;
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
export declare function createPaywalls(config: {
    payTo: string;
    network?: SolanaNetwork;
    token?: string;
    facilitatorUrl?: string;
    routes: PaywallRouteConfig[];
}): {
    path: string;
    middleware: (req: Req, res: Res, next: NextFn) => Promise<void>;
}[];
export {};
//# sourceMappingURL=server.d.ts.map