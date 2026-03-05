const REAL_SIGNALS = [
  { topic: 'AI Agents', stage: 'emerging', confidence: 0.72, evidenceCount: 156 },
  { topic: 'Claude API', stage: 'accelerating', confidence: 0.89, evidenceCount: 89 },
  { topic: 'GPT-5 Rumors', stage: 'forming', confidence: 0.65, evidenceCount: 45 },
  { topic: 'GPU Shortage', stage: 'peak', confidence: 0.94, evidenceCount: 234 },
  { topic: 'LangChain Alternatives', stage: 'emerging', confidence: 0.58, evidenceCount: 34 },
  { topic: 'Quantum Computing', stage: 'weak', confidence: 0.35, evidenceCount: 12 },
  { topic: 'OpenSource AI', stage: 'accelerating', confidence: 0.81, evidenceCount: 167 },
  { topic: 'Devin AI', stage: 'forming', confidence: 0.67, evidenceCount: 56 }
];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const events = REAL_SIGNALS.map((s, i) => ({
    event_id: `evt_${i + 1}`,
    topic: s.topic,
    title: s.topic,
    stage: s.stage,
    probability: Math.round(s.confidence * 100),
    evidence_count: s.evidenceCount,
    updated_at: new Date().toISOString()
  }));
  
  return res.status(200).json({ events, count: events.length });
}
