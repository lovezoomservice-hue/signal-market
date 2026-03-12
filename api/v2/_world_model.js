/**
 * Signal Market v2 — World Model Transformer
 * P0-A: v1Signal → WorldStateObject v2
 *
 * HONEST DECLARATION: This is a partial implementation.
 * Fields that require new data sources are explicitly null.
 * state_version = "2.0.0" identifies partial v2 objects.
 *
 * Null fields (not yet implementable from v1 data):
 *   event.actors, event.impacted_domains, event.second_order_effects,
 *   event.historical_analogs, causal_explanation.* (all),
 *   propagation, scenario_sensitivity, suggested_actions,
 *   failure_conditions
 */

import { loadSignals, loadGraphData } from '../_unified.js';

const STATE_VERSION = '2.0.0';

// ── Event type mapping ────────────────────────────────────────────────────────
const EVENT_TYPE_MAP = {
  'AI Research':       'research_breakthrough',
  'AI Infrastructure': 'technology_acceleration',
  'AI Applications':   'adoption_signal',
  'AI Tools':          'adoption_signal',
  'Language Models':   'technology_acceleration',
  'AI Safety':         'research_breakthrough',
};

function deriveEventType(signal) {
  if (signal.stage === 'emerging') return 'technology_emergence';
  if (signal.stage === 'peak')     return 'technology_peak';
  if (signal.stage === 'fading' || signal.stage === 'dead') return 'technology_decline';
  return EVENT_TYPE_MAP[signal.category] || 'technology_acceleration';
}

// ── Decay window by stage ─────────────────────────────────────────────────────
const DECAY_WINDOWS = {
  weak:         '180d',
  emerging:     '120d',
  forming:      '90d',
  accelerating: '90d',
  peak:         '30d',
  fading:       '60d',
  dead:         '0d',
};

// ── Current phase by stage ────────────────────────────────────────────────────
const PHASE_MAP = {
  weak:         'early',
  emerging:     'early',
  forming:      'growing',
  accelerating: 'growing',
  peak:         'peak',
  fading:       'declining',
  dead:         'declining',
};

// ── Source quality from evidence ──────────────────────────────────────────────
function deriveSourceQuality(signal) {
  const ev = signal.evidenceCount || 0;
  const src = (signal.sources || []).length;
  if (ev >= 4 && src >= 3)  return 'high';
  if (ev >= 2 && src >= 2)  return 'medium';
  if (ev >= 1)              return 'low';
  return 'speculative';
}

// ── First-order effects by category + stage ───────────────────────────────────
const FIRST_ORDER_TEMPLATES = {
  technology_acceleration: {
    accelerating: ['increased tooling demand', 'talent demand surge', 'startup formation acceleration'],
    forming:      ['early adopter interest', 'prototype development phase', 'academic attention rising'],
    emerging:     ['initial research publications', 'first github repositories emerging'],
  },
  research_breakthrough: {
    accelerating: ['paper replication attempts', 'follow-on research acceleration', 'industry attention'],
    forming:      ['academic citations growing', 'peer review activity'],
  },
  adoption_signal: {
    accelerating: ['enterprise evaluation wave', 'vendor ecosystem forming', 'integration requests growing'],
  },
};

function deriveFirstOrderEffects(signal) {
  const evType = deriveEventType(signal);
  const stageFx = FIRST_ORDER_TEMPLATES[evType];
  if (!stageFx) return null;
  return stageFx[signal.stage] || stageFx['accelerating'] || null;
}

// ── Time horizon by stage ─────────────────────────────────────────────────────
function deriveTimeHorizon(signal) {
  if (['peak', 'fading'].includes(signal.stage)) return 'weeks';
  if (['forming', 'accelerating'].includes(signal.stage)) return 'months';
  return 'months';
}

// ── Propagation phase estimate ────────────────────────────────────────────────
function derivePropagationPhase(signal) {
  const stageMap = {
    weak: 'pre-aware', emerging: 'pre-aware', forming: 'early-adopter',
    accelerating: 'early-adopter', peak: 'mainstream', fading: 'saturated', dead: 'saturated',
  };
  return stageMap[signal.stage] || 'early-adopter';
}

