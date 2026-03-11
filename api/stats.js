/**
 * Stats API - Vercel Endpoint
 * GET /api/stats
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const now = new Date();
  const lastUpdated = new Date('2026-03-11T10:40:00Z');

  return res.status(200).json({
    signals: {
      total: 8,
      active: 7,
      by_stage: {
        weak: 1,
        forming: 2,
        emerging: 2,
        accelerating: 2,
        peak: 1,
      },
    },
    topics: {
      total: 8,
      categories: 5,
    },
    sources: {
      total: 6,
      active: ['github', 'hackernews', 'arxiv', 'reddit', 'news', 'market'],
    },
    pipeline: {
      last_run: lastUpdated.toISOString(),
      status: 'idle',
      items_processed_last_run: 130,
    },
    data_freshness: {
      last_updated: lastUpdated.toISOString(),
      age_hours: Math.round((now - lastUpdated) / 3600000),
      status: (now - lastUpdated) < 48 * 3600000 ? 'fresh' : 'stale',
    },
    api_version: 'v4',
    timestamp: now.toISOString(),
  });
}
