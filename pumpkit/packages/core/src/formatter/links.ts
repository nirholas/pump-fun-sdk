/**
 * @pumpkit/core — Link & Format Helpers
 *
 * Common link generators and text formatters for Telegram HTML messages.
 */

/** Telegram HTML anchor tag */
export function link(label: string, url: string): string {
    return `<a href="${url}">${label}</a>`;
}

/** Solscan transaction link */
export function solscanTx(signature: string): string {
    return link('View TX', `https://solscan.io/tx/${signature}`);
}

/** Solscan account link */
export function solscanAccount(address: string): string {
    return link(shortenAddress(address), `https://solscan.io/account/${address}`);
}

/** pump.fun token page link */
export function pumpFunToken(mint: string): string {
    return link('View on PumpFun', `https://pump.fun/coin/${mint}`);
}

/** DexScreener token page link */
export function dexScreenerToken(mint: string, chain = 'solana'): string {
    return link('DexScreener', `https://dexscreener.com/${chain}/${mint}`);
}

/** Telegram HTML bold tag */
export function bold(text: string): string {
    return `<b>${text}</b>`;
}

/** Telegram HTML code tag */
export function code(text: string): string {
    return `<code>${text}</code>`;
}

/** Telegram HTML italic tag */
export function italic(text: string): string {
    return `<i>${text}</i>`;
}

/** Shorten a Solana address: 7xKp...3nRm */
export function shortenAddress(address: string, chars = 4): string {
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Format lamports to SOL string: "2.50 SOL" */
export function formatSol(lamports: number | bigint): string {
    const sol = Number(lamports) / 1_000_000_000;
    return `${sol.toFixed(sol < 1 ? 4 : 2)} SOL`;
}

/** Format number with commas: 1234567 → "1,234,567" */
export function formatNumber(n: number): string {
    return n.toLocaleString('en-US');
}
