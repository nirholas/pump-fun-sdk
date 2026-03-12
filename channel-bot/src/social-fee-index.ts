/**
 * PumpFun Channel Bot — Social Fee Index
 *
 * Maintains a map of socialFeePdaAddress → tokenMint by:
 *  1. Scanning all SharingConfig accounts at startup (GPA bootstrap)
 *  2. Updating live from CreateFeeSharingConfigEvent and UpdateFeeSharesEvent logs
 *
 * SharingConfig account layout (after 8-byte discriminator):
 *   bump:          u8   (1)
 *   version:       u8   (1)
 *   status:        u8   (1)  — enum, 1 byte
 *   mint:          pubkey (32)  ← offset 11
 *   admin:         pubkey (32)  ← offset 43
 *   admin_revoked: bool  (1)
 *   shareholders:  vec<Shareholder>  ← offset 76
 *     count: u32 LE (4)
 *     each:  address(32) + share_bps(u16=2) = 34 bytes
 *
 * CreateFeeSharingConfigEvent layout (after 8-byte discriminator):
 *   timestamp:           i64 (8)
 *   mint:                pubkey (32)  ← offset 16
 *   bonding_curve:       pubkey (32)
 *   pool:                Option<pubkey> — 1 byte tag + optional 32
 *   sharing_config:      pubkey (32)
 *   admin:               pubkey (32)
 *   initial_shareholders: vec<Shareholder>
 *   status:              u8
 *
 * UpdateFeeSharesEvent layout (after 8-byte discriminator):
 *   timestamp:        i64 (8)
 *   mint:             pubkey (32)  ← offset 16
 *   sharing_config:   pubkey (32)
 *   admin:            pubkey (32)
 *   new_shareholders: vec<Shareholder>
 */

import { PublicKey } from '@solana/web3.js';
import type { RpcFallback } from './rpc-fallback.js';
import { log } from './logger.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** SharingConfig account discriminator (from IDL: [216,74,9,0,56,140,93,75]) */
const SHARING_CONFIG_DISC = Buffer.from([216, 74, 9, 0, 56, 140, 93, 75]);

/** CreateFeeSharingConfigEvent discriminator (from IDL: [133,105,170,200,184,116,251,88]) */
export const CREATE_FEE_SHARING_CONFIG_EVENT_DISC = '8569aac8b874fb58';

/** UpdateFeeSharesEvent discriminator (from IDL: [21,186,196,184,91,228,225,203]) */
export const UPDATE_FEE_SHARES_EVENT_DISC = '15bac4b85be4e1cb';

const PUMP_FEE_PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';

// ── Helpers ──────────────────────────────────────────────────────────────────

function readPubkey(buf: Buffer, offset: number): string {
    if (buf.length < offset + 32) return '';
    return new PublicKey(buf.subarray(offset, offset + 32)).toBase58();
}

/**
 * Parse shareholder addresses from a Borsh-encoded vec<Shareholder>.
 * Each Shareholder = address(32) + share_bps(u16=2) = 34 bytes.
 * Returns the list of address strings.
 */
function parseShareholderAddresses(buf: Buffer, offset: number): string[] {
    if (buf.length < offset + 4) return [];
    const count = buf.readUInt32LE(offset);
    offset += 4;

    if (count > 20 || buf.length < offset + count * 34) return []; // sanity check

    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
        const addr = readPubkey(buf, offset);
        if (addr) addresses.push(addr);
        offset += 34; // 32 (pubkey) + 2 (share_bps u16)
    }
    return addresses;
}

// ── Index ────────────────────────────────────────────────────────────────────

export class SocialFeeIndex {
    /** socialFeePdaAddress → set of mints (1:many — scammers can add the same PDA to multiple tokens) */
    private index = new Map<string, Set<string>>();
    private bootstrapped = false;

    /** Number of PDA→mint mappings in the index. */
    get size(): number {
        let count = 0;
        for (const set of this.index.values()) count += set.size;
        return count;
    }

