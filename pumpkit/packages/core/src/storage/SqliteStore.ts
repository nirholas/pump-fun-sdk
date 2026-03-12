/**
 * @pumpkit/core — SQLite Store
 *
 * Thin SQLite wrapper using better-sqlite3.
 * Enables WAL mode for concurrent reads.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class SqliteStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    const resolved = resolve(dbPath);
    mkdirSync(dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
  }

  /** Execute a SQL statement (DDL or multi-statement) */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** Query rows — returns an array of typed results */
  query<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /** Run a mutation — returns changes count and last insert rowid */
  run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}
