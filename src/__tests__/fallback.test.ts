/**
 * Failover behaviour of `createFallbackConnection` and `fetchWithFallback`.
 *
 * The connection tests drive real web3.js `Connection`s through the `fetch`
 * hook in `ConnectionConfig`, so they exercise the same private request path
 * the failover wraps in production.
 */
import type { ConnectionConfig } from "@solana/web3.js";

import {
  createFallbackConnection,
  fetchWithFallback,
  parseEndpoints,
} from "../fallback";

const A = "https://rpc-a.example";
const B = "https://rpc-b.example";
const C = "https://rpc-c.example";

type FetchImpl = NonNullable<ConnectionConfig["fetch"]>;

/** A fetch stub answering JSON-RPC by endpoint, recording every call. */
function rpcFetch(handlers: Record<string, () => Response>): {
  fetch: FetchImpl;
  calls: string[];
} {
  const calls: string[] = [];
  const fetch = (async (input: Parameters<FetchImpl>[0], init?: RequestInit) => {
    const url = String(input).replace(/\/$/, "");
    calls.push(url);
    const handler = handlers[url];
    if (!handler) throw new Error(`unexpected endpoint ${url}`);
    const response = handler();
    if (response.ok && init?.body) {
      const { id } = JSON.parse(String(init.body)) as { id: string };
      const { result } = (await response.json()) as { result: unknown };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return response;
  }) as unknown as FetchImpl;
  return { fetch, calls };
}

const ok = (result: unknown) => () =>
  new Response(JSON.stringify({ result }), { status: 200 });
const unavailable = () => () =>
  new Response("down", { status: 503, statusText: "Service Unavailable" });

const FAST = { baseDelayMs: 0, maxRetriesPerEndpoint: 1 };

describe("parseEndpoints", () => {
  it("splits and trims a comma-separated list", () => {
    expect(parseEndpoints(` ${A} ,${B},, `, C)).toEqual([A, B]);
  });

  it.each([undefined, "", " , ,"])("falls back for %p", (value) => {
    expect(parseEndpoints(value, C)).toEqual([C]);
  });
});

describe("createFallbackConnection", () => {
  it("requires at least one endpoint", () => {
    expect(() => createFallbackConnection([])).toThrow(/At least one/);
  });

  it("returns a plain connection for a single endpoint", async () => {
    const { fetch, calls } = rpcFetch({ [A]: ok(7) });
    const connection = createFallbackConnection([A], { fetch });
    await expect(connection.getSlot()).resolves.toBe(7);
    expect(calls).toEqual([A]);
  });

  it("fails over to the next endpoint after retrying the first", async () => {
    const { fetch, calls } = rpcFetch({ [A]: unavailable(), [B]: ok(42) });
    const connection = createFallbackConnection([A, B], { fetch }, FAST);

    await expect(connection.getSlot()).resolves.toBe(42);
    expect(calls).toEqual([A, A, B]);
  });

  it("keeps using the healthy endpoint while the failed one cools down", async () => {
    const { fetch, calls } = rpcFetch({ [A]: unavailable(), [B]: ok(1) });
    const connection = createFallbackConnection([A, B], { fetch }, FAST);

    await connection.getSlot();
    calls.length = 0;
    await connection.getSlot();
    expect(calls).toEqual([B]);
  });

  it("throws the last error once every endpoint is exhausted", async () => {
    const { fetch } = rpcFetch({ [A]: unavailable(), [B]: unavailable() });
    const connection = createFallbackConnection([A, B], { fetch }, FAST);
    await expect(connection.getSlot()).rejects.toThrow(/503/);
  });
});

describe("fetchWithFallback", () => {
  const realFetch = global.fetch;
  let calls: string[];

  function stubFetch(byBase: Record<string, Array<() => Response>>): void {
    calls = [];
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      const base = Object.keys(byBase).find((b) => url.startsWith(b));
      const next = base ? byBase[base]!.shift() : undefined;
      if (!next) throw new Error(`no response queued for ${url}`);
      return next();
    }) as typeof fetch;
  }

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("requires at least one base URL", async () => {
    await expect(fetchWithFallback([], "/x")).rejects.toThrow(/At least one/);
  });

  it("joins the base and path without doubling slashes", async () => {
    stubFetch({ [A]: [() => new Response("ok")] });
    await fetchWithFallback([`${A}//`], "/coins?limit=1", undefined, FAST);
    expect(calls).toEqual([`${A}/coins?limit=1`]);
  });

  it("retries a 5xx, then moves to the next base URL", async () => {
    stubFetch({
      [A]: [() => new Response("", { status: 500 }), () => new Response("", { status: 502 })],
      [B]: [() => new Response("fine")],
    });
    const response = await fetchWithFallback([A, B], "/x", undefined, FAST);
    await expect(response.text()).resolves.toBe("fine");
    expect(calls).toEqual([`${A}/x`, `${A}/x`, `${B}/x`]);
  });

  it("skips straight to the next base URL on 429", async () => {
    stubFetch({
      [A]: [() => new Response("", { status: 429 })],
      [B]: [() => new Response("fine")],
    });
    await fetchWithFallback([A, B], "/x", undefined, FAST);
    expect(calls).toEqual([`${A}/x`, `${B}/x`]);
  });

  it("returns a 4xx to the caller without retrying", async () => {
    stubFetch({ [A]: [() => new Response("", { status: 404 })] });
    const response = await fetchWithFallback([A, B], "/x", undefined, FAST);
    expect(response.status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("stops at once when the caller's signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    calls = [];
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      calls.push(String(input));
      throw new DOMException("aborted", "AbortError");
    }) as typeof fetch;

    await expect(
      fetchWithFallback([A, B], "/x", { signal: controller.signal }, {
        ...FAST,
        maxRetriesPerEndpoint: 3,
      }),
    ).rejects.toThrow(/aborted/);
    expect(calls).toHaveLength(1);
  });

  it("throws the last error when every base URL fails", async () => {
    stubFetch({
      [A]: [() => new Response("", { status: 503 }), () => new Response("", { status: 503 })],
    });
    await expect(fetchWithFallback([A], "/x", undefined, FAST)).rejects.toThrow(
      /Server error \(503\)/,
    );
  });
});
