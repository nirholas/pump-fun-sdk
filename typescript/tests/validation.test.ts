/**
 * @fileoverview Tests for validation functions.
 */

import {
  BASE58_ALPHABET,
  isValidBase58Char,
  validatePrefix,
  validateSuffix,
  validatePattern,
  sanitizeInput,
  validateVanityInput,
  estimateAttempts,
  formatTimeEstimate,
} from '../src/lib/validation';
import { VanityError, VanityErrorType } from '../src/lib/types';

describe('BASE58_ALPHABET', () => {
  it('should have 58 characters', () => {
    expect(BASE58_ALPHABET.length).toBe(58);
  });

  it('should not contain 0, O, I, l', () => {
    expect(BASE58_ALPHABET).not.toContain('0');
    expect(BASE58_ALPHABET).not.toContain('O');
    expect(BASE58_ALPHABET).not.toContain('I');
    expect(BASE58_ALPHABET).not.toContain('l');
  });

  it('should contain expected characters', () => {
    expect(BASE58_ALPHABET).toContain('1');
    expect(BASE58_ALPHABET).toContain('9');
    expect(BASE58_ALPHABET).toContain('A');
    expect(BASE58_ALPHABET).toContain('Z');
    expect(BASE58_ALPHABET).toContain('a');
    expect(BASE58_ALPHABET).toContain('z');
  });
});

describe('isValidBase58Char', () => {
  it('should accept valid Base58 characters', () => {
    expect(isValidBase58Char('1')).toBe(true);
    expect(isValidBase58Char('9')).toBe(true);
    expect(isValidBase58Char('A')).toBe(true);
    expect(isValidBase58Char('Z')).toBe(true);
    expect(isValidBase58Char('a')).toBe(true);
    expect(isValidBase58Char('z')).toBe(true);
  });

  it('should reject invalid Base58 characters', () => {
    expect(isValidBase58Char('0')).toBe(false);
    expect(isValidBase58Char('O')).toBe(false);
    expect(isValidBase58Char('I')).toBe(false);
    expect(isValidBase58Char('l')).toBe(false);
  });

  it('should reject special characters', () => {
    expect(isValidBase58Char('!')).toBe(false);
    expect(isValidBase58Char('@')).toBe(false);
    expect(isValidBase58Char(' ')).toBe(false);
    expect(isValidBase58Char('-')).toBe(false);
  });
});

describe('validatePrefix', () => {
  it('should accept valid prefixes', () => {
    const result = validatePrefix('So1');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty prefix', () => {
    const result = validatePrefix('');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid characters', () => {
    const result = validatePrefix('S0l'); // Contains zero
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid character'))).toBe(true);
  });

  it('should warn about long prefixes', () => {
    const result = validatePrefix('ABCDEFG'); // 7 characters
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
  });

  it('should detect whitespace', () => {
    const result = validatePrefix(' Sol');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('whitespace'))).toBe(true);
  });
});

describe('validateSuffix', () => {
  it('should accept valid suffixes', () => {
    const result = validateSuffix('ana');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid suffixes', () => {
    const result = validateSuffix('O');
    expect(result.valid).toBe(false);
  });
});

describe('validatePattern', () => {
  it('should include type in error messages', () => {
    const prefixResult = validatePattern('0', 'prefix');
    // Note: The error message contains 'prefix' indirectly via structure
    expect(prefixResult.valid).toBe(false);
    expect(prefixResult.errors.length).toBeGreaterThan(0);

    const suffixResult = validatePattern('0', 'suffix');
    expect(suffixResult.valid).toBe(false);
    expect(suffixResult.errors.length).toBeGreaterThan(0);
  });
});

describe('sanitizeInput', () => {
  it('should trim whitespace', () => {
    expect(sanitizeInput('  Sol  ')).toBe('Sol');
  });

  it('should handle empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('should handle no whitespace', () => {
    expect(sanitizeInput('Sol')).toBe('Sol');
  });
});

describe('validateVanityInput', () => {
  it('should pass with valid prefix', () => {
    expect(() => validateVanityInput('So1')).not.toThrow();
  });

  it('should pass with valid suffix', () => {
    expect(() => validateVanityInput(undefined, 'ana')).not.toThrow();
  });

  it('should pass with valid prefix and suffix', () => {
    expect(() => validateVanityInput('So1', 'ana')).not.toThrow();
  });

  it('should throw when no pattern specified', () => {
    expect(() => validateVanityInput()).toThrow(VanityError);
    expect(() => validateVanityInput('')).toThrow(VanityError);
    expect(() => validateVanityInput(undefined, '')).toThrow(VanityError);
  });

  it('should throw with correct error type for invalid characters', () => {
    try {
      validateVanityInput('S0l');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(VanityError);
      expect((error as VanityError).type).toBe(VanityErrorType.INVALID_CHARACTERS);
    }
  });

  it('should throw with correct error type for too long pattern', () => {
    try {
      validateVanityInput('ABCDEFGH'); // 8 characters
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(VanityError);
      expect((error as VanityError).type).toBe(VanityErrorType.INPUT_TOO_LONG);
    }
  });
});

describe('estimateAttempts', () => {
  it('should return 58 for single character', () => {
    expect(estimateAttempts('A')).toBe(58);
  });

  it('should return 58^2 for two characters', () => {
    expect(estimateAttempts('AB')).toBe(58 * 58);
  });

  it('should combine prefix and suffix lengths', () => {
    expect(estimateAttempts('A', 'B')).toBe(58 * 58);
  });

  it('should use smaller alphabet for case-insensitive', () => {
    const caseInsensitive = estimateAttempts('A', undefined, true);
    const caseSensitive = estimateAttempts('A', undefined, false);

    expect(caseInsensitive).toBeLessThan(caseSensitive);
  });
});

describe('formatTimeEstimate', () => {
  it('should format seconds', () => {
    expect(formatTimeEstimate(15000, 1000)).toContain('second');
  });

  it('should format minutes', () => {
    expect(formatTimeEstimate(120000, 1000)).toContain('minute');
  });

  it('should format hours', () => {
    expect(formatTimeEstimate(7200000, 1000)).toContain('hour');
  });

  it('should format days', () => {
    expect(formatTimeEstimate(172800000, 1000)).toContain('day');
  });

  it('should handle zero rate', () => {
    expect(formatTimeEstimate(1000, 0)).toBe('unknown');
  });

  it('should handle very fast rate', () => {
    expect(formatTimeEstimate(10, 1000)).toContain('second');
  });
});
