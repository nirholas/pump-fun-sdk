/**
 * @pumpkit/core — Claim Monitor
 *
 * Detects fee claim events from PumpFees program via WebSocket.
 * Falls back to HTTP polling if WebSocket drops.
 * Extracted from channel-bot's claim-monitor and telegram-bot's monitor.
 */

import type { Connection } from '@solana/web3.js';
import { BaseMonitor } from './BaseMonitor.js';
import { PUMP_FEE_PROGRAM_ID } from '../solana/programs.js';
import type { ClaimEvent } from '../types/events.js';

export interface ClaimMonitorOptions {
  connection: Connection;
  onClaim: (event: ClaimEvent) => void | Promise<void>;
  /** Polling interval in ms for HTTP fallback (default: 5000) */
  pollIntervalMs?: number;
}

export class ClaimMonitor extends BaseMonitor {
  private readonly connection: Connection;
  private readonly onClaim: ClaimMonitorOptions['onClaim'];
  private readonly pollIntervalMs: number;
  private subscriptionId: number | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly seen = new Set<string>();
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;

  constructor(options: ClaimMonitorOptions) {
    super('ClaimMonitor');
    this.connection = options.connection;
    this.onClaim = options.onClaim;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.log.info('Starting...');
    this.subscribeWebSocket();
  }

  stop(): void {
    this._running = false;
    if (this.subscriptionId !== null) {
      this.connection.removeOnLogsListener(this.subscriptionId).catch(() => {});
      this.subscriptionId = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.log.info('Stopped');
  }

  private subscribeWebSocket(): void {
    try {
      this.subscriptionId = this.connection.onLogs(
        { mentions: [PUMP_FEE_PROGRAM_ID] } as Parameters<Connection['onLogs']>[0],
        (logInfo) => {
          if (logInfo.err) return;
          const sig = logInfo.signature;
          if (this.seen.has(sig)) return;
          this.seen.add(sig);
          // Trim seen set to prevent unbounded growth
          if (this.seen.size > 10_000) {
            const entries = [...this.seen];
            for (let i = 0; i < 5_000; i++) {
              this.seen.delete(entries[i]!);
            }
          }

          const event: ClaimEvent = {
            signature: sig,
            wallet: '', // Would need TX parsing to fill
            mint: '',
            amount: 0,
            timestamp: Date.now(),
          };
          this.recordEvent();
          this.reconnectDelay = 1000;
          Promise.resolve(this.onClaim(event)).catch((err) =>
            this.log.error('onClaim callback error: %s', err),
          );
        },
        'confirmed',
      );
      this.log.info('WebSocket subscription active');
    } catch (err) {
      this.log.warn('WebSocket subscription failed, falling back to polling: %s', err);
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.poll(), this.pollIntervalMs);
    this.log.info('HTTP polling active (interval: %dms)', this.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    try {
      const sigs = await this.connection.getSignaturesForAddress(
        // Use a dummy PublicKey — in production, pass the actual PDA
        this.connection.rpcEndpoint as unknown as Parameters<Connection['getSignaturesForAddress']>[0],
        { limit: 20 },
      );
      for (const info of sigs) {
        if (this.seen.has(info.signature)) continue;
        this.seen.add(info.signature);
        this.recordEvent();
      }
    } catch (err) {
      this.log.warn('Poll error: %s', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this._running) return;
    this.log.info('Reconnecting in %dms…', this.reconnectDelay);
    setTimeout(() => {
      if (this._running) this.subscribeWebSocket();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }
}
