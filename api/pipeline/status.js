/**
 * Pipeline Status API - Vercel Endpoint
 * GET /api/pipeline/status
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const lastRun = new Date('2026-03-11T10:40:00Z');
  const now = new Date();

  return res.status(200).json({
    pipeline: {
      status: 'idle',
      last_run: lastRun.toISOString(),
      next_run: 'manual',
      duration_last_run_ms: 42300,
    },
    sources: [
      { name: 'github',      status: 'ok', items_last_run: 28 },
      { name: 'hackernews',  status: 'ok', items_last_run: 22 },
      { name: 'arxiv',       status: 'ok', items_last_run: 18 },
      { name: 'reddit',      status: 'ok', items_last_run: 24 },
      { name: 'npm',         status: 'ok', items_last_run: 21 },
      { name: 'producthunt', status: 'ok', items_last_run: 17 },
    ],
    processing: {
      items_collected: 130,
      items_processed: 130,
      signals_generated: 8,
      errors: 0,
    },
    data_age_hours: Math.round((now - lastRun) / 3600000),
    version: 'v4',
    timestamp: now.toISOString(),
  });
}
