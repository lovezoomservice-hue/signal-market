/**
 * GET /api/v2/agent-brief — Agent Decision Brief
 *
 * Agent use case: "Give me everything I need to make a decision in ONE API call"
 *
 * This is the consolidated single-call endpoint that agents should use as their PRIMARY entry point.
 * It merges: signal metadata + causal context + action layer + rank score + source layer.
 *
 * Query params:
 *   ?limit=N (default 5, max 20) — how many top signals to return
 *   ?urgency=high — filter by urgency
 *   ?topic=AI — partial match topic filter
 *   ?format=minimal — return only: rank, topic, urgency, decision_question, next_best_action
 */

import { getUnifiedSignals } from '../_unified.js';

// ── ACTION_LAYER (copied from causal.js) ─────────────────────────────────────
const ACTION_LAYER = {
  'AI Agents': {
    monitoring_points: ['arXiv agent paper velocity (weekly)', 'GitHub star growth for top 5 agent frameworks', 'Enterprise AI adoption surveys', 'LLM provider API deprecations'],
    invalidation_conditions: ['Agent benchmark improvements stall for 2+ consecutive quarters', 'Major LLM providers deprecate function-calling / tool use'],
    agent_action: 'Evaluate agentic framework adoption. Track LangGraph, CrewAI, AutoGPT production deployments.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Monitor top 5 agent framework GitHub stars weekly. Set alert for any LLM provider API deprecation announcement.',
    decision_question: 'Which agent frameworks will become the production standard in 12 months?',
  },
  'LLM Infrastructure': {
    monitoring_points: ['vLLM / TGI GitHub activity', 'Inference benchmark leaderboard updates', 'Cloud provider inference pricing trends', 'NVIDIA H100/H200 allocation & pricing'],
    invalidation_conditions: ['Major cloud providers commoditize all inference optimization', 'Alternative architectures require fundamentally different infrastructure'],
    agent_action: 'Monitor vLLM throughput benchmarks and inference provider pricing. Watch for consolidation.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Track monthly cost-per-token from top 5 inference providers. Watch for vLLM vs TGI convergence.',
    decision_question: 'Which inference stack will dominate enterprise LLM serving in 2026?',
  },
  'Diffusion Models': {
    monitoring_points: ['Video generation quality benchmarks', 'Copyright litigation outcomes (US + EU)', 'Adobe/Getty integration announcements', 'Sora / Runway / Kling release cadence'],
    invalidation_conditions: ['Regulatory ban on training on copyrighted media', 'Video gen quality plateau without new architecture breakthrough'],
    agent_action: 'Track video generation velocity and copyright litigation outcomes.',
    urgency: 'medium', window: '6–18 months',
    next_best_action: 'Monitor Sora / Kling / Runway new release announcements. Track EU AI Act image generation provisions.',
    decision_question: 'Will video generation reach commercial viability before copyright law catches up?',
  },
  'AI Coding': {
    monitoring_points: ['SWE-bench leaderboard monthly', 'GitHub Copilot enterprise adoption rate', 'Job posting demand for AI coding tools', 'Agentic coding autonomous task completion %'],
    invalidation_conditions: ['SWE-bench scores plateau below 50% pass rate', 'Enterprise adoption stalls due to IP / security concerns'],
    agent_action: 'Monitor SWE-bench leaderboard. Track enterprise AI coding tool adoption in job postings.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Track SWE-bench top 5 models monthly. Monitor GitHub Copilot enterprise seat count announcements.',
    decision_question: 'When will AI coding reach autonomous completion of real-world software tasks?',
  },
  'Efficient AI': {
    monitoring_points: ['MMLU/HellaSwag scores for sub-7B models', 'On-device AI hardware announcements (Apple, Qualcomm)', 'Edge inference benchmark releases', 'Hugging Face small model download trends'],
    invalidation_conditions: ['Compute cost drops make efficiency irrelevant', 'Small model quality fails to close gap with large models'],
    agent_action: 'Track MMLU/HellaSwag performance of models <7B. Watch on-device AI hardware announcements.',
    urgency: 'medium', window: '6–18 months',
    next_best_action: 'Monitor Phi-3/Gemma monthly benchmark updates. Track Apple Silicon Neural Engine utilization announcements.',
    decision_question: 'Which small model will become the dominant on-device AI in 2026?',
  },
  'Reinforcement Learning': {
    monitoring_points: ['arXiv RL paper count weekly', 'RLHF vs DPO adoption trends', 'Process reward model papers', 'Reasoning benchmark (MATH, GPQA) improvement velocity'],
    invalidation_conditions: ['RLHF improvements plateau without new algorithmic breakthroughs', 'Compute cost for RL training remains prohibitive'],
    agent_action: 'Track RLHF and process reward model papers. Monitor alignment research velocity.',
    urgency: 'medium', window: '6–18 months',
    next_best_action: 'Monitor arXiv RL paper count weekly. Track process reward model benchmark results.',
    decision_question: 'Will RL-driven reasoning continue to accelerate or hit diminishing returns?',
  },
  'AI Reasoning': {
    monitoring_points: ['MATH and GPQA benchmark leaderboard weekly', 'DeepSeek-R1 replication papers', 'o1/o3 API availability and pricing', 'Process reward model paper velocity'],
    invalidation_conditions: ['Reasoning gains fail to transfer to real-world tasks', 'Compute cost per reasoning token remains prohibitive'],
    agent_action: 'Track MATH and GPQA benchmark leaderboard. Monitor reasoning-specialized model releases.',
    urgency: 'high', window: '3–12 months',
    next_best_action: 'Monitor MATH benchmark top-5 monthly. Track o3 API pricing and availability.',
    decision_question: 'Will inference-time compute scaling unlock AGI-level reasoning or hit a ceiling?',
  },
  'Multimodal AI': {
    monitoring_points: ['Multimodal benchmark releases (MMBench, MMMU)', 'Enterprise adoption in medical imaging / design', 'Video understanding model releases', 'GPT-5 / Gemini Ultra multimodal capability announcements'],
    invalidation_conditions: ['Specialized models maintain quality advantage in key verticals', 'Data scarcity limits multimodal training progress'],
    agent_action: 'Monitor multimodal benchmark releases and enterprise adoption in design, medical imaging, and video.',
    urgency: 'medium', window: '6–18 months',
    next_best_action: 'Track MMBench top-5 monthly. Monitor Adobe / Figma AI multimodal integration announcements.',
    decision_question: 'Which multimodal model will dominate enterprise visual tasks in 2026?',
  },
  'Robotics & Embodied AI': {
    monitoring_points: ['Humanoid robot production unit announcements', 'RT-2/pi0 model benchmark improvements', 'Manufacturing deployment contracts', 'Figure / 1X / Unitree monthly update releases'],
    invalidation_conditions: ['Physical world transfer learning plateaus without new data modalities', 'Cost per robot stays above $50k for 2+ years'],
    agent_action: 'Track monthly robot deployment announcements and arXiv manipulation paper velocity.',
    urgency: 'high', window: '12–36 months',
    next_best_action: 'Monitor Figure AI and 1X robot production announcements monthly. Track dexterous manipulation arXiv paper count.',
    decision_question: 'Which humanoid robot company will reach 1,000 production units first?',
  },
  'Brain-Computer Interface': {
    monitoring_points: ['Neuralink patient count milestones', 'Non-invasive EEG accuracy benchmarks', 'FDA approval pipeline for BCI devices', 'Synchron clinical trial results'],
    invalidation_conditions: ['Adverse events from implanted devices halt clinical trials', 'Wireless bandwidth limits block high-resolution decoding'],
    agent_action: 'Monitor Neuralink clinical trial updates and non-invasive BCI accuracy papers.',
    urgency: 'medium', window: '12–48 months',
    next_best_action: 'Track Neuralink patient count and Synchron FDA approval timeline quarterly.',
    decision_question: 'Will non-invasive BCI achieve commercial viability before implanted BCIs scale?',
  },
  'Commercial Space & AI': {
    monitoring_points: ['Starship launch cadence and reuse count', 'Satellite constellation AI processing announcements', 'Launch cost per kg trajectory', 'Competing launch vehicle milestones (Blue Origin, RocketLab)'],
    invalidation_conditions: ['Starship development halted by regulatory or technical failure', 'Alternative launch vehicles maintain cost competitiveness'],
    agent_action: 'Track Starship launch manifest and per-kg cost estimates quarterly.',
    urgency: 'medium', window: '24–60 months',
    next_best_action: 'Monitor SpaceX Starship launch cadence monthly. Track $/kg cost reduction trajectory.',
    decision_question: 'When will Starship achieve full reusability and collapse launch costs by 10x?',
  },
  'AI Chips & Custom Silicon': {
    monitoring_points: ['Groq/Cerebras inference $/token vs NVIDIA', 'Hyperscaler custom silicon production ramp', 'AMD MI300X deployment velocity', 'NVIDIA H200/Blackwell allocation & ASP'],
    invalidation_conditions: ['NVIDIA H100 supply normalizes and ASP drops >40%', 'Custom silicon yields remain low below 7nm process'],
    agent_action: 'Track inference cost benchmarks and hyperscaler ASIC deployment announcements.',
    urgency: 'high', window: '6–24 months',
    next_best_action: 'Track monthly $/token benchmarks for Groq vs Cerebras vs NVIDIA. Monitor AMD MI300X deployment announcements.',
    decision_question: 'Will alternative AI accelerators capture >20% market share from NVIDIA by 2027?',
  },
  'Autonomous Vehicles': {
    monitoring_points: ['Waymo weekly ride volume quarterly', 'Tesla FSD miles per disengagement', 'Robotaxi expansion city announcements', 'Apollo / WeRide China fleet size'],
    invalidation_conditions: ['Major autonomous accident triggers federal regulatory freeze', 'LiDAR/sensor cost fails to reach sub-$500 threshold'],
    agent_action: 'Monitor Waymo weekly ride count, Tesla FSD v12 disengagement rate, and robotaxi expansion cities.',
    urgency: 'high', window: '12–36 months',
    next_best_action: 'Track Waymo weekly ride count quarterly reports. Monitor Tesla FSD release notes for disengagement improvements.',
    decision_question: 'Will Waymo or Tesla FSD reach commercial scale in 10+ cities by end of 2026?',
  },
  'AI Policy & Governance': {
    monitoring_points: ['EU AI Act high-risk system compliance deadlines', 'US NIST AI RMF adoption by federal contractors', 'Frontier model reporting requirements', 'China AI governance new regulations'],
    invalidation_conditions: ['Regulatory deadlines extended under industry lobbying', 'Major AI safety incident accelerates restrictions beyond current scope'],
    agent_action: 'Track EU AI Act enforcement timeline and US NIST framework adoption milestones.',
    urgency: 'medium', window: '6–24 months',
    next_best_action: 'Monitor EU AI Act implementation dates monthly. Track US congressional AI legislation votes.',
    decision_question: 'Will EU AI Act enforcement reshape AI product development more than GDPR did?',
  },
  'AI Investment & Capital': {
    monitoring_points: ['Monthly AI funding announcements >$100M', 'Hyperscaler AI capex guidance', 'AI startup acquisition activity', 'AI company IPO pipeline'],
    invalidation_conditions: ['Interest rate shock dries up growth capital', 'AI revenue multiples compress below 10x ARR'],
    agent_action: 'Track monthly AI funding rounds and hyperscaler capex announcements.',
    urgency: 'high', window: '6–18 months',
    next_best_action: 'Monitor weekly AI funding rounds >$50M. Track MSFT/GOOG/META quarterly capex guidance.',
    decision_question: 'Is AI investment in a sustainable growth phase or approaching a peak valuation cycle?',
  },
};

