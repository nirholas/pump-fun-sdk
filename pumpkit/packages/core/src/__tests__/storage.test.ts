import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { FileStore } from '../storage/FileStore.js';
import { SqliteStore } from '../storage/SqliteStore.js';

const TEST_DIR = join(tmpdir(), `pumpkit-test-${randomUUID()}`);

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('FileStore', () => {
  let store: FileStore<{ count: number }>;
  let filePath: string;

  beforeEach(() => {
    filePath = join(TEST_DIR, 'filestore', `${randomUUID()}.json`);
    store = new FileStore({ path: filePath, defaultValue: { count: 0 } });
  });

  it('returns defaultValue when file does not exist', () => {
    expect(store.read()).toEqual({ count: 0 });
  });

  it('write then read returns the written data', () => {
    store.write({ count: 42 });
    expect(store.read()).toEqual({ count: 42 });
  });

  it('overwrites previous data', () => {
    store.write({ count: 1 });
    store.write({ count: 2 });
    expect(store.read()).toEqual({ count: 2 });
  });

  it('creates directory if it does not exist', () => {
    const nested = join(TEST_DIR, 'deep', 'nested', `${randomUUID()}.json`);
    const s = new FileStore({ path: nested, defaultValue: 'init' });
    s.write('hello');
    expect(s.read()).toBe('hello');
  });

  it('handles array data', () => {
    const arrStore = new FileStore<string[]>({
      path: join(TEST_DIR, 'filestore', `${randomUUID()}.json`),
      defaultValue: [],
    });
    arrStore.write(['a', 'b', 'c']);
    expect(arrStore.read()).toEqual(['a', 'b', 'c']);
  });
});

describe('SqliteStore', () => {
  let db: SqliteStore;

  beforeEach(() => {
    db = new SqliteStore(join(TEST_DIR, 'sqlite', `${randomUUID()}.db`));
  });

  afterAll(() => {
    // cleanup handled by TEST_DIR removal
  });

  it('exec creates a table', () => {
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    const rows = db.query<{ id: number; name: string }>('SELECT * FROM items');
    expect(rows).toEqual([]);
    db.close();
  });

  it('run inserts and returns changes count', () => {
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    const result = db.run('INSERT INTO items (name) VALUES (?)', ['alpha']);
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBe(1);
    db.close();
  });

  it('query returns inserted rows', () => {
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    db.run('INSERT INTO items (name) VALUES (?)', ['alpha']);
    db.run('INSERT INTO items (name) VALUES (?)', ['beta']);

    const rows = db.query<{ id: number; name: string }>('SELECT * FROM items ORDER BY id');
    expect(rows).toEqual([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
    ]);
    db.close();
  });

  it('run updates existing rows', () => {
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    db.run('INSERT INTO items (name) VALUES (?)', ['old']);
    const result = db.run('UPDATE items SET name = ? WHERE id = ?', ['new', 1]);
    expect(result.changes).toBe(1);

    const rows = db.query<{ name: string }>('SELECT name FROM items WHERE id = 1');
    expect(rows[0]!.name).toBe('new');
    db.close();
  });

  it('run deletes rows', () => {
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    db.run('INSERT INTO items (name) VALUES (?)', ['delete-me']);
    const result = db.run('DELETE FROM items WHERE id = 1');
    expect(result.changes).toBe(1);

    const rows = db.query('SELECT * FROM items');
    expect(rows).toEqual([]);
    db.close();
  });

  it('creates directory if it does not exist', () => {
    const nested = join(TEST_DIR, 'deep', 'sql', `${randomUUID()}.db`);
    const nestedDb = new SqliteStore(nested);
    nestedDb.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    nestedDb.run('INSERT INTO t (id) VALUES (1)');
    expect(nestedDb.query('SELECT id FROM t')).toEqual([{ id: 1 }]);
    nestedDb.close();
  });

  it('close prevents further operations', () => {
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');
    db.close();
    expect(() => db.query('SELECT * FROM items')).toThrow();
  });
});
