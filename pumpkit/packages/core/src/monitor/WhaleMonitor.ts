/**
 * @pumpkit/core — Whale Trade Monitor
 *
 * Detects large trades (buys/sells) that exceed a configurable SOL threshold.
 * Listens for TradeEvent in Pump program logs.
 */

import type { Connection } from '@solana/web3.js';
import { BaseMonitor } from './BaseMonitor.js';
import { PUMP_PROGRAM_ID } from '../solana/programs.js';
import type { WhaleTradeEvent } from '../types/events.js';

export interface WhaleMonitorOptions {
  connection: Connection;
  /** Minimum SOL amount to qualify as a whale trade (default: 10) */
  minSol?: number;
  onWhaleTrade: (event: WhaleTradeEvent) => void | Promise<void>;
}

export class WhaleMonitor extends BaseMonitor {
  private readonly connection: Connection;
  private readonly onWhaleTrade: WhaleMonitorOptions['onWhaleTrade'];
  private readonly minSol: number;
  private subscriptionId: number | null = null;
  private readonly seen = new Set<string>();
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;

  constructor(options: WhaleMonitorOptions) {
    super('WhaleMonitor');
    this.connection = options.connection;
    this.onWhaleTrade = options.onWhaleTrade;
    this.minSol = options.minSol ?? 10;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.log.info('Starting (minSol=%d)...', this.minSol);
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