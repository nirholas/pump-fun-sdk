/**
 * Base58 alphabet used by Solana addresses.
 * No 0, O, I, or l.
 */
export const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function isValidBase58(str: string): boolean {
  for (const char of str) {
    if (!BASE58_ALPHABET.includes(char)) return false;
  }
  return true;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return '< 1 second';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hours`;
  return `${(seconds / 86400).toFixed(1)} days`;
}
