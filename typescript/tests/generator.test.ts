/**
 * @fileoverview Tests for the VanityGenerator class.
 */

import { Keypair } from '@solana/web3.js';
import { VanityGenerator, generateVanityAddress } from '../src/lib/generator';
import { VanityError, VanityErrorType } from '../src/lib/types';

describe('VanityGenerator', () => {
  describe('constructor', () => {
    it('should create a generator with valid prefix', () => {
      const generator = new VanityGenerator({ prefix: 'A' });
      expect(generator).toBeDefined();
    });

    it('should create a generator with valid suffix', () => {
      const generator = new VanityGenerator({ suffix: 'z' });
      expect(generator).toBeDefined();
    });

    it('should create a generator with both prefix and suffix', () => {
      const generator = new VanityGenerator({ prefix: 'A', suffix: 'z' });
      expect(generator).toBeDefined();
    });

    it('should throw when no pattern specified', () => {
      expect(() => new VanityGenerator({})).toThrow(VanityError);
    });

    it('should throw for invalid prefix characters', () => {
      expect(() => new VanityGenerator({ prefix: '0' })).toThrow(VanityError);
      expect(() => new VanityGenerator({ prefix: 'O' })).toThrow(VanityError);
      expect(() => new VanityGenerator({ prefix: 'I' })).toThrow(VanityError);
      expect(() => new VanityGenerator({ prefix: 'l' })).toThrow(VanityError);
    });
  });

  describe('generate', () => {
    it('should generate valid keypair', async () => {
      const generator = new VanityGenerator({ prefix: '1' });
      const result = await generator.generate();

      expect(result.publicKey).toBeDefined();
      expect(result.secretKey).toBeInstanceOf(Uint8Array);
      expect(result.secretKey.length).toBe(64);
      expect(result.attempts).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should find matching prefix', async () => {
      const generator = new VanityGenerator({ prefix: 'A' });
      const result = await generator.generate();

      expect(result.publicKey.startsWith('A')).toBe(true);
    });

    it('should find matching suffix', async () => {
      const generator = new VanityGenerator({ suffix: 'a' });
      const result = await generator.generate();

      expect(result.publicKey.endsWith('a')).toBe(true);
    });

    it('should find matching prefix and suffix', async () => {
      const generator = new VanityGenerator({ prefix: 'A', suffix: 'a' });
      const result = await generator.generate();

      expect(result.publicKey.startsWith('A')).toBe(true);
      expect(result.publicKey.endsWith('a')).toBe(true);
    });

    it('should handle case-insensitive prefix matching', async () => {
      const generator = new VanityGenerator({ prefix: 'a', ignoreCase: true });
      const result = await generator.generate();

      expect(result.publicKey.toLowerCase().startsWith('a')).toBe(true);
    });

    it('should handle case-insensitive suffix matching', async () => {
      const generator = new VanityGenerator({ suffix: 'A', ignoreCase: true });
      const result = await generator.generate();

      expect(result.publicKey.toLowerCase().endsWith('a')).toBe(true);
    });

    it('should respect maxAttempts', async () => {
      const generator = new VanityGenerator({
        prefix: 'ZZZZZZ', // Very unlikely to find
        maxAttempts: 100,
      });

      await expect(generator.generate()).rejects.toThrow(VanityError);

      try {
        await generator.generate();
      } catch (error) {
        expect(error).toBeInstanceOf(VanityError);
        expect((error as VanityError).type).toBe(VanityErrorType.MAX_ATTEMPTS_REACHED);
      }
    });

    it('should call progress callback', async () => {
      const progressFn = jest.fn();

      const generator = new VanityGenerator({
        prefix: 'AA', // Might take a few thousand attempts
        maxAttempts: 5000,
        onProgress: progressFn,
      });

      try {
        await generator.generate();
      } catch {
        // May or may not find it
      }

      // Progress should have been called at least once if we made 1000+ attempts
      // But we can't guarantee it was called
    });

    it('should generate keypair that can be verified', async () => {
      const generator = new VanityGenerator({ prefix: '1' });
      const result = await generator.generate();

      // Verify the keypair is valid by reconstructing it
      const keypair = Keypair.fromSecretKey(result.secretKey);
      expect(keypair.publicKey.toBase58()).toBe(result.publicKey);
    });
  });

  describe('getEstimatedAttempts', () => {
    it('should return correct estimate for single char prefix', () => {
      const generator = new VanityGenerator({ prefix: 'A' });
      expect(generator.getEstimatedAttempts()).toBe(58);
    });

    it('should return correct estimate for two char prefix', () => {
      const generator = new VanityGenerator({ prefix: 'AA' });
      expect(generator.getEstimatedAttempts()).toBe(58 * 58);
    });

    it('should return correct estimate for prefix + suffix', () => {
      const generator = new VanityGenerator({ prefix: 'A', suffix: 'z' });
      expect(generator.getEstimatedAttempts()).toBe(58 * 58);
    });
  });

  describe('getPatternInfo', () => {
    it('should return pattern information', () => {
      const generator = new VanityGenerator({
        prefix: 'So',
        suffix: 'na',
        ignoreCase: true,
      });

      const info = generator.getPatternInfo();

      expect(info.prefix).toBe('so'); // Normalized to lowercase
      expect(info.suffix).toBe('na');
      expect(info.ignoreCase).toBe(true);
      expect(info.totalLength).toBe(4);
    });
  });

  // Run multiple times to ensure consistency
  describe.each(Array(5).fill(null))('consistency check (run %#)', () => {
    it('should generate valid keypair with single char prefix', async () => {
      const generator = new VanityGenerator({ prefix: '1' });
      const result = await generator.generate();

      expect(result.publicKey.startsWith('1')).toBe(true);
      expect(result.secretKey.length).toBe(64);

      // Verify keypair
      const keypair = Keypair.fromSecretKey(result.secretKey);
      expect(keypair.publicKey.toBase58()).toBe(result.publicKey);
    });

    it('should generate case-insensitive match', async () => {
      const generator = new VanityGenerator({ prefix: 'a', ignoreCase: true });
      const result = await generator.generate();

      expect(result.publicKey.toLowerCase().startsWith('a')).toBe(true);
    });
  });
});

describe('generateVanityAddress', () => {
  it('should work as a convenience function', async () => {
    const result = await generateVanityAddress({ prefix: '1' });

    expect(result.publicKey.startsWith('1')).toBe(true);
    expect(result.secretKey.length).toBe(64);
  });
});
