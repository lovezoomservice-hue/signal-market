/**
 * /api/topics/:id/stage — M7
 * Vercel: /api/topics?id=ai-agents&action=stage
 * Also handles: /api/topics/ai-agents/stage via URL parsing
 */

const TOPICS = {
  'ai-agents':          { topic: 'AI Agents',          stage: 'accelerating', confidence: 0.97, trend_score: 0.93 },
  'llm-infrastructure': { topic: 'LLM Infrastructure', stage: 'accelerating', confidence: 0.92, trend_score: 0.89 },
  'ai-coding':          { topic: 'AI Coding',           stage: 'accelerating', confidence: 0.93, trend_score: 0.94 },
  'ai-reasoning':       { topic: 'AI Reasoning',        stage: 'forming',      confidence: 0.78, trend_score: 0.76 },
  'multimodal-ai':      { topic: 'Multimodal AI',       stage: 'forming',      confidence: 0.75, trend_score: 0.73 },
  'transformer-arch':   { topic: 'Transformer Arch',    stage: 'peak',         confidence: 0.72, trend_score: 0.71 },
  'ai-benchmarking':    { topic: 'AI Benchmarking',     stage: 'forming',      confidence: 0.71, trend_score: 0.70 },
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Parse /api/topics/<id>/stage from URL
  const parts = req.url.replace(/\?.*/, '').split('/').filter(Boolean);
  // parts: ['api','topics','ai-agents','stage'] or ['api','topics','ai-agents']
  const topicId = parts[2] || req.query?.id;
  const wantStage = parts[3] === 'stage' || req.query?.action === 'stage';

  if (!topicId || topicId === 'index') {
    return res.status(400).json({ error: 'topic id required' });
  }

  const t = TOPICS[topicId];
  if (!t) return res.status(404).json({ error: 'Topic not found', id: topicId, available: Object.keys(TOPICS) });

  if (wantStage) {
    return res.status(200).json({
      id:         topicId,
      topic:      t.topic,
      stage:      t.stage,
      confidence: t.confidence,
      trend_score: t.trend_score,
      updated_at: new Date().toISOString(),
    });
  }

  return res.status(200).json({ id: topicId, ...t, updated_at: new Date().toISOString() });
}