// ── Main transformer ──────────────────────────────────────────────────────────
export async function buildWorldStateObject(signalId) {
  // Load v1 signal
  const signalsData = loadSignals ? loadSignals() : null;
  if (!signalsData) throw new Error('Cannot load signals');

  const signals = signalsData.signals || signalsData;
  const signal  = signals.find(s => s.signal_id === signalId || s.topic?.toLowerCase().replace(/\s+/g,'-') === signalId);
  if (!signal) throw new Error(`Signal not found: ${signalId}`);

  // Load graph for related_domains
  let relatedDomains = null;
  let impactScore    = signal.impact_score || 0;
  try {
    const graphData = loadGraphData ? loadGraphData() : null;
    if (graphData?.edges) {
      const neighbors = graphData.edges
        .filter(e => e.source === (signal.signal_id || signalId) || e.source_label === signal.topic)
        .map(e => e.target_label || e.target)
        .filter(Boolean)
        .slice(0, 5);
      if (neighbors.length) relatedDomains = neighbors;
    }
  } catch {}

  const now = new Date().toISOString();

  return {
    // ── Identity ────────────────────────────────────────────
    signal_id:    signal.signal_id || signalId,
    state_version: STATE_VERSION,
    computed_at:  now,
    schema:       'signal_market_v2.world_state_object',

    // ── Event (L1) ──────────────────────────────────────────
    event: {
      event_id:             signal.signal_id || signalId,
      event_type:           deriveEventType(signal),
      entities:             [signal.topic],
      actors:               null,   // NOT YET: requires actor data pipeline
      time: {
        onset:              signal.first_seen || null,
        peak_estimated:     null,   // NOT YET: requires trajectory modeling
        decay_window:       DECAY_WINDOWS[signal.stage] || '90d',
      },
      related_domains:      relatedDomains,  // from graph edges (may be null)
      impacted_domains:     null,  // NOT YET: requires domain knowledge graph
      first_order_effects:  deriveFirstOrderEffects(signal),
      second_order_effects: null,  // NOT YET: requires causal chain modeling
      historical_analogs:   null,  // NOT YET: requires historical pattern database
      source_quality:       deriveSourceQuality(signal),
      raw_sources:          signal.sources || [],
    },

    // ── Confidence / Probability ─────────────────────────────
    confidence: signal.confidence,
    probability: signal.confidence,  // P0-A: same as confidence; overridden when v2/causal is ready
    confidence_interval: null,       // will be populated by /api/probability.js integration in P0-B
    impact_score: impactScore,

    // ── Causal Explanation (L3 — BLUEPRINT at P0-A) ──────────
    causal_explanation: {
      core_drivers:            null,  // NOT YET: P0-B
      secondary_drivers:       null,  // NOT YET: P0-B
      disagreement_points:     null,  // NOT YET: requires community signal data
      invalidation_conditions: null,  // NOT YET: P0-B
      dominant_actor:          null,  // NOT YET: requires actor data
      current_phase:           PHASE_MAP[signal.stage] || 'growing',
      monitoring_points:       null,  // NOT YET: P0-B
    },

    // ── Propagation (L2 — BLUEPRINT) ────────────────────────
    propagation: null,               // NOT YET: P1

    // ── Scenario (L4 — BLUEPRINT) ───────────────────────────
    scenario_sensitivity: null,      // NOT YET: P2

    // ── Lifecycle / Stage ────────────────────────────────────
    lifecycle_stage:      signal.stage,
    evidence_count:       signal.evidenceCount || 0,

    // ── Agent output (partial at P0-A) ───────────────────────
    suggested_actions:    null,      // NOT YET: P0-B
    failure_conditions:   null,      // NOT YET: P0-B
    monitoring_points:    null,      // NOT YET: P0-B
    time_horizon:         deriveTimeHorizon(signal),
    propagation_phase:    derivePropagationPhase(signal),

    // ── v1 passthrough (for backward compatibility) ──────────
    _v1: {
      topic:          signal.topic,
      stage:          signal.stage,
      confidence:     signal.confidence,
      impact_score:   signal.impact_score,
      proof_id:       signal.proof_id,
      source_url:     signal.source_url,
      evidence_source: signal.evidence_source,
    },
  };
}

export async function buildAllWorldStateObjects() {
  const signalsData = loadSignals ? loadSignals() : null;
  if (!signalsData) return [];
  const signals = signalsData.signals || signalsData;
  const results = [];
  for (const s of signals) {
    try {
      const wso = await buildWorldStateObject(s.signal_id || s.topic);
      results.push(wso);
    } catch {}
  }
  return results;
}
