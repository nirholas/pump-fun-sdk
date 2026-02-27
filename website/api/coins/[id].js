/**
 * GET /api/coins/[id] — Get a single coin with engagement reactions.
 *
 * Zero-dependency Vercel serverless function using Neon HTTP SQL.
 * Returns the format expected by pumpcoin.html:
 *   { success: true, data: { id, ticker, name, ..., reactions: { "🔥": 5 } } }
 */

const { sql, setCorsHeaders, transformCoin } = require('../_db');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=15');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const coinId = Number(id);

  if (!id || isNaN(coinId) || coinId < 1) {
    return res.status(400).json({ success: false, error: 'Invalid coin ID' });
  }

  // Graceful fallback when no database is configured
  const dsn = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!dsn) {
    return res.status(503).json({ success: false, error: 'Database not connected' });
  }

  try {
    // Fetch coin
    const { rows } = await sql(
      `SELECT "id", "ticker", "name", "description", "status",
              "imageUrl", "telegramImageUrl",
              "engagementScore", "totalReactions", "totalShares", "totalReplies",
              "totalEngagement", "launchThreshold",
              "creatorUsername", "creatorWalletAddress",
              "tokenAddress", "contractAddress", "poolAddress",
              "deploymentTxHash", "deployedAt",
              "launchMode", "createdAt", "updatedAt"
       FROM "coins"
       WHERE "id" = $1
       LIMIT 1`,
      [coinId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Coin not found' });
    }

    const coin = transformCoin(rows[0]);

    // Fetch reaction breakdown from engagements table
    let reactions = {};
    try {
      const { rows: reactionRows } = await sql(
        `SELECT "reactionEmoji", COUNT("id")::int AS cnt
         FROM "engagements"
         WHERE "coinId" = $1 AND "engagementType" = 'reaction' AND "reactionEmoji" IS NOT NULL
         GROUP BY "reactionEmoji"
         ORDER BY cnt DESC`,
        [coinId],
      );
      for (const r of reactionRows) {
        if (r.reactionEmoji) reactions[r.reactionEmoji] = r.cnt;
      }
    } catch (_) {
      // Reactions are non-critical — don't fail the response
    }

    coin.reactions = reactions;

    return res.json({ success: true, data: coin });
  } catch (err) {
    console.error('[api/coins/[id]] Error:', err.message || err);
    return res.status(502).json({
      success: false,
      error: 'Failed to fetch coin',
      detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
};
