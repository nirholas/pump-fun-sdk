import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deriveWsUrl, RpcFallback, createRpcConnection } from '../solana/rpc.js';
import {
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  PUMPFUN_FEE_ACCOUNT,
  PUMPFUN_MIGRATION_AUTHORITY,
  WSOL_MINT,
  MONITORED_PROGRAM_IDS,
  CREATE_V2_DISCRIMINATOR,
  CREATE_DISCRIMINATOR,
  COMPLETE_EVENT_DISCRIMINATOR,
  COMPLETE_AMM_MIGRATION_DISCRIMINATOR,
  TRADE_EVENT_DISCRIMINATOR,
  DISTRIBUTE_FEES_EVENT_DISCRIMINATOR,
  DEFAULT_TOKEN_TOTAL_SUPPLY,
  DEFAULT_GRADUATION_SOL_THRESHOLD,
} from '../solana/programs.js';

// ── Program Constants ────────────────────────────────────────────────

describe('programs constants', () => {
  it('exports valid Pump program ID', () => {
    expect(PUMP_PROGRAM_ID).toBe('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    expect(PUMP_PROGRAM_ID).toHaveLength(44);
  });

  it('exports valid PumpAMM program ID', () => {
    expect(PUMP_AMM_PROGRAM_ID).toBe('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
    expect(PUMP_AMM_PROGRAM_ID).toHaveLength(44);
  });

  it('exports valid PumpFees program ID', () => {
    expect(PUMP_FEE_PROGRAM_ID).toBe('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
    expect(PUMP_FEE_PROGRAM_ID).toHaveLength(44);
  });

  it('exports valid known accounts', () => {
    expect(PUMPFUN_FEE_ACCOUNT).toBe('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJ5GEFDM97zC');
    expect(PUMPFUN_MIGRATION_AUTHORITY).toBe('39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg');
  });

  it('exports WSOL mint', () => {
    expect(WSOL_MINT).toBe('So11111111111111111111111111111111111111112');
  });

  it('MONITORED_PROGRAM_IDS contains all three programs', () => {
    expect(MONITORED_PROGRAM_IDS).toHaveLength(3);
    expect(MONITORED_PROGRAM_IDS).toContain(PUMP_PROGRAM_ID);
    expect(MONITORED_PROGRAM_IDS).toContain(PUMP_AMM_PROGRAM_ID);
    expect(MONITORED_PROGRAM_IDS).toContain(PUMP_FEE_PROGRAM_ID);
  });

  it('exports instruction discriminators as 16-char hex strings', () => {
    for (const disc of [CREATE_V2_DISCRIMINATOR, CREATE_DISCRIMINATOR]) {
      expect(disc).toHaveLength(16);
      expect(disc).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('exports event discriminators as 16-char hex strings', () => {
    for (const disc of [
      COMPLETE_EVENT_DISCRIMINATOR,
      COMPLETE_AMM_MIGRATION_DISCRIMINATOR,
      TRADE_EVENT_DISCRIMINATOR,
      DISTRIBUTE_FEES_EVENT_DISCRIMINATOR,
    ]) {
      expect(disc).toHaveLength(16);
      expect(disc).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('exports DEFAULT_TOKEN_TOTAL_SUPPLY as 1B tokens with 6 decimals', () => {
    expect(DEFAULT_TOKEN_TOTAL_SUPPLY).toBe(1_000_000_000_000_000);
  });

  it('exports DEFAULT_GRADUATION_SOL_THRESHOLD', () => {
    expect(DEFAULT_GRADUATION_SOL_THRESHOLD).toBe(85);
  });
});

// ── deriveWsUrl ──────────────────────────────────────────────────────

describe('deriveWsUrl', () => {
  it('converts https to wss', () => {
    expect(deriveWsUrl('https://api.mainnet-beta.solana.com')).toBe(
      'wss://api.mainnet-beta.solana.com',
    );
  });

  it('converts http to ws', () => {
    expect(deriveWsUrl('http://localhost:8899')).toBe('ws://localhost:8899');
  });

  it('preserves path and query params', () => {
    expect(deriveWsUrl('https://rpc.example.com/v1/abc123?key=val')).toBe(
      'wss://rpc.example.com/v1/abc123?key=val',
    );
  });

  it('handles URLs with ports', () => {
    expect(deriveWsUrl('https://rpc.example.com:8443/path')).toBe(
      'wss://rpc.example.com:8443/path',
    );
  });
});

// ── RpcFallback ──────────────────────────────────────────────────────

describe('RpcFallback', () => {
  it('creates a connection from the primary URL', () => {
    const rpc = new RpcFallback({ url: 'https://api.devnet.solana.com' });
    const conn = rpc.getConnection();
    expect(conn).toBeDefined();
    expect(conn.rpcEndpoint).toBe('https://api.devnet.solana.com');
  });

  it('defaults to confirmed commitment', () => {
    const rpc = new RpcFallback({ url: 'https://api.devnet.solana.com' });
    const conn = rpc.getConnection();
    expect(conn.commitment).toBe('confirmed');
  });

  it('uses specified commitment', () => {
    const rpc = new RpcFallback({
      url: 'https://api.devnet.solana.com',
      commitment: 'finalized',
    });
    const conn = rpc.getConnection();
    expect(conn.commitment).toBe('finalized');
  });

  it('returns same connection on repeated calls', () => {
    const rpc = new RpcFallback({ url: 'https://api.devnet.solana.com' });
    const conn1 = rpc.getConnection();
    const conn2 = rpc.getConnection();
    expect(conn1).toBe(conn2);
  });

  it('reportSuccess resets fail count (no rotation)', () => {
    const rpc = new RpcFallback({
      url: 'https://primary.example.com',
      fallbackUrls: ['https://fallback.example.com'],
    });
    rpc.reportFailure();
    rpc.reportFailure();
    rpc.reportSuccess();
    // After success, failing twice more should not rotate (counter reset)
    rpc.reportFailure();
    rpc.reportFailure();
    // Still on primary (never hit 3 consecutive)
    expect(rpc.getConnection().rpcEndpoint).toBe('https://primary.example.com');
  });

  it('rotates after 3 consecutive failures', () => {
    const rpc = new RpcFallback({
      url: 'https://primary.example.com',
      fallbackUrls: ['https://fallback.example.com'],
    });
    rpc.reportFailure();
    rpc.reportFailure();
    rpc.reportFailure(); // Should trigger rotation
    expect(rpc.getConnection().rpcEndpoint).toBe('https://fallback.example.com');
  });

  it('wraps around to first URL after exhausting fallbacks', () => {
    const rpc = new RpcFallback({
      url: 'https://a.com',
      fallbackUrls: ['https://b.com'],
    });
    // Fail primary 3 times → rotate to fallback
    for (let i = 0; i < 3; i++) rpc.reportFailure();
    expect(rpc.getConnection().rpcEndpoint).toBe('https://b.com');

    // Fail fallback 3 times → rotate back to primary
    for (let i = 0; i < 3; i++) rpc.reportFailure();
    expect(rpc.getConnection().rpcEndpoint).toBe('https://a.com');
  });

  describe('withFallback', () => {
    it('returns result on success', async () => {
      const rpc = new RpcFallback({ url: 'https://api.devnet.solana.com' });
      const result = await rpc.withFallback(async () => 'ok');
      expect(result).toBe('ok');
    });

    it('retries on retryable errors and succeeds on fallback', async () => {
      let callCount = 0;
      const rpc = new RpcFallback({
        url: 'https://primary.example.com',
        fallbackUrls: ['https://fallback.example.com'],
      });
      const result = await rpc.withFallback(async (conn) => {
        callCount++;
        if (conn.rpcEndpoint === 'https://primary.example.com') {
          throw new Error('429 Too Many Requests');
        }
        return 'fallback-result';
      });
      expect(result).toBe('fallback-result');
      expect(callCount).toBe(2);
    });

    it('throws non-retryable errors immediately', async () => {
      const rpc = new RpcFallback({
        url: 'https://primary.example.com',
        fallbackUrls: ['https://fallback.example.com'],
      });
      await expect(
        rpc.withFallback(async () => {
          throw new Error('Invalid account');
        }),
      ).rejects.toThrow('Invalid account');
    });

    it('throws "All RPC endpoints exhausted" when all fail', async () => {
      const rpc = new RpcFallback({
        url: 'https://a.com',
        fallbackUrls: ['https://b.com'],
      });
      await expect(
        rpc.withFallback(async () => {
          throw new Error('502 Bad Gateway');
        }),
      ).rejects.toThrow('All RPC endpoints exhausted');
    });

    it('retries on ETIMEDOUT', async () => {
      let callCount = 0;
      const rpc = new RpcFallback({
        url: 'https://a.com',
        fallbackUrls: ['https://b.com'],
      });
      const result = await rpc.withFallback(async () => {
        callCount++;
        if (callCount === 1) throw new Error('connect ETIMEDOUT');
        return 'recovered';
      });
      expect(result).toBe('recovered');
    });

    it('retries on ECONNREFUSED', async () => {
      let callCount = 0;
      const rpc = new RpcFallback({
        url: 'https://a.com',
        fallbackUrls: ['https://b.com'],
      });
      const result = await rpc.withFallback(async () => {
        callCount++;
        if (callCount === 1) throw new Error('connect ECONNREFUSED');
        return 'recovered';
      });
      expect(result).toBe('recovered');
    });

    it('retries on fetch failed', async () => {
      let callCount = 0;
      const rpc = new RpcFallback({
        url: 'https://a.com',
        fallbackUrls: ['https://b.com'],
      });
      const result = await rpc.withFallback(async () => {
        callCount++;
        if (callCount === 1) throw new Error('fetch failed');
        return 'recovered';
      });
      expect(result).toBe('recovered');
    });

    it('does not retry on 403 errors even with retryable code', async () => {
      const rpc = new RpcFallback({
        url: 'https://a.com',
        fallbackUrls: ['https://b.com'],
      });
      await expect(
        rpc.withFallback(async () => {
          throw new Error('403 Forbidden');
        }),
      ).rejects.toThrow('403');
    });
  });
});

// ── createRpcConnection ──────────────────────────────────────────────

describe('createRpcConnection', () => {
  it('returns an RpcFallback instance', () => {
    const rpc = createRpcConnection({ url: 'https://api.devnet.solana.com' });
    expect(rpc).toBeInstanceOf(RpcFallback);
  });

  it('works with fallback URLs', () => {
    const rpc = createRpcConnection({
      url: 'https://primary.com',
      fallbackUrls: ['https://fallback1.com', 'https://fallback2.com'],
    });
    expect(rpc.getConnection()).toBeDefined();
  });
});
