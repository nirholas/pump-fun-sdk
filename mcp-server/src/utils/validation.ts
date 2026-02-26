import { z } from 'zod';

// Base58 character set (no 0, O, I, l)
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const Base58Schema = z.string().regex(BASE58_REGEX, 'Invalid Base58 string');

export const SolanaAddressSchema = z
  .string()
  .min(32, 'Solana addresses must be at least 32 characters')
  .max(44, 'Solana addresses must be at most 44 characters')
  .regex(BASE58_REGEX, 'Invalid Base58 characters in address');

export const PrefixSchema = z
  .string()
  .max(6, 'Prefix too long (max 6 characters)')
  .regex(BASE58_REGEX, 'Prefix must contain only Base58 characters');

export const SuffixSchema = z
  .string()
  .max(6, 'Suffix too long (max 6 characters)')
  .regex(BASE58_REGEX, 'Suffix must contain only Base58 characters');

export const PrivateKeySchema = z
  .string()
  .min(64, 'Private key too short')
  .max(88, 'Private key too long')
  .regex(BASE58_REGEX, 'Invalid Base58 characters in private key');

export const SeedPhraseSchema = z
  .string()
  .refine(
    (val) => {
      const words = val.trim().split(/\s+/);
      return words.length === 12 || words.length === 24;
    },
    { message: 'Seed phrase must be 12 or 24 words' }
  );

export function isValidBase58(str: string): boolean {
  return BASE58_REGEX.test(str);
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    SolanaAddressSchema.parse(address);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeInput(input: string): string {
  // Remove any non-printable characters
  return input.replace(/[^\x20-\x7E]/g, '');
}

export function validatePrefix(prefix: string): { valid: boolean; error?: string } {
  try {
    PrefixSchema.parse(prefix);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Invalid prefix' };
  }
}

export function validateSuffix(suffix: string): { valid: boolean; error?: string } {
  try {
    SuffixSchema.parse(suffix);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Invalid suffix' };
  }
}

// Export the character set for use in other modules
export { BASE58_CHARS };
