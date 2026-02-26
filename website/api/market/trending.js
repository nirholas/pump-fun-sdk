/**
 * GET /api/market/trending?limit=20
 *
 * Vercel serverless function that fetches trending tokens from CoinGecko
 * and returns them in the same format the OS frontend expects from the
 * Express API: { ok: true, tokens: [...] }
 */

const CG = 'https://api.coingecko.com/api/v3';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

  const _cache = handler._cache || (handler._cache = { data: null, ts: 0 });

  // Serve from cache if fresh (60s)
  if (_cache.data && Date.now() - _cache.ts < 60_000) {
    return res.json(_cache.data);
  }

  try {
    // 1. Fetch trending coins from CoinGecko
    const trendingRes = await fetch(`${CG}/search/trending`, {
      headers: { Accept: 'application/json', 'User-Agent': 'LairOS/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (trendingRes.status === 429 || !trendingRes.ok) {
      if (_cache.data) return res.json(_cache.data);
      if (trendingRes.status === 429) {
        res.setHeader('Retry-After', '30');
        return res.status(503).json({ ok: false, error: 'Rate limited', retryAfter: 30 });
      }
      return res.status(trendingRes.status).json({
        ok: false,
        error: `CoinGecko trending returned ${trendingRes.status}`,
      });
    }

    const trending = await trendingRes.json();
    const coins = (trending.coins || []).slice(0, limit);

    if (!coins.length) {
      return res.json({ ok: true, count: 0, tokens: [] });
    }

    // 2. Fetch market data for trending coin IDs
    const ids = coins.map(c => c.item?.id).filter(Boolean).join(',');
    let priceMap = {};

    if (ids) {
      try {
        const marketsRes = await fetch(
          `${CG}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&sparkline=false&price_change_percentage=24h`,
          {
            headers: { Accept: 'application/json', 'User-Agent': 'LairOS/1.0' },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (marketsRes.ok) {
          const marketsData = await marketsRes.json();
          marketsData.forEach(p => { priceMap[p.id] = p; });
        }
      } catch (_) {
        // Price enrichment is best-effort
      }
    }

    // 3. Map to the token format expected by the OS frontend
    const tokens = coins.map((c, i) => {
      const item = c.item || {};
      const pm = priceMap[item.id] || {};
      return {
        id: item.id,
        name: item.name,
        symbol: item.symbol,
        image: item.small || item.thumb,
        rank: i + 1,
        market_cap_rank: pm.market_cap_rank || item.market_cap_rank,
        current_price: pm.current_price ?? item.data?.price,
        price_change_percentage_24h: pm.price_change_percentage_24h ?? item.data?.price_change_percentage_24h?.usd,
        market_cap: pm.market_cap ?? item.data?.market_cap,
        total_volume: pm.total_volume,
      };
    });

    const result = { ok: true, count: tokens.length, tokens };
    _cache.data = result;
    _cache.ts = Date.now();
    return res.json(result);
  } catch (err) {
    if (_cache.data) return res.json(_cache.data);
    console.error('[market/trending] Error:', err.message || err);
    return res.status(502).json({ ok: false, error: 'Failed to fetch trending data' });
  }
};
