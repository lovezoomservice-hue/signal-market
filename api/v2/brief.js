/**
 * GET /api/v2/brief — Daily Intelligence Brief v2
 *
 * Intelligence-dense brief: signals + causal context + why-now timing
 * + graph topology + agent action items. Consumed by humans and AI agents.
 *
 * Schema: signal_market_v2.daily_brief (causal-enriched)
 */

import { getUnifiedSignals } from '../_unified.js';
import { buildGraph } from '../graph.js';

// ── Causal context (mirrors causal.js knowledge base — kept in sync) ─────────
const CAUSAL_CONTEXT = {
  'AI Agents': {
    primary_cause: 'LLM capability crossing the threshold for reliable tool use and multi-step planning',
    timing: 'arXiv agent paper velocity at historical high; GitHub agent framework repos outpacing all prior AI tooling categories',
    urgency: 'high', window: '3–12 months',
    agent_action: 'Evaluate agentic framework adoption. Track LangGraph, CrewAI, AutoGPT production deployments.',
  },
  'LLM Infrastructure': {
    primary_cause: 'Production LLM deployment creating an infrastructure bottleneck — serving, optimization, and cost reduction now critical',
    timing: 'vLLM, TGI, and quantization tooling all publishing rapid iteration; enterprise cost pressure accelerating adoption',
    urgency: 'high', window: '3–12 months',
    agent_action: 'Monitor vLLM throughput benchmarks and inference provider pricing. Watch for consolidation.',
  },
  'Diffusion Models': {
    primary_cause: 'Latent diffusion crossed photorealistic quality threshold, triggering research and commercialization race',
    timing: 'HuggingFace download activity and GitHub repos confirm practical adoption beyond hype phase',
    urgency: 'medium', window: '6–18 months',
    agent_action: 'Track video generation velocity and copyright litigation outcomes — both will define the next phase.',
  },
  'AI Coding': {
    primary_cause: 'LLMs trained on code corpora achieved human-competitive benchmark performance',
    timing: 'Agentic coding tools showing autonomous task completion; SWE-bench scores improving each model generation',
    urgency: 'high', window: '3–12 months',
    agent_action: 'Monitor SWE-bench leaderboard. Track enterprise AI coding tool adoption in job postings.',
  },
  'Efficient AI': {
    primary_cause: 'LLM cost-to-capability ratio unsustainable at scale — compression and distillation become mandatory',
    timing: 'Phi/Gemma small model quality breakthroughs; HuggingFace efficiency benchmarks normalizing',
    urgency: 'medium', window: '6–18 months',
    agent_action: 'Track MMLU/HellaSwag performance of models <7B. Watch on-device AI hardware announcements.',
  },
  'Reinforcement Learning': {
    primary_cause: 'RLHF becoming primary LLM alignment technique; o1/DeepSeek-R1 showing RL improves reasoning',
    timing: 'DPO/GRPO variants proliferating; reasoning model competition across all frontier labs',
    urgency: 'medium', window: '6–18 months',
    agent_action: 'Track process reward model papers. Monitor reasoning benchmark (MATH, GPQA) improvement velocity.',
  },
  'Transformer Arch': {
    primary_cause: 'Architectural scaling limits driving active research in MoE, SSM, and efficiency variants',
    timing: 'Mamba, Jamba, and hybrid architectures challenging pure transformer dominance',
    urgency: 'low', window: '12–36 months',
    agent_action: 'Monitor SSM/hybrid model benchmark performance vs dense transformers.',
  },
  'AI Reasoning': {
    primary_cause: 'Inference-time compute scaling revealed as new axis — chain-of-thought and process rewards unlock capability',
    timing: 'DeepSeek-R1 open-sourced; academic replication wave underway; commercial applications in math/code confirmed',
    urgency: 'high', window: '3–12 months',
    agent_action: 'Track MATH and GPQA benchmark leaderboard. Monitor reasoning-specialized model releases.',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function countUniqueSources(signals) {
  const s = new Set();
  signals.forEach(sig => (sig.sources || []).forEach(src => s.add(src.split(':')[0])));
  return s.size;
}

function generateHeadline(signals) {
  const accel = signals.filter(s => s.stage === 'accelerating');
  const top = signals[0];
  if (accel.length >= 3) return `${accel.length} signals accelerating — ${accel.map(s => s.topic).slice(0,2).join(', ')} leading`;
  if (accel.length > 0) return `${top.topic} acceleration confirmed at ${Math.round(top.confidence * 100)}% confidence`;
  return `${signals.length} active AI signals — ${signals.filter(s => s.confidence >= 0.7).length} high-confidence`;
}

function generateMacroLead(signals) {
  const accel = signals.filter(s => s.stage === 'accelerating');
  const cv = signals.filter(s => (s.sources||[]).length >= 2 || s.cross_validated).length;
  const sources = countUniqueSources(signals);

  const parts = [];
  if (accel.length >= 3) {
    parts.push(`${accel.length} technology signals are in simultaneous acceleration — a pattern that historically precedes major platform transitions.`);
  }
  parts.push(`Cross-source validation confirmed for ${cv}/${signals.length} signals across ${sources} independent data streams.`);

  const highConf = signals.filter(s => s.confidence >= 0.90);
  if (highConf.length) {
    parts.push(`${highConf.map(s => s.topic).join(' and ')} ${highConf.length === 1 ? 'carries' : 'carry'} confidence ≥90% — evidence convergence is strongest here.`);
  }
  return parts.join(' ');
}

function enrichSignal(s, edges) {
  const ctx = CAUSAL_CONTEXT[s.topic] || {};
  const conns = edges.filter(e => e.source === s.signal_id || e.target === s.signal_id);
  const connected_topics = conns
    .map(e => e.source === s.signal_id ? e.target_label : e.source_label)
    .filter(Boolean).slice(0, 3);

  return {
    signal_id:       s.signal_id,
    topic:           s.topic,
    stage:           s.stage,
    confidence:      s.confidence,
    impact_score:    s.impact_score,
    cross_validated: (s.sources||[]).length >= 2 || s.cross_validated,
    sources:         s.sources || [],
    evidence_count:  s.evidenceCount || 0,
    first_seen:      s.first_seen,

    // Causal intelligence
    primary_cause:   ctx.primary_cause || null,
    why_now:         ctx.timing || null,
    urgency:         ctx.urgency || (s.stage === 'accelerating' ? 'high' : s.stage === 'forming' ? 'medium' : 'low'),
    decision_window: ctx.window || '12–36 months',
    agent_action:    ctx.agent_action || `Track ${s.topic} momentum in arXiv and GitHub activity.`,

    // Graph context
    connected_topics,
    connection_count: conns.length,
  };
}

function buildSection(title, signals, edges) {
  return {
    title,
    signal_count: signals.length,
    section_summary: signals.length === 0 ? null
      : title === 'Accelerating' ? `${signals.length} signal${signals.length>1?'s':''} with confirmed multi-source momentum. Act on these.`
      : title === 'Forming' ? `${signals.length} signal${signals.length>1?'s':''} in early formation. Monitor for acceleration.`
      : `${signals.length} signal${signals.length>1?'s':''} in early detection. Low confidence, worth watching.`,
    signals: signals.map(s => enrichSignal(s, edges)),
  };
}

function graphInsight(nodes, edges) {
  if (!nodes.length) return null;
  const hub = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0))[0];
  const accel = nodes.filter(n => n.stage === 'accelerating');
  const density = nodes.length > 1
    ? (edges.length / (nodes.length * (nodes.length - 1) / 2)).toFixed(2) : '0.00';

  const clusters = [];
  if (accel.length >= 2) {
    clusters.push(`${accel.map(n => n.label).join(' + ')} form an accelerating cluster — co-movement likely.`);
  }

  return {
    hub_signal:         hub?.label,
    hub_connections:    hub?.degree || 0,
    accelerating_count: accel.length,
    graph_density:      parseFloat(density),
    topology_insight: `Graph density ${density}. ${hub?.label} is the hub signal with ${hub?.degree||0} connections — `
      + `disruption or acceleration here propagates across the widest surface. ${clusters.join(' ')}`,
    cluster_signals:    accel.map(n => n.label),
  };
}

