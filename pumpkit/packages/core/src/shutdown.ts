/**
 * @pumpkit/core — Graceful Shutdown
 *
 * Registers signal handlers for clean bot shutdown.
 */

import { log } from './logger.js';
import type { ShutdownHandler } from './types.js';

const handlers: ShutdownHandler[] = [];
let shuttingDown = false;

/**
 * Register a cleanup handler to run on SIGINT/SIGTERM.
 * Handlers run in registration order.
 */
export function onShutdown(handler: ShutdownHandler): void {
    handlers.push(handler);
}

async function runShutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('Received %s — shutting down gracefully…', signal);

    for (const handler of handlers) {
        try {
            await handler();
        } catch (err) {
            log.error('Shutdown handler error: %s', err);
        }
    }

    process.exit(0);
}

/**
 * Install SIGINT and SIGTERM handlers.
 * Call this once at bot startup.
 */
export function installShutdownHandlers(): void {
    process.on('SIGINT', () => runShutdown('SIGINT'));
    process.on('SIGTERM', () => runShutdown('SIGTERM'));
}
