// deployed: 2026-03-11T12:20
import { getTopics, REAL_SIGNALS, DATA_META } from './_data.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const topics = getTopics();
  const stages = [...new Set(REAL_SIGNALS.map(s => s.stage))];

  return res.status(200).json({
    topics,
    count:       topics.length,
    stages,
    updated_at:  DATA_META.updated_at,
    inputs_hash: DATA_META.inputs_hash,
  });
}
