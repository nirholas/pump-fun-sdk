/**
 * @fileoverview Tests for security utilities.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  clearSensitiveData,
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
} from '../src/lib/security';

describe('clearSensitiveData', () => {
  it('should zero out the array', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    clearSensitiveData(data);

    // After clearing, all values should be 0
    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(0);
    }
  });

  it('should handle empty array', () => {
    const data = new Uint8Array(0);
    expect(() => clearSensitiveData(data)).not.toThrow();
  });

  it('should handle large array', () => {
    const data = new Uint8Array(10000);
    data.fill(255);
    clearSensitiveData(data);

    // Verify all zeros
    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(0);
    }
  });
});

describe('verifyFilePermissions', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vanity-test-'));
    testFile = path.join(tempDir, 'test-key.json');
    await fs.promises.writeFile(testFile, '[]');
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return true for 0600 permissions', async () => {
    await fs.promises.chmod(testFile, 0o600);
    const result = await verifyFilePermissions(testFile);
    expect(result).toBe(true);
  });

  it('should return false for non-0600 permissions', async () => {
    await fs.promises.chmod(testFile, 0o644);
    const result = await verifyFilePermissions(testFile);
    expect(result).toBe(false);
  });

  it('should return false for non-existent file', async () => {
    const result = await verifyFilePermissions('/nonexistent/file/path');
    expect(result).toBe(false);
  });
});

describe('verifyFilePermissionsSync', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vanity-test-'));
    testFile = path.join(tempDir, 'test-key.json');
    await fs.promises.writeFile(testFile, '[]');
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return true for 0600 permissions', async () => {
    await fs.promises.chmod(testFile, 0o600);
    const result = verifyFilePermissionsSync(testFile);
    expect(result).toBe(true);
  });

  it('should return false for non-0600 permissions', async () => {
    await fs.promises.chmod(testFile, 0o755);
    const result = verifyFilePermissionsSync(testFile);
    expect(result).toBe(false);
  });
});

describe('setSecurePermissions', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vanity-test-'));
    testFile = path.join(tempDir, 'test-key.json');
    await fs.promises.writeFile(testFile, '[]', { mode: 0o644 });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should set permissions to 0600', async () => {
    await setSecurePermissions(testFile);

    const stats = await fs.promises.stat(testFile);
    // eslint-disable-next-line no-bitwise
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

describe('isRunningAsRoot', () => {
  it('should return a boolean', () => {
    const result = isRunningAsRoot();
    expect(typeof result).toBe('boolean');
  });
});

describe('getSecurityWarnings', () => {
  it('should return an array', () => {
    const warnings = getSecurityWarnings();
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('should return strings in array', () => {
    const warnings = getSecurityWarnings();
    for (const warning of warnings) {
      expect(typeof warning).toBe('string');
    }
  });
});

describe('isLikelyVirtualized', () => {
  it('should return a boolean', () => {
    const result = isLikelyVirtualized();
    expect(typeof result).toBe('boolean');
  });
});

describe('isRunningOverSSH', () => {
  it('should return a boolean', () => {
    const result = isRunningOverSSH();
    expect(typeof result).toBe('boolean');
  });
});

describe('hasTTY', () => {
  it('should return a boolean', () => {
    const result = hasTTY();
    expect(typeof result).toBe('boolean');
  });
});

describe('generateSecureFileSuffix', () => {
  it('should generate string of correct length', () => {
    const suffix = generateSecureFileSuffix(8);
    expect(suffix.length).toBe(8);
  });

  it('should generate alphanumeric characters', () => {
    const suffix = generateSecureFileSuffix(100);
    expect(/^[A-Za-z0-9]+$/.test(suffix)).toBe(true);
  });

  it('should generate different values on each call', () => {
    const suffix1 = generateSecureFileSuffix(16);
    const suffix2 = generateSecureFileSuffix(16);

    // Should be different (extremely unlikely to be same)
    expect(suffix1).not.toBe(suffix2);
  });

  it('should use default length of 8', () => {
    const suffix = generateSecureFileSuffix();
    expect(suffix.length).toBe(8);
  });
});

describe('performSecurityChecks', () => {
  it('should return array of checks', () => {
    const checks = performSecurityChecks();

    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);
  });

  it('should have proper check format', () => {
    const checks = performSecurityChecks();

    for (const check of checks) {
      expect(check).toHaveProperty('check');
      expect(check).toHaveProperty('passed');
      expect(check).toHaveProperty('message');
      expect(typeof check.check).toBe('string');
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.message).toBe('string');
    }
  });

  it('should include Node.js version check', () => {
    const checks = performSecurityChecks();
    const nodeCheck = checks.find((c) => c.check.includes('Node.js'));

    expect(nodeCheck).toBeDefined();
  });
});
