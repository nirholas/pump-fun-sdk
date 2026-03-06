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
    const { chainId, pairAddress } = body;

    if (!chainId || !pairAddress) {
      return new Response(JSON.stringify({ error: 'chainId and pairAddress are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`,
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await response.json();
    const p = data.pairs?.[0];

    if (!p) {
      return new Response(JSON.stringify({ error: 'Pair not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      baseToken: p.baseToken,
      quoteToken: p.quoteToken,
      chain: p.chainId,
      dex: p.dexId,
      priceUsd: p.priceUsd,
      priceChange: p.priceChange,
      volume: p.volume,
      liquidity: p.liquidity,
      fdv: p.fdv,
      marketCap: p.marketCap,
      url: p.url,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch pair' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
