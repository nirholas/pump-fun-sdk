// ── PumpFun Swarm — Bot Manager ────────────────────────────────────
//
// Manages bot lifecycle: spawn, stop, restart, health check.
// Each bot runs as a child process with stdout/stderr captured
// and piped into the event bus as log events.
// ──────────────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createLogger } from './logger.js';
import { EventBus } from './event-bus.js';
import type {
  BotDefinition,
  BotEnvConfig,
  BotHealth,
  BotId,
  BotMetrics,
  BotStatus,
} from './types.js';

const log = createLogger('bot-manager');

// ── Bot Definitions ─────────────────────────────────────────────────

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

export const BOT_DEFINITIONS: Record<BotId, BotDefinition> = {
  'telegram-bot': {
    id: 'telegram-bot',
    name: 'PumpFun Fee Monitor',
    description: 'Monitors creator fees, CTO alerts, whale trades. Supports DMs, groups, REST API.',
    directory: resolve(PROJECT_ROOT, 'telegram-bot'),
    startCommand: 'node dist/index.js',
    healthEndpoint: null,
    port: 3000,
    envFile: '.env',
    requiredEnvVars: ['TELEGRAM_BOT_TOKEN', 'SOLANA_RPC_URL'],
    optionalEnvVars: ['API_ONLY', 'API_KEYS', 'ALLOWED_USER_IDS', 'ENABLE_LAUNCH_MONITOR'],
  },
  'outsiders-bot': {
    id: 'outsiders-bot',
    name: 'Outsiders Call Tracker',
    description: 'Call tracking with leaderboards, PNL cards, win rates, hardcore mode.',
    directory: resolve(PROJECT_ROOT, 'outsiders-bot'),
    startCommand: 'node dist/index.js',
    healthEndpoint: null,
    port: null,
    envFile: '.env',
    requiredEnvVars: ['TELEGRAM_BOT_TOKEN'],
    optionalEnvVars: ['CALL_CHANNEL_ID', 'DEXSCREENER_API', 'ATH_POLL_INTERVAL', 'DB_PATH'],
  },
  'channel-bot': {
    id: 'channel-bot',
    name: 'Channel Feed Bot',
    description: 'Read-only Telegram channel feed: launches, graduations, whales, fee claims.',
    directory: resolve(PROJECT_ROOT, 'channel-bot'),
    startCommand: 'node dist/index.js',
    healthEndpoint: null,
    port: null,
    envFile: '.env',
    requiredEnvVars: ['TELEGRAM_BOT_TOKEN', 'CHANNEL_ID', 'SOLANA_RPC_URL'],
    optionalEnvVars: ['FEED_CLAIMS', 'FEED_LAUNCHES', 'FEED_GRADUATIONS', 'FEED_WHALES'],
  },
  'websocket-server': {
    id: 'websocket-server',
    name: 'WebSocket Relay',
    description: 'Real-time token launch broadcasts via WebSocket to browser clients.',
    directory: resolve(PROJECT_ROOT, 'websocket-server'),
    startCommand: 'node dist/server.js',
    healthEndpoint: '/health',
    port: 3099,
    envFile: '.env',
    requiredEnvVars: [],
    optionalEnvVars: ['PORT', 'SOLANA_RPC_WS'],
  },
  'swarm-bot': {
    id: 'swarm-bot',
    name: 'Trading Bot Swarm',
    description: 'Multi-strategy trading bots: sniper, momentum, graduation, market-maker. Real-time position tracking.',
    directory: resolve(PROJECT_ROOT, 'swarm-bot'),
    startCommand: 'node dist/index.js',
    healthEndpoint: '/health',
    port: 3100,
    envFile: '.env',
    requiredEnvVars: ['SOLANA_RPC_URL'],
    optionalEnvVars: ['MAX_POSITION_SOL_PER_BOT', 'MAX_TOTAL_POSITION_SOL', 'DEFAULT_SLIPPAGE_BPS', 'DB_PATH', 'PORT'],
  },
};

// ── Bot Instance State ──────────────────────────────────────────────

interface BotInstance {
  definition: BotDefinition;
  process: ChildProcess | null;
  status: BotStatus;
  startedAt: number | null;
  restarts: number;
  lastError: string | null;
  lastErrorAt: string | null;
  metrics: BotMetrics;
  logBuffer: string[];
}

const MAX_LOG_BUFFER = 500;

// ── Bot Manager ─────────────────────────────────────────────────────

export class BotManager {
  private bots = new Map<BotId, BotInstance>();
  private eventBus: EventBus;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckMs: number;

