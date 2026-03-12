/**
 * _unified.js — Single Source of Truth (P4)
 *
 * ALL endpoints must import from here.
 * Priority: runtime_evidence > signals_history.jsonl > static REAL_SIGNALS
 *
 * Exports:
 *   getUnifiedSignals({ stage, limit })  → signals with runtime evidence merged
 *   getUnifiedSignal(id)                 → single signal with merged evidence + lifecycle
 *   getUnifiedTrends({ limit })          → trends derived from unified signals
 *   getUnifiedTopics()                   → topics derived from unified signals
 *   getUnifiedEvents({ topic, limit })   → events derived from unified signals
 *   getUnifiedEvent(id)                  → single event with merged evidence
 *   getUnifiedMeta()                     → data provenance metadata
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { REAL_SIGNALS, DATA_META } from './_data.js';
import { getEvidence, getLifecycle } from './_store.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const HIST_FILE = join(__dir, '..', 'data', 'signals_history.jsonl');

// ── Layer 1: load live snapshot (signals_history.jsonl) ─────────────────────
let _snapshotCache = null;
let _snapshotCacheTs = 0;
const SNAPSHOT_TTL = 30_000;

function loadSnapshot() {
  const now = Date.now();
  if (_snapshotCache !== null && now - _snapshotCacheTs < SNAPSHOT_TTL) return _snapshotCache;
  try {
    if (!existsSync(HIST_FILE)) { _snapshotCache = null; _snapshotCacheTs = now; return null; }
    const lines = readFileSync(HIST_FILE, 'utf8').trim().split('\n').filter(Boolean);
    if (!lines.length) { _snapshotCache = null; _snapshotCacheTs = now; return null; }
    // Support two formats:
    // 1. Each line is a signal record (topic/signal_id present) — new canonical format
    // 2. Last line is a metadata wrapper {signals:[...]} — legacy format
    const parsed = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const signalLines = parsed.filter(r => r.topic && r.signal_id);
    if (signalLines.length > 0) {
      _snapshotCache = { signals: signalLines };
    } else {
      const latest = parsed[parsed.length - 1];
      _snapshotCache = latest?.signals?.length ? latest : null;
    }
  } catch { _snapshotCache = null; }
  _snapshotCacheTs = Date.now();
  return _snapshotCache;
}

// ── Layer 2: merge live snapshot with static, compute sig_id ────────────────
function buildBaseSignals() {
  const snapshot = loadSnapshot();
  let base = snapshot?.signals?.length
    ? (() => {
        const liveMap = Object.fromEntries(snapshot.signals.map(s => [s.topic, s]));
        const merged = REAL_SIGNALS.map(s => liveMap[s.topic] ? { ...s, ...liveMap[s.topic] } : s);
        const staticTopics = new Set(REAL_SIGNALS.map(s => s.topic));
        const extra = snapshot.signals.filter(s => !staticTopics.has(s.topic));
        return [...merged, ...extra];
      })()
    : [...REAL_SIGNALS];

  // Assign stable sig_ids
  return base.sort((a, b) => b.confidence - a.confidence)
    .map((s, i) => ({ ...s, _sig_id: `evt_${String(i + 1).padStart(3, '0')}` }));
}

// ── Layer 3: merge runtime evidence ─────────────────────────────────────────
let _unifiedCache = null;
let _unifiedCacheTs = 0;
const UNIFIED_TTL = 5_000;

function buildUnifiedSignals() {
  const now = Date.now();
  if (_unifiedCache && now - _unifiedCacheTs < UNIFIED_TTL) return _unifiedCache;

  const base = buildBaseSignals();
  _unifiedCache = base.map(s => {
    const runtimeEvidence = getEvidence(s._sig_id) || [];
    const runtimeLC       = getLifecycle(s._sig_id);
    const evidenceCount   = runtimeEvidence.length > 0 ? runtimeEvidence.length : (s.evidenceCount || 0);
    const evidenceSource  = runtimeEvidence.length > 0 ? 'runtime' : (loadSnapshot() ? 'live_snapshot' : 'static');
    // WS-P5-1: keep stage vocabulary (accelerating/forming/emerging/...) SEPARATE from
    // lifecycle_state vocabulary (pending_evidence/active/decaying/...). Do NOT overwrite stage.
    const stage           = s.stage || 'unknown';
    const lifecycle_state = runtimeLC?.lifecycle_state || null;
    return {
      ...s,
      evidenceCount,
      evidence_source: evidenceSource,
      stage,          // signal stage vocab: accelerating|forming|emerging|fading|peak|weak
      lifecycle_state, // lifecycle vocab: pending_evidence|active|decaying|new (may be null)
      _runtime_evidence: runtimeEvidence,
      _lifecycle: runtimeLC || null,
    };
  });
  _unifiedCacheTs = now;
  return _unifiedCache;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getUnifiedSignals({ stage, limit } = {}) {
  let signals = buildUnifiedSignals();
  if (stage) signals = signals.filter(s => s.stage === stage);
  if (limit) signals = signals.slice(0, parseInt(limit));
  // Strip internal fields before returning
  return signals.map(({ _sig_id, _runtime_evidence, _lifecycle, ...s }) =>
    ({ ...s, signal_id: _sig_id }));
}

export function getUnifiedSignal(id) {
  const signals = buildUnifiedSignals();
  const idx = parseInt((id || '').replace('evt_', ''), 10) - 1;
  const found = (idx >= 0 && idx < signals.length)
    ? signals[idx]
    : signals.find(s => s.topic?.toLowerCase().replace(/\s+/g, '-') === id);
  if (!found) return null;
  const { _sig_id, _runtime_evidence, _lifecycle, ...s } = found;
  return {
    ...s,
    signal_id: _sig_id,
    runtime_evidence: _runtime_evidence,
    lifecycle: _lifecycle,
  };
}

export function getUnifiedMeta() {
  const snapshot = loadSnapshot();
  return {
    ...DATA_META,
    live_source:       snapshot ? 'signals_history.jsonl' : 'static',
    live_synced_at:    snapshot?.synced_at || DATA_META.synced_at,
    live_signal_count: buildUnifiedSignals().length,
  };
}

// ── Derived views (all from unified signals) ─────────────────────────────────

const STAGE_SCORE = { accelerating: 1.0, peak: 0.9, forming: 0.7, emerging: 0.5, fading: 0.3, weak: 0.1 };

export function getUnifiedTrends({ limit } = {}) {
  return getUnifiedSignals().map(s => ({
    topic:       s.topic,
    stage:       s.stage,
    trend_score: parseFloat((s.confidence * (STAGE_SCORE[s.stage] || 0.5)).toFixed(3)),
    velocity:    parseFloat((s.evidenceCount / 10).toFixed(2)),
    confidence:  s.confidence,
    evidence_count: s.evidenceCount,
    evidence_source: s.evidence_source,
    proof_id:    s.proof_id,
    source_url:  s.source_url,
    updated_at:  getUnifiedMeta().live_synced_at,
  }))
  .sort((a, b) => b.trend_score - a.trend_score)
  .slice(0, limit ? parseInt(limit) : 20);
}

export function getUnifiedTopics() {
  return getUnifiedSignals().map(s => ({
    id:             s.topic.toLowerCase().replace(/\s+/g, '-'),
    name:           s.topic,
    stage:          s.stage,
    confidence:     s.confidence,
    evidence_count: s.evidenceCount,
    evidence_source: s.evidence_source,
    proof_id:       s.proof_id,
    source_url:     s.source_url,
    updated_at:     getUnifiedMeta().live_synced_at,
  }));
}

export function getUnifiedEvents({ topic, limit } = {}) {
  let signals = getUnifiedSignals();
  if (topic) signals = signals.filter(s => s.topic.toLowerCase().includes(topic.toLowerCase()));
  if (limit) signals = signals.slice(0, parseInt(limit));
  return signals.map(s => ({
    event_id:       s.signal_id,
    topic:          s.topic,
    stage:          s.stage,
    probability:    s.confidence,
    evidence_count: s.evidenceCount,
    evidence_source: s.evidence_source,
    evidence_refs:  [s.proof_id],
    proof_id:       s.proof_id,
    source_url:     s.source_url,
    updated_at:     getUnifiedMeta().live_synced_at,
    timestamp:      new Date().toISOString(),
  }));
}

export function getUnifiedEvent(id) {
  const s = getUnifiedSignal(id);
  if (!s) return null;
  return {
    event_id:       s.signal_id,
    topic:          s.topic,
    stage:          s.stage,
    probability:    s.confidence,
    evidence_count: s.evidenceCount,
    evidence_source: s.evidence_source,
    evidence_refs:  [s.proof_id],
    proof_id:       s.proof_id,
    source_url:     s.source_url,
    snapshot_url:   s.source_url,
    runtime_evidence: s.runtime_evidence,
    lifecycle:      s.lifecycle,
    updated_at:     getUnifiedMeta().live_synced_at,
  };
}
