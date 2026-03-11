// deployed: 2026-03-11T12:20
import { getTrends, DATA_META } from './_data.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { limit } = req.query || {};
  const trends = getTrends({ limit });

  return res.status(200).json({
    trends,
    count:       trends.length,
    updated_at:  DATA_META.updated_at,
    inputs_hash: DATA_META.inputs_hash,
    source:      DATA_META.source,
  });
}
