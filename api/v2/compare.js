/**
 * /api/v2/compare — Side-by-side Signal Comparison
 * GET /api/v2/compare?ids=evt_001,evt_002  OR  GET /api/v2/compare?topics=AI+Agents,LLM+Infrastructure
 *
 * Agent use case: "Compare signal A vs signal B — which should I act on first?"
 *
 * Verdict: picks signal with higher (urgency_score * confidence)
 */

import { getUnifiedSignals } from '../_unified.js';

const URGENCY_SCORE = { high: 1.0, medium: 0.6, low: 0.3 };
const STAGE_URGENCY = {
  accelerating: 'high', peak: 'high', forming: 'medium',
  emerging: 'low', fading: 'low', weak: 'low',
};

const ACTION_DEFAULTS = {
  'AI Agents': { agent_action: 'Evaluate agentic framework adoption.', next_best_action: 'Monitor agent framework GitHub stars weekly.', decision_question: 'Which agent frameworks will become the production standard?', window: '3–12 months' },
  'LLM Infrastructure': { agent_action: 'Monitor inference benchmarks and pricing.', next_best_action: 'Track cost-per-token from inference providers.', decision_question: 'Which inference stack will dominate?', window: '3–12 months' },
  'Diffusion Models': { agent_action: 'Track video generation and copyright litigation.', next_best_action: 'Monitor generative video model releases.', decision_question: 'Will video generation reach commercial viability?', window: '6–18 months' },
  'AI Reasoning': { agent_action: 'Track reasoning benchmarks.', next_best_action: 'Monitor MATH/GPQA leaderboards.', decision_question: 'Will inference-time scaling unlock AGI reasoning?', window: '3–12 months' },
  'Efficient AI': { agent_action: 'Track small model benchmarks.', next_best_action: 'Monitor on-device AI announcements.', decision_question: 'Which small model will dominate on-device AI?', window: '6–18 months' },
  'Reinforcement Learning': { agent_action: 'Track RLHF research velocity.', next_best_action: 'Monitor arXiv RL papers.', decision_question: 'Will RL-driven reasoning accelerate?', window: '6–18 months' },
  'AI Coding': { agent_action: 'Monitor SWE-bench leaderboard.', next_best_action: 'Track enterprise AI coding adoption.', decision_question: 'When will AI coding reach autonomous completion?', window: '3–12 months' },
};

function getUrgency(stage) {
  return STAGE_URGENCY[stage] || 'medium';
}

function getUrgencyScore(urgency) {
  return URGENCY_SCORE[urgency] ?? 0.5;
}

function getActionFields(topic, stage) {
  const defaults = ACTION_DEFAULTS[topic] || {};
  return {
    agent_action: defaults.agent_action || `Track ${topic} signals weekly.`,
    next_best_action: defaults.next_best_action || `Monitor ${topic} weekly.`,
    decision_question: defaults.decision_question || `What determines ${topic} trajectory?`,
    window: defaults.window || (stage === 'accelerating' ? '3–12 months' : stage === 'forming' ? '6–18 months' : '12–36 months'),
  };
}

function computeVerdictScore(signal) {
  const urgency = getUrgency(signal.stage);
  return getUrgencyScore(urgency) * (signal.confidence || 0.5);
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const { ids, topics } = req.query || {};

    if (!ids && !topics) {
      return res.status(400).json({ error: 'Provide ?ids=evt_001,evt_002 or ?topics=AI+Agents,LLM+Infrastructure' });
    }

    const allSignals = getUnifiedSignals();
    let selectedSignals = [];

    if (ids) {
      const idList = ids.split(',').map(id => id.trim()).slice(0, 5);
      selectedSignals = idList.map(id => {
        const idx = parseInt((id || '').replace('evt_', ''), 10) - 1;
        return (idx >= 0 && idx < allSignals.length) ? allSignals[idx] : null;
      }).filter(Boolean);
    } else if (topics) {
      const topicList = topics.split(',').map(t => t.trim()).slice(0, 5);
      selectedSignals = topicList.map(topic => {
        return allSignals.find(s => s.topic?.toLowerCase().includes(topic.toLowerCase()));
      }).filter(Boolean);
    }

    if (selectedSignals.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 valid signals to compare', found: selectedSignals.length });
    }

    // Build comparison items
    const items = selectedSignals.map(signal => {
      const urgency = getUrgency(signal.stage);
      const actionFields = getActionFields(signal.topic, signal.stage);
      return {
        signal_id: signal.signal_id,
        topic: signal.topic,
        stage: signal.stage,
        confidence: signal.confidence,
        urgency,
        window: actionFields.window,
        agent_action: actionFields.agent_action,
        next_best_action: actionFields.next_best_action,
        decision_question: actionFields.decision_question,
        sources: signal.sources || [],
        evidence_count: signal.evidenceCount || 0,
        impact_score: signal.impact_score,
        _verdict_score: computeVerdictScore(signal),
      };
    });

    // Determine verdict
    const sorted = [...items].sort((a, b) => b._verdict_score - a._verdict_score);
    const winner = sorted[0];
    const runnerUp = sorted[1];

    const urgencyRatio = winner._verdict_score > 0 && runnerUp._verdict_score > 0
      ? parseFloat((winner._verdict_score / runnerUp._verdict_score).toFixed(2))
      : null;

    const verdict = {
      recommended: winner.signal_id,
      recommended_topic: winner.topic,
      reason: `${winner.topic} has higher urgency-confidence product (${winner.urgency} urgency × ${(winner.confidence).toFixed(2)} confidence = ${winner._verdict_score.toFixed(3)}) vs ${runnerUp.topic} (${runnerUp._verdict_score.toFixed(3)})`,
      relative_urgency: urgencyRatio ? `${winner.topic} is ${urgencyRatio}x more actionable than ${runnerUp.topic}` : `${winner.topic} is more actionable based on urgency and confidence`,
    };

    // Clean up internal fields
    const cleanItems = items.map(({ _verdict_score, ...item }) => item);

    return res.status(200).json({
      comparison: cleanItems,
      count: cleanItems.length,
      verdict,
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('compare error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
