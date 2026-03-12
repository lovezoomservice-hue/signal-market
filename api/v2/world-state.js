/**
 * GET /api/v2/world-state/:signal_id
 * GET /api/v2/world-state  (list all)
 *
 * Returns WorldStateObject v2 (partial — see state_version and null fields)
 */

import { getUnifiedSignals } from '../_unified.js';
import { buildGraph } from '../graph.js';

// ── Causal knowledge (mirrors causal.js — keeping in sync) ──────────────────
const CAUSAL_KB = {
  'AI Agents': {
    core_drivers: ['LLM reliable function-calling at GPT-4+ capability level', 'Open-source agent frameworks lowering build cost', 'Enterprise automation demand'],
    invalidation_conditions: ['Agent benchmark progress stalls for 2+ quarters', 'Major LLM provider deprecates tool-use APIs', 'Production incident causes widespread trust loss'],
    monitoring_points: ['arXiv agent paper weekly velocity', 'GitHub star growth for LangGraph/CrewAI/AutoGPT', 'SWE-bench autonomous task completion rate'],
    suggested_actions: ['Evaluate agentic framework production deployments', 'Track multi-agent coordination papers on arXiv cs.AI', 'Monitor enterprise AI automation RFPs'],
    probability_model: { base: 0.97, source_boost: 0.01, cross_val_boost: 0.01 },
  },
  'LLM Infrastructure': {
    core_drivers: ['Production LLM cost creating serving optimization imperative', 'vLLM/TGI throughput improvements proven in benchmarks', 'Open-weight models enabling on-premise deployment'],
    invalidation_conditions: ['Cloud providers commodity-price all inference optimization', 'New model architectures require fundamentally different infrastructure'],
    monitoring_points: ['vLLM GitHub release velocity', 'Inference provider pricing trends', 'H100/H200 supply constraints'],
    suggested_actions: ['Benchmark inference optimization tooling (vLLM, TGI, llama.cpp)', 'Track quantization quality at 4-bit and below'],
    probability_model: { base: 0.93, source_boost: 0.02, cross_val_boost: 0.02 },
  },
  'Diffusion Models': {
    core_drivers: ['Latent diffusion quality exceeding GANs at photorealism', 'Stable Diffusion open-source release enabling community iteration', 'Video extension proving architecture generalization'],
    invalidation_conditions: ['Copyright litigation restricts training data pipeline', 'Quality plateau — diminishing returns on scale', 'Regulatory ban in major markets'],
    monitoring_points: ['HuggingFace model download trends for Stable Diffusion variants', 'Midjourney/DALL-E quality benchmarks', 'Copyright case outcomes (US, EU)'],
    suggested_actions: ['Track video generation model quality milestones', 'Monitor copyright litigation: Getty v. Stability AI'],
    probability_model: { base: 0.87, source_boost: 0.02, cross_val_boost: 0.02 },
  },
  'AI Coding': {
    core_drivers: ['LLMs trained on code achieving human-competitive benchmarks', 'Agentic coding tools showing autonomous task completion', 'Enterprise dev productivity pressure driving adoption'],
    invalidation_conditions: ['SWE-bench score improvements stall', 'Security vulnerabilities in AI-generated code trigger enterprise pause', 'IP liability concerns restrict commercial use'],
    monitoring_points: ['SWE-bench leaderboard quarterly', 'GitHub Copilot enterprise adoption reports', 'AI coding tool job posting frequency'],
    suggested_actions: ['Evaluate Cursor/Claude Code for team productivity', 'Track SWE-bench autonomous agent scores'],
    probability_model: { base: 0.73, source_boost: 0.03, cross_val_boost: 0.03 },
  },
  'Efficient AI': {
    core_drivers: ['LLM compute cost unsustainable at scale for many use cases', 'Phi/Gemma small model quality closing gap with large models', 'On-device AI demand from consumer hardware vendors'],
    invalidation_conditions: ['GPU cost drops eliminate efficiency motivation', 'Small models plateau before closing remaining quality gap'],
    monitoring_points: ['MMLU scores for models <7B parameters', 'On-device AI hardware announcements (Apple, Qualcomm)', 'HuggingFace efficiency benchmark leaderboard'],
    suggested_actions: ['Evaluate quantized models for cost-sensitive applications', 'Track Phi-3/Gemma benchmark performance vs GPT-3.5'],
    probability_model: { base: 0.79, source_boost: 0.02, cross_val_boost: 0.02 },
  },
  'Reinforcement Learning': {
    core_drivers: ['RLHF proving critical for LLM alignment quality', 'o1/DeepSeek-R1 demonstrating RL improves reasoning at inference time', 'DPO/GRPO variants lowering RLHF compute requirements'],
    invalidation_conditions: ['Reward hacking in production causes alignment failures', 'Supervised fine-tuning proves sufficient without RL overhead'],
    monitoring_points: ['MATH/GPQA benchmark improvements per model generation', 'DPO/GRPO paper publication rate on arXiv', 'Process reward model adoption'],
    suggested_actions: ['Track reasoning model benchmark cadence', 'Monitor RLHF library (TRL) release velocity'],
    probability_model: { base: 0.69, source_boost: 0.03, cross_val_boost: 0.03 },
  },
  'Transformer Arch': {
    core_drivers: ['Quadratic attention cost driving efficiency research', 'MoE proving sparse transformers match dense quality at lower cost', 'State space models (Mamba) providing credible alternative'],
    invalidation_conditions: ['Flash Attention variants fully solve quadratic complexity', 'One architecture wins decisively, ending competition'],
    monitoring_points: ['Mamba/SSM benchmark vs transformer quality', 'MoE model production deployments', 'Long-context benchmark leaderboard'],
    suggested_actions: ['Monitor Mamba/Jamba production benchmark results vs transformers'],
    probability_model: { base: 0.69, source_boost: 0.02, cross_val_boost: 0.02 },
  },
  'AI Reasoning': {
    core_drivers: ['Inference-time compute scaling as new capability axis (o1 proof)', 'DeepSeek-R1 open-source triggering replication and research wave', 'Mathematical reasoning demand in science/finance/code driving commercial investment'],
    invalidation_conditions: ['Reasoning chains proved to be sophisticated pattern matching without real reasoning', 'Latency/cost of long reasoning chains proves prohibitive for applications'],
    monitoring_points: ['MATH/AMC/GPQA reasoning benchmark monthly', 'Reasoning model release cadence across frontier labs', 'Inference-time compute cost curves'],
    suggested_actions: ['Evaluate reasoning models (o3-mini, DeepSeek-R1) for math/code use cases', 'Track process reward model paper velocity on arXiv'],
    probability_model: { base: 0.69, source_boost: 0.03, cross_val_boost: 0.03 },
  },
};

