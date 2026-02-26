/**
 * @fileoverview Security utilities for safe keypair handling.
 * Provides functions for secure memory handling and security checks.
 * @module security
 */

import * as fs from 'fs';
import * as os from 'os';
import * as process from 'process';

/**
 * Secure file permissions: owner read/write only (0600 in octal).
 */
const SECURE_FILE_MODE = 0o600;

/**
 * Clears sensitive data from a Uint8Array.
 *
 * IMPORTANT: This is a best-effort operation in JavaScript/Node.js.
 * JavaScript does not provide guarantees about memory clearing, and the
 * garbage collector may have already made copies of the data. However,
 * this is still a good practice to follow as it reduces the window of
 * exposure.
 *
 * For truly sensitive applications, consider using native modules or
 * a language with better memory control guarantees (like Rust).
 *
 * @param data - The Uint8Array to clear
 */
export function clearSensitiveData(data: Uint8Array): void {
  // Fill with zeros
  data.fill(0);

  // Fill with random data (makes it harder to recover original data)
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }

  // Fill with zeros again
  data.fill(0);
}

/**
 * Creates a secure buffer for sensitive data.
 * This is primarily for documentation purposes in Node.js, as true secure
 * memory allocation requires native extensions.
 *
 * @param size - The size of the buffer to create
 * @returns A new Uint8Array of the specified size
 */
export function createSecureBuffer(size: number): Uint8Array {
  // In a production environment with native extensions, this could use
  // mlock() to prevent swapping to disk. In pure JavaScript, we can only
  // create a regular buffer.
  return new Uint8Array(size);
}

/**
 * Verifies that a file has secure permissions (owner read/write only).
 *
 * @param filePath - The path to the file to check
 * @returns True if the file has secure permissions
 */
export async function verifyFilePermissions(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(filePath);
    // eslint-disable-next-line no-bitwise
    const mode = stats.mode & 0o777;
    return mode === SECURE_FILE_MODE;
  } catch {
    return false;
  }
}

/**
 * Synchronously verifies that a file has secure permissions.
 *
 * @param filePath - The path to the file to check
 * @returns True if the file has secure permissions
 */
export function verifyFilePermissionsSync(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    // eslint-disable-next-line no-bitwise
    const mode = stats.mode & 0o777;
    return mode === SECURE_FILE_MODE;
  } catch {
    return false;
  }
}

/**
 * Sets secure permissions on a file.
 *
 * @param filePath - The path to the file to secure
 * @throws Error if permissions cannot be set
 */
export async function setSecurePermissions(filePath: string): Promise<void> {
  await fs.promises.chmod(filePath, SECURE_FILE_MODE);
}

/**
 * Checks if the current process is running as root/administrator.
 * Running cryptographic key generation as root is generally discouraged.
 *
 * @returns True if running as root
 */
export function isRunningAsRoot(): boolean {
  // On Unix-like systems, check UID
  if (process.getuid !== undefined) {
    return process.getuid() === 0;
  }

  // On Windows, check for administrator
  // This is a simplified check; a more robust check would use native modules
  return false;
}

/**
 * Gets security warnings based on the current environment.
 *
 * @returns Array of warning messages
 */
export function getSecurityWarnings(): string[] {
  const warnings: string[] = [];

  // Check if running as root
  if (isRunningAsRoot()) {
    warnings.push(
      'WARNING: Running as root/administrator is not recommended for key generation. ' +
        'Consider running as a regular user.'
    );
  }

  // Check if in a VM or container (best effort detection)
  if (isLikelyVirtualized()) {
    warnings.push(
      'NOTE: This appears to be running in a virtualized environment. ' +
        'Ensure the host system has adequate entropy for secure random number generation.'
    );
  }

  // Check if running over SSH without proper terminal
  if (isRunningOverSSH() && !hasTTY()) {
    warnings.push(
      'CAUTION: Running over SSH without a proper terminal. ' +
        'Ensure the connection is secure and the session is not being logged.'
    );
  }

  return warnings;
}

/**
 * Attempts to detect if running in a virtualized environment.
 * This is a best-effort detection and may not be accurate.
 *
 * @returns True if likely running in a VM or container
 */
export function isLikelyVirtualized(): boolean {
  try {
    // Check common virtualization indicators
    const platform = os.platform();

    if (platform === 'linux') {
      // Check for common hypervisor indicators in /proc/cpuinfo
      try {
        const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
        if (
          cpuinfo.includes('hypervisor') ||
          cpuinfo.includes('QEMU') ||
          cpuinfo.includes('KVM') ||
          cpuinfo.includes('Xen') ||
          cpuinfo.includes('VMware') ||
          cpuinfo.includes('VirtualBox')
        ) {
          return true;
        }
      } catch {
        // File not readable, continue with other checks
      }

      // Check for container indicators
      try {
        fs.accessSync('/.dockerenv', fs.constants.F_OK);
        return true;
      } catch {
        // Not in Docker
      }

      // Check cgroup for container indicators
      try {
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
        if (cgroup.includes('docker') || cgroup.includes('lxc') || cgroup.includes('kubepods')) {
          return true;
        }
      } catch {
        // File not readable
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if the process is running over SSH.
 *
 * @returns True if SSH environment variables are present
 */
export function isRunningOverSSH(): boolean {
  return process.env['SSH_CLIENT'] !== undefined || process.env['SSH_TTY'] !== undefined;
}

/**
 * Checks if the process has a TTY (terminal).
 *
 * @returns True if running in a terminal
 */
export function hasTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Generates a secure random filename suffix.
 * Uses crypto.randomBytes for secure random generation.
 *
 * @param length - The length of the suffix in characters
 * @returns A random alphanumeric string
 */
export function generateSecureFileSuffix(length: number = 8): string {
  // Import crypto dynamically to avoid issues in non-Node environments
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    const byte = randomBytes[i];
    if (byte !== undefined) {
      result += chars[byte % chars.length];
    }
  }

  return result;
}

/**
 * Security checklist for key generation.
 * Returns a list of checks and their status.
 *
 * @returns Array of security checks with their status
 */
export function performSecurityChecks(): Array<{
  check: string;
  passed: boolean;
  message: string;
}> {
  const checks: Array<{ check: string; passed: boolean; message: string }> = [];

  // Check: Not running as root
  const rootCheck = !isRunningAsRoot();
  checks.push({
    check: 'Not running as root',
    passed: rootCheck,
    message: rootCheck
      ? 'Running as non-root user'
      : 'Running as root - consider using a regular user',
  });

  // Check: Has TTY
  const ttyCheck = hasTTY();
  checks.push({
    check: 'Interactive terminal',
    passed: ttyCheck,
    message: ttyCheck
      ? 'Running in interactive terminal'
      : 'No TTY detected - ensure output is not logged',
  });

  // Check: Node.js version is recent
  const nodeVersion = process.versions.node.split('.').map((n) => parseInt(n, 10));
  const majorVersion = nodeVersion[0] ?? 0;
  const nodeVersionCheck = majorVersion >= 18;
  checks.push({
    check: 'Node.js version',
    passed: nodeVersionCheck,
    message: nodeVersionCheck
      ? `Node.js ${process.versions.node} (recommended version)`
      : `Node.js ${process.versions.node} - consider upgrading to 18+`,
  });

  return checks;
}