    private addMapping(pdaAddress: string, mint: string): void {
        let set = this.index.get(pdaAddress);
        if (!set) {
            set = new Set();
            this.index.set(pdaAddress, set);
        }
        set.add(mint);
    }

    /**
     * Bootstrap the index by scanning ALL SharingConfig accounts on-chain.
     * Runs once at startup so historical configs are covered.
     *
     * Uses `dataSlice` to fetch only the fields we need (mint + shareholders),
     * skipping the 8-byte discriminator to reduce per-account memory.
     *
     * To avoid OOM from a single massive `getProgramAccounts` response, the
     * fetch is partitioned into 256 chunks by the first byte of the mint
     * pubkey, processed in small concurrent batches.
     *
     * Set SKIP_SOCIAL_FEE_BOOTSTRAP=true to disable if not needed.
     */
    async bootstrap(rpc: RpcFallback): Promise<void> {
        if (this.bootstrapped) return;

        if (process.env.SKIP_SOCIAL_FEE_BOOTSTRAP === 'true') {
            log.info('SocialFeeIndex: bootstrap skipped (SKIP_SOCIAL_FEE_BOOTSTRAP=true), relying on live events');
            this.bootstrapped = true;
            return;
        }

        try {
            log.info('SocialFeeIndex: bootstrapping from on-chain SharingConfig accounts...');

            // dataSlice: skip the 8-byte discriminator, fetch from offset 3 (bump/version/status)
            // through the shareholders vec. Max shareholders = 20, each 34 bytes.
            // Sliced layout relative to returned data:
            //   [0..2]   = bump(1) + version(1) + status(1)
            //   [3..34]  = mint (32 bytes)
            //   [35..66] = admin (32 bytes)  — skipped during parse
            //   [67]     = admin_revoked (1 byte)
            //   [68..]   = shareholders vec (4 + n*34)
            const SLICE_OFFSET = 8; // skip discriminator
            const SLICE_LENGTH = 3 + 32 + 32 + 1 + 4 + 20 * 34; // 752 bytes max

            // Mint pubkey absolute offset in account data: disc(8) + bump(1) + version(1) + status(1) = 11
            const MINT_ABS_OFFSET = 11;

            let totalAccounts = 0;
            let indexed = 0;

            // Chunk GPA by first byte of the mint pubkey to avoid OOM.
            // Each chunk fetches ~1/256th of all SharingConfig accounts.
            const CONCURRENCY = 4;
            for (let batchStart = 0; batchStart < 256; batchStart += CONCURRENCY) {
                const batchEnd = Math.min(batchStart + CONCURRENCY, 256);
                type GpaResult = Array<{ pubkey: PublicKey; account: { data: Buffer } }>;
                const fetches: Promise<GpaResult | null>[] = [];

                for (let b = batchStart; b < batchEnd; b++) {
                    const mintByte = Buffer.from([b]);
                    fetches.push(
                        (rpc.withFallback((conn) =>
                            conn.getProgramAccounts(new PublicKey(PUMP_FEE_PROGRAM_ID), {
                                commitment: 'confirmed',
                                dataSlice: { offset: SLICE_OFFSET, length: SLICE_LENGTH },
                                filters: [
                                    {
                                        memcmp: {
                                            offset: 0,
                                            bytes: SHARING_CONFIG_DISC.toString('base64'),
                                            encoding: 'base64',
                                        },
                                    },
                                    {
                                        memcmp: {
                                            offset: MINT_ABS_OFFSET,
                                            bytes: mintByte.toString('base64'),
                                            encoding: 'base64',
                                        },
                                    },
                                ],
                            }),
                        ) as Promise<unknown>).then(
                            (res) => res as GpaResult,
                            () => null, // swallow per-chunk errors; partial index is still useful
                        ),
                    );
                }

                const results = await Promise.all(fetches);
                for (const accounts of results) {
                    if (!accounts) continue;
                    totalAccounts += accounts.length;
                    for (let i = 0; i < accounts.length; i++) {
                        const data = accounts[i]!.account.data as Buffer;
                        if (data.length < 68) continue;

                        const mint = readPubkey(data, 3);
                        if (!mint) continue;

                        const shareholders = parseShareholderAddresses(data, 68);
                        for (const addr of shareholders) {
                            this.addMapping(addr, mint);
                            indexed++;
                        }
                    }
                }
            }

            this.bootstrapped = true;
            log.info('SocialFeeIndex: bootstrapped %d mappings from %d SharingConfig accounts', indexed, totalAccounts);
        } catch (err) {
            log.warn('SocialFeeIndex: bootstrap failed (will rely on live events): %s', err);
            this.bootstrapped = true; // don't retry on every restart
        }
    }

