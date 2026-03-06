// ── Outsiders Bot — Formatters ─────────────────────────────────────

import type { DbCall, LeaderboardEntry, TokenInfo } from './types.js';
import { calcRank } from './types.js';
import type { HardcoreStatus, UserStats } from './db.js';

// ── Helpers ────────────────────────────────────────────────────────

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtNum(n: number, decimals = 2): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(decimals)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtX(multiplier: number): string {
  return `${multiplier.toFixed(1)}x`;
}

function rankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function tierEmoji(tier: string): string {
  const map: Record<string, string> = {
    Oracle: '🏆', Guru: '💼', Contender: '⚖️', Novice: '🛠', Amateur: '🚧',
  };
  return map[tier] ?? '';
}

// ── Call Prompt ─────────────────────────────────────────────────────

export function formatCallSimple(
  token: TokenInfo,
  callType: string,
  callerName: string,
): string {
  const tag = callType === 'alpha' ? '🔵 ALPHA' : '🎰 GAMBLE';
  return [
    `${tag} <b>Call by ${esc(callerName)}</b>`,
    '',
    `🪙 <b>${esc(token.name)}</b> (${esc(token.symbol)})`,
    `💰 MCap: ${fmtNum(token.mcap)}`,
    `💲 Price: $${token.price.toFixed(8)}`,
    '',
    `🧬 <b>CA:</b> <code>${token.address}</code>`,
  ].join('\n');
}

export function formatCallAdvanced(
  token: TokenInfo,
  callType: string,
  callerName: string,
): string {
  const tag = callType === 'alpha' ? '🔵 ALPHA' : '🎰 GAMBLE';
  const age = token.pairAge
    ? token.pairAge < 3600
      ? `${Math.floor(token.pairAge / 60)}m`
      : `${Math.floor(token.pairAge / 3600)}h`
    : 'N/A';

  return [
    `${tag} <b>Call by ${esc(callerName)}</b>`,
    '',
    `🪙 <b>${esc(token.name)}</b> (${esc(token.symbol)})`,
    `💰 MCap: ${fmtNum(token.mcap)}`,
    `💲 Price: $${token.price.toFixed(8)}`,
    `💧 Liquidity: ${fmtNum(token.liquidity)}`,
    `📊 24h Volume: ${fmtNum(token.volume24h)}`,
    `⏱ Age: ${age}`,
    `⛓ Chain: ${token.chain}`,
    '',
    `🧬 <b>CA:</b> <code>${token.address}</code>`,
  ].join('\n');
}

// ── Leaderboard ────────────────────────────────────────────────────

export function formatCallsLeaderboard(
  entries: LeaderboardEntry[],
  timeframe: string,
): string {
  if (entries.length === 0) return '📊 No calls found for this period.';

  const rows = entries.map(
    (e) => `${rankEmoji(e.rank)} @${esc(e.username)} — <b>${fmtX(e.value)}</b>`,
  );

  return [
    `🏆 <b>Top Calls — ${timeframe}</b>`,
    '',
    ...rows,
  ].join('\n');
}

export function formatPerformanceLeaderboard(
  entries: LeaderboardEntry[],
  timeframe: string,
): string {
  if (entries.length === 0) return '📊 No performance data for this period.';

  const rows = entries.map(
    (e) =>
      `${rankEmoji(e.rank)} @${esc(e.username)} — <b>${e.value} pts</b> | ${e.callCount} calls | ${e.winRate}% WR | ${fmtX(e.avgGain)} avg`,
  );

  return [
    `⭐ <b>Performance Leaderboard — ${timeframe}</b>`,
    '',
    ...rows,
  ].join('\n');
}

// ── Last Calls ─────────────────────────────────────────────────────

export function formatLastCalls(
  calls: (DbCall & { username: string; first_name: string })[],
): string {
  if (calls.length === 0) return 'No recent calls.';

  const rows = calls.map((c, i) => {
    const name = c.username ? `@${esc(c.username)}` : esc(c.first_name);
    return `${i + 1}. ${name} — <code>${c.token_address.slice(0, 8)}…</code> ${fmtX(c.multiplier)} (${c.call_type})`;
  });

  return [`📋 <b>Last ${calls.length} Calls</b>`, '', ...rows].join('\n');
}

// ── User Stats ─────────────────────────────────────────────────────

export function formatUserStats(username: string, stats: UserStats): string {
  return [
    `📊 <b>Stats for @${esc(username)}</b>`,
    '',
    `${tierEmoji(stats.rank)} Rank: <b>${stats.rank}</b>`,
    `📈 Calls: ${stats.totalCalls}`,
    `✅ Wins (≥2x): ${stats.wins}`,
    `🎯 Win Rate: ${stats.winRate}%`,
    `📊 Avg Gain: ${fmtX(stats.avgGain)}`,
    `🏅 Best: ${fmtX(stats.bestMultiplier)}`,
    `⭐ Points: ${stats.totalPoints}`,
  ].join('\n');
}

// ── Hardcore ───────────────────────────────────────────────────────

export function formatHardcoreStatus(statuses: HardcoreStatus[], minWr: number): string {
  if (statuses.length === 0) return '⚔️ No qualifying members in this round yet.';

  const rows = statuses.map((s) => {
    const icon = s.atRisk ? '🔴' : '🟢';
    return `${icon} @${esc(s.username)} — ${s.winRate}% WR (${s.calls} calls)`;
  });

  return [
    `⚔️ <b>Hardcore Mode — Min ${minWr}% WR</b>`,
    '',
    ...rows,
    '',
    `🔴 = at risk of removal`,
  ].join('\n');
}

// ── PNL Text (fallback if image gen unavailable) ───────────────────

export function formatPnlText(call: DbCall, tokenName: string, callerName: string): string {
  return [
    `📊 <b>PNL — ${esc(tokenName)}</b>`,
    '',
    `👤 Caller: ${esc(callerName)}`,
    `💰 MCap at call: ${fmtNum(call.mcap_at_call)}`,
    `🚀 ATH MCap: ${fmtNum(call.ath_mcap)}`,
    `📈 Gain: <b>${fmtX(call.multiplier)}</b> (${((call.multiplier - 1) * 100).toFixed(0)}%)`,
    `📅 Called: ${call.created_at}`,
  ].join('\n');
}

// ── Settings ───────────────────────────────────────────────────────

export function formatSettings(
  callMode: string,
  displayMode: string,
  hardcoreEnabled: boolean,
  hardcoreMinWr: number,
  hardcoreMinCalls: number,
): string {
  return [
    `⚙️ <b>Group Settings</b>`,
    '',
    `📞 Call Mode: <b>${callMode}</b>`,
    `📋 Display Mode: <b>${displayMode}</b>`,
    `⚔️ Hardcore: <b>${hardcoreEnabled ? 'ON' : 'OFF'}</b>`,
    hardcoreEnabled ? `   ↳ Min WR: ${hardcoreMinWr}% | Min Calls: ${hardcoreMinCalls}` : '',
  ].filter(Boolean).join('\n');
}
