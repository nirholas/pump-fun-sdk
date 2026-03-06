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
    const { chain } = body;

    const [vaultsRes, apyRes] = await Promise.all([
      fetch('https://api.beefy.finance/vaults'),
      fetch('https://api.beefy.finance/apy'),
    ]);

    const vaults = await vaultsRes.json();
    const apys = await apyRes.json();

    let filtered = vaults;
    if (chain) {
      filtered = vaults.filter((v: any) => v.chain?.toLowerCase() === chain.toLowerCase());
    }

    const result = filtered.slice(0, 25).map((v: any) => ({
      id: v.id,
      name: v.name,
      chain: v.chain,
      token: v.token,
      platform: v.platform,
      apy: apys[v.id] ? (apys[v.id] * 100).toFixed(2) + '%' : 'N/A',
      status: v.status,
    }));

    return new Response(JSON.stringify({ chain: chain || 'all', vaults: result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch vaults' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
