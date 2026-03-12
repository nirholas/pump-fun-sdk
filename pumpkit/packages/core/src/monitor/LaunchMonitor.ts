/**
 * @pumpkit/core — Launch Monitor
 *
 * Detects new token creation events on the Pump program via WebSocket.
 * Falls back to HTTP polling when WebSocket drops.
 * Decodes create instruction data to extract name, symbol, uri, and flags.
 * Extracted from telegram-bot's token-launch-monitor.
 */

import {
  PublicKey,
  type Connection,
  type Logs,
  type SignaturesForAddressOptions,
} from '@solana/web3.js';
import { BaseMonitor } from './BaseMonitor.js';
import {
  PUMP_PROGRAM_ID,
  CREATE_V2_DISCRIMINATOR,
  CREATE_DISCRIMINATOR,
  SYSTEM_PROGRAMS,
} from '../solana/programs.js';
import type { LaunchEvent } from '../types/events.js';
import { decodePumpLogs } from '../solana/decoders.js';

// ── Constants ────────────────────────────────────────────────────────

const MAX_SEEN_CACHE = 10_000;
const TRIM_AMOUNT = 5_000;
const WS_HEARTBEAT_INTERVAL_MS = 60_000;
const WS_HEARTBEAT_TIMEOUT_MS = 90_000;

export interface LaunchMonitorOptions {
  connection: Connection;
  onLaunch: (event: LaunchEvent) => void | Promise<void>;
  /** Polling interval in ms for HTTP fallback (default: 5000) */
  pollIntervalMs?: number;
}

export class LaunchMonitor extends BaseMonitor {
  private readonly connection: Connection;
  private readonly onLaunch: LaunchMonitorOptions['onLaunch'];
  private readonly pollIntervalMs: number;
  private readonly programPubkey = new PublicKey(PUMP_PROGRAM_ID);
  private subscriptionId: number | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly seen = new Set<string>();
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;
  private lastWsEventTime = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private consecutive429s = 0;
  private lastSignature: string | undefined;

  constructor(options: LaunchMonitorOptions) {
    super('LaunchMonitor');
    this.connection = options.connection;
    this.onLaunch = options.onLaunch;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.log.info('Starting...');
    try {
      this.subscribe();
    } catch {
      this.log.warn('WebSocket failed on start, falling back to polling');
      this.startPolling();
    }
  }

  stop(): void {
    this._running = false;
    this.cleanupWebSocket();
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.log.info('Stopped (%d events processed)', this._eventsProcessed);
  }

  // ── WebSocket ──────────────────────────────────────────────────────

  private subscribe(): void {
    this.lastWsEventTime = Date.now();

    try {
      this.subscriptionId = this.connection.onLogs(
        this.programPubkey,
        (logInfo: Logs) => {
          this.lastWsEventTime = Date.now();
          this.handleLogEvent(logInfo);
        },
        'confirmed',
      );
    } catch (err) {
      this.log.warn('WebSocket subscription failed: %s', err);
      this.startPolling();
      return;
    }

    // Heartbeat: detect silent WebSocket and reconnect
    this.heartbeatTimer = setInterval(() => {
      if (!this._running) return;
      const elapsed = Date.now() - this.lastWsEventTime;
      if (elapsed > WS_HEARTBEAT_TIMEOUT_MS) {
        this.log.warn('WS silent for %ds — reconnecting', Math.floor(elapsed / 1000));
        this.reconnectWebSocket();
      }
    }, WS_HEARTBEAT_INTERVAL_MS);

    this.reconnectDelay = 1000;
    this.log.info('WebSocket subscription active');
  }

