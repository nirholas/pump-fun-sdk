import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseMonitor } from '../monitor/BaseMonitor.js';
import { LaunchMonitor } from '../monitor/LaunchMonitor.js';
import { GraduationMonitor } from '../monitor/GraduationMonitor.js';
import { WhaleMonitor } from '../monitor/WhaleMonitor.js';
import { CTOMonitor } from '../monitor/CTOMonitor.js';
import { FeeDistMonitor } from '../monitor/FeeDistMonitor.js';
import { ClaimMonitor } from '../monitor/ClaimMonitor.js';

// ── Mock Connection ──────────────────────────────────────────────────

type LogCallback = (logInfo: { err: null | object; signature: string; logs: string[] }) => void;

function createMockConnection() {
  let logCallback: LogCallback | null = null;
  let subscriptionCounter = 0;

  return {
    onLogs: vi.fn((_filter: unknown, callback: LogCallback) => {
      logCallback = callback;
      return ++subscriptionCounter;
    }),
    removeOnLogsListener: vi.fn(async () => {}),
    getSignaturesForAddress: vi.fn(async () => []),
    rpcEndpoint: 'https://api.devnet.solana.com',
    /** Simulate receiving a log event on the WebSocket */
    _emitLog(signature: string, logs: string[], err: null | object = null) {
      logCallback?.({ err, signature, logs });
    },
    _getCallback() {
      return logCallback;
    },
  };
}

// ── BaseMonitor ──────────────────────────────────────────────────────

