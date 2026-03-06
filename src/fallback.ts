/**
 * Fallback utilities for RPC connections and HTTP API calls.
 *
 * Provides automatic failover across multiple endpoints with exponential
 * backoff, health tracking, and configurable retry policies.
 */

import { Connection, type ConnectionConfig } from "@solana/web3.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface FallbackConfig {
  /** Max retries per endpoint before moving to the next (default: 2) */
  maxRetriesPerEndpoint?: number;
  /** Base delay in ms for exponential backoff (default: 500) */
  baseDelayMs?: number;
  /** Request timeout in ms (default: 10_000) */
  timeoutMs?: number;
  /** Time in ms before a failed endpoint is reconsidered (default: 60_000) */
  cooldownMs?: number;
}

interface EndpointHealth {
  consecutiveFailures: number;
  lastFailureAt: number;
}

const DEFAULT_CONFIG: Required<FallbackConfig> = {
  maxRetriesPerEndpoint: 2,
  baseDelayMs: 500,
  timeoutMs: 10_000,
  cooldownMs: 60_000,
};

// ─── Fallback Connection ────────────────────────────────────────────────

/**
 * Creates a Solana `Connection` that automatically fails over to backup
 * RPC endpoints when the primary is unreachable or rate-limited.
 *
 * Under the hood it uses a round-robin strategy: on each RPC failure the
 * next healthy endpoint is selected. Unhealthy endpoints are placed on a
 * cooldown timer before being retried.
 *
 * @example
 * ```ts
 * const connection = createFallbackConnection([
 *   'https://my-primary-rpc.com',
 *   'https://api.mainnet-beta.solana.com',
 *   'https://solana-mainnet.g.alchemy.com/v2/KEY',
 * ]);
 * const sdk = new OnlinePumpSdk(connection);
 * ```
 */
export function createFallbackConnection(
  endpoints: string[],
  connectionConfig?: ConnectionConfig,
  fallbackConfig?: FallbackConfig,
): Connection {
  if (endpoints.length === 0) {
    throw new Error("At least one RPC endpoint is required");
  }

  if (endpoints.length === 1) {
    return new Connection(endpoints[0], connectionConfig);
  }

  const config = { ...DEFAULT_CONFIG, ...fallbackConfig };
  const health = new Map<string, EndpointHealth>();

  for (const ep of endpoints) {
    health.set(ep, { consecutiveFailures: 0, lastFailureAt: 0 });
  }

  let currentIndex = 0;

  function getNextHealthyEndpoint(): string {
    const now = Date.now();
    // Try all endpoints starting from current
    for (let i = 0; i < endpoints.length; i++) {
      const idx = (currentIndex + i) % endpoints.length;
      const ep = endpoints[idx];
      const h = health.get(ep)!;

      // Endpoint is healthy or cooldown has elapsed
      if (
        h.consecutiveFailures === 0 ||
        now - h.lastFailureAt >= config.cooldownMs
      ) {
        currentIndex = idx;
        return ep;
      }
    }
    // All degraded — use the one with the oldest failure
    let bestIdx = 0;
    let oldestFailure = Infinity;
    for (let i = 0; i < endpoints.length; i++) {
      const h = health.get(endpoints[i])!;
      if (h.lastFailureAt < oldestFailure) {
        oldestFailure = h.lastFailureAt;
        bestIdx = i;
      }
    }
    currentIndex = bestIdx;
    return endpoints[bestIdx];
  }

  function markFailure(ep: string): void {
    const h = health.get(ep)!;
    h.consecutiveFailures++;
    h.lastFailureAt = Date.now();
  }

  function markSuccess(ep: string): void {
    const h = health.get(ep)!;
    h.consecutiveFailures = 0;
  }

  // Build a Connection pointing to the first endpoint, then proxy its
  // internal fetch to support failover.
  const connection = new Connection(endpoints[0], connectionConfig);

  // Wrap the RPC request method to add failover logic
  const originalRpcRequest = (connection as any)._rpcRequest;
  if (typeof originalRpcRequest === "function") {
    (connection as any)._rpcRequest = async function (
      method: string,
      args: any[],
    ) {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < endpoints.length; attempt++) {
        const ep = getNextHealthyEndpoint();

        // Point the connection at the current endpoint
        (connection as any)._rpcEndpoint = ep;
        (connection as any)._rpcWsEndpoint = deriveWsEndpoint(ep);

        for (
          let retry = 0;
          retry <= config.maxRetriesPerEndpoint;
          retry++
        ) {
          try {
            const result = await originalRpcRequest.call(
              connection,
              method,
              args,
            );
            markSuccess(ep);
            return result;
          } catch (err: any) {
            lastError = err;

            // Don't retry on non-retryable errors
            if (isNonRetryableError(err)) {
              throw err;
            }

            if (retry < config.maxRetriesPerEndpoint) {
              await sleep(config.baseDelayMs * 2 ** retry);
            }
          }
        }

        // All retries for this endpoint exhausted
        markFailure(ep);
        currentIndex = (currentIndex + 1) % endpoints.length;
      }

      throw lastError ?? new Error("All RPC endpoints failed");
    };
  }

  return connection;
}

