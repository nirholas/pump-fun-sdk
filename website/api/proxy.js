/**
 * CORS proxy for PumpOS iframe apps that can't directly call external APIs
 * (CoinGecko, DeFi Llama, etc.) due to sandboxed iframe origin restrictions.
 *
 * GET  /api/proxy?url=https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
 * POST /api/proxy?url=https://eth.llamarpc.com   (body forwarded as-is for JSON-RPC calls)
 */

const ALLOWED_HOSTS = [
  // CoinGecko
  'api.coingecko.com',
  'pro-api.coingecko.com',
  // DeFi Llama
  'api.llama.fi',
  'coins.llama.fi',
  'stablecoins.llama.fi',
  'yields.llama.fi',
  // Market data
  'api.alternative.me',
  'api.etherscan.io',
  'api.dexscreener.com',
  'api.defined.fi',
  // Binance (funding rates, liquidations, price data)
  'fapi.binance.com',
  'api.binance.com',
  'www.binance.com',
  // GeckoTerminal (smart money / pool data)
  'api.geckoterminal.com',
  // Token security / scanning
  'api.gopluslabs.io',
  // Whale & block data
  'api.whale-alert.io',
  'api.blockchair.com',
  'blockchain.info',
  // Options / derivatives
  'www.deribit.com',
  // MEV / Flashbots
  'blocks.flashbots.net',
  // Bridge aggregator (LI.FI)
  'li.quest',
  // Gas / fee estimation
  'api.owlracle.info',
  'api.blocknative.com',
  'beaconcha.in',
  // NFT data
  'api.reservoir.tools',
  // News
  'free-crypto-news.vercel.app',
  'cryptopanic.com',
  // TweetCharts
  'tweet-price-charts.vercel.app',
  // RPC endpoints (for on-chain reads — gas price, balances, etc.)
  'eth.llamarpc.com',
  'base.llamarpc.com',
  'arbitrum.llamarpc.com',
  'polygon.llamarpc.com',
  'mainnet.base.org',
  'arb1.arbitrum.io',
  'bsc-dataseed.binance.org',
  'bsc-dataseed1.binance.org',
  'polygon-rpc.com',
  'polygon-bor-rpc.publicnode.com',
  'polygon.drpc.org',
  'rpc.ankr.com',
  '1rpc.io',
  'cloudflare-eth.com',
  // Optimism & Avalanche RPC
  'mainnet.optimism.io',
  'api.avax.network',
  // ENS
  'api.ensideas.com',
  // Weather / geo
  'geocoding-api.open-meteo.com',
  'api.open-meteo.com',
  'ipapi.co',
];

/** Hosts allowed to receive POST requests (JSON-RPC only) */
const POST_ALLOWED_HOSTS = new Set([
  'eth.llamarpc.com',
  'base.llamarpc.com',
  'arbitrum.llamarpc.com',
  'polygon.llamarpc.com',
  'mainnet.base.org',
  'arb1.arbitrum.io',
  'bsc-dataseed.binance.org',
  'bsc-dataseed1.binance.org',
  'polygon-rpc.com',
  'polygon-bor-rpc.publicnode.com',
  'polygon.drpc.org',
  'rpc.ankr.com',
  '1rpc.io',
  'cloudflare-eth.com',
  'mainnet.optimism.io',
  'api.avax.network',
]);

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_POST_BODY = 4096; // 4 KB — enough for any eth_gasPrice / eth_call
const CACHE_TTL_MS = 60_000; // 60 seconds — fresh
const STALE_TTL_MS = 300_000; // 5 minutes — stale but serveable on 429

/**
 * Simple in-memory cache with TTL.
 * Survives across requests within the same warm Vercel instance.
 * Keys are the upstream target URLs (GET only).
 */
const _cache = new Map(); // key → { data, contentType, status, ts }

/** In-flight request deduplication — prevents CoinGecko rate-limit storms */
const _inflight = new Map(); // key → Promise<{data, contentType, status}>

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.ts;
  if (age > STALE_TTL_MS) {
    // Too old, evict
    _cache.delete(key);
    return null;
  }
  if (age > CACHE_TTL_MS) {
    // Stale but might still be useful on 429
    return { ...entry, stale: true };
  }
  return { ...entry, stale: false };
}

function setCache(key, data, contentType, status) {
  // Only cache successful responses
  if (status >= 200 && status < 400) {
    _cache.set(key, { data, contentType, status, ts: Date.now() });
    // Evict oldest entries if cache grows too large
    if (_cache.size > 500) {
      const oldest = _cache.keys().next().value;
      _cache.delete(oldest);
    }
  }
}

