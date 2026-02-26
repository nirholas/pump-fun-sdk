/**
 * Crypto utilities for Solana wallet operations
 * Agent 2 will add more crypto-related utilities here
 */
/**
 * Securely zeroize a Uint8Array to clear sensitive data from memory
 * @param arr - The array to zeroize
 */
export declare function zeroize(arr: Uint8Array): void;
/**
 * Generate a random ID for keypair storage
 * @returns A random string ID
 */
export declare function generateId(): string;
/**
 * Convert a Uint8Array to a hex string
 * @param arr - The array to convert
 * @returns Hex string representation
 */
export declare function toHex(arr: Uint8Array): string;
/**
 * Convert a hex string to a Uint8Array
 * @param hex - The hex string to convert
 * @returns Uint8Array representation
 */
export declare function fromHex(hex: string): Uint8Array;
//# sourceMappingURL=crypto.d.ts.map