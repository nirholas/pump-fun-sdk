/**
 * GET /api/market/prices?ids=bitcoin,ethereum&vs=usd&include_24h=true&include_mcap=true
 *
 * Vercel serverless function that proxies CoinGecko price requests.
 * Avoids CORS issues for OS apps running in blob: iframes.
 */

const CG = 'https://api.coingecko.com/api/v3';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ids = req.query.ids || 'bitcoin';
  const vs = req.query.vs || 'usd';
  const include24h = req.query.include_24h === 'true';
  const includeMcap = req.query.include_mcap === 'true';

  const params = new URLSearchParams({
    ids: String(ids),
    vs_currencies: String(vs),
  });
  if (include24h) params.set('include_24hr_change', 'true');
  if (includeMcap) params.set('include_market_cap', 'true');

  const _cache = handler._cache || (handler._cache = new Map());

  // Serve from cache if fresh
  const cacheKey = params.toString();
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 60_000) {
    return res.json(cached.data);
  }

  try {
    const cgRes = await fetch(`${CG}/simple/price?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'PumpOS/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    // On 429 (rate-limited), serve stale cache if available
    if (cgRes.status === 429) {
      if (cached) {
        return res.json(cached.data);
      }
      res.setHeader('Retry-After', '30');
      return res.status(503).json({ ok: false, error: 'Rate limited — please retry shortly', retryAfter: 30 });
    }

    if (!cgRes.ok) {
      // Serve stale on other errors too
      if (cached) return res.json(cached.data);
      return res.status(cgRes.status).json({
        ok: false,
        error: `CoinGecko returned ${cgRes.status}`,
      });
    }

    const data = await cgRes.json();
    _cache.set(cacheKey, { data, ts: Date.now() });
    // Evict oldest if too many entries
    if (_cache.size > 200) {
      const oldest = _cache.keys().next().value;
      _cache.delete(oldest);
    }
    return res.json(data);
  } catch (err) {
    // Serve stale cache on network error
    if (cached) return res.json(cached.data);
    console.error('[market/prices] Error:', err.message || err);
    return res.status(502).json({ ok: false, error: 'Failed to fetch prices' });
  }
};
