// ── Lair-TG — Formatters ──────────────────────────────────────────

import type { TokenInfo, WalletBalance, PriceAlert } from './types.js';

/** Format a token info card for Telegram (HTML). */
export function formatTokenInfo(token: TokenInfo): string {
  const price = token.priceUsd != null ? `$${token.priceUsd.toFixed(8)}` : 'N/A';
  const mcap = token.marketCapUsd != null ? `$${formatNumber(token.marketCapUsd)}` : 'N/A';
  const vol = token.volume24h != null ? `$${formatNumber(token.volume24h)}` : 'N/A';
  const change = token.priceChange24h != null
    ? `${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`
    : 'N/A';

  return [
    `<b>${escapeHtml(token.name)} (${escapeHtml(token.symbol)})</b>`,
    '',
    `Price: <code>${price}</code>`,
    `MCap: <code>${mcap}</code>`,
    `24h Vol: <code>${vol}</code>`,
    `24h Change: <code>${change}</code>`,
    '',
    `<code>${token.address}</code>`,
  ].join('\n');
}

/** Format wallet balance for Telegram (HTML). */
export function formatWalletBalance(wallet: WalletBalance): string {
  const lines = [
    `<b>Wallet Balance</b>`,
    `<code>${wallet.address}</code>`,
    '',
    `SOL: <code>${wallet.solBalance.toFixed(4)}</code>`,
  ];

  if (wallet.tokens.length > 0) {
    lines.push('', '<b>Tokens:</b>');
    for (const t of wallet.tokens.slice(0, 10)) {
      const value = t.valueUsd != null ? ` ($${formatNumber(t.valueUsd)})` : '';
      lines.push(`  ${escapeHtml(t.symbol)}: <code>${t.amount}</code>${value}`);
    }
    if (wallet.tokens.length > 10) {
      lines.push(`  … and ${wallet.tokens.length - 10} more`);
    }
  }

  return lines.join('\n');
}

/** Format a price alert notification. */
export function formatAlertTriggered(alert: PriceAlert, currentPrice: number): string {
  return [
    `<b>Price Alert Triggered!</b>`,
    '',
    `${escapeHtml(alert.symbol)} is now ${alert.condition} $${alert.targetPrice}`,
    `Current price: <code>$${currentPrice.toFixed(8)}</code>`,
    '',
    `<code>${alert.tokenAddress}</code>`,
  ].join('\n');
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
