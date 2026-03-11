import { getSignals, DATA_META } from './_data.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { stage, limit } = req.query || {};
  const signals = getSignals({ stage, limit });

  return res.status(200).json({
    signals,
    count:       signals.length,
    updated_at:  DATA_META.updated_at,
    inputs_hash: DATA_META.inputs_hash,
    source:      DATA_META.source,
  });
}
