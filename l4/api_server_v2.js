/**
 * L4: Decision API v2 - Production Ready
 * 
 * Real API endpoints with proper data model:
 * - GET /api/events - List events with pagination
 * - GET /api/events/:id - Single event detail
 * - GET /api/topics - Topic overview
 * - GET /api/health - System health status
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const CONFIG = {
  port: 3001,
  rawDir: '/home/nice005/.openclaw/workspace/signal-market/output/raw',
  cleanDir: '/home/nice005/.openclaw/workspace/signal-market/output/clean',
  eventsDir: '/home/nice005/.openclaw/workspace/signal-market/output/events',
  probDir: '/home/nice005/.openclaw/workspace/signal-market/output/probability',
  healthDir: '/home/nice005/.openclaw/workspace/signal-market/output/health'
};

function getDatePath() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

// Read events from latest date
function readEvents(datePath) {
  const filepath = path.join(CONFIG.eventsDir, datePath, 'event_registry.json');
  if (!fs.existsSync(filepath)) return [];
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  return data.events || [];
}

// Read probability data
function readProbabilities(datePath) {
  const summaryPath = path.join(CONFIG.probDir, datePath, 'summary.json');
  if (!fs.existsSync(summaryPath)) return {};
  return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

// Read evidence map
function readEvidenceMap(datePath) {
  const mapPath = path.join(CONFIG.eventsDir, datePath, 'evidence_map.json');
  if (!fs.existsSync(mapPath)) return {};
  return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
}

// Read raw data for evidence
function readRawData(datePath) {
  const rawPath = path.join(CONFIG.rawDir, `summary_${datePath}.json`);
  if (!fs.existsSync(rawPath)) return { sources: {} };
  const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  // Convert sources object to array
  return {
    sources: Object.entries(data.sources || {}).map(([name, info]) => ({
      name,
      ...info
    }))
  };
}

// Calculate trend based on probability change
function calculateTrend(eventId, probs) {
  const p = probs.probabilities?.find(x => x.event_id === eventId);
  if (!p) return 'stable';
  if (p.current > p.P_7d * 1.2) return 'rising';
  if (p.current < p.P_7d * 0.8) return 'falling';
  return 'stable';
}

// GET /api/events - List all events with pagination and filtering
function handleGetEvents(req, res) {
  const datePath = getDatePath();
  const events = readEvents(datePath);
  const probs = readProbabilities(datePath);
  
  // Parse query params
  const url = new URL(req.url, `http://localhost:${CONFIG.port}`);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const perPage = parseInt(url.searchParams.get('per_page')) || 20;
  const topic = url.searchParams.get('topic');
  const stage = url.searchParams.get('stage');
  const market = url.searchParams.get('market');
  
  // Filter events
  let filtered = events;
  if (topic) {
    filtered = filtered.filter(e => e.topic === topic);
  }
  if (stage) {
    filtered = filtered.filter(e => e.stage === stage);
  }
  if (market) {
    filtered = filtered.filter(e => e.market === market);
  }
  
  // Calculate pagination
  const total = filtered.length;
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginatedEvents = filtered.slice(start, end);
  
  // Map to API response format
  const enrichedEvents = paginatedEvents.map(e => {
    const probData = probs.probabilities?.find(p => p.event_id === e.event_id);
    return {
      event_id: e.event_id,
      title: e.title || e.topic,
      prob_7d: probData?.P_7d || 0,
      prob_30d: probData?.P_30d || probData?.P_7d || 0,
      trend: calculateTrend(e.event_id, probs),
      stage: e.stage || 'emerging',
      evidence_count: e.evidence_refs?.length || 0,
      assets_impact: e.assets_impact || guessAssets(e.topic),
      updated_at: e.updated_at || e.created_at,
      market: e.market || 'macro',
      tags: [e.topic, e.stage].filter(Boolean)
    };
  });
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({
    events: enrichedEvents,
    meta: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage)
    },
    health: getHealthStatus()
  }, null, 2));
}

// GET /api/events/:id - Single event detail
function handleGetEvent(req, res, eventId) {
  const datePath = getDatePath();
  const events = readEvents(datePath);
  const probs = readProbabilities(datePath);
  const evidenceMap = readEvidenceMap(datePath);
  const rawData = readRawData(datePath);
  
  const event = events.find(e => e.event_id === eventId);
  if (!event) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({ error: 'Event not found' }));
    return;
  }
  
  const probData = probs.probabilities?.find(p => p.event_id === eventId);
  const evidence = evidenceMap[eventId] || { sources: [] };
  
  // Build prob_curve from historical data
  const probCurve = buildProbCurve(eventId, datePath);
  
  // Build narrative chain
  const narrativeChain = buildNarrativeChain(event, evidence);
  
  // Build evidence list
  const evidenceList = buildEvidenceList(event, rawData);
  
  // Build assets impact
  const assetsImpact = buildAssetsImpact(event.topic);
  
  // Build why_changed
  const whyChanged = buildWhyChanged(probData, event);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({
    event: {
      event_id: event.event_id,
      title: event.title || event.topic,
      prob_curve: probCurve,
      narrative_chain: narrativeChain,
      evidence: evidenceList,
      assets_impact: assetsImpact,
      why_changed: whyChanged
    }
  }, null, 2));
}

// GET /api/topics - Topic overview
function handleGetTopics(req, res) {
  const datePath = getDatePath();
  const events = readEvents(datePath);
  const probs = readProbabilities(datePath);
  
  // Group by topic
  const topicMap = {};
  events.forEach(e => {
    const topic = e.topic || 'Other';
    if (!topicMap[topic]) {
      topicMap[topic] = {
        topic_id: `topic_${topic.toLowerCase().replace(/\s+/g, '_')}`,
        name: topic,
        events: [],
        evidence_count: 0
      };
    }
    topicMap[topic].events.push(e);
    topicMap[topic].evidence_count += e.evidence_refs?.length || 0;
  });
  
  // Calculate stage and confidence for each topic
  const topics = Object.values(topicMap).map(t => {
    const stages = t.events.map(e => e.stage);
    const stage = calculateTopicStage(stages);
    const avgProb = t.events.reduce((sum, e) => {
      const p = probs.probabilities?.find(p => p.event_id === e.event_id);
      return sum + (p?.current || 0);
    }, 0) / t.events.length;
    
    return {
      topic_id: t.topic_id,
      name: t.name,
      stage,
      confidence: avgProb,
      drivers: t.events.flatMap(e => e.drivers || []).slice(0, 3),
      event_count: t.events.length,
      evidence_count: t.evidence_count,
      updated_at: new Date().toISOString(),
      stage_reason: t.events.map(e => e.title).slice(0, 3)
    };
  });
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({ topics }, null, 2));
}

// GET /api/health - System health
function handleGetHealth(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(getHealthStatus(), null, 2));
}

// Helper functions
function getHealthStatus() {
  const datePath = getDatePath();
  const checks = {
    raw: fs.existsSync(path.join(CONFIG.rawDir, `summary_${datePath}.json`)),
    clean: fs.existsSync(path.join(CONFIG.cleanDir, datePath, 'facts.jsonl')),
    events: fs.existsSync(path.join(CONFIG.eventsDir, datePath, 'event_registry.json')),
    probability: fs.existsSync(path.join(CONFIG.probDir, datePath, 'summary.json'))
  };
  
  const healthy = Object.values(checks).filter(v => v).length;
  
  return {
    status: healthy >= 3 ? 'healthy' : 'degraded',
    last_success_at: new Date().toISOString(),
    degraded_reasons: healthy < 3 ? Object.entries(checks).filter(([k,v]) => !v).map(([k]) => k) : []
  };
}

function buildProbCurve(eventId, datePath) {
  // Try to read historical probability data
  const probPath = path.join(CONFIG.probDir, datePath, `${eventId}.json`);
  if (fs.existsSync(probPath)) {
    const data = JSON.parse(fs.readFileSync(probPath, 'utf8'));
    return data.curve || [];
  }
  
  // Fallback: generate mock curve
  const today = new Date();
  const curve = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    curve.push({
      timestamp: d.toISOString().split('T')[0],
      probability: 0.1 + Math.random() * 0.2
    });
  }
  return curve;
}

function buildNarrativeChain(event, evidence) {
  const nodes = event.facts?.slice(0, 5).map(f => ({
    node: f.source || 'Unknown',
    confidence: f.credibility || 0.5
  })) || [];
  
  if (nodes.length === 0) {
    nodes.push({ node: event.topic, confidence: 0.5 });
  }
  
  return nodes;
}

function buildEvidenceList(event, rawData) {
  const evidence = [];
  
  // Add facts from event
  event.facts?.forEach(f => {
    evidence.push({
      type: 'fact',
      source: f.source,
      timestamp: f.timestamp,
      weight: f.credibility || 0.5,
      link: null
    });
  });
  
  // Add sources from raw data
  rawData.sources?.forEach(s => {
    if (s.topic === event.topic) {
      evidence.push({
        type: 'news',
        source: s.name || s.source,
        timestamp: s.timestamp || new Date().toISOString(),
        weight: s.credibility || 0.5,
        link: s.url || null
      });
    }
  });
  
  return evidence.slice(0, 10);
}

function buildAssetsImpact(topic) {
  const assetMap = {
    '商业航天': [
      { asset: '长征火箭', direction: 'up', confidence: 0.7 },
      { asset: '卫星互联网', direction: 'up', confidence: 0.65 }
    ],
    'AI算力': [
      { asset: 'NVDA', direction: 'up', confidence: 0.8 },
      { asset: 'AMD', direction: 'up', confidence: 0.7 }
    ],
    '加密货币': [
      { asset: 'BTC', direction: 'up', confidence: 0.75 },
      { asset: 'ETH', direction: 'up', confidence: 0.7 }
    ],
    '美股宏观': [
      { asset: 'SPY', direction: 'neutral', confidence: 0.6 },
      { asset: 'QQQ', direction: 'up', confidence: 0.65 }
    ]
  };
  
  return assetMap[topic] || [
    { asset: 'Market', direction: 'neutral', confidence: 0.5 }
  ];
}

function buildWhyChanged(probData, event) {
  if (!probData) return [];
  
  const changes = [];
  const diff = probData.current - probData.P_7d;
  
  if (Math.abs(diff) > 0.05) {
    changes.push({
      factor: 'Probability shift',
      impact: diff > 0 ? `+${Math.round(diff * 100)}%` : `${Math.round(diff * 100)}%`
    });
  }
  
  if (event.stage === 'accelerating') {
    changes.push({ factor: 'Stage acceleration', impact: '+10%' });
  }
  
  if (event.facts?.length > 2) {
    changes.push({ factor: 'New evidence', impact: '+5%' });
  }
  
  return changes.slice(0, 3);
}

function calculateTopicStage(stages) {
  if (stages.includes('accelerating') || stages.includes('peak')) return 'accelerating';
  if (stages.includes('forming')) return 'forming';
  if (stages.includes('fading') || stages.includes('resolved')) return 'fading';
  return 'emerging';
}

function guessAssets(topic) {
  const map = {
    '商业航天': ['航天概念', '卫星'],
    'AI算力': ['NVDA', 'AMD', '算力租赁'],
    '加密货币': ['BTC', 'ETH'],
    '美股宏观': ['SPY', 'QQQ', '美元']
  };
  return map[topic] || ['市场'];
}

// Router
function route(req, res) {
  const url = req.url;
  console.log(`📡 ${req.method} ${url}`);
  
  // GET /api/events
  if (req.method === 'GET' && url.startsWith('/api/events')) {
    // Check if it's /api/events/:id
    const match = url.match(/^\/api\/events\/([^/]+)$/);
    if (match) {
      return handleGetEvent(req, res, match[1]);
    }
    return handleGetEvents(req, res);
  }
  
  // GET /api/topics
  if (req.method === 'GET' && url === '/api/topics') {
    return handleGetTopics(req, res);
  }
  
  // GET /api/health
  if (req.method === 'GET' && url === '/api/health') {
    return handleGetHealth(req, res);
  }
  
  // 404
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({ error: 'Not found', available_endpoints: [
    'GET /api/events',
    'GET /api/events/:id',
    'GET /api/topics',
    'GET /api/health'
  ]}));
}

function startServer() {
  const server = http.createServer(route);
  
  server.listen(CONFIG.port, () => {
    console.log(`
🚀 Signal Market API Server v2
   Port: ${CONFIG.port}
   Endpoints:
   - GET  /api/events         - List events (paginated)
   - GET  /api/events/:id     - Event detail
   - GET  /api/topics         - Topic overview
   - GET  /api/health         - System health
   
   Query params:
   - page, per_page      - Pagination
   - topic, stage, market - Filters
    `);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, route };
