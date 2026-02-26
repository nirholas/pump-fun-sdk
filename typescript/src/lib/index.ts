/**
 * @fileoverview Public API exports for the solana-vanity-ts library.
 * @module solana-vanity-ts
 */

// Core types
export type {
  VanityOptions,
  GenerationResult,
  ValidationResult,
  MatcherOptions,
  GenerationStats,
  OutputOptions,
} from './types';

export { VanityError, VanityErrorType } from './types';

// Generator
export {
  VanityGenerator,
  generateVanityAddress,
  generateMultipleVanityAddresses,
  createVanityGenerator,
} from './generator';

// Matcher
export { AddressMatcher, createMatcher, startsWithPrefix, endsWithSuffix } from './matcher';

// Validation
export {
  BASE58_ALPHABET,
  MAX_PATTERN_LENGTH,
  isValidBase58Char,
  validatePrefix,
  validateSuffix,
  validatePattern,
  sanitizeInput,
  validateVanityInput,
  estimateAttempts,
  formatTimeEstimate,
} from './validation';

// Output
export {
  saveKeypair,
  verifyKeypairFile,
  loadKeypair,
  generateSummary,
  getKeypairFileStats,
} from './output';

// Security
export {
  clearSensitiveData,
  createSecureBuffer,
  verifyFilePermissions,
  verifyFilePermissionsSync,
  setSecurePermissions,
  isRunningAsRoot,
  getSecurityWarnings,
  isLikelyVirtualized,
  isRunningOverSSH,
  hasTTY,
  generateSecureFileSuffix,
  performSecurityChecks,
} from './security';

// Utilities
export * from '../utils/base58';
export * from '../utils/format';
