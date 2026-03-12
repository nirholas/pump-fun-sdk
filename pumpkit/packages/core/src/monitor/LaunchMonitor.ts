/**
 * @pumpkit/core — Launch Monitor
 *
 * Detects new token creation events on the Pump program via WebSocket.
 * Extracted from telegram-bot's token-launch-monitor.
 */

import type { Connection } from '@solana/web3.js';
import { BaseMonitor } from './BaseMonitor.js';
import { PUMP_PROGRAM_ID } from '../solana/programs.js';
import type { LaunchEvent } from '../types/events.js';

export interface LaunchMonitorOptions {
  connection: Connection;
  onLaunch: (event: LaunchEvent) => void | Promise<void>;
}

export class LaunchMonitor extends BaseMonitor {
  private readonly connection: Connection;
  private readonly onLaunch: LaunchMonitorOptions['onLaunch'];
  private subscriptionId: number | null = null;
  private readonly seen = new Set<string>();
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;

  constructor(options: LaunchMonitorOptions) {
    super('LaunchMonitor');
    this.connection = options.connection;
    this.onLaunch = options.onLaunch;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.log.info('Starting...');
    this.subscribe();
  }

  stop(): void {
    this._running = false;
    if (this.subscriptionId !== null) {
      this.connection.removeOnLogsListener(this.subscriptionId).catch(() => {});
      this.subscriptionId = null;
    }
    this.log.info('Stopped');
  }

  private subscribe(): void {
    try {
      this.subscriptionId = this.connection.onLogs(
        { mentions: [PUMP_PROGRAM_ID] } as Parameters<Connection['onLogs']>[0],
        (logInfo) => {
          if (logInfo.err) return;
          const sig = logInfo.signature;
          if (this.seen.has(sig)) return;
          this.seen.add(sig);
          if (this.seen.size > 10_000) {
            const entries = [...this.seen];
            for (let i = 0; i < 5_000; i++) this.seen.delete(entries[i]!);
          }

          // Check if logs contain create instruction indicators
          const isCreate = logInfo.logs.some(
            (l) => l.includes('Instruction: Create') || l.includes('Instruction: CreateV2'),
          );
          if (!isCreate) return;

          const event: LaunchEvent = {
            signature: sig,
            mint: '',
            creator: '',
            name: '',
            symbol: '',
            uri: '',
            isMayhemMode: false,
            hasCashback: false,
            timestamp: Date.now(),
          };
          this.recordEvent();
          this.reconnectDelay = 1000;
          Promise.resolve(this.onLaunch(event)).catch((err) =>
            this.log.error('onLaunch callback error: %s', err),
          );
        },
        'confirmed',
      );
      this.log.info('WebSocket subscription active');
    } catch (err) {
      this.log.warn('WebSocket failed, will retry: %s', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this._running) return;
    this.log.info('Reconnecting in %dms…', this.reconnectDelay);
    setTimeout(() => {
      if (this._running) this.subscribe();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }
}
