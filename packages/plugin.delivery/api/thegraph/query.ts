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
    const { subgraphId, query } = body;

    if (!subgraphId || !query) {
      return new Response(JSON.stringify({ 
        error: 'subgraphId and query are required',
        example: {
          subgraphId: 'uniswap/uniswap-v3',
          query: '{ pools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) { id token0 { symbol } token1 { symbol } totalValueLockedUSD } }'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // The Graph Gateway endpoint
    const endpoint = `https://gateway.thegraph.com/api/subgraphs/id/${subgraphId}`;

    // Note: Requires API key for production use
    return new Response(JSON.stringify({
      note: 'The Graph API requires an API key for production queries',
      endpoint,
      subgraphId,
      query,
      instructions: [
        '1. Get an API key from https://thegraph.com/studio',
        '2. Add the key to the request header: Authorization: Bearer YOUR_API_KEY',
        '3. POST the GraphQL query to the endpoint',
      ],
      freeAlternatives: [
        'https://api.thegraph.com/subgraphs/name/{owner}/{subgraph}',
        'Use DeFiLlama API for protocol data',
      ],
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to execute query' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
