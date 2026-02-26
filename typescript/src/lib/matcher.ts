/**
 * @fileoverview Address matching utilities for vanity address generation.
 * Provides efficient prefix and suffix matching against Base58 addresses.
 * @module matcher
 */

import { MatcherOptions, VanityError, VanityErrorType } from './types';
import { validatePrefix, validateSuffix } from './validation';

/**
 * Efficient address matcher for vanity address generation.
 * Pre-normalizes patterns for optimized matching during the generation loop.
 */
export class AddressMatcher {
  /** The prefix to match (already normalized if case-insensitive) */
  private readonly prefix: string | undefined;

  /** The suffix to match (already normalized if case-insensitive) */
  private readonly suffix: string | undefined;

  /** Whether to perform case-insensitive matching */
  private readonly ignoreCase: boolean;

  /** Length of prefix for substring optimization */
  private readonly prefixLength: number;

  /** Length of suffix for substring optimization */
  private readonly suffixLength: number;

  /**
   * Creates a new AddressMatcher instance.
   * @param options - Matching options including prefix, suffix, and case sensitivity
   * @throws VanityError if validation fails
   */
  constructor(options: MatcherOptions) {
    this.ignoreCase = options.ignoreCase ?? false;

    // Validate and normalize prefix
    if (options.prefix !== undefined && options.prefix !== '') {
      const prefixValidation = validatePrefix(options.prefix);
      if (!prefixValidation.valid) {
        throw new VanityError(
          VanityErrorType.INVALID_CHARACTERS,
          `Invalid prefix: ${prefixValidation.errors.join(', ')}`,
          { prefix: options.prefix }
        );
      }
      this.prefix = this.normalizePattern(options.prefix);
      this.prefixLength = options.prefix.length;
    } else {
      this.prefix = undefined;
      this.prefixLength = 0;
    }

    // Validate and normalize suffix
    if (options.suffix !== undefined && options.suffix !== '') {
      const suffixValidation = validateSuffix(options.suffix);
      if (!suffixValidation.valid) {
        throw new VanityError(
          VanityErrorType.INVALID_CHARACTERS,
          `Invalid suffix: ${suffixValidation.errors.join(', ')}`,
          { suffix: options.suffix }
        );
      }
      this.suffix = this.normalizePattern(options.suffix);
      this.suffixLength = options.suffix.length;
    } else {
      this.suffix = undefined;
      this.suffixLength = 0;
    }

    // Must have at least one pattern
    if (this.prefix === undefined && this.suffix === undefined) {
      throw new VanityError(
        VanityErrorType.NO_PATTERN_SPECIFIED,
        'At least one of prefix or suffix must be specified'
      );
    }
  }

  /**
   * Checks if the given address matches the configured patterns.
   * This method is optimized for the hot path during generation.
   *
   * @param address - The Base58-encoded address to check
   * @returns True if the address matches all configured patterns
   */
  public matches(address: string): boolean {
    // Check prefix if specified
    if (this.prefix !== undefined) {
      const addressPrefix = this.ignoreCase
        ? address.substring(0, this.prefixLength).toLowerCase()
        : address.substring(0, this.prefixLength);

      if (addressPrefix !== this.prefix) {
        return false;
      }
    }

    // Check suffix if specified
    if (this.suffix !== undefined) {
      const addressSuffix = this.ignoreCase
        ? address.substring(address.length - this.suffixLength).toLowerCase()
        : address.substring(address.length - this.suffixLength);

      if (addressSuffix !== this.suffix) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if the address matches the prefix pattern only.
   * Useful for partial matching during progress reporting.
   *
   * @param address - The Base58-encoded address to check
   * @returns True if the address matches the prefix (or no prefix is specified)
   */
  public matchesPrefix(address: string): boolean {
    if (this.prefix === undefined) {
      return true;
    }

    const addressPrefix = this.ignoreCase
      ? address.substring(0, this.prefixLength).toLowerCase()
      : address.substring(0, this.prefixLength);

    return addressPrefix === this.prefix;
  }

  /**
   * Checks if the address matches the suffix pattern only.
   * Useful for partial matching during progress reporting.
   *
   * @param address - The Base58-encoded address to check
   * @returns True if the address matches the suffix (or no suffix is specified)
   */
  public matchesSuffix(address: string): boolean {
    if (this.suffix === undefined) {
      return true;
    }

    const addressSuffix = this.ignoreCase
      ? address.substring(address.length - this.suffixLength).toLowerCase()
      : address.substring(address.length - this.suffixLength);

    return addressSuffix === this.suffix;
  }

  /**
   * Returns information about the configured patterns.
   * Useful for logging and user feedback.
   *
   * @returns Object containing pattern information
   */
  public getPatternInfo(): {
    prefix: string | undefined;
    suffix: string | undefined;
    ignoreCase: boolean;
    totalLength: number;
  } {
    return {
      prefix: this.prefix,
      suffix: this.suffix,
      ignoreCase: this.ignoreCase,
      totalLength: this.prefixLength + this.suffixLength,
    };
  }

  /**
   * Normalizes a pattern for matching.
   * For case-insensitive matching, converts to lowercase.
   *
   * @param pattern - The pattern to normalize
   * @returns The normalized pattern
   */
  private normalizePattern(pattern: string): string {
    return this.ignoreCase ? pattern.toLowerCase() : pattern;
  }
}

/**
 * Creates a simple matcher function for use without the class interface.
 * This can be more convenient for simple use cases.
 *
 * @param options - Matching options
 * @returns A function that takes an address and returns whether it matches
 */
export function createMatcher(options: MatcherOptions): (address: string) => boolean {
  const matcher = new AddressMatcher(options);
  return (address: string): boolean => matcher.matches(address);
}

/**
 * Checks if an address starts with the given prefix.
 * Standalone function for simple use cases.
 *
 * @param address - The address to check
 * @param prefix - The prefix to match
 * @param ignoreCase - Whether to ignore case
 * @returns True if the address starts with the prefix
 */
export function startsWithPrefix(
  address: string,
  prefix: string,
  ignoreCase: boolean = false
): boolean {
  if (ignoreCase) {
    return address.toLowerCase().startsWith(prefix.toLowerCase());
  }
  return address.startsWith(prefix);
}

/**
 * Checks if an address ends with the given suffix.
 * Standalone function for simple use cases.
 *
 * @param address - The address to check
 * @param suffix - The suffix to match
 * @param ignoreCase - Whether to ignore case
 * @returns True if the address ends with the suffix
 */
export function endsWithSuffix(
  address: string,
  suffix: string,
  ignoreCase: boolean = false
): boolean {
  if (ignoreCase) {
    return address.toLowerCase().endsWith(suffix.toLowerCase());
  }
  return address.endsWith(suffix);
}