function buildAgentSummary(signals) {
  const accel = signals.filter(s => s.stage === 'accelerating');
  const forming = signals.filter(s => s.stage === 'forming');
  const emerging = signals.filter(s => s.stage === 'emerging');
  const highUrgency = signals.filter(s => {
    const ctx = CAUSAL_CONTEXT[s.topic];
    return ctx?.urgency === 'high' || s.stage === 'accelerating';
  });

  return {
    state_summary: `${accel.length} accelerating, ${forming.length} forming, ${emerging.length} emerging. `
      + `${signals.filter(s => (s.sources||[]).length >= 2 || s.cross_validated).length}/${signals.length} cross-validated.`,
    highest_priority: highUrgency.slice(0, 3).map(s => ({
      topic: s.topic,
      confidence: s.confidence,
      urgency: CAUSAL_CONTEXT[s.topic]?.urgency || 'medium',
      decision_window: CAUSAL_CONTEXT[s.topic]?.window || '—',
      action: CAUSAL_CONTEXT[s.topic]?.agent_action || `Track ${s.topic}.`,
    })),
    monitor_next: forming.slice(0, 3).map(s => ({
      topic: s.topic,
      confidence: s.confidence,
      trigger_for_escalation: `${s.topic} reaches accelerating stage or gains 3rd independent source`,
    })),
    data_freshness: 'real-time',
    schema_version: 'v2-causal',
  };
}

