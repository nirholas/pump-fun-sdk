/**
 * x402 Constants for Solana
 *
 * Token mints, program IDs, and protocol defaults.
 */
import { PublicKey } from '@solana/web3.js';
// ---------------------------------------------------------------------------
// USDC Mint Addresses
// ---------------------------------------------------------------------------
/** USDC mint on Solana mainnet */
export const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
/** USDC mint on Solana devnet */
export const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
/** USDC mint on Solana testnet (same as devnet in most cases) */
export const USDC_MINT_TESTNET = USDC_MINT_DEVNET;
// ---------------------------------------------------------------------------
// Token Program
// ---------------------------------------------------------------------------
/** SPL Token program ID */
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
/** Associated Token Account program ID */
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
/** Get the default USDC mint for a given network */
export function getUsdcMint(network) {
    switch (network) {
        case 'solana-mainnet':
            return USDC_MINT_MAINNET;
        case 'solana-devnet':
            return USDC_MINT_DEVNET;
        case 'solana-testnet':
            return USDC_MINT_TESTNET;
        default:
            return USDC_MINT_MAINNET;
    }
}
/** Get the RPC endpoint for a given network */
export function getDefaultRpcUrl(network) {
    switch (network) {
        case 'solana-mainnet':
            return 'https://api.mainnet-beta.solana.com';
        case 'solana-devnet':
            return 'https://api.devnet.solana.com';
        case 'solana-testnet':
            return 'https://api.testnet.solana.com';
        default:
            return 'https://api.mainnet-beta.solana.com';
    }
}
// ---------------------------------------------------------------------------
// Protocol defaults
// ---------------------------------------------------------------------------
/** Default network */
export const DEFAULT_NETWORK = 'solana-mainnet';
/** Default payment offer TTL (5 minutes) */
export const DEFAULT_EXPIRES_SECONDS = 300;
/** USDC has 6 decimal places */
export const USDC_DECIMALS = 6;
//# sourceMappingURL=constants.js.map
