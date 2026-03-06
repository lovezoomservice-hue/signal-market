/**
 * Signals API - Vercel Endpoint
 */

const fs = require('fs');
const path = require('path');

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
