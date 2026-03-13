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

// ── Professional Judgment Knowledge Base (from causal.js ACTION_LAYER) ───────
const PROFESSIONAL_JUDGMENT = {
  'AI Agents': { summary: 'VCs and analysts converge: agentic AI is the primary enterprise deployment vector for 2026. YC, Greylock, and a16z all active.', key_voices: ['Y Combinator', 'Greylock', 'MIT Technology Review'], consensus: 'bullish' },
  'LLM Infrastructure': { summary: 'SemiAnalysis and Stratechery see infrastructure cost as the defining constraint. GB200 NVL72 benchmarks indicate continued NVIDIA dominance.', key_voices: ['SemiAnalysis', 'Stratechery', 'MIT Technology Review'], consensus: 'bullish' },
  'Diffusion Models': { summary: 'Benedict Evans notes creative tool adoption accelerating; legal clarity on IP still the main risk.', key_voices: ['Benedict Evans', 'MIT Technology Review'], consensus: 'divided' },
  'AI Coding': { summary: 'Strong VC interest (TechCrunch Venture) with GitHub Copilot enterprise growth as primary signal. Consensus: coding is the fastest-monetizing AI use case.', key_voices: ['TechCrunch Venture', 'Y Combinator', 'Stratechery'], consensus: 'bullish' },
  'Efficient AI': { summary: 'On-device AI getting serious attention post-Apple Silicon M4. Edge inference as cost arbitrage.', key_voices: ['MIT Technology Review', 'Benedict Evans'], consensus: 'neutral' },
  'AI Reasoning': { summary: 'Stratechery and Dwarkesh see reasoning improvements as the key unlock for autonomous workflows. o3/o4 series as evidence.', key_voices: ['Stratechery', 'Dwarkesh Podcast'], consensus: 'bullish' },
  'Reinforcement Learning': { summary: 'Dwarkesh and Stratechery see RL as critical path to AGI reasoning. o1 series as proof point.', key_voices: ['Dwarkesh Podcast', 'Stratechery'], consensus: 'bullish' },
  'Multimodal AI': { summary: 'Benedict Evans: Vision Pro + GPT-4o show convergence. Still early for enterprise ROI.', key_voices: ['Benedict Evans', 'MIT Technology Review'], consensus: 'neutral' },
  'Robotics & Embodied AI': { summary: 'TechCrunch Venture: $1.15B+ unicorn in humanoid robotics. Greylock sees physical AI as 10-year thesis.', key_voices: ['TechCrunch Venture', 'Greylock'], consensus: 'bullish' },
  'AI Chips & Custom Silicon': { summary: 'SemiAnalysis: H100 vs GB200 NVL72 benchmarks favor GB200 4x on training throughput. Custom silicon ROI debate ongoing.', key_voices: ['SemiAnalysis'], consensus: 'bullish' },
  'Autonomous Vehicles': { summary: 'Mixed signals. Waymo expansion vs regulatory headwinds. Stratechery skeptical of timeline.', key_voices: ['Stratechery', 'TechCrunch Venture'], consensus: 'divided' },
  'AI Policy & Governance': { summary: 'The Hill + CNBC tracking congressional AI hearings. EU AI Act enforcement timeline 2026. Stratechery: governance will lag innovation by 5+ years.', key_voices: ['The Hill', 'Stratechery', 'MIT Technology Review'], consensus: 'divided' },
  'AI Investment & Capital': { summary: 'TechCrunch Venture: $30M+ rounds weekly in AI infra. YC W26 cohort 70%+ AI. Capital concentration at infra+agent layers.', key_voices: ['TechCrunch Venture', 'Y Combinator', 'Greylock'], consensus: 'bullish' },
  'Brain-Computer Interface': { summary: 'Not Boring covers Neuralink progress. Long-horizon, high-conviction minority view.', key_voices: ['Not Boring'], consensus: 'neutral' },
  'Commercial Space & AI': { summary: 'TechCrunch Venture active in satellite/launch. YC sees space as infrastructure play.', key_voices: ['TechCrunch Venture', 'Y Combinator'], consensus: 'neutral' },
  'Transformer Architecture': { summary: 'Architecture evolution ongoing. Transformers dominant but under pressure from SSM alternatives.', key_voices: ['MIT Technology Review', 'Benedict Evans'], consensus: 'neutral' },
};

