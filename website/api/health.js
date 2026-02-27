/**
 * Health check endpoint for PumpOS.
 * Returns 200 OK so iframe apps (e.g. Pumpbot) can verify the host is reachable.
 *
 * GET /api/health → { status: "ok", ts: <unix ms> }
 */
module.exports = function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({ status: 'ok', ts: Date.now() });
};
