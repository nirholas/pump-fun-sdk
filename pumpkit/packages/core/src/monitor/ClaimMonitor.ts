/**
 * @pumpkit/core — Claim Monitor
 *
 * Detects fee claim events across all three Pump programs via WebSocket.
 * Falls back to HTTP polling if WebSocket drops.
 * Extracted from channel-bot's claim-monitor and telegram-bot's monitor.
 *
 * Monitored claim types:
 *   - DistributeCreatorFees (PumpFees)
 *   - CollectCreatorFee (Pump)
 *   - ClaimCashback (Pump)
 *   - CollectCoinCreatorFee (PumpAMM)
 */

import {
  LAMPORTS_PER_SOL,
  PublicKey,
  type Connection,
  type Logs,
  type SignaturesForAddressOptions,
} from '@solana/web3.js';
import { BaseMonitor } from './BaseMonitor.js';
import {
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  DISTRIBUTE_FEES_EVENT_DISCRIMINATOR,
  COLLECT_CREATOR_FEE_DISCRIMINATOR,
  CLAIM_CASHBACK_DISCRIMINATOR,
  COLLECT_COIN_CREATOR_FEE_DISCRIMINATOR,
} from '../solana/programs.js';
import type { ClaimEvent } from '../types/events.js';

// ── Constants ────────────────────────────────────────────────────────

const MAX_SEEN_CACHE = 10_000;
const TRIM_AMOUNT = 5_000;
const WS_HEARTBEAT_INTERVAL_MS = 60_000;
const WS_HEARTBEAT_TIMEOUT_MS = 90_000;

/** Discriminators that indicate a claim-related event in "Program data:" lines */
const CLAIM_EVENT_DISCRIMINATORS = new Set([
  DISTRIBUTE_FEES_EVENT_DISCRIMINATOR,  // a537817004b3ca28
  COLLECT_CREATOR_FEE_DISCRIMINATOR,    // 7a027f010ebf0caf
  CLAIM_CASHBACK_DISCRIMINATOR,         // e2d6f62107f293e5
  COLLECT_COIN_CREATOR_FEE_DISCRIMINATOR, // e8f5c2eeeada3a59
]);

