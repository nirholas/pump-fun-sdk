import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface CTOEntry {
  id: string;
  kind: 'cto';
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  oldCreator: string;
  newCreator: string;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

export interface DistributionEntry {
  id: string;
  kind: 'distribution';
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  shareholders: Array<{ address: string; amountSol: number }>;
  totalSol: number;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

export type CTOFeedEntry = CTOEntry | DistributionEntry;

export interface CTOStats {
  totalCTO: number;
  totalDistributions: number;
  totalDistributedSol: number;
  rate: number;
}

const WS_ENDPOINTS = [
  { url: 'wss://pumpportal.fun/api/data', protocol: 'pumpportal' as const, label: 'PumpPortal' },
  { url: 'wss://pump-fun-websocket-production.up.railway.app/ws', protocol: 'relay' as const, label: 'Relay Server' },
];

const MAX_ENTRIES = 200;
const DEMO_INTERVAL_MIN = 8_000;
const DEMO_INTERVAL_MAX = 15_000;
const DEMO_TRIGGER_MS = 30_000;

// ── Demo data generators ─────────────────────────────────────────────

const DEMO_NAMES = ['MoonCat', 'SolDoge', 'PumpKing', 'DeFiApe', 'GigaChad', 'BonkJr', 'WenLambo'];
const DEMO_SYMBOLS = ['MCAT', 'SDOGE', 'PKING', 'DAPE', 'GIGA', 'BONKJ', 'WLMB'];

function randomAddr(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 44; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomSig(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 88; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function generateDemoCTO(idRef: React.MutableRefObject<number>): CTOEntry {
  const idx = Math.floor(Math.random() * DEMO_NAMES.length);
  return {
    id: `cto-${++idRef.current}`,
    kind: 'cto',
    mint: randomAddr(),
    tokenName: DEMO_NAMES[idx] ?? 'DemoToken',
    tokenSymbol: DEMO_SYMBOLS[idx] ?? 'DEMO',
    oldCreator: randomAddr(),
    newCreator: randomAddr(),
    signature: randomSig(),
    timestamp: new Date().toISOString(),
    isNew: true,
  };
}

function generateDemoDistribution(idRef: React.MutableRefObject<number>): DistributionEntry {
  const idx = Math.floor(Math.random() * DEMO_NAMES.length);
  const count = 2 + Math.floor(Math.random() * 3);
  const shareholders: Array<{ address: string; amountSol: number }> = [];
  let totalSol = 0;
  for (let i = 0; i < count; i++) {
    const amt = Math.round((0.1 + Math.random() * 2) * 1000) / 1000;
    shareholders.push({ address: randomAddr(), amountSol: amt });
    totalSol += amt;
  }
  return {
    id: `dist-${++idRef.current}`,
    kind: 'distribution',
    mint: randomAddr(),
    tokenName: DEMO_NAMES[idx] ?? 'DemoToken',
    tokenSymbol: DEMO_SYMBOLS[idx] ?? 'DEMO',
    shareholders,
    totalSol: Math.round(totalSol * 1000) / 1000,
    signature: randomSig(),
    timestamp: new Date().toISOString(),
    isNew: true,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useCTOStream() {
  const [entries, setEntries] = useState<CTOFeedEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [stats, setStats] = useState<CTOStats>({ totalCTO: 0, totalDistributions: 0, totalDistributedSol: 0, rate: 0 });
  const [isDemo, setIsDemo] = useState(false);

  const retryDelay = useRef(1000);
  const endpointIndex = useRef(0);
  const statsRef = useRef<CTOStats>({ totalCTO: 0, totalDistributions: 0, totalDistributedSol: 0, rate: 0 });
  const rateCount = useRef(0);
  const idCounter = useRef(0);
  const lastRealEvent = useRef(Date.now());

  const ingest = useCallback((entry: CTOFeedEntry) => {
    const s = statsRef.current;
    if (entry.kind === 'cto') s.totalCTO++;
    else {
      s.totalDistributions++;
      s.totalDistributedSol += entry.totalSol;
    }
    rateCount.current++;
    lastRealEvent.current = Date.now();
    setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
  }, []);

  // Main WebSocket connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let mounted = true;
    let connectTimeout: ReturnType<typeof setTimeout> | null = null;
    let rateInterval: ReturnType<typeof setInterval> | null = null;

    function startRateCounter() {
      if (rateInterval) return;
      rateInterval = setInterval(() => {
        if (!mounted) return;
        statsRef.current.rate = rateCount.current;
        rateCount.current = 0;
        setStats({ ...statsRef.current });
      }, 1000);
    }

    function connect() {
      if (!mounted) return;
      setStatus('connecting');

      const ep = WS_ENDPOINTS[endpointIndex.current % WS_ENDPOINTS.length]!;
      endpointIndex.current++;

      try {
        ws = new WebSocket(ep.url);
      } catch {
        scheduleReconnect();
        return;
      }

      connectTimeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          try { ws.close(); } catch { /* ignore */ }
        }
      }, 10_000);

      ws.onopen = () => {
        if (!mounted) return;
        if (connectTimeout) clearTimeout(connectTimeout);
        retryDelay.current = 1000;
        endpointIndex.current = 0;
        setStatus('connected');
        startRateCounter();

        if (ep.protocol === 'pumpportal') {
          ws!.send(JSON.stringify({ method: 'subscribeTokenTrade', keys: ['all'] }));
        }
      };

      ws.onmessage = (evt) => {
        if (!mounted) return;
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(evt.data as string) as Record<string, unknown>; } catch { return; }

        if (ep.protocol === 'relay') {
          if (msg.type === 'heartbeat' || msg.type === 'status') return;
        }

        const entry = ep.protocol === 'pumpportal'
          ? parsePumpPortalCTO(msg, idCounter)
          : parseRelayCTO(msg, idCounter);

        if (entry) ingest(entry);
      };

      ws.onerror = () => {
        if (connectTimeout) clearTimeout(connectTimeout);
      };

      ws.onclose = () => {
        if (connectTimeout) clearTimeout(connectTimeout);
        ws = null;
        if (!mounted) return;
        setStatus('disconnected');
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (!mounted) return;
      const delay = retryDelay.current;
      retryDelay.current = Math.min(retryDelay.current * 1.5, 30_000);
      setTimeout(connect, delay);
    }

    connect();

    return () => {
      mounted = false;
      if (connectTimeout) clearTimeout(connectTimeout);
      if (rateInterval) clearInterval(rateInterval);
      if (ws) { try { ws.close(); } catch { /* ignore */ } }
    };
  }, [ingest]);

  // Demo mode: generate sample events when no real data arrives
  useEffect(() => {
    let demoTimeout: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function scheduleDemoEvent() {
      if (!mounted) return;
      const elapsed = Date.now() - lastRealEvent.current;
      if (elapsed < DEMO_TRIGGER_MS) {
        // Check again later
        demoTimeout = setTimeout(scheduleDemoEvent, DEMO_TRIGGER_MS - elapsed + 500);
        return;
      }

      setIsDemo(true);
      const entry = Math.random() > 0.5
        ? generateDemoCTO(idCounter)
        : generateDemoDistribution(idCounter);
      ingest(entry);

      const next = DEMO_INTERVAL_MIN + Math.random() * (DEMO_INTERVAL_MAX - DEMO_INTERVAL_MIN);
      demoTimeout = setTimeout(scheduleDemoEvent, next);
    }

    // Start checking after DEMO_TRIGGER_MS
    demoTimeout = setTimeout(scheduleDemoEvent, DEMO_TRIGGER_MS);

    return () => {
      mounted = false;
      if (demoTimeout) clearTimeout(demoTimeout);
    };
  }, [ingest]);

  // When real events arrive, turn off demo mode
  useEffect(() => {
    if (entries.length > 0 && !isDemo) return;
    // If we get entries while in demo, check if latest was a real event (within 1s)
    const latest = entries[0];
    if (latest && Date.now() - lastRealEvent.current < 1000) {
      setIsDemo(false);
    }
  }, [entries, isDemo]);

  return { entries, status, stats, isDemo };
}

// ── Parsers ──────────────────────────────────────────────────────────

function parsePumpPortalCTO(
  msg: Record<string, unknown>,
  idRef: React.MutableRefObject<number>,
): CTOFeedEntry | null {
  const txType = (typeof msg.txType === 'string' ? msg.txType : '').toLowerCase();

  // CTO events from PumpPortal
  if (txType === 'cto' || (msg.oldCreator && msg.newCreator)) {
    return {
      id: `cto-${++idRef.current}`,
      kind: 'cto',
      mint: (msg.mint as string) || '',
      tokenName: (msg.name as string) || null,
      tokenSymbol: (msg.symbol as string) || null,
      oldCreator: (msg.oldCreator as string) || '',
      newCreator: (msg.newCreator as string) || '',
      signature: (msg.signature as string) || '',
      timestamp: new Date().toISOString(),
      isNew: true,
    };
  }

  return null;
}

function parseRelayCTO(
  msg: Record<string, unknown>,
  idRef: React.MutableRefObject<number>,
): CTOFeedEntry | null {
  const msgType = msg.type as string | undefined;

  if (msgType === 'cto') {
    return {
      id: `cto-${++idRef.current}`,
      kind: 'cto',
      mint: (msg.tokenMint as string) || (msg.mint as string) || '',
      tokenName: (msg.name as string) || (msg.tokenName as string) || null,
      tokenSymbol: (msg.symbol as string) || (msg.tokenSymbol as string) || null,
      oldCreator: (msg.oldCreator as string) || '',
      newCreator: (msg.newCreator as string) || '',
      signature: (msg.signature as string) || '',
      timestamp: new Date().toISOString(),
      isNew: true,
    };
  }

  if (msgType === 'distribution') {
    const rawShareholders = msg.shareholders as Array<{ address: string; amountSol: number }> | undefined;
    const shareholders = Array.isArray(rawShareholders)
      ? rawShareholders.map((s) => ({ address: String(s.address), amountSol: Number(s.amountSol) || 0 }))
      : [];
    const totalSol = shareholders.reduce((sum, s) => sum + s.amountSol, 0);

    return {
      id: `dist-${++idRef.current}`,
      kind: 'distribution',
      mint: (msg.tokenMint as string) || (msg.mint as string) || '',
      tokenName: (msg.name as string) || (msg.tokenName as string) || null,
      tokenSymbol: (msg.symbol as string) || (msg.tokenSymbol as string) || null,
      shareholders,
      totalSol: Math.round(totalSol * 1000) / 1000,
      signature: (msg.signature as string) || '',
      timestamp: new Date().toISOString(),
      isNew: true,
    };
  }

  return null;
}
