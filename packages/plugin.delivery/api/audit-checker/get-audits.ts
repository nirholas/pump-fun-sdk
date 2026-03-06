export const config = { runtime: 'edge' };

const AUDIT_REGISTRY: Record<string, { protocol: string; chain: string; audits: Array<{ firm: string; date: string; scope: string; findings: { critical: number; high: number; medium: number; low: number }; reportUrl: string }>; riskScore: string }> = {
  pumpfun: {
    protocol: 'PumpFun',
    chain: 'solana',
    audits: [
      { firm: 'Internal', date: '2026-03-06', scope: 'CLI, Rust vanity generator, TypeScript vanity generator', findings: { critical: 0, high: 0, medium: 2, low: 5 }, reportUrl: 'https://github.com/nirholas/pump-fun-sdk/tree/main/security' },
    ],
    riskScore: 'medium',
  },
  jupiter: {
    protocol: 'Jupiter',
    chain: 'solana',
    audits: [
      { firm: 'OtterSec', date: '2024-01-15', scope: 'Jupiter v6 Aggregator', findings: { critical: 0, high: 0, medium: 1, low: 3 }, reportUrl: 'https://github.com/jup-ag/jupiter-audits' },
      { firm: 'Neodyme', date: '2023-11-20', scope: 'Limit Order Program', findings: { critical: 0, high: 0, medium: 0, low: 2 }, reportUrl: 'https://github.com/jup-ag/jupiter-audits' },
    ],
    riskScore: 'low',
  },
  raydium: {
    protocol: 'Raydium',
    chain: 'solana',
    audits: [
      { firm: 'MadShield', date: '2023-08-10', scope: 'Concentrated Liquidity AMM', findings: { critical: 0, high: 0, medium: 2, low: 4 }, reportUrl: 'https://raydium.io/security' },
    ],
    riskScore: 'low',
  },
  marinade: {
    protocol: 'Marinade Finance',
    chain: 'solana',
    audits: [
      { firm: 'Neodyme', date: '2023-06-05', scope: 'Liquid Staking Program', findings: { critical: 0, high: 0, medium: 1, low: 2 }, reportUrl: 'https://marinade.finance/security' },
      { firm: 'Ackee Blockchain', date: '2023-03-15', scope: 'Native Staking', findings: { critical: 0, high: 0, medium: 0, low: 1 }, reportUrl: 'https://marinade.finance/security' },
    ],
    riskScore: 'low',
  },
  orca: {
    protocol: 'Orca',
    chain: 'solana',
    audits: [
      { firm: 'Neodyme', date: '2023-09-20', scope: 'Whirlpools CLMM', findings: { critical: 0, high: 0, medium: 1, low: 3 }, reportUrl: 'https://www.orca.so/security' },
    ],
    riskScore: 'low',
  },
  solend: {
    protocol: 'Solend',
    chain: 'solana',
    audits: [
      { firm: 'Kudelski Security', date: '2022-12-01', scope: 'Lending Protocol v2', findings: { critical: 0, high: 1, medium: 2, low: 4 }, reportUrl: 'https://solend.fi/security' },
    ],
    riskScore: 'medium',
  },
};

function daysBetween(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get audits for a protocol
 */
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

    if (!protocol || typeof protocol !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: protocol' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const key = protocol.toLowerCase().replace(/[\s_-]+/g, '');
    const entry = AUDIT_REGISTRY[key];

    if (!entry) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          protocol,
          audits: [],
          riskScore: 'unknown',
          lastAuditAge: 'N/A',
          message: 'No audits found for this protocol in our registry',
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const latestDate = entry.audits.reduce((latest, a) => a.date > latest ? a.date : latest, '');
    const lastAuditAge = `${daysBetween(latestDate)} days`;

    return new Response(JSON.stringify({
      success: true,
      data: {
        protocol: entry.protocol,
        audits: entry.audits,
        riskScore: entry.riskScore,
        lastAuditAge,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

