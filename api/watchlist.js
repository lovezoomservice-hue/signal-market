/**
 * Watchlist API — Vercel Endpoint
 * GET    /api/watchlist           → list active watches
 * POST   /api/watchlist           → create watch { topic, threshold?, stage?, email? }
 * DELETE /api/watchlist/:id       → deactivate watch
 * GET    /api/watchlist/triggers  → recent trigger log
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..');
const WL_FILE= join(ROOT, 'data', 'watchlist.json');
const TRG_LOG= join(ROOT, 'data', 'watchlist_triggers.jsonl');
const SIG_FILE=join(ROOT, 'data', 'signals_history.jsonl');

function loadWatchlist() {
  try {
    if (!existsSync(WL_FILE)) return [];
    const d = JSON.parse(readFileSync(WL_FILE,'utf8'));
    return Array.isArray(d) ? d : (d.watchlist || []);
  } catch { return []; }
}
function saveWatchlist(list) {
  writeFileSync(WL_FILE, JSON.stringify({ watchlist: list, updated_at: new Date().toISOString() }, null, 2));
}
function loadSignals() {
  if (!existsSync(SIG_FILE)) return [];
  return readFileSync(SIG_FILE,'utf8').trim().split('\n').filter(Boolean).map(l => {
    try { const s=JSON.parse(l); return s.topic&&s.signal_id?s:null; } catch { return null; }
  }).filter(Boolean);
}
function loadTriggers(limit=50) {
  try {
    if (!existsSync(TRG_LOG)) return [];
    return readFileSync(TRG_LOG,'utf8').trim().split('\n').filter(Boolean)
      .map(l=>{ try{return JSON.parse(l);}catch{return null;} }).filter(Boolean).slice(-limit).reverse();
  } catch { return []; }
}
function logTrigger(e) {
  try { appendFileSync(TRG_LOG, JSON.stringify(e)+'\n'); } catch {}
}
function checkTriggers(watchlist, signals) {
  const today = new Date().toISOString().slice(0,10);
  const alerted = new Set(
    loadTriggers(200).filter(t=>t.ts?.startsWith(today)).map(t=>t.watch_id)
  );
  const out = [];
  for (const w of watchlist) {
    if (!w.active) continue;
    if (alerted.has(w.id)) continue;
    const q = (w.topic||'').toLowerCase();
    const sig = signals.find(s=>s.topic.toLowerCase().includes(q)||q.includes(s.topic.toLowerCase()));
    if (!sig) continue;
    const conf_ok  = sig.confidence >= (w.threshold||0.7);
    const stage_ok = !w.stage || sig.stage === w.stage;
    if (conf_ok && stage_ok) {
      const entry = { ts: new Date().toISOString(), watch_id: w.id, topic: sig.topic,
        signal_id: sig.signal_id||null,
        stage: sig.stage, confidence: sig.confidence, threshold: w.threshold,
        email: w.email||null, trigger: 'THRESHOLD_EXCEEDED' };
      logTrigger(entry);
      out.push(entry);
    }
  }
  return out;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
  if (req.method==='OPTIONS') return res.status(200).end();

  const parts   = (req.url||'').replace(/\?.*$/,'').split('/').filter(Boolean);
  const subpath = parts[2];

  if (req.method==='GET' && subpath==='triggers')
    return res.status(200).json({ triggers: loadTriggers(), timestamp: new Date().toISOString() });

  if (req.method==='DELETE' && subpath) {
    const list = loadWatchlist();
    const idx  = list.findIndex(w=>w.id===subpath);
    if (idx===-1) return res.status(404).json({ error:'not found' });
    list[idx].active=false; list[idx].removed_at=new Date().toISOString();
    saveWatchlist(list);
    return res.status(200).json({ success:true, id:subpath });
  }

  if (req.method==='GET') {
    const list = loadWatchlist().filter(w=>w.active!==false);
    return res.status(200).json({ watchlist: list, count: list.length });
  }

  if (req.method==='POST') {
    const body = req.body||{};
    if (!body.topic) return res.status(400).json({ error:'topic required' });
    const list = loadWatchlist();
    const watch = { id:`wl_${Date.now()}`, topic:body.topic,
      threshold: Number(body.threshold)||0.7, stage:body.stage||null,
      email:body.email||null, created_at:new Date().toISOString(), active:true };
    list.push(watch);
    saveWatchlist(list);
    const signals   = loadSignals();
    const triggered = checkTriggers([watch], signals);
    return res.status(201).json({ success:true, watch, triggered:triggered.length>0, triggers:triggered });
  }

  return res.status(405).json({ error:'Method not allowed' });
}