// ── Probability model ─────────────────────────────────────────────────────
// Probability ≠ confidence. Confidence measures evidence strength.
// Probability models the chance this trend materializes to its predicted stage.
function computeProbability(signal) {
  const kb = CAUSAL_KB[signal.topic];
  if (!kb) return signal.confidence; // fallback

  const { base, source_boost, cross_val_boost } = kb.probability_model;
  const srcCount = (signal.sources || []).length;
  const crossVal = signal.cross_validated || srcCount >= 2;
  const evidenceBoost = Math.min((signal.evidenceCount || 0) * 0.005, 0.02);

  return Math.min(
    base
    + (srcCount >= 3 ? source_boost : 0)
    + (crossVal ? cross_val_boost : 0)
    + evidenceBoost,
    0.99
  );
}

function loadSignals()   {
  const raw = getUnifiedSignals();
  const arr = Array.isArray(raw) ? raw : (raw.signals || Object.values(raw));
  return { signals: arr };
}
function loadGraphData() {
  try {
    const signals = loadSignals().signals;
    return buildGraph(signals);
  } catch { return { edges: [] }; }
}

const STATE_VERSION = '2.0.0';
const DECAY_WINDOWS = { weak:'180d', emerging:'120d', forming:'90d', accelerating:'90d', peak:'30d', fading:'60d', dead:'0d' };
const PHASE_MAP = { weak:'early', emerging:'early', forming:'growing', accelerating:'growing', peak:'peak', fading:'declining', dead:'declining' };
const PROPAGATION_PHASE_MAP = { weak:'pre-aware', emerging:'pre-aware', forming:'early-adopter', accelerating:'early-adopter', peak:'mainstream', fading:'saturated', dead:'saturated' };
const EVENT_TYPE_MAP = { 'AI Research':'research_breakthrough', 'AI Infrastructure':'technology_acceleration', 'AI Applications':'adoption_signal', 'AI Tools':'adoption_signal', 'Language Models':'technology_acceleration' };
const FIRST_ORDER = {
  technology_acceleration: { accelerating:['increased tooling demand','talent demand surge','startup formation acceleration'], forming:['early adopter interest','prototype development phase'], emerging:['initial research publications','first repositories'] },
  research_breakthrough:   { accelerating:['paper replication attempts','follow-on research acceleration','industry attention'], forming:['academic citations growing'] },
  adoption_signal:         { accelerating:['enterprise evaluation wave','vendor ecosystem forming'] },
};
const DECAY_LABELS = { accelerating:'months', peak:'weeks', fading:'weeks', forming:'months', emerging:'months', weak:'months', dead:'weeks' };

