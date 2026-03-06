/**
 * PumpFun Channel Bot — Event Monitor
 *
 * Monitors the Pump program for on-chain events:
 *   - Token launches (CreateEvent, CreateV2Event)
 *   - Graduation (CompleteEvent, CompletePumpAmmMigrationEvent)
 *   - Whale trades (TradeEvent above a SOL threshold)
 *   - Fee distributions (DistributeCreatorFeesEvent)
 *
 * Events are decoded from "Program data:" log lines (Anchor CPI self-invoke).
 * Two modes: WebSocket (real-time) or HTTP polling (fallback).
 */


import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    type Logs,
    type SignaturesForAddressOptions,
} from '@solana/web3.js';
import bs58 from 'bs58';

import type { ChannelBotConfig } from './config.js';
import { log } from './logger.js';
import { RpcFallback } from './rpc-fallback.js';
import type {
    FeeDistributionEvent,
    GraduationEvent,
    TokenLaunchEvent,
    TradeAlertEvent,
} from './types.js';
import {
    COMPLETE_EVENT_DISCRIMINATOR,
    COMPLETE_AMM_MIGRATION_DISCRIMINATOR,
    CREATE_V2_DISCRIMINATOR,
    CREATE_DISCRIMINATOR,
    DEFAULT_GRADUATION_SOL_THRESHOLD,
    PUMP_PROGRAM_ID,
    TRADE_EVENT_DISCRIMINATOR,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DISTRIBUTE_FEES_EVENT_DISCRIMINATOR = 'a537817004b3ca28';
const MAX_WS_ERRORS = 5;
const DEFAULT_TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000;
const WS_HEARTBEAT_INTERVAL_MS = 60_000;
const WS_HEARTBEAT_TIMEOUT_MS = 90_000;

// ============================================================================
// Event Monitor
// ============================================================================

export class EventMonitor {
    private rpc: RpcFallback;
    private wsConnection?: Connection;
    private config: ChannelBotConfig;
    private programPubkey: PublicKey;

    private onLaunch: (event: TokenLaunchEvent) => void;
    private onGraduation: (event: GraduationEvent) => void;
    private onWhale: (event: TradeAlertEvent) => void;
    private onFeeDistribution: (event: FeeDistributionEvent) => void;

    private pollTimer?: ReturnType<typeof setInterval>;
    private wsSubscriptionId?: number;
    private lastSignature: string | undefined;
    private processedSignatures = new Set<string>();
    private readonly MAX_PROCESSED_CACHE = 10_000;
    private wsErrorCount = 0;
    private stopped = false;
    private isRunning = false;
    private lastWsEventTime = 0;
    private wsHeartbeatTimer?: ReturnType<typeof setInterval>;

    constructor(
        config: ChannelBotConfig,
        onLaunch: (event: TokenLaunchEvent) => void,
        onGraduation: (event: GraduationEvent) => void,
        onWhale: (event: TradeAlertEvent) => void,
        onFeeDistribution: (event: FeeDistributionEvent) => void,
    ) {
        this.config = config;
        this.onLaunch = onLaunch;
        this.onGraduation = onGraduation;
        this.onWhale = onWhale;
        this.onFeeDistribution = onFeeDistribution;
        this.rpc = new RpcFallback(config.solanaRpcUrls, {
            commitment: 'confirmed',
        });
        if (config.solanaRpcUrls.length > 1) {
            log.info('Event monitor: %d RPC endpoints configured (fallback enabled)', config.solanaRpcUrls.length);
        }
        this.programPubkey = new PublicKey(PUMP_PROGRAM_ID);
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        if (this.config.solanaWsUrl && process.env.SOLANA_WS_URL) {
            try {
                await this.startWebSocket();
                log.info('Event monitor: WebSocket mode');
                return;
            } catch (err) {
                log.warn('Event monitor WS failed, falling back to polling:', err);
            }
        }

        this.startPolling();
        log.info('Event monitor: polling mode (every %ds)', this.config.pollIntervalSeconds);
    }

    stop(): void {
        this.stopped = true;
        this.isRunning = false;
        if (this.wsHeartbeatTimer) {
            clearInterval(this.wsHeartbeatTimer);
            this.wsHeartbeatTimer = undefined;
        }
        if (this.wsConnection && this.wsSubscriptionId !== undefined) {
            this.wsConnection.removeOnLogsListener(this.wsSubscriptionId).catch(() => {});
        }
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
    }

    // ── WebSocket ────────────────────────────────────────────────────

    private async startWebSocket(): Promise<void> {
        this.wsConnection = new Connection(this.rpc.currentUrl, {
            commitment: 'confirmed',
            wsEndpoint: this.config.solanaWsUrl,
        });

        this.lastWsEventTime = Date.now();

        this.wsSubscriptionId = this.wsConnection.onLogs(
            this.programPubkey,
            async (logInfo: Logs) => {
                this.lastWsEventTime = Date.now();
                try { await this.handleLogEvent(logInfo); }
                catch (err) { log.error('Event log error:', err); }
            },
            'confirmed',
        );

        // Heartbeat: if no event received for too long, reconnect
        this.wsHeartbeatTimer = setInterval(() => {
            if (this.stopped) return;
            const elapsed = Date.now() - this.lastWsEventTime;
            if (elapsed > WS_HEARTBEAT_TIMEOUT_MS) {
                log.warn('Event monitor WS silent for %ds — reconnecting...', Math.floor(elapsed / 1000));
                this.reconnectWebSocket();
            }
        }, WS_HEARTBEAT_INTERVAL_MS);
    }

    private reconnectWebSocket(): void {
        if (this.stopped) return;
        // Clean up old connection
        if (this.wsConnection && this.wsSubscriptionId !== undefined) {
            this.wsConnection.removeOnLogsListener(this.wsSubscriptionId).catch(() => {});
        }
        this.wsSubscriptionId = undefined;
        this.wsConnection = undefined;

        // Attempt to reconnect
        this.startWebSocket().catch((err) => {
            log.warn('Event monitor WS reconnect failed, falling back to polling: %s', err);
            if (this.wsHeartbeatTimer) {
                clearInterval(this.wsHeartbeatTimer);
                this.wsHeartbeatTimer = undefined;
            }
            this.startPolling();
        });
    }

    private async handleLogEvent(logInfo: Logs, blockTime?: number | null): Promise<void> {
        const { signature, logs: logLines, err } = logInfo;
        if (err) return;
        if (this.processedSignatures.has(signature)) return;
        this.processedSignatures.add(signature);
        this.trimCache();

        for (const line of logLines) {
            if (!line.includes('Program data:')) continue;
            const b64 = line.split('Program data: ')[1]?.trim();
            if (!b64) continue;

            try {
                const bytes = Buffer.from(b64, 'base64');
                if (bytes.length < 8) continue;
                const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');

                if (disc === CREATE_V2_DISCRIMINATOR || disc === CREATE_DISCRIMINATOR) {
                    this.decodeLaunch(bytes, disc, signature);
                } else if (disc === COMPLETE_EVENT_DISCRIMINATOR || disc === COMPLETE_AMM_MIGRATION_DISCRIMINATOR) {
                    this.decodeGraduation(bytes, disc, signature, blockTime);
                } else if (disc === TRADE_EVENT_DISCRIMINATOR) {
                    this.decodeTrade(bytes, signature);
                } else if (disc === DISTRIBUTE_FEES_EVENT_DISCRIMINATOR) {
                    this.decodeFeeDistribution(bytes, signature);
                }
            } catch (err) {
                log.debug('Malformed log line in %s: %s', signature.slice(0, 8), err);
            }
        }
    }

    // ── Polling ──────────────────────────────────────────────────────

    private startPolling(): void {
        const poll = async () => {
            if (this.stopped) return;
            try {
                const opts: SignaturesForAddressOptions = { limit: 20 };
                if (this.lastSignature) opts.until = this.lastSignature;

                const sigs = await this.rpc.withFallback((conn) => conn.getSignaturesForAddress(this.programPubkey, opts));
                if (sigs.length > 0) this.lastSignature = sigs[0]!.signature;

                for (const sigInfo of sigs) {
                    if (sigInfo.err) continue;
                    if (this.processedSignatures.has(sigInfo.signature)) continue;
                    this.processedSignatures.add(sigInfo.signature);
                    await this.fetchAndProcessLogs(sigInfo.signature);
                }
                this.trimCache();
            } catch (err) {
                log.error('Event poll error:', err);
            }

            if (!this.stopped) {
                this.pollTimer = setTimeout(poll, this.config.pollIntervalSeconds * 1000);
            }
        };
        poll();
    }

    private async fetchAndProcessLogs(signature: string): Promise<void> {
        try {
            const tx = await this.rpc.withFallback((conn) => conn.getParsedTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            }));
            if (!tx?.meta || tx.meta.err) return;

            const logMessages = tx.meta.logMessages ?? [];
            await this.handleLogEvent({
                signature,
                logs: logMessages,
                err: null,
            }, tx.blockTime);
        } catch (err) {
            log.debug('Failed to fetch tx %s: %s', signature.slice(0, 8), err);
        }
    }

    // ── Decoders ─────────────────────────────────────────────────────

    private decodeLaunch(bytes: Buffer, disc: string, signature: string): void {
        try {
            // CreateEvent layout after 8-byte discriminator:
            // name: string (4-byte len + data), symbol: string, uri: string,
            // mint: Pubkey (32), bondingCurve: Pubkey (32), user: Pubkey (32),
            // creator: Pubkey (32), timestamp: i64,
            // virtualTokenReserves: u64, virtualSolReserves: u64,
            // realTokenReserves: u64, tokenTotalSupply: u64,
            // tokenProgram: Pubkey (32), isMayhemMode: bool, isCashbackEnabled: bool
            if (bytes.length < 20) return; // minimum for disc + a short string

            let offset = 8;

            // Read Borsh-encoded strings: 4-byte LE length prefix + data
            const readString = (): string => {
                if (offset + 4 > bytes.length) return '';
                const len = bytes.readUInt32LE(offset);
                offset += 4;
                if (len > 1000 || offset + len > bytes.length) return '';
                const str = bytes.subarray(offset, offset + len).toString('utf8');
                offset += len;
                return str;
            };

            const name = readString();
            const symbol = readString();
            const uri = readString();

            // Remaining fixed-size fields
            if (offset + 32 + 32 + 32 + 32 + 8 > bytes.length) return;

            const mint = this.readPubkey(bytes, offset); offset += 32;
            const _bondingCurve = this.readPubkey(bytes, offset); offset += 32;
            const user = this.readPubkey(bytes, offset); offset += 32;
            const creator = this.readPubkey(bytes, offset); offset += 32;
            const timestamp = Number(bytes.readBigInt64LE(offset)); offset += 8;

            // Skip reserves (4 * u64 = 32 bytes) + tokenProgram (32 bytes)
            let mayhemMode = false;
            let cashbackEnabled = false;
            if (offset + 32 + 32 + 1 + 1 <= bytes.length) {
                offset += 32 + 32; // reserves + tokenProgram
                mayhemMode = bytes[offset] === 1; offset += 1;
                cashbackEnabled = bytes[offset] === 1;
            }

            // Extract GitHub URLs from description/URI
            const githubUrls = extractGithubUrlsFromString(name + ' ' + symbol + ' ' + uri);

            const event: TokenLaunchEvent = {
                txSignature: signature,
                slot: 0,
                timestamp,
                mintAddress: mint,
                creatorWallet: creator || user,
                name,
                symbol,
                description: '',
                metadataUri: uri,
                hasGithub: githubUrls.length > 0,
                githubUrls,
                mayhemMode,
                cashbackEnabled,
            };

            this.onLaunch(event);
        } catch (err) {
            log.debug('Launch decode error: %s', err);
        }
    }

    private decodeGraduation(bytes: Buffer, disc: string, signature: string, blockTime?: number | null): void {
        try {
            // CompleteEvent layout after 8-byte discriminator:
            // user: Pubkey (32), mint: Pubkey (32), bondingCurve: Pubkey (32)
            if (bytes.length < 8 + 96) return;

            const user = this.readPubkey(bytes, 8);
            const mint = this.readPubkey(bytes, 40);
            const bondingCurve = this.readPubkey(bytes, 72);
            const isMigration = disc === COMPLETE_AMM_MIGRATION_DISCRIMINATOR;

            const event: GraduationEvent = {
                txSignature: signature,
                slot: 0,
                timestamp: blockTime ?? Math.floor(Date.now() / 1000),
                mintAddress: mint,
                user,
                bondingCurve,
                isMigration,
            };

            // Migration has extra fields
            if (isMigration && bytes.length >= 8 + 96 + 32) {
                let offset = 8 + 96;
                // Read pool address (32 bytes)
                event.poolAddress = this.readPubkey(bytes, offset);
                offset += 32;
                // Attempt to read SOL amount (u64) + token amount (u64) + fee (u64)
                if (bytes.length >= offset + 24) {
                    event.solAmount = Number(bytes.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
                    event.mintAmount = Number(bytes.readBigUInt64LE(offset + 8));
                    event.poolMigrationFee = Number(bytes.readBigUInt64LE(offset + 16)) / LAMPORTS_PER_SOL;
                }
            }

            this.onGraduation(event);
        } catch (err) {
            log.debug('Graduation decode error: %s', err);
        }
    }

    private decodeTrade(bytes: Buffer, signature: string): void {
        try {
            // TradeEvent layout after 8-byte discriminator:
            // mint: Pubkey (32), solAmount: u64, tokenAmount: u64, isBuy: bool (1),
            // user: Pubkey (32), timestamp: i64, virtualSolReserves: u64,
            // virtualTokenReserves: u64, realSolReserves: u64, realTokenReserves: u64
            if (bytes.length < 8 + 32 + 8 + 8 + 1 + 32 + 8 + 8 + 8 + 8 + 8) return;

            let offset = 8;
            const mint = this.readPubkey(bytes, offset); offset += 32;
            const solAmount = Number(bytes.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL; offset += 8;
            const tokenAmount = Number(bytes.readBigUInt64LE(offset)); offset += 8;
            const isBuy = bytes[offset] === 1; offset += 1;
            const user = this.readPubkey(bytes, offset); offset += 32;
            const timestamp = Number(bytes.readBigInt64LE(offset)); offset += 8;
            const virtualSolReserves = Number(bytes.readBigUInt64LE(offset)); offset += 8;
            const virtualTokenReserves = Number(bytes.readBigUInt64LE(offset)); offset += 8;
            const realSolReserves = Number(bytes.readBigUInt64LE(offset)); offset += 8;
            const realTokenReserves = Number(bytes.readBigUInt64LE(offset)); offset += 8;

            // Only alert on whales
            if (solAmount < this.config.whaleThresholdSol) return;

            const marketCapSol = virtualTokenReserves > 0
                ? (virtualSolReserves * DEFAULT_TOKEN_TOTAL_SUPPLY) / (virtualTokenReserves * LAMPORTS_PER_SOL)
                : 0;

            const bondingCurveProgress = realSolReserves > 0
                ? Math.min(100, (realSolReserves / LAMPORTS_PER_SOL) / DEFAULT_GRADUATION_SOL_THRESHOLD * 100)
                : 0;

            // Read remaining fields if available
            let fee = 0;
            let creatorFee = 0;
            let mayhemMode = false;
            let creator = '';

            if (bytes.length >= offset + 8) { fee = Number(bytes.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL; offset += 8; }
            if (bytes.length >= offset + 8) { creatorFee = Number(bytes.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL; offset += 8; }
            if (bytes.length >= offset + 1) { mayhemMode = bytes[offset] === 1; offset += 1; }
            if (bytes.length >= offset + 32) { creator = this.readPubkey(bytes, offset); }

            const event: TradeAlertEvent = {
                txSignature: signature,
                slot: 0,
                timestamp,
                mintAddress: mint,
                user,
                creator,
                isBuy,
                solAmount,
                tokenAmount,
                fee,
                creatorFee,
                virtualSolReserves,
                virtualTokenReserves,
                realSolReserves,
                realTokenReserves,
                mayhemMode,
                marketCapSol,
                bondingCurveProgress,
            };

            this.onWhale(event);
        } catch (err) {
            log.debug('Trade decode error: %s', err);
        }
    }

    private decodeFeeDistribution(bytes: Buffer, signature: string): void {
        try {
            // DistributeCreatorFeesEvent layout after 8-byte discriminator:
            // timestamp: i64, mint: Pubkey (32), sharingConfig: Pubkey (32), admin: Pubkey (32),
            // shareholders: Vec<{address: Pubkey(32), shareBps: u16}>,
            // distributedAmount: u64
            if (bytes.length < 8 + 8 + 96 + 8) return;

            let offset = 8;
            const timestamp = Number(bytes.readBigInt64LE(offset)); offset += 8;
            const mint = this.readPubkey(bytes, offset); offset += 32;
            const bondingCurve = this.readPubkey(bytes, offset); offset += 32;
            const admin = this.readPubkey(bytes, offset); offset += 32;

            // Parse shareholders vector: 4-byte LE count, then {Pubkey(32) + u16(2)} per entry
            const shareholders: Array<{ address: string; shareBps: number }> = [];
            if (offset + 4 <= bytes.length) {
                const vecLen = bytes.readUInt32LE(offset); offset += 4;
                for (let i = 0; i < vecLen && offset + 34 <= bytes.length; i++) {
                    const address = this.readPubkey(bytes, offset); offset += 32;
                    const shareBps = bytes.readUInt16LE(offset); offset += 2;
                    shareholders.push({ address, shareBps });
                }
                if (vecLen > shareholders.length) {
                    log.debug('Fee distribution: truncated shareholder list (%d/%d) for %s', shareholders.length, vecLen, signature.slice(0, 8));
                }
            }

            // distributedAmount is the last 8 bytes after shareholders
            let distributedSol = 0;
            if (offset + 8 <= bytes.length) {
                distributedSol = Number(bytes.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
            }

            const event: FeeDistributionEvent = {
                txSignature: signature,
                slot: 0,
                timestamp: timestamp || Math.floor(Date.now() / 1000),
                mintAddress: mint,
                bondingCurve,
                admin,
                distributedSol,
                shareholders,
            };

            this.onFeeDistribution(event);
        } catch (err) {
            log.debug('Fee distribution decode error: %s', err);
        }
    }

    private readPubkey(buf: Buffer, offset: number): string {
        const bytes = buf.subarray(offset, offset + 32);
        return bs58.encode(bytes);
    }

    private trimCache(): void {
        if (this.processedSignatures.size > this.MAX_PROCESSED_CACHE) {
            // Keep the most recent entries (Sets are insertion-ordered in JS)
            const arr = [...this.processedSignatures];
            this.processedSignatures = new Set(arr.slice(-5_000));
        }
    }
}

// ============================================================================
// Helpers
// ============================================================================

const GITHUB_RE = /https?:\/\/github\.com\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?/gi;

function extractGithubUrlsFromString(text: string): string[] {
    if (!text) return [];
    const matches = text.match(GITHUB_RE);
    if (!matches) return [];
    return [...new Set(matches)];
}
