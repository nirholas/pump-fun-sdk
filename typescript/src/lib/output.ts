/**
 * @fileoverview File output handling for generated keypairs.
 * Ensures secure file permissions and proper Solana CLI-compatible format.
 * @module output
 */

import * as fs from 'fs';
import * as path from 'path';
import { Keypair } from '@solana/web3.js';
import { OutputOptions, VanityError, VanityErrorType } from './types';

/**
 * Secure file permissions: owner read/write only (0600 in octal).
 * This prevents other users from reading the private key file.
 */
const SECURE_FILE_MODE = 0o600;

/**
 * Saves a keypair's secret key to a file in Solana CLI-compatible JSON format.
 *
 * The file is saved with secure permissions (0600) and verified after writing.
 * The format is a JSON array of bytes, compatible with `solana-keygen` output.
 *
 * @param secretKey - The 64-byte secret key to save
 * @param outputPath - The path to save the file to
 * @param options - Optional output options
 * @throws VanityError if the file already exists or cannot be written
 *
 * @example
 * ```typescript
 * await saveKeypair(result.secretKey, './my-vanity-keypair.json');
 * // File can be used with: solana config set --keypair ./my-vanity-keypair.json
 * ```
 */
export async function saveKeypair(
  secretKey: Uint8Array,
  outputPath: string,
  options?: Partial<OutputOptions>
): Promise<void> {
  const resolvedPath = path.resolve(outputPath);
  const overwrite = options?.overwrite ?? false;
  const verify = options?.verify ?? true;

  // Check if file already exists
  if (!overwrite) {
    try {
      await fs.promises.access(resolvedPath, fs.constants.F_OK);
      // File exists, throw error
      throw new VanityError(
        VanityErrorType.FILE_EXISTS,
        `File already exists: ${resolvedPath}. Use --overwrite to replace it.`,
        { filePath: resolvedPath }
      );
    } catch (error) {
      // If error is our VanityError, rethrow it
      if (error instanceof VanityError) {
        throw error;
      }
      // Otherwise, file doesn't exist, which is what we want
    }
  }

  // Create directory if it doesn't exist
  const directory = path.dirname(resolvedPath);
  try {
    await fs.promises.mkdir(directory, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VanityError(VanityErrorType.FILE_ERROR, `Failed to create directory: ${message}`, {
      filePath: resolvedPath,
      directory,
      originalError: message,
    });
  }

  // Convert secret key to JSON array format (Solana CLI compatible)
  const jsonContent = JSON.stringify(Array.from(secretKey));

  try {
    // Write file with secure permissions
    // Using writeFile with mode option sets permissions during creation
    await fs.promises.writeFile(resolvedPath, jsonContent, {
      mode: SECURE_FILE_MODE,
      encoding: 'utf8',
    });

    // Explicitly set permissions (in case umask affected initial creation)
    await fs.promises.chmod(resolvedPath, SECURE_FILE_MODE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VanityError(VanityErrorType.FILE_ERROR, `Failed to write keypair file: ${message}`, {
      filePath: resolvedPath,
      originalError: message,
    });
  }

  // Verify the written file if requested
  if (verify) {
    const verified = await verifyKeypairFile(resolvedPath, secretKey);
    if (!verified) {
      // Attempt to delete the corrupted file
      try {
        await fs.promises.unlink(resolvedPath);
      } catch {
        // Ignore deletion errors
      }
      throw new VanityError(
        VanityErrorType.VERIFICATION_FAILED,
        'Written keypair file failed verification. The file may be corrupted.',
        { filePath: resolvedPath }
      );
    }
  }
}

/**
 * Verifies that a keypair file contains the expected secret key.
 *
 * @param filePath - The path to the keypair file
 * @param expectedSecretKey - The expected secret key bytes
 * @returns True if the file contains the expected secret key
 */
export async function verifyKeypairFile(
  filePath: string,
  expectedSecretKey: Uint8Array
): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const parsedArray: unknown = JSON.parse(content);

    // Validate it's an array
    if (!Array.isArray(parsedArray)) {
      return false;
    }

    // Validate length
    if (parsedArray.length !== 64) {
      return false;
    }

    // Validate each byte
    for (let i = 0; i < 64; i++) {
      const expectedByte = expectedSecretKey[i];
      const actualByte = parsedArray[i] as unknown;

      if (typeof actualByte !== 'number' || actualByte !== expectedByte) {
        return false;
      }
    }

    // Additionally verify by reconstructing keypair and checking public key
    const keypairFromFile = Keypair.fromSecretKey(new Uint8Array(parsedArray as number[]));
    const keypairFromExpected = Keypair.fromSecretKey(expectedSecretKey);

    return keypairFromFile.publicKey.equals(keypairFromExpected.publicKey);
  } catch {
    return false;
  }
}

