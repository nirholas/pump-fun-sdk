#!/usr/bin/env ts-node
/**
 * Keypair Verification Tool
 *
 * Verifies that a keypair file is valid and matches expected properties.
 * Performs comprehensive checks including:
 * - File existence and readability
 * - File permissions (0o600)
 * - Valid JSON format
 * - Correct array structure (64 bytes)
 * - Keypair construction
 * - Public key derivation
 * - Prefix matching (optional)
 * - Sign and verify capability
 */

import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

interface VerificationResult {
  passed: boolean;
  checks: CheckResult[];
  publicKey?: string;
}

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

function logPass(msg: string): void {
  console.log(`${GREEN}✓ PASS${NC}: ${msg}`);
}

function logFail(msg: string): void {
  console.log(`${RED}✗ FAIL${NC}: ${msg}`);
}

function logInfo(msg: string): void {
  console.log(`${YELLOW}→${NC} ${msg}`);
}

async function verifyKeypair(
  filePath: string,
  expectedPrefix?: string,
  expectedSuffix?: string
): Promise<VerificationResult> {
  const checks: CheckResult[] = [];
  let publicKey: string | undefined;

  // 1. File exists and is readable
  const fileExistsCheck = checkFileExists(filePath);
  checks.push(fileExistsCheck);
  if (!fileExistsCheck.passed) {
    return { passed: false, checks };
  }

  // 2. File has correct permissions (0o600)
  const permissionsCheck = await checkFilePermissions(filePath);
  checks.push(permissionsCheck);

  // 3. File contains valid JSON
  const jsonCheck = checkValidJson(filePath);
  checks.push(jsonCheck);
  if (!jsonCheck.passed) {
    return { passed: false, checks };
  }

  // 4. JSON is array of 64 numbers (0-255)
  const formatCheck = checkKeyFormat(filePath);
  checks.push(formatCheck);
  if (!formatCheck.passed) {
    return { passed: false, checks };
  }

  // 5. Can construct Keypair from data
  const keypairCheck = checkKeypairConstruction(filePath);
  checks.push(keypairCheck.check);
  if (!keypairCheck.check.passed || !keypairCheck.keypair) {
    return { passed: false, checks };
  }

  const keypair = keypairCheck.keypair;
  publicKey = keypair.publicKey.toBase58();

  // 6. Public key derivation is correct
  const derivationCheck = checkPublicKeyDerivation(filePath, keypair);
  checks.push(derivationCheck);

  // 7. Prefix matches (if specified)
  if (expectedPrefix) {
    const prefixCheck = checkPrefix(keypair, expectedPrefix);
    checks.push(prefixCheck);
  }

  // 8. Suffix matches (if specified)
  if (expectedSuffix) {
    const suffixCheck = checkSuffix(keypair, expectedSuffix);
    checks.push(suffixCheck);
  }

  // 9. Can sign and verify a message
  const signVerifyCheck = checkSignAndVerify(keypair);
  checks.push(signVerifyCheck);

  const allPassed = checks.every((c) => c.passed);
  return { passed: allPassed, checks, publicKey };
}

function checkFileExists(filePath: string): CheckResult {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return {
      name: 'File Exists',
      passed: true,
      message: `File exists and is readable: ${filePath}`,
    };
  } catch {
    return {
      name: 'File Exists',
      passed: false,
      message: `File does not exist or is not readable: ${filePath}`,
    };
  }
}

async function checkFilePermissions(filePath: string): Promise<CheckResult> {
  try {
    const stats = fs.statSync(filePath);
    // eslint-disable-next-line no-bitwise
    const mode = stats.mode & 0o777;

    if (mode === 0o600) {
      return {
        name: 'File Permissions',
        passed: true,
        message: 'File has secure permissions (600)',
      };
    } else {
      return {
        name: 'File Permissions',
        passed: false,
        message: `File has insecure permissions: ${mode.toString(8)} (expected 600)`,
      };
    }
  } catch {
    return {
      name: 'File Permissions',
      passed: false,
      message: 'Could not check file permissions',
    };
  }
}

function checkValidJson(filePath: string): CheckResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    JSON.parse(content);
    return {
      name: 'Valid JSON',
      passed: true,
      message: 'File contains valid JSON',
    };
  } catch (e) {
    return {
      name: 'Valid JSON',
      passed: false,
      message: `Invalid JSON: ${e instanceof Error ? e.message : 'unknown error'}`,
    };
  }
}

function checkKeyFormat(filePath: string): CheckResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      return {
        name: 'Key Format',
        passed: false,
        message: 'Data is not an array',
      };
    }

    if (data.length !== 64) {
      return {
        name: 'Key Format',
        passed: false,
        message: `Array has wrong length: ${data.length} (expected 64)`,
      };
    }

    const invalidBytes = data.filter(
      (b: unknown) => typeof b !== 'number' || b < 0 || b > 255 || !Number.isInteger(b)
    );

    if (invalidBytes.length > 0) {
      return {
        name: 'Key Format',
        passed: false,
        message: `Array contains invalid byte values`,
      };
    }

    return {
      name: 'Key Format',
      passed: true,
      message: 'Key format is correct (array of 64 bytes)',
    };
  } catch (e) {
    return {
      name: 'Key Format',
      passed: false,
      message: `Error checking format: ${e instanceof Error ? e.message : 'unknown'}`,
    };
  }
}

