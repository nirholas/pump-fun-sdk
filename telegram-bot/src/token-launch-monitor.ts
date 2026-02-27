/**
 * PumpFun Telegram Bot — Token Launch Monitor
 *
 * Monitors the Pump program for new token creation (createV2) transactions.
 * Detects new launches in real-time via WebSocket or polling fallback.
 * Fetches token metadata and filters for GitHub-linked tokens.
 *
 * Two modes:
 *   1. WebSocket (onLogs) — real-time, requires a WS-capable RPC
 *   2. HTTP polling (getSignaturesForAddress) — fallback every N seconds
 *
 * When a token creation transaction is detected, the `onTokenLaunch` callback
 * is invoked with a fully-populated `TokenLaunchEvent`.
 */

import {
    Connection,
    PublicKey,
    type Logs,
    type SignaturesForAddressOptions,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { log } from './logger.js';
import type { BotConfig, TokenLaunchEvent, TokenLaunchMonitorState } from './types.js';
import {
    CREATE_V2_DISCRIMINATOR,
    CREATE_DISCRIMINATOR,
    PUMP_PROGRAM_ID,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Metadata fetch timeout in milliseconds */
const METADATA_FETCH_TIMEOUT_MS = 5_000;

/** Minimum interval between metadata fetches (ms) — rate limiter */
const METADATA_FETCH_INTERVAL_MS = 200;

/** Maximum consecutive WebSocket errors before falling back to polling */
const MAX_WS_ERRORS = 5;

/** WebSocket reconnection delay (ms) */
const WS_RECONNECT_DELAY_MS = 5_000;

/** GitHub URL detection pattern */
const GITHUB_URL_REGEX = /https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?/gi;

/** Well-known system programs to exclude when searching for the mint address */
const SYSTEM_PROGRAMS = new Set([
    '11111111111111111111111111111111',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',   // SPL Token
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',   // Token-2022
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',  // ATA
    'SysvarRent111111111111111111111111111111111',
    'SysvarC1ock11111111111111111111111111111111',
    'ComputeBudget111111111111111111111111111111',
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',   // Token Metadata
    PUMP_PROGRAM_ID,
]);

// ============================================================================
// Token Launch Monitor Class
// ============================================================================

export class TokenLaunchMonitor {
    private connection: Connection;
    private wsConnection?: Connection;
    private config: BotConfig;
    private state: TokenLaunchMonitorState;
    private onTokenLaunch: (event: TokenLaunchEvent) => void;
    private pollTimer?: ReturnType<typeof setInterval>;
    private wsSubscriptionId?: number;
    private lastSignature: string | undefined;
    private programPubkey: PublicKey;
    /** Track processed signatures to avoid duplicate notifications */
    private processedSignatures = new Set<string>();
    private readonly MAX_PROCESSED_CACHE = 10_000;
    /** Rate limiter: timestamp of last metadata fetch */
    private lastMetadataFetchTime = 0;
    /** Consecutive WebSocket errors for reconnection logic */
    private wsErrorCount = 0;
    /** Whether the monitor has been explicitly stopped */
    private stopped = false;

    constructor(
        config: BotConfig,
        onTokenLaunch: (event: TokenLaunchEvent) => void,
    ) {
        this.config = config;
        this.onTokenLaunch = onTokenLaunch;
        this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
        this.programPubkey = new PublicKey(PUMP_PROGRAM_ID);

        this.state = {
            errorsEncountered: 0,
            githubOnly: config.githubOnlyFilter,
            isRunning: false,
            lastSlot: 0,
            mode: 'polling',
            startedAt: 0,
            tokensDetected: 0,
            tokensWithGithub: 0,
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────

    getState(): TokenLaunchMonitorState {
        return { ...this.state };
    }

    async start(): Promise<void> {
        if (this.state.isRunning) {
            log.warn('Token launch monitor already running');
            return;
        }

        this.state.isRunning = true;
        this.state.startedAt = Date.now();

        log.info(
            'Token launch monitor watching program: %s',
            PUMP_PROGRAM_ID.slice(0, 6) + '...',
        );

        // Try WebSocket first
        if (this.config.solanaWsUrl) {
            try {
                await this.startWebSocket();
                this.state.mode = 'websocket';
                log.info('Token launch monitor started in WebSocket mode');
                return;
            } catch (err) {
                log.warn('WebSocket connection failed, falling back to polling:', err);
            }
        }

        // Fallback to HTTP polling
        this.startPolling();
        this.state.mode = 'polling';
        log.info(
            'Token launch monitor started in polling mode (every %ds)',
            this.config.pollIntervalSeconds,
        );
    }

    stop(): void {
        this.stopped = true;
        this.state.isRunning = false;

        // Remove WebSocket subscription
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
            'Token launch monitor stopped (detected=%d, github=%d)',
            this.state.tokensDetected,
            this.state.tokensWithGithub,
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
                    this.wsErrorCount = 0; // Reset on success
                } catch (err) {
                    log.error('Error handling token launch log event:', err);
                    this.wsErrorCount++;
                    if (this.wsErrorCount >= MAX_WS_ERRORS) {
                        log.warn(
                            'Too many WebSocket errors (%d), switching to polling',
                            this.wsErrorCount,
                        );
                        await this.fallbackToPolling();
                    }
                }
            },
            'confirmed',
        );

        log.debug(
            'Token launch WS subscription for %s: id=%d',
            this.programPubkey.toBase58().slice(0, 8),
            this.wsSubscriptionId,
        );
    }

    /**
     * Tear down the WebSocket subscription and switch to polling.
     * Called when too many consecutive WS errors occur.
     */
    private async fallbackToPolling(): Promise<void> {
        if (this.stopped || !this.state.isRunning) return;

        // Clean up WS
        if (this.wsConnection && this.wsSubscriptionId !== undefined) {
            this.wsConnection
                .removeOnLogsListener(this.wsSubscriptionId)
                .catch(() => {});
            this.wsSubscriptionId = undefined;
        }

        this.state.mode = 'polling';
        this.startPolling();
        log.info('Token launch monitor switched to polling mode');
    }

    private async handleLogEvent(logInfo: Logs): Promise<void> {
        const { signature, logs, err } = logInfo;

        // Skip failed transactions
        if (err) return;

        // Skip already-processed signatures
        if (this.processedSignatures.has(signature)) return;

        // Quick check: do the logs indicate a token creation?
        const logsJoined = logs.join('\n');

        if (!this.isCreateInstruction(logsJoined)) return;

        log.debug('Potential token creation tx detected via WS: %s', signature);
        await this.processTransaction(signature);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Polling Mode
    // ──────────────────────────────────────────────────────────────────────

    private startPolling(): void {
        // Initial poll
        this.poll().catch((err) => log.error('Token launch initial poll failed:', err));

        this.pollTimer = setInterval(() => {
            this.poll().catch((err) => log.error('Token launch poll error:', err));
        }, this.config.pollIntervalSeconds * 1000);
    }

    private async poll(): Promise<void> {
        log.debug('Polling for new token creation transactions...');

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

            if (signatures.length === 0) {
                log.debug('No new transactions for token launch monitor');
                return;
            }

            // Process from oldest to newest
            const ordered = signatures.reverse();
            this.lastSignature = signatures[0].signature; // newest

            for (const sig of ordered) {
                if (sig.err) continue;
                if (this.processedSignatures.has(sig.signature)) continue;
                await this.processTransaction(sig.signature);
            }

            log.debug(
                'Token launch monitor processed %d transactions',
                ordered.length,
            );
        } catch (err) {
            log.error('Error fetching signatures for token launch monitor:', err);
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

            const { transaction, slot, blockTime } = tx;

            // ── Single pass: match discriminator AND parse instruction data ─
            let name = '';
            let symbol = '';
            let metadataUri = '';
            let mayhemMode = false;
            let cashbackEnabled = false;
            let isCreate = false;

            for (const ix of transaction.message.instructions) {
                if ('data' in ix && 'programId' in ix) {
                    const programId =
                        typeof ix.programId === 'string'
                            ? ix.programId
                            : ix.programId.toBase58();

                    if (programId !== PUMP_PROGRAM_ID) continue;

                    const parsed = this.parseCreateInstructionData(
                        (ix as { data: string }).data,
                    );
                    if (parsed) {
                        isCreate = true;
                        name = parsed.name;
                        symbol = parsed.symbol;
                        metadataUri = parsed.uri;
                        mayhemMode = parsed.mayhemMode;
                        cashbackEnabled = parsed.cashbackEnabled;
                        break;
                    }
                }
            }

            // Fallback: check logs for the instruction keyword
            if (!isCreate && tx.meta.logMessages) {
                const logsJoined = tx.meta.logMessages.join('\n');
                if (this.isCreateInstruction(logsJoined)) {
                    isCreate = true;
                }
            }

            if (!isCreate) return;

            // ── Extract accounts ─────────────────────────────────────────
            const accountKeys = transaction.message.accountKeys.map((k) =>
                typeof k === 'string' ? k : k.pubkey.toBase58(),
            );

            // Creator is the transaction's fee payer (first signer)
            const creatorWallet = accountKeys[0] || '';

            // Mint address: the newly created token mint
            const mintAddress = this.findMintAddress(accountKeys);

            // ── Fetch metadata and detect GitHub links ───────────────────
            let metadata: Record<string, unknown> | undefined;
            let githubUrls: string[] = [];

            if (metadataUri) {
                try {
                    const fetched = await this.fetchMetadata(metadataUri);
                    metadata = fetched ?? undefined;
                    if (metadata) {
                        githubUrls = this.extractGithubUrls(metadata);

                        // Fill in name/symbol from metadata if not decoded from instruction
                        if (!name && typeof metadata.name === 'string') {
                            name = metadata.name;
                        }
                        if (!symbol && typeof metadata.symbol === 'string') {
                            symbol = metadata.symbol;
                        }
                    }
                } catch (err) {
                    log.debug(
                        'Failed to fetch metadata for %s: %s',
                        mintAddress,
                        err instanceof Error ? err.message : String(err),
                    );
                }
            }

            const hasGithub = githubUrls.length > 0;

            // ── Update state ─────────────────────────────────────────────
            this.state.tokensDetected++;
            if (hasGithub) {
                this.state.tokensWithGithub++;
            }
            this.state.lastSlot = slot;

            // ── Apply GitHub-only filter if configured ────────────────────
            if (this.state.githubOnly && !hasGithub) {
                log.debug(
                    'Token %s (%s) skipped — no GitHub link (githubOnly=true)',
                    symbol || 'unknown',
                    mintAddress.slice(0, 8),
                );
                return;
            }

            const event: TokenLaunchEvent = {
                cashbackEnabled,
                creatorWallet,
                description: (metadata?.description as string) || '',
                githubUrls,
                hasGithub,
                mayhemMode,
                metadata,
                metadataUri,
                mintAddress,
                name,
                slot,
                symbol,
                timestamp: blockTime || Math.floor(Date.now() / 1000),
                txSignature: signature,
            };

            log.info(
                'New token: %s (%s) mint=%s creator=%s github=%s (tx: %s)',
                name || 'unknown',
                symbol || '???',
                mintAddress.slice(0, 8) + '...',
                creatorWallet.slice(0, 8) + '...',
                hasGithub ? githubUrls[0] : 'none',
                signature.slice(0, 12) + '...',
            );

            this.onTokenLaunch(event);
        } catch (err) {
            log.error('Error processing token launch tx %s:', signature, err);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Instruction Matching
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Check if transaction logs indicate a create instruction.
     *
     * Matches "Instruction: Create" and "Instruction: CreateV2" but
     * explicitly rejects false positives like "Instruction: CreatePool"
     * or "Instruction: CreateIdempotent".
     */
    private isCreateInstruction(logsJoined: string): boolean {
        // Anchor logs the instruction name as "Program log: Instruction: <Name>"
        return (
            logsJoined.includes('Instruction: Create\n') ||
            logsJoined.includes('Instruction: CreateV2') ||
            // End-of-string match for last log line
            logsJoined.endsWith('Instruction: Create')
        );
    }

    /**
     * Match base58-encoded instruction data against create/createV2 discriminators.
     *
     * Returns true if the instruction matches either discriminator.
     */
    private matchCreateDiscriminator(dataBase58: string): boolean {
        try {
            const bytes = bs58.decode(dataBase58);
            if (bytes.length < 8) return false;

            const hexPrefix = Buffer.from(bytes.slice(0, 8)).toString('hex');

            return (
                hexPrefix === CREATE_V2_DISCRIMINATOR ||
                hexPrefix === CREATE_DISCRIMINATOR
            );
        } catch {
            return false;
        }
    }

    /**
     * Parse the instruction data for a createV2 (or create) instruction.
     *
     * The Anchor serialisation layout after the 8-byte discriminator:
     *   - name: string (4-byte LE length prefix + UTF-8 bytes)
     *   - symbol: string (4-byte LE length prefix + UTF-8 bytes)
     *   - uri: string (4-byte LE length prefix + UTF-8 bytes)
     *   - creator: Pubkey (32 bytes) — only in createV2
     *   - mayhemMode: Option<OptionBool> (1-2 bytes) — only in createV2
     *   - cashback: Option<OptionBool> (1-2 bytes) — only in createV2
     */
    private parseCreateInstructionData(
        dataBase58: string,
    ): { name: string; symbol: string; uri: string; mayhemMode: boolean; cashbackEnabled: boolean } | null {
        try {
            const bytes = bs58.decode(dataBase58);
            if (bytes.length < 8) return null;

            const hexPrefix = Buffer.from(bytes.slice(0, 8)).toString('hex');
            const isCreateV2 = hexPrefix === CREATE_V2_DISCRIMINATOR;
            const isCreate = hexPrefix === CREATE_DISCRIMINATOR;

            if (!isCreateV2 && !isCreate) return null;

            let offset = 8;

            // Read name (Borsh string: u32 LE length + bytes)
            const nameResult = this.readBorshString(bytes, offset);
            if (!nameResult) return null;
            offset += nameResult.bytesConsumed;

            // Read symbol (Borsh string: u32 LE length + bytes)
            const symbolResult = this.readBorshString(bytes, offset);
            if (!symbolResult) return null;
            offset += symbolResult.bytesConsumed;

            // Read uri (Borsh string: u32 LE length + bytes)
            const uriResult = this.readBorshString(bytes, offset);
            if (!uriResult) return null;
            offset += uriResult.bytesConsumed;

            let mayhemMode = false;
            let cashbackEnabled = false;

            if (isCreateV2) {
                // Skip creator pubkey (32 bytes)
                offset += 32;

                // Read mayhemMode: Option<OptionBool>
                // Format: 0 = None | 1 = Some, followed by 1 byte bool value
                if (offset < bytes.length) {
                    const optPresent = bytes[offset] === 1;
                    offset += 1;
                    if (optPresent && offset < bytes.length) {
                        mayhemMode = bytes[offset] === 1;
                        offset += 1;
                    }
                }

                // Read cashback: Option<OptionBool>
                if (offset < bytes.length) {
                    const optPresent = bytes[offset] === 1;
                    offset += 1;
                    if (optPresent && offset < bytes.length) {
                        cashbackEnabled = bytes[offset] === 1;
                        offset += 1;
                    }
                }
            }

            return {
                cashbackEnabled,
                mayhemMode,
                name: nameResult.value,
                symbol: symbolResult.value,
                uri: uriResult.value,
            };
        } catch {
            return null;
        }
    }

    /**
     * Read a Borsh-encoded string (u32 LE length prefix + UTF-8 bytes).
     *
     * Returns the decoded string and the total number of bytes consumed
     * (4 length-prefix bytes + the raw byte count), since multi-byte
     * UTF-8 characters mean `string.length !== byteLength`.
     */
    private readBorshString(
        bytes: Uint8Array,
        offset: number,
    ): { value: string; bytesConsumed: number } | null {
        if (offset + 4 > bytes.length) return null;

        const len =
            bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24);

        if (len < 0 || len > 4096) return null; // Sanity check
        if (offset + 4 + len > bytes.length) return null;

        const value = Buffer.from(bytes.slice(offset + 4, offset + 4 + len)).toString(
            'utf-8',
        );

        return { bytesConsumed: 4 + len, value };
    }

    // ──────────────────────────────────────────────────────────────────────
    // Account Extraction
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Attempt to find the mint address from the transaction accounts.
     *
     * In a createV2 transaction, the mint is typically at a predictable index.
     * We filter out well-known system programs and the Pump program itself.
     */
    private findMintAddress(accountKeys: string[]): string {
        // The mint is typically the second account (index 1) for createV2
        // but verify it's not a system program
        for (let i = 1; i < Math.min(accountKeys.length, 5); i++) {
            const key = accountKeys[i];
            if (!SYSTEM_PROGRAMS.has(key) && key.length >= 32) {
                return key;
            }
        }

        // Broader fallback
        for (let i = 5; i < accountKeys.length; i++) {
            const key = accountKeys[i];
            if (!SYSTEM_PROGRAMS.has(key) && key.length >= 32) {
                return key;
            }
        }

        return '';
    }

    // ──────────────────────────────────────────────────────────────────────
    // Metadata Fetching
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Fetch token metadata from the given URI with a timeout and rate limiting.
     *
     * Uses Node's built-in `fetch` (available in Node 18+).
     * Rewrites IPFS URIs through the configured gateway.
     * Returns null if the fetch fails or times out.
     */
    private async fetchMetadata(
        uri: string,
    ): Promise<Record<string, unknown> | null> {
        // ── Rate limiting ────────────────────────────────────────────────
        const now = Date.now();
        const elapsed = now - this.lastMetadataFetchTime;
        if (elapsed < METADATA_FETCH_INTERVAL_MS) {
            await new Promise((r) => setTimeout(r, METADATA_FETCH_INTERVAL_MS - elapsed));
        }
        this.lastMetadataFetchTime = Date.now();

        // ── Rewrite IPFS URIs through the configured gateway ─────────────
        let fetchUrl = uri;
        if (uri.startsWith('ipfs://')) {
            const cid = uri.slice('ipfs://'.length);
            fetchUrl = `${this.config.ipfsGateway}${cid}`;
        } else if (uri.includes('/ipfs/') && this.config.ipfsGateway) {
            // Rewrite known IPFS gateways to the configured one
            const ipfsIdx = uri.indexOf('/ipfs/');
            const path = uri.slice(ipfsIdx + '/ipfs/'.length);
            fetchUrl = `${this.config.ipfsGateway}${path}`;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                METADATA_FETCH_TIMEOUT_MS,
            );

            const response = await fetch(fetchUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'PumpFun-Monitor/1.0',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                log.debug(
                    'Metadata fetch failed for %s: HTTP %d',
                    fetchUrl.slice(0, 80),
                    response.status,
                );
                return null;
            }

            const json = (await response.json()) as Record<string, unknown>;
            return json;
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                log.debug('Metadata fetch timed out for %s', fetchUrl.slice(0, 80));
            } else {
                log.debug(
                    'Metadata fetch error for %s: %s',
                    fetchUrl.slice(0, 80),
                    err instanceof Error ? err.message : String(err),
                );
            }
            return null;
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // GitHub Link Detection
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Extract GitHub URLs from all string fields in the metadata object.
     * Recursively checks nested objects (e.g. `extensions`, `attributes`).
     */
    private extractGithubUrls(metadata: Record<string, unknown>): string[] {
        const urls = new Set<string>();

        const scan = (obj: Record<string, unknown>): void => {
            for (const value of Object.values(obj)) {
                if (typeof value === 'string') {
                    const matches = value.match(GITHUB_URL_REGEX);
                    if (matches) {
                        for (const match of matches) {
                            urls.add(match);
                        }
                    }
                } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                    scan(value as Record<string, unknown>);
                }
            }
        };

        scan(metadata);
        return [...urls];
    }

    // ──────────────────────────────────────────────────────────────────────
    // Dedup Helpers
    // ──────────────────────────────────────────────────────────────────────

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
