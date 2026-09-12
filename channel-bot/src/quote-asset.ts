/**
 * Resolve a claim's quote currency when it is not in QUOTE_MINT_INFO.
 *
 * GitHub claims are paid in SOL, stablecoins and tokenized stocks, and the set
 * grows. Guessing SOL for an unknown mint printed an 8-decimal stock tenfold too
 * small, labelled SOL, at SOL's dollar price. This reads the mint's real
 * decimals, and its symbol when the mint carries token metadata, straight from
 * the chain. It runs only for first claims, which are rare, and results are cached.
 */

import { QUOTE_MINT_INFO, type FeeClaimEvent, type QuoteAssetInfo } from './types.js';

const cache = new Map<string, QuoteAssetInfo>();

interface ParsedMintValue {
    data?: {
        parsed?: {
            info?: {
                decimals?: unknown;
                extensions?: Array<{ extension?: unknown; state?: { symbol?: unknown } }>;
            };
        };
    };
}

/** Read decimals and symbol from a jsonParsed getAccountInfo value. Null when it is not a mint. */
export function quoteAssetFromParsedMint(mint: string, value: unknown): QuoteAssetInfo | null {
    const info = (value as ParsedMintValue | null)?.data?.parsed?.info;
    if (!info || typeof info.decimals !== 'number') return null;
    let symbol: string | undefined;
    for (const ext of info.extensions ?? []) {
        if (ext.extension === 'tokenMetadata' && typeof ext.state?.symbol === 'string' && ext.state.symbol.trim()) {
            symbol = ext.state.symbol.trim();
        }
    }
    return { ticker: symbol ?? mint.slice(0, 6), decimals: info.decimals, isStable: false };
}

/** Known table first, then the chain. Null when the mint cannot be read in time. */
export async function resolveQuoteAsset(mint: string, rpcUrl: string, timeoutMs = 8_000): Promise<QuoteAssetInfo | null> {
    const known = QUOTE_MINT_INFO[mint] ?? cache.get(mint);
    if (known) return known;
    try {
        const resp = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [mint, { encoding: 'jsonParsed' }] }),
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!resp.ok) return null;
        const body = (await resp.json()) as { result?: { value?: unknown } };
        const asset = quoteAssetFromParsedMint(mint, body.result?.value);
        if (asset) cache.set(mint, asset);
        return asset;
    } catch {
        return null;
    }
}

/** Apply a resolved non-SOL quote asset to a claim, recomputing the amounts it drives. */
export function applyQuoteAsset(event: FeeClaimEvent, asset: QuoteAssetInfo): void {
    const divisor = 10 ** asset.decimals;
    event.quoteTicker = asset.ticker;
    event.isStableQuote = asset.isStable;
    event.amountQuote = event.amountLamports / divisor;
    event.lifetimeClaimedQuote = event.lifetimeStableClaimedRaw != null
        ? event.lifetimeStableClaimedRaw / divisor
        : undefined;
    event.quoteResolved = true;
}
