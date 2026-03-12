/**
 * API Docs - Vercel Endpoint
 * GET /api/docs  →  OpenAPI-compatible spec
 */

const SPEC = {
  openapi: "3.0.0",
  info: {
    title: "Signal Market API",
    version: "4.0.0",
    description: "AI/Tech trend signal intelligence. Data updated daily from arXiv + GitHub Trending.",
    contact: { email: "support@signal.market" },
  },
  servers: [{ url: "https://signal-market-z14d.vercel.app", description: "Production" }],
  paths: {
    "/api/health":  {
      get: { summary: "Health check", responses: { "200": { description: "OK" } } }
    },
    "/api/signals": {
      get: {
        summary: "Get ranked signals",
        description: "Returns trend signals with proof_id, source_url, evidence_count, updated_at, inputs_hash.",
        parameters: [
          { name: "stage", in: "query", schema: { type: "string", enum: ["weak","forming","emerging","accelerating","peak"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          "200": {
            description: "Signal list",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                signals:     { type: "array" },
                count:       { type: "integer" },
                updated_at:  { type: "string", format: "date" },
                inputs_hash: { type: "string" },
                timestamp:   { type: "string", format: "date-time" },
              }
            }}}
          }
        }
      }
    },
    "/api/v2/rank": {
      get: {
        summary: "Agent signal ranking — what to act on RIGHT NOW",
        description: "Returns signals ranked by agent actionability score. Score = (urgency × 0.4) + (confidence × 0.35) + (impact × 0.25) + stage_boost",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 50 }, description: "Number of signals to return (max 50)" },
          { name: "min_confidence", in: "query", schema: { type: "number", minimum: 0, maximum: 1 }, description: "Filter by minimum confidence threshold" },
          { name: "stage", in: "query", schema: { type: "string" }, description: "Filter by stage(s), comma-separated (accelerating,forming,emerging)" },
          { name: "urgency", in: "query", schema: { type: "string" }, description: "Filter by urgency level(s), comma-separated (high,medium,low)" },
          { name: "topic", in: "query", schema: { type: "string" }, description: "Filter by topic (partial match, case-insensitive)" },
        ],
        responses: {
          "200": {
            description: "Ranked signals with agent actionability scores",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                ranked: { type: "array", items: {
                  type: "object",
                  properties: {
                    signal_id: { type: "string" },
                    topic: { type: "string" },
                    stage: { type: "string" },
                    confidence: { type: "number" },
                    urgency: { type: "string" },
                    agent_score: { type: "number" },
                    rank: { type: "integer" },
                    agent_action: { type: "string" },
                    next_best_action: { type: "string" },
                    decision_question: { type: "string" },
                    window: { type: "string" },
                  }
                }},
                total: { type: "integer" },
                generated_at: { type: "string", format: "date-time" },
              }
            }}}
          }
        }
      }
    },
    "/api/v2/compare": {
      get: {
        summary: "Side-by-side signal comparison",
        description: "Compare 2-5 signals to determine which is more urgent/actionable. Accepts either signal IDs or topic names.",
        parameters: [
          { name: "ids", in: "query", schema: { type: "string" }, description: "Comma-separated signal IDs (e.g., evt_001,evt_002). Up to 5 IDs." },
          { name: "topics", in: "query", schema: { type: "string" }, description: "Comma-separated topic names (e.g., AI Agents,LLM Infrastructure). Up to 5 topics." },
        ],
        responses: {
          "200": {
            description: "Comparison with verdict on which signal to prioritize",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                comparison: { type: "array", items: {
                  type: "object",
                  properties: {
                    signal_id: { type: "string" },
                    topic: { type: "string" },
                    stage: { type: "string" },
                    confidence: { type: "number" },
                    urgency: { type: "string" },
                    window: { type: "string" },
                    agent_action: { type: "string" },
                    next_best_action: { type: "string" },
                    decision_question: { type: "string" },
                    sources: { type: "array", items: { type: "string" } },
                    evidence_count: { type: "integer" },
                  }
                }},
                verdict: {
                  type: "object",
                  properties: {
                    recommended: { type: "string" },
                    recommended_topic: { type: "string" },
                    reason: { type: "string" },
                    relative_urgency: { type: "string" },
                  }
                },
                count: { type: "integer" },
                generated_at: { type: "string", format: "date-time" },
              }
            }}}
          }
        }
      }
    },
    "/api/v2/filter": {
      get: {
        summary: "Structured signal filter",
        description: "Filter signals by stage, urgency, confidence, topic, or source with sorting options.",
        parameters: [
          { name: "stage", in: "query", schema: { type: "string" }, description: "Filter by stage(s), comma-separated (accelerating,forming,emerging,fading,weak)" },
          { name: "urgency", in: "query", schema: { type: "string" }, description: "Filter by urgency level(s), comma-separated (high,medium,low)" },
          { name: "min_confidence", in: "query", schema: { type: "number", minimum: 0, maximum: 1 }, description: "Minimum confidence threshold" },
          { name: "max_confidence", in: "query", schema: { type: "number", minimum: 0, maximum: 1 }, description: "Maximum confidence threshold" },
          { name: "topic", in: "query", schema: { type: "string" }, description: "Filter by topic (partial match, case-insensitive)" },
          { name: "source", in: "query", schema: { type: "string" }, description: "Filter by source(s), comma-separated (arxiv,github,hackernews,etc)" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Number of signals to return (max 100)" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["urgency","confidence","stage","evidence"], default: "urgency" }, description: "Sort order" },
        ],
        responses: {
          "200": {
            description: "Filtered signals with metadata",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                signals: { type: "array", items: {
                  type: "object",
                  properties: {
                    signal_id: { type: "string" },
                    topic: { type: "string" },
                    stage: { type: "string" },
                    confidence: { type: "number" },
                    urgency: { type: "string" },
                    window: { type: "string" },
                    agent_action: { type: "string" },
                    next_best_action: { type: "string" },
                    decision_question: { type: "string" },
                    sources: { type: "array", items: { type: "string" } },
                    evidence_count: { type: "integer" },
                  }
                }},
                filters_applied: { type: "object" },
                count: { type: "integer" },
                total_unfiltered: { type: "integer" },
                generated_at: { type: "string", format: "date-time" },
              }
            }}}
          }
        }
      }
    },
    "/api/trends": {
      get: {
        summary: "Get trend graph",
        description: "Returns sorted trend nodes with trend_score, velocity, momentum, proof_id.",
        responses: { "200": { description: "Trend list" } }
      }
    },
    "/api/topics": {
      get: {
        summary: "List topics",
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "stage",    in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Topic list with categories and stages" } }
      }
    },
    "/api/stats": {
      get: {
        summary: "Platform statistics",
        description: "Signal counts, source list, pipeline last_run, data freshness.",
        responses: { "200": { description: "Stats object" } }
      }
    },
    "/api/pipeline/status": {
      get: {
        summary: "Pipeline status",
        description: "Per-source status, items collected, data age.",
        responses: { "200": { description: "Pipeline status object" } }
      }
    },
  },
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Support both /api/docs (JSON) and ?format=html (simple HTML)
  if (req.query?.format === 'html') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html><html><head><title>Signal Market API</title>
<meta charset="utf-8"><style>body{font-family:monospace;padding:2rem;background:#0d0d0d;color:#e0e0e0}
h1{color:#e83a57}pre{background:#1a1a1a;padding:1rem;border-radius:4px;overflow:auto}</style></head>
<body><h1>Signal Market API v4</h1>
<p>Base: <code>https://signal-market-z14d.vercel.app</code></p>
<h2>Endpoints</h2>
<ul>${Object.entries(SPEC.paths).map(([p,v])=>`<li><strong>GET ${p}</strong> — ${v.get.summary}</li>`).join('')}</ul>
<h2>Full Spec</h2><pre>${JSON.stringify(SPEC,null,2)}</pre></body></html>`);
  }

  return res.status(200).json(SPEC);
}
