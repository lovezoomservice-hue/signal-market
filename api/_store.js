/**
 * _store.js — Unified Persistent Store (P1-8)
 *
 * Replaces all scattered /tmp writes with a single
 * data/runtime/*.json layer. Local-first, git-ignored
 * runtime files. Survives local process restarts.
 *
 * Also provides: emitAudit(event) → append-only audit log
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dir = dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = join(__dir, '..', 'data', 'runtime');

// Ensure runtime dir exists
try { mkdirSync(RUNTIME_DIR, { recursive: true }); } catch {}

// In-memory cache: { name → { data, ts } }
const _cache = {};
const CACHE_TTL_MS = 5_000; // 5s — avoid re-reading on burst requests

function storePath(name) {
  return join(RUNTIME_DIR, `${name}.json`);
}

function tmpPath(name) {
  return join(RUNTIME_DIR, `.${name}.tmp.json`);
}

export function loadStore(name, defaultVal = {}) {
  const now = Date.now();
  if (_cache[name] && now - _cache[name].ts < CACHE_TTL_MS) {
    return _cache[name].data;
  }
  const p = storePath(name);
  try {
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf8');
      const data = JSON.parse(raw); // throws on corrupt JSON
      _cache[name] = { data, ts: now };
      return data;
    }
  } catch (e) {
    console.error(`_store.loadStore(${name}) parse error — using default:`, e.message);
  }
  const def = typeof defaultVal === 'function' ? defaultVal() : JSON.parse(JSON.stringify(defaultVal));
  return def;
}

export function saveStore(name, data) {
  // Atomic write: write to .tmp then rename (prevents partial writes)
  const tmp = tmpPath(name);
  const dest = storePath(name);
  try {
    const serialized = JSON.stringify(data, null, 2);
    // Validate: re-parse before committing
    JSON.parse(serialized);
    writeFileSync(tmp, serialized);
    renameSync(tmp, dest);
    // Invalidate cache on write
    _cache[name] = { data, ts: Date.now() };
  } catch (e) {
    console.error(`_store.saveStore(${name}) error:`, e.message);
    // Clean up temp file if rename failed
    try { if (existsSync(tmp)) writeFileSync(tmp, ''); } catch {}
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
