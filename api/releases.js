/**
 * /api/releases — Gray Release + Rollback (P1-4, P1-5)
 *
 * Routes:
 *   POST /api/releases                 → create a release (from candidate/eval)
 *   GET  /api/releases                 → list all releases
 *   GET  /api/releases/:id             → release detail
 *   POST /api/releases/:id/activate    → promote gray → stable
 *   POST /api/releases/:id/rollback    → rollback release
 *   GET  /api/releases/:id/rollbacks   → rollback history for release
 */

import crypto from 'crypto';
import {
  getReleases, saveRelease,
  getRollbacks, saveRollback,
  getEvaluations,
  loadStore, saveStore,
  emitAudit,
} from './_store.js';

const RELEASE_TYPES = ['gray', 'stable', 'hotfix'];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query || {};

  // ── POST /api/releases ───────────────────────────────────────────────────
  if (req.method === 'POST' && !id) {
    const body = req.body || {};
    const {
      release_type = 'gray',
      candidate_id = null,
      eval_id      = null,
      signal_id    = null,
      version_tag,
      traffic_pct  = release_type === 'gray' ? 10 : 100,
      description  = '',
      actor        = 'system',
    } = body;

    if (!RELEASE_TYPES.includes(release_type)) {
      return res.status(400).json({ error: `release_type must be one of: ${RELEASE_TYPES.join(',')}` });
    }

    // If eval_id provided, warn but don't hard-block (gray releases can start from partial eval)
    let eval_gate_warn = null;
    if (eval_id) {
      const evals = getEvaluations();
      const ev = evals[eval_id];
      if (ev && !ev.pass_gate && release_type === 'stable') {
        return res.status(400).json({ error: 'Cannot create stable release: referenced eval did not pass gate', eval_id });
      }
      if (ev && !ev.pass_gate) {
        eval_gate_warn = 'referenced eval did not pass gate; proceeding with gray release under monitoring';
      }
    }

    const rel_id   = 'rel_' + crypto.randomBytes(6).toString('hex');
    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');
    const vtag     = version_tag || `v0.1-${release_type}-${new Date().toISOString().slice(0,10)}`;

    const release = {
      release_id:  rel_id,
      release_type,
      candidate_id,
      eval_id,
      signal_id,
      version_tag: vtag,
      traffic_pct: parseFloat(traffic_pct),
      description,
      status:      release_type === 'gray' ? 'gray' : 'stable',
      actor,
      released_at: new Date().toISOString(),
      activated_at: null,
      rolled_back:  false,
      rollback_id:  null,
      trace_id,
    };

    saveRelease(rel_id, release);
    emitAudit({ trace_id, action: 'gray_release', signal_id, actor,
      payload: { rel_id, release_type, version_tag: vtag, traffic_pct: release.traffic_pct } });

    return res.status(201).json({
      release_id:  rel_id,
      release_type,
      version_tag: vtag,
      status:      release.status,
      traffic_pct: release.traffic_pct,
      released_at: release.released_at,
      eval_gate_warning: eval_gate_warn,
      trace_id,
    });
  }

  // ── POST /api/releases/:id/activate ─────────────────────────────────────
  if (req.method === 'POST' && id && action === 'activate') {
    const rels = getReleases();
    const rel  = rels[id];
    if (!rel) return res.status(404).json({ error: 'Release not found', id });
    if (rel.status === 'stable') return res.status(400).json({ error: 'Already stable' });

    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');
    rel.status       = 'stable';
    rel.traffic_pct  = 100;
    rel.activated_at = new Date().toISOString();
    saveRelease(id, rel);

    emitAudit({ trace_id, action: 'release_activated', signal_id: rel.signal_id,
      actor: req.body?.actor || 'system',
      payload: { rel_id: id, version_tag: rel.version_tag } });

    return res.status(200).json({ release_id: id, status: 'stable', traffic_pct: 100, activated_at: rel.activated_at, trace_id });
  }

  // ── POST /api/releases/:id/rollback ─────────────────────────────────────
  if (req.method === 'POST' && id && action === 'rollback') {
    const rels = getReleases();
    const rel  = rels[id];
    if (!rel) return res.status(404).json({ error: 'Release not found', id });
    if (rel.rolled_back) return res.status(400).json({ error: 'Already rolled back' });

    const body = req.body || {};
    const {
      reason         = 'manual rollback',
      to_stable_tag  = 'v0.0-baseline',
      actor          = 'system',
    } = body;

    const rb_id    = 'rb_' + crypto.randomBytes(6).toString('hex');
    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');

    const rollback = {
      rollback_id:   rb_id,
      release_id:    id,
      signal_id:     rel.signal_id || null,
      from_version:  rel.version_tag,
      to_stable_tag,
      reason,
      actor,
      rolled_back_at: new Date().toISOString(),
      trace_id,
    };

    saveRollback(rb_id, rollback);

    rel.rolled_back = true;
    rel.rollback_id = rb_id;
    rel.status      = 'rolled_back';
    saveRelease(id, rel);

    emitAudit({ trace_id, action: 'rollback', signal_id: rel.signal_id, actor,
      payload: { rb_id, release_id: id, from_version: rel.version_tag, to_stable_tag, reason } });

    return res.status(201).json({
      rollback_id:    rb_id,
      release_id:     id,
      from_version:   rel.version_tag,
      to_stable_tag,
      status:         'rolled_back',
      rolled_back_at: rollback.rolled_back_at,
      trace_id,
    });
  }

  // ── GET /api/releases/:id/rollbacks ─────────────────────────────────────
  if (req.method === 'GET' && id && action === 'rollbacks') {
    const rbs = Object.values(getRollbacks()).filter(r => r.release_id === id);
    return res.status(200).json({ release_id: id, rollbacks: rbs, count: rbs.length });
  }

  // ── GET /api/releases ────────────────────────────────────────────────────
  if (req.method === 'GET' && !id) {
    const rels = Object.values(getReleases());
    return res.status(200).json({
      releases:      rels,
      count:         rels.length,
      gray:          rels.filter(r => r.status === 'gray').length,
      stable:        rels.filter(r => r.status === 'stable').length,
      rolled_back:   rels.filter(r => r.rolled_back).length,
    });
  }

  // ── GET /api/releases/:id ────────────────────────────────────────────────
  if (req.method === 'GET' && id) {
    const rels = getReleases();
    const rel  = rels[id];
    if (!rel) return res.status(404).json({ error: 'Release not found', id });
    return res.status(200).json(rel);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
