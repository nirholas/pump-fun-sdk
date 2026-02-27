/**
 * GET /api/coins — List all minting/pending coins.
 *
 * Zero-dependency Vercel serverless function using Neon HTTP SQL.
 * Returns the format expected by pumplaunch.html, pumptrending.html, pumpdefi.html:
 *   { success: true, data: [ { id, ticker, name, status, image_url, ... } ] }
 *
 * Query params:
 *   ?sort=engagement  — sort by engagement (default: engagementScore desc)
 *   ?status=minting    — filter by status (default: all)
 *   ?limit=20          — page size 1–100
 *   ?offset=0          — offset for pagination
 */

const { sql, setCorsHeaders, transformCoin } = require('./_db');

/** Map client-facing sort values → SQL column identifiers */
const SORT_MAP = {
  engagement: '"engagementScore"',
  engagementScore: '"engagementScore"',
  name: '"name"',
  created: '"createdAt"',
  createdAt: '"createdAt"',
};

/** Map front-end status names → DB status values */
const STATUS_MAP = {
  minting: 'pending',
  pending: 'pending',
  launched: 'launched',
  failed: 'failed',
};

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  // Graceful fallback when no database is configured
  const dsn = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!dsn) {
    return res.json({ success: true, data: [], _note: 'Database not connected' });
  }

  try {
    const sort = SORT_MAP[req.query?.sort] || '"engagementScore"';
    const order = req.query?.order === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.max(1, Math.min(100, parseInt(req.query?.limit) || 20));
    const offset = Math.max(0, parseInt(req.query?.offset) || 0);
    const statusFilter = req.query?.status;

    let whereClause = '';
    const params = [];
    if (statusFilter && statusFilter !== 'all') {
      const dbStatus = STATUS_MAP[statusFilter] || statusFilter;
      params.push(dbStatus);
      whereClause = `WHERE "status" = $1`;
    }

    const query = `
      SELECT "id", "ticker", "name", "description", "status",
             "imageUrl", "telegramImageUrl",
             "engagementScore", "totalReactions", "totalShares", "totalReplies",
             "totalEngagement", "launchThreshold",
             "creatorUsername", "creatorWalletAddress",
             "tokenAddress", "contractAddress", "poolAddress",
             "deploymentTxHash", "deployedAt",
             "launchMode", "createdAt", "updatedAt"
      FROM "coins"
      ${whereClause}
      ORDER BY ${sort} ${order}, "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const { rows } = await sql(query, params);
    const data = rows.map(transformCoin);

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[api/coins] Error:', err.message || err);
    return res.status(502).json({
      success: false,
      error: 'Failed to fetch coins',
      detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
};