  constructor(eventBus: EventBus, healthCheckMs = 10_000) {
    this.eventBus = eventBus;
    this.healthCheckMs = healthCheckMs;

    // Initialize all bot instances
    for (const [id, def] of Object.entries(BOT_DEFINITIONS)) {
      this.bots.set(id as BotId, {
        definition: def,
        process: null,
        status: 'stopped',
        startedAt: null,
        restarts: 0,
        lastError: null,
        lastErrorAt: null,
        metrics: {
          eventsProcessed: 0,
          eventsEmitted: 0,
          errorsTotal: 0,
          lastEventAt: null,
          custom: {},
        },
        logBuffer: [],
      });
    }
  }

  /** Start health check polling */
  startHealthChecks(): void {
    if (this.healthInterval) return;
    this.healthInterval = setInterval(() => this.checkAllHealth(), this.healthCheckMs);
    log.info(`Health checks started (every ${this.healthCheckMs}ms)`);
  }

  /** Stop health check polling */
  stopHealthChecks(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  /** Start a bot */
  async start(botId: BotId): Promise<void> {
    const instance = this.bots.get(botId);
    if (!instance) throw new Error(`Unknown bot: ${botId}`);
    if (instance.status === 'running' || instance.status === 'starting') {
      log.warn(`${botId} is already ${instance.status}`);
      return;
    }

    const def = instance.definition;

    // Verify directory exists
    if (!existsSync(def.directory)) {
      throw new Error(`Bot directory not found: ${def.directory}`);
    }

    // Verify dist exists (bot must be built)
    const distDir = resolve(def.directory, 'dist');
    if (!existsSync(distDir)) {
      log.warn(`${botId}: dist/ not found, attempting build…`);
      await this.buildBot(botId);
    }

    // Load environment from bot's .env file
    const envFile = resolve(def.directory, def.envFile);
    const env: Record<string, string> = { ...process.env as Record<string, string> };
    if (existsSync(envFile)) {
      const envContent = readFileSync(envFile, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }

    // Check required env vars
    const missing = def.requiredEnvVars.filter(v => !env[v]);
    if (missing.length > 0) {
      throw new Error(`${botId}: Missing required env vars: ${missing.join(', ')}`);
    }

    instance.status = 'starting';
    this.emitBotEvent(botId, 'bot:started', { botId, phase: 'starting' });

    try {
      const [cmd, ...args] = def.startCommand.split(' ');
      const child = spawn(cmd, args, {
        cwd: def.directory,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      instance.process = child;
      instance.startedAt = Date.now();

      // Capture stdout
      child.stdout?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          this.appendLog(botId, 'info', line);
          this.parseAndForwardEvent(botId, line);
        }
      });

      // Capture stderr
      child.stderr?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          this.appendLog(botId, 'error', line);
        }
      });

      // Handle exit
      child.on('exit', (code, signal) => {
        const prev = instance.status;
        instance.status = 'stopped';
        instance.process = null;

        if (code !== 0 && prev === 'running') {
          instance.lastError = `Exited with code ${code}, signal ${signal}`;
          instance.lastErrorAt = new Date().toISOString();
          instance.metrics.errorsTotal++;
          instance.status = 'error';
          this.emitBotEvent(botId, 'bot:error', {
            botId,
            error: instance.lastError,
            fatal: true,
          });
        }

        this.emitBotEvent(botId, 'bot:stopped', { botId, exitCode: code, signal });
        log.info(`${botId} exited (code=${code}, signal=${signal})`);
      });

      child.on('error', (err) => {
        instance.status = 'error';
        instance.lastError = err.message;
        instance.lastErrorAt = new Date().toISOString();
        instance.metrics.errorsTotal++;
        instance.process = null;
        this.emitBotEvent(botId, 'bot:error', {
          botId,
          error: err.message,
          fatal: true,
        });
        log.error(`${botId} process error: ${err.message}`);
      });

