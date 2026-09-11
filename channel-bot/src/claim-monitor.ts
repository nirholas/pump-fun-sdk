/**
 * PumpFun Channel Bot — Solana Fee Claim Monitor
 *
 * Monitors both Pump and PumpSwap programs for fee claim transactions.
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
import { RpcFallback, maskRpcUrl } from './rpc-fallback.js';
import {
    SocialFeeIndex,
    CREATE_FEE_SHARING_CONFIG_EVENT_DISC,
    UPDATE_FEE_SHARES_EVENT_DISC,
} from './social-fee-index.js';
import type { FeeClaimEvent, ClaimType } from './types.js';
import {
    CLAIM_INSTRUCTIONS,
    PUMP_PROGRAM_ID,
    PUMP_AMM_PROGRAM_ID,
    PUMP_FEE_PROGRAM_ID,
    WSOL_MINT,
    QUOTE_MINT_INFO,
    type InstructionDef,
} from './types.js';

// ============================================================================
// Rate limiter
// ============================================================================

/**
 * Anchor "Instruction:" log lines that mark a claim transaction. Used in
 * WebSocket mode to decide which signatures are worth a getParsedTransaction.
 * The social-fee entry is load-bearing: that instruction can emit no event at
 * all (fake claims), so the log line is the only signal it leaves behind.
 *
 * Cashback is deliberately absent. Those are user refunds rather than creator
 * activity, they are by far the highest-volume claim on chain, and fetching them
 * only to discard them downstream saturates the RPC queue and starves real
 * creator claims.
 */
const CLAIM_INSTRUCTION_LOG_LINES = [
    'Program log: Instruction: ClaimSocialFeePda',
    'Program log: Instruction: CollectCreatorFee',
    'Program log: Instruction: CollectCoinCreatorFee',
    'Program log: Instruction: DistributeCreatorFees',
    'Program log: Instruction: TransferCreatorFeesToPump',
];

/**
 * Event discriminators for creator claims, derived from the same instruction
 * table the decoder uses so a new layout (a V2 variant, say) is picked up by the
 * WebSocket filter automatically instead of being silently dropped. Cashback is
 * excluded here for the reason above: isCreatorClaim is false for it.
 */
const CREATOR_CLAIM_EVENT_DISCS = new Set(
    CLAIM_INSTRUCTIONS.filter((ix) => ix.isCreatorClaim).map((ix) => ix.discriminator),
);

/**
 * Decide whether a transaction's logs are worth a getParsedTransaction.
 *
 * Two detection paths, and BOTH are required:
 *
 *  1. Anchor "Instruction:" log lines. claim_social_fee_pda does NOT emit a CPI
 *     event (it returns a SocialFeePdaClaimed struct), so the only trace it
 *     leaves -- including fake claims that emit nothing at all -- is its log line.
 *  2. Claim event discriminators on "Program data:" lines. Creator fee claims DO
 *     emit events and carry no social instruction log, so a filter keyed only on
 *     ClaimSocialFeePda silently discards every pure creator-fee claim before it
 *     is ever fetched.
 */
export function hasClaimSignal(logs: string[]): boolean {
    for (const line of logs) {
        if (CLAIM_INSTRUCTION_LOG_LINES.some((needle) => line.includes(needle))) return true;

        if (!line.includes('Program data:')) continue;
        const b64 = line.split('Program data: ')[1]?.trim();
        if (!b64) continue;
        try {
            const bytes = Buffer.from(b64, 'base64');
            if (bytes.length < 8) continue;
            const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');
            if (CREATOR_CLAIM_EVENT_DISCS.has(disc)) return true;
        } catch { /* ignore unparseable */ }
    }
    return false;
}

const MAX_CONCURRENCY = 1;
const MIN_REQUEST_INTERVAL_MS = 1_000;
const MAX_QUEUE_SIZE = 50;
const RATE_LIMIT_LOG_WINDOW_MS = 30_000;
const WS_HEARTBEAT_INTERVAL_MS = 60_000;
const WS_HEARTBEAT_TIMEOUT_MS = 90_000;
/**
 * How long a freshly subscribed endpoint has to deliver its first log event
 * before it is judged dead and the next candidate is tried.
 *
 * Subscribing cannot fail loudly: web3.js hands back a subscription id straight
 * away and retries the socket internally, so a refused upgrade (401) looks
 * exactly like a healthy connection. Traffic is the only honest signal, and the
 * monitored programs emit thousands of events a minute, so silence this long
 * means the endpoint, not the chain.
 */
