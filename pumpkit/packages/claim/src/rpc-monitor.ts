/**
 * PumpFun Claim Bot — Direct Solana RPC Monitor
 *
 * Monitors Pump/PumpSwap/PumpFees programs directly via Solana RPC.
 * Uses WebSocket log subscriptions when available, falls back to HTTP polling.
 * No relay server needed — runs standalone on Railway.
 */

import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    type Logs,
    type SignaturesForAddressOptions,
} from '@solana/web3.js';

import type { BotConfig, ClaimType, FeeClaimEvent, InstructionDef } from './types.js';
import {
    CLAIM_EVENT_DISCRIMINATORS,
    CLAIM_INSTRUCTIONS,
    MONITORED_PROGRAM_IDS,
    PUMPFUN_FEE_ACCOUNT,
} from './types.js';
import { log } from './logger.js';

// Known system accounts to skip when looking for token mint
const SYSTEM_ACCOUNTS = new Set([
    '11111111111111111111111111111111',
    'SysvarRent111111111111111111111111111111111',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    'So11111111111111111111111111111111111111112',
    PUMPFUN_FEE_ACCOUNT,
    ...MONITORED_PROGRAM_IDS,
]);

// ── Rate-limited Queue ──────────────────────────────────────────────

const MAX_QUEUE = 50;
const MIN_INTERVAL_MS = 1_000;

class TxQueue {
    private queue: string[] = [];
    private processing = false;
    private lastTime = 0;
    constructor(private processFn: (sig: string) => Promise<void>) {}

    enqueue(sig: string): void {
        if (this.queue.length >= MAX_QUEUE) return;
        this.queue.push(sig);
        void this.drain();
    }

    private async drain(): Promise<void> {
        if (this.processing) return;
        this.processing = true;
        while (this.queue.length > 0) {
            const elapsed = Date.now() - this.lastTime;
            if (elapsed < MIN_INTERVAL_MS) {
                await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
            }
            const sig = this.queue.shift();
            if (!sig) break;
            this.lastTime = Date.now();
            try {
                await this.processFn(sig);
            } catch (e) {
                log.error('Queue error: %s', e instanceof Error ? e.message : e);
            }
        }
        this.processing = false;
    }
}

// ============================================================================
// RpcClaimMonitor
// ============================================================================

export class RpcClaimMonitor {
    private connection: Connection;
    private wsSubscriptionIds: number[] = [];
    private pollTimer?: ReturnType<typeof setInterval>;
    private lastSignatures = new Map<string, string | undefined>();
    private processedSigs = new Set<string>();
    private txQueue: TxQueue;
    private alive = false;
    private startedAt = 0;
    private connected = false;
    private pollIntervalMs: number;

    public claimsDetected = 0;

    constructor(
        private config: BotConfig,
        private onClaim: (event: FeeClaimEvent) => void,
    ) {
        this.connection = new Connection(config.solanaRpcUrl!, {
            commitment: 'confirmed',
            disableRetryOnRateLimit: true,
        });
        this.pollIntervalMs = (config.pollIntervalSeconds ?? 15) * 1000;
        this.txQueue = new TxQueue((sig) => this.processTransaction(sig));
    }

    async start(): Promise<void> {
        if (this.alive) return;
        this.alive = true;
        this.startedAt = Date.now();

        log.info('Starting RPC claim monitor (%d programs)', MONITORED_PROGRAM_IDS.length);
        log.info('  RPC: %s', this.config.solanaRpcUrl!.replace(/api-key=[\w-]+/, 'api-key=***'));

        if (this.config.solanaWsUrl) {
            try {
                this.startWebSocket();
                log.info('RPC monitor: WebSocket mode');
                return;
            } catch (err) {
                log.warn('WS failed, falling back to polling: %s', err);
            }
        }

        this.startPolling();
        log.info('RPC monitor: Polling mode (every %ds)', this.pollIntervalMs / 1000);
    }

    stop(): void {
        this.alive = false;
        for (const id of this.wsSubscriptionIds) {
            this.connection.removeOnLogsListener(id).catch(() => {});
        }
        this.wsSubscriptionIds = [];
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
        log.info('RPC claim monitor stopped');
    }

    getMode(): string {
        if (!this.connected) return 'rpc (disconnected)';
        return this.config.solanaWsUrl ? 'rpc-ws (connected)' : 'rpc-poll (connected)';
    }

    getUptimeMs(): number {
        return this.startedAt ? Date.now() - this.startedAt : 0;
    }

    // ── WebSocket subscription ──────────────────────────────────────

    private startWebSocket(): void {
        const wsConn = new Connection(this.config.solanaRpcUrl!, {
            commitment: 'confirmed',
            wsEndpoint: this.config.solanaWsUrl,
        });

        const programPubkeys = MONITORED_PROGRAM_IDS.map((id) => new PublicKey(id));

        for (const programId of programPubkeys) {
            const subId = wsConn.onLogs(
                programId,
                (logInfo: Logs) => {
                    if (logInfo.err) return;
                    const sig = logInfo.signature;
                    if (this.processedSigs.has(sig)) return;

                    const logsStr = logInfo.logs.join(' ');
                    const hasClaimIx = CLAIM_INSTRUCTIONS.some((def) =>
                        logsStr.includes(def.discriminator),
                    );
                    const hasClaimEvent = Object.keys(CLAIM_EVENT_DISCRIMINATORS).some((disc) =>
                        logsStr.includes(disc),
                    );

                    if (hasClaimIx || hasClaimEvent) {
                        this.txQueue.enqueue(sig);
                    }
                },
                'confirmed',
            );
            this.wsSubscriptionIds.push(subId);
        }

        this.connected = true;
        log.info('Connected to Solana WebSocket');
    }

