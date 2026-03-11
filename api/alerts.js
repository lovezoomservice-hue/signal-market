// deployed: 2026-03-11T12:20
/**
 * /api/alerts — alert feed based on unified signal data
 * FIX: pure ESM, no require(), no unused imports
 */

import { getUnifiedSignals, getUnifiedMeta } from './_unified.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const signals = getUnifiedSignals();

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
    updated_at: getUnifiedMeta().updated_at,
    inputs_hash: getUnifiedMeta().inputs_hash,
  });
}
