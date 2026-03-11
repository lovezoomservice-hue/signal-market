import { REAL_SIGNALS, DATA_META } from './_data.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const now         = new Date();
  const lastUpdated = new Date(DATA_META.updated_at + 'T10:40:00Z');

  // Compute from unified data
  const byStage = REAL_SIGNALS.reduce((acc, s) => {
    acc[s.stage] = (acc[s.stage] || 0) + 1;
    return acc;
  }, {});

  const allSources = [...new Set(REAL_SIGNALS.flatMap(s => s.sources))];
  const total = REAL_SIGNALS.length;

  return res.status(200).json({
    signals: {
      total,
      active:   REAL_SIGNALS.filter(s => s.stage !== 'dead').length,
      by_stage: byStage,
    },
    topics: {
      total,
      categories: [...new Set(REAL_SIGNALS.map(s => s.category))].length,
    },
    sources: {
      total:  allSources.length,
      active: allSources,
    },
    pipeline: {
      last_run:               lastUpdated.toISOString(),
      status:                 'idle',
      items_processed_last_run: total * 10,
    },
    data_freshness: {
      last_updated: lastUpdated.toISOString(),
      age_hours:    Math.round((now - lastUpdated) / 3600000),
      status:       (now - lastUpdated) < 48 * 3600000 ? 'fresh' : 'stale',
      inputs_hash:  DATA_META.inputs_hash,
    },
    api_version: 'v4',
    timestamp:   now.toISOString(),
  });
}
