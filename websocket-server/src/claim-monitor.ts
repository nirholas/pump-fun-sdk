// ════════════════════════════════════════════════════════════════════
// Claim Monitor — Watches Pump programs for fee claim transactions
//
// Strategy:
//   1. Subscribe via WebSocket to Pump/PumpSwap/PumpFees program logs
//   2. When a claim instruction is detected, fetch the full transaction
//   3. Parse balance changes to determine claim amount
//   4. Emit FeeClaimEvent for the relay to broadcast
//
// Falls back to HTTP polling if WebSocket is unavailable.
// ════════════════════════════════════════════════════════════════════

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  type Logs,
  type SignaturesForAddressOptions,
} from '@solana/web3.js';
import type { FeeClaimEvent, ClaimType } from './types.js';

// ── Program IDs ─────────────────────────────────────────────────────

const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const PUMP_FEE_PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';
const MONITORED_PROGRAM_IDS = [PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, PUMP_FEE_PROGRAM_ID] as const;

const PUMPFUN_FEE_ACCOUNT = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJ5GEFDM97zC';

// ── Instruction Discriminators ──────────────────────────────────────

interface InstructionDef {
  discriminator: string;
  label: string;
  claimType: ClaimType;
  programId: string;
}

const CLAIM_INSTRUCTIONS: InstructionDef[] = [
  { claimType: 'collect_creator_fee', discriminator: '1416567bc61cdb84', label: 'Collect Creator Fee (Pump)', programId: PUMP_PROGRAM_ID },
  { claimType: 'claim_cashback', discriminator: '253a237ebe35e4c5', label: 'Claim Cashback (Pump)', programId: PUMP_PROGRAM_ID },
  { claimType: 'distribute_creator_fees', discriminator: 'a572670079cef751', label: 'Distribute Creator Fees (Pump)', programId: PUMP_PROGRAM_ID },
  { claimType: 'collect_coin_creator_fee', discriminator: 'a039592ab58b2b42', label: 'Collect Creator Fee (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
  { claimType: 'claim_cashback', discriminator: '253a237ebe35e4c5', label: 'Claim Cashback (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
  { claimType: 'transfer_creator_fees_to_pump', discriminator: '8b348655e4e56cf1', label: 'Transfer Creator Fees to Pump', programId: PUMP_AMM_PROGRAM_ID },
  { claimType: 'claim_social_fee_pda', discriminator: 'e115fb85a11ec7e2', label: 'Claim Social Fee PDA', programId: PUMP_FEE_PROGRAM_ID },
];

const CLAIM_EVENT_DISCRIMINATORS: Record<string, string> = {
  '7a027f010ebf0caf': 'CollectCreatorFeeEvent',
  'a537817004b3ca28': 'DistributeCreatorFeesEvent',
  'e2d6f62107f293e5': 'ClaimCashbackEvent',
  'e8f5c2eeeada3a59': 'CollectCoinCreatorFeeEvent',
  '3212c141edd2eaec': 'SocialFeePdaClaimed',
};

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
    this.drain();
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const elapsed = Date.now() - this.lastTime;
      if (elapsed < MIN_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
      }
      const sig = this.queue.shift();
      if (!sig) break;
      this.lastTime = Date.now();
      try { await this.processFn(sig); } catch (e) {
        console.error(`[claims] Queue error: ${e instanceof Error ? e.message : e}`);
      }
    }
    this.processing = false;
  }
}

// ════════════════════════════════════════════════════════════════════
// ClaimMonitor
// ════════════════════════════════════════════════════════════════════

export class ClaimMonitor {
  private connection: Connection;
  private wsSubscriptionIds: number[] = [];
  private pollTimer?: ReturnType<typeof setInterval>;
  private lastSignatures = new Map<string, string | undefined>();
  private processedSigs = new Set<string>();
  private txQueue: TxQueue;
  private alive = false;

  public connected = false;
  public stats = { totalClaims: 0 };

