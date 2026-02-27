// ════════════════════════════════════════════════════════════════════
// Solana Monitor — dual-mode: WebSocket subscription + HTTP polling
// The free Solana RPC silently drops logsSubscribe data for high-
// traffic programs, so we poll getSignaturesForAddress as a fallback.
// ════════════════════════════════════════════════════════════════════

import WebSocket from 'ws';
import type { TokenLaunchEvent } from './types.js';

const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://cf-ipfs.com/ipfs/';
const METADATA_TIMEOUT = 5000;
const POLL_INTERVAL = 10_000; // 10s between polls (free RPC is heavily limited)
const POLL_LIMIT = 10;        // signatures per poll
const ENRICH_DELAY = 2000;    // 2s between individual tx fetches

export class SolanaMonitor {
  private ws: WebSocket | null = null;
  private subId: number | null = null;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private alive = true;
  private seenSignatures = new Set<string>();
  private lastSignature: string | null = null;
  private httpRpcUrl: string;

  public connected = false;
  public stats = { totalLaunches: 0, githubLaunches: 0, logsReceived: 0 };

  constructor(
    private rpcUrl: string,
    private onLaunch: (event: TokenLaunchEvent) => void,
    private onStatusChange: (connected: boolean) => void,
  ) {
    // Derive HTTP URL from WSS URL
    this.httpRpcUrl = rpcUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  }

  start(): void {
    this.alive = true;
    this.connect();
    this.startPolling();
  }

  stop(): void {
    this.alive = false;
    this.stopPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.disconnect();
  }

