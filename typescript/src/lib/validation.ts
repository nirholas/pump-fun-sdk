/**
 * @fileoverview Input validation utilities for vanity address generation.
 * Ensures that prefix and suffix inputs contain only valid Base58 characters.
 * @module validation
 */

import { ValidationResult, VanityError, VanityErrorType } from './types';

/**
 * The Base58 alphabet used by Solana (and Bitcoin).
 * Excludes: 0 (zero), O (uppercase o), I (uppercase i), l (lowercase L)
 * These characters are excluded to avoid confusion with similar-looking characters.
 */
export const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Set of valid Base58 characters for O(1) lookup.
 */
const BASE58_CHARS = new Set(BASE58_ALPHABET);

/**
 * Maximum recommended prefix/suffix length.
 * Longer patterns become exponentially harder to find.
 * 4 characters = ~13 million expected attempts
 * 5 characters = ~760 million expected attempts
 * 6 characters = ~44 billion expected attempts
 */
export const MAX_PATTERN_LENGTH = 6;

/**
 * Characters that are commonly mistaken for valid Base58 characters.
 */
const COMMONLY_CONFUSED_CHARS: Record<string, string> = {
  '0': '(zero) - use 1-9 instead',
  O: '(uppercase O) - use other uppercase letters instead',
  I: '(uppercase I) - use other uppercase letters instead',
  l: '(lowercase L) - use other lowercase letters instead',
};

/**
 * Validates a single character against the Base58 alphabet.
 * @param char - The character to validate
 * @returns True if the character is valid Base58
 */
export function isValidBase58Char(char: string): boolean {
  return BASE58_CHARS.has(char);
}

/**
 * Validates a prefix string for use in vanity address generation.
 * @param prefix - The prefix to validate
 * @returns Validation result with any error messages
 */
export function validatePrefix(prefix: string): ValidationResult {
  return validatePattern(prefix, 'prefix');
}

/**
 * Validates a suffix string for use in vanity address generation.
 * @param suffix - The suffix to validate
 * @returns Validation result with any error messages
 */
export function validateSuffix(suffix: string): ValidationResult {
  return validatePattern(suffix, 'suffix');
}

/**
 * Validates a pattern (prefix or suffix) for use in vanity address generation.
 * @param pattern - The pattern to validate
 * @param type - Whether this is a 'prefix' or 'suffix' (for error messages)
 * @returns Validation result with any error messages
 */
export function validatePattern(pattern: string, type: 'prefix' | 'suffix'): ValidationResult {
  const errors: string[] = [];

  // Check for empty string
  if (pattern.length === 0) {
    errors.push(`${type} cannot be empty`);
    return { valid: false, errors };
  }

  // Check for whitespace
  if (pattern !== pattern.trim()) {
    errors.push(`${type} contains leading or trailing whitespace`);
  }

  // Check length
  if (pattern.length > MAX_PATTERN_LENGTH) {
    errors.push(
      `${type} length ${pattern.length} exceeds maximum recommended length of ${MAX_PATTERN_LENGTH}. ` +
        `Finding a ${pattern.length}-character pattern may take an extremely long time.`
    );
  }

  // Check each character
  const invalidChars: Array<{ char: string; position: number; hint: string | undefined }> = [];

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char !== undefined && !isValidBase58Char(char)) {
      const hint = COMMONLY_CONFUSED_CHARS[char];
      invalidChars.push({ char, position: i + 1, hint });
    }
  }

  if (invalidChars.length > 0) {
    for (const { char, position, hint } of invalidChars) {
      let errorMsg = `Invalid character '${char}' at position ${position}`;
      if (hint !== undefined) {
        errorMsg += ` - ${hint}`;
      }
      errors.push(errorMsg);
    }
    errors.push(`Valid Base58 characters are: ${BASE58_ALPHABET}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes input by trimming whitespace and validating content.
 * @param input - The input string to sanitize
 * @returns The sanitized string
 */
export function sanitizeInput(input: string): string {
  return input.trim();
}

/**
 * Validates vanity options and throws if invalid.
 * @param prefix - Optional prefix to validate
 * @param suffix - Optional suffix to validate
 * @throws VanityError if validation fails
 */
export function validateVanityInput(prefix?: string, suffix?: string): void {
  // Must have at least one pattern
  if ((prefix === undefined || prefix === '') && (suffix === undefined || suffix === '')) {
    throw new VanityError(
      VanityErrorType.NO_PATTERN_SPECIFIED,
      'At least one of prefix or suffix must be specified'
    );
  }

  const allErrors: string[] = [];

  // Validate prefix if provided
  if (prefix !== undefined && prefix !== '') {
    const prefixValidation = validatePrefix(prefix);
    if (!prefixValidation.valid) {
      allErrors.push(...prefixValidation.errors.map((e) => `Prefix: ${e}`));
    }
  }

  // Validate suffix if provided
  if (suffix !== undefined && suffix !== '') {
    const suffixValidation = validateSuffix(suffix);
    if (!suffixValidation.valid) {
      allErrors.push(...suffixValidation.errors.map((e) => `Suffix: ${e}`));
    }
  }

  if (allErrors.length > 0) {
    // Determine primary error type
    const hasInvalidChars = allErrors.some((e) => e.includes('Invalid character'));
    const isTooLong = allErrors.some((e) => e.includes('exceeds maximum'));

    let errorType: VanityErrorType;
    if (hasInvalidChars) {
      errorType = VanityErrorType.INVALID_CHARACTERS;
    } else if (isTooLong) {
      errorType = VanityErrorType.INPUT_TOO_LONG;
    } else {
      errorType = VanityErrorType.INVALID_CHARACTERS;
    }

    throw new VanityError(errorType, allErrors.join('\n'), { prefix, suffix });
  }
}

/**
 * Estimates the expected number of attempts to find an address with the given pattern.
 * This is based on probability theory: each character reduces the probability by ~1/58.
 *
 * @param prefix - The prefix pattern (optional)
 * @param suffix - The suffix pattern (optional)
 * @param ignoreCase - Whether case-insensitive matching is used
 * @returns Estimated number of attempts (expected value)
 */
export function estimateAttempts(prefix?: string, suffix?: string, ignoreCase?: boolean): number {
  let effectiveLength = 0;

  if (prefix !== undefined) {
    effectiveLength += prefix.length;
  }

  if (suffix !== undefined) {
    effectiveLength += suffix.length;
  }

  // Base58 has 58 characters
  // With case-insensitive matching, we effectively have fewer distinct patterns
  // For simplicity, we approximate case-insensitive as having ~34 distinct patterns
  // (roughly 10 digits + 24 unique letters)
  const alphabetSize = ignoreCase === true ? 34 : 58;

  return Math.pow(alphabetSize, effectiveLength);
}

/**
 * Formats the estimated time to find an address.
 * @param estimatedAttempts - The estimated number of attempts
 * @param ratePerSecond - The generation rate in attempts per second
 * @returns A human-readable time estimate
 */
export function formatTimeEstimate(estimatedAttempts: number, ratePerSecond: number): string {
  if (ratePerSecond <= 0) {
    return 'unknown';
  }

  const seconds = estimatedAttempts / ratePerSecond;

  if (seconds < 1) {
    return 'less than a second';
  } else if (seconds < 60) {
    return `~${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    return `~${Math.round(seconds / 60)} minutes`;
  } else if (seconds < 86400) {
    return `~${Math.round(seconds / 3600)} hours`;
  } else if (seconds < 31536000) {
    return `~${Math.round(seconds / 86400)} days`;
  } else {
    return `~${Math.round(seconds / 31536000)} years`;
  }
}