    // ── HTTP Polling ────────────────────────────────────────────────

    private startPolling(): void {
        setTimeout(() => void this.pollAll(), 2000);
        this.pollTimer = setInterval(() => void this.pollAll(), this.pollIntervalMs);
        this.connected = true;
    }

    private async pollAll(): Promise<void> {
        const programPubkeys = MONITORED_PROGRAM_IDS.map((id) => new PublicKey(id));
        for (const programId of programPubkeys) {
            try {
                await this.pollProgram(programId);
            } catch {
                // silent
            }
            await new Promise((r) => setTimeout(r, 500));
        }
    }

    private async pollProgram(programId: PublicKey): Promise<void> {
        const key = programId.toBase58();
        const opts: SignaturesForAddressOptions = { limit: 20 };
        const lastSig = this.lastSignatures.get(key);
        if (lastSig) opts.until = lastSig;

        const sigs = await this.connection.getSignaturesForAddress(programId, opts);
        if (sigs.length === 0) return;

        const newest = sigs[0];
        if (newest) this.lastSignatures.set(key, newest.signature);

        for (const info of sigs) {
            if (info.err) continue;
            if (this.processedSigs.has(info.signature)) continue;
            this.txQueue.enqueue(info.signature);
        }
    }

    // ── Transaction processing ──────────────────────────────────────

    private async processTransaction(signature: string): Promise<void> {
        if (this.processedSigs.has(signature)) return;
        this.processedSigs.add(signature);

        // Evict old entries
        if (this.processedSigs.size > 10_000) {
            const arr = [...this.processedSigs];
            this.processedSigs = new Set(arr.slice(-5000));
        }

        const tx = await this.connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta || tx.meta.err) return;

        const message = tx.transaction.message;
        const accountKeys = message.getAccountKeys({
            accountKeysFromLookups: tx.meta.loadedAddresses,
        });

        for (const ix of message.compiledInstructions) {
            const programKey = accountKeys.get(ix.programIdIndex);
            if (!programKey) continue;
            const pid = programKey.toBase58();

            if (!MONITORED_PROGRAM_IDS.includes(pid as (typeof MONITORED_PROGRAM_IDS)[number]))
                continue;

            const dataHex = Buffer.from(ix.data).toString('hex');
            const disc8 = dataHex.slice(0, 16);

            const matched = CLAIM_INSTRUCTIONS.find(
                (def) => def.discriminator === disc8 && def.programId === pid,
            );
            if (!matched) continue;

            const event = this.extractClaim(signature, tx, matched, accountKeys);
            if (event) {
                this.claimsDetected++;
                log.info(
                    'Claim: %s %.4f SOL (%s)',
                    event.claimType,
                    event.amountSol,
                    event.tokenMint.slice(0, 8),
                );
                this.onClaim(event);
            }
        }
    }

    private extractClaim(
        signature: string,
        tx: Exclude<Awaited<ReturnType<Connection['getTransaction']>>, null>,
        def: InstructionDef,
        accountKeys: { get(i: number): PublicKey | undefined; length: number },
    ): FeeClaimEvent | null {
        const meta = tx.meta!;
        const blockTime = tx.blockTime ?? Math.floor(Date.now() / 1000);
        const { preBalances, postBalances } = meta;

        const signerKey = accountKeys.get(0);
        if (!signerKey) return null;
        const claimerWallet = signerKey.toBase58();

        // Determine amount from fee account balance decrease
        let amountLamports = 0;
        const feeIdx = this.findIndex(accountKeys, PUMPFUN_FEE_ACCOUNT);
        if (
            feeIdx >= 0 &&
            preBalances[feeIdx] !== undefined &&
            postBalances[feeIdx] !== undefined
        ) {
            amountLamports = preBalances[feeIdx]! - postBalances[feeIdx]!;
        }
        // Fallback: signer's balance increase + tx fee
        if (
            amountLamports <= 0 &&
            preBalances[0] !== undefined &&
            postBalances[0] !== undefined
        ) {
            amountLamports = postBalances[0]! - preBalances[0]! + meta.fee;
        }
        if (amountLamports <= 0) amountLamports = 0;

        // Find token mint (first non-system account)
        let tokenMint = '';
        for (let i = 0; i < accountKeys.length; i++) {
            const key = accountKeys.get(i);
            if (!key) continue;
            const addr = key.toBase58();
            if (addr === claimerWallet || SYSTEM_ACCOUNTS.has(addr)) continue;
            tokenMint = addr;
            break;
        }

        return {
            txSignature: signature,
            slot: tx.slot,
            timestamp: blockTime,
            claimerWallet,
            tokenMint,
            amountSol: amountLamports / LAMPORTS_PER_SOL,
            amountLamports,
            claimType: def.claimType,
            isCashback: def.claimType === 'claim_cashback',
            programId: def.programId,
            claimLabel: def.label,
        };
    }

    private findIndex(
        keys: { get(i: number): PublicKey | undefined; length: number },
        target: string,
    ): number {
        for (let i = 0; i < keys.length; i++) {
            if (keys.get(i)?.toBase58() === target) return i;
        }
        return -1;
    }
}
