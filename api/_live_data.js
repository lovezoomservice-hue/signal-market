/**
 * _live_data.js — Live Data Loader (P2-2 arXiv writeback)
 *
 * Wraps _data.js with live signals from data/signals_history.jsonl.
 * - When signals_history.jsonl exists: merge latest snapshot with static signals
 * - Falls back to static REAL_SIGNALS when file unavailable
 *
 * Endpoints that want live data import from _live_data.js instead of _data.js
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { REAL_SIGNALS, DATA_META, getTopics, getTrends, getEvents, getEvent } from './_data.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const HIST_FILE = join(__dir, '..', 'data', 'signals_history.jsonl');

let _cachedSignals = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 30_000; // 30s

function loadLatestSnapshot() {
  try {
    if (!existsSync(HIST_FILE)) return null;
    const lines = readFileSync(HIST_FILE, 'utf8').trim().split('\n').filter(Boolean);
    if (!lines.length) return null;
    const latest = JSON.parse(lines[lines.length - 1]);
    return latest?.signals?.length ? latest : null;
  } catch {
    return null;
  }
}

function getMergedSignals() {
  const now = Date.now();
  if (_cachedSignals && now - _cacheTs < CACHE_TTL_MS) return _cachedSignals;

  const snapshot = loadLatestSnapshot();
  if (!snapshot) {
    _cachedSignals = [...REAL_SIGNALS];
    _cacheTs = now;
    return _cachedSignals;
  }

  // Merge: live signals take precedence by topic
  const liveMap = Object.fromEntries(snapshot.signals.map(s => [s.topic, s]));
  const base = REAL_SIGNALS.map(s => liveMap[s.topic] ? { ...s, ...liveMap[s.topic] } : s);
  // Add new topics from live that don't exist in static
  const staticTopics = new Set(REAL_SIGNALS.map(s => s.topic));
  const extra = snapshot.signals.filter(s => !staticTopics.has(s.topic));

  _cachedSignals = [...base, ...extra].sort((a, b) => b.confidence - a.confidence);
  _cacheTs = now;
  return _cachedSignals;
}

export function getLiveSignals({ stage, limit } = {}) {
  let s = getMergedSignals();
  if (stage) s = s.filter(x => x.stage === stage);
  if (limit) s = s.slice(0, parseInt(limit));
  return s;
}

export function getLiveMeta() {
  const snapshot = loadLatestSnapshot();
  return {
    ...DATA_META,
    live_source: snapshot ? 'signals_history.jsonl' : 'static',
    live_synced_at: snapshot?.synced_at || DATA_META.synced_at,
    live_signal_count: getMergedSignals().length,
  };
}

// Re-export static helpers unchanged
export { getTopics, getTrends, getEvents, getEvent };
