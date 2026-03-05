/**
 * L4: Decision API - With Auth
 * 
 * 带认证的 API Server
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { getAllPredictions, getProbabilityCurve, ACTIVE_EVENTS } = require('../l3/prediction_market');

// 简单认证模块
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false';
const DEMO_KEY = process.env.API_KEY || 'sm_demo_key_12345';

const CONFIG = {
  port: 3000,
  rawDir: '/home/nice005/.openclaw/workspace/signal-market/output/raw',
  cleanDir: '/home/nice005/.openclaw/workspace/signal-market/output/clean',
  eventsDir: '/home/nice005/.openclaw/workspace/signal-market/output/events',
  probDir: '/home/nice005/.openclaw/workspace/signal-market/output/probability',
  lensesDir: '/home/nice005/.openclaw/workspace/signal-market/output/lenses'
};

function getDatePath() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

// 用户透镜配置
const USER_LENSES = {
  'lens_a_stock': {
    lens_id: 'lens_a_stock',
    name: 'A股板块玩家',
    topics: ['商业航天', 'AI算力', '机器人'],
    market: 'A-share',
    delivery: '08:30'
  },
  'lens_us_macro': {
    lens_id: 'lens_us_macro',
    name: '美股宏观交易员',
    topics: ['美股宏观', 'AI算力'],
    market: 'US-stock',
    delivery: '16:00'
  },
  'lens_crypto_event': {
    lens_id: 'lens_crypto_event',
    name: '币圈事件交易员',
    topics: ['加密货币'],
    market: 'crypto',
    delivery: 'trigger'
  }
};

// 认证中间件
function authenticate(req, res) {
  if (!AUTH_ENABLED) return true;
  
  const publicPaths = ['/signals/health', '/health', '/docs', '/', '/ui/'];
  if (publicPaths.some(p => req.url.startsWith(p))) return true;
  
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing API Key', hint: 'Add x-api-key header' }));
    return false;
  }
  
  if (apiKey !== DEMO_KEY) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid API Key' }));
    return false;
  }
  
  return true;
}

function readEvents(datePath) {
  const filepath = path.join(CONFIG.eventsDir, datePath, 'event_registry.json');
  if (!fs.existsSync(filepath)) return [];
  return JSON.parse(fs.readFileSync(filepath, 'utf8')).events || [];
}

function readProbabilities(datePath) {
  const summaryPath = path.join(CONFIG.probDir, datePath, 'summary.json');
  if (!fs.existsSync(summaryPath)) return {};
  return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

function readEvidenceMap(datePath) {
  const mapPath = path.join(CONFIG.eventsDir, datePath, 'evidence_map.json');
  if (!fs.existsSync(mapPath)) return {};
  return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
}

function handleGetEvents(req, res) {
  const datePath = getDatePath();
  const events = readEvents(datePath);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    events: events.map(e => ({
      event_id: e.event_id,
      topic: e.topic,
      title: e.title,
      stage: e.stage,
      evidence_refs: e.evidence_refs
    })),
    timestamp: new Date().toISOString(),
    count: events.length
  }));
}

function handleGetEventProbability(req, res, eventId) {
  const datePath = getDatePath();
  const probPath = path.join(CONFIG.probDir, datePath, `${eventId}.json`);
  
  if (!fs.existsSync(probPath)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Event not found' }));
    return;
  }
  
  const prob = JSON.parse(fs.readFileSync(probPath, 'utf8'));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(prob));
}

function handleGetLensBrief(req, res, userId) {
  const lens = USER_LENSES[userId];
  if (!lens) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Lens not found' }));
    return;
  }
  
  const datePath = getDatePath();
  const events = readEvents(datePath);
  const probs = readProbabilities(datePath);
  const relevantEvents = events.filter(e => lens.topics.includes(e.topic));
  
  const brief = {
    lens_id: lens.lens_id,
    user_id: userId,
    date: new Date().toISOString().split('T')[0],
    topics_watched: lens.topics,
    stage_summary: relevantEvents.map(e => {
      const probData = probs.probabilities?.find(p => p.event_id === e.event_id);
      return {
        topic: e.topic,
        current_stage: e.stage,
        probability: probData?.current || 0,
        probability_7d: probData?.P_7d || 0
      };
    }),
    top_opportunities: relevantEvents
      .filter(e => e.stage === 'accelerating' || e.stage === 'peak')
      .map(e => ({ topic: e.topic, stage: e.stage, action: '关注' })),
    risk_alerts: relevantEvents
      .filter(e => e.stage === 'fading')
      .map(e => ({ topic: e.topic, stage: e.stage, action: '警惕' })),
    evidence_refs: relevantEvents.flatMap(e => e.evidence_refs || []),
    generated_at: new Date().toISOString()
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(brief));
}

function handleGetPredictions(req, res) {
  const predictions = getAllPredictions();
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ predictions, count: predictions.length }));
}

function handleGetPrediction(req, res, id) {
  const curve = getProbabilityCurve(id);
  if (!curve) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Prediction not found' }));
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(curve));
}

function handleGetEvidence(req, res, eventId) {
  const datePath = getDatePath();
  const evidenceMap = readEvidenceMap(datePath);
  const evidence = evidenceMap[eventId] || {};
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ event_id: eventId, evidence }));
}

function handleGetHealth(req, res) {
  const datePath = getDatePath();
  const events = readEvents(datePath);
  const probs = readProbabilities(datePath);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: events.length > 0 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      raw: fs.existsSync(CONFIG.rawDir),
      clean: fs.existsSync(CONFIG.cleanDir),
      events: events.length > 0,
      probability: Object.keys(probs).length > 0
    },
    updates_today: events.length,
    system_health: events.length > 0 ? 'healthy' : 'degraded'
  }));
}

function handlePostWatch(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const config = JSON.parse(body);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        watch_id: 'watch_' + Date.now(),
        config
      }));
    } catch(e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

// 路由处理
function routeHandler(req, res) {
  if (!authenticate(req, res)) return;
  
  const url = new URL(req.url, `http://localhost:${CONFIG.port}`);
  const path = url.pathname;
  
  console.log(`${req.method} ${path}`);
  
  // 路由匹配
  if (path === '/events' && req.method === 'GET') {
    return handleGetEvents(req, res);
  }
  if (path.match(/^\/events\/[\w-]+\/probability$/) && req.method === 'GET') {
    const eventId = path.split('/')[2];
    return handleGetEventProbability(req, res, eventId);
  }
  if (path.match(/^\/lenses\/[\w_]+\/daily-brief$/) && req.method === 'GET') {
    const userId = path.split('/')[2];
    return handleGetLensBrief(req, res, userId);
  }
  if (path === '/predictions' && req.method === 'GET') {
    return handleGetPredictions(req, res);
  }
  if (path.match(/^\/predictions\/[\w-]+$/) && req.method === 'GET') {
    const id = path.split('/')[2];
    return handleGetPrediction(req, res, id);
  }
  if (path.match(/^\/evidence\/[\w-]+$/) && req.method === 'GET') {
    const eventId = path.split('/')[2];
    return handleGetEvidence(req, res, eventId);
  }
  if ((path === '/signals/health' || path === '/health') && req.method === 'GET') {
    return handleGetHealth(req, res);
  }
  if (path === '/watch' && req.method === 'POST') {
    return handlePostWatch(req, res);
  }
  
  // 404
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
}

// 启动服务器
const server = http.createServer(routeHandler);

server.listen(CONFIG.port, () => {
  console.log(`🚀 Signal Market API Server`);
  console.log(`   Port: ${CONFIG.port}`);
  console.log(`   Auth: ${AUTH_ENABLED ? 'Enabled' : 'Disabled'}`);
  console.log(`   Endpoints:`);
  console.log(`   - GET  /events`);
  console.log(`   - GET  /events/{id}/probability`);
  console.log(`   - GET  /lenses/{user}/daily-brief`);
  console.log(`   - POST /watch`);
  console.log(`   - GET  /signals/health`);
  console.log(`   - GET  /evidence/{eventId}`);
  console.log(`   - GET  /predictions`);
  console.log(`   - GET  /predictions/{id}`);
});

module.exports = { server, CONFIG };
