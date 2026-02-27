// ════════════════════════════════════════════════════════════════════
// Solana Monitor — Uses PumpFun API for real-time token launches
//
// Strategy:
//   1. Poll PumpFun's coins API for latest launches (no RPC needed)
//   2. Keep WS subscription as bonus if it works
//   3. All data (name, ticker, image, socials) from PumpFun directly
// ════════════════════════════════════════════════════════════════════

import WebSocket from 'ws';
import type { TokenLaunchEvent } from './types.js';

const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMP_API = 'https://frontend-api-v3.pump.fun';
const POLL_INTERVAL = 5000;     // 5s between polls
const POLL_LIMIT = 50;          // coins per page

export class SolanaMonitor {
  private ws: WebSocket | null = null;
  private subId: number | null = null;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private alive = true;
  private seenMints = new Set<string>();

  public connected = false;
  public stats = { totalLaunches: 0, githubLaunches: 0, logsReceived: 0 };

  constructor(
    private rpcUrl: string,
    private onLaunch: (event: TokenLaunchEvent) => void,
    private onStatusChange: (connected: boolean) => void,
  ) {}

  start(): void {
    this.alive = true;
    this.startPumpPolling();
    this.connect(); // WS as bonus
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

  // ════════════════════════════════════════════════════════════════════
  // PumpFun API polling — primary data source
  // ════════════════════════════════════════════════════════════════════

  private startPumpPolling(): void {
    console.log(`[pump] Starting PumpFun API polling every ${POLL_INTERVAL / 1000}s`);
    setTimeout(() => this.pollPumpApi(), 500);
    this.pollTimer = setInterval(() => this.pollPumpApi(), POLL_INTERVAL);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollPumpApi(): Promise<void> {
    try {
      // PumpFun API: get latest coins sorted by creation time
      const url = `${PUMP_API}/coins/latest?limit=${POLL_LIMIT}&offset=0&includeNsfw=true`;
      const resp = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PumpFun-SDK/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        console.error(`[pump] API HTTP ${resp.status}`);
        // Try fallback endpoint
        await this.pollPumpApiFallback();
        return;
      }

      const data = await resp.json() as any;
      const coins = Array.isArray(data) ? data : data?.coins || data?.data || [];
      if (!Array.isArray(coins) || coins.length === 0) {
        console.log(`[pump] No coins in response, trying fallback`);
        await this.pollPumpApiFallback();
        return;
      }

      this.processPumpCoins(coins);
    } catch (err: any) {
      console.error(`[pump] Poll error: ${err.message}`);
      await this.pollPumpApiFallback().catch(() => {});
    }
  }

  private async pollPumpApiFallback(): Promise<void> {
    try {
      // Fallback: try the /coins?sort=created_timestamp&order=DESC endpoint
      const url = `${PUMP_API}/coins?offset=0&limit=${POLL_LIMIT}&sort=created_timestamp&order=DESC&includeNsfw=true`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'PumpFun-SDK/1.0' },
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        console.error(`[pump-fb] HTTP ${resp.status}`);
        return;
      }

      const data = await resp.json() as any;
      const coins = Array.isArray(data) ? data : data?.coins || data?.data || [];
      if (!Array.isArray(coins) || coins.length === 0) return;

      this.processPumpCoins(coins);
    } catch (err: any) {
      console.error(`[pump-fb] Error: ${err.message}`);
    }
  }

  private processPumpCoins(coins: any[]): void {
    let newCount = 0;

    for (const coin of coins) {
      const mint = coin.mint || coin.address || coin.token_address;
      if (!mint) continue;
      if (this.seenMints.has(mint)) continue;
      this.seenMints.add(mint);
      newCount++;

      // Extract GitHub URLs from description, website, twitter etc.
      const githubUrls = this.extractGithubUrls(coin);

      const event: TokenLaunchEvent = {
        type: 'token-launch',
        signature: coin.signature || coin.create_tx || mint,
        time: coin.created_timestamp
          ? new Date(coin.created_timestamp).toISOString()
          : new Date().toISOString(),
        name: coin.name || null,
        symbol: coin.symbol || coin.ticker || null,
        metadataUri: coin.metadata_uri || coin.uri || null,
        mint,
        creator: coin.creator || coin.deployer || null,
        isV2: true,
        hasGithub: githubUrls.length > 0,
        githubUrls,
        imageUri: coin.image_uri || coin.profile_image || coin.logo || null,
        description: coin.description ? coin.description.slice(0, 200) : null,
        marketCapSol: coin.market_cap_sol ?? null,
        website: coin.website || null,
        twitter: coin.twitter || null,
        telegram: coin.telegram || null,
      };

      this.stats.totalLaunches++;
      if (event.hasGithub) this.stats.githubLaunches++;

      this.onLaunch(event);
    }

    // Bound the set
    if (this.seenMints.size > 10000) {
      const arr = [...this.seenMints];
      this.seenMints = new Set(arr.slice(-5000));
    }

    if (newCount > 0) {
      console.log(`[pump] ${newCount} new token(s) found`);
      if (!this.connected) {
        this.connected = true;
        this.onStatusChange(true);
      }
    }
  }

  private extractGithubUrls(coin: any): string[] {
    const urls = new Set<string>();
    const ghPattern = /https?:\/\/(www\.)?github\.com\/[^\s"'<>)]+/gi;

    const scan = (val: any, depth = 0): void => {
      if (depth > 3) return;
      if (typeof val === 'string') {
        const matches = val.match(ghPattern);
        if (matches) matches.forEach(u => urls.add(u));
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const v of Object.values(val)) scan(v, depth + 1);
      } else if (Array.isArray(val)) {
        for (const v of val) scan(v, depth + 1);
      }
    };

    scan(coin.description);
    scan(coin.website);
    scan(coin.twitter);
    scan(coin.telegram);
    scan(coin.metadata_uri);

    return [...urls];
  }

  // ════════════════════════════════════════════════════════════════════
  // WebSocket subscription (bonus — may not deliver on free RPC)
  // ════════════════════════════════════════════════════════════════════

  private connect(): void {
    if (!this.alive) return;

    console.log(`[ws] Connecting to ${this.rpcUrl}...`);
    this.ws = new WebSocket(this.rpcUrl);

    this.ws.on('open', () => {
      console.log('[ws] Connected — subscribing to Pump program');
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
        console.log(`[ws] Subscribed (sub=${this.subId})`);
        return;
      }

      if (msg.method === 'logsNotify' && msg.params?.result) {
        this.stats.logsReceived++;
      }
    });

    this.ws.on('error', (err) => {
      console.error('[ws] Error:', err.message);
    });

    this.ws.on('close', (code) => {
      console.log(`[ws] Disconnected (code=${code})`);
      this.ws = null;
      this.subId = null;

      if (this.alive) {
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
}
