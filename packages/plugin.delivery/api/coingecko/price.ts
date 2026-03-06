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
    const { ids, vs_currencies = 'usd' } = body;

    if (!ids) {
      return new Response(JSON.stringify({ error: 'ids is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${vs_currencies}&include_24hr_change=true&include_market_cap=true`,
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch price' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