  constructor(
    private rpcUrl: string,
    private wsUrl: string | undefined,
    private pollIntervalMs: number,
    private onClaim: (event: FeeClaimEvent) => void,
    private onStatusChange: (connected: boolean) => void,
  ) {
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
    });
    this.txQueue = new TxQueue(sig => this.processTransaction(sig));
  }

  start(): void {
    this.alive = true;
    console.log(`[claims] Starting claim monitor (${MONITORED_PROGRAM_IDS.length} programs)`);

    if (this.wsUrl) {
      try {
        this.startWebSocket();
        console.log('[claims] WebSocket mode');
        return;
      } catch (err) {
        console.warn(`[claims] WS failed, falling back to polling: ${err}`);
      }
    }

    this.startPolling();
    console.log(`[claims] Polling mode (every ${this.pollIntervalMs / 1000}s)`);
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
    console.log('[claims] Stopped');
  }

  // ── WebSocket subscription ────────────────────────────────────────

  private startWebSocket(): void {
    const wsConn = new Connection(this.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: this.wsUrl,
    });

    const programPubkeys = MONITORED_PROGRAM_IDS.map(id => new PublicKey(id));

    for (const programId of programPubkeys) {
      const subId = wsConn.onLogs(
        programId,
        (logInfo: Logs) => {
          if (logInfo.err) return;
          const sig = logInfo.signature;
          if (this.processedSigs.has(sig)) return;

          const logsStr = logInfo.logs.join(' ');
          const hasClaimIx = CLAIM_INSTRUCTIONS.some(
            def => logsStr.includes(def.discriminator),
          );
          const hasClaimEvent = Object.keys(CLAIM_EVENT_DISCRIMINATORS).some(
            disc => logsStr.includes(disc),
          );

          if (hasClaimIx || hasClaimEvent) {
            this.txQueue.enqueue(sig);
          }
        },
        'confirmed',
      );
      this.wsSubscriptionIds.push(subId);
    }

    if (!this.connected) {
      this.connected = true;
      this.onStatusChange(true);
    }
  }

  // ── HTTP Polling ──────────────────────────────────────────────────

  private startPolling(): void {
    setTimeout(() => this.pollAll(), 2000);
    this.pollTimer = setInterval(() => this.pollAll(), this.pollIntervalMs);
    if (!this.connected) {
      this.connected = true;
      this.onStatusChange(true);
    }
  }

  private async pollAll(): Promise<void> {
    const programPubkeys = MONITORED_PROGRAM_IDS.map(id => new PublicKey(id));
    for (const programId of programPubkeys) {
      try {
        await this.pollProgram(programId);
      } catch (err) {
        // silent — logged at debug level in production
      }
      await new Promise(r => setTimeout(r, 500));
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

  // ── Transaction processing ────────────────────────────────────────

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

      if (!MONITORED_PROGRAM_IDS.includes(pid as typeof MONITORED_PROGRAM_IDS[number])) continue;

      const dataHex = Buffer.from(ix.data).toString('hex');
      const disc8 = dataHex.slice(0, 16);

      const matched = CLAIM_INSTRUCTIONS.find(
        def => def.discriminator === disc8 && def.programId === pid,
      );
      if (!matched) continue;

      const event = this.extractClaim(signature, tx, matched, accountKeys);
      if (event) {
        this.stats.totalClaims++;
        console.log(`[claims] ${event.claimType} ${event.amountSol.toFixed(4)} SOL (${event.tokenMint.slice(0, 8)}…)`);
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
    if (feeIdx >= 0 && preBalances[feeIdx] !== undefined && postBalances[feeIdx] !== undefined) {
      amountLamports = (preBalances[feeIdx]!) - (postBalances[feeIdx]!);
    }
    // Fallback: signer's balance increase + tx fee
    if (amountLamports <= 0 && preBalances[0] !== undefined && postBalances[0] !== undefined) {
      amountLamports = (postBalances[0]!) - (preBalances[0]!) + meta.fee;
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
      type: 'fee-claim',
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
