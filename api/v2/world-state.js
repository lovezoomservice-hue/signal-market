/**
 * GET /api/v2/world-state/:signal_id
 * GET /api/v2/world-state  (list all)
 *
 * Returns WorldStateObject v2 (partial — see state_version and null fields)
 */

import { getUnifiedSignals } from '../_unified.js';
import { buildGraph } from '../graph.js';

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
    probability:          signal.confidence,
    confidence_interval:  null,
    impact_score:         signal.impact_score||0,
    causal_explanation: {
      core_drivers:           null,
      secondary_drivers:      null,
      disagreement_points:    null,
      invalidation_conditions:null,
      dominant_actor:         null,
      current_phase:          PHASE_MAP[signal.stage]||'growing',
      monitoring_points:      null,
    },
    propagation:         null,
    scenario_sensitivity:null,
    lifecycle_stage:     signal.stage,
    evidence_count:      signal.evidenceCount||0,
    suggested_actions:   null,
    failure_conditions:  null,
    monitoring_points:   null,
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
        actors:               'Requires actor data pipeline — not yet implemented (P1)',
        causal_explanation:   'Requires Causal Explanation Engine — P0-B',
        propagation:          'Requires Propagation Layer — P1',
        scenario_sensitivity: 'Requires Scenario Injection Engine — P2',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
