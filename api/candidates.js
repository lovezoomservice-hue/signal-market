/**
 * /api/candidates — Signal Candidate Pool (P0-5)
 *
 * Candidate Pool is the entry gate before a signal is promoted to active.
 * A signal enters the candidate pool when:
 *   - It has at least 1 evidence item
 *   - Its confidence meets minimum threshold
 *   - It passes basic quality check
 *
 * Routes:
 *   GET  /api/candidates              → list all candidates
 *   POST /api/candidates              → nominate a signal as candidate
 *   GET  /api/candidates/:id          → candidate detail
 *   POST /api/candidates/:id/promote  → promote candidate → active signal
 *   POST /api/candidates/:id/reject   → reject candidate
 */

import crypto from 'crypto';
import { getUnifiedSignals, getUnifiedMeta } from './_unified.js';
import { getCandidates, saveCandidate, loadStore, saveStore, emitAudit } from './_store.js';

function loadPool() {
  const cands = getCandidates();
  return { candidates: cands, created_at: new Date().toISOString() };
}
function savePool(pool) {
  // Persist each candidate individually via _store
  Object.entries(pool.candidates || {}).forEach(([id, cand]) => saveCandidate(id, cand));
}

// Minimum quality check
function qualityCheck(signal) {
  const checks = {
    has_topic:      !!signal.topic,
    has_stage:      !!signal.stage,
    has_confidence: (signal.confidence || 0) >= 0.5,
    has_evidence:   (signal.evidenceCount || 0) >= 1,
    has_source:     !!signal.source_url,
    has_proof_id:   !!signal.proof_id,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    passed,
    total:  Object.keys(checks).length,
    score:  parseFloat((passed / Object.keys(checks).length).toFixed(2)),
    checks,
    gate:   passed >= 4 ? 'PASS' : 'FAIL',
  };
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query || {};
  const pool = loadPool();

  // ── GET /api/candidates ──────────────────────────────────────────────────
  if (req.method === 'GET' && !id) {
    const candidates = Object.values(pool.candidates);
    const summary = {
      total:     candidates.length,
      pending:   candidates.filter(c => c.status === 'pending').length,
      promoted:  candidates.filter(c => c.status === 'promoted').length,
      rejected:  candidates.filter(c => c.status === 'rejected').length,
    };
    return res.status(200).json({
      candidates,
      summary,
      pool_updated_at: pool.created_at,
      data_updated_at: getUnifiedMeta().updated_at,
    });
  }

  // ── POST /api/candidates — nominate signal ───────────────────────────────
  if (req.method === 'POST' && !id) {
    const body = req.body || {};
    const { signal_topic, signal_id, nominator = 'system', reason = '' } = body;

    // Find signal by topic or id
    const signals = getUnifiedSignals();
    const signal = signal_topic
      ? signals.find(s => s.topic.toLowerCase() === signal_topic.toLowerCase())
      : signals.find((s, i) => `evt_${String(i+1).padStart(3,'0')}` === signal_id);

    if (!signal) {
      return res.status(404).json({ error: 'Signal not found', signal_topic, signal_id });
    }

    const qc = qualityCheck(signal);

    const candidate_id = 'cand_' + crypto.randomBytes(6).toString('hex');
    const candidate = {
      candidate_id,
      signal_topic:    signal.topic,
      signal_stage:    signal.stage,
      confidence:      signal.confidence,
      evidence_count:  signal.evidenceCount,
      proof_id:        signal.proof_id,
      source_url:      signal.source_url,
      quality_check:   qc,
      status:          qc.gate === 'PASS' ? 'pending' : 'rejected',
      rejection_reason: qc.gate === 'FAIL' ? `Quality gate FAIL: ${qc.passed}/${qc.total}` : null,
      nominator,
      nomination_reason: reason,
      nominated_at:    new Date().toISOString(),
      promoted_at:     null,
      rejected_at:     qc.gate === 'FAIL' ? new Date().toISOString() : null,
    };

    pool.candidates[candidate_id] = candidate;
    savePool(pool);

    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');
    emitAudit({ trace_id, action: 'candidate_nominated', signal_id: null, actor: nominator,
      payload: { candidate_id, signal_topic: signal.topic, gate: qc.gate, score: qc.score } });

    return res.status(201).json({
      candidate_id,
      signal_topic:  signal.topic,
      status:        candidate.status,
      quality_gate:  qc.gate,
      quality_score: qc.score,
      quality_checks: qc.checks,
    });
  }

  // ── GET /api/candidates/:id ──────────────────────────────────────────────
  if (req.method === 'GET' && id && !action) {
    const candidate = pool.candidates[id];
    if (!candidate) return res.status(404).json({ error: 'Candidate not found', id });
    return res.status(200).json(candidate);
  }

  // ── POST /api/candidates/:id/promote ────────────────────────────────────
  if (req.method === 'POST' && id && action === 'promote') {
    const candidate = pool.candidates[id];
    if (!candidate) return res.status(404).json({ error: 'Candidate not found', id });
    if (candidate.status !== 'pending') {
      return res.status(400).json({ error: `Cannot promote: status=${candidate.status}` });
    }
    pool.candidates[id].status = 'promoted';
    pool.candidates[id].promoted_at = new Date().toISOString();
    savePool(pool);

    const trace_id_p = 'tr_' + crypto.randomBytes(8).toString('hex');
    emitAudit({ trace_id: trace_id_p, action: 'candidate_promoted', signal_id: null,
      actor: req.body?.actor || 'system',
      payload: { candidate_id: id, signal_topic: candidate.signal_topic } });

    return res.status(200).json({
      candidate_id: id,
      status: 'promoted',
      signal_topic: candidate.signal_topic,
      promoted_at: pool.candidates[id].promoted_at,
      trace_id: trace_id_p,
    });
  }

  // ── POST /api/candidates/:id/reject ─────────────────────────────────────
  if (req.method === 'POST' && id && action === 'reject') {
    const candidate = pool.candidates[id];
    if (!candidate) return res.status(404).json({ error: 'Candidate not found', id });
    pool.candidates[id].status = 'rejected';
    pool.candidates[id].rejected_at = new Date().toISOString();
    savePool(pool);
    return res.status(200).json({ candidate_id: id, status: 'rejected' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
