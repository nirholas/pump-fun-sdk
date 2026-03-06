/**
 * Process Manager — Spawn, monitor, stop, and restart bot processes.
 *
 * Each bot is a child process managed by this module. Provides:
 * - Start/stop/restart per bot
 * - stdout/stderr capture into ring buffers
 * - Auto-restart on crash (configurable)
 * - Process state tracking (stopped, starting, running, crashed)
 * - Log streaming via callbacks
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// ── Types ─────────────────────────────────────────────────────────────

export type BotStatus = 'stopped' | 'starting' | 'running' | 'crashed' | 'stopping';

export interface BotProcess {
  id: string;
  name: string;
  cwd: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: BotStatus;
  pid: number | null;
  exitCode: number | null;
  startedAt: number | null;
  stoppedAt: number | null;
  restarts: number;
  autoRestart: boolean;
  maxRestarts: number;
  logs: LogEntry[];
  child: ChildProcess | null;
}

export interface LogEntry {
  timestamp: number;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
}

export interface BotDefinition {
  id: string;
  name: string;
  cwd: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  autoRestart?: boolean;
  maxRestarts?: number;
}

export type LogCallback = (botId: string, entry: LogEntry) => void;
export type StatusCallback = (botId: string, status: BotStatus, detail?: string) => void;

// ── Constants ─────────────────────────────────────────────────────────

const MAX_LOG_LINES = 2000;
const RESTART_DELAY_MS = 3000;
const STARTUP_GRACE_MS = 5000;

// ── Process Manager ───────────────────────────────────────────────────

export class ProcessManager {
  private bots = new Map<string, BotProcess>();
  private onLog: LogCallback | null = null;
  private onStatus: StatusCallback | null = null;

  /** Register a bot definition. Does not start it. */
  register(def: BotDefinition): void {
    if (this.bots.has(def.id)) return;

    // Resolve and verify cwd exists
    const cwd = resolve(def.cwd);

    this.bots.set(def.id, {
      id: def.id,
      name: def.name,
      cwd,
      command: def.command,
      args: [...def.args],
      env: { ...def.env },
      status: 'stopped',
      pid: null,
      exitCode: null,
      startedAt: null,
      stoppedAt: null,
      restarts: 0,
      autoRestart: def.autoRestart ?? true,
      maxRestarts: def.maxRestarts ?? 10,
      logs: [],
      child: null,
    });
  }

  /** Set log callback (for SSE streaming). */
  onLogEntry(cb: LogCallback): void {
    this.onLog = cb;
  }

  /** Set status change callback. */
  onStatusChange(cb: StatusCallback): void {
    this.onStatus = cb;
  }

  /** Start a bot by ID. */
  async start(id: string): Promise<void> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Unknown bot: ${id}`);
    if (bot.status === 'running' || bot.status === 'starting') {
      throw new Error(`Bot ${id} is already ${bot.status}`);
    }

    this.spawnBot(bot);
  }

  /** Stop a bot by ID. */
  async stop(id: string): Promise<void> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Unknown bot: ${id}`);
    if (bot.status === 'stopped' || bot.status === 'stopping') return;

    bot.autoRestart = false; // prevent restart loop
    this.setStatus(bot, 'stopping');
    await this.killProcess(bot);
  }

  /** Restart a bot by ID. */
  async restart(id: string): Promise<void> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Unknown bot: ${id}`);

    const wasAutoRestart = bot.autoRestart;
    if (bot.status === 'running' || bot.status === 'starting') {
      bot.autoRestart = false;
      await this.killProcess(bot);
    }
    bot.autoRestart = wasAutoRestart;
    bot.restarts = 0;
    this.spawnBot(bot);
  }

  /** Update environment vars for a bot (merges, doesn't replace). */
  updateEnv(id: string, env: Record<string, string>): void {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Unknown bot: ${id}`);
    bot.env = { ...bot.env, ...env };
  }

  /** Update auto-restart setting. */
  setAutoRestart(id: string, enabled: boolean): void {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Unknown bot: ${id}`);
    bot.autoRestart = enabled;
  }

  /** Get status of all bots (without child process refs). */
  getAll(): BotInfo[] {
    return Array.from(this.bots.values()).map(serializeBotInfo);
  }

  /** Get status of one bot. */
  get(id: string): BotInfo | undefined {
    const bot = this.bots.get(id);
    return bot ? serializeBotInfo(bot) : undefined;
  }

  /** Get logs for a bot. */
  getLogs(id: string, lines = 200, stream?: 'stdout' | 'stderr' | 'system'): LogEntry[] {
    const bot = this.bots.get(id);
    if (!bot) return [];
    const filtered = stream ? bot.logs.filter((l) => l.stream === stream) : bot.logs;
    return filtered.slice(-lines);
  }

  /** Clear logs for a bot. */
  clearLogs(id: string): void {
    const bot = this.bots.get(id);
    if (bot) bot.logs = [];
  }

  /** Stop all bots. */
  async stopAll(): Promise<void> {
    const running = Array.from(this.bots.values()).filter(
      (b) => b.status === 'running' || b.status === 'starting',
    );
    for (const bot of running) {
      bot.autoRestart = false;
    }
    await Promise.allSettled(running.map((b) => this.killProcess(b)));
  }

  // ── Internal ────────────────────────────────────────────────────────

  private spawnBot(bot: BotProcess): void {
    this.setStatus(bot, 'starting');
    this.addLog(bot, 'system', `Starting ${bot.name}...`);
    this.addLog(bot, 'system', `  cwd: ${bot.cwd}`);
    this.addLog(bot, 'system', `  cmd: ${bot.command} ${bot.args.join(' ')}`);

    // Verify cwd
    if (!existsSync(bot.cwd)) {
      this.addLog(bot, 'system', `ERROR: Directory not found: ${bot.cwd}`);
      this.setStatus(bot, 'crashed', 'Directory not found');
      return;
    }

    const child = spawn(bot.command, bot.args, {
      cwd: bot.cwd,
      env: { ...process.env, ...bot.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached: false,
    });

    bot.child = child;
    bot.pid = child.pid ?? null;
    bot.exitCode = null;
    bot.startedAt = Date.now();
    bot.stoppedAt = null;

    // Stdout
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      for (const line of text.split('\n')) {
        if (line.trim()) this.addLog(bot, 'stdout', line);
      }
    });

    // Stderr
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      for (const line of text.split('\n')) {
        if (line.trim()) this.addLog(bot, 'stderr', line);
      }
    });

    // Process exit
    child.on('exit', (code, signal) => {
      bot.child = null;
      bot.exitCode = code;
      bot.stoppedAt = Date.now();
      const uptime = bot.startedAt ? Date.now() - bot.startedAt : 0;

      if (bot.status === 'stopping') {
        this.addLog(bot, 'system', `Stopped (signal: ${signal || 'none'})`);
        this.setStatus(bot, 'stopped');
        return;
      }

      this.addLog(bot, 'system', `Exited with code ${code} (signal: ${signal || 'none'}, uptime: ${Math.round(uptime / 1000)}s)`);

      if (bot.autoRestart && bot.restarts < bot.maxRestarts) {
        bot.restarts++;
        this.addLog(bot, 'system', `Auto-restart #${bot.restarts}/${bot.maxRestarts} in ${RESTART_DELAY_MS}ms...`);
        this.setStatus(bot, 'crashed', `Restarting (attempt ${bot.restarts})`);
        setTimeout(() => {
          if (bot.status === 'crashed' || bot.status === 'stopped') {
            this.spawnBot(bot);
          }
        }, RESTART_DELAY_MS);
      } else {
        this.setStatus(bot, 'crashed', code !== 0 ? `Exit code: ${code}` : 'Process ended');
      }
    });

    child.on('error', (err) => {
      bot.child = null;
      bot.stoppedAt = Date.now();
      this.addLog(bot, 'system', `Spawn error: ${err.message}`);
      this.setStatus(bot, 'crashed', err.message);
    });

    // Mark running after grace period
    setTimeout(() => {
      if (bot.child && bot.status === 'starting') {
        this.setStatus(bot, 'running');
      }
    }, STARTUP_GRACE_MS);
  }

  private async killProcess(bot: BotProcess): Promise<void> {
    if (!bot.child) {
      this.setStatus(bot, 'stopped');
      return;
    }

    return new Promise<void>((resolve) => {
      const child = bot.child!;

      const timeout = setTimeout(() => {
        // Force kill if SIGTERM didn't work
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
        this.setStatus(bot, 'stopped');
        bot.child = null;
        resolve();
      }, 10_000);

      child.once('exit', () => {
        clearTimeout(timeout);
        this.setStatus(bot, 'stopped');
        bot.child = null;
        resolve();
      });

      try {
        child.kill('SIGTERM');
      } catch {
        clearTimeout(timeout);
        this.setStatus(bot, 'stopped');
        bot.child = null;
        resolve();
      }
    });
  }

  private addLog(bot: BotProcess, stream: LogEntry['stream'], text: string): void {
    const entry: LogEntry = { timestamp: Date.now(), stream, text };
    bot.logs.push(entry);
    if (bot.logs.length > MAX_LOG_LINES) {
      bot.logs = bot.logs.slice(-MAX_LOG_LINES);
    }
    this.onLog?.(bot.id, entry);
  }

  private setStatus(bot: BotProcess, status: BotStatus, detail?: string): void {
    const prev = bot.status;
    bot.status = status;
    if (prev !== status) {
      this.onStatus?.(bot.id, status, detail);
    }
  }
}

// ── Serialization ─────────────────────────────────────────────────────

export interface BotInfo {
  id: string;
  name: string;
  cwd: string;
  status: BotStatus;
  pid: number | null;
  exitCode: number | null;
  startedAt: number | null;
  stoppedAt: number | null;
  restarts: number;
  autoRestart: boolean;
  maxRestarts: number;
  uptimeMs: number | null;
  logCount: number;
}

function serializeBotInfo(bot: BotProcess): BotInfo {
  return {
    id: bot.id,
    name: bot.name,
    cwd: bot.cwd,
    status: bot.status,
    pid: bot.pid,
    exitCode: bot.exitCode,
    startedAt: bot.startedAt,
    stoppedAt: bot.stoppedAt,
    restarts: bot.restarts,
    autoRestart: bot.autoRestart,
    maxRestarts: bot.maxRestarts,
    uptimeMs: bot.status === 'running' && bot.startedAt ? Date.now() - bot.startedAt : null,
    logCount: bot.logs.length,
  };
}