// ─── Fallback Fetch ─────────────────────────────────────────────────────

/**
 * Tries multiple API base URLs in order until one succeeds.
 *
 * @example
 * ```ts
 * const data = await fetchWithFallback(
 *   [
 *     'https://frontend-api-v3.pump.fun',
 *     'https://frontend-api-v2.pump.fun',
 *   ],
 *   '/coins?offset=0&limit=50&sort=created_timestamp&order=DESC',
 *   { headers: { 'Accept': 'application/json' } },
 * );
 * ```
 */
export async function fetchWithFallback(
  baseUrls: string[],
  path: string,
  init?: RequestInit,
  fallbackConfig?: FallbackConfig,
): Promise<Response> {
  if (baseUrls.length === 0) {
    throw new Error("At least one base URL is required");
  }

  const config = { ...DEFAULT_CONFIG, ...fallbackConfig };
  let lastError: Error | undefined;

  for (const baseUrl of baseUrls) {
    for (let retry = 0; retry <= config.maxRetriesPerEndpoint; retry++) {
      try {
        const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
        const response = await fetch(url, {
          ...init,
          signal:
            init?.signal ?? AbortSignal.timeout(config.timeoutMs),
        });

        if (response.ok) {
          return response;
        }

        // 429 Too Many Requests — try next endpoint immediately
        if (response.status === 429) {
          lastError = new Error(`Rate limited (429) from ${baseUrl}`);
          break; // skip retries for this endpoint
        }

        // 5xx — retry with backoff
        if (response.status >= 500) {
          lastError = new Error(
            `Server error (${response.status}) from ${baseUrl}`,
          );
          if (retry < config.maxRetriesPerEndpoint) {
            await sleep(config.baseDelayMs * 2 ** retry);
            continue;
          }
          break;
        }

        // 4xx (not 429) — don't retry, it's a client error
        return response;
      } catch (err: any) {
        lastError = err;
        if (retry < config.maxRetriesPerEndpoint) {
          await sleep(config.baseDelayMs * 2 ** retry);
        }
      }
    }
  }

  throw lastError ?? new Error("All API endpoints failed");
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Parse a comma-separated env var into an array of endpoints. */
export function parseEndpoints(
  envValue: string | undefined,
  fallback: string,
): string[] {
  if (!envValue) return [fallback];
  return envValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function deriveWsEndpoint(httpEndpoint: string): string {
  try {
    const url = new URL(httpEndpoint);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  } catch {
    return httpEndpoint.replace(/^https?/, (m) =>
      m === "https" ? "wss" : "ws",
    );
  }
}

function isNonRetryableError(err: any): boolean {
  // Transaction simulation failures, invalid params, etc. should not be retried
  const message = String(err?.message ?? "");
  return (
    message.includes("Transaction simulation failed") ||
    message.includes("Invalid param") ||
    message.includes("Blockhash not found")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
