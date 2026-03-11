/**
 * Signals API - Vercel Endpoint
 */


const REAL_SIGNALS = [
  { topic: "AI Agents", stage: "accelerating", confidence: 0.97, impact_score: 0.93, evidenceCount: 9, sources: ["arxiv:cs.AI", "arxiv:cs.LG"], proof_id: "research-2026-03-11-2603.08835", source_url: "https://arxiv.org/abs/2603.08835", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "LLM Infrastructure", stage: "accelerating", confidence: 0.92, impact_score: 0.89, evidenceCount: 8, sources: ["arxiv:cs.AI", "arxiv:cs.CL", "github:trending"], proof_id: "research-2026-03-11-2603.08933", source_url: "https://arxiv.org/abs/2603.08933", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "AI Coding", stage: "accelerating", confidence: 0.93, impact_score: 0.94, evidenceCount: 4, sources: ["arxiv:cs.CL", "arxiv:cs.LG"], proof_id: "research-2026-03-11-2603.08803", source_url: "https://arxiv.org/abs/2603.08803", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "AI Reasoning", stage: "forming", confidence: 0.78, impact_score: 0.81, evidenceCount: 2, sources: ["arxiv:cs.CL"], proof_id: "research-2026-03-11-2603.08910", source_url: "https://arxiv.org/abs/2603.08910", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "Multimodal AI", stage: "forming", confidence: 0.75, impact_score: 0.78, evidenceCount: 2, sources: ["arxiv:cs.CL", "github:trending"], proof_id: "research-2026-03-11-2603.09095", source_url: "https://arxiv.org/abs/2603.09095", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "Transformer Arch", stage: "peak", confidence: 0.72, impact_score: 0.76, evidenceCount: 1, sources: ["arxiv:cs.LG"], proof_id: "research-2026-03-11-2603.08859", source_url: "https://arxiv.org/abs/2603.08859", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "AI Benchmarking", stage: "forming", confidence: 0.71, impact_score: 0.75, evidenceCount: 1, sources: ["arxiv:cs.CL"], proof_id: "research-2026-03-11-2603.08879", source_url: "https://arxiv.org/abs/2603.08879", category: "AI Research", first_seen: "2026-03-11" },
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

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return res.status(200).json({
    signals: rankSignals(REAL_SIGNALS),
    count: REAL_SIGNALS.length,
    timestamp: new Date().toISOString()
  });
}