const WS_LIVENESS_TIMEOUT_MS = 20_000;

class RpcQueue {
    private queue: string[] = [];
    private inFlight = 0;
    private processing = false;
    private lastRequestTime = 0;
    private last429LogTime = 0;
    private dropped429Count = 0;
    private processFn: (sig: string) => Promise<void>;

    constructor(processFn: (sig: string) => Promise<void>) {
        this.processFn = processFn;
    }

    enqueue(signature: string): boolean {
        if (this.queue.length >= MAX_QUEUE_SIZE) return false;
        this.queue.push(signature);
        this.drain();
        return true;
    }

    note429(): void {
        this.dropped429Count++;
        const now = Date.now();
        if (now - this.last429LogTime >= RATE_LIMIT_LOG_WINDOW_MS) {
            log.warn('RPC 429 — %d in last %ds', this.dropped429Count, RATE_LIMIT_LOG_WINDOW_MS / 1000);
            this.dropped429Count = 0;
            this.last429LogTime = now;
        }
    }

    private async drain(): Promise<void> {
        if (this.processing) return;
        this.processing = true;
        while (this.queue.length > 0 && this.inFlight < MAX_CONCURRENCY) {
            const elapsed = Date.now() - this.lastRequestTime;
            if (elapsed < MIN_REQUEST_INTERVAL_MS) {
                await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
            }
            const sig = this.queue.shift();
            if (!sig) break;
            this.lastRequestTime = Date.now();
            this.inFlight++;
            this.processFn(sig)
                .catch((err) => { log.debug('RPC queue item failed: %s', err); })
                .finally(() => { this.inFlight--; this.drain(); });
        }
        this.processing = false;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
}

// ============================================================================
// Monitor
// ============================================================================

export class ClaimMonitor {
    private rpc: RpcFallback;
    private wsConnection?: Connection;
    private config: ChannelBotConfig;
    private onClaim: (event: FeeClaimEvent) => void;
    private pollTimer?: ReturnType<typeof setInterval>;
    private wsSubscriptionIds: number[] = [];
    private lastSignatures = new Map<string, string | undefined>();
    private programPubkeys: PublicKey[];
    private processedSignatures = new Set<string>();
    private readonly MAX_PROCESSED_CACHE = 10_000;
    private rpcQueue: RpcQueue;
    private consecutive429s = 0;
    private isRunning = false;
    private startedAt = 0;
    private claimsDetected = 0;
    private lastWsEventTime = 0;
    private wsHeartbeatTimer?: ReturnType<typeof setInterval>;
    private readonly wsUrls: string[];
    private wsUrlIndex = 0;
    private activeWsUrl?: string;
    private wsEventsReceived = 0;
    private claimTxProcessed = 0;
    private claimsByType = new Map<string, number>();
    private socialFeeIndex = new SocialFeeIndex();

