/**
 * GET /api/market/global
 *
 * Vercel serverless function that returns global cryptocurrency market data
 * from CoinGecko. Used by dashboard.html and other OS apps.
 */

const CG = 'https://api.coingecko.com/api/v3';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const _cache = handler._cache || (handler._cache = { data: null, ts: 0 });

  // Serve from cache if fresh (60s)
  if (_cache.data && Date.now() - _cache.ts < 60_000) {
    return res.json(_cache.data);
  }

  try {
    const cgRes = await fetch(`${CG}/global`, {
      headers: { Accept: 'application/json', 'User-Agent': 'LairOS/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (cgRes.status === 429 || !cgRes.ok) {
      // Serve stale cache on rate-limit or error
      if (_cache.data) return res.json(_cache.data);
      if (cgRes.status === 429) {
        res.setHeader('Retry-After', '30');
        return res.status(503).json({ ok: false, error: 'Rate limited', retryAfter: 30 });
      }
      return res.status(cgRes.status).json({
        ok: false,
        error: `CoinGecko returned ${cgRes.status}`,
      });
    }

    const data = await cgRes.json();
    const result = { ok: true, ...(data.data || data) };
    _cache.data = result;
    _cache.ts = Date.now();
    return res.json(result);
  } catch (err) {
    if (_cache.data) return res.json(_cache.data);
    console.error('[market/global] Error:', err.message || err);
    return res.status(502).json({ ok: false, error: 'Failed to fetch global market data' });
  }
};