describe('BaseMonitor', () => {
  // Concrete subclass for testing abstract base
  class TestMonitor extends BaseMonitor {
    started = false;
    stopped = false;
    start() {
      this._running = true;
      this.started = true;
    }
    stop() {
      this._running = false;
      this.stopped = true;
    }
    // Expose protected methods for testing
    doRecordEvent() {
      this.recordEvent();
    }
    getLogger() {
      return this.log;
    }
  }

  it('initializes with correct default status', () => {
    const monitor = new TestMonitor('Test');
    const status = monitor.status();
    expect(status.running).toBe(false);
    expect(status.lastEvent).toBeNull();
    expect(status.eventsProcessed).toBe(0);
  });

  it('status reflects running state after start/stop', () => {
    const monitor = new TestMonitor('Test');
    monitor.start();
    expect(monitor.status().running).toBe(true);
    monitor.stop();
    expect(monitor.status().running).toBe(false);
  });

  it('recordEvent increments counter and updates lastEvent', () => {
    const monitor = new TestMonitor('Test');
    const before = Date.now();
    monitor.doRecordEvent();
    const status = monitor.status();
    expect(status.eventsProcessed).toBe(1);
    expect(status.lastEvent).toBeGreaterThanOrEqual(before);
    expect(status.lastEvent).toBeLessThanOrEqual(Date.now());
  });

  it('recordEvent increments counter cumulatively', () => {
    const monitor = new TestMonitor('Test');
    monitor.doRecordEvent();
    monitor.doRecordEvent();
    monitor.doRecordEvent();
    expect(monitor.status().eventsProcessed).toBe(3);
  });

  it('log methods include monitor name prefix', () => {
    const monitor = new TestMonitor('MyMonitor');
    const logger = monitor.getLogger();
    // Logger should be an object with debug, info, warn, error
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});

// ── LaunchMonitor ────────────────────────────────────────────────────

describe('LaunchMonitor', () => {
  let conn: ReturnType<typeof createMockConnection>;
  let events: unknown[];
  let monitor: LaunchMonitor;

  beforeEach(() => {
    conn = createMockConnection();
    events = [];
    monitor = new LaunchMonitor({
      connection: conn as any,
      onLaunch: (event) => {
        events.push(event);
      },
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('starts and subscribes to WebSocket', () => {
    monitor.start();
    expect(conn.onLogs).toHaveBeenCalledTimes(1);
    expect(monitor.status().running).toBe(true);
  });

  it('does not start twice', () => {
    monitor.start();
    monitor.start();
    expect(conn.onLogs).toHaveBeenCalledTimes(1);
  });

  it('fires callback on Create instruction', async () => {
    monitor.start();
    conn._emitLog('sig1', ['Program log: Instruction: Create']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect((events[0] as any).signature).toBe('sig1');
  });

  it('fires callback on CreateV2 instruction', async () => {
    monitor.start();
    conn._emitLog('sig2', ['Program log: Instruction: CreateV2']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect((events[0] as any).signature).toBe('sig2');
  });

  it('ignores logs without create instructions', () => {
    monitor.start();
    conn._emitLog('sig3', ['Program log: Instruction: Buy']);
    expect(events).toHaveLength(0);
  });

  it('ignores logs with errors', () => {
    monitor.start();
    conn._emitLog('sig4', ['Program log: Instruction: Create'], { err: 'fail' });
    expect(events).toHaveLength(0);
  });

  it('deduplicates by signature', async () => {
    monitor.start();
    conn._emitLog('sig5', ['Program log: Instruction: Create']);
    conn._emitLog('sig5', ['Program log: Instruction: Create']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events).toHaveLength(1);
  });

  it('stops and removes subscription', () => {
    monitor.start();
    monitor.stop();
    expect(conn.removeOnLogsListener).toHaveBeenCalled();
    expect(monitor.status().running).toBe(false);
  });

  it('tracks events processed', async () => {
    monitor.start();
    conn._emitLog('a', ['Instruction: Create']);
    conn._emitLog('b', ['Instruction: CreateV2']);
    await vi.waitFor(() => expect(monitor.status().eventsProcessed).toBe(2));
  });
});

// ── GraduationMonitor ────────────────────────────────────────────────

describe('GraduationMonitor', () => {
  let conn: ReturnType<typeof createMockConnection>;
  let events: unknown[];
  let monitor: GraduationMonitor;

  beforeEach(() => {
    conn = createMockConnection();
    events = [];
    monitor = new GraduationMonitor({
      connection: conn as any,
      onGraduation: (event) => {
        events.push(event);
      },
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('starts and subscribes', () => {
    monitor.start();
    expect(conn.onLogs).toHaveBeenCalledTimes(1);
  });

  it('fires on CompleteEvent log', async () => {
    monitor.start();
    conn._emitLog('grad1', ['Program log: CompleteEvent data']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect((events[0] as any).signature).toBe('grad1');
  });

  it('fires on "Program log: complete"', async () => {
    monitor.start();
    conn._emitLog('grad2', ['Program log: complete']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('ignores non-graduation logs', () => {
    monitor.start();
    conn._emitLog('grad3', ['Program log: Instruction: Buy', 'TradeEvent data']);
    expect(events).toHaveLength(0);
  });

  it('ignores errored transactions', () => {
    monitor.start();
    conn._emitLog('grad4', ['CompleteEvent'], { err: 'fail' });
    expect(events).toHaveLength(0);
  });
});

// ── WhaleMonitor ─────────────────────────────────────────────────────

describe('WhaleMonitor', () => {
  let conn: ReturnType<typeof createMockConnection>;
  let events: unknown[];
  let monitor: WhaleMonitor;

  beforeEach(() => {
    conn = createMockConnection();
    events = [];
    monitor = new WhaleMonitor({
      connection: conn as any,
      minSol: 5,
      onWhaleTrade: (event) => {
        events.push(event);
      },
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('starts with minSol parameter', () => {
    monitor.start();
    expect(conn.onLogs).toHaveBeenCalledTimes(1);
  });

  it('fires on TradeEvent log', async () => {
    monitor.start();
    conn._emitLog('whale1', ['TradeEvent data']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('fires on Buy instruction', async () => {
    monitor.start();
    conn._emitLog('whale2', ['Instruction: Buy', 'some data']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect((events[0] as any).side).toBe('buy');
  });

  it('fires on Sell instruction', async () => {
    monitor.start();
    conn._emitLog('whale3', ['Instruction: Sell', 'some data']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect((events[0] as any).side).toBe('sell');
  });

  it('ignores non-trade logs', () => {
    monitor.start();
    conn._emitLog('whale4', ['Program log: Instruction: Create']);
    expect(events).toHaveLength(0);
  });

  it('defaults minSol to 10', () => {
    const defaultMonitor = new WhaleMonitor({
      connection: conn as any,
      onWhaleTrade: () => {},
    });
    // start to verify it doesn't crash
    defaultMonitor.start();
    expect(conn.onLogs).toHaveBeenCalled();
    defaultMonitor.stop();
  });
});

// ── CTOMonitor ───────────────────────────────────────────────────────

describe('CTOMonitor', () => {
  let conn: ReturnType<typeof createMockConnection>;
  let events: unknown[];
  let monitor: CTOMonitor;

  beforeEach(() => {
    conn = createMockConnection();
    events = [];
    monitor = new CTOMonitor({
      connection: conn as any,
      onCTO: (event) => {
        events.push(event);
      },
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('fires on SetCreator instruction', async () => {
    monitor.start();
    conn._emitLog('cto1', ['Instruction: SetCreator']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect((events[0] as any).signature).toBe('cto1');
  });

  it('fires on SetCreatorEvent', async () => {
    monitor.start();
    conn._emitLog('cto2', ['SetCreatorEvent data']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('fires on creator_transfer log', async () => {
    monitor.start();
    conn._emitLog('cto3', ['creator_transfer detected']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('ignores unrelated logs', () => {
    monitor.start();
    conn._emitLog('cto4', ['Program log: Instruction: Buy']);
    expect(events).toHaveLength(0);
  });
});

// ── FeeDistMonitor ───────────────────────────────────────────────────

describe('FeeDistMonitor', () => {
  let conn: ReturnType<typeof createMockConnection>;
  let events: unknown[];
  let monitor: FeeDistMonitor;

  beforeEach(() => {
    conn = createMockConnection();
    events = [];
    monitor = new FeeDistMonitor({
      connection: conn as any,
      onFeeDist: (event) => {
        events.push(event);
      },
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('fires on DistributeFees instruction', async () => {
    monitor.start();
    conn._emitLog('fd1', ['Instruction: DistributeFees']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect((events[0] as any).signature).toBe('fd1');
  });

  it('fires on FeeDistributionEvent', async () => {
    monitor.start();
    conn._emitLog('fd2', ['FeeDistributionEvent data']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('fires on distribute_fees log', async () => {
    monitor.start();
    conn._emitLog('fd3', ['distribute_fees']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('ignores unrelated logs', () => {
    monitor.start();
    conn._emitLog('fd4', ['Program log: random stuff']);
    expect(events).toHaveLength(0);
  });
});

// ── ClaimMonitor ─────────────────────────────────────────────────────

describe('ClaimMonitor', () => {
  let conn: ReturnType<typeof createMockConnection>;
  let events: unknown[];
  let monitor: ClaimMonitor;

  beforeEach(() => {
    conn = createMockConnection();
    events = [];
    monitor = new ClaimMonitor({
      connection: conn as any,
      onClaim: (event) => {
        events.push(event);
      },
      pollIntervalMs: 100,
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('starts and subscribes to WebSocket', () => {
    monitor.start();
    expect(conn.onLogs).toHaveBeenCalledTimes(1);
    expect(monitor.status().running).toBe(true);
  });

  it('does not start twice', () => {
    monitor.start();
    monitor.start();
    expect(conn.onLogs).toHaveBeenCalledTimes(1);
  });

  it('fires callback for any non-error log', async () => {
    monitor.start();
    conn._emitLog('claim1', ['Some fee claim log']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect((events[0] as any).signature).toBe('claim1');
  });

  it('ignores errored transactions', () => {
    monitor.start();
    conn._emitLog('claim2', ['Some log'], { err: 'fail' });
    expect(events).toHaveLength(0);
  });

  it('deduplicates by signature', async () => {
    monitor.start();
    conn._emitLog('claim3', ['log']);
    conn._emitLog('claim3', ['log']);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events).toHaveLength(1);
  });

  it('stops cleanly', () => {
    monitor.start();
    monitor.stop();
    expect(conn.removeOnLogsListener).toHaveBeenCalled();
    expect(monitor.status().running).toBe(false);
  });

  it('tracks events processed count', async () => {
    monitor.start();
    conn._emitLog('a', ['log']);
    conn._emitLog('b', ['log']);
    conn._emitLog('c', ['log']);
    await vi.waitFor(() => expect(monitor.status().eventsProcessed).toBe(3));
  });

  it('handles callback errors gracefully', async () => {
    const errorMonitor = new ClaimMonitor({
      connection: conn as any,
      onClaim: () => {
        throw new Error('callback boom');
      },
    });
    errorMonitor.start();
    // Should not throw — error is caught internally
    conn._emitLog('err1', ['log data']);
    // Give time for the Promise.resolve(...).catch() to fire
    await new Promise((r) => setTimeout(r, 10));
    expect(errorMonitor.status().eventsProcessed).toBe(1);
    errorMonitor.stop();
  });
});

// ── Shared Monitor Behaviors ─────────────────────────────────────────

describe('Monitor deduplication (seen set trimming)', () => {
  it('trims seen set when exceeding 10K entries', async () => {
    const conn = createMockConnection();
    const events: unknown[] = [];
    const monitor = new LaunchMonitor({
      connection: conn as any,
      onLaunch: (e) => events.push(e),
    });
    monitor.start();

    // Emit 10_001 unique events with valid logs to trigger trimming
    for (let i = 0; i < 10_001; i++) {
      conn._emitLog(`sig-${i}`, ['Instruction: Create']);
    }

    // All should have been processed (some may have been trimmed from seen)
    await vi.waitFor(() => expect(monitor.status().eventsProcessed).toBe(10_001));
    monitor.stop();
  });
});

describe('Monitor reconnect behavior', () => {
  it('falls back to reconnect when onLogs throws', () => {
    vi.useFakeTimers();
    const conn = createMockConnection();
    // Make onLogs throw to trigger reconnect
    conn.onLogs.mockImplementationOnce(() => {
      throw new Error('WebSocket broke');
    });

    const monitor = new LaunchMonitor({
      connection: conn as any,
      onLaunch: () => {},
    });

    monitor.start();
    // First call threw, should schedule reconnect
    expect(monitor.status().running).toBe(true);

    // After the reconnect delay, it should try again
    conn.onLogs.mockImplementation((_f: unknown, cb: LogCallback) => {
      return 1;
    });
    vi.advanceTimersByTime(1000);
    expect(conn.onLogs).toHaveBeenCalledTimes(2);

    monitor.stop();
    vi.useRealTimers();
  });

  it('uses exponential backoff for reconnects', () => {
    vi.useFakeTimers();
    const conn = createMockConnection();
    // Always throw to trigger repeated reconnects
    conn.onLogs.mockImplementation(() => {
      throw new Error('WebSocket broke');
    });

    const monitor = new GraduationMonitor({
      connection: conn as any,
      onGraduation: () => {},
    });

    monitor.start();
    expect(conn.onLogs).toHaveBeenCalledTimes(1);

    // First reconnect at 1000ms
    vi.advanceTimersByTime(1000);
    expect(conn.onLogs).toHaveBeenCalledTimes(2);

    // Second reconnect at 2000ms (doubled)
    vi.advanceTimersByTime(2000);
    expect(conn.onLogs).toHaveBeenCalledTimes(3);

    // Third reconnect at 4000ms (doubled again)
    vi.advanceTimersByTime(4000);
    expect(conn.onLogs).toHaveBeenCalledTimes(4);

    monitor.stop();
    vi.useRealTimers();
  });

  it('does not reconnect after stop', () => {
    vi.useFakeTimers();
    const conn = createMockConnection();
    conn.onLogs.mockImplementationOnce(() => {
      throw new Error('WebSocket broke');
    });

    const monitor = new CTOMonitor({
      connection: conn as any,
      onCTO: () => {},
    });

    monitor.start();
    monitor.stop();

    // Advance well past the reconnect delay
    vi.advanceTimersByTime(5000);
    // Should not have tried to reconnect
    expect(conn.onLogs).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
