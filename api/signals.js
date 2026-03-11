/**
 * /api/signals/:id — Signal detail + evidence operations
 *
 * Routes (via vercel.json):
 *   GET  /api/signals              → list all signals
 *   GET  /api/signals/:id          → signal detail
 *   POST /api/signals/:id/evidence → evidence_append (P0-3)
 *   GET  /api/signals/:id/evidence → evidence list
 *   GET  /api/signals/:id/lifecycle → lifecycle state (P0-4)
 *   GET  /api/signals/:id/feedback  → feedback list (P1-1)
 *   POST /api/signals/:id/feedback  → feedback_submit (P1-1)
 *   POST /api/signals/:id/feedback/:fid/correct → correction (P1-2)
 */

import crypto from 'crypto';
import { getUnifiedSignals, getUnifiedSignal, getUnifiedMeta } from './_unified.js';
import {
  getEvidence, appendEvidence,
  getLifecycle, saveLifecycle,
  getFeedback, appendFeedback,
  loadStore, saveStore,
  emitAudit,
} from './_store.js';

function getSignalById(id) {
  return getUnifiedSignal(id);
}

// Compute/seed lifecycle state
function seedLifecycle(id, signal) {
  const existing = getLifecycle(id);
  if (existing) return existing;
  const lc = {
    signal_id: id,
    lifecycle_state: signal.stage === 'accelerating' || signal.stage === 'peak' ? 'active' :
                     signal.stage === 'forming' ? 'pending_evidence' :
                     signal.stage === 'fading'  ? 'decaying' : 'new',
    evidence_count: signal.evidenceCount || 0,
    last_updated:   getUnifiedMeta().updated_at,
    transitions:    [],
  };
  saveLifecycle(id, lc);
  return lc;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action, fid } = req.query || {};
  const urlParts = (req.url || '').split('?')[0].split('/').filter(Boolean);

  // ── LIST /api/signals ────────────────────────────────────────────────────
  if (!id) {
    const baseSignals = getUnifiedSignals();
    const meta = getUnifiedMeta();
    const signals = baseSignals; // P4: evidence already merged in _unified.js
    return res.status(200).json({
      signals,
      count:       signals.length,
      updated_at:  meta.updated_at,
      inputs_hash: meta.inputs_hash,
      source:      meta.source,
      live_source: meta.live_source,
    });
  }

  const signal = getSignalById(id);
  if (!signal) return res.status(404).json({ error: 'Signal not found', id });

  // ── LIFECYCLE ────────────────────────────────────────────────────────────
  if (action === 'lifecycle' || req.url?.includes('/lifecycle')) {
    const lc = seedLifecycle(id, signal);
    return res.status(200).json(lc);
  }

  // ── EVIDENCE GET ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && (action === 'evidence' || req.url?.includes('/evidence')) && !req.url?.includes('/correct')) {
    const evidences = getEvidence(id);
    return res.status(200).json({
      signal_id:  id,
      evidence:   evidences,
      count:      evidences.length,
      proof_id:   signal.proof_id,
      source_url: signal.source_url,
    });
  }

  // ── EVIDENCE POST (append) ───────────────────────────────────────────────
  if (req.method === 'POST' && action === 'evidence') {
    const body = req.body || {};
    const { source_url, source_type = 'external', credibility = 0.7, description = '', actor = 'system' } = body;
    if (!source_url) return res.status(400).json({ error: 'source_url required' });

    const ev_id = 'ev_' + crypto.randomBytes(6).toString('hex');
    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');
    const ev = {
      evidence_id:  ev_id,
      signal_id:    id,
      source_url,
      source_type,
      credibility:  parseFloat(credibility),
      description,
      appended_at:  new Date().toISOString(),
      trace_id,
    };

    appendEvidence(id, ev);

    // Update lifecycle
    let lc = getLifecycle(id) || {
      signal_id: id,
      lifecycle_state: 'pending_evidence',
      evidence_count: 0,
      transitions: [],
    };
    lc.evidence_count = (lc.evidence_count || 0) + 1;
    lc.last_evidence_at = new Date().toISOString();
    if (lc.evidence_count >= 3 && lc.lifecycle_state === 'pending_evidence') {
      lc.transitions.push({ from: lc.lifecycle_state, to: 'evidence_sufficient', at: new Date().toISOString(), reason: 'evidence_count>=3' });
      lc.lifecycle_state = 'evidence_sufficient';
    }
    saveLifecycle(id, lc);

    // Audit
    emitAudit({ trace_id, action: 'evidence_append', signal_id: id, actor, payload: { ev_id, source_url, source_type, credibility } });

    return res.status(201).json({
      evidence_id:     ev_id,
      signal_id:       id,
      evidence_count:  lc.evidence_count,
      lifecycle_state: lc.lifecycle_state,
      appended_at:     ev.appended_at,
      trace_id,
    });
  }

  // ── FEEDBACK GET ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'feedback') {
    const feedbacks = getFeedback(id);
    const quality_score = feedbacks.length === 0 ? null :
      parseFloat((feedbacks.reduce((a,f) => a + (f.rating||0.5), 0) / feedbacks.length).toFixed(2));
    return res.status(200).json({
      signal_id:     id,
      feedback:      feedbacks,
      count:         feedbacks.length,
      quality_score,
    });
  }

  // ── FEEDBACK POST (submit) ───────────────────────────────────────────────
  if (req.method === 'POST' && action === 'feedback') {
    const body = req.body || {};
    const { feedback_type = 'quality', rating, comment = '', actor = 'anonymous', correction_target } = body;

    const VALID_TYPES = ['quality', 'relevance', 'accuracy', 'staleness', 'other'];
    if (!VALID_TYPES.includes(feedback_type)) {
      return res.status(400).json({ error: `feedback_type must be one of: ${VALID_TYPES.join(',')}` });
    }

    const fb_id = 'fb_' + crypto.randomBytes(6).toString('hex');
    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');
    const fb = {
      feedback_id:   fb_id,
      signal_id:     id,
      feedback_type,
      rating:        rating != null ? parseFloat(rating) : null,
      comment,
      actor,
      correction_target: correction_target || null,
      submitted_at:  new Date().toISOString(),
      corrected:     false,
      correction_id: null,
      trace_id,
    };

    appendFeedback(id, fb);

    const allFeedbacks = getFeedback(id);
    const quality_score = parseFloat(
      (allFeedbacks.filter(f => f.rating != null).reduce((a,f) => a+(f.rating||0),0) /
       Math.max(1, allFeedbacks.filter(f => f.rating != null).length)).toFixed(2)
    );

    emitAudit({ trace_id, action: 'feedback_submit', signal_id: id, actor, payload: { fb_id, feedback_type, rating } });

    return res.status(201).json({
      feedback_id:   fb_id,
      signal_id:     id,
      feedback_type,
      rating:        fb.rating,
      quality_score,
      feedback_count: allFeedbacks.length,
      submitted_at:  fb.submitted_at,
      trace_id,
    });
  }

  // ── CORRECTION POST ──────────────────────────────────────────────────────
  // POST /api/signals/:id/feedback/:fid/correct
  const corrFid = fid || (urlParts.length >= 5 && urlParts[4] !== 'correct' ? urlParts[4] : null);
  const isCorrection = req.method === 'POST' && (action === 'correct' || req.url?.includes('/correct'));
  if (isCorrection) {
    const body = req.body || {};
    const { reason = '', corrected_value, actor = 'system' } = body;
    const fb_list_store = loadStore('feedback', {});
    const feedbacks = fb_list_store[id] || [];
    const fb_idx = feedbacks.findIndex(f => f.feedback_id === corrFid || f.feedback_id === action);

    // Allow correction without specific feedback_id (signal-level correction)
    const corr_id = 'cor_' + crypto.randomBytes(6).toString('hex');
    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');
    const correction = {
      correction_id:   corr_id,
      signal_id:       id,
      feedback_id:     corrFid || null,
      reason,
      corrected_value: corrected_value || null,
      actor,
      corrected_at:    new Date().toISOString(),
      trace_id,
    };

    // Mark feedback as corrected if found
    if (fb_idx >= 0) {
      feedbacks[fb_idx].corrected = true;
      feedbacks[fb_idx].correction_id = corr_id;
      fb_list_store[id] = feedbacks;
      saveStore('feedback', fb_list_store);
    }

    // Save correction
    const corrStore = loadStore('corrections', {});
    if (!corrStore[id]) corrStore[id] = [];
    corrStore[id].push(correction);
    saveStore('corrections', corrStore);

    emitAudit({ trace_id, action: 'feedback_correction', signal_id: id, actor, payload: { corr_id, feedback_id: corrFid, reason } });

    return res.status(201).json({
      correction_id: corr_id,
      signal_id:     id,
      feedback_id:   corrFid || null,
      reason,
      corrected_at:  correction.corrected_at,
      trace_id,
    });
  }

  // ── SIGNAL DETAIL ────────────────────────────────────────────────────────
  const evidences  = getEvidence(id);
  const lc         = getLifecycle(id);
  const feedbacks  = getFeedback(id);
  const qs         = feedbacks.length === 0 ? null :
    parseFloat((feedbacks.filter(f=>f.rating!=null).reduce((a,f)=>a+(f.rating||0),0) /
     Math.max(1,feedbacks.filter(f=>f.rating!=null).length)).toFixed(2));

  return res.status(200).json({
    ...signal,
    signal_id:         id,
    evidence_refs:     [signal.proof_id, ...evidences.map(e => e.evidence_id)],
    evidence_count:    signal.evidenceCount + evidences.length,
    appended_evidence: evidences.length,
    lifecycle_state:   lc?.lifecycle_state || (signal.stage === 'accelerating' ? 'active' : 'new'),
    last_evidence_at:  lc?.last_evidence_at || null,
    feedback_count:    feedbacks.length,
    quality_score:     qs,
    updated_at:        getUnifiedMeta().updated_at,
  });
}
