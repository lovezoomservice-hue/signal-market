/**
 * /api/alerts — alert feed based on unified signal data
 * FIX: pure ESM, no require(), no unused imports
 */

import { getSignals, DATA_META } from './_data.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const signals = getSignals();

  // Auto-alerts: accelerating signals confidence > 0.9
  const alerts = signals
    .filter(s => s.stage === 'accelerating' && s.confidence > 0.9)
    .map((s, i) => ({
      alert_id:     `alert_${String(i+1).padStart(3,'0')}`,
      type:         'high_confidence_signal',
      topic:        s.topic,
      stage:        s.stage,
      confidence:   s.confidence,
      proof_id:     s.proof_id,
      source_url:   s.source_url,
      triggered_at: new Date().toISOString(),
    }));

  return res.status(200).json({
    alerts,
    count:      alerts.length,
    updated_at: DATA_META.updated_at,
    inputs_hash: DATA_META.inputs_hash,
  });
}
