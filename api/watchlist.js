/**
 * Watchlist API - Vercel Endpoint
 * GET  /api/watchlist          → list all watches
 * POST /api/watchlist          → create watch (M10)
 * GET  /api/watchlist/triggers → trigger log (M11/M12)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs   = require('fs');
const path = require('path');

// Vercel serverless: use /tmp for writable storage
const WATCHLIST_FILE = '/tmp/watchlist.json';
const TRIGGER_LOG    = '/tmp/watchlist_triggers.jsonl';

function loadWatchlist() {
  try {
    if (fs.existsSync(WATCHLIST_FILE)) return JSON.parse(fs.readFileSync(WATCHLIST_FILE,'utf8'));
  } catch {}
  return [];
}

function saveWatchlist(list) {
  try { fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list,null,2)); } catch {}
}

function logTrigger(entry) {
  try { fs.appendFileSync(TRIGGER_LOG, JSON.stringify(entry)+'\n'); } catch {}
}

function loadTriggers() {
  try {
    if (!fs.existsSync(TRIGGER_LOG)) return [];
    return fs.readFileSync(TRIGGER_LOG,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
  } catch { return []; }
}

// Check if any existing watchlist items should trigger
function checkTriggers(watchlist, newWatch) {
  const triggered = [];
  const allWatches = [...watchlist, newWatch].filter(Boolean);
  // Simulate: "accelerating" stage items always trigger if threshold < 0.9
  const LIVE_SIGNALS = [
    { topic: 'AI Agents', stage: 'accelerating', confidence: 0.97 },
    { topic: 'LLM Infrastructure', stage: 'accelerating', confidence: 0.92 },
    { topic: 'AI Coding', stage: 'accelerating', confidence: 0.93 },
  ];
  for (const w of allWatches) {
    for (const s of LIVE_SIGNALS) {
      if (s.topic.toLowerCase().includes((w.topic||'').toLowerCase()) &&
          s.confidence >= (w.threshold || 0.8)) {
        const entry = { ts: new Date().toISOString(), watch_id: w.id,
          topic: s.topic, stage: s.stage, confidence: s.confidence,
          threshold: w.threshold, trigger: 'CONFIDENCE_EXCEEDED' };
        logTrigger(entry);
        triggered.push(entry);
      }
    }
  }
  return triggered;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlParts = (req.url||'').replace(/\?.*$/,'').split('/').filter(Boolean);
  const subpath = urlParts[2]; // 'triggers' for /api/watchlist/triggers

  // GET /api/watchlist/triggers — M11/M12
  if (req.method === 'GET' && subpath === 'triggers') {
    const triggers = loadTriggers();
    return res.status(200).json({ triggers, count: triggers.length, timestamp: new Date().toISOString() });
  }

  // GET /api/watchlist
  if (req.method === 'GET') {
    const list = loadWatchlist();
    return res.status(200).json({ watchlist: list, count: list.length });
  }

  // POST /api/watchlist — M10
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.topic) return res.status(400).json({ error: 'topic required' });

    const list = loadWatchlist();
    const newWatch = {
      id:        `wl_${Date.now()}`,
      topic:     body.topic,
      threshold: body.threshold || 0.7,
      stage:     body.stage || null,
      created_at: new Date().toISOString(),
      active:    true,
    };
    list.push(newWatch);
    saveWatchlist(list);

    // Check triggers immediately (M11)
    const triggered = checkTriggers(list, newWatch);

    return res.status(201).json({
      success:   true,
      watch:     newWatch,
      triggered: triggered.length > 0,
      triggers:  triggered,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
