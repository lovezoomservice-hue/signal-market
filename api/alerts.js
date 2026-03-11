import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getSignals, DATA_META } from './_data.js';

const WATCHLIST_FILE = '/tmp/watchlist.json';

function loadWatchlist() {
  try {
    if (existsSync(WATCHLIST_FILE)) {
      return JSON.parse(readFileSync(WATCHLIST_FILE, 'utf8'));
    }
  } catch (err) {
    // /tmp not available or empty — use signals as default alert source
  }
  return [];
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const watchlist = loadWatchlist();
  const signals   = getSignals();

  // Generate alerts: watchlist matches + high-confidence accelerating signals
  const alerts = [];

  // Watchlist-triggered alerts
  watchlist.forEach(w => {
    const match = signals.find(s => s.topic.toLowerCase().includes((w.topic||'').toLowerCase()));
    if (match && match.stage === 'accelerating') {
      alerts.push({
        alert_id:   `alert_wl_${w.id || Date.now()}`,
        type:       'watchlist_trigger',
        topic:      match.topic,
        stage:      match.stage,
        confidence: match.confidence,
        proof_id:   match.proof_id,
        source_url: match.source_url,
        triggered_at: new Date().toISOString(),
      });
    }
  });

  // Auto-alerts: accelerating signals with confidence > 0.9
  signals
    .filter(s => s.stage === 'accelerating' && s.confidence > 0.9)
    .forEach((s, i) => {
      alerts.push({
        alert_id:   `alert_auto_${i+1}`,
        type:       'auto_high_confidence',
        topic:      s.topic,
        stage:      s.stage,
        confidence: s.confidence,
        proof_id:   s.proof_id,
        source_url: s.source_url,
        triggered_at: new Date().toISOString(),
      });
    });

  return res.status(200).json({
    alerts,
    count:      alerts.length,
    updated_at: DATA_META.updated_at,
  });
}