module.exports = async function handler(req, res) {
  // CORS headers — allow any origin (OS runs on blob: URLs inside iframes)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const isGet = req.method === 'GET';
  const isPost = req.method === 'POST';
  if (!isGet && !isPost) return res.status(405).json({ error: 'Method not allowed' });

  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing ?url= parameter' });

  let parsed;
  try { parsed = new URL(targetUrl); }
  catch { return res.status(400).json({ error: 'Invalid URL' }); }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return res.status(403).json({ error: 'Host not allowed: ' + parsed.hostname });
  }
  if (parsed.protocol !== 'https:') {
    return res.status(403).json({ error: 'Only HTTPS URLs allowed' });
  }

  // POST only allowed to RPC endpoints
  if (isPost && !POST_ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(403).json({ error: 'POST not allowed to this host' });
  }

  try {
    // Serve from cache for GET requests (avoids rate-limit storms)
    if (isGet) {
      const cached = getCached(targetUrl);
      if (cached && !cached.stale) {
        res.setHeader('Content-Type', cached.contentType || 'application/json');
        res.setHeader('X-Proxy-Cache', 'HIT');
        return res.status(cached.status).send(cached.data);
      }

      // Deduplicate in-flight requests — only one upstream call per URL
      if (_inflight.has(targetUrl)) {
        try {
          const result = await _inflight.get(targetUrl);
          res.setHeader('Content-Type', result.contentType || 'application/json');
          res.setHeader('X-Proxy-Cache', 'DEDUP');
          return res.status(result.status).send(result.data);
        } catch (dupErr) {
          // In-flight request failed — fall through to serve stale or make new request
          const stale = getCached(targetUrl);
          if (stale) {
            res.setHeader('Content-Type', stale.contentType || 'application/json');
            res.setHeader('X-Proxy-Cache', 'STALE');
            return res.status(stale.status).send(stale.data);
          }
        }
      }
    }

    const fetchOpts = {
      method: isPost ? 'POST' : 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'PumpOS/1.0' },
      signal: AbortSignal.timeout(10000),
    };

    // Forward POST body for JSON-RPC
    if (isPost) {
      let body = '';
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
      } else {
        // Read raw body as fallback (Vercel edge case)
        body = await new Promise((resolve, reject) => {
          let chunks = '';
          req.on('data', c => {
            chunks += c;
            if (chunks.length > MAX_POST_BODY) reject(new Error('Body too large'));
          });
          req.on('end', () => resolve(chunks));
          req.on('error', reject);
        });
      }
      if (body.length > MAX_POST_BODY) {
        return res.status(413).json({ error: 'POST body too large' });
      }
      fetchOpts.body = body;
      fetchOpts.headers['Content-Type'] = 'application/json';
    }

    // Register in-flight for GET deduplication
    let inflightResolve, inflightReject;
    if (isGet) {
      const p = new Promise((resolve, reject) => { inflightResolve = resolve; inflightReject = reject; });
      _inflight.set(targetUrl, p);
    }

    try {
      const upstream = await fetch(targetUrl, fetchOpts);

      const cl = upstream.headers.get('content-length');
      if (cl && parseInt(cl) > MAX_RESPONSE_SIZE) {
        if (isGet) { _inflight.delete(targetUrl); inflightReject?.(new Error('Too large')); }
        return res.status(413).json({ error: 'Response too large' });
      }

      const data = await upstream.text();
      const contentType = upstream.headers.get('content-type') || 'application/json';

      // On 429 (rate-limited), serve stale cache if available
      if (upstream.status === 429 && isGet) {
        _inflight.delete(targetUrl);
        inflightReject?.(new Error('429'));
        const stale = getCached(targetUrl);
        if (stale) {
          res.setHeader('Content-Type', stale.contentType || 'application/json');
          res.setHeader('X-Proxy-Cache', 'STALE');
          return res.status(stale.status).send(stale.data);
        }
        // No stale cache — return a 503 with Retry-After instead of raw 429
        res.setHeader('Retry-After', '30');
        return res.status(503).json({ error: 'Rate limited — please retry shortly', retryAfter: 30 });
      }

      // Cache successful GET responses
      if (isGet) {
        setCache(targetUrl, data, contentType, upstream.status);
        inflightResolve?.({ data, contentType, status: upstream.status });
        _inflight.delete(targetUrl);
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Proxy-Cache', 'MISS');
      return res.status(upstream.status).send(data);
    } catch (fetchErr) {
      if (isGet) { _inflight.delete(targetUrl); inflightReject?.(fetchErr); }
      throw fetchErr;
    }
  } catch (err) {
    // On network error, serve stale cache if available
    if (isGet) {
      const stale = getCached(targetUrl);
      if (stale) {
        res.setHeader('Content-Type', stale.contentType || 'application/json');
        res.setHeader('X-Proxy-Cache', 'STALE');
        return res.status(stale.status).send(stale.data);
      }
    }
    console.error('Proxy error:', err.message || err);
    return res.status(502).json({ error: 'Upstream request failed' });
  }
};
