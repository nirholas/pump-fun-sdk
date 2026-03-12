/**
 * @pumpkit/core — Base Monitor
 *
 * Abstract base class for all Pump protocol event monitors.
 * Handles status tracking and provides a consistent interface.
 */

import { log } from '../logger.js';

export interface MonitorStatus {
  running: boolean;
  lastEvent: number | null;
  eventsProcessed: number;
}

export abstract class BaseMonitor {
  protected _running = false;
  protected _lastEvent: number | null = null;
  protected _eventsProcessed = 0;
  protected readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract start(): void;
  abstract stop(): void;

  /** Get current monitor status */
  status(): MonitorStatus {
    return {
      running: this._running,
      lastEvent: this._lastEvent,
      eventsProcessed: this._eventsProcessed,
    };
  }

  /** Record that an event was processed */
  protected recordEvent(): void {
    this._eventsProcessed++;
    this._lastEvent = Date.now();
  }

  /** Log with monitor name prefix */
  protected log = {
    debug: (msg: string, ...args: unknown[]) => log.debug(`[${this.name}] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => log.info(`[${this.name}] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[${this.name}] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(`[${this.name}] ${msg}`, ...args),
  };
}
