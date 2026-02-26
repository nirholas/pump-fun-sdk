/**
 * PumpFun Telegram Bot — Solana Fee Claim Monitor
 *
 * Connects to a Solana RPC node and monitors both PumpFun programs for
 * creator-fee and cashback claim transactions.
 *
 * Two modes:
 *   1. WebSocket (onLogs) — real-time, requires a WS-capable RPC
 *   2. HTTP polling (getSignaturesForAddress) — fallback every N seconds
 *
 * When a claim transaction is detected, the `onClaim` callback is invoked
 * with a fully-populated `FeeClaimEvent`.
 */

import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    type Logs,
    type SignaturesForAddressOptions,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { log } from './logger.js';
import type { BotConfig, ClaimType, FeeClaimEvent, MonitorState } from './types.js';
import {
    CLAIM_INSTRUCTIONS,
    CLAIM_EVENT_DISCRIMINATORS,
    MONITORED_PROGRAM_IDS,
    PUMPFUN_FEE_ACCOUNT,
    PUMPFUN_MIGRATION_AUTHORITY,
    PUMP_PROGRAM_ID,
    PUMP_AMM_PROGRAM_ID,
    type InstructionDef,
} from './types.js';

// ============================================================================
// Monitor Class
// ============================================================================

export class PumpFunMonitor {
    private connection: Connection;
    private wsConnection?: Connection;
    private config: BotConfig;
    private state: MonitorState;
    private onClaim: (event: FeeClaimEvent) => void;
    private pollTimer?: ReturnType<typeof setInterval>;
    private wsSubscriptionIds: number[] = [];
    private lastSignatures: Map<string, string | undefined> = new Map();
    private programPubkeys: PublicKey[];
    /** Track processed signatures to avoid duplicate notifications */
    private processedSignatures = new Set<string>();
    private readonly MAX_PROCESSED_CACHE = 10_000;

