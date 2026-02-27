// ════════════════════════════════════════════════════════════════════
// Solana Monitor — upstream WebSocket client to Solana RPC
// Connects, subscribes to Pump program logs, parses token launches
// ════════════════════════════════════════════════════════════════════

import WebSocket from 'ws';
import type { TokenLaunchEvent } from './types.js';

const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://cf-ipfs.com/ipfs/';
const METADATA_TIMEOUT = 5000;

export class SolanaMonitor {
  private ws: WebSocket | null = null;
  private subId: number | null = null;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private alive = true;

  public connected = false;
  public stats = { totalLaunches: 0, githubLaunches: 0, logsReceived: 0 };

  constructor(
    private rpcUrl: string,
    private onLaunch: (event: TokenLaunchEvent) => void,
    private onStatusChange: (connected: boolean) => void,
  ) {}

  start(): void {
    this.alive = true;
    this.connect();
  }

  stop(): void {
    this.alive = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.disconnect();
  }

  // ── Connect to Solana RPC WebSocket ───────────────────────────────
  private connect(): void {
    if (!this.alive) return;

    console.log(`[solana] Connecting to ${this.rpcUrl}...`);

    this.ws = new WebSocket(this.rpcUrl);

    this.ws.on('open', () => {
      console.log('[solana] Connected — subscribing to Pump program logs');
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

      // Subscription confirmation
      if (msg.id === 1 && msg.result !== undefined) {
        this.subId = msg.result;
        console.log(`[solana] Subscribed (sub=${this.subId})`);
        return;
      }

      // Log notification
      if (msg.method === 'logsNotify' && msg.params?.result) {
        this.stats.logsReceived++;
        this.handleLog(msg.params.result);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[solana] WebSocket error:', err.message);
    });

    this.ws.on('close', (code) => {
      console.log(`[solana] Disconnected (code=${code})`);
      this.connected = false;
      this.ws = null;
      this.subId = null;
      this.onStatusChange(false);

      if (this.alive) {
        console.log(`[solana] Reconnecting in ${this.reconnectDelay / 1000}s...`);
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

  // ── Parse log notifications ───────────────────────────────────────
  private handleLog(result: any): void {
    const { value } = result;
    if (!value || value.err) return;

    const { signature, logs } = value;
    if (!logs || !Array.isArray(logs)) return;

    const logsText = logs.join('\n');
    if (!logsText.includes('Instruction: Create')) return;

    // Parse the create instruction
    const event = this.parseCreateLogs(logs, signature);
    this.stats.totalLaunches++;

    // Fire event immediately with what we have
    this.onLaunch(event);

    // Async: try to fetch metadata and send an enriched update
    if (event.metadataUri) {
      this.fetchMetadata(event.metadataUri, event).catch(() => {});
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
