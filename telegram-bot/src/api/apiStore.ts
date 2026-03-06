/**
 * PumpFun API — Watch Store (API Extension)
 *
 * Extends the core bot store with per-client watch management for the REST API.
 * API watches are stored separately from Telegram bot watches.
 *
 * Each API key gets its own namespace so clients can only manage their own watches.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { log } from '../logger.js';
import type { WatchEntry } from '../types.js';
import type { ApiWatchEntry } from './types.js';

const DATA_FILE = resolve(process.cwd(), 'data', 'api-watches.json');

// ============================================================================
// In-memory store
// ============================================================================

const apiWatches = new Map<string, ApiWatchEntry>();

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

export function loadApiWatches(): void {
    try {
        const raw = readFileSync(DATA_FILE, 'utf-8');
        const entries: ApiWatchEntry[] = JSON.parse(raw);
        for (const entry of entries) {
            apiWatches.set(entry.id, entry);
        }
        log.info(`Loaded ${entries.length} API watches from disk`);
    } catch {
        log.info('No existing API watch data found — starting fresh');
    }
}

export function saveApiWatches(): void {
    try {
        ensureDataDir();
        const entries = Array.from(apiWatches.values());
        writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (err) {
        log.error('Failed to save API watches:', err);
    }
}

// ============================================================================
// CRUD
// ============================================================================

let idCounter = Date.now();

/** Add a new API watch. Returns the created entry. */
export function addApiWatch(
    clientId: string,
    recipientWallet: string,
    label?: string,
    tokenFilter?: string[],
    webhookUrl?: string,
): ApiWatchEntry {
    const id = `aw_${++idCounter}`;
    const entry: ApiWatchEntry = {
        active: true,
        addedBy: 0, // API client, not a Telegram user
        chatId: 0,  // Not a Telegram chat
        clientId,
        createdAt: Date.now(),
        id,
        label,
        recipientWallet: recipientWallet.trim(),
        tokenFilter,
        webhookUrl,
    };
    apiWatches.set(id, entry);
    saveApiWatches();
    log.info(`API watch added: ${id} → ${recipientWallet} (client: ${clientId.slice(0, 8)})`);
    return entry;
}

/** Get a specific API watch by ID, scoped to client. */
export function getApiWatch(id: string, clientId: string): ApiWatchEntry | undefined {
    const entry = apiWatches.get(id);
    if (!entry || entry.clientId !== clientId) return undefined;
    return entry;
}

/** Update an API watch. Returns updated entry or undefined if not found. */
export function updateApiWatch(
    id: string,
    clientId: string,
    updates: {
        label?: string;
        active?: boolean;
        tokenFilter?: string[];
        webhookUrl?: string;
    },
): ApiWatchEntry | undefined {
    const entry = apiWatches.get(id);
    if (!entry || entry.clientId !== clientId) return undefined;

    if (updates.label !== undefined) entry.label = updates.label;
    if (updates.active !== undefined) entry.active = updates.active;
    if (updates.tokenFilter !== undefined) entry.tokenFilter = updates.tokenFilter;
    if (updates.webhookUrl !== undefined) entry.webhookUrl = updates.webhookUrl;

    apiWatches.set(id, entry);
    saveApiWatches();
    return entry;
}

/** Remove an API watch by ID, scoped to client. */
export function removeApiWatch(id: string, clientId: string): boolean {
    const entry = apiWatches.get(id);
    if (!entry || entry.clientId !== clientId) return false;
    apiWatches.delete(id);
    saveApiWatches();
    log.info(`API watch removed: ${id}`);
    return true;
}

/** Get all watches for a specific API client. */
export function getApiWatchesForClient(clientId: string): ApiWatchEntry[] {
    return Array.from(apiWatches.values()).filter((w) => w.clientId === clientId);
}

/** Get all active API watches across all clients. */
export function getAllActiveApiWatches(): ApiWatchEntry[] {
    return Array.from(apiWatches.values()).filter((w) => w.active);
}

/** Find API watches matching a claimer wallet (across all clients). */
export function findMatchingApiWatches(claimerWallet: string): ApiWatchEntry[] {
    const lower = claimerWallet.toLowerCase();
    return Array.from(apiWatches.values()).filter(
        (w) => w.active && w.recipientWallet.toLowerCase() === lower,
    );
}

/** Get the set of all watched wallet addresses (lowercase) for the API. */
export function getApiWatchedWallets(): Set<string> {
    const set = new Set<string>();
    for (const entry of apiWatches.values()) {
        if (entry.active) {
            set.add(entry.recipientWallet.toLowerCase());
        }
    }
    return set;
}

/** Total API watch count. */
export function getApiWatchCount(): { total: number; active: number } {
    let active = 0;
    for (const entry of apiWatches.values()) {
        if (entry.active) active++;
    }
    return { active, total: apiWatches.size };
}

/** Get count of watches for a specific client. */
export function getClientWatchCount(clientId: string): number {
    let count = 0;
    for (const entry of apiWatches.values()) {
        if (entry.clientId === clientId) count++;
    }
    return count;
}