function eventType(s) {
  if (s.stage === 'emerging') return 'technology_emergence';
  if (s.stage === 'peak')     return 'technology_peak';
  if (['fading','dead'].includes(s.stage)) return 'technology_decline';
  // Derive from sources, not category (all current signals share 'AI Research' category)
  const srcs = s.sources || [];
  if (srcs.some(x => x.startsWith('github'))) return 'adoption_signal';      // github trending = adoption
  if (srcs.some(x => x.startsWith('npm') || x.startsWith('pypi'))) return 'adoption_signal';
  if (srcs.some(x => x.startsWith('arxiv'))) return 'research_breakthrough'; // arxiv = research
  if (srcs.some(x => x === 'hn:frontpage' || x.startsWith('reddit'))) return 'adoption_signal';
  return EVENT_TYPE_MAP[s.category] || 'technology_acceleration';
}
function sourceQuality(s) {
  const ev = s.evidenceCount||0, src=(s.sources||[]).length;
  if (ev>=4&&src>=3) return 'high'; if (ev>=2&&src>=2) return 'medium'; if (ev>=1) return 'low'; return 'speculative';
}
function firstOrder(s) {
  const t = eventType(s); const m = FIRST_ORDER[t]; if (!m) return null;
  return m[s.stage] || m['accelerating'] || null;
}

function buildWSO(signal, graphEdges=[]) {
  // edges use signal_id (e.g. 'evt_001') as source key — match by signal_id
  const relatedDomains = graphEdges
    .filter(e => e.source === signal.signal_id)
    .map(e => e.target_label || e.target).filter(Boolean).slice(0,5);

  return {
    signal_id:     signal.signal_id,
    state_version: STATE_VERSION,
    schema:        'signal_market_v2.world_state_object',
    computed_at:   new Date().toISOString(),
    event: {
      event_id:            signal.signal_id,
      event_type:          eventType(signal),
      entities:            [signal.topic],
      actors:              null,
      time: { onset: signal.first_seen||null, peak_estimated:null, decay_window: DECAY_WINDOWS[signal.stage]||'90d' },
      related_domains:     relatedDomains.length ? relatedDomains : null,
      impacted_domains:    null,
      first_order_effects: firstOrder(signal),
      second_order_effects:null,
      historical_analogs:  null,
      source_quality:      sourceQuality(signal),
      raw_sources:         signal.sources||[],
    },
    confidence:           signal.confidence,
    probability:          parseFloat(computeProbability(signal).toFixed(3)),
    confidence_interval:  signal.confidence >= 0.85 ? [Math.max(0, signal.confidence - 0.08), Math.min(1, signal.confidence + 0.03)] : null,
    impact_score:         signal.impact_score||0,
    causal_explanation: {
      core_drivers:           CAUSAL_KB[signal.topic]?.core_drivers || null,
      secondary_drivers:      null,
      disagreement_points:    null,
      invalidation_conditions:CAUSAL_KB[signal.topic]?.invalidation_conditions || null,
      dominant_actor:         null,
      current_phase:          PHASE_MAP[signal.stage]||'growing',
      monitoring_points:      CAUSAL_KB[signal.topic]?.monitoring_points || null,
      causal_engine:          CAUSAL_KB[signal.topic] ? 'P0-B' : null,
    },
    propagation:         null,
    scenario_sensitivity:null,
    lifecycle_stage:     signal.stage,
    evidence_count:      signal.evidenceCount||0,
    suggested_actions:   CAUSAL_KB[signal.topic]?.suggested_actions || null,
    failure_conditions:  CAUSAL_KB[signal.topic]?.invalidation_conditions || null,
    monitoring_points:   CAUSAL_KB[signal.topic]?.monitoring_points || null,
    time_horizon:        DECAY_LABELS[signal.stage]||'months',
    propagation_phase:   PROPAGATION_PHASE_MAP[signal.stage]||'early-adopter',
    _v1: { topic:signal.topic, stage:signal.stage, confidence:signal.confidence, impact_score:signal.impact_score, proof_id:signal.proof_id, source_url:signal.source_url },
  };
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const data   = loadSignals();
    const graph  = loadGraphData ? loadGraphData() : {};
    const edges  = graph.edges || [];
    const signals = data.signals || data || [];

    const { signal_id } = req.query;

    if (signal_id) {
      const sig = signals.find(s =>
        s.signal_id === signal_id ||
        s.topic?.toLowerCase().replace(/\s+/g,'-') === signal_id.toLowerCase()
      );
      if (!sig) return res.status(404).json({ error: `Signal not found: ${signal_id}` });
      return res.status(200).json(buildWSO(sig, edges));
    }

    // List all
    const all = signals.map(s => buildWSO(s, edges));
    return res.status(200).json({
      schema:        'signal_market_v2.world_state_list',
      state_version: STATE_VERSION,
      count:         all.length,
      world_states:  all,
      null_fields_explanation: {
        actors:               'Actor data pipeline — P1 (requires Founder decision on method: rule-based vs API vs LLM)',
        causal_explanation:   'core_drivers + monitoring_points + invalidation_conditions: LIVE via P0-B causal engine. secondary_drivers + dominant_actor: P1.',
        propagation:          'Propagation Layer — P1',
        scenario_sensitivity: 'Scenario Injection Engine — P2',
        confidence_interval:  'Available for signals with confidence ≥ 0.85; others require more evidence.',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
