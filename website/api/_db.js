/**
 * Zero-dependency PostgreSQL query helper for Vercel serverless functions.
 *
 * Uses Neon's HTTP SQL endpoint (which is what Vercel Postgres uses internally).
 * Works with native `fetch` — no npm packages needed.
 *
 * Requires env var:
 *   DATABASE_URL  — e.g. postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
 *
 * Or alternatively:
 *   POSTGRES_URL  — Vercel's convention (same format)
 */

const connString = () =>
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

/**
 * Execute a SQL query via Neon HTTP endpoint.
 * @param {string} query  - SQL statement (use $1, $2… for params)
 * @param {any[]}  params - Bind parameters
 * @returns {Promise<{rows: object[], rowCount: number}>}
 */
async function sql(query, params = []) {
  const dsn = connString();
  if (!dsn) throw new Error('DATABASE_URL not configured');

  const url = new URL(dsn.replace(/^postgres(ql)?:/, 'https:'));
  const httpUrl = `https://${url.hostname}/sql`;

  const resp = await fetch(httpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': dsn,
    },
    body: JSON.stringify({ query, params }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`DB query failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const result = await resp.json();
  return { rows: result.rows || [], rowCount: result.rowCount || 0 };
}

/** Standard CORS + JSON headers for coin endpoints. */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
}

/**
 * Map front-end display status from DB status.
 * DB stores 'pending', frontend expects 'minting'.
 */
const STATUS_DISPLAY = {
  pending: 'minting',
  launched: 'launched',
  failed: 'failed',
};

/**
 * Transform a raw DB row (camelCase) into the snake_case contract
 * that all LairOS frontend apps expect.
 *
 * Fields consumed by lairtrending.html, lairlaunch.html, lairdefi.html, laircoin.html:
 *   image_url, current_engagement, progress_percentage, launch_threshold,
 *   total_reactions, total_shares, total_replies, replies_count, forwards_count,
 *   creator_username, contract_address, created_at, etc.
 */
function transformCoin(row) {
  const engagement = Number(row.engagementScore) || 0;
  const threshold = Number(row.launchThreshold) || 100;
  const progress = Math.min(100, (engagement / threshold) * 100);

  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    description: row.description || null,
    status: STATUS_DISPLAY[row.status] || row.status || 'minting',
    image_url: row.imageUrl || row.telegramImageUrl || null,

    // Primary engagement fields the frontends read
    current_engagement: engagement,
    launch_threshold: threshold,
    progress_percentage: Math.round(progress * 100) / 100,

    // Legacy/alternate names (some apps check these too)
    engagement_score: engagement,
    total_reactions: Number(row.totalReactions) || 0,
    total_shares: Number(row.totalShares) || 0,
    total_replies: Number(row.totalReplies) || 0,

    // Denormalized counters for laircoin detail view
    replies_count: Number(row.totalReplies) || 0,
    forwards_count: Number(row.totalShares) || 0,

    // Creator & contract info
    creator_username: row.creatorUsername || null,
    creator_wallet_address: row.creatorWalletAddress || null,
    contract_address: row.tokenAddress || row.contractAddress || null,
    pool_address: row.poolAddress || null,
    deployment_tx_hash: row.deploymentTxHash || null,
    deployed_at: row.deployedAt || null,
    launched_at: row.deployedAt || null,
    launch_mode: row.launchMode || 'engagement',

    // Reactions placeholder (detail endpoint enriches this)
    reactions: {},

    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

module.exports = { sql, setCorsHeaders, transformCoin };
