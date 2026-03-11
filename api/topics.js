/**
 * Topics API - Vercel Endpoint
 * GET /api/topics
 */

const SIGNALS = [
  { topic: 'AI Agents',           stage: 'emerging',     category: 'AI Infrastructure', signal_count: 156, trend_score: 0.87 },
  { topic: 'Claude API',          stage: 'accelerating', category: 'AI Models',         signal_count: 89,  trend_score: 0.91 },
  { topic: 'GPT-5 Rumors',        stage: 'forming',      category: 'AI Models',         signal_count: 45,  trend_score: 0.72 },
  { topic: 'GPU Shortage',        stage: 'peak',         category: 'Hardware',          signal_count: 234, trend_score: 0.94 },
  { topic: 'LangChain Alternatives', stage: 'emerging',  category: 'AI Tooling',        signal_count: 34,  trend_score: 0.62 },
  { topic: 'Quantum Computing',   stage: 'weak',         category: 'Emerging Tech',     signal_count: 12,  trend_score: 0.38 },
  { topic: 'OpenSource AI',       stage: 'accelerating', category: 'AI Models',         signal_count: 167, trend_score: 0.84 },
  { topic: 'Devin AI',            stage: 'forming',      category: 'AI Agents',         signal_count: 56,  trend_score: 0.70 },
];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { category, stage } = req.query || {};

  let topics = SIGNALS.map(s => ({
    id: s.topic.toLowerCase().replace(/\s+/g, '-'),
    topic: s.topic,
    category: s.category,
    stage: s.stage,
    signal_count: s.signal_count,
    trend_score: s.trend_score,
    last_updated: new Date().toISOString(),
  }));

  if (category) topics = topics.filter(t => t.category.toLowerCase().includes(category.toLowerCase()));
  if (stage)    topics = topics.filter(t => t.stage === stage);

  topics.sort((a, b) => b.trend_score - a.trend_score);

  return res.status(200).json({
    topics,
    count: topics.length,
    categories: [...new Set(SIGNALS.map(s => s.category))],
    stages: ['weak', 'forming', 'emerging', 'accelerating', 'peak'],
    timestamp: new Date().toISOString(),
  });
}
