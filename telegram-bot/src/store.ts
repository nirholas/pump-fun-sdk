/**
 * PumpFun Telegram Bot — Watch Store
 *
 * In-memory store for watch entries. Persisted to a local JSON file so
 * watches survive restarts.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { log } from './logger.js';
import type { WatchEntry } from './types.js';

const DATA_FILE = resolve(process.cwd(), 'data', 'watches.json');

// ============================================================================
// In-memory store
// ============================================================================

const watches = new Map<string, WatchEntry>();

// ============================================================================
// Persistence
// ============================================================================

function ensureDataDir(): void {
    const dir = resolve(process.cwd(), 'data');
    try {
        mkdirSync(dir, { recursive: true });
    } catch {
        // already exists
    }
}

export function loadWatches(): void {
    try {
        const raw = readFileSync(DATA_FILE, 'utf-8');
        const entries: WatchEntry[] = JSON.parse(raw);
        for (const entry of entries) {
            watches.set(entry.id, entry);
        }
        log.info(`Loaded ${entries.length} watches from disk`);
    } catch {
        log.info('No existing watch data found — starting fresh');
    }
}

export function saveWatches(): void {
    try {
        ensureDataDir();
        const entries = Array.from(watches.values());
        writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (err) {
        log.error('Failed to save watches:', err);
    }
}

// ============================================================================
// CRUD
// ============================================================================

let idCounter = Date.now();

/** Add a new watch and persist. */
export function addWatch(
    chatId: number,
    addedBy: number,
    recipientWallet: string,
    label?: string,
): WatchEntry {
    const id = `w_${++idCounter}`;
    const entry: WatchEntry = {
        active: true,
        addedBy,
        chatId,
        createdAt: Date.now(),
        id,
        label,
        recipientWallet: recipientWallet.trim(),
    };
    watches.set(id, entry);
    saveWatches();
    log.info(`Watch added: ${id} → ${recipientWallet} (chat ${chatId})`);
    return entry;
}

/** Remove a watch by ID. Returns true if found & removed. */
export function removeWatch(id: string, chatId: number): boolean {
    const entry = watches.get(id);
    if (!entry || entry.chatId !== chatId) return false;
    watches.delete(id);
    saveWatches();
    log.info(`Watch removed: ${id}`);
    return true;
}

/** Remove a watch by wallet address for a specific chat. */
export function removeWatchByWallet(
    wallet: string,
    chatId: number,
): boolean {
    for (const [id, entry] of watches) {
        if (
            entry.recipientWallet.toLowerCase() === wallet.toLowerCase() &&
            entry.chatId === chatId
        ) {
            watches.delete(id);
            saveWatches();
            log.info(`Watch removed by wallet: ${id} (${wallet})`);
            return true;
        }
    }
    return false;
}

/** Get all watches for a specific chat. */
export function getWatchesForChat(chatId: number): WatchEntry[] {
    return Array.from(watches.values()).filter((w) => w.chatId === chatId && w.active);
}

/** Get all active watches across all chats. */
export function getAllActiveWatches(): WatchEntry[] {
    return Array.from(watches.values()).filter((w) => w.active);
}

/** Get the set of all watched wallet addresses (lowercase). */
export function getWatchedWallets(): Set<string> {
    const set = new Set<string>();
    for (const entry of watches.values()) {
        if (entry.active) {
            set.add(entry.recipientWallet.toLowerCase());
        }
    }
    return set;
}

/** Find watches that match a specific claimer wallet. */
export function findMatchingWatches(claimerWallet: string): WatchEntry[] {
    const lower = claimerWallet.toLowerCase();
    return Array.from(watches.values()).filter(
        (w) => w.active && w.recipientWallet.toLowerCase() === lower,
    );
}
