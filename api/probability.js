/**
 * /api/events/:id/probability — Event Probability (P2-3)
 *
 * Computes multi-factor probability score for an event/signal.
 *
 * Routes:
 *   GET /api/events/:id/probability   → probability breakdown
 */

import { getUnifiedSignals } from './_unified.js';
import { getEvidence, getFeedback } from './_store.js';

const STAGE_PRIORS = {
  accelerating: 0.85,
  peak:         0.80,
  forming:      0.65,
  emerging:     0.50,
  weak:         0.30,
  fading:       0.25,
  decaying:     0.15,
  dead:         0.05,
  unknown:      0.40,
};

function bayesianUpdate(prior, positive_signals, negative_signals) {
  // Simple Bayesian update: likelihood ratio
  let p = prior;
  for (let i = 0; i < positive_signals; i++) {
    p = (p * 2.0) / (p * 2.0 + (1 - p));
    p = Math.min(p, 0.97);
  }
  for (let i = 0; i < negative_signals; i++) {
    p = (p * 0.5) / (p * 0.5 + (1 - p));
    p = Math.max(p, 0.03);
  }
  return p;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'event id required' });

  const signals = getUnifiedSignals();
  const idx = parseInt((id || '').replace('evt_', ''), 10) - 1;
  if (idx < 0 || idx >= signals.length) {
    return res.status(404).json({ error: 'Event not found', id });
  }
  const signal = signals[idx];

  // ── Factor 1: Stage prior ───────────────────────────────────────
  const stage = signal.stage || 'unknown';
  const stage_prior = STAGE_PRIORS[stage] || 0.40;

  // ── Factor 2: Evidence weight ───────────────────────────────────
  const evidence = getEvidence(id) || [];
  const ev_count = evidence.length || signal.evidenceCount || 0;
  const ev_weight = Math.min(ev_count * 0.05, 0.25); // max +25%

  // ── Factor 3: Feedback quality score ───────────────────────────
  const feedbacks = getFeedback(id) || [];
  const rated = feedbacks.filter(f => f.rating != null);
  const fb_score = rated.length > 0
    ? rated.reduce((a, f) => a + (f.rating || 0), 0) / rated.length
    : null;
  const fb_weight = fb_score != null ? (fb_score - 0.5) * 0.2 : 0; // ±10%

  // ── Factor 4: Lifecycle momentum ───────────────────────────────
  // P5-1 fix: use pre-merged lifecycle_state from unified signal
  const lc_state = signal.lifecycle_state || stage;
  const momentum_bonus = ['accelerating', 'peak', 'forming'].includes(lc_state) ? 0.05 : 0;
  const momentum_penalty = ['fading', 'decaying', 'dead'].includes(lc_state) ? -0.10 : 0;

  // ── Factor 5: Signal confidence ─────────────────────────────────
  const confidence = signal.confidence || 0.5;

  // ── Bayesian update from positive/negative signals ──────────────
  const positives = Math.floor(ev_count * confidence);
  const negatives = Math.max(0, Math.round((1 - confidence) * 3));
  const bayesian_p = bayesianUpdate(stage_prior, positives, negatives);

  // ── Final composite ─────────────────────────────────────────────
  const raw = bayesian_p + ev_weight + fb_weight + momentum_bonus + momentum_penalty;
  const probability = parseFloat(Math.min(Math.max(raw, 0.03), 0.97).toFixed(3));

  // Confidence interval (±uncertainty based on evidence count)
  const uncertainty = Math.max(0.05, 0.20 - ev_count * 0.015);
  const ci_low  = parseFloat(Math.max(probability - uncertainty, 0.01).toFixed(3));
  const ci_high = parseFloat(Math.min(probability + uncertainty, 0.99).toFixed(3));

  return res.status(200).json({
    event_id:    id,
    topic:       signal.topic,
    probability,
    confidence_interval: { low: ci_low, high: ci_high, uncertainty: parseFloat(uncertainty.toFixed(3)) },
    factors: {
      stage_prior:      parseFloat(stage_prior.toFixed(3)),
      evidence_weight:  parseFloat(ev_weight.toFixed(3)),
      feedback_weight:  parseFloat(fb_weight.toFixed(3)),
      momentum_bonus:   parseFloat((momentum_bonus + momentum_penalty).toFixed(3)),
      signal_confidence: confidence,
      bayesian_updated:  parseFloat(bayesian_p.toFixed(3)),
    },
    inputs: {
      stage,
      lifecycle_state:  lc_state,
      evidence_count:   ev_count,
      feedback_count:   feedbacks.length,
      rated_feedbacks:  rated.length,
      fb_quality_score: fb_score != null ? parseFloat(fb_score.toFixed(2)) : null,
    },
    model: 'bayesian_multi_factor_v1',
    computed_at: new Date().toISOString(),
  });
}
