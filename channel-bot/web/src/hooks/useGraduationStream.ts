import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface GraduationEntry {
  id: string;
  mint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  pool: string | null;
  creator: string | null;
  signature: string;
  timestamp: string;
  isNew: boolean;
}

export interface GraduationStats {
  total: number;
  rate: number;
}

const WS_ENDPOINTS = [
  { url: 'wss://pumpportal.fun/api/data', protocol: 'pumpportal' as const, label: 'PumpPortal' },
  { url: 'wss://pump-fun-websocket-production.up.railway.app/ws', protocol: 'relay' as const, label: 'Relay Server' },
];

const MAX_ENTRIES = 200;

export function useGraduationStream() {
  const [graduations, setGraduations] = useState<GraduationEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [stats, setStats] = useState<GraduationStats>({ total: 0, rate: 0 });
  const retryDelay = useRef(1000);
  const endpointIndex = useRef(0);
  const totalRef = useRef(0);
  const rateCount = useRef(0);
  const idCounter = useRef(0);

  const ingest = useCallback((entry: GraduationEntry) => {
    totalRef.current++;
    rateCount.current++;
    setGraduations((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
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
        setStats({ total: totalRef.current, rate: rateCount.current });
        rateCount.current = 0;
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

  return { graduations, status, stats };
}

// ── Parsers ──────────────────────────────────────────────────────────

function parsePumpPortal(
  msg: Record<string, unknown>,
  idRef: React.MutableRefObject<number>,
): GraduationEntry | null {
  const txType = (typeof msg.txType === 'string' ? msg.txType : '').toLowerCase();
  if (txType !== 'migrate') return null;

  return {
    id: `grad-${++idRef.current}`,
    mint: (msg.mint as string) || '',
    tokenName: (msg.name as string) || null,
    tokenSymbol: (msg.symbol as string) || null,
    pool: (msg.pool as string) || null,
    creator: (msg.traderPublicKey as string) || null,
    signature: (msg.signature as string) || '',
    timestamp: new Date().toISOString(),
    isNew: true,
  };
}

function parseRelay(
  msg: Record<string, unknown>,
  idRef: React.MutableRefObject<number>,
): GraduationEntry | null {
  const msgType = msg.type as string | undefined;
  if (msgType !== 'graduation' && msgType !== 'migrate') return null;

  return {
    id: `grad-${++idRef.current}`,
    mint: (msg.mint as string) || (msg.tokenMint as string) || '',
    tokenName: (msg.name as string) || (msg.tokenName as string) || null,
    tokenSymbol: (msg.symbol as string) || (msg.tokenSymbol as string) || null,
    pool: (msg.pool as string) || null,
    creator: (msg.creator as string) || (msg.traderPublicKey as string) || null,
    signature: (msg.signature as string) || '',
    timestamp: new Date().toISOString(),
    isNew: true,
  };
}
