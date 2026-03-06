/**
 * PumpFun Claim Bot — WebSocket Relay Client
 *
 * Connects to the PumpFun WebSocket relay server and listens for
 * fee-claim events. No direct Solana RPC connection needed — the relay
 * handles all on-chain monitoring and broadcasts parsed events.
 *
 * Auto-reconnects on disconnect with exponential backoff.
 */

import WebSocket from 'ws';

import type { BotConfig, FeeClaimEvent } from './types.js';
import { log } from './logger.js';

// ============================================================================
// Relay message types (subset — we only care about fee-claim and status)
// ============================================================================

interface RelayFeeClaimMessage {
    type: 'fee-claim';
    txSignature: string;
    slot: number;
    timestamp: number;
    claimerWallet: string;
    tokenMint: string;
    tokenName?: string;
    tokenSymbol?: string;
    amountSol: number;
    amountLamports: number;
    claimType: string;
    isCashback: boolean;
    programId: string;
    claimLabel: string;
}

interface RelayStatusMessage {
    type: 'status';
    connected: boolean;
    totalClaims: number;
    clients: number;
}

// ============================================================================
// Monitor
// ============================================================================

export class ClaimMonitor {
    private ws: WebSocket | null = null;
    private config: BotConfig;
    private onClaim: (event: FeeClaimEvent) => void;
    private reconnectDelay = 1000;
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private alive = false;
    private startedAt = 0;
    public claimsDetected = 0;
    private connected = false;

    constructor(config: BotConfig, onClaim: (event: FeeClaimEvent) => void) {
        this.config = config;
        this.onClaim = onClaim;
    }

    async start(): Promise<void> {
        if (this.alive) return;
        this.alive = true;
        this.startedAt = Date.now();

        log.info('Connecting to relay: %s', this.config.relayWsUrl);
        this.connect();
    }

    stop(): void {
        this.alive = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        log.info('Claim monitor stopped');
    }

    getMode(): string {
        return this.connected ? 'relay (connected)' : 'relay (disconnected)';
    }

    getUptimeMs(): number {
        return this.startedAt ? Date.now() - this.startedAt : 0;
    }

    // ── WebSocket connection ─────────────────────────────────────────