      // Wait a moment for the process to actually start
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (instance.process && !child.killed) {
        instance.status = 'running';
        this.emitBotEvent(botId, 'bot:started', { botId, pid: child.pid });
        log.info(`${botId} started (pid=${child.pid})`);
      }
    } catch (err) {
      instance.status = 'error';
      instance.lastError = String(err);
      instance.lastErrorAt = new Date().toISOString();
      throw err;
    }
  }

  /** Stop a bot */
  async stop(botId: BotId): Promise<void> {
    const instance = this.bots.get(botId);
    if (!instance || !instance.process) {
      log.warn(`${botId} is not running`);
      return;
    }

    instance.status = 'stopping';
    log.info(`Stopping ${botId}…`);

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        instance.process?.kill('SIGKILL');
        resolve();
      }, 10_000);

      instance.process!.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      instance.process!.kill('SIGTERM');
    });
  }

  /** Restart a bot */
  async restart(botId: BotId): Promise<void> {
    const instance = this.bots.get(botId);
    if (!instance) throw new Error(`Unknown bot: ${botId}`);

    await this.stop(botId);
    instance.restarts++;
    await this.start(botId);
  }

  /** Build a bot (compile TypeScript) */
  async buildBot(botId: BotId): Promise<string> {
    const instance = this.bots.get(botId);
    if (!instance) throw new Error(`Unknown bot: ${botId}`);

    const def = instance.definition;
    log.info(`Building ${botId}…`);

    return new Promise<string>((resolve, reject) => {
      const child = spawn('npx', ['tsc'], {
        cwd: def.directory,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); });

      child.on('exit', (code) => {
        if (code === 0) {
          log.info(`${botId} built successfully`);
          resolve(output);
        } else {
          log.error(`${botId} build failed:\n${output}`);
          reject(new Error(`Build failed for ${botId}:\n${output}`));
        }
      });
    });
  }

  /** Get health for a specific bot */
  getHealth(botId: BotId): BotHealth {
    const instance = this.bots.get(botId);
    if (!instance) throw new Error(`Unknown bot: ${botId}`);

    return {
      status: instance.status,
      uptime: instance.startedAt ? (Date.now() - instance.startedAt) / 1000 : 0,
      pid: instance.process?.pid ?? null,
      cpu: 0,
      memory: 0,
      restarts: instance.restarts,
      lastError: instance.lastError,
      lastErrorAt: instance.lastErrorAt,
      lastHealthCheck: new Date().toISOString(),
      healthEndpoint: instance.definition.healthEndpoint,
      metrics: { ...instance.metrics },
    };
  }

  /** Get health for all bots */
  getAllHealth(): Record<BotId, BotHealth> {
    const result: Record<string, BotHealth> = {};
    for (const [id] of this.bots) {
      result[id] = this.getHealth(id);
    }
    return result as Record<BotId, BotHealth>;
  }

  /** Get bot definition */
  getDefinition(botId: BotId): BotDefinition {
    const def = BOT_DEFINITIONS[botId];
    if (!def) throw new Error(`Unknown bot: ${botId}`);
    return def;
  }

  /** Get all definitions */
  getAllDefinitions(): BotDefinition[] {
    return Object.values(BOT_DEFINITIONS);
  }

  /** Get log buffer for a bot */
  getLogs(botId: BotId, limit = 100): string[] {
    const instance = this.bots.get(botId);
    if (!instance) return [];
    return instance.logBuffer.slice(-limit);
  }

  /** Stop all bots */
  async stopAll(): Promise<void> {
    const running = [...this.bots.entries()]
      .filter(([, inst]) => inst.status === 'running')
      .map(([id]) => id);

    await Promise.all(running.map(id => this.stop(id)));
    this.stopHealthChecks();
  }

  /** Check health of all running bots via their health endpoints */
  private async checkAllHealth(): Promise<void> {
    for (const [botId, instance] of this.bots) {
      if (instance.status !== 'running') continue;

      // Process-level check: is the child still alive?
      if (!instance.process || instance.process.killed) {
        instance.status = 'error';
        instance.lastError = 'Process died unexpectedly';
        instance.lastErrorAt = new Date().toISOString();
        this.emitBotEvent(botId, 'bot:error', {
          botId,
          error: 'Process died',
          fatal: true,
        });
        continue;
      }

      // HTTP health check for bots that expose an endpoint
      const def = instance.definition;
      if (def.healthEndpoint && def.port) {
        try {
          const resp = await fetch(`http://localhost:${def.port}${def.healthEndpoint}`);
          if (!resp.ok) {
            this.appendLog(botId, 'warn', `Health check returned ${resp.status}`);
          }
          instance.metrics.custom['health_status'] = resp.status;
        } catch {
          this.appendLog(botId, 'warn', 'Health check failed (connection refused)');
          instance.metrics.custom['health_status'] = 0;
        }
      }

      this.emitBotEvent(botId, 'bot:health', this.getHealth(botId));
    }
  }

  /** Parse bot stdout for known event patterns and forward to event bus */
  private parseAndForwardEvent(botId: BotId, line: string): void {
    const instance = this.bots.get(botId);
    if (!instance) return;

    instance.metrics.eventsProcessed++;
    instance.metrics.lastEventAt = new Date().toISOString();

    // Detect token launches from websocket-server
    if (line.includes('Token launch:') || line.includes('token-launch')) {
      instance.metrics.eventsEmitted++;
      this.eventBus.emit('token:launch', botId, { raw: line });
    }

    // Detect fee claims from telegram-bot
    if (line.includes('Fee claim') || line.includes('claim detected')) {
      instance.metrics.eventsEmitted++;
      this.eventBus.emit('fee:claim', botId, { raw: line });
    }

    // Detect whale trades
    if (line.includes('whale') || line.includes('Whale')) {
      instance.metrics.eventsEmitted++;
      this.eventBus.emit('alert:whale', botId, { raw: line });
    }

    // Detect calls from outsiders-bot
    if (line.includes('Call registered:')) {
      instance.metrics.eventsEmitted++;
      this.eventBus.emit('call:new', botId, { raw: line });
    }

    // Detect graduations
    if (line.includes('graduation') || line.includes('Graduation')) {
      instance.metrics.eventsEmitted++;
      this.eventBus.emit('token:graduation', botId, { raw: line });
    }

    // Detect errors
    if (line.includes('ERROR') || line.includes('Error') || line.includes('error')) {
      instance.metrics.errorsTotal++;
    }
  }

  /** Append to the log buffer and emit a log event */
  private appendLog(botId: BotId, level: 'info' | 'error' | 'warn', message: string): void {
    const instance = this.bots.get(botId);
    if (!instance) return;

    const ts = new Date().toISOString();
    const entry = `[${ts}] [${level.toUpperCase()}] ${message}`;
    instance.logBuffer.push(entry);
    if (instance.logBuffer.length > MAX_LOG_BUFFER) {
      instance.logBuffer.splice(0, instance.logBuffer.length - MAX_LOG_BUFFER);
    }

    this.eventBus.emit('bot:log', botId, {
      botId,
      level,
      message,
      timestamp: ts,
    });
  }

  // ── Env Config Management ───────────────────────────────────────

  /** Read the current .env file for a bot (values masked for secrets) */
  getEnvConfig(botId: BotId): BotEnvConfig {
    const def = BOT_DEFINITIONS[botId];
    if (!def) throw new Error(`Unknown bot: ${botId}`);

    const envFile = resolve(def.directory, def.envFile);
    const current: Record<string, string> = {};

    if (existsSync(envFile)) {
      const content = readFileSync(envFile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        current[key] = value;
      }
    }

    return {
      botId,
      current,
      required: def.requiredEnvVars,
      optional: def.optionalEnvVars,
    };
  }

  /** Write env vars to a bot's .env file. Merges with existing values. */
  setEnvConfig(botId: BotId, updates: Record<string, string>): void {
    const def = BOT_DEFINITIONS[botId];
    if (!def) throw new Error(`Unknown bot: ${botId}`);

    // Validate keys - only allow alphanumeric + underscore
    for (const key of Object.keys(updates)) {
      if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
        throw new Error(`Invalid env var name: ${key}`);
      }
    }

    const envFile = resolve(def.directory, def.envFile);
    const existing = this.getEnvConfig(botId).current;
    const merged = { ...existing, ...updates };

    // Remove keys with empty values
    for (const [key, value] of Object.entries(merged)) {
      if (value === '' || value === undefined) {
        delete merged[key];
      }
    }

    const lines = Object.entries(merged).map(([key, value]) => {
      // Quote values that contain spaces or special chars
      if (/[\s#"']/.test(value)) {
        return `${key}="${value}"`;
      }
      return `${key}=${value}`;
    });

    writeFileSync(envFile, lines.join('\n') + '\n', { mode: 0o600 });
    log.info(`Updated env config for ${botId} (${Object.keys(updates).length} vars)`);
    this.emitBotEvent(botId, 'bot:log', {
      botId,
      level: 'info',
      message: `Env config updated: ${Object.keys(updates).join(', ')}`,
      timestamp: new Date().toISOString(),
    });
  }

  /** Check if a bot directory has a dist/ folder (is built) */
  isBotBuilt(botId: BotId): boolean {
    const def = BOT_DEFINITIONS[botId];
    if (!def) return false;
    return existsSync(resolve(def.directory, 'dist'));
  }

  /** Emit a typed bot event */
  private emitBotEvent(botId: BotId, type: import('./types.js').SwarmEventType, data: unknown): void {
    this.eventBus.emit(type, botId, data);
  }
}
