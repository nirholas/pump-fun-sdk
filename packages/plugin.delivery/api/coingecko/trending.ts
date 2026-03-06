export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/search/trending',
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await response.json();

    const coins = (data.coins || []).map((c: any) => ({
      id: c.item?.id,
      name: c.item?.name,
      symbol: c.item?.symbol,
      marketCapRank: c.item?.market_cap_rank,
      thumb: c.item?.thumb,
      score: c.item?.score,
    }));

    return new Response(JSON.stringify({ trending: coins }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch trending' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
