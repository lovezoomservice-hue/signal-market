/**
 * /api/v2/rank — Agent Signal Ranking
 * GET /api/v2/rank
 *
 * Agent use case: "What should I pay attention to RIGHT NOW?"
 *
 * Scoring: score = (urgency_score * 0.4) + (confidence * 0.35) + (impact_score * 0.25)
 * Stage boost: accelerating +0.15, forming +0.05, emerging 0
 */

import { getUnifiedSignals } from '../_unified.js';

// Urgency score mapping
const URGENCY_SCORE = { high: 1.0, medium: 0.6, low: 0.3 };

// Stage to urgency mapping (for deriving urgency when not in data)
const STAGE_URGENCY = {
  accelerating: 'high',
  peak: 'high',
  forming: 'medium',
  emerging: 'low',
  fading: 'low',
  weak: 'low',
};

// Stage boost for scoring
const STAGE_BOOST = { accelerating: 0.15, peak: 0.15, forming: 0.05, emerging: 0, fading: 0, weak: 0 };

// ACTION_LAYER subset for default values (derived from causal.js)
const ACTION_DEFAULTS = {
  'AI Agents': { agent_action: 'Evaluate agentic framework adoption. Track LangGraph, CrewAI, AutoGPT production deployments.', next_best_action: 'Monitor top 5 agent framework GitHub stars weekly.', decision_question: 'Which agent frameworks will become the production standard in 12 months?', window: '3–12 months' },
  'LLM Infrastructure': { agent_action: 'Monitor vLLM throughput benchmarks and inference provider pricing.', next_best_action: 'Track monthly cost-per-token from top 5 inference providers.', decision_question: 'Which inference stack will dominate enterprise LLM serving in 2026?', window: '3–12 months' },
  'Diffusion Models': { agent_action: 'Track video generation velocity and copyright litigation outcomes.', next_best_action: 'Monitor Sora / Kling / Runway new release announcements.', decision_question: 'Will video generation reach commercial viability before copyright law catches up?', window: '6–18 months' },
  'AI Reasoning': { agent_action: 'Track MATH and GPQA benchmark leaderboard. Monitor reasoning-specialized model releases.', next_best_action: 'Monitor MATH benchmark top-5 monthly.', decision_question: 'Will inference-time compute scaling unlock AGI-level reasoning?', window: '3–12 months' },
  'Efficient AI': { agent_action: 'Track MMLU/HellaSwag performance of models <7B. Watch on-device AI hardware.', next_best_action: 'Monitor Phi-3/Gemma monthly benchmark updates.', decision_question: 'Which small model will become the dominant on-device AI in 2026?', window: '6–18 months' },
  'Reinforcement Learning': { agent_action: 'Track RLHF and process reward model papers. Monitor alignment research velocity.', next_best_action: 'Monitor arXiv RL paper count weekly.', decision_question: 'Will RL-driven reasoning continue to accelerate?', window: '6–18 months' },
  'AI Coding': { agent_action: 'Monitor SWE-bench leaderboard. Track enterprise AI coding tool adoption.', next_best_action: 'Track SWE-bench top 5 models monthly.', decision_question: 'When will AI coding reach autonomous completion of real-world tasks?', window: '3–12 months' },
};

function getUrgency(stage) {
  return STAGE_URGENCY[stage] || 'medium';
}

function getUrgencyScore(urgency) {
  return URGENCY_SCORE[urgency] ?? 0.5;
}

function getStageBoost(stage) {
  return STAGE_BOOST[stage] ?? 0;
}

function getActionFields(topic, stage) {
  const defaults = ACTION_DEFAULTS[topic] || {};
  return {
    agent_action: defaults.agent_action || `Track ${topic} signals weekly. Escalate if stage changes.`,
    next_best_action: defaults.next_best_action || `Set a weekly monitoring cadence for ${topic}.`,
    decision_question: defaults.decision_question || `What will determine the trajectory of ${topic} in the next 12 months?`,
    window: defaults.window || (stage === 'accelerating' ? '3–12 months' : stage === 'forming' ? '6–18 months' : '12–36 months'),
  };
}

function computeScore(signal) {
  const urgency = signal.urgency || getUrgency(signal.stage);
  const urgencyScore = getUrgencyScore(urgency);
  const confidence = signal.confidence || 0.5;
  const impactScore = signal.impact_score || 0.5;
  const stageBoost = getStageBoost(signal.stage);

  const baseScore = (urgencyScore * 0.4) + (confidence * 0.35) + (impactScore * 0.25);
  return parseFloat((baseScore + stageBoost).toFixed(3));
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const { limit, min_confidence, stage, urgency, topic } = req.query || {};

    let signals = getUnifiedSignals();

    // Apply filters
    if (min_confidence) {
      const minConf = parseFloat(min_confidence);
      signals = signals.filter(s => s.confidence >= minConf);
    }
    if (stage) {
      const stages = stage.split(',').map(s => s.trim().toLowerCase());
      signals = signals.filter(s => stages.includes(s.stage?.toLowerCase()));
    }
    if (urgency) {
      const urgencies = urgency.split(',').map(u => u.trim().toLowerCase());
      signals = signals.filter(s => {
        const signalUrgency = getUrgency(s.stage);
        return urgencies.includes(signalUrgency.toLowerCase());
      });
    }
    if (topic) {
      const topicFilter = topic.toLowerCase();
      signals = signals.filter(s => s.topic?.toLowerCase().includes(topicFilter));
    }

    // Compute scores and rank
    const ranked = signals
      .map(signal => {
        const urgency = signal.urgency || getUrgency(signal.stage);
        const actionFields = getActionFields(signal.topic, signal.stage);
        const agentScore = computeScore(signal);

        return {
          signal_id: signal.signal_id,
          topic: signal.topic,
          stage: signal.stage,
          confidence: signal.confidence,
          urgency,
          impact_score: signal.impact_score,
          agent_score: agentScore,
          agent_action: actionFields.agent_action,
          next_best_action: actionFields.next_best_action,
          decision_question: actionFields.decision_question,
          window: actionFields.window,
          monitoring_points: signal.monitoring_points || null,
        };
      })
      .sort((a, b) => b.agent_score - a.agent_score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    // Apply limit
    const limitNum = limit ? Math.min(parseInt(limit), 50) : 10;
    const result = ranked.slice(0, limitNum);

    return res.status(200).json({
      ranked: result,
      total: ranked.length,
      limit: limitNum,
      filters: { min_confidence, stage, urgency, topic },
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('rank error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
