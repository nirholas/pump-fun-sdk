/**
 * Crypto utilities for Solana wallet operations
 * Agent 2 will add more crypto-related utilities here
 */

/**
 * Securely zeroize a Uint8Array to clear sensitive data from memory
 * @param arr - The array to zeroize
 */
export function zeroize(arr: Uint8Array): void {
  arr.fill(0);
}

/**
 * Generate a random ID for keypair storage
 * @returns A random string ID
 */
export function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(8);
  crypto.getRandomValues(randomValues);
  for (const val of randomValues) {
    result += chars[val % chars.length];
  }
  return result;
}

/**
 * Convert a Uint8Array to a hex string
 * @param arr - The array to convert
 * @returns Hex string representation
 */
export function toHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to a Uint8Array
 * @param hex - The hex string to convert
 * @returns Uint8Array representation
 */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
