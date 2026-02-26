/**
 * @fileoverview Tests for the AddressMatcher class.
 */

import { AddressMatcher, createMatcher, startsWithPrefix, endsWithSuffix } from '../src/lib/matcher';
import { VanityError } from '../src/lib/types';

describe('AddressMatcher', () => {
  describe('constructor', () => {
    it('should create matcher with prefix', () => {
      const matcher = new AddressMatcher({ prefix: 'So' });
      expect(matcher).toBeDefined();
    });

    it('should create matcher with suffix', () => {
      const matcher = new AddressMatcher({ suffix: 'na' });
      expect(matcher).toBeDefined();
    });

    it('should create matcher with both prefix and suffix', () => {
      const matcher = new AddressMatcher({ prefix: 'So', suffix: 'na' });
      expect(matcher).toBeDefined();
    });

    it('should throw when no pattern specified', () => {
      expect(() => new AddressMatcher({})).toThrow(VanityError);
      expect(() => new AddressMatcher({ prefix: '', suffix: '' })).toThrow(VanityError);
    });

    it('should throw for invalid prefix characters', () => {
      expect(() => new AddressMatcher({ prefix: '0' })).toThrow(VanityError);
    });

    it('should throw for invalid suffix characters', () => {
      expect(() => new AddressMatcher({ suffix: 'O' })).toThrow(VanityError);
    });

    it('should handle case-insensitive option', () => {
      const matcher = new AddressMatcher({ prefix: 'ABC', ignoreCase: true });
      const info = matcher.getPatternInfo();
      expect(info.prefix).toBe('abc');
      expect(info.ignoreCase).toBe(true);
    });
  });

  describe('matches', () => {
    it('should match prefix correctly', () => {
      const matcher = new AddressMatcher({ prefix: 'So' });

      expect(matcher.matches('SoLaNaAddress123456789012345678901234567')).toBe(true);
      expect(matcher.matches('NotSolanaAddress12345678901234567890123')).toBe(false);
    });

    it('should match suffix correctly', () => {
      const matcher = new AddressMatcher({ suffix: 'na' });

      expect(matcher.matches('SomeAddress12345678901234567890123456na')).toBe(true);
      expect(matcher.matches('SomeAddress12345678901234567890123456xy')).toBe(false);
    });

    it('should match both prefix and suffix', () => {
      const matcher = new AddressMatcher({ prefix: 'So', suffix: 'na' });

      expect(matcher.matches('SomeAddress123456789012345678901234na')).toBe(true);
      expect(matcher.matches('SomeAddress12345678901234567890123456')).toBe(false);
      expect(matcher.matches('NopeAddress1234567890123456789012345na')).toBe(false);
    });

    it('should handle case-insensitive prefix matching', () => {
      const matcher = new AddressMatcher({ prefix: 'So', ignoreCase: true });

      expect(matcher.matches('SoLaNaAddress123456789012345678901234567')).toBe(true);
      expect(matcher.matches('soLaNaAddress123456789012345678901234567')).toBe(true);
      expect(matcher.matches('SOLaNaAddress123456789012345678901234567')).toBe(true);
    });

    it('should handle case-insensitive suffix matching', () => {
      const matcher = new AddressMatcher({ suffix: 'Na', ignoreCase: true });

      expect(matcher.matches('SomeAddress12345678901234567890123456NA')).toBe(true);
      expect(matcher.matches('SomeAddress12345678901234567890123456na')).toBe(true);
      expect(matcher.matches('SomeAddress12345678901234567890123456nA')).toBe(true);
    });

    it('should handle exact case matching (default)', () => {
      const matcher = new AddressMatcher({ prefix: 'So' });

      expect(matcher.matches('SoLaNaAddress123456789012345678901234567')).toBe(true);
      expect(matcher.matches('soLaNaAddress123456789012345678901234567')).toBe(false);
    });
  });

  describe('matchesPrefix', () => {
    it('should return true when no prefix specified', () => {
      const matcher = new AddressMatcher({ suffix: 'na' });
      expect(matcher.matchesPrefix('AnythingHere')).toBe(true);
    });

    it('should check prefix only', () => {
      const matcher = new AddressMatcher({ prefix: 'So', suffix: 'na' });

      // Matches prefix but not suffix - should still return true for matchesPrefix
      expect(matcher.matchesPrefix('SomethingElse12345678901234567890xyz')).toBe(true);
    });
  });

  describe('matchesSuffix', () => {
    it('should return true when no suffix specified', () => {
      const matcher = new AddressMatcher({ prefix: 'So' });
      expect(matcher.matchesSuffix('AnythingHere')).toBe(true);
    });

    it('should check suffix only', () => {
      const matcher = new AddressMatcher({ prefix: 'So', suffix: 'na' });

      // Matches suffix but not prefix - should still return true for matchesSuffix
      expect(matcher.matchesSuffix('NotMatchingPrefix123456789012345na')).toBe(true);
    });
  });

  describe('getPatternInfo', () => {
    it('should return correct pattern info', () => {
      const matcher = new AddressMatcher({ prefix: 'AB', suffix: 'cd', ignoreCase: true });
      const info = matcher.getPatternInfo();

      expect(info.prefix).toBe('ab');
      expect(info.suffix).toBe('cd');
      expect(info.ignoreCase).toBe(true);
      expect(info.totalLength).toBe(4);
    });

    it('should handle undefined patterns correctly', () => {
      const matcher = new AddressMatcher({ prefix: 'AB' });
      const info = matcher.getPatternInfo();

      expect(info.prefix).toBe('AB');
      expect(info.suffix).toBeUndefined();
      expect(info.ignoreCase).toBe(false);
      expect(info.totalLength).toBe(2);
    });
  });
});

describe('createMatcher', () => {
  it('should create a matching function', () => {
    const matchFn = createMatcher({ prefix: 'So' });

    expect(typeof matchFn).toBe('function');
    expect(matchFn('SoLaNa12345678901234567890123456789012')).toBe(true);
    expect(matchFn('NoMatch1234567890123456789012345678901')).toBe(false);
  });
});

describe('startsWithPrefix', () => {
  it('should check prefix case-sensitive', () => {
    expect(startsWithPrefix('SoLaNa', 'So')).toBe(true);
    expect(startsWithPrefix('soLaNa', 'So')).toBe(false);
  });

  it('should check prefix case-insensitive', () => {
    expect(startsWithPrefix('SoLaNa', 'so', true)).toBe(true);
    expect(startsWithPrefix('SOLANA', 'so', true)).toBe(true);
  });
});

describe('endsWithSuffix', () => {
  it('should check suffix case-sensitive', () => {
    expect(endsWithSuffix('SoLaNa', 'Na')).toBe(true);
    expect(endsWithSuffix('SoLaNa', 'na')).toBe(false);
  });

  it('should check suffix case-insensitive', () => {
    expect(endsWithSuffix('SoLaNa', 'na', true)).toBe(true);
    expect(endsWithSuffix('SOLANA', 'NA', true)).toBe(true);
  });
});