  // ── Connect to Solana RPC WebSocket (best-effort) ─────────────────
  private connect(): void {
    if (!this.alive) return;

    console.log(`[solana] Connecting WS to ${this.rpcUrl}...`);

    this.ws = new WebSocket(this.rpcUrl);

    this.ws.on('open', () => {
      console.log('[solana] WS connected — subscribing to Pump program logs');
      this.connected = true;
      this.reconnectDelay = 1000;
      this.onStatusChange(true);

      this.ws!.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'logsSubscribe',
        params: [
          { mentions: [PUMP_PROGRAM] },
          { commitment: 'confirmed' },
        ],
      }));
    });

    this.ws.on('message', (data) => {
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.id === 1 && msg.result !== undefined) {
        this.subId = msg.result;
        console.log(`[solana] WS subscribed (sub=${this.subId})`);
        return;
      }

      if (msg.method === 'logsNotify' && msg.params?.result) {
        this.stats.logsReceived++;
        const { value } = msg.params.result;
        if (value && !value.err && value.signature) {
          this.handleSignatureFromWs(value.signature, value.logs);
        }
      }
    });

    this.ws.on('error', (err) => {
      console.error('[solana] WS error:', err.message);
    });

    this.ws.on('close', (code) => {
      console.log(`[solana] WS disconnected (code=${code})`);
      this.connected = false;
      this.ws = null;
      this.subId = null;
      this.onStatusChange(false);

      if (this.alive) {
        console.log(`[solana] WS reconnecting in ${this.reconnectDelay / 1000}s...`);
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      }
    });
  }

  private disconnect(): void {
    if (this.ws) {
      if (this.subId !== null) {
        try {
          this.ws.send(JSON.stringify({
            jsonrpc: '2.0', id: 2,
            method: 'logsUnsubscribe', params: [this.subId],
          }));
        } catch { /* ignore */ }
      }
      this.ws.close();
      this.ws = null;
    }
  }

  // ── HTTP Polling fallback ─────────────────────────────────────────
  private startPolling(): void {
    console.log(`[poll] Starting HTTP polling every ${POLL_INTERVAL/1000}s against ${this.httpRpcUrl}`);
    // Initial poll after a short delay
    setTimeout(() => this.poll(), 1000);
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const body: any = {
        jsonrpc: '2.0',
        id: 10,
        method: 'getSignaturesForAddress',
        params: [
          PUMP_PROGRAM,
          { limit: POLL_LIMIT, commitment: 'confirmed' },
        ],
      };

      // Use `until` to only get new signatures
      if (this.lastSignature) {
        body.params[1].until = this.lastSignature;
      }

      const resp = await fetch(this.httpRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          console.warn('[poll] Rate limited (429) — backing off');
        } else {
          console.error(`[poll] HTTP ${resp.status}`);
        }
        return;
      }

      const json = await resp.json() as any;
      if (!json.result || !Array.isArray(json.result)) return;

      const sigs: Array<{ signature: string; err: any; memo: string | null }> = json.result;
      if (sigs.length === 0) return;

      // Update cursor to newest signature
      this.lastSignature = sigs[0].signature;

      // Emit each new signature immediately as a basic event
      // (no getTransaction call — avoids rate limits)
      const newSigs: string[] = [];
      for (const sig of sigs) {
        if (sig.err) continue;
        if (this.seenSignatures.has(sig.signature)) continue;
        this.seenSignatures.add(sig.signature);
        newSigs.push(sig.signature);

        // Emit a basic event immediately (name/symbol will say "Loading...")
        const event: TokenLaunchEvent = {
          type: 'token-launch',
          signature: sig.signature,
          time: new Date().toISOString(),
          name: null,
          symbol: null,
          metadataUri: null,
          mint: null,
          creator: null,
          isV2: true,
          hasGithub: false,
          githubUrls: [],
        };
        this.stats.totalLaunches++;
        this.onLaunch(event);
      }

      // Keep seenSignatures bounded
      if (this.seenSignatures.size > 5000) {
        const arr = [...this.seenSignatures];
        this.seenSignatures = new Set(arr.slice(-3000));
      }

      if (newSigs.length > 0) {
        console.log(`[poll] Found ${newSigs.length} new transaction(s)`);
        if (!this.connected) {
          this.connected = true;
          this.onStatusChange(true);
        }

        // Enrich sequentially with delay to avoid rate limits
        this.enrichQueue(newSigs);
      }
    } catch (err: any) {
      console.error(`[poll] Error: ${err.message}`);
    }
  }

  // Sequentially fetch transactions with delay between each
  private async enrichQueue(signatures: string[]): Promise<void> {
    for (const sig of signatures) {
      await this.sleep(ENRICH_DELAY);
      if (!this.alive) return;
      await this.fetchAndProcessTx(sig).catch(() => {});
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchAndProcessTx(signature: string): Promise<void> {
    try {
      const resp = await fetch(this.httpRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 11,
          method: 'getTransaction',
          params: [signature, { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        if (resp.status === 429) console.warn(`[enrich] 429 — skipping ${signature.slice(0,8)}`);
        return;
      }
      const json = await resp.json() as any;
      if (!json.result) return;

      const tx = json.result;
      const logs: string[] = tx.meta?.logMessages || [];

      const event = this.parseCreateLogs(logs, signature);

      // Re-broadcast enriched event with real name/symbol
      console.log(`[enrich] 🚀 ${event.name || '?'} / ${event.symbol || '?'} (${signature.slice(0,8)}...)`);
      this.onLaunch(event);

      if (event.metadataUri) {
        await this.sleep(1000); // small delay before metadata fetch
        this.fetchMetadata(event.metadataUri, event).catch(() => {});
      }
    } catch { /* best-effort */ }
  }

  // ── Handle signature from WebSocket ───────────────────────────────
  private handleSignatureFromWs(signature: string, logs?: string[]): void {
    if (this.seenSignatures.has(signature)) return;
    this.seenSignatures.add(signature);

    if (logs && Array.isArray(logs)) {
      const logsText = logs.join('\n');
      if (!logsText.includes('Instruction: Create')) return;

      const event = this.parseCreateLogs(logs, signature);
      this.stats.totalLaunches++;
      console.log(`[ws] 🚀 Token launch: ${event.name || 'unknown'} (${signature.slice(0,8)}...)`);

      this.onLaunch(event);

      if (event.metadataUri) {
        this.fetchMetadata(event.metadataUri, event).catch(() => {});
      }
    } else {
      // No logs in WS notification — fetch via HTTP
      this.fetchAndProcessTx(signature).catch(() => {});
    }
  }

  private parseCreateLogs(logs: string[], signature: string): TokenLaunchEvent {
    const event: TokenLaunchEvent = {
      type: 'token-launch',
      signature,
      time: new Date().toISOString(),
      name: null,
      symbol: null,
      metadataUri: null,
      mint: null,
      creator: null,
      isV2: false,
      hasGithub: false,
      githubUrls: [],
    };

    for (const line of logs) {
      if (line.includes('Instruction: CreateV2')) event.isV2 = true;

      // Try to extract metadata URI from Program data
      if (line.startsWith('Program data: ')) {
        try {
          const b64 = line.slice('Program data: '.length);
          const decoded = Buffer.from(b64, 'base64').toString('binary');
          const readable = decoded.replace(/[^\x20-\x7E]/g, ' ').trim();
          if (readable.includes('http')) {
            const urlMatch = readable.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) event.metadataUri = urlMatch[1];
          }
        } catch { /* ignore */ }
      }

      // Extract mint from program log
      if (line.includes('Program log: mint:')) {
        const m = line.match(/mint:\s*(\w{32,})/);
        if (m) event.mint = m[1];
      }
    }

    return event;
  }

  // ── Fetch metadata and re-broadcast enriched event ────────────────
  private async fetchMetadata(uri: string, event: TokenLaunchEvent): Promise<void> {
    let url = uri;
    if (url.startsWith('ipfs://')) {
      url = IPFS_GATEWAY + url.slice(7);
    }

    const resp = await fetch(url, { signal: AbortSignal.timeout(METADATA_TIMEOUT) });
    if (!resp.ok) return;

    const meta = await resp.json();

    // Extract name / symbol
    if (meta.name) event.name = meta.name;
    if (meta.symbol) event.symbol = meta.symbol;

    // Extract GitHub URLs
    const githubUrls = this.extractGithubUrls(meta);
    if (githubUrls.length > 0) {
      event.hasGithub = true;
      event.githubUrls = githubUrls;
      this.stats.githubLaunches++;
    }

    // Re-broadcast enriched event
    this.onLaunch(event);
  }

  private extractGithubUrls(meta: any): string[] {
    const urls = new Set<string>();
    const ghPattern = /https?:\/\/(www\.)?github\.com\/[^\s"'<>]+/gi;

    const scan = (val: any): void => {
      if (typeof val === 'string') {
        const matches = val.match(ghPattern);
        if (matches) matches.forEach(u => urls.add(u));
      } else if (val && typeof val === 'object') {
        Object.values(val).forEach(scan);
      }
    };
    scan(meta);
    return [...urls];
  }
}
