/**
 * L4: Decision API (Secure & Optimized)
 * 
 * Security + Performance + Monitoring
 * → /events, /events/{id}/probability, /lenses/{user}/daily-brief, /watch, /signals/health, /evidence/{event_id}, /predictions, /predictions/{id}
 * → /metrics, /cache-stats (monitoring endpoints)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { getAllPredictions, getProbabilityCurve, ACTIVE_EVENTS } = require('../l3/prediction_market');

// Security & Monitoring imports
const { 
  securityMiddleware, 
  validateRoute, 
  securityErrorHandler,
  parseBody,
  sanitizeString
} = require('./security_middleware');

const { 
  monitoringMiddleware, 
  cacheMiddleware, 
  handleGetMetrics,
  handleGetCacheStats,
  getEnhancedHealth,
  errorTracker,
  apiCache
} = require('./monitoring_middleware');

const CONFIG = {
  port: process.env.PORT || 3001,
  rawDir: '/home/nice005/.openclaw/workspace/signal-market/output/raw',
  cleanDir: '/home/nice005/.openclaw/workspace/signal-market/output/clean',
  eventsDir: '/home/nice005/.openclaw/workspace/signal-market/output/events',
  probDir: '/home/nice005/.openclaw/workspace/signal-market/output/probability',
  lensesDir: '/home/nice005/.openclaw/workspace/signal-market/output/lenses'
};

function getDatePath() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

// 模拟用户透镜配置
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

// ====== Enhanced: Parse Query Parameters with Validation ======
function parseQueryParams(url) {
  const urlObj = new URL(url, `http://localhost:${CONFIG.port}`);
  
  // Validate and sanitize numeric params
  const limit = Math.min(Math.max(parseInt(urlObj.searchParams.get('limit')) || 20, 1), 100);
  const offset = Math.max(parseInt(urlObj.searchParams.get('offset')) || 0, 0);
  
  return {
    limit,
    offset,
    stage: urlObj.searchParams.get('stage') || null,
    topic: urlObj.searchParams.get('topic') || null,
    sortBy: urlObj.searchParams.get('sortBy') || 'timestamp',
    sortOrder: urlObj.searchParams.get('sortOrder') || 'desc'
  };
}

// ====== Enhanced: Filter, Sort, Paginate Events ======
function processEvents(events, params) {
  let filtered = [...events];
  
  // Filter by stage (sanitized)
  if (params.stage) {
    const stages = params.stage.split(',').map(s => sanitizeString(s)).filter(s => s);
    filtered = filtered.filter(e => stages.includes(e.stage));
  }
  
  // Filter by topic (sanitized)
  if (params.topic) {
    const topics = params.topic.split(',').map(t => sanitizeString(t)).filter(t => t);
    filtered = filtered.filter(e => topics.includes(e.topic));
  }
  
  // Sort
  const sortField = params.sortBy === 'probability' ? 'probability' : 
                    params.sortBy === 'title' ? 'title' : 'timestamp';
  const order = params.sortOrder === 'asc' ? 1 : -1;
  
  filtered.sort((a, b) => {
    if (sortField === 'probability') {
      return (b.probability || 0) - (a.probability || 0) * order;
    } else if (sortField === 'title') {
      return order * (a.title || '').localeCompare(b.title || '');
    }
    return 0;
  });
  
  // Paginate
  const total = filtered.length;
  const paginated = filtered.slice(params.offset, params.offset + params.limit);
  
  return {
    items: paginated,
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total: total,
      hasMore: params.offset + params.limit < total
    }
  };
}

// ====== Enhanced: Filter, Sort, Paginate Predictions ======
function processPredictions(predictions, params) {
  let filtered = [...predictions];
  
  // Filter by topic (sanitized)
  if (params.topic) {
    const topics = params.topic.split(',').map(t => sanitizeString(t)).filter(t => t);
    filtered = filtered.filter(p => topics.some(t => (p.topic || '').toLowerCase().includes(t.toLowerCase())));
  }
  
  // Sort
  const sortField = params.sortBy === 'probability' ? 'probability' : 
                    params.sortBy === 'horizon' ? 'horizon' : 'timestamp';
  const order = params.sortOrder === 'asc' ? 1 : -1;
  
  filtered.sort((a, b) => {
    if (sortField === 'probability') {
      return order * ((b.probability || 0) - (a.probability || 0));
    } else if (sortField === 'horizon') {
      return order * (a.horizon || '').localeCompare(b.horizon || '');
    }
    return 0;
  });
  
  // Paginate
  const total = filtered.length;
  const paginated = filtered.slice(params.offset, params.offset + params.limit);
  
  return {
    items: paginated,
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total: total,
      hasMore: params.offset + params.limit < total
    }
  };
}

// API Handlers

function handleGetEvents(req, res) {
  const datePath = getDatePath();
  const events = readEvents(datePath);
  const params = parseQueryParams(req.url);
  
  // Add probability to events if available
  const probs = readProbabilities(datePath);
  const eventsWithProb = events.map(e => {
    const probData = probs.probabilities?.find(p => p.event_id === e.event_id);
    return {
      event_id: e.event_id,
      topic: e.topic,
      title: e.title,
      stage: e.stage,
      probability: probData?.current || null,
      evidence_refs: e.evidence_refs,
      timestamp: e.timestamp || new Date().toISOString()
    };
  });
  
  const result = processEvents(eventsWithProb, params);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.end(JSON.stringify({
    events: result.items,
    pagination: result.pagination,
    timestamp: new Date().toISOString()
  }));
}

function handleGetEventProbability(req, res, eventId) {
  const datePath = getDatePath();
  
  // Sanitize eventId
  const safeEventId = sanitizeString(eventId);
  const probPath = path.join(CONFIG.probDir, datePath, `${safeEventId}.json`);
  
  if (!fs.existsSync(probPath)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Event not found' }));
    return;
  }
  
  const prob = JSON.parse(fs.readFileSync(probPath, 'utf8'));
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
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
  
  // 筛选用户关注的主题
  const relevantEvents = events.filter(e => lens.topics.includes(e.topic));
  
  // 构建简报
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
      .map(e => ({
        topic: e.topic,
        stage: e.stage,
        action: '关注'
      })),
    
    risk_alerts: relevantEvents
      .filter(e => e.stage === 'fading')
      .map(e => ({
        topic: e.topic,
        stage: e.stage,
        warning: '注意风险'
      })),
    
    evidence_refs: relevantEvents.flatMap(e => e.evidence_refs),
    
    generated_at: new Date().toISOString()
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(brief, null, 2));
}

function handleGetHealth(req, res) {
  const datePath = getDatePath();
  
  // 检查各层输出
  const checks = {
    raw: fs.existsSync(path.join(CONFIG.rawDir, `summary_${datePath}.json`)),
    clean: fs.existsSync(path.join(CONFIG.cleanDir, datePath, 'facts.jsonl')),
    events: fs.existsSync(path.join(CONFIG.eventsDir, datePath, 'event_registry.json')),
    probability: fs.existsSync(path.join(CONFIG.probDir, datePath, 'summary.json'))
  };
  
  const healthy = Object.values(checks).filter(v => v).length;
  
  // Get enhanced health with metrics
  const enhancedHealth = getEnhancedHealth();
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(JSON.stringify({
    status: healthy >= 3 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: checks,
    updates_today: healthy,
    system_health: healthy >= 3 ? 'healthy' : 'degraded',
    metrics: enhancedHealth.metrics,
    cache: enhancedHealth.cache
  }));
}

function handleGetEvidence(req, res, eventId) {
  const datePath = getDatePath();
  
  // Sanitize eventId
  const safeEventId = sanitizeString(eventId);
  const evidenceMap = readEvidenceMap(datePath);
  
  const evidence = evidenceMap[safeEventId];
  if (!evidence) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Evidence not found' }));
    return;
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(JSON.stringify(evidence));
}

async function handlePostWatch(req, res) {
  try {
    const body = await parseBody(req);
    
    // Validate input
    const errors = validateRoute('/watch', body);
    if (errors.length > 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Validation failed', details: errors }));
      return;
    }
    
    // Process watch request
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      watch_id: `watch_${Date.now()}`,
      status: 'created',
      event_id: body.event_id,
      next_output: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }));
  } catch (err) {
    securityErrorHandler(err, req, res);
  }
}

function handleGetPredictions(req, res) {
  const params = parseQueryParams(req.url);
  const predictions = getAllPredictions();
  const result = processPredictions(predictions, params);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.end(JSON.stringify({
    predictions: result.items,
    pagination: result.pagination,
    timestamp: new Date().toISOString()
  }));
}

function handleGetPredictionCurve(req, res, eventId) {
  // Sanitize eventId
  const safeEventId = sanitizeString(eventId);
  const curve = getProbabilityCurve(safeEventId, 7);
  if (!curve) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Prediction event not found' }));
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.end(JSON.stringify(curve));
}

// ====== Monitoring Endpoints ======
function handleGetAlerts(req, res) {
  const { alertSystem } = require('./monitoring_middleware');
  const alerts = alertSystem.getAlerts();
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    alerts,
    count: alerts.length,
    timestamp: new Date().toISOString()
  }));
}

function handleInvalidateCache(req, res) {
  // Parse query param for pattern
  const urlObj = new URL(req.url, `http://localhost:${CONFIG.port}`);
  const pattern = urlObj.searchParams.get('pattern') || '';
  
  apiCache.invalidate(pattern);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'success',
    message: pattern ? `Cache invalidated for pattern: ${pattern}` : 'All cache invalidated',
    timestamp: new Date().toISOString()
  }));
}

// Router
async function route(req, res) {
  const url = req.url;
  
  console.log(`📡 ${req.method} ${url}`);
  
  try {
    // Security middleware (rate limiting, headers, CORS)
    const blocked = await securityMiddleware(req, res);
    if (blocked) return;
    
    // Monitoring middleware (metrics)
    monitoringMiddleware(req, res);
    
    // Cache middleware (for GET requests)
    if (req.method === 'GET') {
      const cacheHit = cacheMiddleware(req, res);
      if (cacheHit) return;
    }
    
    // Route handling
    
    // GET /events
    if (req.method === 'GET' && url.startsWith('/events')) {
      const pathMatch = url.match(/^(\/events[^?]*)/);
      if (pathMatch && pathMatch[1] === '/events') {
        return handleGetEvents(req, res);
      }
      // GET /events/:id/probability
      const probMatch = url.match(/^\/events\/([^/]+)\/probability$/);
      if (probMatch) {
        return handleGetEventProbability(req, res, probMatch[1]);
      }
    }
    
    // GET /lenses/:user/daily-brief
    const lensMatch = url.match(/^\/lenses\/([^/]+)\/daily-brief$/);
    if (req.method === 'GET' && lensMatch) {
      return handleGetLensBrief(req, res, lensMatch[1]);
    }
    
    // GET /signals/health or /health
    if (req.method === 'GET' && (url === '/signals/health' || url === '/health')) {
      return handleGetHealth(req, res);
    }
    
    // GET /evidence/:eventId
    const evMatch = url.match(/^\/evidence\/([^/]+)$/);
    if (req.method === 'GET' && evMatch) {
      return handleGetEvidence(req, res, evMatch[1]);
    }
    
    // POST /watch
    if (req.method === 'POST' && url === '/watch') {
      return await handlePostWatch(req, res);
    }
    
    // GET /predictions
    if (req.method === 'GET' && url.startsWith('/predictions')) {
      const pathMatch = url.match(/^(\/predictions[^?]*)/);
      if (pathMatch && pathMatch[1] === '/predictions') {
        return handleGetPredictions(req, res);
      }
      // GET /predictions/:id
      const predMatch = url.match(/^\/predictions\/([^/]+)$/);
      if (predMatch) {
        return handleGetPredictionCurve(req, res, predMatch[1]);
      }
    }
    
    // ====== Monitoring Endpoints ======
    
    // GET /metrics - Detailed metrics
    if (req.method === 'GET' && url === '/metrics') {
      return handleGetMetrics(req, res);
    }
    
    // GET /cache-stats - Cache statistics
    if (req.method === 'GET' && url === '/cache-stats') {
      return handleGetCacheStats(req, res);
    }
    
    // GET /alerts - Current alerts
    if (req.method === 'GET' && url === '/alerts') {
      return handleGetAlerts(req, res);
    }
    
    // POST /cache/invalidate - Invalidate cache
    if (req.method === 'POST' && url === '/cache/invalidate') {
      return handleInvalidateCache(req, res);
    }
    
    // 404
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
    
  } catch (err) {
    console.error('Route error:', err);
    errorTracker(err, req, res);
    securityErrorHandler(err, req, res);
  }
}

function startServer() {
  const server = http.createServer(route);
  
  server.listen(CONFIG.port, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🚀 Signal Market API Server (Secure & Optimized)            ║
╠══════════════════════════════════════════════════════════════╣
║  Port: ${CONFIG.port}
║                                                              ║
║  📡 API Endpoints:                                           ║
║  - GET  /events                    List events (paginated) ║
║  - GET  /events/:id/probability    Get event probability    ║
║  - GET  /lenses/:user/daily-brief  User lens brief          ║�
║  - POST /watch                     Create watch             ║
║  - GET  /signals/health            Health check              ║
║  - GET  /evidence/:eventId         Get evidence              ║
║  - GET  /predictions               List predictions          ║
║  - GET  /predictions/:id           Get prediction curve      ║
║                                                              ║
║  📊 Monitoring Endpoints:                                     ║
║  - GET  /metrics                   Detailed metrics          ║
║  - GET  /cache-stats               Cache statistics         ║
║  - GET  /alerts                    Current alerts           ║
║  - POST /cache/invalidate          Invalidate cache         ║
║                                                              ║
║  🔒 Security Features:                                        ║
║  ✓ Rate Limiting (100 req/min)                              ║
║  ✓ Security Headers (CSP, HSTS, X-Frame-Options)           ║
║  ✓ Input Validation & Sanitization                          ║
║  ✓ CORS Configuration                                       ║
║  ✓ XSS Protection                                           ║
║                                                              ║
║  ⚡ Performance Features:                                     ║
║  ✓ Response Caching (route-based TTL)                      ║
║  ✓ Performance Metrics (avg, p95, p99)                     ║
║  ✓ Error Tracking                                           ║
║  ✓ Alert System                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, route };
