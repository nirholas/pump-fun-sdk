/**
 * x402 Constants for Solana
 *
 * Token mints, program IDs, and protocol defaults.
 */
import { PublicKey } from '@solana/web3.js';
/** USDC mint on Solana mainnet */
export declare const USDC_MINT_MAINNET: PublicKey;
/** USDC mint on Solana devnet */
export declare const USDC_MINT_DEVNET: PublicKey;
/** USDC mint on Solana testnet (same as devnet in most cases) */
export declare const USDC_MINT_TESTNET: PublicKey;
/** SPL Token program ID */
export declare const TOKEN_PROGRAM_ID: PublicKey;
/** Associated Token Account program ID */
export declare const ASSOCIATED_TOKEN_PROGRAM_ID: PublicKey;
import type { SolanaNetwork } from './types.js';
/** Get the default USDC mint for a given network */
export declare function getUsdcMint(network: SolanaNetwork): PublicKey;
/** Get the RPC endpoint for a given network */
export declare function getDefaultRpcUrl(network: SolanaNetwork): string;
/** Default network */
export declare const DEFAULT_NETWORK: SolanaNetwork;
/** Default payment offer TTL (5 minutes) */
export declare const DEFAULT_EXPIRES_SECONDS = 300;
/** USDC has 6 decimal places */
export declare const USDC_DECIMALS = 6;
//# sourceMappingURL=constants.d.ts.map