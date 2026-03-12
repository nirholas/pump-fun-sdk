/**
 * Claim Bot — End-to-End Test Suite
 *
 * Tests tracking store, formatters, type constants, and bot commands.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Tracked Item Store Tests ───────────────────────────────────────────────

describe('Tracked Item Store', () => {
  let store: typeof import('../store.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('node:fs', () => ({
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(() => { throw new Error('ENOENT'); }),
      writeFileSync: vi.fn(),
    }));
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    store = await import('../store.js');
    store.loadTracked();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a token tracked item', () => {
    const item = store.addTrackedItem(12345, 99, 'token', 'MintABC123456789012345678901234567890', 'TestToken');

    expect(item.id).toMatch(/^t_/);
    expect(item.chatId).toBe(12345);
    expect(item.addedBy).toBe(99);
    expect(item.type).toBe('token');
    expect(item.value).toBe('MintABC123456789012345678901234567890');
    expect(item.label).toBe('TestToken');
  });

  it('adds an X handle tracked item', () => {
    const item = store.addTrackedItem(12345, 99, 'xhandle', 'elonmusk', 'Elon');

    expect(item.type).toBe('xhandle');
    expect(item.value).toBe('elonmusk');
  });

  it('retrieves items for a specific chat', () => {
    store.addTrackedItem(100, 1, 'token', 'Mint1');
    store.addTrackedItem(100, 1, 'xhandle', 'handle1');
    store.addTrackedItem(200, 2, 'token', 'Mint2');

    const items = store.getTrackedForChat(100);
    expect(items).toHaveLength(2);
  });

  it('removes a tracked item by value', () => {
    store.addTrackedItem(100, 1, 'token', 'MintToRemove');
    expect(store.removeTrackedByValue('minttoremove', 100)).toBe(true);
    expect(store.getTrackedForChat(100)).toHaveLength(0);
  });

  it('returns false when removing non-existent value', () => {
    expect(store.removeTrackedByValue('doesntexist', 100)).toBe(false);
  });

  it('gets token-only items for a chat', () => {
    store.addTrackedItem(100, 1, 'token', 'Token1');
    store.addTrackedItem(100, 1, 'xhandle', 'handle1');

    const tokens = store.getTrackedTokensForChat(100);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.type).toBe('token');
  });

  it('gets xhandle-only items for a chat', () => {
    store.addTrackedItem(100, 1, 'token', 'Token1');
    store.addTrackedItem(100, 1, 'xhandle', 'handle1');

    const handles = store.getTrackedXHandlesForChat(100);
    expect(handles).toHaveLength(1);
    expect(handles[0]!.type).toBe('xhandle');
  });

  it('gets all tracked token mints across all chats', () => {
    store.addTrackedItem(100, 1, 'token', 'MintA');
    store.addTrackedItem(200, 2, 'token', 'MintB');
    store.addTrackedItem(300, 3, 'xhandle', 'handle1');

    const mints = store.getAllTrackedTokenMints();
    expect(mints.size).toBe(2);
    expect(mints.has('minta')).toBe(true);
    expect(mints.has('mintb')).toBe(true);
  });

  it('gets all tracked X handles across all chats', () => {
    store.addTrackedItem(100, 1, 'xhandle', 'handle1');
    store.addTrackedItem(200, 2, 'xhandle', '@Handle2');
    store.addTrackedItem(300, 3, 'token', 'SomeMint');

    const handles = store.getAllTrackedXHandles();
    expect(handles.size).toBe(2);
    expect(handles.has('handle1')).toBe(true);
    expect(handles.has('handle2')).toBe(true);
  });

  it('finds matching token tracks', () => {
    store.addTrackedItem(100, 1, 'token', 'MatchMint');
    store.addTrackedItem(200, 2, 'token', 'MatchMint');
    store.addTrackedItem(300, 3, 'token', 'OtherMint');

    const matches = store.findMatchingTokenTracks('matchmint');
    expect(matches).toHaveLength(2);
  });

  it('finds matching X handle tracks', () => {
    store.addTrackedItem(100, 1, 'xhandle', 'TrackMe');
    store.addTrackedItem(200, 2, 'xhandle', 'trackme');

    const matches = store.findMatchingXHandleTracks('TRACKME');
    expect(matches).toHaveLength(2);
  });

  it('checks if already tracked', () => {
    store.addTrackedItem(100, 1, 'token', 'AlreadyHere');

    expect(store.isAlreadyTracked('alreadyhere', 100)).toBe(true);
    expect(store.isAlreadyTracked('nothinghere', 100)).toBe(false);
    expect(store.isAlreadyTracked('alreadyhere', 200)).toBe(false);
  });
});

// ── Type Constants Tests ───────────────────────────────────────────────────

describe('Type Constants', () => {
  let types: typeof import('../types.js');

  beforeEach(async () => {
    types = await import('../types.js');
  });

  it('has correct program IDs', () => {
    expect(types.PUMP_PROGRAM_ID).toBe('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    expect(types.PUMP_AMM_PROGRAM_ID).toBe('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
    expect(types.PUMP_FEE_PROGRAM_ID).toBe('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
  });

  it('monitors all three programs', () => {
    expect(types.MONITORED_PROGRAM_IDS).toContain(types.PUMP_PROGRAM_ID);
    expect(types.MONITORED_PROGRAM_IDS).toContain(types.PUMP_AMM_PROGRAM_ID);
    expect(types.MONITORED_PROGRAM_IDS).toContain(types.PUMP_FEE_PROGRAM_ID);
  });

  it('has claim instructions with valid hex discriminators', () => {
    expect(types.CLAIM_INSTRUCTIONS.length).toBeGreaterThanOrEqual(7);
    for (const instr of types.CLAIM_INSTRUCTIONS) {
      expect(instr.discriminator).toMatch(/^[0-9a-f]{16}$/);
      expect(instr.label).toBeTruthy();
      expect(instr.claimType).toBeTruthy();
    }
  });

  it('has social fee PDA claim instruction', () => {
    const socialFee = types.CLAIM_INSTRUCTIONS.find(
      (i) => i.claimType === 'claim_social_fee_pda',
    );
    expect(socialFee).toBeDefined();
    expect(socialFee!.programId).toBe(types.PUMP_FEE_PROGRAM_ID);
  });

  it('has claim event discriminators', () => {
    const keys = Object.keys(types.CLAIM_EVENT_DISCRIMINATORS);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    // Must include SocialFeePdaClaimed event
    const hasSocial = Object.values(types.CLAIM_EVENT_DISCRIMINATORS).some(
      (v) => v.label === 'SocialFeePdaClaimed',
    );
    expect(hasSocial).toBe(true);
  });
});

// ── Formatter Tests ────────────────────────────────────────────────────────

describe('Formatters', () => {
  let formatters: typeof import('../formatters.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('../twitter-client.js', () => ({
      formatFollowerCount: vi.fn((n: number) => `${n}`),
    }));
    formatters = await import('../formatters.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('escapes HTML entities', () => {
    const escaped = formatters.escapeHtml('<b>te"st</b>&');
    expect(escaped).toBe('&lt;b&gt;te&quot;st&lt;/b&gt;&amp;');
  });

  it('formats welcome message with user name', () => {
    const html = formatters.formatWelcome('Bob');
    expect(html).toContain('Bob');
    expect(html).toContain('/add');
  });

  it('formats help with all commands', () => {
    const html = formatters.formatHelp();
    expect(html).toContain('/add');
    expect(html).toContain('/remove');
    expect(html).toContain('/list');
    expect(html).toContain('/status');
  });

  it('formats empty tracked list', () => {
    const html = formatters.formatTrackedList([]);
    expect(html).toContain('No tracked items');
  });

  it('formats tracked list with tokens and handles', () => {
    const items: import('../types.js').TrackedItem[] = [
      {
        id: 't_1',
        chatId: 100,
        addedBy: 1,
        type: 'token',
        value: 'MintABC12345',
        label: 'Token1',
        createdAt: Date.now(),
      },
      {
        id: 't_2',
        chatId: 100,
        addedBy: 1,
        type: 'xhandle',
        value: 'testhandle',
        createdAt: Date.now(),
      },
    ];

    const html = formatters.formatTrackedList(items);
    expect(html).toContain('Tracked Items (2)');
    expect(html).toContain('Token1');
    expect(html).toContain('testhandle');
  });

  it('formats claim notification', () => {
    const event: import('../types.js').FeeClaimEvent = {
      txSignature: 'sig123',
      slot: 300_000_000,
      timestamp: 1700000000,
      claimerWallet: 'ClaimerWallet12345678901234567890123456789',
      tokenMint: 'TokenMint12345678901234567890123456789abcd',
      tokenName: 'TestToken',
      tokenSymbol: 'TST',
      amountSol: 1.25,
      amountLamports: 1_250_000_000,
      claimType: 'collect_creator_fee',
      isCashback: false,
      programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
      claimLabel: 'Collect Creator Fee (Pump)',
    };

    const item: import('../types.js').TrackedItem = {
      id: 'test-1',
      chatId: 100,
      addedBy: 1,
      type: 'token',
      value: 'TokenMint12345678901234567890123456789abcd',
      label: 'TestToken',
      createdAt: Date.now(),
    };

    const html = formatters.formatClaimNotification(event, item, null);
    expect(html).toContain('Collect Creator Fee');
    expect(html).toContain('1.25');
    expect(html).toContain('TestToken');
    expect(html).toContain('solscan.io/tx/');
  });

  it('formats status message', () => {
    const status: import('../formatters.js').MonitorStatus = {
      isRunning: true,
      mode: 'websocket',
      claimsDetected: 42,
      uptimeMs: 9_000_000,
      trackedTokens: 5,
      trackedXHandles: 3,
    };

    const html = formatters.formatStatus(status);
    expect(html).toContain('42');
    expect(html).toContain('websocket');
    expect(html).toContain('5');
    expect(html).toContain('3');
  });
});

// ── Claim Event Matching Flow (E2E) ────────────────────────────────────────

describe('Claim Event Matching Flow', () => {
  let store: typeof import('../store.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('node:fs', () => ({
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(() => { throw new Error('ENOENT'); }),
      writeFileSync: vi.fn(),
    }));
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    store = await import('../store.js');
    store.loadTracked();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches claim event by token mint to tracked items', () => {
    const mint = 'TrackedToken123456789012345678901234567';
    store.addTrackedItem(100, 1, 'token', mint);
    store.addTrackedItem(200, 2, 'token', mint.toLowerCase());

    // Simulate a claim event matching this token
    const matches = store.findMatchingTokenTracks(mint.toLowerCase());
    expect(matches).toHaveLength(2);
    expect(matches[0]!.chatId).toBe(100);
    expect(matches[1]!.chatId).toBe(200);
  });

  it('matches claim event by X handle', () => {
    store.addTrackedItem(100, 1, 'xhandle', 'cryptodev');
    store.addTrackedItem(200, 2, 'xhandle', 'CryptoDev');

    const matches = store.findMatchingXHandleTracks('cryptodev');
    expect(matches).toHaveLength(2);
  });

  it('does not match untracked tokens', () => {
    store.addTrackedItem(100, 1, 'token', 'TrackedOne');

    const matches = store.findMatchingTokenTracks('untrackedtoken');
    expect(matches).toHaveLength(0);
  });

  it('full E2E flow: add tracking → receive event → find matches → format', async () => {
    vi.mock('../twitter-client.js', () => ({
      formatFollowerCount: vi.fn((n: number) => `${n}`),
    }));
    const formatters = await import('../formatters.js');

    // Step 1: User adds token tracking
    const mint = 'E2E_TestMint123456789012345678901234567';
    store.addTrackedItem(100, 1, 'token', mint, 'E2E Token');

    // Step 2: Claim event arrives
    const event: import('../types.js').FeeClaimEvent = {
      txSignature: 'e2e_sig_123',
      slot: 300_000_000,
      timestamp: Math.floor(Date.now() / 1000),
      claimerWallet: 'CreatorWallet1234567890',
      tokenMint: mint,
      tokenName: 'E2E Test Token',
      tokenSymbol: 'E2E',
      amountSol: 0.5,
      amountLamports: 500_000_000,
      claimType: 'collect_creator_fee',
      isCashback: false,
      programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
      claimLabel: 'Collect Creator Fee (Pump)',
    };

    // Step 3: Find matching tracked items
    const matches = store.findMatchingTokenTracks(mint.toLowerCase());
    expect(matches).toHaveLength(1);
    expect(matches[0]!.label).toBe('E2E Token');

    // Step 4: Format notification
    const item: import('../types.js').TrackedItem = {
      id: matches[0]!.id,
      chatId: matches[0]!.chatId,
      addedBy: matches[0]!.addedBy,
      type: matches[0]!.type,
      value: matches[0]!.value,
      label: matches[0]!.label,
      createdAt: matches[0]!.createdAt,
    };
    const html = formatters.formatClaimNotification(event, item, null);
    expect(html).toContain('E2E Test Token');
    expect(html).toContain('Collect Creator Fee');
  });
});
