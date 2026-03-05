/**
 * Signal Market API - Vercel Deployment
 */

// In-memory storage (persists on Vercel during runtime)
const WATCHLIST = [];

const REAL_SIGNALS = [
  { topic: 'AI Agents', stage: 'emerging', confidence: 0.72, impact_score: 0.85, evidenceCount: 156, sources: ['github', 'hackernews', 'arxiv'] },
  { topic: 'Claude API', stage: 'accelerating', confidence: 0.89, impact_score: 0.92, evidenceCount: 89, sources: ['github', 'reddit'] },
  { topic: 'GPT-5 Rumors', stage: 'forming', confidence: 0.65, impact_score: 0.78, evidenceCount: 45, sources: ['twitter', 'news'] },
  { topic: 'GPU Shortage', stage: 'peak', confidence: 0.94, impact_score: 0.88, evidenceCount: 234, sources: ['news', 'market'] },
  { topic: 'LangChain Alternatives', stage: 'emerging', confidence: 0.58, impact_score: 0.65, evidenceCount: 34, sources: ['github', 'reddit'] },
  { topic: 'Quantum Computing', stage: 'weak', confidence: 0.35, impact_score: 0.95, evidenceCount: 12, sources: ['arxiv'] },
  { topic: 'OpenSource AI', stage: 'accelerating', confidence: 0.81, impact_score: 0.82, evidenceCount: 167, sources: ['github', 'news'] },
  { topic: 'Devin AI', stage: 'forming', confidence: 0.67, impact_score: 0.75, evidenceCount: 56, sources: ['twitter', 'news'] }
];

function calculateFeedScore(signal) {
  const impact = signal.impact_score || 0.5;
  const confidence = signal.confidence || 0.5;
  const velocity = 0.3 + Math.random() * 0.4;
  const recency = 0.7 + Math.random() * 0.3;
  return 0.30 * impact + 0.25 * confidence + 0.20 * velocity + 0.15 * recency + 0.10 * 0.5;
}

function rankSignals(signals) {
  return signals.map(s => ({
    ...s,
    feed_score: calculateFeedScore(s),
    velocity: 0.3 + Math.random() * 0.5,
    velocity_state: Math.random() > 0.5 ? 'accelerating' : 'stable',
    category: 'AI'
  })).sort((a, b) => b.feed_score - a.feed_score).slice(0, 50);
}

export default async function handler(req, res) {
  const { method, url } = req;
  const path = url.split('?')[0];

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET /signals
    if (method === 'GET' && path === '/signals') {
      return res.json({
        signals: rankSignals(REAL_SIGNALS),
        count: REAL_SIGNALS.length,
        timestamp: new Date().toISOString()
      });
    }

    // GET /weak-signals
    if (method === 'GET' && path === '/weak-signals') {
      const weak = [
        { topic: 'Edge AI', sources: ['arxiv', 'github'], signals_7d: 3, signals_30d: 8 },
        { topic: 'Neuromorphic', sources: ['arxiv'], signals_7d: 2, signals_30d: 5 },
        { topic: 'Synthetic Bio', sources: ['github', 'reddit'], signals_7d: 4, signals_30d: 12 }
      ].map(s => ({
        topic: s.topic,
        stage: 'weak',
        confidence: 0.3 + Math.random() * 0.4,
        weak_signal_score: 0.3 + Math.random() * 0.4,
        novelty: 0.5 + Math.random() * 0.5,
        velocity: s.signals_7d / s.signals_30d,
        velocity_state: s.signals_7d > s.signals_30d * 0.5 ? 'early_growth' : 'new',
        source_count: s.sources.length,
        sources: s.sources,
        updated_at: new Date().toISOString()
      })).sort((a, b) => b.weak_signal_score - a.weak_signal_score);

      return res.json({
        weak_signals: weak,
        count: weak.length,
        timestamp: new Date().toISOString()
      });
    }

    // GET /watchlist
    if (method === 'GET' && path === '/watchlist') {
      return res.json({ watchlist: WATCHLIST, count: WATCHLIST.length });
    }

    // POST /watchlist
    if (method === 'POST' && path === '/watchlist') {
      const data = req.body || {};
      const id = `watch_${Date.now()}`;
      const item = {
        id,
        topic: data.topic,
        stage: data.stage || 'emerging',
        confidence: data.confidence || 0.5,
        created_at: new Date().toISOString()
      };
      WATCHLIST.push(item);
      return res.json({ success: true, watch_id: id, item });
    }

    // DELETE /watchlist/:id
    if (method === 'DELETE' && path.startsWith('/watchlist/')) {
      const id = path.split('/')[2];
      const idx = WATCHLIST.findIndex(w => w.id === id);
      if (idx > -1) WATCHLIST.splice(idx, 1);
      return res.json({ success: true });
    }

    // GET /alerts
    if (method === 'GET' && path === '/alerts') {
      const alerts = WATCHLIST.map(w => ({
        id: `alert_${Date.now()}_${w.id}`,
        watch_id: w.id,
        topic: w.topic,
        type: 'stage_change',
        message: `${w.topic} 状态已更新`,
        timestamp: new Date().toISOString(),
        read: false
      }));

      if (alerts.length === 0) {
        alerts.push(
          { id: 'alert_1', topic: 'AI Agents', type: 'stage_change', message: 'AI Agents 进入加速阶段', timestamp: new Date().toISOString(), read: false },
          { id: 'alert_2', topic: 'GPU Shortage', type: 'confidence_change', message: 'GPU Shortage 置信度上升至 94%', timestamp: new Date(Date.now() - 3600000).toISOString(), read: false }
        );
      }

      return res.json({ alerts, count: alerts.length });
    }

    // GET /events
    if (method === 'GET' && path === '/events') {
      const events = REAL_SIGNALS.map((s, i) => ({
        event_id: `evt_${i + 1}`,
        topic: s.topic,
        title: s.topic,
        stage: s.stage,
        probability: Math.round(s.confidence * 100),
        evidence_count: s.evidenceCount,
        updated_at: new Date().toISOString()
      }));
      return res.json({ events, count: events.length });
    }

    // GET /health
    if (method === 'GET' && path === '/health') {
      return res.json({ status: 'healthy', timestamp: new Date().toISOString(), watchlist_count: WATCHLIST.length });
    }

    return res.status(404).json({ error: 'Not found', path });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
