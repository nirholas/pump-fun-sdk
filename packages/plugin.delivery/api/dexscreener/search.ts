export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { query } = body;

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await response.json();

    const pairs = (data.pairs || []).slice(0, 10).map((p: any) => ({
      baseToken: {
        name: p.baseToken?.name,
        symbol: p.baseToken?.symbol,
        address: p.baseToken?.address,
      },
      quoteToken: p.quoteToken?.symbol,
      chain: p.chainId,
      dex: p.dexId,
      priceUsd: p.priceUsd,
      priceChange24h: p.priceChange?.h24,
      volume24h: p.volume?.h24,
      liquidity: p.liquidity?.usd,
      marketCap: p.marketCap,
      url: p.url,
    }));

    return new Response(JSON.stringify({ query, resultsCount: data.pairs?.length || 0, pairs }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to search tokens' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
