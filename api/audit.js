/**
 * /api/audit — Audit Trace (P1-6)
 *
 * Immutable (append-only) audit log covering:
 *   evidence_append, feedback_submit, feedback_correction,
 *   evaluation_run, approval_granted, gray_release,
 *   release_activated, rollback
 *
 * Routes:
 *   GET /api/audit                      → query audit log (filter by signal_id, action, limit)
 *   GET /api/audit/trace/:trace_id      → get single trace entry
 *   GET /api/audit/signal/:signal_id    → full audit chain for a signal
 */

import { loadStore } from './_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')   return res.status(405).json({ error: 'Audit is read-only' });

  const { id, action } = req.query || {};
  const log = loadStore('audit_log', []);
  const entries = Array.isArray(log) ? log : [];

  // ── GET /api/audit/trace/:trace_id ──────────────────────────────────────
  if (id === 'trace' && action) {
    const trace_id = action;
    const entry = entries.find(e => e.trace_id === trace_id);
    if (!entry) return res.status(404).json({ error: 'Trace not found', trace_id });
    return res.status(200).json(entry);
  }

  // ── GET /api/audit/signal/:signal_id ────────────────────────────────────
  if (id === 'signal' && action) {
    const signal_id = action;
    const chain = entries.filter(e => e.signal_id === signal_id);
    return res.status(200).json({
      signal_id,
      chain,
      count:   chain.length,
      actions: [...new Set(chain.map(e => e.action))],
    });
  }

  // ── GET /api/audit ───────────────────────────────────────────────────────
  const { signal_id, action: filterAction, limit = '50', offset = '0' } = req.query || {};
  let filtered = [...entries];
  if (signal_id)    filtered = filtered.filter(e => e.signal_id === signal_id);
  if (filterAction) filtered = filtered.filter(e => e.action === filterAction);

  const total   = filtered.length;
  const off     = parseInt(offset, 10) || 0;
  const lim     = Math.min(parseInt(limit, 10) || 50, 200);
  const page    = filtered.slice(off, off + lim).reverse(); // newest first

  return res.status(200).json({
    entries:   page,
    total,
    count:     page.length,
    offset:    off,
    limit:     lim,
    actions_covered: [...new Set(entries.map(e => e.action))],
    is_append_only:  true,
  });
}
