/**
 * @fileoverview Integration tests for the vanity address generator.
 * Tests the complete workflow from generation to file output.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Keypair } from '@solana/web3.js';
import { VanityGenerator } from '../src/lib/generator';
import { saveKeypair, verifyKeypairFile, loadKeypair, getKeypairFileStats } from '../src/lib/output';
import { clearSensitiveData } from '../src/lib/security';
import { VanityError, VanityErrorType } from '../src/lib/types';

describe('Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vanity-integration-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Complete workflow', () => {
    it('should generate, save, and verify a keypair', async () => {
      // Generate a vanity address
      const generator = new VanityGenerator({ prefix: '1' });
      const result = await generator.generate();

      expect(result.publicKey.startsWith('1')).toBe(true);

      // Save to file
      const outputPath = path.join(tempDir, `${result.publicKey}.json`);
      await saveKeypair(result.secretKey, outputPath);

      // Verify file exists and has correct permissions
      const stats = await getKeypairFileStats(outputPath);
      expect(stats.exists).toBe(true);
      expect(stats.isSecure).toBe(true);

      // Verify file contents
      const verified = await verifyKeypairFile(outputPath, result.secretKey);
      expect(verified).toBe(true);

      // Load keypair and verify public key
      const loadedKeypair = await loadKeypair(outputPath);
      expect(loadedKeypair.publicKey.toBase58()).toBe(result.publicKey);
    });

    it('should handle case-insensitive generation and verification', async () => {
      const generator = new VanityGenerator({
        prefix: 'a',
        ignoreCase: true,
      });

      const result = await generator.generate();

      // Should start with 'a' or 'A'
      expect(result.publicKey.toLowerCase().startsWith('a')).toBe(true);

      // Save and verify
      const outputPath = path.join(tempDir, 'case-insensitive.json');
      await saveKeypair(result.secretKey, outputPath);

      const loadedKeypair = await loadKeypair(outputPath);
      expect(loadedKeypair.publicKey.toBase58()).toBe(result.publicKey);
    });

    it('should refuse to overwrite existing file without flag', async () => {
      const generator = new VanityGenerator({ prefix: '1' });
      const result = await generator.generate();

      const outputPath = path.join(tempDir, 'existing.json');

      // Save first time
      await saveKeypair(result.secretKey, outputPath);

      // Try to save again
      await expect(saveKeypair(result.secretKey, outputPath)).rejects.toThrow(VanityError);

      try {
        await saveKeypair(result.secretKey, outputPath);
      } catch (error) {
        expect((error as VanityError).type).toBe(VanityErrorType.FILE_EXISTS);
      }
    });

    it('should allow overwrite with flag', async () => {
      const generator = new VanityGenerator({ prefix: '1' });
      const result1 = await generator.generate();
      const result2 = await generator.generate();

      const outputPath = path.join(tempDir, 'overwrite.json');

      // Save first keypair
      await saveKeypair(result1.secretKey, outputPath);

      // Overwrite with second keypair
      await saveKeypair(result2.secretKey, outputPath, { overwrite: true });

      // Verify it's the second keypair
      const loaded = await loadKeypair(outputPath);
      expect(loaded.publicKey.toBase58()).toBe(result2.publicKey);
    });
  });

  describe('File format compatibility', () => {
    it('should produce Solana CLI compatible format', async () => {
      const generator = new VanityGenerator({ prefix: '1' });
      const result = await generator.generate();

      const outputPath = path.join(tempDir, 'solana-cli.json');
      await saveKeypair(result.secretKey, outputPath);

      // Read raw file content
      const content = await fs.promises.readFile(outputPath, 'utf8');
      const parsed = JSON.parse(content) as number[];

      // Should be array of 64 numbers
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(64);

      // All values should be valid bytes
      for (const byte of parsed) {
        expect(typeof byte).toBe('number');
        expect(byte).toBeGreaterThanOrEqual(0);
        expect(byte).toBeLessThanOrEqual(255);
      }

      // Should be usable with Solana Keypair.fromSecretKey
      const keypair = Keypair.fromSecretKey(new Uint8Array(parsed));
      expect(keypair.publicKey.toBase58()).toBe(result.publicKey);
    });
  });

  describe('Multiple generations', () => {
    it('should generate multiple unique addresses', async () => {
      const addresses = new Set<string>();

      for (let i = 0; i < 5; i++) {
        const generator = new VanityGenerator({ prefix: '1' });
        const result = await generator.generate();

        // Should be unique
        expect(addresses.has(result.publicKey)).toBe(false);
        addresses.add(result.publicKey);

        // Save each one
        const outputPath = path.join(tempDir, `vanity-${i}.json`);
        await saveKeypair(result.secretKey, outputPath);
      }

      expect(addresses.size).toBe(5);
    });
  });

  describe('Security cleanup', () => {
    it('should allow clearing secret key after use', async () => {
      const generator = new VanityGenerator({ prefix: '1' });
      const result = await generator.generate();

      // Save the keypair
      const outputPath = path.join(tempDir, 'cleanup.json');
      await saveKeypair(result.secretKey, outputPath);

      // Clear the secret key
      clearSensitiveData(result.secretKey);

      // Verify it's cleared
      for (let i = 0; i < result.secretKey.length; i++) {
        expect(result.secretKey[i]).toBe(0);
      }

      // Original file should still be valid
      const loaded = await loadKeypair(outputPath);
      expect(loaded.publicKey.toBase58()).toBe(result.publicKey);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid file path', async () => {
      const generator = new VanityGenerator({ prefix: '1' });
      const result = await generator.generate();

      // Try to save to invalid path
      const invalidPath = '/nonexistent/directory/file.json';

      await expect(saveKeypair(result.secretKey, invalidPath)).rejects.toThrow(VanityError);
    });

    it('should detect corrupted keypair file', async () => {
      const outputPath = path.join(tempDir, 'corrupted.json');

      // Write invalid content
      await fs.promises.writeFile(outputPath, '[1,2,3]');

      await expect(loadKeypair(outputPath)).rejects.toThrow(VanityError);
    });

    it('should detect invalid JSON in keypair file', async () => {
      const outputPath = path.join(tempDir, 'invalid.json');

      // Write invalid JSON
      await fs.promises.writeFile(outputPath, 'not valid json');

      await expect(loadKeypair(outputPath)).rejects.toThrow(VanityError);
    });
  });

  describe('Consistency tests', () => {
    // Run multiple times to ensure consistency
    it.each(Array(10).fill(null))('should consistently generate valid addresses (run %#)', async () => {
      const generator = new VanityGenerator({
        prefix: 'A',
        ignoreCase: true,
      });

      const result = await generator.generate();

      // Verify address
      expect(result.publicKey.toLowerCase().startsWith('a')).toBe(true);

      // Verify keypair validity
      const keypair = Keypair.fromSecretKey(result.secretKey);
      expect(keypair.publicKey.toBase58()).toBe(result.publicKey);

      // Save and reload
      const outputPath = path.join(tempDir, `consistent-${Date.now()}-${Math.random()}.json`);
      await saveKeypair(result.secretKey, outputPath);

      const loaded = await loadKeypair(outputPath);
      expect(loaded.publicKey.toBase58()).toBe(result.publicKey);
    });
  });
});