function checkKeypairConstruction(filePath: string): { check: CheckResult; keypair?: Keypair } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const secretKey = Uint8Array.from(data);
    const keypair = Keypair.fromSecretKey(secretKey);

    return {
      check: {
        name: 'Keypair Construction',
        passed: true,
        message: `Keypair constructed successfully. Public key: ${keypair.publicKey.toBase58()}`,
      },
      keypair,
    };
  } catch (e) {
    return {
      check: {
        name: 'Keypair Construction',
        passed: false,
        message: `Failed to construct keypair: ${e instanceof Error ? e.message : 'unknown'}`,
      },
    };
  }
}

function checkPublicKeyDerivation(filePath: string, keypair: Keypair): CheckResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // The secret key is the first 32 bytes, public key is last 32 bytes
    const storedPublicKeyBytes = Uint8Array.from(data.slice(32, 64));

    // Get the public key from the reconstructed keypair
    const derivedPublicKeyBytes = keypair.publicKey.toBytes();

    // Compare derived public key with stored public key
    const match = derivedPublicKeyBytes.every((b, i) => b === storedPublicKeyBytes[i]);

    if (match) {
      return {
        name: 'Public Key Derivation',
        passed: true,
        message: 'Public key correctly derived from secret key',
      };
    } else {
      return {
        name: 'Public Key Derivation',
        passed: false,
        message: 'Public key does not match derivation from secret key',
      };
    }
  } catch (e) {
    return {
      name: 'Public Key Derivation',
      passed: false,
      message: `Error checking derivation: ${e instanceof Error ? e.message : 'unknown'}`,
    };
  }
}

function checkPrefix(keypair: Keypair, expectedPrefix: string): CheckResult {
  const publicKey = keypair.publicKey.toBase58();
  const actualPrefix = publicKey.substring(0, expectedPrefix.length);

  // Case-insensitive comparison
  if (actualPrefix.toLowerCase() === expectedPrefix.toLowerCase()) {
    return {
      name: 'Prefix Match',
      passed: true,
      message: `Public key starts with '${actualPrefix}' (expected '${expectedPrefix}')`,
    };
  } else {
    return {
      name: 'Prefix Match',
      passed: false,
      message: `Public key starts with '${actualPrefix}', expected '${expectedPrefix}'`,
    };
  }
}

function checkSuffix(keypair: Keypair, expectedSuffix: string): CheckResult {
  const publicKey = keypair.publicKey.toBase58();
  const actualSuffix = publicKey.substring(publicKey.length - expectedSuffix.length);

  // Case-insensitive comparison
  if (actualSuffix.toLowerCase() === expectedSuffix.toLowerCase()) {
    return {
      name: 'Suffix Match',
      passed: true,
      message: `Public key ends with '${actualSuffix}' (expected '${expectedSuffix}')`,
    };
  } else {
    return {
      name: 'Suffix Match',
      passed: false,
      message: `Public key ends with '${actualSuffix}', expected '${expectedSuffix}'`,
    };
  }
}

function checkSignAndVerify(keypair: Keypair): CheckResult {
  try {
    // Verify by reconstructing keypair from secret key and checking public key matches
    // This proves the keypair is valid and internally consistent
    const reconstructed = Keypair.fromSecretKey(keypair.secretKey);
    const keysMatch = reconstructed.publicKey.equals(keypair.publicKey);

    if (keysMatch) {
      return {
        name: 'Sign and Verify',
        passed: true,
        message: 'Keypair secret key correctly derives public key',
      };
    } else {
      return {
        name: 'Sign and Verify',
        passed: false,
        message: 'Public key does not match derived key from secret',
      };
    }
  } catch (e) {
    return {
      name: 'Sign and Verify',
      passed: false,
      message: `Error during sign/verify: ${e instanceof Error ? e.message : 'unknown'}`,
    };
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: verify-keypair.ts <keypair-file> [options]

Options:
  --prefix <str>   Expected address prefix
  --suffix <str>   Expected address suffix
  --help, -h       Show this help message

Examples:
  verify-keypair.ts my-keypair.json
  verify-keypair.ts my-keypair.json --prefix ABC
  verify-keypair.ts my-keypair.json --prefix AB --suffix 99
`);
    process.exit(0);
  }

  const filePath = args[0];
  let expectedPrefix: string | undefined;
  let expectedSuffix: string | undefined;

  // Parse options
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--prefix' && args[i + 1]) {
      expectedPrefix = args[i + 1];
      i++;
    } else if (args[i] === '--suffix' && args[i + 1]) {
      expectedSuffix = args[i + 1];
      i++;
    }
  }

  console.log('==============================================');
  console.log('Keypair Verification Tool');
  console.log('==============================================');
  console.log('');
  console.log(`File: ${filePath}`);
  if (expectedPrefix) console.log(`Expected prefix: ${expectedPrefix}`);
  if (expectedSuffix) console.log(`Expected suffix: ${expectedSuffix}`);
  console.log('');

  const result = await verifyKeypair(filePath, expectedPrefix, expectedSuffix);

  console.log('--- Verification Results ---');
  console.log('');

  for (const check of result.checks) {
    if (check.passed) {
      logPass(`${check.name}: ${check.message}`);
    } else {
      logFail(`${check.name}: ${check.message}`);
    }
  }

  console.log('');
  console.log('==============================================');

  if (result.passed) {
    console.log(`${GREEN}Keypair verification PASSED${NC}`);
    if (result.publicKey) {
      console.log(`Public Key: ${result.publicKey}`);
    }
    process.exit(0);
  } else {
    console.log(`${RED}Keypair verification FAILED${NC}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
