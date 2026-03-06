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
    const { protocol } = body;

    if (!protocol) {
      return new Response(JSON.stringify({ error: 'Protocol name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`https://api.llama.fi/protocol/${encodeURIComponent(protocol)}`);
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Protocol "${protocol}" not found` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      name: data.name,
      description: data.description,
      tvl: data.tvl,
      chains: data.chains,
      category: data.category,
      url: data.url,
      twitter: data.twitter,
      chainTvls: data.chainTvls,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch protocol data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
