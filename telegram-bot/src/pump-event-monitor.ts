/**
 * PumpFun Telegram Bot — Pump Event Monitor
 *
 * Listens to the Pump program for on-chain events:
 *   - Graduation (CompleteEvent, CompletePumpAmmMigrationEvent)
 *   - Whale trades (TradeEvent above a SOL threshold)
 *   - Creator fee distributions (DistributeCreatorFeesEvent)
 *
 * Events are decoded directly from "Program data:" log lines emitted
 * by Anchor's CPI self-invoke pattern, which avoids extra RPC calls.
 *
 * Two modes:
 *   1. WebSocket (onLogs) — real-time, requires a WS-capable RPC
 *   2. HTTP polling (getSignaturesForAddress) — fallback every N seconds
 */

import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    type Logs,
    type SignaturesForAddressOptions,
} from '@solana/web3.js';

import { log } from './logger.js';
import type {
    BotConfig,
    FeeDistributionEvent,
    GraduationEvent,
    PumpEventMonitorState,
    TradeAlertEvent,
} from './types.js';
import {
    COMPLETE_EVENT_DISCRIMINATOR,
    COMPLETE_AMM_MIGRATION_DISCRIMINATOR,
    DEFAULT_GRADUATION_SOL_THRESHOLD,
    PUMP_PROGRAM_ID,
    TRADE_EVENT_DISCRIMINATOR,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** DistributeCreatorFeesEvent discriminator (also in CLAIM_EVENT_DISCRIMINATORS) */
const DISTRIBUTE_FEES_EVENT_DISCRIMINATOR = 'a537817004b3ca28';

/** Maximum consecutive WebSocket errors before falling back to polling */
const MAX_WS_ERRORS = 5;

/** Default token total supply (1 billion tokens with 6 decimals) */
const DEFAULT_TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000;

// ============================================================================
// Pump Event Monitor Class
// ============================================================================

export class PumpEventMonitor {
    private connection: Connection;
    private wsConnection?: Connection;
    private config: BotConfig;
    private state: PumpEventMonitorState;
    private programPubkey: PublicKey;

    // Callbacks
    private onGraduation: (event: GraduationEvent) => void;
    private onTradeAlert: (event: TradeAlertEvent) => void;
    private onFeeDistribution: (event: FeeDistributionEvent) => void;

    // Connection state
    private pollTimer?: ReturnType<typeof setInterval>;
    private wsSubscriptionId?: number;
    private lastSignature: string | undefined;
    private processedSignatures = new Set<string>();
    private readonly MAX_PROCESSED_CACHE = 10_000;
    private wsErrorCount = 0;
    private stopped = false;

    constructor(
        config: BotConfig,
        onGraduation: (event: GraduationEvent) => void,
        onTradeAlert: (event: TradeAlertEvent) => void,
        onFeeDistribution: (event: FeeDistributionEvent) => void,
    ) {
        this.config = config;
        this.onGraduation = onGraduation;
        this.onTradeAlert = onTradeAlert;
        this.onFeeDistribution = onFeeDistribution;
        this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
        this.programPubkey = new PublicKey(PUMP_PROGRAM_ID);

        this.state = {
            errorsEncountered: 0,
            feeDistributionsDetected: 0,
            graduationsDetected: 0,
            isRunning: false,
            lastSlot: 0,
            mode: 'polling',
            startedAt: 0,
            tradesDetected: 0,
            whaleTradesDetected: 0,
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────

    getState(): PumpEventMonitorState {
        return { ...this.state };
    }

    async start(): Promise<void> {
        if (this.state.isRunning) {
            log.warn('Pump event monitor already running');
            return;
        }

        this.state.isRunning = true;
        this.state.startedAt = Date.now();

        const features: string[] = [];
        if (this.config.enableGraduationAlerts) features.push('graduation');
        if (this.config.enableTradeAlerts)
            features.push(`trades(≥${this.config.whaleThresholdSol}SOL)`);
        if (this.config.enableFeeDistributionAlerts) features.push('fee-distribution');

        log.info(
            'Pump event monitor starting [%s]',
            features.join(', ') || 'none enabled',
        );

        // Try WebSocket first
        if (this.config.solanaWsUrl) {
            try {
                await this.startWebSocket();
                this.state.mode = 'websocket';
                log.info('Pump event monitor started in WebSocket mode');
                return;
            } catch (err) {
                log.warn('WebSocket failed for event monitor, falling back to polling:', err);
            }
        }

        // Fallback to HTTP polling
        this.startPolling();
        this.state.mode = 'polling';
        log.info(
            'Pump event monitor started in polling mode (every %ds)',
            this.config.pollIntervalSeconds,
        );
    }

    stop(): void {
        this.stopped = true;
        this.state.isRunning = false;

        if (this.wsConnection && this.wsSubscriptionId !== undefined) {
            this.wsConnection
                .removeOnLogsListener(this.wsSubscriptionId)
                .catch(() => {});
            this.wsSubscriptionId = undefined;
        }

        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }

        log.info(
            'Pump event monitor stopped (grad=%d, trades=%d, feeDist=%d)',
            this.state.graduationsDetected,
            this.state.tradesDetected,
            this.state.feeDistributionsDetected,
        );
    }

    // ──────────────────────────────────────────────────────────────────────
    // WebSocket Mode
    // ──────────────────────────────────────────────────────────────────────

    private async startWebSocket(): Promise<void> {
        this.wsConnection = new Connection(
            this.config.solanaRpcUrl,
            {
                commitment: 'confirmed',
                wsEndpoint: this.config.solanaWsUrl,
            },
        );

        this.wsErrorCount = 0;

        this.wsSubscriptionId = this.wsConnection.onLogs(
            this.programPubkey,
            async (logInfo: Logs) => {
                try {
                    await this.handleLogEvent(logInfo);
                    this.wsErrorCount = 0;
                } catch (err) {
                    log.error('Error handling pump event log:', err);
                    this.wsErrorCount++;
                    this.state.errorsEncountered++;
                    if (this.wsErrorCount >= MAX_WS_ERRORS) {
                        log.warn('Too many WS errors in event monitor, switching to polling');
                        await this.fallbackToPolling();
                    }
                }
            },
            'confirmed',
        );

        log.debug(
            'Event monitor WS subscription for %s: id=%d',
            this.programPubkey.toBase58().slice(0, 8),
            this.wsSubscriptionId,
        );
    }

    private async fallbackToPolling(): Promise<void> {
        if (this.stopped || !this.state.isRunning) return;

        if (this.wsConnection && this.wsSubscriptionId !== undefined) {
            this.wsConnection
                .removeOnLogsListener(this.wsSubscriptionId)
                .catch(() => {});
            this.wsSubscriptionId = undefined;
        }

        this.state.mode = 'polling';
        this.startPolling();
        log.info('Pump event monitor switched to polling mode');
    }

    private async handleLogEvent(logInfo: Logs): Promise<void> {
        const { signature, logs, err } = logInfo;

        if (err) return;
        if (this.processedSignatures.has(signature)) return;

        // Scan "Program data:" lines for event discriminators
        const events = this.extractEventsFromLogs(logs, signature, 0, 0);

        if (events.length > 0) {
            this.markProcessed(signature);

            // For graduation events, we need the full tx to get the slot/blockTime
            // For trade events, we already have all data from logs
            // Let's fetch the tx for accurate slot/time if we have events
            try {
                const tx = await this.connection.getParsedTransaction(signature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0,
                });

                const slot = tx?.slot ?? 0;
                const blockTime = tx?.blockTime ?? Math.floor(Date.now() / 1000);

                for (const event of events) {
                    event.slot = slot;
                    event.timestamp = blockTime;
                    this.state.lastSlot = slot;
                    this.dispatchEvent(event);
                }
            } catch (fetchErr) {
                // Fall back to dispatching with approximate time
                for (const event of events) {
                    event.timestamp = Math.floor(Date.now() / 1000);
                    this.dispatchEvent(event);
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Polling Mode
    // ──────────────────────────────────────────────────────────────────────

    private startPolling(): void {
        this.poll().catch((err) => log.error('Event monitor initial poll failed:', err));

        this.pollTimer = setInterval(() => {
            this.poll().catch((err) => log.error('Event monitor poll error:', err));
        }, this.config.pollIntervalSeconds * 1000);
    }

    private async poll(): Promise<void> {
        log.debug('Polling for pump events...');

        const opts: SignaturesForAddressOptions = {
            limit: 50,
        };

        if (this.lastSignature) {
            opts.until = this.lastSignature;
        }

        try {
            const signatures = await this.connection.getSignaturesForAddress(
                this.programPubkey,
                opts,
                'confirmed',
            );

            if (signatures.length === 0) return;

            const ordered = signatures.reverse();
            this.lastSignature = signatures[0].signature;

            for (const sig of ordered) {
                if (sig.err) continue;
                if (this.processedSignatures.has(sig.signature)) continue;
                await this.processTransaction(sig.signature);
            }
        } catch (err) {
            log.error('Error fetching signatures for event monitor:', err);
            this.state.errorsEncountered++;
        }
    }

    private async processTransaction(signature: string): Promise<void> {
        this.markProcessed(signature);

        try {
            const tx = await this.connection.getParsedTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });

            if (!tx || !tx.meta || !tx.meta.logMessages) return;

            const events = this.extractEventsFromLogs(
                tx.meta.logMessages,
                signature,
                tx.slot,
                tx.blockTime ?? Math.floor(Date.now() / 1000),
            );

            for (const event of events) {
                this.state.lastSlot = tx.slot;
                this.dispatchEvent(event);
            }
        } catch (err) {
            log.error('Error processing event tx %s:', signature, err);
            this.state.errorsEncountered++;
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Event Extraction from Program Data Logs
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Scan transaction log lines for "Program data:" entries and decode
     * Anchor events by matching their 8-byte discriminators.
     *
     * Returns an array of typed events found in the logs.
     */
    private extractEventsFromLogs(
        logs: string[],
        signature: string,
        slot: number,
        blockTime: number,
    ): Array<GraduationEvent | TradeAlertEvent | FeeDistributionEvent> {
        const events: Array<GraduationEvent | TradeAlertEvent | FeeDistributionEvent> = [];

        for (const line of logs) {
            if (!line.startsWith('Program data: ')) continue;

            const dataB64 = line.slice('Program data: '.length);

            try {
                const bytes = Buffer.from(dataB64, 'base64');
                if (bytes.length < 8) continue;

                const hex = bytes.subarray(0, 8).toString('hex');

                // ── Graduation: CompleteEvent ────────────────────────────
                if (
                    this.config.enableGraduationAlerts &&
                    hex === COMPLETE_EVENT_DISCRIMINATOR
                ) {
                    const event = this.parseCompleteEvent(bytes, signature, slot, blockTime);
                    if (event) events.push(event);
                    continue;
                }

                // ── Graduation: CompletePumpAmmMigrationEvent ───────────
                if (
                    this.config.enableGraduationAlerts &&
                    hex === COMPLETE_AMM_MIGRATION_DISCRIMINATOR
                ) {
                    const event = this.parseMigrationEvent(bytes, signature, slot, blockTime);
                    if (event) events.push(event);
                    continue;
                }

                // ── Trade: TradeEvent ────────────────────────────────────
                if (
                    this.config.enableTradeAlerts &&
                    hex === TRADE_EVENT_DISCRIMINATOR
                ) {
                    const event = this.parseTradeEvent(bytes, signature, slot, blockTime);
                    if (event) events.push(event);
                    continue;
                }

                // ── Fee Distribution: DistributeCreatorFeesEvent ────────
                if (
                    this.config.enableFeeDistributionAlerts &&
                    hex === DISTRIBUTE_FEES_EVENT_DISCRIMINATOR
                ) {
                    const event = this.parseFeeDistributionEvent(bytes, signature, slot, blockTime);
                    if (event) events.push(event);
                    continue;
                }
            } catch {
                // Skip unparseable log data
            }
        }

        return events;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Event Parsers (Borsh decoding from raw bytes)
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Parse CompleteEvent from Anchor event data.
     *
     * Layout (after 8-byte discriminator):
     *   user: pubkey (32)
     *   mint: pubkey (32)
     *   bonding_curve: pubkey (32)
     *   timestamp: i64 (8)
     */
    private parseCompleteEvent(
        bytes: Buffer,
        signature: string,
        slot: number,
        blockTime: number,
    ): GraduationEvent | null {
        const MIN_SIZE = 8 + 32 + 32 + 32 + 8;
        if (bytes.length < MIN_SIZE) return null;

        let offset = 8;

        const user = this.readPubkey(bytes, offset);
        offset += 32;

        const mint = this.readPubkey(bytes, offset);
        offset += 32;

        const bondingCurve = this.readPubkey(bytes, offset);
        offset += 32;

        const timestamp = this.readI64(bytes, offset);

        return {
            bondingCurve,
            isMigration: false,
            mintAddress: mint,
            slot,
            timestamp: timestamp || blockTime,
            txSignature: signature,
            user,
        };
    }

    /**
     * Parse CompletePumpAmmMigrationEvent from Anchor event data.
     *
     * Layout (after 8-byte discriminator):
     *   user: pubkey (32)
     *   mint: pubkey (32)
     *   mint_amount: u64 (8)
     *   sol_amount: u64 (8)
     *   pool_migration_fee: u64 (8)
     *   bonding_curve: pubkey (32)
     *   timestamp: i64 (8)
     *   pool: pubkey (32)
     */
    private parseMigrationEvent(
        bytes: Buffer,
        signature: string,
        slot: number,
        blockTime: number,
    ): GraduationEvent | null {
        const MIN_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 32 + 8 + 32;
        if (bytes.length < MIN_SIZE) return null;

        let offset = 8;

        const user = this.readPubkey(bytes, offset);
        offset += 32;

        const mint = this.readPubkey(bytes, offset);
        offset += 32;

        const mintAmount = this.readU64(bytes, offset);
        offset += 8;

        const solAmount = this.readU64(bytes, offset);
        offset += 8;

        const poolMigrationFee = this.readU64(bytes, offset);
        offset += 8;

        const bondingCurve = this.readPubkey(bytes, offset);
        offset += 32;

        const timestamp = this.readI64(bytes, offset);
        offset += 8;

        const pool = this.readPubkey(bytes, offset);

        return {
            bondingCurve,
            isMigration: true,
            mintAddress: mint,
            mintAmount: mintAmount / LAMPORTS_PER_SOL, // stored in token decimals, not lamports — keep raw
            poolAddress: pool,
            poolMigrationFee: poolMigrationFee / LAMPORTS_PER_SOL,
            slot,
            solAmount: solAmount / LAMPORTS_PER_SOL,
            timestamp: timestamp || blockTime,
            txSignature: signature,
            user,
        };
    }

    /**
     * Parse TradeEvent from Anchor event data.
     *
     * Layout (after 8-byte discriminator):
     *   mint: pubkey (32)
     *   sol_amount: u64 (8)
     *   token_amount: u64 (8)
     *   is_buy: bool (1)
     *   user: pubkey (32)
     *   timestamp: i64 (8)
     *   virtual_sol_reserves: u64 (8)
     *   virtual_token_reserves: u64 (8)
     *   real_sol_reserves: u64 (8)
     *   real_token_reserves: u64 (8)
     *   fee_recipient: pubkey (32)
     *   fee_basis_points: u64 (8)
     *   fee: u64 (8)
     *   creator: pubkey (32)
     *   creator_fee_basis_points: u64 (8)
     *   creator_fee: u64 (8)
     *   ... (remaining fields: track_volume, volume accumulators, ix_name, mayhem_mode, cashback)
     */
    private parseTradeEvent(
        bytes: Buffer,
        signature: string,
        slot: number,
        blockTime: number,
    ): TradeAlertEvent | null {
        // Minimum size through creator_fee field
        const MIN_SIZE = 8 + 32 + 8 + 8 + 1 + 32 + 8 + 8 + 8 + 8 + 8 + 32 + 8 + 8 + 32 + 8 + 8;
        if (bytes.length < MIN_SIZE) return null;

        let offset = 8;

        const mint = this.readPubkey(bytes, offset);
        offset += 32;

        const solAmountLamports = this.readU64(bytes, offset);
        offset += 8;

        const tokenAmount = this.readU64(bytes, offset);
        offset += 8;

        const isBuy = bytes[offset] === 1;
        offset += 1;

        const user = this.readPubkey(bytes, offset);
        offset += 32;

        const timestamp = this.readI64(bytes, offset);
        offset += 8;

        const virtualSolReserves = this.readU64(bytes, offset);
        offset += 8;

        const virtualTokenReserves = this.readU64(bytes, offset);
        offset += 8;

        const realSolReserves = this.readU64(bytes, offset);
        offset += 8;

        const realTokenReserves = this.readU64(bytes, offset);
        offset += 8;

        // Skip fee_recipient pubkey
        offset += 32;

        // Skip fee_basis_points
        offset += 8;

        const feeLamports = this.readU64(bytes, offset);
        offset += 8;

        const creator = this.readPubkey(bytes, offset);
        offset += 32;

        // Skip creator_fee_basis_points
        offset += 8;

        const creatorFeeLamports = this.readU64(bytes, offset);
        offset += 8;

        // Read remaining fields for mayhem_mode
        // track_volume: bool, total_unclaimed_tokens: u64, total_claimed_tokens: u64,
        // current_sol_volume: u64, last_update_timestamp: i64, ix_name: string
        // mayhem_mode: bool
        let mayhemMode = false;
        try {
            offset += 1; // track_volume
            offset += 8; // total_unclaimed_tokens
            offset += 8; // total_claimed_tokens
            offset += 8; // current_sol_volume
            offset += 8; // last_update_timestamp

            // ix_name: Borsh string (u32 len + bytes)
            if (offset + 4 <= bytes.length) {
                const strLen =
                    bytes[offset] |
                    (bytes[offset + 1] << 8) |
                    (bytes[offset + 2] << 16) |
                    (bytes[offset + 3] << 24);
                offset += 4 + strLen;

                // mayhem_mode: bool
                if (offset < bytes.length) {
                    mayhemMode = bytes[offset] === 1;
                }
            }
        } catch {
            // Partial parse is fine — mayhemMode defaults to false
        }

        const solAmount = solAmountLamports / LAMPORTS_PER_SOL;

        // ── Whale threshold filter ───────────────────────────────────────
        if (solAmount < this.config.whaleThresholdSol) {
            return null;
        }

        // ── Compute market cap and bonding curve progress ────────────────
        const price =
            virtualTokenReserves > 0
                ? virtualSolReserves / virtualTokenReserves
                : 0;
        const marketCapSol =
            price > 0 ? (price * DEFAULT_TOKEN_TOTAL_SUPPLY) / LAMPORTS_PER_SOL : 0;

        const bondingCurveProgress =
            DEFAULT_GRADUATION_SOL_THRESHOLD > 0
                ? Math.min(
                      100,
                      (realSolReserves / LAMPORTS_PER_SOL / DEFAULT_GRADUATION_SOL_THRESHOLD) * 100,
                  )
                : 0;

        return {
            bondingCurveProgress: Math.round(bondingCurveProgress * 10) / 10,
            creator,
            creatorFee: creatorFeeLamports / LAMPORTS_PER_SOL,
            fee: feeLamports / LAMPORTS_PER_SOL,
            isBuy,
            marketCapSol: Math.round(marketCapSol * 100) / 100,
            mayhemMode,
            mintAddress: mint,
            realSolReserves: realSolReserves / LAMPORTS_PER_SOL,
            realTokenReserves,
            slot,
            solAmount,
            timestamp: timestamp || blockTime,
            tokenAmount,
            txSignature: signature,
            user,
            virtualSolReserves: virtualSolReserves / LAMPORTS_PER_SOL,
            virtualTokenReserves,
        };
    }

    /**
     * Parse DistributeCreatorFeesEvent from Anchor event data.
     *
     * Layout (after 8-byte discriminator):
     *   timestamp: i64 (8)
     *   mint: pubkey (32)
     *   bonding_curve: pubkey (32)
     *   sharing_config: pubkey (32)
     *   admin: pubkey (32)
     *   shareholders: Vec<Shareholder>  (4-byte len + [pubkey(32) + u16(2)] each)
     *   distributed: u64 (8)
     */
    private parseFeeDistributionEvent(
        bytes: Buffer,
        signature: string,
        slot: number,
        blockTime: number,
    ): FeeDistributionEvent | null {
        const MIN_SIZE = 8 + 8 + 32 + 32 + 32 + 32 + 4;
        if (bytes.length < MIN_SIZE) return null;

        let offset = 8;

        const timestamp = this.readI64(bytes, offset);
        offset += 8;

        const mint = this.readPubkey(bytes, offset);
        offset += 32;

        const bondingCurve = this.readPubkey(bytes, offset);
        offset += 32;

        // Skip sharing_config pubkey
        offset += 32;

        const admin = this.readPubkey(bytes, offset);
        offset += 32;

        // Parse shareholders Vec
        const shareholders: Array<{ address: string; shareBps: number }> = [];
        if (offset + 4 <= bytes.length) {
            const vecLen =
                bytes[offset] |
                (bytes[offset + 1] << 8) |
                (bytes[offset + 2] << 16) |
                (bytes[offset + 3] << 24);
            offset += 4;

            for (let i = 0; i < vecLen && offset + 34 <= bytes.length; i++) {
                const address = this.readPubkey(bytes, offset);
                offset += 32;

                const shareBps = bytes[offset] | (bytes[offset + 1] << 8);
                offset += 2;

                shareholders.push({ address, shareBps });
            }
        }

        // Read distributed amount
        let distributedLamports = 0;
        if (offset + 8 <= bytes.length) {
            distributedLamports = this.readU64(bytes, offset);
        }

        return {
            admin,
            bondingCurve,
            distributedSol: distributedLamports / LAMPORTS_PER_SOL,
            mintAddress: mint,
            shareholders,
            slot,
            timestamp: timestamp || blockTime,
            txSignature: signature,
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    // Event Dispatch
    // ──────────────────────────────────────────────────────────────────────

    private dispatchEvent(event: GraduationEvent | TradeAlertEvent | FeeDistributionEvent): void {
        if ('isMigration' in event) {
            // GraduationEvent
            this.state.graduationsDetected++;
            log.info(
                'Graduation: mint=%s %s (tx: %s)',
                event.mintAddress.slice(0, 8) + '...',
                event.isMigration ? `migrated ${event.solAmount?.toFixed(2)} SOL to AMM` : 'bonding curve completed',
                event.txSignature.slice(0, 12) + '...',
            );
            this.onGraduation(event as GraduationEvent);
        } else if ('isBuy' in event) {
            // TradeAlertEvent
            this.state.tradesDetected++;
            if (event.solAmount >= this.config.whaleThresholdSol) {
                this.state.whaleTradesDetected++;
            }
            log.info(
                'Whale %s: %.2f SOL on %s by %s (progress: %.1f%%, tx: %s)',
                event.isBuy ? 'BUY' : 'SELL',
                event.solAmount,
                event.mintAddress.slice(0, 8) + '...',
                event.user.slice(0, 8) + '...',
                event.bondingCurveProgress,
                event.txSignature.slice(0, 12) + '...',
            );
            this.onTradeAlert(event as TradeAlertEvent);
        } else if ('distributedSol' in event) {
            // FeeDistributionEvent
            this.state.feeDistributionsDetected++;
            log.info(
                'Fee distribution: %.4f SOL for mint=%s (%d shareholders, tx: %s)',
                event.distributedSol,
                event.mintAddress.slice(0, 8) + '...',
                event.shareholders.length,
                event.txSignature.slice(0, 12) + '...',
            );
            this.onFeeDistribution(event as FeeDistributionEvent);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Borsh Helpers
    // ──────────────────────────────────────────────────────────────────────

    /** Read a 32-byte public key as base58 string. */
    private readPubkey(bytes: Buffer, offset: number): string {
        return new PublicKey(bytes.subarray(offset, offset + 32)).toBase58();
    }

    /** Read a little-endian u64 as a JavaScript number. */
    private readU64(bytes: Buffer, offset: number): number {
        // Read as two u32s to avoid BigInt overhead
        const lo =
            (bytes[offset] |
                (bytes[offset + 1] << 8) |
                (bytes[offset + 2] << 16) |
                (bytes[offset + 3] << 24)) >>> 0;
        const hi =
            (bytes[offset + 4] |
                (bytes[offset + 5] << 8) |
                (bytes[offset + 6] << 16) |
                (bytes[offset + 7] << 24)) >>> 0;

        return hi * 0x1_0000_0000 + lo;
    }

    /** Read a little-endian i64 as a JavaScript number (safe for timestamps). */
    private readI64(bytes: Buffer, offset: number): number {
        return this.readU64(bytes, offset);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Dedup Helpers
    // ──────────────────────────────────────────────────────────────────────

    private markProcessed(signature: string): void {
        this.processedSignatures.add(signature);
        if (this.processedSignatures.size > this.MAX_PROCESSED_CACHE) {
            const it = this.processedSignatures.values();
            for (let i = 0; i < 1000; i++) {
                const val = it.next();
                if (val.done) break;
                this.processedSignatures.delete(val.value);
            }
        }
    }
}
