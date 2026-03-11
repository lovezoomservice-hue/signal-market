/**
 * /api/approvals — Approval Records (P1-7)
 *
 * Routes:
 *   GET  /api/approvals          → list all approval records
 *   GET  /api/approvals/:id      → single approval record
 *   POST /api/approvals          → create standalone approval (not via eval)
 */

import crypto from 'crypto';
import { getApprovals, saveApproval, emitAudit } from './_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query || {};

  // ── POST /api/approvals ──────────────────────────────────────────────────
  if (req.method === 'POST' && !id) {
    const body = req.body || {};
    const {
      subject_type = 'signal',   // signal | candidate | eval | release
      subject_id,
      approval_action = 'approve',
      actor = 'founder',
      notes = '',
    } = body;

    if (!subject_id) return res.status(400).json({ error: 'subject_id required' });

    const ap_id    = 'ap_' + crypto.randomBytes(6).toString('hex');
    const trace_id = 'tr_' + crypto.randomBytes(8).toString('hex');

    const approval = {
      approval_id:     ap_id,
      subject_type,
      subject_id,
      approval_action,
      status:          approval_action === 'approve' ? 'approved' : 'rejected',
      actor,
      notes,
      approved_at:     new Date().toISOString(),
      trace_id,
    };

    saveApproval(ap_id, approval);
    emitAudit({ trace_id, action: 'approval_granted', signal_id: subject_type === 'signal' ? subject_id : null,
      actor, payload: { ap_id, subject_type, subject_id, approval_action } });

    return res.status(201).json({
      approval_id:    ap_id,
      subject_type,
      subject_id,
      status:         approval.status,
      actor,
      approved_at:    approval.approved_at,
      trace_id,
    });
  }

  // ── GET /api/approvals ───────────────────────────────────────────────────
  if (req.method === 'GET' && !id) {
    const approvals = Object.values(getApprovals());
    return res.status(200).json({
      approvals,
      count:    approvals.length,
      approved: approvals.filter(a => a.status === 'approved').length,
      rejected: approvals.filter(a => a.status === 'rejected').length,
    });
  }

  // ── GET /api/approvals/:id ───────────────────────────────────────────────
  if (req.method === 'GET' && id) {
    const all = getApprovals();
    const ap  = all[id];
    if (!ap) return res.status(404).json({ error: 'Approval not found', id });
    return res.status(200).json(ap);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
