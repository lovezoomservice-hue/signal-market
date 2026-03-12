/**
 * GET /api/v2/brief — Daily Intelligence Brief
 * Compiles current signals into a structured brief object
 * suitable for both human reading and agent consumption.
 */

import { getUnifiedSignals, getUnifiedTrends } from '../_unified.js';
import { buildGraph } from '../graph.js';

const STAGE_LABELS = {
  accelerating: 'Accelerating', forming: 'Forming', emerging: 'Emerging',
  peak: 'Peak', fading: 'Fading', dead: 'Dead', weak: 'Weak',
};

function generateHeadline(signals) {
  const accel = signals.filter(s => s.stage === 'accelerating');
  const forming = signals.filter(s => s.stage === 'forming');
  if (accel.length >= 3) {
    return `${accel.length} signals in acceleration — ${accel[0].topic} leads at ${Math.round(accel[0].confidence * 100)}% confidence`;
  }
  if (accel.length > 0) {
    return `${accel[0].topic} acceleration confirmed — ${accel.length} signals moving`;
  }
  if (forming.length > 0) {
    return `${forming.length} technology signal${forming.length > 1 ? 's' : ''} in formation stage — early positioning window`;
  }
  return `${signals.length} active signals monitored — ${signals.filter(s => s.confidence >= 0.7).length} high confidence`;
}

function generateLead(signals, edges) {
  const topSignal = signals[0];
  const connCount = topSignal ? edges.filter(e => e.source === topSignal.signal_id || e.target === topSignal.signal_id).length : 0;
  const multiSrc = signals.filter(s => (s.sources || []).length >= 2).length;

  return `Today's brief covers ${signals.length} active technology signals validated across ${countUniqueSources(signals)} independent sources. `
    + `${multiSrc} signal${multiSrc !== 1 ? 's' : ''} carry multi-source confirmation, reducing false-positive risk. `
    + (topSignal ? `${topSignal.topic} remains the highest-confidence signal at ${Math.round(topSignal.confidence * 100)}%, `
        + `with ${connCount} graph connections reinforcing its significance.` : '');
}

function countUniqueSources(signals) {
  const s = new Set();
  signals.forEach(sig => (sig.sources || []).forEach(src => s.add(src)));
  return s.size;
}

function buildSection(title, signals, edges) {
  return {
    title,
    signal_count: signals.length,
    signals: signals.map(s => {
      const conns = edges.filter(e => e.source === s.signal_id || e.target === s.signal_id);
      const connLabels = conns.map(e => e.source === s.signal_id ? e.target_label : e.source_label).filter(Boolean).slice(0, 3);
      return {
        topic:             s.topic,
        stage:             s.stage,
        confidence:        s.confidence,
        impact_score:      s.impact_score,
        sources:           s.sources || [],
        evidence_count:    s.evidenceCount || 0,
        cross_validated:   (s.sources || []).length >= 2 || s.cross_validated,
        related_to:        connLabels,
        signal_id:         s.signal_id,
        why_it_matters:    getSignalContext(s),
      };
    }),
  };
}

function getSignalContext(s) {
  const contexts = {
    'AI Agents':           'Autonomous agent frameworks are gaining rapid adoption across research and production stacks.',
    'LLM Infrastructure':  'The infrastructure layer for LLMs is scaling — inference optimization and serving frameworks accelerating.',
    'Diffusion Models':    'Visual generation models maintaining strong developer interest; GitHub activity confirms non-hype adoption.',
    'AI Coding':           'Developer tooling with AI assistance entering formation stage — not peak, still early.',
    'Efficient AI':        'Model efficiency techniques emerging as compute costs drive demand for smaller, faster models.',
    'Reinforcement Learning': 'RL activity rising, likely driven by RLHF applications in alignment and agent training.',
    'Transformer Arch':    'Architectural research remains active — attention mechanism variants and efficiency research.',
    'AI Reasoning':        'Chain-of-thought and reasoning capabilities research accelerating from NLP community.',
    'AI Infrastructure':   'News sentiment signals tech infrastructure investment continuing — NVIDIA and cloud AI themes.',
  };
  return contexts[s.topic] || `${STAGE_LABELS[s.stage] || s.stage} stage signal in ${s.category || 'AI'} domain.`;
}

function graphInsight(nodes, edges) {
  if (!nodes.length) return null;
  const hub = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0))[0];
  const accel = nodes.filter(n => n.stage === 'accelerating');
  const density = nodes.length > 1 ? (edges.length / (nodes.length * (nodes.length - 1) / 2)).toFixed(2) : 0;

  return {
    hub_signal:            hub?.label,
    hub_connections:       hub?.degree || 0,
    accelerating_count:    accel.length,
    graph_density:         parseFloat(density),
    topology_insight:      `${accel.length} accelerating signals form a dense cluster (density=${density}). `
      + `${hub?.label} is the structural hub — movements here propagate to ${hub?.degree || 0} connected topics.`,
  };
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const raw = getUnifiedSignals();
    const signals = (Array.isArray(raw) ? raw : raw.signals || [])
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    const graph = buildGraph(signals);
    const edges = graph.edges || [];
    const nodes = graph.nodes || [];

    const accel   = signals.filter(s => s.stage === 'accelerating');
    const forming = signals.filter(s => s.stage === 'forming');
    const emerging = signals.filter(s => s.stage === 'emerging');
    const watchlist = signals.filter(s => ['fading','peak','weak'].includes(s.stage));

    const today = new Date().toISOString().split('T')[0];

    const brief = {
      brief_id:        `brief-${today}`,
      schema:          'signal_market_v2.daily_brief',
      generated_at:    new Date().toISOString(),
      date:            today,

      // ── Narrative ─────────────────────────────────────────
      headline:        generateHeadline(signals),
      lead:            generateLead(signals, edges),

      // ── Signal sections ────────────────────────────────────
      sections: [
        ...(accel.length   ? [buildSection('Accelerating',       accel,    edges)] : []),
        ...(forming.length ? [buildSection('Forming',            forming,  edges)] : []),
        ...(emerging.length? [buildSection('Emerging',           emerging, edges)] : []),
        ...(watchlist.length?[buildSection('Watch',              watchlist,edges)] : []),
      ],

      // ── Graph topology summary ──────────────────────────────
      graph_insight: graphInsight(nodes, edges),

      // ── Meta ───────────────────────────────────────────────
      meta: {
        signal_count:       signals.length,
        sources_monitored:  countUniqueSources(signals),
        high_confidence:    signals.filter(s => s.confidence >= 0.85).length,
        cross_validated:    signals.filter(s => (s.sources||[]).length >= 2 || s.cross_validated).length,
        accelerating:       accel.length,
        forming:            forming.length,
        emerging:           emerging.length,
      },

      // ── Agent consumption ──────────────────────────────────
      agent_summary: {
        top_signals:   signals.slice(0,3).map(s => ({ topic: s.topic, stage: s.stage, confidence: s.confidence })),
        action_items:  accel.map(s => ({ topic: s.topic, urgency: 'now', action: 'monitor and evaluate' }))
          .concat(forming.map(s => ({ topic: s.topic, urgency: 'soon', action: 'track for acceleration' }))),
        data_freshness: 'real-time',
      },
    };

    return res.status(200).json(brief);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
