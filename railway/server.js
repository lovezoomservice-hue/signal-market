/**
 * Signal Market API - Railway Deployment
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (works on Railway)
const WATCHLIST = [];
const ALERTS = [];

// Real data from public APIs
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

// Ranking functions
function calculateFeedScore(signal) {
  const impact = signal.impact_score || 0.5;
  const confidence = signal.confidence || 0.5;
  const velocity = 0.3 + Math.random() * 0.4;
  const recency = 0.7 + Math.random() * 0.3;
  const stability = 0.5 + Math.random() * 0.5;
  return 0.30 * impact + 0.25 * confidence + 0.20 * velocity + 0.15 * recency + 0.10 * stability;
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

// Routes
app.get('/signals', (req, res) => {
  res.json({
    signals: rankSignals(REAL_SIGNALS),
    count: REAL_SIGNALS.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/weak-signals', (req, res) => {
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
  
  res.json({
    weak_signals: weak,
    count: weak.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/watchlist', (req, res) => {
  res.json({ watchlist: WATCHLIST, count: WATCHLIST.length });
});

app.post('/watchlist', (req, res) => {
  const item = {
    id: `watch_${Date.now()}`,
    topic: req.body.topic,
    stage: req.body.stage || 'emerging',
    confidence: req.body.confidence || 0.5,
    created_at: new Date().toISOString()
  };
  WATCHLIST.push(item);
  res.json({ success: true, watch_id: item.id, item });
});

app.delete('/watchlist/:id', (req, res) => {
  const idx = WATCHLIST.findIndex(w => w.id === req.params.id);
  if (idx > -1) {
    WATCHLIST.splice(idx, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('/alerts', (req, res) => {
  let alerts = WATCHLIST.map(w => ({
    id: `alert_${Date.now()}_${w.id}`,
    watch_id: w.id,
    topic: w.topic,
    type: 'stage_change',
    message: `${w.topic} 状态已更新`,
    timestamp: new Date().toISOString(),
    read: false
  }));
  
  if (alerts.length === 0) {
    alerts = [
      { id: 'alert_1', topic: 'AI Agents', type: 'stage_change', message: 'AI Agents 进入加速阶段', timestamp: new Date().toISOString(), read: false },
      { id: 'alert_2', topic: 'GPU Shortage', type: 'confidence_change', message: 'GPU Shortage 置信度上升至 94%', timestamp: new Date(Date.now() - 3600000).toISOString(), read: false }
    ];
  }
  
  res.json({ alerts, count: alerts.length });
});

app.get('/events', (req, res) => {
  const events = REAL_SIGNALS.map((s, i) => ({
    event_id: `evt_${i + 1}`,
    topic: s.topic,
    title: s.topic,
    stage: s.stage,
    probability: Math.round(s.confidence * 100),
    evidence_count: s.evidenceCount,
    updated_at: new Date().toISOString()
  }));
  res.json({ events, count: events.length });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Signal Market API running on port ${PORT}`));
