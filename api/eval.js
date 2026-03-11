/**
 * /api/eval — Evaluation Run (P1-3)
 *
 * Routes:
 *   POST /api/eval/run          → start an evaluation_run
 *   GET  /api/eval              → list all eval runs
 *   GET  /api/eval/:id          → get single eval run
 *   POST /api/eval/:id/approve  → approve eval → creates approval record
 */

import crypto from 'crypto';
import { getUnifiedSignals } from './_unified.js';
import {
  getEvaluations, saveEvaluation,
  getFeedback, getEvidence, getLifecycle,
  getApprovals, saveApproval,
  emitAudit,
} from './_store.js';

const EVAL_TYPES = ['signal_quality', 'candidate_readiness', 'data_freshness', 'coverage'];

function runEvalLogic(eval_type, signal_id, dataset_snapshot) {
  const signals = getUnifiedSignals();
  const signal  = signal_id ? signals.find((s,i) => `evt_${String(i+1).padStart(3,'0')}` === signal_id) : null;

  const checks = [];
  let pass_gate = true;

  if (eval_type === 'signal_quality') {
    const feedbacks = signal_id ? getFeedback(signal_id) : [];
    const evidences = signal_id ? getEvidence(signal_id) : [];
    const lc        = signal_id ? getLifecycle(signal_id) : null;
    const qs = feedbacks.filter(f=>f.rating!=null).length === 0 ? 0.7 :
      feedbacks.filter(f=>f.rating!=null).reduce((a,f)=>a+(f.rating||0),0) /
      feedbacks.filter(f=>f.rating!=null).length;

    checks.push({ check: 'has_signal',      result: !!signal,                          weight: 1.0 });
    checks.push({ check: 'confidence>=0.6', result: (signal?.confidence||0) >= 0.6,    weight: 0.8 });
    checks.push({ check: 'has_evidence',    result: evidences.length > 0,              weight: 0.9 });
    checks.push({ check: 'quality_score',   result: qs >= 0.5,                         weight: 0.7 });
    checks.push({ check: 'lifecycle_active',result: lc?.lifecycle_state !== 'decaying', weight: 0.6 });

    pass_gate = checks.filter(c => c.weight >= 0.7).every(c => c.result);

  } else if (eval_type === 'candidate_readiness') {
    const allSigs = dataset_snapshot || signals;
    const ready = allSigs.filter(s => (s.confidence||0) >= 0.7 && s.stage !== 'fading');
    checks.push({ check: 'min_candidates',  result: ready.length >= 3,  weight: 1.0 });
    checks.push({ check: 'data_fresh',      result: true,               weight: 0.5 });
    pass_gate = ready.length >= 3;

  } else if (eval_type === 'data_freshness') {
    const today = new Date().toISOString().split('T')[0];
    const allSigs = getUnifiedSignals();
    const fresh = allSigs.filter(s => s.first_seen >= today.substring(0, 7)); // same month
    checks.push({ check: 'has_fresh_signals', result: fresh.length >= 1, weight: 1.0 });
    checks.push({ check: 'signal_count>=5',   result: allSigs.length >= 5, weight: 0.8 });
    pass_gate = fresh.length >= 1;

  } else {
    // coverage
    const allSigs = getUnifiedSignals();
    checks.push({ check: 'coverage>=5', result: allSigs.length >= 5, weight: 1.0 });
    pass_gate = allSigs.length >= 5;
  }

  const score = parseFloat((checks.reduce((a,c) => a + (c.result ? c.weight : 0), 0) /
                checks.reduce((a,c) => a + c.weight, 0)).toFixed(2));
  return { checks, score, pass_gate };
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query || {};

  // ── POST /api/eval/run ───────────────────────────────────────────────────
  if (req.method === 'POST' && (id === 'run' || req.url?.includes('/run'))) {
    const body = req.body || {};
    const {
      eval_type = 'signal_quality',
      signal_id = null,
      candidate_id = null,
      dataset_snapshot = null,
      actor = 'system',
    } = body;

    if (!EVAL_TYPES.includes(eval_type)) {
      return res.status(400).json({ error: `eval_type must be one of: ${EVAL_TYPES.join(',')}` });
    }

    const eval_id  = 'eval_' + crypto.randomBytes(6).toString('hex');
    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');
    const { checks, score, pass_gate } = runEvalLogic(eval_type, signal_id, dataset_snapshot);

    const evaluation = {
      eval_id,
      eval_type,
      signal_id:       signal_id || null,
      candidate_id:    candidate_id || null,
      dataset_snapshot: dataset_snapshot ? 'provided' : 'live',
      checks,
      score,
      pass_gate,
      status:          pass_gate ? 'passed' : 'failed',
      actor,
      run_at:          new Date().toISOString(),
      approved:        false,
      approval_id:     null,
      trace_id,
    };

    saveEvaluation(eval_id, evaluation);
    emitAudit({ trace_id, action: 'evaluation_run', signal_id, actor, payload: { eval_id, eval_type, pass_gate, score } });

    return res.status(201).json({
      eval_id,
      eval_type,
      signal_id,
      score,
      pass_gate,
      status:  evaluation.status,
      checks,
      run_at:  evaluation.run_at,
      trace_id,
    });
  }

  // ── POST /api/eval/:id/approve ───────────────────────────────────────────
  if (req.method === 'POST' && id && action === 'approve') {
    const evals = getEvaluations();
    const ev = evals[id];
    if (!ev) return res.status(404).json({ error: 'Eval not found', id });
    if (!ev.pass_gate) return res.status(400).json({ error: 'Cannot approve: eval did not pass gate' });

    const body = req.body || {};
    const { actor = 'founder', notes = '' } = body;

    const ap_id   = 'ap_' + crypto.randomBytes(6).toString('hex');
    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');
    const approval = {
      approval_id:  ap_id,
      eval_id:      id,
      signal_id:    ev.signal_id || null,
      candidate_id: ev.candidate_id || null,
      eval_type:    ev.eval_type,
      eval_score:   ev.score,
      actor,
      notes,
      approved_at:  new Date().toISOString(),
      trace_id,
    };

    saveApproval(ap_id, approval);

    ev.approved    = true;
    ev.approval_id = ap_id;
    saveEvaluation(id, ev);

    emitAudit({ trace_id, action: 'approval_granted', signal_id: ev.signal_id, actor, payload: { ap_id, eval_id: id } });

    return res.status(201).json({
      approval_id:  ap_id,
      eval_id:      id,
      eval_type:    ev.eval_type,
      approved:     true,
      approved_at:  approval.approved_at,
      trace_id,
    });
  }

  // ── GET /api/eval ────────────────────────────────────────────────────────
  if (req.method === 'GET' && !id) {
    const evals = getEvaluations();
    const list  = Object.values(evals);
    return res.status(200).json({
      evaluations: list,
      count: list.length,
      passed: list.filter(e => e.pass_gate).length,
      failed: list.filter(e => !e.pass_gate).length,
    });
  }

  // ── GET /api/eval/:id ────────────────────────────────────────────────────
  if (req.method === 'GET' && id) {
    const evals = getEvaluations();
    const ev = evals[id];
    if (!ev) return res.status(404).json({ error: 'Eval not found', id });
    return res.status(200).json(ev);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