    constructor(config: ChannelBotConfig, onClaim: (event: FeeClaimEvent) => void) {
        this.config = config;
        this.onClaim = onClaim;
        this.rpc = new RpcFallback(config.solanaRpcUrls, {
            commitment: 'confirmed',
            disableRetryOnRateLimit: true,
        });
        if (config.solanaRpcUrls.length > 1) {
            log.info('Claim monitor: %d RPC endpoints configured (fallback enabled)', config.solanaRpcUrls.length);
        }
        // Subscribe only to the programs the enabled feeds can actually produce
        // a post from. PumpFees carries the social-fee-PDA claims (Path A) and
        // is touched only when someone claims. Pump and PumpAMM carry the
        // creator-fee claims (Path B) and also every buy and sell on pump.fun,
        // which is the entire firehose: roughly 1,600 log events a second.
        //
        // Subscribing to all three unconditionally meant the github-first-claims
        // feed paid for 23.5 million websocket events in four hours to find
        // seventeen GitHub claims, discarding the rest. That exhausted a Helius
        // free tier in a single afternoon ("max usage reached") and then 429-ed
        // every fallback endpoint in turn, so the feed was rate-limited off the
        // chain while looking healthy. A feed that cannot post creator claims
        // has no reason to watch the programs that emit them.
        const programs = [new PublicKey(PUMP_FEE_PROGRAM_ID)];
        if (config.feed.creatorClaims || config.feed.feeDistributions) {
            programs.push(new PublicKey(PUMP_PROGRAM_ID), new PublicKey(PUMP_AMM_PROGRAM_ID));
        }
        this.programPubkeys = programs;
        log.info('Claim monitor: watching %d program(s) for the enabled claim feeds', programs.length);
        this.rpcQueue = new RpcQueue((sig) => this.processTransaction(sig));
        this.wsUrls = config.solanaWsUrls?.length
            ? config.solanaWsUrls
            : (config.solanaWsUrl ? [config.solanaWsUrl] : []);
        if (this.wsUrls.length > 1) {
            log.info('Claim monitor: %d WebSocket endpoints configured (failover enabled)', this.wsUrls.length);
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startedAt = Date.now();

        log.info('Claim monitor: monitoring %d programs', this.programPubkeys.length);

        // Bootstrap social fee index from on-chain SharingConfig accounts (non-blocking)
        this.socialFeeIndex.bootstrap(this.rpc).catch((err: unknown) => {
            log.warn('SocialFeeIndex bootstrap error: %s', err);
        });

        if (this.wsUrls.length > 0 && (process.env.SOLANA_WS_URL || process.env.SOLANA_WS_URLS)) {
            try {
                await this.startWebSocket();
                log.info('Claim monitor: WebSocket mode (%s)', maskRpcUrl(this.activeWsUrl ?? ''));
                return;
            } catch (err) {
                log.warn('WS failed, falling back to polling:', err);
            }
        }

        this.startPolling();
        log.info('Claim monitor: polling mode (every %ds)', this.config.pollIntervalSeconds);
    }

    stop(): void {
        this.isRunning = false;
        if (this.wsHeartbeatTimer) {
            clearInterval(this.wsHeartbeatTimer);
            this.wsHeartbeatTimer = undefined;
        }
        this.teardownWsConnection();
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        log.info('Claim monitor stopped');
    }

    getMetrics(): Record<string, unknown> {
        return {
            claimsDetected: this.claimsDetected,
            processedSignatures: this.processedSignatures.size,
            mode: this.wsSubscriptionIds.length > 0 ? 'websocket' : 'polling',
            rpcEndpoints: this.rpc.size,
            activeRpc: maskRpcUrl(this.rpc.currentUrl),
            wsEndpoints: this.wsUrls.length,
            activeWs: this.activeWsUrl ? maskRpcUrl(this.activeWsUrl) : null,
            wsEventsReceived: this.wsEventsReceived,
            uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
        };
    }

    // ── WebSocket ────────────────────────────────────────────────────

    /**
     * Bring the log subscription up on the first endpoint that actually
     * delivers traffic, trying each configured endpoint in turn.
     */
    private async startWebSocket(): Promise<void> {
        if (this.wsUrls.length === 0) throw new Error('no WebSocket endpoints configured');

        let lastError = 'no endpoint delivered traffic';
        for (let attempt = 0; attempt < this.wsUrls.length; attempt++) {
            const index = (this.wsUrlIndex + attempt) % this.wsUrls.length;
            const wsUrl = this.wsUrls[index]!;
            try {
                await this.connectWebSocket(wsUrl);
                this.wsUrlIndex = index;
                this.activeWsUrl = wsUrl;
                this.startWsHeartbeat();
                return;
            } catch (err) {
                lastError = String(err);
                log.warn('Claim monitor: WS endpoint %s is not delivering (%s), trying the next one',
                    maskRpcUrl(wsUrl), lastError);
                this.teardownWsConnection();
            }
        }
        this.activeWsUrl = undefined;
        throw new Error(`all ${this.wsUrls.length} WebSocket endpoints failed: ${lastError}`);
    }

    /**
     * Subscribe through one endpoint and resolve only once a log event has
     * actually arrived. Rejects if the endpoint stays silent, which is what a
     * refused or black-holed upgrade looks like from web3.js.
     */
    private connectWebSocket(wsUrl: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const conn = new Connection(this.rpc.currentUrl, {
                commitment: 'confirmed',
                wsEndpoint: wsUrl,
                disableRetryOnRateLimit: true,
            });
            this.wsConnection = conn;
            this.lastWsEventTime = Date.now();

            const liveness = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error(`no log events within ${WS_LIVENESS_TIMEOUT_MS / 1000}s`));
            }, WS_LIVENESS_TIMEOUT_MS);