/** All three Pump protocol programs to monitor */
const MONITORED_PROGRAMS = [
  new PublicKey(PUMP_FEE_PROGRAM_ID),
  new PublicKey(PUMP_PROGRAM_ID),
  new PublicKey(PUMP_AMM_PROGRAM_ID),
];

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
  private wsSubscriptionIds: number[] = [];
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly seen = new Set<string>();
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;
  private lastWsEventTime = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private consecutive429s = 0;
  private readonly lastSignatures = new Map<string, string | undefined>();

  constructor(options: ClaimMonitorOptions) {
    super('ClaimMonitor');
    this.connection = options.connection;
    this.onClaim = options.onClaim;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.log.info('Starting — monitoring %d programs', MONITORED_PROGRAMS.length);
    try {
      this.subscribeWebSocket();
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

  private subscribeWebSocket(): void {
    this.lastWsEventTime = Date.now();

    for (const pubkey of MONITORED_PROGRAMS) {
      try {
        const subId = this.connection.onLogs(
          pubkey,
          (logInfo: Logs) => {
            this.lastWsEventTime = Date.now();
            this.handleLogEvent(logInfo);
          },
          'confirmed',
        );
        this.wsSubscriptionIds.push(subId);
      } catch (err) {
        this.log.warn('WS subscription failed for %s: %s',
          pubkey.toBase58().slice(0, 8), err);
      }
    }

    if (this.wsSubscriptionIds.length === 0) {
      this.log.warn('All WS subscriptions failed, falling back to polling');
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
    this.log.info('WebSocket subscriptions active (%d)', this.wsSubscriptionIds.length);
  }

  private cleanupWebSocket(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const id of this.wsSubscriptionIds) {
      this.connection.removeOnLogsListener(id).catch(() => {});
    }
    this.wsSubscriptionIds = [];
  }

  private reconnectWebSocket(): void {
    if (!this._running) return;
    this.cleanupWebSocket();
    try {
      this.subscribeWebSocket();
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

    // Scan log lines for claim event discriminators
    let hasClaimEvent = false;
    let amountLamports = 0;
    let mint = '';

    for (const line of logs) {
      if (!line.includes('Program data:')) continue;
      const b64 = line.split('Program data: ')[1]?.trim();
      if (!b64) continue;

      try {
        const bytes = Buffer.from(b64, 'base64');
        if (bytes.length < 8) continue;
        const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');

        if (!CLAIM_EVENT_DISCRIMINATORS.has(disc)) continue;
        hasClaimEvent = true;

        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        if (disc === DISTRIBUTE_FEES_EVENT_DISCRIMINATOR) {
          // Layout: disc(8) + timestamp(8) + mint(32) + ...rest... + distributed(8)
          if (bytes.length >= 48) {
            mint = new PublicKey(bytes.subarray(16, 48)).toBase58();
          }
          if (bytes.length >= 16) {
            amountLamports = Number(view.getBigUint64(bytes.length - 8, true));
          }
        } else if (disc === COLLECT_CREATOR_FEE_DISCRIMINATOR) {
          // Layout: disc(8) + timestamp(8) + creator(32) + creatorFee(8)
          if (bytes.length >= 56) {
            amountLamports = Number(view.getBigUint64(48, true));
          }
        } else if (disc === CLAIM_CASHBACK_DISCRIMINATOR) {
          // Layout: disc(8) + user(32) + amount(8) + timestamp(8) + ...
          if (bytes.length >= 48) {
            amountLamports = Number(view.getBigUint64(40, true));
          }
        } else if (disc === COLLECT_COIN_CREATOR_FEE_DISCRIMINATOR) {
          // Layout: disc(8) + timestamp(8) + coinCreator(32) + coinCreatorFee(8) + ...
          if (bytes.length >= 56) {
            amountLamports = Number(view.getBigUint64(48, true));
          }
        }
      } catch {
        // Skip unparseable log entries
      }
    }

    if (!hasClaimEvent) return;

    const event: ClaimEvent = {
      signature,
      wallet: '', // Requires full TX parse to extract signer
      mint,
      amount: amountLamports / LAMPORTS_PER_SOL,
      timestamp: Date.now(),
    };

    this.recordEvent();
    this.reconnectDelay = 1000;
    Promise.resolve(this.onClaim(event)).catch((err) =>
      this.log.error('onClaim callback error: %s', err),
    );
  }

  // ── Polling ────────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimer) return;
    const poll = async () => {
      if (!this._running) return;
      try {
        await this.pollAllPrograms();
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

  private async pollAllPrograms(): Promise<void> {
    for (const pubkey of MONITORED_PROGRAMS) {
      const programId = pubkey.toBase58();
      const opts: SignaturesForAddressOptions = { limit: 20 };
      const lastSig = this.lastSignatures.get(programId);
      if (lastSig) opts.until = lastSig;

      const sigs = await this.connection.getSignaturesForAddress(pubkey, opts);
      if (sigs.length === 0) continue;

      this.lastSignatures.set(programId, sigs[0]!.signature);

      for (const info of sigs) {
        if (info.err) continue;
        if (this.seen.has(info.signature)) continue;
        this.seen.add(info.signature);

        // In polling mode, emit a basic event (no log data available without TX fetch)
        const event: ClaimEvent = {
          signature: info.signature,
          wallet: '',
          mint: '',
          amount: 0,
          timestamp: (info.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
        };
        this.recordEvent();
        Promise.resolve(this.onClaim(event)).catch((err) =>
          this.log.error('onClaim callback error: %s', err),
        );
      }
    }
    this.trimSeen();
  }

  // ── Utilities ──────────────────────────────────────────────────────

  private trimSeen(): void {
    if (this.seen.size > MAX_SEEN_CACHE) {
      const entries = [...this.seen];
      for (let i = 0; i < TRIM_AMOUNT; i++) {
        this.seen.delete(entries[i]!);
      }
    }
  }
}