/**
 * Loads a keypair from a file in Solana CLI format.
 *
 * @param filePath - The path to the keypair file
 * @returns The loaded Keypair
 * @throws VanityError if the file cannot be read or parsed
 */
export async function loadKeypair(filePath: string): Promise<Keypair> {
  const resolvedPath = path.resolve(filePath);

  try {
    const content = await fs.promises.readFile(resolvedPath, 'utf8');
    const parsedArray: unknown = JSON.parse(content);

    if (!Array.isArray(parsedArray)) {
      throw new Error('File content is not a JSON array');
    }

    if (parsedArray.length !== 64) {
      throw new Error(`Invalid key length: expected 64 bytes, got ${parsedArray.length}`);
    }

    // Validate all elements are numbers in valid byte range
    for (let i = 0; i < parsedArray.length; i++) {
      const byte = parsedArray[i] as unknown;
      if (typeof byte !== 'number' || byte < 0 || byte > 255 || !Number.isInteger(byte)) {
        throw new Error(`Invalid byte at position ${i}: ${String(byte)}`);
      }
    }

    return Keypair.fromSecretKey(new Uint8Array(parsedArray as number[]));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VanityError(VanityErrorType.FILE_ERROR, `Failed to load keypair: ${message}`, {
      filePath: resolvedPath,
      originalError: message,
    });
  }
}

/**
 * Generates a summary of the keypair for display purposes.
 * SECURITY: This only includes the public key, never the secret key.
 *
 * @param publicKey - The public key (address) to summarize
 * @param filePath - The file path where the keypair was saved
 * @returns A formatted summary string
 */
export function generateSummary(publicKey: string, filePath: string): string {
  const resolvedPath = path.resolve(filePath);

  return [
    '═══════════════════════════════════════════════════════════════════',
    '                    VANITY ADDRESS GENERATED                        ',
    '═══════════════════════════════════════════════════════════════════',
    '',
    `  Public Key (Address): ${publicKey}`,
    '',
    `  Keypair saved to: ${resolvedPath}`,
    '',
    '  IMPORTANT SECURITY NOTES:',
    '  ─────────────────────────',
    '  • The keypair file contains your PRIVATE KEY',
    '  • Never share this file with anyone',
    '  • Store it in a secure location',
    '  • Consider creating a backup in a safe place',
    '',
    '  USAGE:',
    '  ──────',
    '  • Set as default keypair:',
    `    solana config set --keypair ${resolvedPath}`,
    '',
    '  • Check balance:',
    `    solana balance ${publicKey}`,
    '',
    '  • Airdrop (devnet/testnet only):',
    `    solana airdrop 1 ${publicKey}`,
    '',
    '═══════════════════════════════════════════════════════════════════',
  ].join('\n');
}

/**
 * Gets the file stats for a keypair file.
 *
 * @param filePath - The path to the keypair file
 * @returns Object containing file stats
 */
export async function getKeypairFileStats(
  filePath: string
): Promise<{
  exists: boolean;
  size: number | null;
  mode: number | null;
  isSecure: boolean;
}> {
  try {
    const stats = await fs.promises.stat(filePath);
    // Check if permissions are secure (owner read/write only)
    // eslint-disable-next-line no-bitwise
    const mode = stats.mode & 0o777;
    const isSecure = mode === SECURE_FILE_MODE;

    return {
      exists: true,
      size: stats.size,
      mode,
      isSecure,
    };
  } catch {
    return {
      exists: false,
      size: null,
      mode: null,
      isSecure: false,
    };
  }
}