            for (const pubkey of this.programPubkeys) {
                const subId = conn.onLogs(
                    pubkey,
                    async (logInfo: Logs) => {
                        this.lastWsEventTime = Date.now();
                        this.wsEventsReceived++;
                        if (!settled) {
                            settled = true;
                            clearTimeout(liveness);
                            resolve();
                        }
                        try { await this.handleLogEvent(logInfo); }
                        catch (err) { log.error('Log event error:', err); }
                    },
                    'confirmed',
                );
                this.wsSubscriptionIds.push(subId);
            }
        });
    }

    /** Drop the current subscriptions and connection. Safe to call when there are none. */
    private teardownWsConnection(): void {
        if (this.wsConnection) {
            for (const id of this.wsSubscriptionIds) {
                this.wsConnection.removeOnLogsListener(id).catch(() => {});
            }
        }
        this.wsSubscriptionIds = [];
        this.wsConnection = undefined;
    }

    /**
     * (Re)arm the silence watchdog. Always clears the previous timer first: a
     * reconnect that stacked a second interval would double the log volume and
     * fire overlapping reconnects.
     */
    private startWsHeartbeat(): void {
        if (this.wsHeartbeatTimer) clearInterval(this.wsHeartbeatTimer);
        this.wsHeartbeatTimer = setInterval(() => {
            if (!this.isRunning) return;
            const elapsed = Date.now() - this.lastWsEventTime;
            if (elapsed > WS_HEARTBEAT_TIMEOUT_MS) {
                log.warn('Claim monitor WS silent for %ds on %s, reconnecting...',
                    Math.floor(elapsed / 1000), maskRpcUrl(this.activeWsUrl ?? ''));
                this.reconnectWebSocket();
            } else {
                const typeBreakdown = [...this.claimsByType.entries()]
                    .map(([type, count]) => `${type}=${count}`).join(', ');
                log.info('WS heartbeat: %d events, %d claims queued, %d detected [%s] (uptime %s)',
                    this.wsEventsReceived, this.claimTxProcessed, this.claimsDetected,
                    typeBreakdown || 'none',
                    formatUptime(Date.now() - this.startedAt));
            }
        }, WS_HEARTBEAT_INTERVAL_MS);
    }

    /**
     * Reconnect after a silence. Steps past the endpoint that just went quiet
     * so a dead one is not retried forever, which is how the sibling all-claims
     * feed sat on a 401 endpoint for four days still reporting websocket mode.
     */
    private reconnectWebSocket(): void {
        if (!this.isRunning) return;
        this.teardownWsConnection();
        if (this.wsUrls.length > 1) {
            this.wsUrlIndex = (this.wsUrlIndex + 1) % this.wsUrls.length;
        }

        this.startWebSocket().catch((err) => {
            log.warn('Claim monitor WS reconnect failed, falling back to polling: %s', err);
            if (this.wsHeartbeatTimer) {
                clearInterval(this.wsHeartbeatTimer);
                this.wsHeartbeatTimer = undefined;
            }
            this.startPolling();
        });
    }

    private async handleLogEvent(logInfo: Logs): Promise<void> {
        const { signature, logs, err } = logInfo;
        if (err) return;
        if (this.processedSignatures.has(signature)) return;
        this.processedSignatures.add(signature);
        this.trimProcessedCache();

        // Keep the social fee index current from the same log lines.
        for (const line of logs) {
            if (!line.includes('Program data:')) continue;
            const b64 = line.split('Program data: ')[1]?.trim();
            if (!b64) continue;
            try {
                const bytes = Buffer.from(b64, 'base64');
                if (bytes.length < 8) continue;
                const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');

                if (disc === CREATE_FEE_SHARING_CONFIG_EVENT_DISC) {
                    this.socialFeeIndex.updateFromCreateEvent(bytes);
                } else if (disc === UPDATE_FEE_SHARES_EVENT_DISC) {
                    this.socialFeeIndex.updateFromUpdateSharesEvent(bytes);
                }
            } catch { /* ignore unparseable */ }
        }

        if (hasClaimSignal(logs)) {
            this.claimTxProcessed++;
            this.rpcQueue.enqueue(signature);
        }
    }

    // ── Polling ──────────────────────────────────────────────────────

    private startPolling(): void {
        const poll = async () => {
            if (!this.isRunning) return;
            try {
                await this.pollAllPrograms();
                this.consecutive429s = 0;
            } catch (err) {
                const msg = String(err);
                if (msg.includes('429')) {
                    this.consecutive429s++;
                    this.rpcQueue.note429();
                } else {
                    log.error('Poll error:', err);
                }
            }
            if (this.isRunning) {
                const backoff = Math.min(
                    2 ** this.consecutive429s,
                    8,
                );
                const delay = this.config.pollIntervalSeconds * backoff * 1000;
                this.pollTimer = setTimeout(poll, delay);
            }
        };
        poll();
    }

    private async pollAllPrograms(): Promise<void> {
        for (const pubkey of this.programPubkeys) {
            const programId = pubkey.toBase58();
            const opts: SignaturesForAddressOptions = { limit: 20 };
            const lastSig = this.lastSignatures.get(programId);
            if (lastSig) opts.until = lastSig;

            const sigs = await this.rpc.withFallback((conn) => conn.getSignaturesForAddress(pubkey, opts));
            if (sigs.length === 0) continue;

            this.lastSignatures.set(programId, sigs[0]!.signature);

            for (const sigInfo of sigs) {
                if (sigInfo.err) continue;
                if (this.processedSignatures.has(sigInfo.signature)) continue;
                this.processedSignatures.add(sigInfo.signature);
                this.rpcQueue.enqueue(sigInfo.signature);
            }
        }
        this.trimProcessedCache();
    }

    // ── Transaction Processing ───────────────────────────────────────

    private async processTransaction(signature: string): Promise<void> {
        try {
            const tx = await this.rpc.withFallback((conn) => conn.getParsedTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            }));
            if (!tx?.meta || tx.meta.err) return;

            const instructions = tx.transaction.message.instructions;
            const timestamp = tx.blockTime ?? Math.floor(Date.now() / 1000);
            const slot = tx.slot;

            // Process all claim instructions (social, creator, distribution — not just social)
            for (const ix of instructions) {
                if (!('data' in ix) || !ix.data) continue;
                const programId = ix.programId.toBase58();
                const matchedDef = this.matchClaimInstruction(ix.data, programId);
                if (!matchedDef) continue;

                const event = this.buildClaimEvent(
                    signature, slot, timestamp, tx, matchedDef, ix,
                );
                if (event) {
                    this.claimsDetected++;
                    const typeCount = (this.claimsByType.get(event.claimType) ?? 0) + 1;
                    this.claimsByType.set(event.claimType, typeCount);
                    this.onClaim(event);
                }
            }
        } catch (err) {
            const msg = String(err);
            if (msg.includes('429')) {
                this.rpcQueue.note429();
            } else {
                log.error('TX processing error %s: %s', signature.slice(0, 8), err);
            }
        }
    }

    private matchClaimInstruction(data: string, programId: string): InstructionDef | undefined {
        try {
            const bytes = bs58.decode(data);
            const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');
            return CLAIM_INSTRUCTIONS.find(
                (def) => def.discriminator === disc && def.programId === programId,
            );
        } catch {
            return undefined;
        }
    }

    private buildClaimEvent(
        signature: string,
        slot: number,
        timestamp: number,
        tx: import('@solana/web3.js').ParsedTransactionWithMeta,
        def: InstructionDef,
        ix: import('@solana/web3.js').ParsedInstruction | import('@solana/web3.js').PartiallyDecodedInstruction,
    ): FeeClaimEvent | null {
        // Find the claimer from account keys
        const accountKeys = tx.transaction.message.accountKeys;
        const signerKey = accountKeys.find((a) => a.signer)?.pubkey?.toBase58();
        if (!signerKey) return null;

        // Extract token mint based on instruction type
        let tokenMint = '';
        let githubUserId: string | undefined;
        let socialPlatform: number | undefined;
        let recipientWallet: string | undefined;
        let socialFeePda: string | undefined;
        let lifetimeClaimedLamports: number | undefined;
        let quoteMint: string | undefined;

        if (def.claimType === 'distribute_creator_fees') {
            // distribute_creator_fees: accounts[0] = mint
            if ('accounts' in ix && Array.isArray(ix.accounts) && ix.accounts.length > 0) {
                tokenMint = ix.accounts[0]!.toBase58();
            }
        }
        // collect_creator_fee, claim_cashback, collect_coin_creator_fee
        // are wallet-level claims with no token mint — tokenMint stays empty
        // claim_social_fee_pda: mint is resolved via the SocialFeeIndex below

        // Parse event data from CPI log lines for amount
        let amountLamports = 0;
        let lifetimeClaimedRaw = 0n;
        const logMessages = tx.meta?.logMessages ?? [];
        for (const line of logMessages) {
            if (!line.includes('Program data:')) continue;
            const b64 = line.split('Program data: ')[1]?.trim();
            if (!b64) continue;
            try {
                const bytes = Buffer.from(b64, 'base64');
                const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');

                // DistributeCreatorFeesEvent: disc=a537817004b3ca28
                // V1 layout: disc(8) + timestamp(8) + mint(32) + bondingCurve(32) + sharingConfig(32) + admin(32) + shareholders(4+n*34) + distributed(8)
                // V2 layout (post-2026-05-21): ... + distributed(8) + quote_mint(32)
                if (disc === 'a537817004b3ca28' && def.claimType === 'distribute_creator_fees') {
                    // Extract mint from event data (bytes 8+8=16..48)
                    if (bytes.length >= 48) {
                        const mintBytes = bytes.subarray(16, 48);
                        tokenMint = new PublicKey(mintBytes).toBase58();
                    }
                    // Locate `distributed` by walking the shareholders vec rather than reading
                    // from the end (V2 has a trailing quote_mint that would otherwise be misread).
                    const SHARE_VEC_OFFSET = 8 + 8 + 32 + 32 + 32 + 32; // 144
                    if (bytes.length >= SHARE_VEC_OFFSET + 4) {
                        const shareCount = bytes.readUInt32LE(SHARE_VEC_OFFSET);
                        const distributedOffset = SHARE_VEC_OFFSET + 4 + shareCount * 34;
                        if (bytes.length >= distributedOffset + 8) {
                            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                            amountLamports = Number(view.getBigUint64(distributedOffset, true));
                            const qmOffset = distributedOffset + 8;
                            if (bytes.length >= qmOffset + 32) {
                                quoteMint = new PublicKey(bytes.subarray(qmOffset, qmOffset + 32)).toBase58();
                            }
                        }
                    }
                }

                // CollectCreatorFeeEvent: disc=7a027f010ebf0caf
                // V1 layout: disc(8) + timestamp(8) + creator(32) + creatorFee(8)
                // V2 layout (post-2026-05-21): ... + quote_mint(32)
                if (disc === '7a027f010ebf0caf') {
                    if (bytes.length >= 56) {
                        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        amountLamports = Number(view.getBigUint64(48, true));
                    }
                    if (bytes.length >= 88) {
                        quoteMint = new PublicKey(bytes.subarray(56, 88)).toBase58();
                    }
                }

                // ClaimCashbackEvent: disc=e2d6f62107f293e5
                // Layout: disc(8) + user(32) + amount(8) + timestamp(8) + totalClaimed(8) + totalCashbackEarned(8)
                if (disc === 'e2d6f62107f293e5') {
                    if (bytes.length >= 48) {
                        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        amountLamports = Number(view.getBigUint64(40, true));
                    }
                }

                // CollectCoinCreatorFeeEvent: disc=e8f5c2eeeada3a59
                // Layout: disc(8) + timestamp(8) + coinCreator(32) + coinCreatorFee(8) + ...
                if (disc === 'e8f5c2eeeada3a59') {
                    if (bytes.length >= 56) {
                        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        amountLamports = Number(view.getBigUint64(48, true));
                    }
                }

                // SocialFeePdaClaimed: disc=3212c141edd2eaec
                // V1 layout: disc(8) + timestamp(8) + user_id(string: 4-byte LE len + N) + platform(u8)
                //            + social_fee_pda(32) + recipient(32) + social_claim_authority(32)
                //            + amount_claimed(u64) + claimable_before(u64) + lifetime_claimed(u64)
                //            + recipient_balance_before(u64) + recipient_balance_after(u64)
                // V2 trailing fields (post-2026-05-21): quote_mint(pubkey) + lifetime_stable_claimed(u64)
                if (disc === '3212c141edd2eaec' && def.claimType === 'claim_social_fee_pda') {
                    let offset = 16; // skip disc(8) + timestamp(8)
                    // user_id: Borsh string = 4-byte LE length prefix + UTF-8 bytes
                    if (bytes.length >= offset + 4) {
                        const uidLen = bytes.readUInt32LE(offset);
                        offset += 4;
                        if (bytes.length >= offset + uidLen) {
                            githubUserId = Buffer.from(bytes.subarray(offset, offset + uidLen)).toString('utf8');
                            offset += uidLen;
                        }
                    }
                    // platform: u8
                    if (bytes.length >= offset + 1) {
                        socialPlatform = bytes[offset]!;
                        offset += 1;
                    }
                    // social_fee_pda: pubkey(32)
                    if (bytes.length >= offset + 32) {
                        socialFeePda = new PublicKey(bytes.subarray(offset, offset + 32)).toBase58();
                        offset += 32;
                    }
                    // recipient: pubkey(32)
                    if (bytes.length >= offset + 32) {
                        recipientWallet = new PublicKey(bytes.subarray(offset, offset + 32)).toBase58();
                        offset += 32;
                    }
                    // social_claim_authority: pubkey(32) — skip
                    offset += 32;
                    // amount_claimed: u64
                    if (bytes.length >= offset + 8) {
                        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        amountLamports = Number(view.getBigUint64(offset, true));
                        offset += 8;
                    }
                    // claimable_before: u64 — skip
                    offset += 8;
                    // lifetime_claimed: u64
                    if (bytes.length >= offset + 8) {
                        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        lifetimeClaimedLamports = Number(view.getBigUint64(offset, true));
                        lifetimeClaimedRaw = view.getBigUint64(offset, true);
                        offset += 8;
                    }
                    // V2 only: recipient_balance_before(8) + recipient_balance_after(8) + quote_mint(32)
                    // skip the two balance fields and read quote_mint
                    if (bytes.length >= offset + 8 + 8 + 32) {
                        offset += 16; // skip recipient_balance_before + recipient_balance_after
                        quoteMint = new PublicKey(bytes.subarray(offset, offset + 32)).toBase58();
                    }
                }
            } catch { /* skip unparseable log lines */ }
        }

        // Fallback: calculate SOL amount from balance changes
        if (amountLamports === 0) {
            const preBalances = tx.meta?.preBalances ?? [];
            const postBalances = tx.meta?.postBalances ?? [];
            const signerIdx = accountKeys.findIndex(
                (a) => a.pubkey.toBase58() === signerKey,
            );
            if (signerIdx >= 0 && signerIdx < preBalances.length) {
                const diff = (postBalances[signerIdx] ?? 0) - (preBalances[signerIdx] ?? 0);
                if (diff > 0) amountLamports = diff;
            }
        }

        // If still no amount, try inner instructions
        if (amountLamports === 0) {
            const innerIxs = tx.meta?.innerInstructions ?? [];
            for (const inner of innerIxs) {
                for (const innerIx of inner.instructions) {
                    if (
                        'parsed' in innerIx &&
                        innerIx.parsed?.type === 'transfer' &&
                        innerIx.parsed?.info?.destination === signerKey
                    ) {
                        amountLamports = Number(innerIx.parsed.info.lamports ?? 0);
                    }
                }
            }
        }

        // Detect fake claims: claim_social_fee_pda was called but no
        // SocialFeePdaClaimed event was emitted (amount stays 0).
        // Parse user_id and platform from the instruction arguments instead.
        let isFake = false;
        if (def.claimType === 'claim_social_fee_pda' && amountLamports === 0) {
            isFake = true;
            // Try to extract user_id & platform from instruction args
            // Anchor ix data: disc(8) + user_id(borsh string: 4-byte len + N) + platform(u8)
            if ('data' in ix && ix.data && !githubUserId) {
                try {
                    const ixBytes = bs58.decode(ix.data);
                    if (ixBytes.length > 12) {
                        let offset = 8; // skip discriminator
                        const uidLen = Buffer.from(ixBytes.subarray(offset, offset + 4)).readUInt32LE(0);
                        offset += 4;
                        if (uidLen > 0 && uidLen <= 20 && ixBytes.length >= offset + uidLen) {
                            githubUserId = Buffer.from(ixBytes.subarray(offset, offset + uidLen)).toString('utf8');
                            offset += uidLen;
                        }
                        if (ixBytes.length >= offset + 1) {
                            socialPlatform = ixBytes[offset];
                        }
                    }
                } catch { /* ignore parse errors */ }
            }
            // Resolve socialFeePda from instruction accounts
            if ('accounts' in ix && Array.isArray(ix.accounts) && ix.accounts.length >= 2 && !socialFeePda) {
                socialFeePda = ix.accounts[1]?.toBase58();
            }
        }

        // Skip non-social dust amounts (real social claims always emit event data)
        if (!isFake && amountLamports < 1000) return null;

        // For social fee PDA claims, resolve mint from the index.
        // When multiple tokens share the same PDA (scam vector), return all
        // candidates so the caller can disambiguate by market cap.
        let allCandidateMints: string[] | undefined;
        if (def.claimType === 'claim_social_fee_pda' && socialFeePda && !tokenMint) {
            const candidates = this.socialFeeIndex.lookupAll(socialFeePda);
            if (candidates.length === 1) {
                tokenMint = candidates[0]!;
            } else if (candidates.length > 1) {
                allCandidateMints = candidates;
                // Use first as fallback; caller should disambiguate
                tokenMint = candidates[0]!;
            }
        }

        // Resolve quote-currency metadata. Defaults to SOL when the event predates V2 or
        // the quote_mint field couldn't be read; that preserves V1 behavior exactly.
        const resolvedQuoteMint = quoteMint ?? WSOL_MINT;
        const quoteInfo = QUOTE_MINT_INFO[resolvedQuoteMint] ?? QUOTE_MINT_INFO[WSOL_MINT]!;
        const quoteDivisor = Math.pow(10, quoteInfo.decimals);
        const amountQuote = amountLamports / quoteDivisor;
        const lifetimeClaimedQuote = lifetimeClaimedRaw != null
            ? Number(lifetimeClaimedRaw) / quoteDivisor
            : undefined;
        // amountSol is preserved only when the quote is actually SOL — for USDC claims it
        // would be misleading, so we leave it 0 and downstream code branches on isStableQuote.
        const amountSol = quoteInfo.isStable ? 0 : amountLamports / LAMPORTS_PER_SOL;

        return {
            txSignature: signature,
            slot,
            timestamp,
            claimerWallet: signerKey,
            tokenMint,
            amountSol,
            amountLamports,
            claimType: def.claimType,
            isCashback: !def.isCreatorClaim,
            programId: def.programId,
            claimLabel: def.label,
            githubUserId,
            socialPlatform,
            recipientWallet,
            socialFeePda,
            isFake,
            lifetimeClaimedLamports,
            allCandidateMints,
            quoteMint: resolvedQuoteMint,
            quoteTicker: quoteInfo.ticker,
            isStableQuote: quoteInfo.isStable,
            amountQuote,
            lifetimeClaimedQuote,
        };
    }

    private trimProcessedCache(): void {
        if (this.processedSignatures.size > this.MAX_PROCESSED_CACHE) {
            // Keep the most recent entries (Sets are insertion-ordered in JS)
            const arr = [...this.processedSignatures];
            this.processedSignatures = new Set(arr.slice(-5_000));
        }
    }
}


