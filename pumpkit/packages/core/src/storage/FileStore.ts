/**
 * @pumpkit/core — File-Based JSON Store
 *
 * Generic JSON file persistence with atomic writes.
 * Extracted from telegram-bot/src/store.ts and claim-bot/src/store.ts.
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Store } from './types.js';

export interface FileStoreOptions<T> {
  /** Path to the JSON file */
  path: string;
  /** Default value returned when file doesn't exist */
  defaultValue: T;
}

export class FileStore<T> implements Store<T> {
  private readonly filePath: string;
  private readonly defaultValue: T;

  constructor(options: FileStoreOptions<T>) {
    this.filePath = resolve(options.path);
    this.defaultValue = options.defaultValue;
    // Ensure directory exists
    mkdirSync(dirname(this.filePath), { recursive: true });
  }

  /** Read the stored value, returning defaultValue if file doesn't exist. */
  read(): T {
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return this.defaultValue;
    }
  }

  /** Write data to file atomically (write to tmp, then rename). */
  write(data: T): void {
    const tmp = this.filePath + '.tmp';
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    renameSync(tmp, this.filePath);
  }
}
