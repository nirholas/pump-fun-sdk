/**
 * GET /api/market/overview
 *
 * Vercel serverless function that returns a market overview with global stats
 * and whale alert data, matching the format expected by pumpdefi.html:
 * { ok: true, global: {...}, whaleAlerts: [...] }
 */

const CG = 'https://api.coingecko.com/api/v3';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Fetch global market data from CoinGecko
    const [globalRes, defiRes] = await Promise.allSettled([
      fetch(`${CG}/global`, {
        headers: { Accept: 'application/json', 'User-Agent': 'PumpOS/1.0' },
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`${CG}/global/decentralized_finance_defi`, {
        headers: { Accept: 'application/json', 'User-Agent': 'PumpOS/1.0' },
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    let globalData = null;
    let defiData = null;

    if (globalRes.status === 'fulfilled' && globalRes.value.ok) {
      const g = await globalRes.value.json();
      globalData = g.data || g;
    }

    if (defiRes.status === 'fulfilled' && defiRes.value.ok) {
      const d = await defiRes.value.json();
      defiData = d.data || d;
    }

    // Build market overview
    const overview = {
      ok: true,
      global: globalData ? {
        totalMarketCap: globalData.total_market_cap?.usd,
        totalVolume24h: globalData.total_volume?.usd,
        btcDominance: globalData.market_cap_percentage?.btc,
        ethDominance: globalData.market_cap_percentage?.eth,
        activeCryptocurrencies: globalData.active_cryptocurrencies,
        marketCapChangePercentage24h: globalData.market_cap_change_percentage_24h_usd,
      } : null,
      defi: defiData ? {
        defiMarketCap: parseFloat(defiData.defi_market_cap) || 0,
        defiVolume24h: parseFloat(defiData.trading_volume_24h) || 0,
        defiDominance: parseFloat(defiData.defi_dominance) || 0,
        topCoinDeFiDominance: parseFloat(defiData.top_coin_defi_dominance) || 0,
      } : null,
      // Whale alerts — the frontend falls back to demo data when this is empty,
      // which is fine. Real whale data requires the full Express API with
      // Whale Alert API integration.
      whaleAlerts: [],
    };

    return res.json(overview);
  } catch (err) {
    console.error('[market/overview] Error:', err.message || err);
    return res.status(502).json({ ok: false, error: 'Failed to fetch market overview' });
  }
};
