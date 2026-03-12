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
import { RpcFallback } from './rpc-fallback.js';
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
    type InstructionDef,
} from './types.js';

// ============================================================================
// Rate limiter
// ============================================================================

const MAX_CONCURRENCY = 1;
const MIN_REQUEST_INTERVAL_MS = 1_000;
const MAX_QUEUE_SIZE = 50;
const RATE_LIMIT_LOG_WINDOW_MS = 30_000;
const WS_HEARTBEAT_INTERVAL_MS = 60_000;
const WS_HEARTBEAT_TIMEOUT_MS = 90_000;

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
        // Monitor all three programs: PumpFees (social fee PDA), Pump (creator fees), PumpAMM (coin creator fees)
        this.programPubkeys = [
            new PublicKey(PUMP_FEE_PROGRAM_ID),
            new PublicKey(PUMP_PROGRAM_ID),
            new PublicKey(PUMP_AMM_PROGRAM_ID),
        ];
        this.rpcQueue = new RpcQueue((sig) => this.processTransaction(sig));
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

        if (this.config.solanaWsUrl && process.env.SOLANA_WS_URL) {
            try {
                await this.startWebSocket();
                log.info('Claim monitor: WebSocket mode');
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
        if (this.wsConnection) {
            for (const id of this.wsSubscriptionIds) {
                this.wsConnection.removeOnLogsListener(id).catch(() => {});
            }
            this.wsSubscriptionIds = [];
        }
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
            uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
        };
    }

    // ── WebSocket ────────────────────────────────────────────────────

    private async startWebSocket(): Promise<void> {
        this.wsConnection = new Connection(this.rpc.currentUrl, {
            commitment: 'confirmed',
            wsEndpoint: this.config.solanaWsUrl,
            disableRetryOnRateLimit: true,
        });

        this.lastWsEventTime = Date.now();

        for (const pubkey of this.programPubkeys) {
            const subId = this.wsConnection.onLogs(
                pubkey,
                async (logInfo: Logs) => {
                    this.lastWsEventTime = Date.now();
                    this.wsEventsReceived++;
                    try { await this.handleLogEvent(logInfo); }
                    catch (err) { log.error('Log event error:', err); }
                },
                'confirmed',
            );
            this.wsSubscriptionIds.push(subId);
        }

        // Heartbeat: if no event for too long, reconnect
        this.wsHeartbeatTimer = setInterval(() => {
            if (!this.isRunning) return;
            const elapsed = Date.now() - this.lastWsEventTime;
            if (elapsed > WS_HEARTBEAT_TIMEOUT_MS) {
                log.warn('Claim monitor WS silent for %ds — reconnecting...', Math.floor(elapsed / 1000));
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

    private reconnectWebSocket(): void {
        if (!this.isRunning) return;
        // Clean up old connection
        if (this.wsConnection) {
            for (const id of this.wsSubscriptionIds) {
                this.wsConnection.removeOnLogsListener(id).catch(() => {});
            }
            this.wsSubscriptionIds = [];
        }
        this.wsConnection = undefined;

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

        // Scan all log lines for relevant events.
        // NOTE: claim_social_fee_pda does NOT emit a CPI event — it returns a
        // SocialFeePdaClaimed struct. Detect it via Anchor's instruction log line
        // instead of a "Program data:" discriminator.
        let hasClaimIx = false;

        for (const line of logs) {
            // Detect claim_social_fee_pda via Anchor instruction log
            if (!hasClaimIx && line.includes('Program log: Instruction: ClaimSocialFeePda')) {
                hasClaimIx = true;
            }

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

        if (hasClaimIx) {
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
        const logMessages = tx.meta?.logMessages ?? [];
        for (const line of logMessages) {
            if (!line.includes('Program data:')) continue;
            const b64 = line.split('Program data: ')[1]?.trim();
            if (!b64) continue;
            try {
                const bytes = Buffer.from(b64, 'base64');
                const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');

                // DistributeCreatorFeesEvent: disc=a537817004b3ca28
                // Layout: disc(8) + timestamp(8) + mint(32) + sharingConfig(32) + admin(32) + ...shareholders... + distributed(8)
                if (disc === 'a537817004b3ca28' && def.claimType === 'distribute_creator_fees') {
                    // Extract mint from event data (bytes 8+8=16..48)
                    if (bytes.length >= 48) {
                        const mintBytes = bytes.subarray(16, 48);
                        tokenMint = new PublicKey(mintBytes).toBase58();
                    }
                    // distributed is the last 8 bytes
                    if (bytes.length >= 8) {
                        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        // distributed u64 at the end
                        amountLamports = Number(view.getBigUint64(bytes.length - 8, true));
                    }
                }

                // CollectCreatorFeeEvent: disc=7a027f010ebf0caf
                // Layout: disc(8) + timestamp(8) + creator(32) + creatorFee(8)
                if (disc === '7a027f010ebf0caf') {
                    if (bytes.length >= 56) {
                        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                        amountLamports = Number(view.getBigUint64(48, true));
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
                // Layout: disc(8) + timestamp(i64=8) + user_id(string: 4-byte LE len + N) + platform(u8) + social_fee_pda(32) + recipient(32) + social_claim_authority(32) + amount_claimed(u64=8) + ...
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

        // For social fee PDA claims, resolve mint from the index
        if (def.claimType === 'claim_social_fee_pda' && socialFeePda && !tokenMint) {
            tokenMint = this.socialFeeIndex.lookup(socialFeePda) ?? '';
        }

        return {
            txSignature: signature,
            slot,
            timestamp,
            claimerWallet: signerKey,
            tokenMint,
            amountSol: amountLamports / LAMPORTS_PER_SOL,
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

function maskRpcUrl(url: string): string {
    try {
        const u = new URL(url);
        return u.hostname;
    } catch {
        return url.slice(0, 30);
    }
}