// Topic aliases
PROFESSIONAL_JUDGMENT['Transformer Arch'] = PROFESSIONAL_JUDGMENT['Transformer Architecture'];
PROFESSIONAL_JUDGMENT['AI Infrastructure'] = PROFESSIONAL_JUDGMENT['LLM Infrastructure'];

function getProfessionalJudgment(topic) {
  // Case-insensitive lookup
  const normalized = (topic || '').toLowerCase().replace(/[\s_+]/g, ' ').trim();
  for (const [t, judgment] of Object.entries(PROFESSIONAL_JUDGMENT)) {
    if (t.toLowerCase().replace(/[\s_+]/g, ' ') === normalized) {
      return judgment;
    }
  }
  return { summary: `Professional coverage of ${topic} is emerging across analyst and VC channels.`, key_voices: ['MIT Technology Review'], consensus: 'neutral' };
}

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
      const profJudgment = getProfessionalJudgment(signal.topic);
      return {
        signal_id: signal.signal_id,
        topic: signal.topic,
        stage: signal.stage,
        confidence: signal.confidence,
        urgency,
        impact_score: signal.impact_score,
        sources: signal.sources || [],
        source_url: signal.source_url || null,
        evidence_count: signal.evidenceCount || 0,
        updated_at: signal.updated_at || new Date().toISOString(),
        window: actionFields.window,
        agent_action: actionFields.agent_action,
        next_best_action: actionFields.next_best_action,
        decision_question: actionFields.decision_question,
        professional_judgment: profJudgment,
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

    // Build consensus comparison
    const bullishSignals = items.filter(i => i.professional_judgment.consensus === 'bullish');
    const dividedSignals = items.filter(i => i.professional_judgment.consensus === 'divided');
    const neutralSignals = items.filter(i => i.professional_judgment.consensus === 'neutral');

    // Most bullish = bullish consensus with highest confidence
    const mostBullish = bullishSignals.length > 0
      ? bullishSignals.reduce((a, b) => (a.confidence > b.confidence ? a : b))
      : null;

    // Most divided = first signal with divided consensus
    const mostDivided = dividedSignals.length > 0 ? dividedSignals[0] : null;

    // Build summary
    const summaryParts = [];
    if (mostBullish) summaryParts.push(`${mostBullish.topic} shows bullish consensus`);
    if (bullishSignals.length > 1) summaryParts.push(`${bullishSignals.map(s => s.topic).join(', ')} share bullish outlook`);
    if (mostDivided) summaryParts.push(`${mostDivided.topic} remains divided`);
    if (neutralSignals.length > 0) summaryParts.push(`${neutralSignals.map(s => s.topic).join(', ')} ${neutralSignals.length === 1 ? 'is' : 'are'} neutral`);
    const consensusSummary = summaryParts.length > 0
      ? summaryParts.join('; ') + '.'
      : 'Professional judgment varies across selected topics.';

    const consensusComparison = {
      most_bullish: mostBullish?.topic || null,
      most_divided: mostDivided?.topic || null,
      summary: consensusSummary,
      bullish_count: bullishSignals.length,
      divided_count: dividedSignals.length,
      neutral_count: neutralSignals.length,
    };

    // Clean up internal fields
    const cleanItems = items.map(({ _verdict_score, ...item }) => item);

    return res.status(200).json({
      comparison: cleanItems,
      count: cleanItems.length,
      verdict,
      consensus_comparison: consensusComparison,
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('compare error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
