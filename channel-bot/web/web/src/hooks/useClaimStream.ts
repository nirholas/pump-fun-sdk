import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export type ClaimType = 'creator_fee' | 'cashback' | 'social_fee';

export interface ClaimEntry {
  id: string;
  claimerWallet: string;
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  amountSol: number;
  claimType: ClaimType;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

export interface ClaimStats {
  total: number;
  totalSol: number;
  creatorFees: number;
  cashback: number;
  socialFees: number;
  rate: number;
}

const WS_ENDPOINTS = [
  { url: 'wss://pumpportal.fun/api/data', protocol: 'pumpportal' as const, label: 'PumpPortal' },
  { url: 'wss://pump-fun-websocket-production.up.railway.app/ws', protocol: 'relay' as const, label: 'Relay Server' },
];

const MAX_ENTRIES = 300;
const DEMO_INTERVAL_MIN = 5000;
const DEMO_INTERVAL_MAX = 10000;

const DEMO_TOKENS = [
  { name: 'PumpDog', symbol: 'PDOG', mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
  { name: 'SolCat', symbol: 'SCAT', mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
  { name: 'MoonFrog', symbol: 'MFRG', mint: '3Kz9bKSHmpMF6YcJJm8vJn7fbSEFph5MZb1MyWLupump' },
  { name: 'DegenApe', symbol: 'DAPE', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { name: 'LamboToken', symbol: 'LMBO', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
];

const DEMO_WALLETS = [
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'HN7cABqLq46Es1jh92dQQisAi5YqRa3B2CrcXBRxpump',
  '7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPivGeLbqEUefS',
];

function randomDemo(): ClaimEntry {
  const token = DEMO_TOKENS[Math.floor(Math.random() * DEMO_TOKENS.length)]!;
  const wallet = DEMO_WALLETS[Math.floor(Math.random() * DEMO_WALLETS.length)]!;
  const types: ClaimType[] = ['creator_fee', 'cashback', 'social_fee'];
  const weights = [0.6, 0.3, 0.1]; // creator_fee most common
  const r = Math.random();
  const claimType = r < weights[0]! ? types[0]! : r < weights[0]! + weights[1]! ? types[1]! : types[2]!;
  const amountSol = +(Math.random() * 2 + 0.01).toFixed(4);

  return {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    claimerWallet: wallet,
    mint: token.mint,
    tokenName: token.name,
    tokenSymbol: token.symbol,
    amountSol,
    claimType,
    signature: Array.from({ length: 88 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join(''),
    timestamp: new Date().toISOString(),
    isNew: true,
  };
}

export function useClaimStream() {
  const [claims, setClaims] = useState<ClaimEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [stats, setStats] = useState<ClaimStats>({ total: 0, totalSol: 0, creatorFees: 0, cashback: 0, socialFees: 0, rate: 0 });
  const [isDemo, setIsDemo] = useState(false);
  const retryDelay = useRef(1000);
  const endpointIndex = useRef(0);
  const statsRef = useRef<ClaimStats>({ total: 0, totalSol: 0, creatorFees: 0, cashback: 0, socialFees: 0, rate: 0 });
  const rateCount = useRef(0);
  const idCounter = useRef(0);
  const lastRealEvent = useRef(Date.now());
  const demoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ingest = useCallback((entry: ClaimEntry) => {
    const s = statsRef.current;
    s.total++;
    s.totalSol += entry.amountSol;
    if (entry.claimType === 'creator_fee') s.creatorFees++;
    else if (entry.claimType === 'cashback') s.cashback++;
    else if (entry.claimType === 'social_fee') s.socialFees++;
    rateCount.current++;
    setClaims((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
  }, []);

  // Demo mode: generate sample claims when no real data flows
  useEffect(() => {
    let mounted = true;

    function scheduleDemoEvent() {
      if (!mounted) return;
      const delay = DEMO_INTERVAL_MIN + Math.random() * (DEMO_INTERVAL_MAX - DEMO_INTERVAL_MIN);
      demoTimeout.current = setTimeout(() => {
        if (!mounted) return;
        const timeSinceLast = Date.now() - lastRealEvent.current;
        if (timeSinceLast > 15_000) {
          setIsDemo(true);
          ingest(randomDemo());
        }
        scheduleDemoEvent();
      }, delay);
    }

    scheduleDemoEvent();

    return () => {
      mounted = false;
      if (demoTimeout.current) clearTimeout(demoTimeout.current);
    };
  }, [ingest]);

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
          ? parsePumpPortal(msg, idCounter)
          : parseRelay(msg, idCounter);

        if (entry) {
          lastRealEvent.current = Date.now();
          setIsDemo(false);
          ingest(entry);
        }
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

  return { claims, status, stats, isDemo };
}

// ── Parsers ──────────────────────────────────────────────────────────

function parsePumpPortal(
  msg: Record<string, unknown>,
  idRef: React.MutableRefObject<number>,
): ClaimEntry | null {
  // PumpPortal may surface claim events in its trade stream
  const txType = (typeof msg.txType === 'string' ? msg.txType : '').toLowerCase();
  const claimTypeField = typeof msg.claimType === 'string' ? msg.claimType : null;

  // Check for claim indicators
  if (!txType.includes('claim') && !claimTypeField) return null;

  const claimType = parseClaimType(claimTypeField || txType);
  if (!claimType) return null;

  let amountSol = 0;
  const raw = msg.solAmount as number | undefined;
  if (raw !== undefined) {
    amountSol = raw > 1e6 ? raw / 1e9 : raw;
  }
  if (!amountSol) {
    const amt = msg.amountSol as number | undefined;
    if (amt !== undefined) amountSol = amt;
  }

  return {
    id: `claim-${++idRef.current}`,
    claimerWallet: (msg.traderPublicKey as string) || (msg.claimerWallet as string) || '',
    mint: (msg.mint as string) || '',
    tokenName: (msg.name as string) || (msg.tokenName as string) || null,
    tokenSymbol: (msg.symbol as string) || (msg.tokenSymbol as string) || null,
    amountSol,
    claimType,
    signature: (msg.signature as string) || '',
    timestamp: new Date().toISOString(),
    isNew: true,
  };
}

function parseRelay(
  msg: Record<string, unknown>,
  idRef: React.MutableRefObject<number>,
): ClaimEntry | null {
  if (msg.type !== 'claim') return null;

  const claimType = parseClaimType((msg.claimType as string) || '');
  if (!claimType) return null;

  const amountSol = (msg.amountSol as number) || (msg.solAmount as number) || 0;

  return {
    id: `claim-${++idRef.current}`,
    claimerWallet: (msg.claimerWallet as string) || '',
    mint: (msg.tokenMint as string) || (msg.mint as string) || '',
    tokenName: (msg.tokenName as string) || null,
    tokenSymbol: (msg.tokenSymbol as string) || null,
    amountSol,
    claimType,
    signature: (msg.signature as string) || '',
    timestamp: new Date().toISOString(),
    isNew: true,
  };
}

function parseClaimType(raw: string): ClaimType | null {
  const s = raw.toLowerCase();
  if (s.includes('creator') || s === 'creator_fee') return 'creator_fee';
  if (s.includes('cashback')) return 'cashback';
  if (s.includes('social')) return 'social_fee';
  // Fallback: if it's just "claim" with no specific type, default to creator_fee
  if (s === 'claim') return 'creator_fee';
  return null;
}
