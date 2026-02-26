/**
 * @fileoverview Base58 utilities and information.
 * Provides helpers for working with Base58-encoded Solana addresses.
 * @module utils/base58
 */

/**
 * The Base58 alphabet used by Solana (and Bitcoin).
 * Characters excluded: 0, O, I, l (to avoid confusion)
 */
export const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Set of valid Base58 characters for O(1) lookup.
 */
const BASE58_SET = new Set(BASE58_ALPHABET);

/**
 * Mapping of character indices for Base58 decoding.
 */
const BASE58_MAP: Map<string, number> = new Map(
  BASE58_ALPHABET.split('').map((char, index) => [char, index])
);

/**
 * Characters that are commonly confused with valid Base58 characters.
 * Includes the character they're often confused with.
 */
export const CONFUSING_CHARACTERS: Record<string, string> = {
  '0': 'O (letter) - zero is not in Base58',
  O: '0 (zero) - uppercase O is not in Base58',
  I: '1 (one) - uppercase I is not in Base58',
  l: '1 (one) - lowercase L is not in Base58',
};

/**
 * Checks if a string contains only valid Base58 characters.
 *
 * @param str - The string to validate
 * @returns True if all characters are valid Base58
 */
export function isValidBase58(str: string): boolean {
  for (const char of str) {
    if (!BASE58_SET.has(char)) {
      return false;
    }
  }
  return true;
}

/**
 * Gets all invalid characters from a string.
 *
 * @param str - The string to check
 * @returns Array of objects containing invalid characters and their positions
 */
export function getInvalidBase58Chars(str: string): Array<{
  char: string;
  position: number;
  suggestion: string | undefined;
}> {
  const invalid: Array<{ char: string; position: number; suggestion: string | undefined }> = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char !== undefined && !BASE58_SET.has(char)) {
      invalid.push({
        char,
        position: i,
        suggestion: CONFUSING_CHARACTERS[char],
      });
    }
  }

  return invalid;
}

/**
 * Converts a character to its Base58 index (0-57).
 *
 * @param char - A single Base58 character
 * @returns The index (0-57) or -1 if invalid
 */
export function charToBase58Index(char: string): number {
  const index = BASE58_MAP.get(char);
  return index !== undefined ? index : -1;
}

/**
 * Converts a Base58 index (0-57) to its character.
 *
 * @param index - The index (0-57)
 * @returns The Base58 character or undefined if invalid
 */
export function base58IndexToChar(index: number): string | undefined {
  if (index < 0 || index >= 58) {
    return undefined;
  }
  return BASE58_ALPHABET[index];
}

/**
 * Gets a random valid Base58 character.
 *
 * @returns A random Base58 character
 */
export function getRandomBase58Char(): string {
  const index = Math.floor(Math.random() * 58);
  const char = BASE58_ALPHABET[index];
  // This should never be undefined given the range, but TypeScript requires the check
  return char ?? '1';
}

/**
 * Generates a random Base58 string of the specified length.
 * Note: This is NOT cryptographically secure and should only be
 * used for testing or display purposes.
 *
 * @param length - The length of the string to generate
 * @returns A random Base58 string
 */
export function generateRandomBase58String(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += getRandomBase58Char();
  }
  return result;
}

/**
 * Information about the Base58 alphabet and its properties.
 */
export const BASE58_INFO = {
  /** Total number of characters in the alphabet */
  alphabetSize: 58,

  /** Characters excluded from the alphabet */
  excludedChars: ['0', 'O', 'I', 'l'],

  /** Reason for exclusions */
  exclusionReason: 'To avoid visual confusion between similar characters',

  /** Digit characters (10) */
  digits: '123456789',

  /** Uppercase letter characters (24) */
  uppercaseLetters: 'ABCDEFGHJKLMNPQRSTUVWXYZ',

  /** Lowercase letter characters (24) */
  lowercaseLetters: 'abcdefghijkmnopqrstuvwxyz',

  /** Expected iterations to find N matching characters (58^N) */
  expectedIterations: (chars: number): number => Math.pow(58, chars),
};

/**
 * Probability calculations for vanity address generation.
 */
export const BASE58_PROBABILITY = {
  /**
   * Probability of a random address starting with a specific character.
   * Note: First character of Solana addresses has different distribution.
   */
  singleCharProbability: 1 / 58,

  /**
   * Probability of matching N specific characters.
   * @param n - Number of characters to match
   */
  matchProbability: (n: number): number => Math.pow(1 / 58, n),

  /**
   * Expected number of attempts to find N matching characters.
   * @param n - Number of characters to match
   */
  expectedAttempts: (n: number): number => Math.pow(58, n),

  /**
   * Probability of finding a match within N attempts.
   * @param targetChars - Number of characters to match
   * @param attempts - Number of attempts
   */
  successProbabilityAfterAttempts: (targetChars: number, attempts: number): number => {
    const p = Math.pow(1 / 58, targetChars);
    return 1 - Math.pow(1 - p, attempts);
  },
};
