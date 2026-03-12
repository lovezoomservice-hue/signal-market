/**
 * /api/v2/filter — Structured Signal Filter
 * GET /api/v2/filter
 *
 * Agent use case: "Give me all high-urgency AI signals above 0.8 confidence"
 *
 * Query params:
 *   stage, urgency, min_confidence, max_confidence, topic, source, limit, sort
 */

import { getUnifiedSignals } from '../_unified.js';

const STAGE_URGENCY = {
  accelerating: 'high',
  peak: 'high',
  forming: 'medium',
  emerging: 'low',
  fading: 'low',
  weak: 'low',
};

const URGENCY_ORDER = { high: 3, medium: 2, low: 1 };
const STAGE_ORDER = { accelerating: 5, peak: 4, forming: 3, emerging: 2, fading: 1, weak: 0 };

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
  return STAGE_URGENCY[stage] || 'low';
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

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const {
      stage,
      urgency,
      min_confidence,
      max_confidence,
      topic,
      source,
      limit,
      sort,
    } = req.query || {};

    let signals = getUnifiedSignals();
    const totalUnfiltered = signals.length;
    const filtersApplied = {};

    // Stage filter (comma-separated)
    if (stage) {
      const stages = stage.split(',').map(s => s.trim().toLowerCase());
      signals = signals.filter(s => stages.includes(s.stage?.toLowerCase()));
      filtersApplied.stage = stages;
    }

    // Urgency filter (comma-separated: high,medium,low)
    if (urgency) {
      const urgencies = urgency.split(',').map(u => u.trim().toLowerCase());
      signals = signals.filter(s => {
        const signalUrgency = getUrgency(s.stage);
        return urgencies.includes(signalUrgency.toLowerCase());
      });
      filtersApplied.urgency = urgencies;
    }

    // Confidence range
    if (min_confidence) {
      const minConf = parseFloat(min_confidence);
      signals = signals.filter(s => s.confidence >= minConf);
      filtersApplied.min_confidence = minConf;
    }
    if (max_confidence) {
      const maxConf = parseFloat(max_confidence);
      signals = signals.filter(s => s.confidence <= maxConf);
      filtersApplied.max_confidence = maxConf;
    }

    // Topic filter (partial match, case-insensitive)
    if (topic) {
      const topicFilter = topic.toLowerCase();
      signals = signals.filter(s => s.topic?.toLowerCase().includes(topicFilter));
      filtersApplied.topic = topic;
    }

    // Source filter (comma-separated)
    if (source) {
      const sources = source.split(',').map(s => s.trim().toLowerCase());
      signals = signals.filter(s => {
        const signalSources = (s.sources || []).map(src => src.toLowerCase());
        return sources.some(src => signalSources.some(ss => ss.includes(src)));
      });
      filtersApplied.source = sources;
    }

    // Sorting
    const sortBy = sort || 'urgency';
    signals = [...signals].sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'stage':
          return (STAGE_ORDER[b.stage] || 0) - (STAGE_ORDER[a.stage] || 0);
        case 'urgency':
          return (URGENCY_ORDER[getUrgency(b.stage)] || 0) - (URGENCY_ORDER[getUrgency(a.stage)] || 0);
        case 'evidence':
          return (b.evidenceCount || 0) - (a.evidenceCount || 0);
        default:
          return 0;
      }
    });

    // Apply limit
    const limitNum = limit ? Math.min(parseInt(limit), 100) : 20;
    signals = signals.slice(0, limitNum);

    // Build response with urgency and action fields
    const result = signals.map(signal => {
      const urgencyVal = getUrgency(signal.stage);
      const actionFields = getActionFields(signal.topic, signal.stage);
      return {
        signal_id: signal.signal_id,
        topic: signal.topic,
        stage: signal.stage,
        confidence: signal.confidence,
        urgency: urgencyVal,
        window: actionFields.window,
        agent_action: actionFields.agent_action,
        next_best_action: actionFields.next_best_action,
        decision_question: actionFields.decision_question,
        sources: signal.sources || [],
        evidence_count: signal.evidenceCount || 0,
        impact_score: signal.impact_score,
        category: signal.category,
      };
    });

    return res.status(200).json({
      signals: result,
      filters_applied: filtersApplied,
      count: result.length,
      total_unfiltered: totalUnfiltered,
      sort_by: sortBy,
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('filter error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