    private connect(): void {
        if (!this.alive) return;

        this.ws = new WebSocket(this.config.relayWsUrl);

        this.ws.on('open', () => {
            log.info('Connected to relay');
            this.connected = true;
            this.reconnectDelay = 1000;
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString()) as { type: string };

                if (msg.type === 'fee-claim') {
                    const claim = msg as RelayFeeClaimMessage;
                    const event: FeeClaimEvent = {
                        txSignature: claim.txSignature,
                        slot: claim.slot,
                        timestamp: claim.timestamp,
                        claimerWallet: claim.claimerWallet,
                        tokenMint: claim.tokenMint,
                        tokenName: claim.tokenName,
                        tokenSymbol: claim.tokenSymbol,
                        amountSol: claim.amountSol,
                        amountLamports: claim.amountLamports,
                        claimType: claim.claimType as FeeClaimEvent['claimType'],
                        isCashback: claim.isCashback,
                        programId: claim.programId,
                        claimLabel: claim.claimLabel,
                    };

                    this.claimsDetected++;
                    log.info('Relay claim: %s %.4f SOL (%s)',
                        event.claimType, event.amountSol, event.tokenMint.slice(0, 8));
                    this.onClaim(event);
                }
                // Ignore heartbeat, status, token-launch — we only care about claims
            } catch {
                // Ignore malformed messages
            }
        });

        this.ws.on('error', (err) => {
            log.warn('Relay WS error: %s', err.message);
        });

        this.ws.on('close', (code) => {
            log.warn('Relay disconnected (code=%d)', code);
            this.connected = false;
            this.ws = null;

            if (this.alive) {
                log.info('Reconnecting in %dms...', this.reconnectDelay);
                this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
            }
        });
    }
}

    private extractClaimEvent(
        signature: string,
        tx: Exclude<Awaited<ReturnType<Connection['getTransaction']>>, null>,
        def: typeof CLAIM_INSTRUCTIONS[number],
        accountKeys: ReturnType<typeof tx.transaction.message.getAccountKeys>,
    ): FeeClaimEvent | null {
        const meta = tx.meta!;
        const blockTime = tx.blockTime ?? Math.floor(Date.now() / 1000);

        // Calculate SOL transferred by looking at balance changes
        const preBalances = meta.preBalances;
        const postBalances = meta.postBalances;

        // The signer (index 0) is typically the claimer
        const signerKey = accountKeys.get(0);
        if (!signerKey) return null;
        const claimerWallet = signerKey.toBase58();

        // Find the fee account's balance change to determine amount
        let amountLamports = 0;
        const feeAccountIndex = this.findAccountIndex(accountKeys, PUMPFUN_FEE_ACCOUNT);

        if (feeAccountIndex >= 0 && preBalances[feeAccountIndex] !== undefined && postBalances[feeAccountIndex] !== undefined) {
            // Fee account's balance decreased = fees were claimed from it
            amountLamports = (preBalances[feeAccountIndex] ?? 0) - (postBalances[feeAccountIndex] ?? 0);
        }

        // If we couldn't find amount from fee account, use signer's balance increase
        if (amountLamports <= 0 && preBalances[0] !== undefined && postBalances[0] !== undefined) {
            amountLamports = (postBalances[0] ?? 0) - (preBalances[0] ?? 0);
            // Add back the tx fee the signer paid
            amountLamports += meta.fee;
        }

        if (amountLamports <= 0) amountLamports = 0;

        // Try to find the token mint from accounts and parse social fee data
        let tokenMint = '';
        let githubUserId: string | undefined;
        let socialPlatform: number | undefined;
        let recipientWallet: string | undefined;
        let socialFeePda: string | undefined;

        // Parse event logs for social fee claims
        if (def.claimType === 'claim_social_fee_pda') {
            const logMessages = meta.logMessages ?? [];
            for (const line of logMessages) {
                if (!line.includes('Program data:')) continue;
                const b64 = line.split('Program data: ')[1]?.trim();
                if (!b64) continue;
                try {
                    const bytes = Buffer.from(b64, 'base64');
                    const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');
                    // SocialFeePdaClaimed: disc=3212c141edd2eaec
                    if (disc === '3212c141edd2eaec') {
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
                        break;
                    }
                } catch { /* skip unparseable log lines */ }
            }
        }

        const numAccounts = accountKeys.length;
        for (let i = 0; i < numAccounts; i++) {
            const key = accountKeys.get(i);
            if (!key) continue;
            const addr = key.toBase58();
            // Skip known non-mint addresses
            if (addr === claimerWallet) continue;
            if (addr === PUMPFUN_FEE_ACCOUNT) continue;
            if (MONITORED_PROGRAM_IDS.includes(addr as typeof MONITORED_PROGRAM_IDS[number])) continue;
            if (addr === '11111111111111111111111111111111') continue;
            if (addr === 'SysvarRent111111111111111111111111111111111') continue;
            if (addr === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') continue;
            if (addr === 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') continue;
            if (addr === 'So11111111111111111111111111111111111111112') continue;
            // Use the first non-system account as potential mint
            if (!tokenMint) tokenMint = addr;
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
            githubUserId,
            socialPlatform,
            recipientWallet,
            socialFeePda,
        };
    }

    private findAccountIndex(
        accountKeys: { get(index: number): PublicKey | undefined; length: number },
        target: string,
    ): number {
        for (let i = 0; i < accountKeys.length; i++) {
            const key = accountKeys.get(i);
            if (key && key.toBase58() === target) return i;
        }
        return -1;
    }
}
