# Agent Task 09: Extract Storage Adapters

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Read `pumpkit/docs/core-api.md` for storage API spec.

Bots use two storage patterns: JSON file persistence and SQLite databases.

## Source Files to Read

- `/workspaces/pump-fun-sdk/telegram-bot/src/store.ts` — File-based JSON persistence
- `/workspaces/pump-fun-sdk/claim-bot/src/store.ts` — File-based JSON persistence
- `/workspaces/pump-fun-sdk/channel-bot/src/claim-tracker.ts` — File-based dedup set
- `/workspaces/pump-fun-sdk/outsiders-bot/src/db.ts` — SQLite database
- `/workspaces/pump-fun-sdk/telegram-bot/src/api/apiStore.ts` — API-specific persistence

## Task

Create these files under `/workspaces/pump-fun-sdk/pumpkit/packages/core/src/storage/`:

### 1. `types.ts`
```typescript
export interface Store<T> {
  read(): T;
  write(data: T): void;
}
```

### 2. `FileStore.ts`
Generic JSON file persistence:
```typescript
export class FileStore<T> implements Store<T> {
  constructor(options: { path: string; defaultValue: T });
  read(): T;
  write(data: T): void;
}
```
- Auto-create directory if it doesn't exist
- Atomic writes (write to temp file, then rename)
- Return `defaultValue` if file doesn't exist
- Use `JSON.parse`/`JSON.stringify`

### 3. `SqliteStore.ts`
SQLite adapter using better-sqlite3:
```typescript
export class SqliteStore {
  constructor(dbPath: string);
  exec(sql: string): void;
  query<T>(sql: string, params?: unknown[]): T[];
  run(sql: string, params?: unknown[]): { changes: number; lastInsertRowid: number };
  close(): void;
}
```
- Enable WAL mode for concurrent reads
- Auto-create directory for db file
- Thin wrapper — not an ORM

### 4. `index.ts`
Barrel export.

## Requirements

- FileStore: uses only Node.js built-in `fs` and `path`
- SqliteStore: uses `better-sqlite3`
- ES module syntax
- Both should handle missing directories gracefully (mkdir -p equivalent)

## Do NOT

- Don't build an ORM or query builder
- Don't modify existing bot code
