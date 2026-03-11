/**
 * /api/signals/:id — Signal detail + evidence operations
 *
 * Routes (via vercel.json):
 *   GET  /api/signals/:id              → signal detail
 *   POST /api/signals/:id/evidence     → evidence_append (P0-3)
 *   GET  /api/signals/:id/evidence     → evidence list
 *   GET  /api/signals/:id/lifecycle    → lifecycle state (P0-4)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import crypto from 'crypto';
import { getSignals, DATA_META } from '../_data.js';

// Evidence store: /tmp for P0 (see P1 for KV/DB migration)
const EVIDENCE_STORE = '/tmp/sm_evidence.json';
const LIFECYCLE_STORE = '/tmp/sm_lifecycle.json';

function loadJSON(p, def) {
  try { return existsSync(p) ? JSON.parse(readFileSync(p,'utf8')) : def; } catch { return def; }
}
function saveJSON(p, d) { try { writeFileSync(p, JSON.stringify(d,null,2)); } catch {} }

function getSignalById(id) {
  const signals = getSignals();
  // Support both evt_001 style and topic slug
  const idx = parseInt((id||'').replace('evt_',''), 10) - 1;
  if (idx >= 0 && idx < signals.length) return { ...signals[idx], signal_id: id };
  return signals.find(s => s.topic.toLowerCase().replace(/\s+/g,'-') === id) || null;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query || {};

  if (!id) {
    // List all signals
    const signals = getSignals();
    return res.status(200).json({
      signals, count: signals.length,
      updated_at: DATA_META.updated_at,
      inputs_hash: DATA_META.inputs_hash,
    });
  }

  const signal = getSignalById(id);
  if (!signal) return res.status(404).json({ error: 'Signal not found', id });

  // ── GET /api/signals/:id/lifecycle ──────────────────────────────────────
  if (action === 'lifecycle' || req.url?.includes('/lifecycle')) {
    const lcStore = loadJSON(LIFECYCLE_STORE, {});
    const lc = lcStore[id] || {
      signal_id:     id,
      lifecycle_state: signal.stage === 'accelerating' ? 'active' :
                       signal.stage === 'peak'          ? 'active' :
                       signal.stage === 'forming'       ? 'pending_evidence' :
                       signal.stage === 'fading'        ? 'decaying' : 'new',
      evidence_count: signal.evidenceCount || 0,
      last_updated:  DATA_META.updated_at,
      transitions:   [],
    };
    return res.status(200).json(lc);
  }

  // ── GET /api/signals/:id/evidence ───────────────────────────────────────
  if (req.method === 'GET' && (action === 'evidence' || req.url?.includes('/evidence'))) {
    const evStore = loadJSON(EVIDENCE_STORE, {});
    const evidences = evStore[id] || [];
    return res.status(200).json({
      signal_id: id,
      evidence:  evidences,
      count:     evidences.length,
      proof_id:  signal.proof_id,
      source_url: signal.source_url,
    });
  }

  // ── POST /api/signals/:id/evidence — evidence_append ────────────────────
  if (req.method === 'POST' && (action === 'evidence' || req.url?.includes('/evidence'))) {
    const body = req.body || {};
    const { source_url, source_type = 'external', credibility = 0.7, description = '' } = body;

    if (!source_url) return res.status(400).json({ error: 'source_url required' });

    const ev_id = 'ev_' + crypto.randomBytes(6).toString('hex');
    const evidence = {
      evidence_id:  ev_id,
      signal_id:    id,
      source_url,
      source_type,
      credibility:  parseFloat(credibility),
      description,
      appended_at:  new Date().toISOString(),
    };

    // Append to store
    const evStore = loadJSON(EVIDENCE_STORE, {});
    if (!evStore[id]) evStore[id] = [];
    evStore[id].push(evidence);
    saveJSON(EVIDENCE_STORE, evStore);

    // Update lifecycle
    const lcStore = loadJSON(LIFECYCLE_STORE, {});
    if (!lcStore[id]) {
      lcStore[id] = {
        signal_id: id,
        lifecycle_state: 'pending_evidence',
        evidence_count: 0,
        transitions: [],
      };
    }
    const lc = lcStore[id];
    lc.evidence_count = (lc.evidence_count || 0) + 1;
    lc.last_evidence_at = new Date().toISOString();

    // Auto-advance: if evidence_count >= 3, move to evidence_sufficient
    if (lc.evidence_count >= 3 && lc.lifecycle_state === 'pending_evidence') {
      lc.transitions.push({ from: lc.lifecycle_state, to: 'evidence_sufficient', at: new Date().toISOString(), reason: 'evidence_count>=3' });
      lc.lifecycle_state = 'evidence_sufficient';
    }
    saveJSON(LIFECYCLE_STORE, lcStore);

    return res.status(201).json({
      evidence_id:     ev_id,
      signal_id:       id,
      evidence_count:  lc.evidence_count,
      lifecycle_state: lc.lifecycle_state,
      appended_at:     evidence.appended_at,
    });
  }

  // ── GET /api/signals/:id — signal detail ─────────────────────────────────
  const evStore = loadJSON(EVIDENCE_STORE, {});
  const lcStore = loadJSON(LIFECYCLE_STORE, {});
  const evidences = evStore[id] || [];
  const lc = lcStore[id] || null;

  return res.status(200).json({
    ...signal,
    signal_id:       id,
    evidence_refs:   [signal.proof_id, ...evidences.map(e => e.evidence_id)],
    evidence_count:  signal.evidenceCount + evidences.length,
    appended_evidence: evidences.length,
    lifecycle_state: lc?.lifecycle_state || (signal.stage === 'accelerating' ? 'active' : 'new'),
    last_evidence_at: lc?.last_evidence_at || null,
    updated_at:      DATA_META.updated_at,
  });
}
