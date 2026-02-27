/**
 * PumpFun Telegram Bot — Launch Monitor Store
 *
 * Tracks which chats have /monitor active and their filter preferences.
 * Simple in-memory Map — no persistence needed.
 */

import { log } from './logger.js';

// ============================================================================
// Types
// ============================================================================

export interface LaunchMonitorEntry {
    /** Telegram chat ID */
    chatId: number;
    /** Who activated monitoring */
    activatedBy: number;
    /** Only show tokens with GitHub links */
    githubOnly: boolean;
    /** Active status */
    active: boolean;
    /** When activated (unix ms) */
    activatedAt: number;
    /** When deactivated (unix ms), 0 if still active */
    deactivatedAt: number;
    /** Per-chat alert toggles (defaults to all enabled) */
    alerts: AlertPreferences;
}

export interface AlertPreferences {
    /** Receive new token launch notifications */
    launches: boolean;
    /** Receive graduation / AMM migration notifications */
    graduations: boolean;
    /** Receive whale trade notifications */
    whales: boolean;
    /** Receive creator fee distribution notifications */
    feeDistributions: boolean;
}

// ============================================================================
// In-memory store
// ============================================================================

const monitors = new Map<number, LaunchMonitorEntry>();

// ============================================================================
// Operations
// ============================================================================

/** Default alert preferences — everything enabled */
export const DEFAULT_ALERTS: AlertPreferences = {
    feeDistributions: true,
    graduations: true,
    launches: true,
    whales: true,
};

/** Activate (or update) the launch monitor for a chat. */
export function activateMonitor(
    chatId: number,
    userId: number,
    githubOnly: boolean,
): LaunchMonitorEntry {
    const existing = monitors.get(chatId);
    const wasActive = existing?.active ?? false;

    const entry: LaunchMonitorEntry = {
        activatedAt: Date.now(),
        activatedBy: userId,
        active: true,
        alerts: existing?.alerts ?? { ...DEFAULT_ALERTS },
        chatId,
        deactivatedAt: 0,
        githubOnly,
    };
    monitors.set(chatId, entry);

    if (wasActive) {
        log.info(
            'Launch monitor updated for chat %d (githubOnly=%s)',
            chatId,
            githubOnly,
        );
    } else {
        log.info(
            'Launch monitor activated for chat %d (githubOnly=%s)',
            chatId,
            githubOnly,
        );
    }
    return entry;
}

/** Deactivate the launch monitor for a chat. */
export function deactivateMonitor(chatId: number): boolean {
    const entry = monitors.get(chatId);
    if (!entry || !entry.active) return false;
    entry.active = false;
    entry.deactivatedAt = Date.now();
    log.info('Launch monitor deactivated for chat %d', chatId);
    return true;
}

/** Return all active monitor entries. */
export function getActiveMonitors(): LaunchMonitorEntry[] {
    return Array.from(monitors.values()).filter((e) => e.active);
}

/** Return the number of active monitors. */
export function getActiveMonitorCount(): number {
    let count = 0;
    for (const e of monitors.values()) {
        if (e.active) count++;
    }
    return count;
}

/** Check whether a chat has an active monitor. */
export function isMonitorActive(chatId: number): boolean {
    const entry = monitors.get(chatId);
    return !!entry?.active;
}

/** Get the monitor entry for a chat (active or not). */
export function getMonitorEntry(chatId: number): LaunchMonitorEntry | undefined {
    return monitors.get(chatId);
}

/** Update alert preferences for a chat. Creates a default entry if none exists. */
export function updateAlerts(
    chatId: number,
    userId: number,
    updates: Partial<AlertPreferences>,
): LaunchMonitorEntry {
    let entry = monitors.get(chatId);
    if (!entry) {
        entry = {
            activatedAt: Date.now(),
            activatedBy: userId,
            active: true,
            alerts: { ...DEFAULT_ALERTS },
            chatId,
            deactivatedAt: 0,
            githubOnly: false,
        };
        monitors.set(chatId, entry);
    }
    // Merge the updates
    entry.alerts = { ...entry.alerts, ...updates };
    log.info(
        'Alert preferences updated for chat %d: launches=%s grad=%s whales=%s fees=%s',
        chatId,
        entry.alerts.launches,
        entry.alerts.graduations,
        entry.alerts.whales,
        entry.alerts.feeDistributions,
    );
    return entry;
}
