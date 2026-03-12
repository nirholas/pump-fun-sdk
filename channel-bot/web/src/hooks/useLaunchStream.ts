import { useEffect, useRef, useState } from 'react';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface LaunchEntry {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  creator: string;
  signature: string;
  timestamp: string;
  marketCapSol: number;
  imageUrl: string | null;
  isNew: boolean;
}

/**
 * WebSocket endpoints tried in order.
 * PumpPortal: free WebSocket API for Pump.fun token creates.
 * Relay: proxied Solana RPC logsSubscribe via Railway.
 */
const WS_ENDPOINTS = [
  { url: 'wss://pumpportal.fun/api/data', protocol: 'pumpportal' as const, label: 'PumpPortal' },
  { url: 'wss://pump-fun-websocket-production.up.railway.app/ws', protocol: 'relay' as const, label: 'Relay Server' },
];

const MAX_ENTRIES = 200;

/**
 * Connects to PumpPortal (or relay fallback) WebSocket for real-time
 * new token launches. Auto-reconnects with exponential backoff.
 */
export function useLaunchStream() {
  const [launches, setLaunches] = useState<LaunchEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [stats, setStats] = useState({ total: 0, rate: 0, viewers: 0 });
  const retryDelay = useRef(1000);
  const endpointIndex = useRef(0);
  const totalRef = useRef(0);
  const rateCountRef = useRef(0);
  const activeLabel = useRef('');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let mounted = true;
    let connectTimeout: ReturnType<typeof setTimeout> | null = null;
    let rateInterval: ReturnType<typeof setInterval> | null = null;

    function startRateCounter() {
      if (rateInterval) return;
      rateInterval = setInterval(() => {
        if (!mounted) return;
        setStats((prev) => ({ ...prev, total: totalRef.current, rate: rateCountRef.current }));
        rateCountRef.current = 0;
      }, 1000);
    }

    function connect() {
      if (!mounted) return;
      setStatus('connecting');

      const ep = WS_ENDPOINTS[endpointIndex.current % WS_ENDPOINTS.length]!;
      endpointIndex.current++;
      activeLabel.current = ep.label;

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
        }
      };

      ws.onmessage = (evt) => {
        if (!mounted) return;
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(evt.data as string) as Record<string, unknown>; } catch { return; }

        if (ep.protocol === 'relay') {
          if (msg.type === 'heartbeat') return;
          if (msg.type === 'status') {
            if (typeof msg.clients === 'number') {
              setStats((prev) => ({ ...prev, viewers: msg.clients as number }));
            }
            return;
          }
        }

        const entry = ep.protocol === 'pumpportal'
          ? parsePumpPortal(msg)
          : parseRelay(msg);

        if (entry) {
          totalRef.current++;
          rateCountRef.current++;
          setLaunches((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
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
  }, []);

  return { launches, status, stats, endpoint: activeLabel.current };
}

// ── Parsers ──────────────────────────────────────────────────────────

let idCounter = 0;

function parsePumpPortal(msg: Record<string, unknown>): LaunchEntry | null {
  // PumpPortal sends { txType:'create', mint, name, symbol, signature, vSolInBondingCurve, ... }
  // subscribeNewToken events have no txType but have mint + name
  const txType = (typeof msg.txType === 'string' ? msg.txType : '').toLowerCase();
  const hasCreate = txType === 'create' || (!msg.txType && msg.mint && msg.name);
  if (!hasCreate) return null;

  const vSol = (msg.vSolInBondingCurve as number) || 0;
  const vTok = (msg.vTokensInBondingCurve as number) || 0;
  const supply = (msg.tokenTotalSupply as number) || (vTok > 0 ? 1e15 : 0);
  let mcap = (msg.marketCapSol as number) || 0;
  if (!mcap && vTok > 0 && vSol > 0) {
    mcap = (vSol / vTok) * supply / 1e9;
  }

  return {
    id: `launch-${++idCounter}`,
    name: (msg.name as string) || 'Unknown',
    symbol: (msg.symbol as string) || '???',
    mint: (msg.mint as string) || '',
    creator: (msg.traderPublicKey as string) || '',
    signature: (msg.signature as string) || '',
    timestamp: new Date().toISOString(),
    marketCapSol: mcap,
    imageUrl: null,
    isNew: true,
  };
}

function parseRelay(msg: Record<string, unknown>): LaunchEntry | null {
  if (msg.type !== 'token-launch' && !msg.mint) return null;

  return {
    id: `launch-${++idCounter}`,
    name: (msg.name as string) || 'Unknown',
    symbol: (msg.symbol as string) || '???',
    mint: (msg.mint as string) || '',
    creator: (msg.creator as string) || '',
    signature: (msg.signature as string) || '',
    timestamp: new Date().toISOString(),
    marketCapSol: 0,
    imageUrl: (msg.imageUri as string) || null,
    isNew: true,
  };
}
