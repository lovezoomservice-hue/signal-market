/**
 * Watchlist API — Vercel Endpoint with KV Persistence
 * GET    /api/watchlist           → list active watches
 * POST   /api/watchlist           → create watch { topic, threshold?, stage?, email? }
 * DELETE /api/watchlist/:id       → deactivate watch
 * GET    /api/watchlist/triggers  → recent trigger log
 *
 * Storage design:
 * - wl:default → JSON array of watchlist items (replaces file write)
 * - wl:triggers → JSON array of trigger log entries (max 500)
 * - Keep reading from signals_history.jsonl (bundled read-only file)
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import persistence from './lib/kv.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const SIG_FILE = join(ROOT, 'data', 'signals_history.jsonl');

// ── Persistence helpers ────────────────────────────────────────────────────
const WL_KEY = 'wl:default';
const TRG_KEY = 'wl:triggers';

async function loadWatchlist() {
  try {
    const data = await persistence.get(WL_KEY);
    if (!data) return [];
    return Array.isArray(data) ? data : JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveWatchlist(list) {
  await persistence.set(WL_KEY, JSON.stringify(list));
}

function loadSignals() {
  if (!existsSync(SIG_FILE)) return [];
  return readFileSync(SIG_FILE, 'utf8').trim().split('\n').filter(Boolean).map(l => {
    try { const s = JSON.parse(l); return s.topic && s.signal_id ? s : null; } catch { return null; }
  }).filter(Boolean);
}

async function loadTriggers(limit = 50) {
  try {
    const data = await persistence.get(TRG_KEY);
    if (!data) return [];
    const all = Array.isArray(data) ? data : JSON.parse(data);
    return all.slice(-limit).reverse();
  } catch {
    return [];
  }
}

async function logTrigger(e) {
  try {
    let all = await persistence.get(TRG_KEY);
    all = all ? (Array.isArray(all) ? all : JSON.parse(all)) : [];
    all.push(e);
    // Keep max 500 entries
    if (all.length > 500) all = all.slice(-500);
    await persistence.set(TRG_KEY, JSON.stringify(all));
  } catch {}
}

function checkTriggers(watchlist, signals) {
  const today = new Date().toISOString().slice(0, 10);
  // Load triggers to check what already alerted today
  const allTriggers = Array.isArray(persistence.get(TRG_KEY))
    ? persistence.get(TRG_KEY)
    : JSON.parse(persistence.get(TRG_KEY) || '[]');
  const alerted = new Set(
    allTriggers.filter(t => t.ts?.startsWith(today)).map(t => t.watch_id)
  );
  const out = [];
  for (const w of watchlist) {
    if (!w.active) continue;
    if (alerted.has(w.id)) continue;
    const q = (w.topic || '').toLowerCase();
    const sig = signals.find(s => s.topic.toLowerCase().includes(q) || q.includes(s.topic.toLowerCase()));
    if (!sig) continue;
    const conf_ok = sig.confidence >= (w.threshold || 0.7);
    const stage_ok = !w.stage || sig.stage === w.stage;
    if (conf_ok && stage_ok) {
      const entry = {
        ts: new Date().toISOString(),
        watch_id: w.id,
        topic: sig.topic,
        signal_id: sig.signal_id || null,
        stage: sig.stage,
        confidence: sig.confidence,
        threshold: w.threshold,
        email: w.email || null,
        trigger: 'THRESHOLD_EXCEEDED'
      };
      logTrigger(entry);
      out.push(entry);
    }
  }
  return out;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const parts = (req.url || '').replace(/\?.*$/, '').split('/').filter(Boolean);
  const subpath = parts[2];

  // GET /api/watchlist/triggers
  if (req.method === 'GET' && subpath === 'triggers') {
    const triggers = await loadTriggers();
    return res.status(200).json({
      triggers,
      timestamp: new Date().toISOString(),
      persistence_mode: persistence.mode,
    });
  }

  // DELETE /api/watchlist/:id
  if (req.method === 'DELETE' && subpath) {
    const list = await loadWatchlist();
    const idx = list.findIndex(w => w.id === subpath);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    list[idx].active = false;
    list[idx].removed_at = new Date().toISOString();
    await saveWatchlist(list);
    return res.status(200).json({
      success: true,
      id: subpath,
      persistence_mode: persistence.mode,
    });
  }

  // GET /api/watchlist
  if (req.method === 'GET') {
    const list = (await loadWatchlist()).filter(w => w.active !== false);
    return res.status(200).json({
      watchlist: list,
      count: list.length,
      persistence_mode: persistence.mode,
    });
  }

  // POST /api/watchlist
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.topic) return res.status(400).json({ error: 'topic required' });
    const list = await loadWatchlist();
    const watch = {
      id: `wl_${Date.now()}`,
      topic: body.topic,
      threshold: Number(body.threshold) || 0.7,
      stage: body.stage || null,
      email: body.email || null,
      created_at: new Date().toISOString(),
      active: true,
    };
    list.push(watch);
    await saveWatchlist(list);

    const signals = loadSignals();
    const triggered = checkTriggers([watch], signals);

    return res.status(201).json({
      success: true,
      watch,
      triggered: triggered.length > 0,
      triggers: triggered,
      persistence_mode: persistence.mode,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