    constructor(config: BotConfig, onClaim: (event: FeeClaimEvent) => void) {
        this.config = config;
        this.onClaim = onClaim;
        this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
        this.programPubkeys = MONITORED_PROGRAM_IDS.map((id) => new PublicKey(id));

        this.state = {
            cashbackClaims: 0,
            claimsDetected: 0,
            creatorFeeClaims: 0,
            isRunning: false,
            lastSlot: 0,
            mode: 'polling',
            monitoredPrograms: [...MONITORED_PROGRAM_IDS],
            startedAt: 0,
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────

    getState(): MonitorState {
        return { ...this.state };
    }

    async start(): Promise<void> {
        if (this.state.isRunning) {
            log.warn('Monitor already running');
            return;
        }

        this.state.isRunning = true;
        this.state.startedAt = Date.now();

        log.info(
            'Monitoring %d programs: %s',
            MONITORED_PROGRAM_IDS.length,
            MONITORED_PROGRAM_IDS.map((p) => p.slice(0, 6) + '...').join(', '),
        );

        // Try WebSocket first
        if (this.config.solanaWsUrl) {
            try {
                await this.startWebSocket();
                this.state.mode = 'websocket';
                log.info('Monitor started in WebSocket mode');
                return;
            } catch (err) {
                log.warn('WebSocket connection failed, falling back to polling:', err);
            }
        }

        // Fallback to HTTP polling
        this.startPolling();
        this.state.mode = 'polling';
        log.info(
            'Monitor started in polling mode (every %ds)',
            this.config.pollIntervalSeconds,
        );
    }

    stop(): void {
        this.state.isRunning = false;

        // Remove all WebSocket subscriptions
        if (this.wsConnection) {
            for (const subId of this.wsSubscriptionIds) {
                this.wsConnection
                    .removeOnLogsListener(subId)
                    .catch(() => { });
            }
            this.wsSubscriptionIds = [];
        }

        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }

        log.info('Monitor stopped');
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

        // Subscribe to logs for EACH monitored program
        for (const pubkey of this.programPubkeys) {
            const subId = this.wsConnection.onLogs(
                pubkey,
                async (logInfo: Logs) => {
                    try {
                        await this.handleLogEvent(logInfo);
                    } catch (err) {
                        log.error('Error handling log event:', err);
                    }
                },
                'confirmed',
            );
            this.wsSubscriptionIds.push(subId);
            log.debug(
                'WebSocket subscription for %s: id=%d',
                pubkey.toBase58().slice(0, 8),
                subId,
            );
        }
    }

    private async handleLogEvent(logInfo: Logs): Promise<void> {
        const { signature, logs, err } = logInfo;

        // Skip failed transactions
        if (err) return;

        // Skip already-processed signatures
        if (this.processedSignatures.has(signature)) return;

        // Quick check: do the logs contain known event discriminators or keywords?
        const logsJoined = logs.join('\n');

        // Check for Anchor event discriminators in Program data logs
        let hasEventMatch = false;
        for (const discriminator of Object.keys(CLAIM_EVENT_DISCRIMINATORS)) {
            if (logsJoined.includes(discriminator)) {
                hasEventMatch = true;
                break;
            }
        }

        // Also check for keyword hints
        const hasKeywordMatch =
            logsJoined.includes('Withdraw') ||
            logsJoined.includes('ClaimFees') ||
            logsJoined.includes('ClaimCashback') ||
            logsJoined.includes('collect_creator_fee') ||
            logsJoined.includes('claim_cashback') ||
            logsJoined.includes('distribute_creator_fees') ||
            logsJoined.includes('collect_coin_creator_fee') ||
            logsJoined.includes('transfer_creator_fees') ||
            logsJoined.includes('Transfer');

        if (!hasEventMatch && !hasKeywordMatch) return;

        log.debug('Potential claim tx detected via WS: %s', signature);
        await this.processTransaction(signature);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Polling Mode
    // ──────────────────────────────────────────────────────────────────────

    private startPolling(): void {
        // Initial poll
        this.poll().catch((err) => log.error('Initial poll failed:', err));

        this.pollTimer = setInterval(() => {
            this.poll().catch((err) => log.error('Poll error:', err));
        }, this.config.pollIntervalSeconds * 1000);
    }

    private async poll(): Promise<void> {
        log.debug('Polling for new PumpFun transactions...');

        // Poll each monitored program
        for (const pubkey of this.programPubkeys) {
            const programId = pubkey.toBase58();
            await this.pollProgram(pubkey, programId);
        }
    }

    private async pollProgram(pubkey: PublicKey, programId: string): Promise<void> {
        const opts: SignaturesForAddressOptions = {
            limit: 50,
        };

        const lastSig = this.lastSignatures.get(programId);
        if (lastSig) {
            opts.until = lastSig;
        }

        try {
            const signatures = await this.connection.getSignaturesForAddress(
                pubkey,
                opts,
                'confirmed',
            );

            if (signatures.length === 0) {
                log.debug('No new transactions for %s', programId.slice(0, 8));
                return;
            }

            // Process from oldest to newest
            const ordered = signatures.reverse();
            this.lastSignatures.set(programId, signatures[0].signature); // newest

            for (const sig of ordered) {
                if (sig.err) continue;
                if (this.processedSignatures.has(sig.signature)) continue;
                await this.processTransaction(sig.signature);
            }

            log.debug(
                'Processed %d transactions for %s',
                ordered.length,
                programId.slice(0, 8),
            );
        } catch (err) {
            log.error('Error fetching signatures for %s:', programId.slice(0, 8), err);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Transaction Parser
    // ──────────────────────────────────────────────────────────────────────

    private async processTransaction(signature: string): Promise<void> {
        // Mark as processed to prevent duplicates
        this.markProcessed(signature);

        try {
            const tx = await this.connection.getParsedTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });

            if (!tx || !tx.meta) return;

            const events = this.extractFeeClaimEvents(signature, tx);
            for (const event of events) {
                this.state.claimsDetected++;
                if (event.isCashback) {
                    this.state.cashbackClaims++;
                } else {
                    this.state.creatorFeeClaims++;
                }
                this.state.lastSlot = tx.slot;

                log.info(
                    '%s: %s claimed %.4f SOL [%s] (tx: %s)',
                    event.claimLabel,
                    event.claimerWallet.slice(0, 8),
                    event.amountSol,
                    event.claimType,
                    signature.slice(0, 12) + '...',
                );

                this.onClaim(event);
            }
        } catch (err) {
            log.error('Error processing tx %s:', signature, err);
        }
    }

    /**
     * Extract fee claim events from a parsed transaction.
     *
     * Strategy:
     * 1. Match instruction data against known Anchor discriminators
     * 2. Check Program Data logs for event discriminators
     * 3. Check inner instructions for SOL transfers from PumpFun accounts
     * 4. Fall back to pre/post balance heuristics
     *
     * Returns an array because a single tx could theoretically contain
     * multiple claim instructions (e.g. batch claims).
     */
    private extractFeeClaimEvents(
        signature: string,
        tx: import('@solana/web3.js').ParsedTransactionWithMeta,
    ): FeeClaimEvent[] {
        const { meta, transaction, slot, blockTime } = tx;
        if (!meta) return [];

        const accountKeys = transaction.message.accountKeys.map((k) =>
            typeof k === 'string' ? k : k.pubkey.toBase58(),
        );

        const events: FeeClaimEvent[] = [];

        // ── Strategy A: Match instruction data discriminators ────────────
        for (const ix of transaction.message.instructions) {
            if ('data' in ix && 'programId' in ix) {
                const programId =
                    typeof ix.programId === 'string'
                        ? ix.programId
                        : ix.programId.toBase58();

                // Only check our monitored programs
                if (
                    programId !== PUMP_PROGRAM_ID &&
                    programId !== PUMP_AMM_PROGRAM_ID
                ) {
                    continue;
                }

                const matchedDef = this.matchInstructionDiscriminator(
                    (ix as { data: string }).data,
                    programId,
                );

                if (matchedDef) {
                    const event = this.buildEventFromBalanceChanges(
                        signature,
                        slot,
                        blockTime ?? null,
                        meta,
                        accountKeys,
                        matchedDef,
                    );
                    if (event) events.push(event);
                }
            }
        }

        // If we found events via discriminator matching, return them
        if (events.length > 0) return events;

        // ── Strategy B: Check Program Data logs for event discriminators ─
        if (meta.logMessages) {
            for (const logMsg of meta.logMessages) {
                if (!logMsg.startsWith('Program data: ')) continue;
                const dataB64 = logMsg.slice('Program data: '.length);
                try {
                    const bytes = Buffer.from(dataB64, 'base64');
                    if (bytes.length < 8) continue;
                    const hex = bytes.subarray(0, 8).toString('hex');
                    const eventDef = CLAIM_EVENT_DISCRIMINATORS[hex];
                    if (eventDef) {
                        // We found a claim event in the logs
                        const claimType: ClaimType = eventDef.isCreatorClaim
                            ? 'collect_creator_fee'
                            : 'claim_cashback';

                        const synthDef: InstructionDef = {
                            claimType,
                            discriminator: hex,
                            isCreatorClaim: eventDef.isCreatorClaim,
                            label: eventDef.label,
                            programId: PUMP_PROGRAM_ID,
                        };

                        const event = this.buildEventFromBalanceChanges(
                            signature,
                            slot,
                            blockTime ?? null,
                            meta,
                            accountKeys,
                            synthDef,
                        );
                        if (event) events.push(event);
                    }
                } catch {
                    // Skip unparseable log data
                }
            }
        }

        if (events.length > 0) return events;

        // ── Strategy C: Check inner instructions for SOL transfers ───────
        if (meta.innerInstructions) {
            for (const inner of meta.innerInstructions) {
                for (const ix of inner.instructions) {
                    if ('parsed' in ix && ix.parsed?.type === 'transfer') {
                        const info = ix.parsed.info;
                        if (info && typeof info.lamports === 'number' && info.lamports > 0) {
                            const sourceProgramOwned = this.isPumpFunAccount(info.source);
                            if (sourceProgramOwned && info.lamports > 5000) {
                                events.push({
                                    amountLamports: info.lamports,
                                    amountSol: info.lamports / LAMPORTS_PER_SOL,
                                    claimLabel: 'Fee Claim (heuristic)',
                                    claimType: 'collect_creator_fee',
                                    claimerWallet: info.destination,
                                    isCashback: false,
                                    programId: PUMP_PROGRAM_ID,
                                    slot,
                                    timestamp: blockTime || Math.floor(Date.now() / 1000),
                                    tokenMint: this.findTokenMint(accountKeys) || '',
                                    txSignature: signature,
                                });
                            }
                        }
                    }
                }
            }
        }

        if (events.length > 0) return events;

        // ── Strategy D: Balance-change heuristic (last resort) ──────────
        const fallback = this.buildEventFromBalanceChanges(
            signature,
            slot,
            blockTime ?? null,
            meta,
            accountKeys,
            null,
        );
        if (fallback) return [fallback];

        return [];
    }

    private buildEventFromBalanceChanges(
        signature: string,
        slot: number,
        blockTime: number | null,
        meta: import('@solana/web3.js').ParsedTransactionMeta,
        accountKeys: string[],
        matchedDef: InstructionDef | null,
    ): FeeClaimEvent | null {
        if (!meta.preBalances || !meta.postBalances) return null;

        // Find the account that received the largest SOL increase
        // (excluding the fee payer who likely lost SOL for tx fees)
        let bestIdx = -1;
        let bestDelta = 0;

        const monitoredSet = new Set<string>(MONITORED_PROGRAM_IDS);

        for (let i = 0; i < accountKeys.length; i++) {
            const delta = meta.postBalances[i] - meta.preBalances[i];
            // Skip the fee payer (index 0) and the programs themselves
            if (i === 0) continue;
            if (monitoredSet.has(accountKeys[i])) continue;
            if (accountKeys[i] === PUMPFUN_FEE_ACCOUNT) continue;
            if (accountKeys[i] === PUMPFUN_MIGRATION_AUTHORITY) continue;

            if (delta > bestDelta) {
                bestDelta = delta;
                bestIdx = i;
            }
        }

        // Minimum threshold: 0.001 SOL (1_000_000 lamports)
        if (bestIdx < 0 || bestDelta < 1_000_000) return null;

        const isCashback = matchedDef ? !matchedDef.isCreatorClaim : false;
        const claimType: ClaimType = matchedDef?.claimType ?? (isCashback ? 'claim_cashback' : 'collect_creator_fee');
        const programId = matchedDef?.programId ?? PUMP_PROGRAM_ID;
        const claimLabel = matchedDef?.label ?? (isCashback ? 'Cashback Claim' : 'Creator Fee Claim');

        return {
            amountLamports: bestDelta,
            amountSol: bestDelta / LAMPORTS_PER_SOL,
            claimLabel,
            claimType,
            claimerWallet: accountKeys[bestIdx],
            isCashback,
            programId,
            slot,
            timestamp: blockTime || Math.floor(Date.now() / 1000),
            tokenMint: this.findTokenMint(accountKeys) || '',
            txSignature: signature,
        };
    }

    /**
     * Match base58-encoded instruction data against known claim discriminators.
     *
     * Returns the matched InstructionDef or null.
     */
    private matchInstructionDiscriminator(
        dataBase58: string,
        programId: string,
    ): InstructionDef | null {
        try {
            const bytes = bs58.decode(dataBase58);
            if (bytes.length < 8) return null;

            const hexPrefix = Buffer.from(bytes.slice(0, 8)).toString('hex');

            // Match against all known claim instructions for this program
            for (const def of CLAIM_INSTRUCTIONS) {
                if (def.programId === programId && def.discriminator === hexPrefix) {
                    return def;
                }
            }

            return null;
        } catch {
            return null;
        }
    }

    /** Check if an address is likely owned by the PumpFun program. */
    private isPumpFunAccount(address: string): boolean {
        return (
            address === PUMP_PROGRAM_ID ||
            address === PUMP_AMM_PROGRAM_ID ||
            address === PUMPFUN_FEE_ACCOUNT ||
            address === PUMPFUN_MIGRATION_AUTHORITY
        );
    }

    /**
     * Attempt to find a token mint address among the transaction accounts.
     * Token mints are SPL Token accounts that aren't well-known system programs.
     */
    private findTokenMint(accountKeys: string[]): string | undefined {
        const SYSTEM_PROGRAMS = new Set([
            '11111111111111111111111111111111',
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',   // SPL Token
            'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',  // ATA
            'SysvarRent111111111111111111111111111111111',
            'SysvarC1ock11111111111111111111111111111111',
            'ComputeBudget111111111111111111111111111111',
            PUMP_PROGRAM_ID,
            PUMP_AMM_PROGRAM_ID,
            PUMPFUN_FEE_ACCOUNT,
            PUMPFUN_MIGRATION_AUTHORITY,
        ]);

        for (let i = 1; i < accountKeys.length; i++) {
            const key = accountKeys[i];
            if (!SYSTEM_PROGRAMS.has(key) && key.length >= 32) {
                return key;
            }
        }
        return undefined;
    }

    /** Track processed signatures, evicting oldest when cache is full. */
    private markProcessed(signature: string): void {
        this.processedSignatures.add(signature);
        if (this.processedSignatures.size > this.MAX_PROCESSED_CACHE) {
            // Evict oldest entries (Set iteration order = insertion order)
            const it = this.processedSignatures.values();
            for (let i = 0; i < 1000; i++) {
                const val = it.next();
                if (val.done) break;
                this.processedSignatures.delete(val.value);
            }
        }
    }
}
