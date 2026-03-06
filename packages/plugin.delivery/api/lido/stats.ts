export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [statsRes, aprRes] = await Promise.all([
      fetch('https://eth-api.lido.fi/v1/protocol/steth/stats'),
      fetch('https://eth-api.lido.fi/v1/protocol/steth/apr/sma'),
    ]);

    const stats = await statsRes.json();
    const apr = await aprRes.json();

    return new Response(JSON.stringify({
      apr: apr.data?.smaApr ? (apr.data.smaApr * 100).toFixed(2) + '%' : 'N/A',
      totalStaked: stats.data?.totalStaked,
      stakers: stats.data?.uniqueHolders,
      marketCap: stats.data?.marketCap,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch Lido stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
