/**
 * @pumpkit/web — Shared types for the dashboard UI.
 *
 * These types represent the API responses and data models
 * that the frontend will consume from PumpKit bot APIs.
 *
 * EventType is re-exported from lib/types.ts — the canonical definition.
 */

export type { EventType } from './lib/types';

// ── Bot Health ──────────────────────────────────────────

export interface BotStatus {
  name: "monitor" | "tracker" | "channel" | "claim";
  status: "online" | "offline" | "error";
  uptime: number;
  lastEvent: string | null;
  version: string;
  activeCalls?: number;
  watchedWallets?: number;
}

// ── Monitor Events ──────────────────────────────────────

export interface MonitorEvent {
  id: string;
  type: EventType;
  timestamp: string;
  mint?: string;
  creator?: string;
  amountLamports?: string;
  amountSol?: string;
  txSignature: string;
  tokenName?: string;
  tokenSymbol?: string;
}

// ── Watched Wallets ─────────────────────────────────────

export interface WatchedWallet {
  address: string;
  label?: string;
  addedAt: string;
  lastClaim?: string;
  totalClaims: number;
}

// ── Tracker Leaderboard ─────────────────────────────────

export type RankTier =
  | "Amateur"
  | "Novice"
  | "Contender"
  | "Guru"
  | "Oracle";

export type Timeframe = "24h" | "7d" | "30d" | "all";

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

export type Chain = "solana" | "ethereum" | "base" | "bsc";

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
  callType: "alpha" | "gamble";
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
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface TrackerSettings {
  callMode: "auto" | "button";
  displayMode: "simple" | "advanced";
  hardcoreEnabled: boolean;
  hardcoreMinWinRate: number;
  athPollInterval: number;
}

// ── API Responses (UI-side simplified shapes) ───────────
// For full API response types, see lib/types.ts

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface HealthResponse {
  status: "ok" | "error";
  uptime: number;
  startedAt: string;
  stats: Record<string, unknown>;
}
