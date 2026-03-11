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
