/**
 * /api/events/:id — Vercel dynamic route (subpath)
 * Redirects to /api/events?id=:id
 */
export default function handler(req, res) {
  const id = req.url.split('/').pop().split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!id || id === 'index') return res.redirect('/api/events');

  // inline event lookup (same data as events.js)
  const SIGNALS = [
    { topic: 'AI Agents',          stage: 'accelerating', confidence: 0.97, evidenceCount: 9,  proof_id: 'research-2026-03-11-2603.08835', source_url: 'https://arxiv.org/abs/2603.08835' },
    { topic: 'LLM Infrastructure', stage: 'accelerating', confidence: 0.92, evidenceCount: 8,  proof_id: 'research-2026-03-11-2603.08933', source_url: 'https://arxiv.org/abs/2603.08933' },
    { topic: 'AI Coding',          stage: 'accelerating', confidence: 0.93, evidenceCount: 4,  proof_id: 'research-2026-03-11-2603.08803', source_url: 'https://arxiv.org/abs/2603.08803' },
    { topic: 'AI Reasoning',       stage: 'forming',      confidence: 0.78, evidenceCount: 2,  proof_id: 'research-2026-03-11-2603.08910', source_url: 'https://arxiv.org/abs/2603.08910' },
    { topic: 'Multimodal AI',      stage: 'forming',      confidence: 0.75, evidenceCount: 2,  proof_id: 'research-2026-03-11-2603.09095', source_url: 'https://arxiv.org/abs/2603.09095' },
    { topic: 'Transformer Arch',   stage: 'peak',         confidence: 0.72, evidenceCount: 1,  proof_id: 'research-2026-03-11-2603.08859', source_url: 'https://arxiv.org/abs/2603.08859' },
    { topic: 'AI Benchmarking',    stage: 'forming',      confidence: 0.71, evidenceCount: 1,  proof_id: 'research-2026-03-11-2603.08879', source_url: 'https://arxiv.org/abs/2603.08879' },
  ];
  const EVENTS = SIGNALS.map((s,i)=>({
    event_id: `evt_${String(i+1).padStart(3,'0')}`, topic: s.topic,
    title: `${s.topic} — ${s.stage} signal`,
    stage: s.stage, probability: Math.round(s.confidence*100),
    confidence: s.confidence, evidence_count: s.evidenceCount,
    proof_id: s.proof_id, source_url: s.source_url,
    updated_at: new Date().toISOString(),
  }));
  const ev = EVENTS.find(e => e.event_id === id);
  if (!ev) return res.status(404).json({ error: 'Event not found', event_id: id });
  return res.status(200).json({ ...ev,
    evidence: [{ ref: ev.proof_id, url: ev.source_url, type: 'arxiv_paper' }],
    snapshot_url: ev.source_url,
  });
}
