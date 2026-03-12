import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export type TradeType = 'buy' | 'sell' | 'create' | 'migrate';

export interface TradeEntry {
  id: string;
  type: TradeType;
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  solAmount: number;
  tokenAmount: number;
  trader: string | null;
  signature: string;
  timestamp: string;
  isWhale: boolean;
  isNew: boolean;
}

export interface TradeStats {
  total: number;
  buys: number;
  sells: number;
  creates: number;
  whales: number;
  volumeSol: number;
  rate: number;
}

const WS_ENDPOINTS = [
  { url: 'wss://pumpportal.fun/api/data', protocol: 'pumpportal' as const, label: 'PumpPortal' },
  { url: 'wss://pump-fun-websocket-production.up.railway.app/ws', protocol: 'relay' as const, label: 'Relay Server' },
];

const MAX_ENTRIES = 300;
const WHALE_THRESHOLD_SOL = 1; // 1 SOL

export function useTradeStream() {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [stats, setStats] = useState<TradeStats>({ total: 0, buys: 0, sells: 0, creates: 0, whales: 0, volumeSol: 0, rate: 0 });
  const [whaleAlerts, setWhaleAlerts] = useState<TradeEntry[]>([]);
  const retryDelay = useRef(1000);
  const endpointIndex = useRef(0);
  const statsRef = useRef<TradeStats>({ total: 0, buys: 0, sells: 0, creates: 0, whales: 0, volumeSol: 0, rate: 0 });
  const rateCount = useRef(0);
  const idCounter = useRef(0);
  const endpointLabel = useRef('');

  const ingest = useCallback((entry: TradeEntry) => {
    const s = statsRef.current;
    s.total++;
    if (entry.type === 'buy') s.buys++;
    else if (entry.type === 'sell') s.sells++;
    else if (entry.type === 'create') s.creates++;
    if (entry.solAmount > 0) s.volumeSol += entry.solAmount;
    if (entry.isWhale) {
      s.whales++;
      setWhaleAlerts((prev) => [entry, ...prev].slice(0, 10));
    }
    rateCount.current++;
    setTrades((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
  }, []);

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
      endpointLabel.current = ep.label;

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
          ws!.send(JSON.stringify({ method: 'subscribeNewToken' }));
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

  return { trades, status, stats, whaleAlerts, endpoint: endpointLabel.current };
}

// ── Parsers ──────────────────────────────────────────────────────────

function parsePumpPortal(
  msg: Record<string, unknown>,
  idRef: React.MutableRefObject<number>,
): TradeEntry | null {
  const txType = (typeof msg.txType === 'string' ? msg.txType : '').toLowerCase();

  let type: TradeType;
  if (txType === 'buy') type = 'buy';
  else if (txType === 'sell') type = 'sell';
  else if (txType === 'create' || (!msg.txType && msg.mint && msg.name)) type = 'create';
  else if (txType === 'migrate') type = 'migrate';
  else return null;

  let solAmount = 0;
  const raw = msg.solAmount as number | undefined;
  if (raw !== undefined) {
    solAmount = raw > 1e6 ? raw / 1e9 : raw;
  }

  return {
    id: `trade-${++idRef.current}`,
    type,
    mint: (msg.mint as string) || '',
    tokenName: (msg.name as string) || null,
    tokenSymbol: (msg.symbol as string) || null,
    solAmount,
    tokenAmount: (msg.tokenAmount as number) || 0,
    trader: (msg.traderPublicKey as string) || null,
    signature: (msg.signature as string) || '',
    timestamp: new Date().toISOString(),
    isWhale: solAmount >= WHALE_THRESHOLD_SOL,
    isNew: true,
  };
}

function parseRelay(
  msg: Record<string, unknown>,
  idRef: React.MutableRefObject<number>,
): TradeEntry | null {
  const msgType = msg.type as string | undefined;
  if (!msgType && !msg.mint) return null;

  let type: TradeType = 'create';
  if (msgType === 'buy') type = 'buy';
  else if (msgType === 'sell') type = 'sell';
  else if (msgType === 'migrate' || msgType === 'graduation') type = 'migrate';

  const solRaw = msg.solAmount as number | undefined;
  const solAmount = solRaw !== undefined ? (solRaw > 1e6 ? solRaw / 1e9 : solRaw) : 0;

  return {
    id: `trade-${++idRef.current}`,
    type,
    mint: (msg.mint as string) || '',
    tokenName: (msg.name as string) || (msg.tokenName as string) || null,
    tokenSymbol: (msg.symbol as string) || (msg.tokenSymbol as string) || null,
    solAmount,
    tokenAmount: (msg.tokenAmount as number) || 0,
    trader: (msg.creator as string) || (msg.traderPublicKey as string) || null,
    signature: (msg.signature as string) || '',
    timestamp: new Date().toISOString(),
    isWhale: solAmount >= WHALE_THRESHOLD_SOL,
    isNew: true,
  };
}