  private cleanupWebSocket(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.subscriptionId !== null) {
      this.connection.removeOnLogsListener(this.subscriptionId).catch(() => {});
      this.subscriptionId = null;
    }
  }

  private reconnectWebSocket(): void {
    if (!this._running) return;
    this.cleanupWebSocket();
    try {
      this.subscribe();
    } catch {
      this.log.warn('WS reconnect failed, falling back to polling');
      this.startPolling();
    }
  }

  private handleLogEvent(logInfo: Logs): void {
    const { signature, logs, err } = logInfo;
    if (err) return;
    if (this.seen.has(signature)) return;
    this.seen.add(signature);
    this.trimSeen();

    // Quick check: do the logs indicate a token creation?
    if (!this.isCreateInstruction(logs)) return;

    // Try to decode launch event from "Program data:" log lines
    const decoded = decodePumpLogs(logs, signature);
    const launch = decoded.find((d) => d.type === 'launch');

    if (launch) {
      this.emitLaunch(launch.event as LaunchEvent);
      return;
    }

    // Fallback: emit minimal event if logs indicate create but data wasn't decoded
    this.emitLaunch({
      signature,
      mint: '',
      creator: '',
      name: '',
      symbol: '',
      uri: '',
      isMayhemMode: false,
      hasCashback: false,
      timestamp: Date.now(),
    });
  }

  // ── Polling ────────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimer) return;
    const poll = async () => {
      if (!this._running) return;
      try {
        await this.pollForCreates();
        this.consecutive429s = 0;
      } catch (err) {
        const msg = String(err);
        if (msg.includes('429')) {
          this.consecutive429s++;
        } else {
          this.log.error('Poll error: %s', msg);
        }
      }
      if (this._running) {
        const backoff = Math.min(2 ** this.consecutive429s, 8);
        this.pollTimer = setTimeout(poll, this.pollIntervalMs * backoff);
      }
    };
    poll();
    this.log.info('HTTP polling active (interval: %dms)', this.pollIntervalMs);
  }

  private async pollForCreates(): Promise<void> {
    const opts: SignaturesForAddressOptions = { limit: 50 };
    if (this.lastSignature) opts.until = this.lastSignature;

    const sigs = await this.connection.getSignaturesForAddress(
      this.programPubkey,
      opts,
      'confirmed',
    );
    if (sigs.length === 0) return;

    // Process from oldest to newest
    const ordered = sigs.reverse();
    this.lastSignature = sigs[0]!.signature;

    for (const info of ordered) {
      if (info.err) continue;
      if (this.seen.has(info.signature)) continue;
      this.seen.add(info.signature);

      // In polling mode, fetch the transaction to get log data
      try {
        const tx = await this.connection.getParsedTransaction(info.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta?.logMessages) continue;

        if (!this.isCreateInstruction(tx.meta.logMessages)) continue;

        // Decode from log lines
        const decoded = decodePumpLogs(tx.meta.logMessages, info.signature);
        const launch = decoded.find((d) => d.type === 'launch');

        if (launch) {
          const event = launch.event as LaunchEvent;
          event.timestamp = tx.blockTime ?? Math.floor(Date.now() / 1000);
          this.emitLaunch(event);
        } else {
          // Fallback: extract mint from account keys
          const accountKeys = tx.transaction.message.accountKeys.map((k) =>
            typeof k === 'string' ? k : k.pubkey.toBase58(),
          );
          const mint = this.findMintAddress(accountKeys);

          this.emitLaunch({
            signature: info.signature,
            mint,
            creator: accountKeys[0] ?? '',
            name: '',
            symbol: '',
            uri: '',
            isMayhemMode: false,
            hasCashback: false,
            timestamp: tx.blockTime ?? Math.floor(Date.now() / 1000),
          });
        }
      } catch (err) {
        this.log.debug('TX fetch failed for %s: %s', info.signature.slice(0, 8), err);
      }
    }
    this.trimSeen();
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private emitLaunch(event: LaunchEvent): void {
    this.recordEvent();
    this.reconnectDelay = 1000;
    Promise.resolve(this.onLaunch(event)).catch((err) =>
      this.log.error('onLaunch callback error: %s', err),
    );
  }

  /**
   * Check if logs indicate a create instruction.
   * Matches "Instruction: Create" and "Instruction: CreateV2" but
   * rejects false positives like "CreatePool" or "CreateIdempotent".
   */
  private isCreateInstruction(logs: string[]): boolean {
    for (const line of logs) {
      if (
        line.includes('Instruction: CreateV2') ||
        (line.includes('Instruction: Create') &&
          !line.includes('CreatePool') &&
          !line.includes('CreateIdempotent'))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find the mint address from transaction account keys.
   * Excludes well-known system programs and the Pump program itself.
   */
  private findMintAddress(accountKeys: string[]): string {
    // Mint is typically at index 1 for createV2
    for (let i = 1; i < Math.min(accountKeys.length, 5); i++) {
      const key = accountKeys[i];
      if (key && !SYSTEM_PROGRAMS.has(key) && key.length >= 32) {
        return key;
      }
    }
    for (let i = 5; i < accountKeys.length; i++) {
      const key = accountKeys[i];
      if (key && !SYSTEM_PROGRAMS.has(key) && key.length >= 32) {
        return key;
      }
    }
    return '';
  }

  private trimSeen(): void {
    if (this.seen.size > MAX_SEEN_CACHE) {
      const entries = [...this.seen];
      for (let i = 0; i < TRIM_AMOUNT; i++) {
        this.seen.delete(entries[i]!);
      }
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
