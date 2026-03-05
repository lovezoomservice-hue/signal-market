/**
 * Signal Market API - Cloudflare Workers
 * Using in-memory storage for demo (D1 setup pending)
 */

// In-memory storage (persists during worker lifetime)
const WATCHLIST = new Map();

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response('', { headers: corsHeaders });
    }

    try {
      // GET /signals
      if (method === 'GET' && path === '/signals') {
        return new Response(JSON.stringify({ 
          signals: rankSignals(REAL_SIGNALS), 
          count: REAL_SIGNALS.length, 
          timestamp: new Date().toISOString() 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
        
        return new Response(JSON.stringify({ 
          weak_signals: weak, 
          count: weak.length, 
          timestamp: new Date().toISOString() 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // GET /watchlist
      if (method === 'GET' && path === '/watchlist') {
        const items = Array.from(WATCHLIST.values());
        return new Response(JSON.stringify({ 
          watchlist: items, 
          count: items.length 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // POST /watchlist
      if (method === 'POST' && path === '/watchlist') {
        const data = await request.json();
        const id = `watch_${Date.now()}`;
        const item = {
          id,
          topic: data.topic,
          stage: data.stage || 'emerging',
          confidence: data.confidence || 0.5,
          created_at: new Date().toISOString()
        };
        WATCHLIST.set(id, item);
        
        return new Response(JSON.stringify({ 
          success: true, 
          watch_id: id, 
          item 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // DELETE /watchlist/:id
      if (method === 'DELETE' && path.startsWith('/watchlist/')) {
        const id = path.split('/')[2];
        WATCHLIST.delete(id);
        
        return new Response(JSON.stringify({ success: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // GET /alerts
      if (method === 'GET' && path === '/alerts') {
        const items = Array.from(WATCHLIST.values());
        const alerts = items.map(w => ({
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
        
        return new Response(JSON.stringify({ alerts, count: alerts.length }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
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
        return new Response(JSON.stringify({ events, count: events.length }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // GET /health
      if (method === 'GET' && path === '/health') {
        return new Response(JSON.stringify({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          watchlist_count: WATCHLIST.size
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Not found', path }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }
};