// ── Handler ───────────────────────────────────────────────────────────────
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const raw = getUnifiedSignals();
    const signals = (Array.isArray(raw) ? raw : raw.signals || [])
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    const graph  = buildGraph(signals);
    const edges  = graph.edges || [];
    const nodes  = graph.nodes || [];

    const accel    = signals.filter(s => s.stage === 'accelerating');
    const forming  = signals.filter(s => s.stage === 'forming');
    const emerging = signals.filter(s => s.stage === 'emerging');
    const watchlist= signals.filter(s => ['fading','peak','weak'].includes(s.stage));

    const today = new Date().toISOString().split('T')[0];

    return res.status(200).json({
      brief_id:     `brief-${today}`,
      schema:       'signal_market_v2.daily_brief.causal',
      generated_at: new Date().toISOString(),
      date:         today,

      // Narrative
      headline:     generateHeadline(signals),
      macro_lead:   generateMacroLead(signals),

      // Sections
      sections: [
        ...(accel.length    ? [buildSection('Accelerating', accel,    edges)] : []),
        ...(forming.length  ? [buildSection('Forming',      forming,  edges)] : []),
        ...(emerging.length ? [buildSection('Emerging',     emerging, edges)] : []),
        ...(watchlist.length? [buildSection('Watch',        watchlist,edges)] : []),
      ],

      // Graph
      graph_insight: graphInsight(nodes, edges),

      // Meta
      meta: {
        signal_count:      signals.length,
        sources_monitored: countUniqueSources(signals),
        high_confidence:   signals.filter(s => s.confidence >= 0.85).length,
        cross_validated:   signals.filter(s => (s.sources||[]).length >= 2 || s.cross_validated).length,
        accelerating:      accel.length,
        forming:           forming.length,
        emerging:          emerging.length,
        causal_coverage:   signals.filter(s => !!CAUSAL_CONTEXT[s.topic]).length,
      },

      // Agent-native
      agent_summary: buildAgentSummary(signals),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
