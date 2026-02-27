/**
 * GET /api/portfolio/summary/[address]
 *
 * Vercel serverless function that fetches a wallet portfolio summary using
 * Ankr's public multichain balance API. Returns data in the format expected
 * by lairdefi.html: { success: true, data: { totalValueUsd, change24h, balances: [...] } }
 */

const ANKR_RPC = 'https://rpc.ankr.com/multichain';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing address parameter' });
  }

  // Basic address validation (EVM hex or ENS)
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address);
  const isEns = /^[a-zA-Z0-9-]+\.eth$/.test(address);

  if (!isEvm && !isEns) {
    return res.status(400).json({ success: false, error: 'Invalid EVM address or ENS name' });
  }

  // If ENS, resolve via public ENS API
  let resolvedAddress = address;
  if (isEns) {
    try {
      const ensRes = await fetch(`https://api.ensideas.com/ens/resolve/${address}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (ensRes.ok) {
        const ensData = await ensRes.json();
        if (ensData.address) {
          resolvedAddress = ensData.address;
        } else {
          return res.status(404).json({ success: false, error: 'ENS name not found' });
        }
      }
    } catch (_) {
      return res.status(502).json({ success: false, error: 'ENS resolution failed' });
    }
  }

  try {
    // Fetch multi-chain balances from Ankr
    const ankrRes = await fetch(ANKR_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'PumpOS/1.0' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'ankr_getAccountBalance',
        params: {
          walletAddress: resolvedAddress,
          onlyWhitelisted: true,
        },
        id: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!ankrRes.ok) {
      return res.status(ankrRes.status).json({
        success: false,
        error: `Ankr API returned ${ankrRes.status}`,
      });
    }

    const ankrData = await ankrRes.json();

    if (ankrData.error) {
      return res.status(502).json({
        success: false,
        error: ankrData.error.message || 'Ankr RPC error',
      });
    }

    const assets = ankrData.result?.assets || [];
    const totalBalanceUsd = parseFloat(ankrData.result?.totalBalanceUsd || '0');

    // Map to the format expected by the OS frontend
    const balances = assets
      .filter(a => parseFloat(a.balanceUsd || '0') > 0.01)
      .sort((a, b) => parseFloat(b.balanceUsd || '0') - parseFloat(a.balanceUsd || '0'))
      .map(a => ({
        symbol: a.tokenSymbol || 'Unknown',
        name: a.tokenName || a.tokenSymbol || 'Unknown',
        chain: chainLabel(a.blockchain),
        balance: parseFloat(a.balance || '0'),
        balanceFormatted: formatBalance(parseFloat(a.balance || '0')),
        valueUsd: parseFloat(a.balanceUsd || '0'),
        tokenPrice: parseFloat(a.tokenPrice || '0'),
        thumbnail: a.thumbnail || null,
      }));

    return res.json({
      success: true,
      data: {
        address: resolvedAddress,
        totalValueUsd: totalBalanceUsd,
        change24h: null, // Ankr doesn't provide 24h change
        balances,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[portfolio/summary] Error:', err.message || err);
    return res.status(502).json({ success: false, error: 'Failed to fetch portfolio data' });
  }
};

function chainLabel(blockchain) {
  const map = {
    eth: 'Ethereum',
    bsc: 'BSC',
    polygon: 'Polygon',
    arbitrum: 'Arbitrum',
    optimism: 'Optimism',
    base: 'Base',
    avalanche: 'Avalanche',
    fantom: 'Fantom',
    gnosis: 'Gnosis',
    polygon_zkevm: 'Polygon zkEVM',
    zksync_era: 'zkSync',
    linea: 'Linea',
    scroll: 'Scroll',
    blast: 'Blast',
  };
  return map[blockchain] || blockchain || 'Unknown';
}

function formatBalance(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}
