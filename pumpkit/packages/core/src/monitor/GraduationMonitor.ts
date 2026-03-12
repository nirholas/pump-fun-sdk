/**
 * @pumpkit/core — Graduation Monitor
 *
 * Detects token graduation events (bonding curve → AMM pool migration).
 * Listens for CompleteEvent discriminator in Pump program logs.
 */

import type { Connection } from '@solana/web3.js';
import { BaseMonitor } from './BaseMonitor.js';
import { PUMP_PROGRAM_ID } from '../solana/programs.js';
import type { GraduationEvent } from '../types/events.js';

export interface GraduationMonitorOptions {
  connection: Connection;
  onGraduation: (event: GraduationEvent) => void | Promise<void>;
}

export class GraduationMonitor extends BaseMonitor {
  private readonly connection: Connection;
  private readonly onGraduation: GraduationMonitorOptions['onGraduation'];
  private subscriptionId: number | null = null;
  private readonly seen = new Set<string>();
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;

  constructor(options: GraduationMonitorOptions) {
    super('GraduationMonitor');
    this.connection = options.connection;
    this.onGraduation = options.onGraduation;
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