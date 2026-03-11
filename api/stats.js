import { getUnifiedSignals, getUnifiedMeta } from './_unified.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const now         = new Date();
  const lastUpdated = new Date(getUnifiedMeta().updated_at + 'T10:40:00Z');

  // Compute from unified data
  const byStage = getUnifiedSignals().reduce((acc, s) => {
    acc[s.stage] = (acc[s.stage] || 0) + 1;
    return acc;
  }, {});

  const allSources = [...new Set(getUnifiedSignals().flatMap(s => s.sources))];
  const total = getUnifiedSignals().length;

  return res.status(200).json({
    signals: {
      total,
      active:   getUnifiedSignals().filter(s => s.stage !== 'dead').length,
      by_stage: byStage,
    },
    topics: {
      total,
      categories: [...new Set(getUnifiedSignals().map(s => s.category))].length,
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
      inputs_hash:  getUnifiedMeta().inputs_hash,
    },
    api_version: 'v4',
    timestamp:   now.toISOString(),
  });
}
