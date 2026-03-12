import { useEffect, useRef, useState } from 'react';
import type { PumpEvent } from '../lib/types';

const MAX_EVENTS = 200;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface UseEventStreamReturn {
  events: PumpEvent[];
  status: ConnectionStatus;
}

/**
 * WebSocket endpoints tried in order.
 * PumpPortal is a free, purpose-built WebSocket API for Pump.fun trades.
 * The Railway relay server proxies Solana RPC logsSubscribe and re-broadcasts
 * parsed events, avoiding public RPC rate limits.
 */
const WS_ENDPOINTS = [
  { url: 'wss://pumpportal.fun/api/data', protocol: 'pumpportal' as const, label: 'PumpPortal' },
  { url: 'wss://pump-fun-websocket-production.up.railway.app/ws', protocol: 'relay' as const, label: 'Relay Server' },
];

/**
 * Connects to PumpPortal (or relay fallback) WebSocket for real-time
 * Pump.fun events. Auto-reconnects with exponential backoff and endpoint
 * rotation.
 */
export function useEventStream(): UseEventStreamReturn {
  const [events, setEvents] = useState<PumpEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const retryDelay = useRef(1000);
  const endpointIndex = useRef(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let mounted = true;
    let connectTimeout: ReturnType<typeof setTimeout> | null = null;

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
        endpointIndex.current = 0; // reset rotation on success
        setStatus('connected');

        if (ep.protocol === 'pumpportal') {
          ws!.send(JSON.stringify({ method: 'subscribeNewToken' }));
          ws!.send(JSON.stringify({ method: 'subscribeTokenTrade', keys: ['all'] }));
        }
        // relay protocol: no subscription needed, server pushes events
      };

      ws.onmessage = (evt) => {
        if (!mounted) return;
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(evt.data as string) as Record<string, unknown>; } catch { return; }

        const event = ep.protocol === 'pumpportal'
          ? parsePumpPortalMessage(msg)
          : parseRelayMessage(msg);

        if (event) {
          setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
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
      if (ws) { try { ws.close(); } catch { /* ignore */ } }
    };
  }, []);

  return { events, status };
}

// ── PumpPortal message → PumpEvent ──────────────────────────────────

function parsePumpPortalMessage(msg: Record<string, unknown>): PumpEvent | null {
  const txType = (typeof msg.txType === 'string' ? msg.txType : '').toLowerCase();
  const now = new Date().toISOString();
  const sig = (msg.signature as string) || '';
  const slot = (msg.slot as number) || 0;
  const mint = (msg.mint as string) || '';

  if (txType === 'create' || (!msg.txType && msg.mint && msg.name)) {
    return {
      type: 'launch',
      txSignature: sig,
      slot,
      timestamp: now,
      tokenMint: mint,
      name: (msg.name as string) || 'Unknown',
      symbol: (msg.symbol as string) || '???',
      creator: (msg.traderPublicKey as string) || '',
      isCashback: false,
    };
  }

  if (txType === 'buy' || txType === 'sell') {
    const solRaw = msg.solAmount as number | undefined;
    const amountSol = solRaw !== undefined
      ? (solRaw > 1e6 ? solRaw / 1e9 : solRaw)
      : 0;

    // Whale threshold: > 10 SOL
    if (amountSol >= 10) {
      return {
        type: 'whale',
        txSignature: sig,
        slot,
        timestamp: now,
        direction: txType as 'buy' | 'sell',
        amountSol,
        tokenMint: mint,
        wallet: (msg.traderPublicKey as string) || '',
      };
    }

    // Regular trades mapped as launch events (with trade info)
    return {
      type: 'launch',
      txSignature: sig,
      slot,
      timestamp: now,
      tokenMint: mint,
      name: (msg.name as string) || mint.slice(0, 6),
      symbol: (msg.symbol as string) || '???',
      creator: (msg.traderPublicKey as string) || '',
      isCashback: false,
    };
  }

  return null;
}

// ── Relay server message → PumpEvent ────────────────────────────────

function parseRelayMessage(msg: Record<string, unknown>): PumpEvent | null {
  const type = msg.type as string | undefined;
  if (!type) return null;

  const now = new Date().toISOString();
  const sig = (msg.signature as string) || (msg.txSignature as string) || '';
  const slot = (msg.slot as number) || 0;

  if (type === 'create' || type === 'launch') {
    return {
      type: 'launch',
      txSignature: sig,
      slot,
      timestamp: now,
      tokenMint: (msg.mint as string) || (msg.tokenMint as string) || '',
      name: (msg.name as string) || (msg.tokenName as string) || 'Unknown',
      symbol: (msg.symbol as string) || (msg.tokenSymbol as string) || '???',
      creator: (msg.creator as string) || (msg.traderPublicKey as string) || '',
      isCashback: false,
    };
  }

  if (type === 'buy' || type === 'sell') {
    const solRaw = msg.solAmount as number | undefined;
    const amountSol = solRaw !== undefined ? (solRaw > 1e6 ? solRaw / 1e9 : solRaw) : 0;
    return {
      type: 'whale',
      txSignature: sig,
      slot,
      timestamp: now,
      direction: type as 'buy' | 'sell',
      amountSol,
      tokenMint: (msg.mint as string) || (msg.tokenMint as string) || '',
      wallet: (msg.traderPublicKey as string) || (msg.wallet as string) || '',
    };
  }

  if (type === 'migrate' || type === 'graduation') {
    return {
      type: 'graduation',
      txSignature: sig,
      slot,
      timestamp: now,
      tokenMint: (msg.mint as string) || (msg.tokenMint as string) || '',
      tokenName: (msg.name as string) || (msg.tokenName as string),
      pool: msg.pool as string | undefined,
    };
  }

  return null;
}
