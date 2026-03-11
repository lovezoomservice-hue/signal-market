/**
 * _store.js — Unified Persistent Store (P1-8)
 *
 * Replaces all scattered /tmp writes with a single
 * data/runtime/*.json layer. Local-first, git-ignored
 * runtime files. Survives local process restarts.
 *
 * Also provides: emitAudit(event) → append-only audit log
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dir = dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = join(__dir, '..', 'data', 'runtime');

// Ensure runtime dir exists
try { mkdirSync(RUNTIME_DIR, { recursive: true }); } catch {}

function storePath(name) {
  return join(RUNTIME_DIR, `${name}.json`);
}

export function loadStore(name, defaultVal = {}) {
  const p = storePath(name);
  try {
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  } catch {}
  return typeof defaultVal === 'function' ? defaultVal() : JSON.parse(JSON.stringify(defaultVal));
}

export function saveStore(name, data) {
  try {
    writeFileSync(storePath(name), JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`_store.saveStore(${name}) error:`, e.message);
  }
}

// ── Audit Log (append-only) ──────────────────────────────

export function emitAudit(event) {
  const log = loadStore('audit_log', []);
  const entry = {
    trace_id:   event.trace_id || ('tr_' + crypto.randomBytes(8).toString('hex')),
    action:     event.action,
    signal_id:  event.signal_id || null,
    actor:      event.actor || 'system',
    payload:    event.payload || {},
    at:         new Date().toISOString(),
    parent_trace_id: event.parent_trace_id || null,
  };
  if (!Array.isArray(log)) {
    saveStore('audit_log', [entry]);
  } else {
    log.push(entry);
    saveStore('audit_log', log);
  }
  return entry.trace_id;
}

// ── Convenience accessors ────────────────────────────────

export function getEvidence(signal_id) {
  const s = loadStore('evidence', {});
  return s[signal_id] || [];
}

export function appendEvidence(signal_id, ev) {
  const s = loadStore('evidence', {});
  if (!s[signal_id]) s[signal_id] = [];
  s[signal_id].push(ev);
  saveStore('evidence', s);
}

export function getLifecycle(signal_id) {
  const s = loadStore('lifecycle', {});
  return s[signal_id] || null;
}

export function saveLifecycle(signal_id, lc) {
  const s = loadStore('lifecycle', {});
  s[signal_id] = lc;
  saveStore('lifecycle', s);
}

export function getCandidates() {
  const s = loadStore('candidates', {});
  return s;
}

export function saveCandidate(id, cand) {
  const s = loadStore('candidates', {});
  s[id] = cand;
  saveStore('candidates', s);
}

export function getFeedback(signal_id) {
  const s = loadStore('feedback', {});
  return s[signal_id] || [];
}

export function appendFeedback(signal_id, fb) {
  const s = loadStore('feedback', {});
  if (!s[signal_id]) s[signal_id] = [];
  s[signal_id].push(fb);
  saveStore('feedback', s);
}

export function getEvaluations() {
  return loadStore('evaluations', {});
}

export function saveEvaluation(id, ev) {
  const s = loadStore('evaluations', {});
  s[id] = ev;
  saveStore('evaluations', s);
}

export function getReleases() {
  return loadStore('releases', {});
}

export function saveRelease(id, rel) {
  const s = loadStore('releases', {});
  s[id] = rel;
  saveStore('releases', s);
}

export function getRollbacks() {
  return loadStore('rollbacks', {});
}

export function saveRollback(id, rb) {
  const s = loadStore('rollbacks', {});
  s[id] = rb;
  saveStore('rollbacks', s);
}

export function getApprovals() {
  return loadStore('approvals', {});
}

export function saveApproval(id, ap) {
  const s = loadStore('approvals', {});
  s[id] = ap;
  saveStore('approvals', s);
}
