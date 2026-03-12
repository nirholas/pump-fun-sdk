/**
 * @pumpkit/core — Config Helpers
 *
 * Environment variable loading and validation utilities.
 */

import 'dotenv/config';

/**
 * Read a required environment variable, throw if missing.
 */
export function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

/**
 * Read an optional environment variable with a default.
 */
export function optionalEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

/**
 * Parse a comma-separated env var into an array of trimmed strings.
 */
export function parseListEnv(key: string): string[] {
    const raw = process.env[key];
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a numeric env var with a default.
 */
export function parseIntEnv(key: string, defaultValue: number): number {
    const raw = process.env[key];
    if (!raw) return defaultValue;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
