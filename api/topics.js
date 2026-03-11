// deployed: 2026-03-11T12:20
import { getUnifiedTopics, getUnifiedSignals, getUnifiedMeta } from './_unified.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const topics = getUnifiedTopics();
  const stages = [...new Set(getUnifiedSignals().map(s => s.stage))];

  return res.status(200).json({
    topics,
    count:       topics.length,
    stages,
    updated_at:  getUnifiedMeta().updated_at,
    inputs_hash: getUnifiedMeta().inputs_hash,
  });
}
