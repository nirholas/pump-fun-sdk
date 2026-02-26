/**
 * @fileoverview Type definitions for the Solana vanity address generator.
 * @module types
 */

/**
 * Options for configuring the vanity address generation.
 */
export interface VanityOptions {
  /**
   * The prefix that the generated address should start with.
   * Must contain only valid Base58 characters.
   */
  prefix?: string;

  /**
   * The suffix that the generated address should end with.
   * Must contain only valid Base58 characters.
   */
  suffix?: string;

  /**
   * Whether to perform case-insensitive matching.
   * @default false
   */
  ignoreCase?: boolean;

  /**
   * Maximum number of attempts before giving up.
   * If not specified, generation continues until a match is found.
   */
  maxAttempts?: number;

  /**
   * Callback function for progress reporting.
   * Called approximately every 1000 attempts.
   * @param attempts - The current number of attempts made
   * @param rate - The generation rate in attempts per second
   */
  onProgress?: (attempts: number, rate: number) => void;
}

/**
 * Result of a successful vanity address generation.
 */
export interface GenerationResult {
  /**
   * The Base58-encoded public key (the vanity address).
   */
  publicKey: string;

  /**
   * The 64-byte secret key for the keypair.
   * SECURITY: This must be handled securely and never logged or exposed.
   */
  secretKey: Uint8Array;

  /**
   * The number of attempts it took to find this address.
   */
  attempts: number;

  /**
   * The time taken to find this address in milliseconds.
   */
  duration: number;
}

/**
 * Result of input validation.
 */
export interface ValidationResult {
  /**
   * Whether the input is valid.
   */
  valid: boolean;

  /**
   * Array of error messages if validation failed.
   * Empty if valid is true.
   */
  errors: string[];
}

/**
 * Options for the address matcher.
 */
export interface MatcherOptions {
  /**
   * The prefix to match against addresses.
   */
  prefix?: string;

  /**
   * The suffix to match against addresses.
   */
  suffix?: string;

  /**
   * Whether to perform case-insensitive matching.
   * @default false
   */
  ignoreCase?: boolean;
}

/**
 * Statistics about the generation process.
 */
export interface GenerationStats {
  /**
   * Total number of attempts made.
   */
  totalAttempts: number;

  /**
   * Total time elapsed in milliseconds.
   */
  elapsedTime: number;

  /**
   * Average generation rate in attempts per second.
   */
  averageRate: number;

  /**
   * Peak generation rate observed in attempts per second.
   */
  peakRate: number;
}

/**
 * Configuration for file output operations.
 */
export interface OutputOptions {
  /**
   * The file path to save the keypair to.
   */
  filePath: string;

  /**
   * Whether to overwrite existing files.
   * @default false
   */
  overwrite?: boolean;

  /**
   * Whether to verify the file after writing.
   * @default true
   */
  verify?: boolean;
}

/**
 * Error types specific to vanity address generation.
 */
export enum VanityErrorType {
  /** Invalid input characters (not valid Base58) */
  INVALID_CHARACTERS = 'INVALID_CHARACTERS',
  /** Input is too long */
  INPUT_TOO_LONG = 'INPUT_TOO_LONG',
  /** Maximum attempts reached without finding a match */
  MAX_ATTEMPTS_REACHED = 'MAX_ATTEMPTS_REACHED',
  /** File operation failed */
  FILE_ERROR = 'FILE_ERROR',
  /** File already exists and overwrite is not enabled */
  FILE_EXISTS = 'FILE_EXISTS',
  /** Verification of written file failed */
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  /** No prefix or suffix specified */
  NO_PATTERN_SPECIFIED = 'NO_PATTERN_SPECIFIED',
}

/**
 * Custom error class for vanity address generation errors.
 */
export class VanityError extends Error {
  /**
   * The type of error that occurred.
   */
  public readonly type: VanityErrorType;

  /**
   * Additional details about the error.
   */
  public readonly details: Record<string, unknown> | undefined;

  constructor(type: VanityErrorType, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'VanityError';
    this.type = type;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace !== undefined) {
      Error.captureStackTrace(this, VanityError);
    }
  }
}
