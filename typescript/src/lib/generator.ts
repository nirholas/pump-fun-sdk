/**
 * @fileoverview Core vanity address generation logic.
 * Uses @solana/web3.js Keypair.generate() for cryptographically secure key generation.
 * @module generator
 */

import { Keypair } from '@solana/web3.js';
import { AddressMatcher } from './matcher';
import {
  VanityOptions,
  GenerationResult,
  GenerationStats,
  VanityError,
  VanityErrorType,
} from './types';
import { validateVanityInput, estimateAttempts, formatTimeEstimate } from './validation';

/**
 * The default progress reporting interval (every N attempts).
 */
const DEFAULT_PROGRESS_INTERVAL = 1000;

/**
 * Vanity address generator using @solana/web3.js.
 *
 * This class provides a safe, educational implementation of vanity address generation.
 * It uses the official Solana web3.js library's Keypair.generate() function, which
 * internally uses a cryptographically secure random number generator.
 *
 * @example
 * ```typescript
 * const generator = new VanityGenerator({
 *   prefix: 'So',
 *   onProgress: (attempts, rate) => console.log(`${attempts} attempts, ${rate}/sec`)
 * });
 *
 * const result = await generator.generate();
 * console.log(`Found: ${result.publicKey}`);
 * ```
 */
export class VanityGenerator {
  /** The address matcher for prefix/suffix checking */
  private readonly matcher: AddressMatcher;

  /** Generation options */
  private readonly options: VanityOptions;

  /** Statistics about the generation process */
  private stats: GenerationStats;

  /**
   * Creates a new VanityGenerator instance.
   *
   * @param options - Generation options including prefix, suffix, and callbacks
   * @throws VanityError if options are invalid
   */
  constructor(options: VanityOptions) {
    // Validate input options
    validateVanityInput(options.prefix, options.suffix);

    this.options = options;

    // Build matcher options, only including defined values
    const matcherOptions: {
      prefix?: string;
      suffix?: string;
      ignoreCase?: boolean;
    } = {};

    if (options.prefix !== undefined && options.prefix !== '') {
      matcherOptions.prefix = options.prefix;
    }
    if (options.suffix !== undefined && options.suffix !== '') {
      matcherOptions.suffix = options.suffix;
    }
    if (options.ignoreCase !== undefined) {
      matcherOptions.ignoreCase = options.ignoreCase;
    }

    this.matcher = new AddressMatcher(matcherOptions);

    this.stats = {
      totalAttempts: 0,
      elapsedTime: 0,
      averageRate: 0,
      peakRate: 0,
    };
  }

  /**
   * Generates a vanity address matching the configured pattern.
   *
   * This method will run until it finds a matching address or reaches
   * the maximum number of attempts (if configured).
   *
   * @returns Promise resolving to the generation result
   * @throws VanityError if max attempts reached without finding a match
   */
  public async generate(): Promise<GenerationResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastProgressTime = startTime;
    let lastProgressAttempts = 0;

    // Log expected difficulty
    const estimatedAttempts = estimateAttempts(
      this.options.prefix,
      this.options.suffix,
      this.options.ignoreCase
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Generate a new random keypair
      // Note: Keypair.generate() uses crypto.randomBytes internally
      const keypair = Keypair.generate();
      const address = keypair.publicKey.toBase58();
      attempts++;

      // Progress callback
      if (this.options.onProgress !== undefined && attempts % DEFAULT_PROGRESS_INTERVAL === 0) {
        const now = Date.now();
        const intervalDuration = (now - lastProgressTime) / 1000;
        const intervalAttempts = attempts - lastProgressAttempts;
        const currentRate = intervalDuration > 0 ? intervalAttempts / intervalDuration : 0;

        // Update peak rate
        if (currentRate > this.stats.peakRate) {
          this.stats.peakRate = currentRate;
        }

        this.options.onProgress(attempts, currentRate);

        lastProgressTime = now;
        lastProgressAttempts = attempts;
      }

      // Check max attempts
      if (this.options.maxAttempts !== undefined && attempts >= this.options.maxAttempts) {
        throw new VanityError(
          VanityErrorType.MAX_ATTEMPTS_REACHED,
          `Maximum attempts (${this.options.maxAttempts.toLocaleString()}) reached without finding a match. ` +
            `Expected attempts: ~${estimatedAttempts.toLocaleString()}. Try increasing max attempts or using a shorter pattern.`,
          {
            maxAttempts: this.options.maxAttempts,
            estimatedAttempts,
            prefix: this.options.prefix,
            suffix: this.options.suffix,
          }
        );
      }

      // Check if address matches
      if (this.matcher.matches(address)) {
        const duration = Date.now() - startTime;

        // Update stats
        this.stats.totalAttempts = attempts;
        this.stats.elapsedTime = duration;
        this.stats.averageRate = duration > 0 ? (attempts / duration) * 1000 : 0;

        return {
          publicKey: address,
          secretKey: keypair.secretKey,
          attempts,
          duration,
        };
      }

      // Yield to event loop periodically to prevent blocking
      // This is important for progress callbacks and cancellation
      if (attempts % 10000 === 0) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
  }

  /**
   * Gets the current generation statistics.
   * @returns The current statistics
   */
  public getStats(): GenerationStats {
    return { ...this.stats };
  }

  /**
   * Gets information about the pattern being searched for.
   * @returns Pattern information from the matcher
   */
  public getPatternInfo(): ReturnType<AddressMatcher['getPatternInfo']> {
    return this.matcher.getPatternInfo();
  }

  /**
   * Estimates the expected number of attempts to find a matching address.
   * @returns The expected number of attempts
   */
  public getEstimatedAttempts(): number {
    return estimateAttempts(this.options.prefix, this.options.suffix, this.options.ignoreCase);
  }

  /**
   * Formats the estimated time to find a match based on a given rate.
   * @param ratePerSecond - The generation rate in attempts per second
   * @returns A human-readable time estimate
   */
  public getTimeEstimate(ratePerSecond: number): string {
    const estimated = this.getEstimatedAttempts();
    return formatTimeEstimate(estimated, ratePerSecond);
  }
}

/**
 * Generates a single vanity address with the given options.
 * Convenience function that creates a generator and runs it.
 *
 * @param options - Generation options
 * @returns Promise resolving to the generation result
 */
export async function generateVanityAddress(options: VanityOptions): Promise<GenerationResult> {
  const generator = new VanityGenerator(options);
  return generator.generate();
}

/**
 * Generates multiple vanity addresses with the same pattern.
 *
 * @param options - Generation options (maxAttempts applies per address)
 * @param count - Number of addresses to generate
 * @param onAddressFound - Optional callback when each address is found
 * @returns Promise resolving to array of generation results
 */
export async function generateMultipleVanityAddresses(
  options: VanityOptions,
  count: number,
  onAddressFound?: (result: GenerationResult, index: number) => void
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  for (let i = 0; i < count; i++) {
    const generator = new VanityGenerator(options);
    const result = await generator.generate();
    results.push(result);

    if (onAddressFound !== undefined) {
      onAddressFound(result, i);
    }
  }

  return results;
}

/**
 * Creates a generator and provides an async iterator for generating addresses.
 * Useful for streaming generation or generating with cancellation support.
 *
 * @param options - Generation options
 * @yields GenerationResult for each found address
 */
export async function* createVanityGenerator(
  options: VanityOptions
): AsyncGenerator<GenerationResult, void, undefined> {
  while (true) {
    const generator = new VanityGenerator(options);
    yield await generator.generate();
  }
}