// ── Rank scoring (same as rank.js) ───────────────────────────────────────────
const URGENCY_SCORE = { high: 1.0, medium: 0.6, low: 0.3 };
const STAGE_URGENCY = {
  accelerating: 'high', peak: 'high', forming: 'medium', emerging: 'low', fading: 'low', weak: 'low',
};
const STAGE_BOOST = { accelerating: 0.15, peak: 0.15, forming: 0.05, emerging: 0, fading: 0, weak: 0 };

function getUrgency(stage) {
  return STAGE_URGENCY[stage] || 'medium';
}

function getUrgencyScore(urgency) {
  return URGENCY_SCORE[urgency] ?? 0.5;
}

function getStageBoost(stage) {
  return STAGE_BOOST[stage] ?? 0;
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

// ── Evidence summary generator ───────────────────────────────────────────────
function generateEvidenceSummary(signal) {
  const sources = signal.sources || [];
  const stage = signal.stage || 'emerging';
  const conf = Math.round((signal.confidence || 0) * 100);
  const sourceCount = sources.length;
  return `Confidence ${conf}% · ${sourceCount} source${sourceCount !== 1 ? 's' : ''} · ${stage}`;
}

// ── Extract source names from source URLs/tags ───────────────────────────────
function extractSourceNames(signal) {
  const sources = signal.sources || [];
  const sourceTag = signal.source_tag;
  const names = [];
  for (const src of sources) {
    const name = src.split(':')[0].split('/').pop();
    if (name && !names.includes(name)) names.push(name);
  }
  if (sourceTag && !names.includes(sourceTag)) names.push(sourceTag);
  return names.length > 0 ? names : ['unknown'];
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const { limit, urgency, topic, format } = req.query || {};

    // Load all signals
    let signals = getUnifiedSignals();

    // Apply filters
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
        const signalUrgency = signal.urgency || getUrgency(signal.stage);
        const actionFields = ACTION_LAYER[signal.topic] || {
          agent_action: `Track ${signal.topic} signals weekly. Escalate if stage changes.`,
          next_best_action: `Set a weekly monitoring cadence for ${signal.topic}.`,
          decision_question: `What will determine the trajectory of ${signal.topic} in the next 12 months?`,
          window: signal.stage === 'accelerating' ? '3–12 months' : signal.stage === 'forming' ? '6–18 months' : '12–36 months',
          monitoring_points: [`Monitor ${signal.topic} velocity over next 30 days`],
          invalidation_conditions: [`${signal.topic} confidence drops below 0.5 for 2 consecutive weeks`],
          urgency: signalUrgency,
          escalation: `${signal.topic} reaches mainstream enterprise adoption`,
          downgrade: `${signal.topic} momentum stalls for 3+ consecutive months`,
        };

        const agentScore = computeScore(signal);

        return {
          rank: 0, // Will be set after sorting
          signal_id: signal.signal_id,
          topic: signal.topic,
          stage: signal.stage,
          confidence: signal.confidence,
          urgency: signalUrgency,
          window: actionFields.window,
          agent_score: agentScore,
          // Action layer fields
          decision_question: actionFields.decision_question,
          next_best_action: actionFields.next_best_action,
          agent_action: actionFields.agent_action,
          monitoring_points: actionFields.monitoring_points || [],
          invalidation_conditions: actionFields.invalidation_conditions || [],
          escalation: actionFields.escalation,
          downgrade: actionFields.downgrade,
          // Evidence summary
          evidence_summary: generateEvidenceSummary(signal),
          sources: extractSourceNames(signal),
          source_url: signal.source_url || null,
          // Full signal data (for non-minimal format)
          impact_score: signal.impact_score,
          cross_validated: signal.cross_validated || (signal.sources || []).length >= 2,
        };
      })
      .sort((a, b) => b.agent_score - a.agent_score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    // Apply limit
    const limitNum = limit ? Math.min(parseInt(limit), 20) : 5;
    const topSignals = ranked.slice(0, limitNum);

    // Minimal format strips down response
    if (format === 'minimal') {
      const minimalSignals = topSignals.map(s => ({
        rank: s.rank,
        topic: s.topic,
        urgency: s.urgency,
        decision_question: s.decision_question,
        next_best_action: s.next_best_action,
        agent_action: s.agent_action,
      }));
      return res.status(200).json({
        generated_at: new Date().toISOString(),
        agent_brief_version: 'v1',
        format: 'minimal',
        top_signals: minimalSignals,
        meta: {
          total_signals: ranked.length,
          limit: limitNum,
        },
      });
    }

    // Full format
    const sourcesActive = new Set();
    let highUrgencyCount = 0;
    for (const s of ranked) {
      if (s.urgency === 'high') highUrgencyCount++;
      for (const src of s.sources) sourcesActive.add(src);
    }

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      agent_brief_version: 'v1',
      top_signals: topSignals,
      meta: {
        total_signals: ranked.length,
        high_urgency_count: highUrgencyCount,
        sources_active: Array.from(sourcesActive),
        pipeline_note: 'Data refreshed daily via automated pipeline',
        limit: limitNum,
        filters_applied: { urgency, topic },
      },
    });

  } catch (err) {
    console.error('agent-brief error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