    /**
     * Update from a CreateFeeSharingConfigEvent log line body (bytes including discriminator).
     * Layout: disc(8) + timestamp(8) + mint(32) + bonding_curve(32) + pool(Option<pubkey>) + sharing_config(32) + admin(32) + shareholders(vec)
     */
    updateFromCreateEvent(bytes: Buffer): void {
        try {
            if (bytes.length < 48) return;
            const mint = readPubkey(bytes, 16); // disc(8)+timestamp(8) = 16
            if (!mint) return;

            // Skip bonding_curve(32) then pool (Option: 1 byte + optional 32)
            let offset = 48 + 32; // 16 + 32 (mint) + 32 (bonding_curve) = 80
            if (bytes.length < offset + 1) return;
            const hasPool = bytes[offset] === 1;
            offset += 1 + (hasPool ? 32 : 0);

            // sharing_config(32) + admin(32)
            offset += 32 + 32;

            const shareholders = parseShareholderAddresses(bytes, offset);
            for (const addr of shareholders) {
                this.addMapping(addr, mint);
            }
            if (shareholders.length > 0) {
                log.debug('SocialFeeIndex: indexed %d shareholders for mint %s', shareholders.length, mint.slice(0, 8));
            }
        } catch (err) {
            log.debug('SocialFeeIndex: CreateFeeSharingConfigEvent parse error: %s', err);
        }
    }

    /**
     * Update from an UpdateFeeSharesEvent log line body (bytes including discriminator).
     * Layout: disc(8) + timestamp(8) + mint(32) + sharing_config(32) + admin(32) + shareholders(vec)
     */
    updateFromUpdateSharesEvent(bytes: Buffer): void {
        try {
            if (bytes.length < 48) return;
            const mint = readPubkey(bytes, 16); // disc(8)+timestamp(8) = 16
            if (!mint) return;

            // sharing_config(32) + admin(32)
            const offset = 16 + 32 + 32 + 32; // 112
            const shareholders = parseShareholderAddresses(bytes, offset);
            for (const addr of shareholders) {
                this.addMapping(addr, mint);
            }
            if (shareholders.length > 0) {
                log.debug('SocialFeeIndex: updated %d shareholders for mint %s', shareholders.length, mint.slice(0, 8));
            }
        } catch (err) {
            log.debug('SocialFeeIndex: UpdateFeeSharesEvent parse error: %s', err);
        }
    }

    /**
     * Look up the mint for a given social fee PDA address.
     * Returns the first mint if only one exists, otherwise undefined
     * (use lookupAll for disambiguation when multiple tokens share the same PDA).
     */
    lookup(socialFeePdaAddress: string): string | undefined {
        const set = this.index.get(socialFeePdaAddress);
        if (!set || set.size === 0) return undefined;
        if (set.size === 1) return set.values().next().value;
        // Multiple mints — caller should use lookupAll + market cap disambiguation
        return undefined;
    }

    /**
     * Look up ALL mints associated with a social fee PDA address.
     * When multiple tokens share the same PDA (scam vector), returns all
     * candidates so the caller can disambiguate by market cap.
     */
    lookupAll(socialFeePdaAddress: string): string[] {
        const set = this.index.get(socialFeePdaAddress);
        if (!set) return [];
        return [...set];
    }
}
