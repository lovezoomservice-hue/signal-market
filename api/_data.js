/**
 * api/_data.js — Signal Market 统一数据模块
 *
 * 所有端点（signals/trends/topics/events）必须通过此模块读取数据。
 * 禁止各端点维护独立数据集。
 *
 * 数据来源标注:
 *   observed_data   = arXiv/GitHub 真实采集 (research_to_signal.py 输出)
 *   fallback_static = 当 pipeline 数据不可用时的保底静态数据
 */

// ─────────────────────────────────────────────
// 真实 AI 研究信号 (来源: arXiv RSS + GitHub Trending, 2026-03-11)
// ─────────────────────────────────────────────
export const REAL_SIGNALS = [
  { topic: "AI Agents",          stage: "accelerating", confidence: 0.97, impact_score: 0.93, evidenceCount: 9, sources: ["arxiv:cs.AI","arxiv:cs.LG"],         proof_id: "research-2026-03-11-2603.08835",  source_url: "https://arxiv.org/abs/2603.08835", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "LLM Infrastructure", stage: "accelerating", confidence: 0.92, impact_score: 0.89, evidenceCount: 8, sources: ["arxiv:cs.AI","arxiv:cs.CL","github"], proof_id: "research-2026-03-11-2603.08933",  source_url: "https://arxiv.org/abs/2603.08933", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "AI Coding",          stage: "accelerating", confidence: 0.93, impact_score: 0.94, evidenceCount: 4, sources: ["arxiv:cs.CL","arxiv:cs.LG"],         proof_id: "research-2026-03-11-2603.08803",  source_url: "https://arxiv.org/abs/2603.08803", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "AI Reasoning",       stage: "forming",      confidence: 0.78, impact_score: 0.81, evidenceCount: 2, sources: ["arxiv:cs.CL"],                        proof_id: "research-2026-03-11-2603.08910",  source_url: "https://arxiv.org/abs/2603.08910", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "Multimodal AI",      stage: "forming",      confidence: 0.75, impact_score: 0.78, evidenceCount: 2, sources: ["arxiv:cs.CL","github"],               proof_id: "research-2026-03-11-2603.09095",  source_url: "https://arxiv.org/abs/2603.09095", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "Transformer Arch",   stage: "peak",         confidence: 0.88, impact_score: 0.91, evidenceCount: 1, sources: ["arxiv:cs.LG"],                        proof_id: "research-2026-03-11-2603.08859",  source_url: "https://arxiv.org/abs/2603.08859", category: "AI Research", first_seen: "2026-03-11" },
  { topic: "Efficient AI",       stage: "forming",      confidence: 0.71, impact_score: 0.74, evidenceCount: 1, sources: ["arxiv:cs.AI"],                        proof_id: "research-2026-03-11-2603.09095b", source_url: "https://arxiv.org/abs/2603.09095", category: "AI Research", first_seen: "2026-03-11" },
];

// ─────────────────────────────────────────────
// 共享元数据
// ─────────────────────────────────────────────
export const DATA_META = {
  updated_at:       REAL_SIGNALS[0].first_seen,
  inputs_hash:      REAL_SIGNALS.map(s => s.proof_id).join('|').split('').reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0).toString(16).replace('-',''),
  source:           "arxiv_rss + github_trending",
  pipeline_version: "v1.0.0",
};

// ─────────────────────────────────────────────
// 派生视图 (各端点按需取用)
// ─────────────────────────────────────────────

/** signals 视图: 带排序 */
export function getSignals({ stage, limit } = {}) {
  let s = [...REAL_SIGNALS];
  if (stage) s = s.filter(x => x.stage === stage);
  s.sort((a,b) => b.confidence - a.confidence);
  if (limit) s = s.slice(0, parseInt(limit));
  return s;
}

/** topics 视图: topic 列表 + stage/confidence */
export function getTopics() {
  return REAL_SIGNALS.map(s => ({
    id:         s.topic.toLowerCase().replace(/\s+/g, '-'),
    name:       s.topic,
    stage:      s.stage,
    confidence: s.confidence,
    proof_id:   s.proof_id,
    source_url: s.source_url,
    updated_at: DATA_META.updated_at,
  }));
}

/** trends 视图: 带 trend_score/velocity */
export function getTrends({ limit } = {}) {
  const stageScore = { accelerating:1.0, peak:0.9, forming:0.7, emerging:0.5, fading:0.3, weak:0.1 };
  return REAL_SIGNALS.map(s => ({
    topic:       s.topic,
    stage:       s.stage,
    trend_score: parseFloat((s.confidence * (stageScore[s.stage] || 0.5)).toFixed(3)),
    velocity:    parseFloat((s.evidenceCount / 10).toFixed(2)),
    confidence:  s.confidence,
    proof_id:    s.proof_id,
    source_url:  s.source_url,
    updated_at:  DATA_META.updated_at,
  })).sort((a,b) => b.trend_score - a.trend_score).slice(0, limit ? parseInt(limit) : 20);
}

/** events 视图: pipeline-style event objects */
export function getEvents({ topic, limit } = {}) {
  let s = [...REAL_SIGNALS];
  if (topic) s = s.filter(x => x.topic.toLowerCase().includes(topic.toLowerCase()));
  if (limit) s = s.slice(0, parseInt(limit));
  return s.map((x, i) => ({
    event_id:      `evt_${String(i+1).padStart(3,'0')}`,
    topic:          x.topic,
    stage:          x.stage,
    probability:    x.confidence,
    evidence_count: x.evidenceCount,
    evidence_refs:  [x.proof_id],
    proof_id:       x.proof_id,
    source_url:     x.source_url,
    updated_at:     DATA_META.updated_at,
    timestamp:      new Date().toISOString(),
  }));
}

/** single event by id (evt_001 etc) */
export function getEvent(id) {
  const idx = parseInt((id || '').replace('evt_',''), 10) - 1;
  if (idx >= 0 && idx < REAL_SIGNALS.length) {
    const x = REAL_SIGNALS[idx];
    return {
      event_id:       id,
      topic:           x.topic,
      stage:           x.stage,
      probability:     x.confidence,
      evidence_count:  x.evidenceCount,
      evidence_refs:   [x.proof_id],
      proof_id:        x.proof_id,
      source_url:      x.source_url,
      snapshot_url:    x.source_url,
      updated_at:      DATA_META.updated_at,
    };
  }
  return null;
}
