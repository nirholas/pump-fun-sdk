/**
 * @pumpkit/web — Shared types for the dashboard UI.
 *
 * Re-exports API types from lib/types.ts and adds UI-specific types
 * for tracker, settings, and bot status.
 */

// Re-export all API types as the canonical source
export type {
  EventType,
  BaseEvent,
  ClaimEvent,
  LaunchEvent,
  GraduationEvent,
  WhaleEvent,
  CTOEvent,
  DistributionEvent,
  PumpEvent,
  HealthResponse,
  WatchResponse,
  PaginatedResponse,
} from './lib/types';

// ── Bot Health ──────────────────────────────────────────

export interface BotStatus {
  name: 'monitor' | 'tracker' | 'channel' | 'claim';
  status: 'online' | 'offline' | 'error';
  uptime: number;
  lastEvent: string | null;
  version: string;
  activeCalls?: number;
  watchedWallets?: number;
}

// ── Tracker Leaderboard ─────────────────────────────────

export type RankTier = 'Amateur' | 'Novice' | 'Contender' | 'Guru' | 'Oracle';

export type Timeframe = '24h' | '7d' | '30d' | 'all';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  telegramId: number;
  totalCalls: number;
  avgMultiplier: number;
  bestMultiplier: number;
  winRate: number;
  points: number;
  tier: RankTier;
}

// ── Active Calls ────────────────────────────────────────

export type Chain = 'solana' | 'ethereum' | 'base' | 'bsc';

export interface ActiveCall {
  id: number;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  chain: Chain;
  callerUsername: string;
  entryPrice: number;
  currentPrice: number;
  athPrice: number;
  multiplier: number;
  calledAt: string;
  callType: 'alpha' | 'gamble';
}

// ── Settings ────────────────────────────────────────────

export interface MonitorSettings {
  solanaRpcUrl: string;
  solanaRpcUrls: string[];
  pollIntervalSeconds: number;
  enableLaunchMonitor: boolean;
  enableGraduationAlerts: boolean;
  enableTradeAlerts: boolean;
  enableFeeDistributionAlerts: boolean;
  whaleThresholdSol: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface TrackerSettings {
  callMode: 'auto' | 'button';
  displayMode: 'simple' | 'advanced';
  hardcoreEnabled: boolean;
  hardcoreMinWinRate: number;
  athPollInterval: number;
}
