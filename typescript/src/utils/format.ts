/**
 * @fileoverview Formatting utilities for display and output.
 * @module utils/format
 */

/**
 * Formats a number with thousands separators.
 *
 * @param num - The number to format
 * @returns Formatted string with separators
 *
 * @example
 * formatNumber(1234567) // "1,234,567"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable duration string
 *
 * @example
 * formatDuration(65000) // "1m 5.0s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return `${days}d ${remainingHours}h`;
}

/**
 * Formats a rate (per second) to a human-readable string.
 *
 * @param rate - Rate per second
 * @returns Formatted rate string
 *
 * @example
 * formatRate(1234.5) // "1,235/sec"
 */
export function formatRate(rate: number): string {
  if (rate < 1000) {
    return `${Math.round(rate)}/sec`;
  }

  if (rate < 1000000) {
    return `${(rate / 1000).toFixed(1)}K/sec`;
  }

  return `${(rate / 1000000).toFixed(2)}M/sec`;
}

/**
 * Formats a percentage with appropriate decimal places.
 *
 * @param value - The decimal value (0-1)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 *
 * @example
 * formatPercent(0.1234) // "12.34%"
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Formats bytes to a human-readable size.
 *
 * @param bytes - Number of bytes
 * @returns Human-readable size string
 *
 * @example
 * formatBytes(1536) // "1.5 KB"
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const unit = units[unitIndex] ?? 'B';
  return `${size.toFixed(1)} ${unit}`;
}

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated string
 *
 * @example
 * truncate("Hello, World!", 10) // "Hello, ..."
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.substring(0, maxLength - 3)}...`;
}

/**
 * Formats a Solana address for display, showing only start and end.
 *
 * @param address - The full address
 * @param startChars - Number of characters to show at start
 * @param endChars - Number of characters to show at end
 * @returns Formatted address string
 *
 * @example
 * formatAddress("11111111111111111111111111111111") // "1111...1111"
 */
export function formatAddress(
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * Pads a string to a minimum length.
 *
 * @param str - The string to pad
 * @param length - Minimum length
 * @param char - Character to use for padding
 * @param position - 'start' or 'end'
 * @returns Padded string
 */
export function padString(
  str: string,
  length: number,
  char: string = ' ',
  position: 'start' | 'end' = 'end'
): string {
  if (str.length >= length) {
    return str;
  }

  const padding = char.repeat(length - str.length);
  return position === 'start' ? padding + str : str + padding;
}

/**
 * Creates a progress bar string.
 *
 * @param progress - Progress value (0-1)
 * @param width - Total width of the bar
 * @returns Progress bar string
 *
 * @example
 * progressBar(0.5, 20) // "[=========          ]"
 */
export function progressBar(progress: number, width: number = 20): string {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const filled = Math.round(clampedProgress * width);
  const empty = width - filled;

  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

/**
 * Formats an expected time estimate based on attempts and rate.
 *
 * @param expectedAttempts - Expected number of attempts
 * @param currentAttempts - Current number of attempts
 * @param rate - Current rate per second
 * @returns Formatted estimate string
 */
export function formatEstimate(
  expectedAttempts: number,
  currentAttempts: number,
  rate: number
): string {
  if (rate <= 0) {
    return 'calculating...';
  }

  const remainingAttempts = Math.max(0, expectedAttempts - currentAttempts);
  const remainingMs = (remainingAttempts / rate) * 1000;

  return formatDuration(remainingMs);
}

/**
 * Creates a formatted table row for CLI output.
 *
 * @param cells - Array of cell values
 * @param widths - Array of column widths
 * @returns Formatted row string
 */
export function tableRow(cells: string[], widths: number[]): string {
  return cells.map((cell, i) => padString(cell, widths[i] ?? cell.length)).join(' | ');
}

/**
 * Creates a separator line for tables.
 *
 * @param widths - Array of column widths
 * @returns Separator string
 */
export function tableSeparator(widths: number[]): string {
  return widths.map((w) => '-'.repeat(w)).join('-+-');
}
