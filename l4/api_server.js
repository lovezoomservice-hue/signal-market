/**
 * L4: Decision API
 * 
 * 用户透镜 + 定时推送
 * → /events, /events/{id}/probability, /lenses/{user}/daily-brief, /watch, /signals/health, /evidence/{event_id}, /predictions, /predictions/{id}
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { getAllPredictions, getProbabilityCurve, ACTIVE_EVENTS } = require('../l3/prediction_market');
const { SignalRankingEngine } = require('../signal_ranking_engine');
const { WeakSignalDiscoveryEngine } = require('../weak_signal_engine');

const rankingEngine = new SignalRankingEngine();
const weakSignalEngine = new WeakSignalDiscoveryEngine();

const CONFIG = {
  port: 3000,
  rawDir: '/home/nice005/.openclaw/workspace/signal-market/output/raw',
  cleanDir: '/home/nice005/.openclaw/workspace/signal-market/output/clean',
  eventsDir: '/home/nice005/.openclaw/workspace/signal-market/output/events',
  probDir: '/home/nice005/.openclaw/workspace/signal-market/output/probability',
  lensesDir: '/home/nice005/.openclaw/workspace/signal-market/output/lenses'
};

// In-memory watchlist storage
const WATCHLIST = [];
const ALERTS = [];

function getDatePath() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

// Atom BA1: Generate proof_id from event data
function generateProofId(eventId, title, topic) {
  const input = `${eventId}:${title}:${topic}:${getDatePath()}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
  return `proof_${hash}`;
}

// Atom BA1: Generate inputs_hash (SHA256 fingerprint)
function generateInputsHash(data) {
  const serialized = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(serialized).digest('hex');
  return `sha256:${hash}`;
}

// Atom BA1: Get current ISO timestamp
function getUpdatedAt() {
  return new Date().toISOString();
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
  // Try new raw data format first
  const newPath = path.join(CONFIG.rawDir, `signals_${datePath}.json`);
  if (fs.existsSync(newPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(newPath, 'utf8'));
      if (raw.data && raw.data.length > 0) {
        // Transform raw data to events format
        return raw.data.slice(0, 30).map((item, idx) => ({
          event_id: `evt_${Date.now()}_${idx}`,
          topic: item.topic || item.title,
          title: item.title || item.topic,
          stage: 'emerging',
          probability: item.stars ? Math.min(90, 50 + Math.floor(item.stars / 1000)) : 50,
          evidence_count: item.stars || item.score || 1,
          sources: [item.source],
          updated_at: item.timestamp || new Date().toISOString()
        }));
      }
    } catch (e) {}
  }
  
  // Fall back to old format
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

// API Handlers

function handleGetEvents(req, res) {
  const datePath = getDatePath();
  const events = readEvents(datePath);
  const updatedAt = getUpdatedAt();
  
  // Atom BA1: Build events with proof_id, updated_at, inputs_hash
  const enrichedEvents = events.map(e => {
    const proofId = generateProofId(e.event_id, e.title, e.topic);
    const evidenceCount = e.evidence_refs ? e.evidence_refs.length : 0;
    
    // Generate inputs_hash from core event data
    const eventData = {
      event_id: e.event_id,
      topic: e.topic,
      title: e.title,
      stage: e.stage,
      evidence_refs: e.evidence_refs
    };
    const inputsHash = generateInputsHash(eventData);
    
    return {
      event_id: e.event_id,
      topic: e.topic,
      title: e.title,
      stage: e.stage,
      proof_id: proofId,
      updated_at: updatedAt,
      inputs_hash: inputsHash,
      evidence_count: evidenceCount,
      evidence_refs: e.evidence_refs
    };
  });
  
  // Generate inputs_hash for the entire events array
  const eventsData = {
    events: enrichedEvents,
    count: enrichedEvents.length
  };
  const totalInputsHash = generateInputsHash(eventsData);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    events: enrichedEvents,
    proof_id: generateProofId('events', 'all', datePath),
    updated_at: updatedAt,
    inputs_hash: totalInputsHash,
    count: enrichedEvents.length
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
  const updatedAt = getUpdatedAt();
  
  // 检查各层输出
  const checks = {
    raw: fs.existsSync(path.join(CONFIG.rawDir, `summary_${datePath}.json`)),
    clean: fs.existsSync(path.join(CONFIG.cleanDir, datePath, 'facts.jsonl')),
    events: fs.existsSync(path.join(CONFIG.eventsDir, datePath, 'event_registry.json')),
    probability: fs.existsSync(path.join(CONFIG.probDir, datePath, 'summary.json'))
  };
  
  const healthy = Object.values(checks).filter(v => v).length;
  
  // Atom BA1: Include updated_at in health response
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: healthy >= 3 ? 'healthy' : 'degraded',
    updated_at: updatedAt,
    checks: checks,
    updates_today: healthy,
    system_health: healthy >= 3 ? 'healthy' : 'degraded'
  }));
}

// GET /signals - Ranked Signal Feed
function handleGetSignals(req, res) {
  const datePath = getDatePath();
  
  // Get events from the system
  const events = readEvents(datePath);
  
  // Transform events to signals format
  const signals = events.map(event => ({
    topic: event.topic || event.title,
    stage: event.stage || 'emerging',
    confidence: event.probability ? event.probability / 100 : 0.5,
    impact_score: 0.5,
    evidenceCount: event.evidence_count || 1,
    evidence_7d: Math.floor((event.evidence_count || 1) * 0.3),
    evidence_30d: event.evidence_count || 3,
    evidence_days: 7,
    updated_at: event.updated_at || getUpdatedAt(),
    sources: event.sources || ['system']
  }));
  
  // If no events, generate sample signals
  let rankedSignals = signals;
  if (rankedSignals.length === 0) {
    rankedSignals = generateSampleSignals();
  }
  
  // Apply ranking engine
  rankedSignals = rankingEngine.rankSignals(rankedSignals);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    signals: rankedSignals,
    count: rankedSignals.length,
    timestamp: getUpdatedAt(),
    ranking: {
      formula: 'feed_score = 0.30 impact + 0.25 confidence + 0.20 velocity + 0.15 recency + 0.10 stability',
      diversity_limit: 5,
      max_signals: 50
    }
  }));
}

// Generate sample signals for demo
// GET /weak-signals - Weak Signal Discovery
function handleGetWeakSignals(req, res) {
  // Get existing events as potential weak signals
  const datePath = getDatePath();
  const events = readEvents(datePath);
  
  // Transform to weak signal format
  let rawSignals = events.map(event => ({
    topic: event.topic || event.title,
    sources: event.sources || ['system'],
    evidence_count: event.evidence_count || 1,
    signals_7d: Math.floor((event.evidence_count || 1) * 0.2),
    signals_30d: event.evidence_count || 5,
    activity: {
      new_contributors: Math.floor(Math.random() * 20),
      recent_growth: Math.random() * 50,
      early_signals: Math.random() * 30
    },
    updated_at: event.updated_at || getUpdatedAt()
  }));
  
  // If no events, generate sample weak signals
  if (rawSignals.length === 0) {
    rawSignals = generateWeakSignals();
  }
  
  // Apply weak signal discovery engine
  const weakSignals = weakSignalEngine.discoverWeakSignals(rawSignals);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    weak_signals: weakSignals,
    count: weakSignals.length,
    timestamp: getUpdatedAt(),
    formula: 'weak_signal_score = 0.40 novelty + 0.25 expert_source + 0.20 cross_domain + 0.15 early_adopter'
  }));
}

// Generate sample weak signals
function generateWeakSignals() {
  const samples = [
    { topic: 'Edge AI Chips', sources: ['arxiv', 'github'], signals_7d: 3, signals_30d: 8 },
    { topic: 'Neuromorphic Computing', sources: ['arxiv', 'research'], signals_7d: 2, signals_30d: 5 },
    { topic: 'Synthetic Biology Tools', sources: ['github', 'reddit'], signals_7d: 4, signals_30d: 12 },
    { topic: 'Quantum Error Correction', sources: ['arxiv'], signals_7d: 1, signals_30d: 4 },
    { topic: 'Flying Car Startups', sources: ['crunchbase', 'news'], signals_7d: 2, signals_30d: 6 },
    { topic: 'Solid State Batteries', sources: ['github', 'news'], signals_7d: 5, signals_30d: 15 },
    { topic: 'Brain-Computer Interfaces', sources: ['arxiv', 'techcrunch'], signals_7d: 3, signals_30d: 9 },
    { topic: 'Rust for WebAssembly', sources: ['github', 'reddit'], signals_7d: 6, signals_30d: 20 },
    { topic: 'Green Hydrogen Tech', sources: ['news', 'research'], signals_7d: 2, signals_30d: 7 },
    { topic: 'AR Contact Lenses', sources: ['news', 'patent'], signals_7d: 1, signals_30d: 3 }
  ];
  
  return samples.map(s => ({
    ...s,
    evidence_count: s.signals_30d,
    activity: {
      new_contributors: Math.floor(Math.random() * 15),
      recent_growth: Math.random() * 40,
      early_signals: Math.random() * 25
    },
    updated_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
  }));
}

function generateSampleSignals() {
  const samples = [
    { topic: 'AI Agents', stage: 'emerging', confidence: 0.63, impact_score: 0.8, evidenceCount: 12 },
    { topic: 'Bitcoin ETF', stage: 'accelerating', confidence: 0.87, impact_score: 0.9, evidenceCount: 45 },
    { topic: 'GPU Shortage', stage: 'forming', confidence: 0.71, impact_score: 0.75, evidenceCount: 23 },
    { topic: 'Autonomous Vehicles', stage: 'emerging', confidence: 0.55, impact_score: 0.7, evidenceCount: 8 },
    { topic: 'Quantum Computing', stage: 'weak', confidence: 0.35, impact_score: 0.85, evidenceCount: 5 },
    { topic: 'Space Exploration', stage: 'accelerating', confidence: 0.68, impact_score: 0.6, evidenceCount: 18 },
    { topic: 'CRISPR Therapeutics', stage: 'forming', confidence: 0.52, impact_score: 0.65, evidenceCount: 11 },
    { topic: 'Solid State Batteries', stage: 'emerging', confidence: 0.48, impact_score: 0.7, evidenceCount: 7 }
  ];
  
  return samples.map((s, i) => ({
    ...s,
    evidence_7d: Math.floor(s.evidenceCount * 0.3),
    evidence_30d: s.evidenceCount,
    evidence_days: Math.floor(Math.random() * 20) + 5,
    updated_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    sources: ['hackernews', 'github', 'arxiv']
  }));
}

// Map source to evidence type
function getEvidenceType(source) {
  const sourceTypeMap = {
    'a_stock': 'market',
    'binance': 'market',
    'hackernews': 'news',
    'macro': 'market',
    'us_stock': 'market',
    'twitter': 'social',
    'reddit': 'social',
    'news': 'news',
    'coinbase': 'market'
  };
  return sourceTypeMap[source] || 'news';
}

// Transform fact to evidence source format
function factToSource(fact, eventTopic) {
  const type = getEvidenceType(fact.source);
  
  const base = { type };
  
  if (type === 'news') {
    return {
      ...base,
      url: `https://example.com/facts/${fact.fact_id}`,
      title: `${eventTopic || 'Related'} news`
    };
  } else if (type === 'market') {
    return {
      ...base,
      symbol: fact.source.toUpperCase(),
      price_change: (Math.random() * 10 - 5).toFixed(2) // Simulated price change
    };
  } else if (type === 'social') {
    return {
      ...base,
      platform: fact.source,
      mentions: Math.floor(Math.random() * 5000)
    };
  }
  
  return base;
}

function handleGetEventEvidence(req, res, eventId) {
  const datePath = getDatePath();
  const events = readEvents(datePath);
  
  // Find the event
  const event = events.find(e => e.event_id === eventId);
  if (!event) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Event not found' }));
    return;
  }
  
  // Get facts for this event
  const facts = event.facts || [];
  const evidenceCount = facts.length;
  
  // Transform facts to source_list format
  const sourceList = facts.map(fact => factToSource(fact, event.topic));
  
  // Generate proof_id and inputs_hash
  const updatedAt = getUpdatedAt();
  const proofId = generateProofId(eventId, event.title, event.topic);
  
  // Generate inputs_hash from evidence data
  const evidenceData = {
    event_id: eventId,
    facts: facts.map(f => ({ fact_id: f.fact_id, source: f.source, credibility: f.credibility }))
  };
  const inputsHash = generateInputsHash(evidenceData);
  
  const response = {
    event_id: eventId,
    evidence_count: evidenceCount,
    source_list: sourceList,
    updated_at: updatedAt,
    proof_id: proofId,
    inputs_hash: inputsHash
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(response, null, 2));
}

function handlePostWatch(req, res) {
  // 简化：只返回成功
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    watch_id: `watch_${Date.now()}`,
    status: 'created',
    next_output: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }));
}

// POST /watchlist - Add topic to watchlist
function handlePostWatchlist(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const watchItem = {
        id: `watch_${Date.now()}`,
        topic: data.topic || data.topic_id,
        stage: data.stage || 'emerging',
        confidence: data.confidence || 0.5,
        created_at: new Date().toISOString()
      };
      WATCHLIST.push(watchItem);
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        watch_id: watchItem.id,
        item: watchItem
      }));
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

// GET /watchlist - Get all watched topics
function handleGetWatchlist(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    watchlist: WATCHLIST,
    count: WATCHLIST.length
  }));
}

// DELETE /watchlist/:id - Remove from watchlist
function handleDeleteWatchlist(req, res, id) {
  const index = WATCHLIST.findIndex(w => w.id === id);
  if (index > -1) {
    WATCHLIST.splice(index, 1);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

// GET /alerts - Get alerts
function handleGetAlerts(req, res) {
  // Generate sample alerts from watchlist changes
  const alerts = [];
  WATCHLIST.forEach(w => {
    alerts.push({
      id: `alert_${Date.now()}_${w.id}`,
      watch_id: w.id,
      topic: w.topic,
      type: 'stage_change',
      message: `${w.topic} moved from Emerging to Accelerating`,
      timestamp: new Date().toISOString(),
      read: false
    });
  });
  
  // Add some sample alerts if watchlist is empty
  if (alerts.length === 0) {
    alerts.push({
      id: 'alert_sample_1',
      topic: 'AI Agents',
      type: 'stage_change',
      message: 'AI Agents moved from Emerging to Accelerating',
      timestamp: new Date().toISOString(),
      read: false
    });
    alerts.push({
      id: 'alert_sample_2',  
      topic: 'Bitcoin ETF',
      type: 'confidence_change',
      message: 'Bitcoin ETF confidence increased to 87%',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: false
    });
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    alerts: alerts,
    count: alerts.length
  }));
}

function handleGetPredictions(req, res) {
  const predictions = getAllPredictions();
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    predictions: predictions,
    count: predictions.length,
    timestamp: new Date().toISOString()
  }));
}

function handleGetPredictionCurve(req, res, eventId) {
  const curve = getProbabilityCurve(eventId, 7);
  if (!curve) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Prediction event not found' }));
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(curve));
}

// GET /topics/{id}/stage - Topic Stage Engine API
function handleGetTopicStage(req, res, topicId) {
  const datePath = getDatePath();
  const updatedAt = getUpdatedAt();
  
  // Decode the topic ID (handles URL-encoded Chinese characters)
  const decodedTopicId = decodeURIComponent(topicId);
  
  const events = readEvents(datePath);
  const event = events.find(e => e.topic === decodedTopicId);
  
  if (!event) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Topic not found', topic_id: decodedTopicId }));
    return;
  }
  
  // Get evidence count
  const evidenceCount = event.evidence_refs ? event.evidence_refs.length : 0;
  
  // Calculate signals based on available data
  // Signal weights from topic_stage_engine.md:
  // - market signals: 0.3
  // - news clustering: 0.25
  // - social discussion intensity: 0.2
  // - event frequency: 0.15
  // - signal velocity: 0.1
  
  // Generate signals based on event data and sources
  const sources = {};
  events.filter(e => e.topic === decodedTopicId).forEach(e => {
    if (e.facts) {
      e.facts.forEach(fact => {
        sources[fact.source] = (sources[fact.source] || []).concat(fact);
      });
    }
  });
  
  const signals = [];
  
  // Market signals (based on a_stock, us_stock sources)
  const marketSources = ['a_stock', 'us_stock'];
  const marketSignals = Object.keys(sources).filter(s => marketSources.includes(s));
  if (marketSignals.length > 0) {
    const avgCred = marketSignals.reduce((sum, s) => 
      sum + sources[s].reduce((a, b) => a + (b.credibility || 0), 0) / sources[s].length, 0) / marketSignals.length;
    signals.push({
      type: 'market',
      value: Math.min(0.8 + avgCred * 0.2, 1.0),
      description: '资本市场信号'
    });
  }
  
  // News clustering (based on hackernews, news sources)
  const newsSources = ['hackernews', 'news'];
  const newsSignals = Object.keys(sources).filter(s => newsSources.includes(s));
  if (newsSignals.length > 0) {
    const avgCred = newsSignals.reduce((sum, s) => 
      sum + sources[s].reduce((a, b) => a + (b.credibility || 0), 0) / sources[s].length, 0) / newsSignals.length;
    signals.push({
      type: 'news',
      value: Math.min(0.7 + avgCred * 0.3, 1.0),
      description: '新闻聚合信号'
    });
  }
  
  // Social discussion intensity (binance social)
  if (sources['binance']) {
    signals.push({
      type: 'social',
      value: 0.65,
      description: '社区讨论强度'
    });
  }
  
  // Event frequency (number of facts)
  if (event.facts && event.facts.length > 0) {
    signals.push({
      type: 'event',
      value: Math.min(0.5 + event.facts.length * 0.15, 1.0),
      description: '事件频率'
    });
  }
  
  // Signal velocity (based on recent updates)
  if (event.updated_at) {
    const hoursSinceUpdate = (Date.now() - new Date(event.updated_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate < 6) {
      signals.push({
        type: 'velocity',
        value: 0.9,
        description: '高频更新信号'
      });
    } else if (hoursSinceUpdate < 24) {
      signals.push({
        type: 'velocity',
        value: 0.7,
        description: '中频更新信号'
      });
    }
  }
  
  // Calculate confidence from stage_probs if available
  let confidence = 0.5;
  if (event.stage_probs && event.stage_probs[event.stage]) {
    confidence = event.stage_probs[event.stage];
  }
  
  // If no signals found, add a default signal based on evidence
  if (signals.length === 0 && evidenceCount > 0) {
    signals.push({
      type: 'default',
      value: 0.6,
      description: '基础信号'
    });
  }
  
  // Generate proof_id
  const proofId = generateProofId(decodedTopicId, event.stage, 'stage');
  
  // Generate inputs_hash from the core topic data
  const topicData = {
    topic: decodedTopicId,
    stage: event.stage,
    event_id: event.event_id,
    evidence_refs: event.evidence_refs,
    stage_probs: event.stage_probs
  };
  const inputsHash = generateInputsHash(topicData);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    topic_id: decodedTopicId,
    stage: event.stage,
    confidence: confidence,
    signals: signals,
    evidence_count: evidenceCount,
    updated_at: updatedAt,
    proof_id: proofId,
    inputs_hash: inputsHash
  }, null, 2));
}

// Router
function route(req, res) {
  const url = req.url;
  
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`📡 ${req.method} ${url}`);
  
  // GET /events
  if (req.method === 'GET' && url === '/events') {
    return handleGetEvents(req, res);
  }
  
  // GET /events/:id/probability
  const probMatch = url.match(/^\/events\/([^/]+)\/probability$/);
  if (req.method === 'GET' && probMatch) {
    return handleGetEventProbability(req, res, probMatch[1]);
  }
  
  // GET /events/:id/evidence - Evidence Graph API
  const evGraphMatch = url.match(/^\/events\/([^/]+)\/evidence$/);
  if (req.method === 'GET' && evGraphMatch) {
    return handleGetEventEvidence(req, res, evGraphMatch[1]);
  }
  
  // GET /lenses/:user/daily-brief
  const lensMatch = url.match(/^\/lenses\/([^/]+)\/daily-brief$/);
  if (req.method === 'GET' && lensMatch) {
    return handleGetLensBrief(req, res, lensMatch[1]);
  }
  
  // GET /signals/health
  if (req.method === 'GET' && url === '/signals/health') {
    return handleGetHealth(req, res);
  }
  
  // GET /signals - Ranked Signal Feed
  if (req.method === 'GET' && url === '/signals') {
    return handleGetSignals(req, res);
  }
  
  // GET /weak-signals - Weak Signal Discovery
  if (req.method === 'GET' && url === '/weak-signals') {
    return handleGetWeakSignals(req, res);
  }
  
  // GET /evidence/:eventId
  const evMatch = url.match(/^\/evidence\/([^/]+)$/);
  if (req.method === 'GET' && evMatch) {
    return handleGetEvidence(req, res, evMatch[1]);
  }
  
  // POST /watch
  if (req.method === 'POST' && url === '/watch') {
    return handlePostWatch(req, res);
  }
  
  // GET /predictions - 所有预测市场事件
  if (req.method === 'GET' && url === '/predictions') {
    return handleGetPredictions(req, res);
  }
  
  // GET /predictions/:id - 单个预测事件概率曲线
  const predMatch = url.match(/^\/predictions\/([^/]+)$/);
  if (req.method === 'GET' && predMatch) {
    return handleGetPredictionCurve(req, res, predMatch[1]);
  }
  
  // GET /topics/:id/stage - Topic Stage Engine API
  const topicStageMatch = url.match(/^\/topics\/([^/]+)\/stage$/);
  if (req.method === 'GET' && topicStageMatch) {
    return handleGetTopicStage(req, res, topicStageMatch[1]);
  }
  
  // POST /watchlist - Add to watchlist
  if (req.method === 'POST' && url === '/watchlist') {
    return handlePostWatchlist(req, res);
  }
  
  // GET /watchlist - Get watchlist
  if (req.method === 'GET' && url === '/watchlist') {
    return handleGetWatchlist(req, res);
  }
  
  // DELETE /watchlist/:id - Remove from watchlist
  const watchDelMatch = url.match(/^\/watchlist\/([^/]+)$/);
  if (req.method === 'DELETE' && watchDelMatch) {
    return handleDeleteWatchlist(req, res, watchDelMatch[1]);
  }
  
  // GET /alerts - Get alerts
  if (req.method === 'GET' && url === '/alerts') {
    return handleGetAlerts(req, res);
  }
  
  // 404
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}

function startServer() {
  const server = http.createServer(route);
  
  server.listen(CONFIG.port, () => {
    console.log(`
🚀 Signal Market API Server
   Port: ${CONFIG.port}
   Endpoints:
   - GET  /events
   - GET  /events/{id}/probability
   - GET  /lenses/{user}/daily-brief
   - POST /watch
   - GET  /signals/health
   - GET  /signals (ranked feed)
   - GET  /evidence/{eventId}
   - GET  /predictions
   - GET  /predictions/{id}
   - GET  /topics/{id}/stage
   - POST /watchlist
   - GET  /watchlist
   - DELETE /watchlist/{id}
   - GET  /alerts
    `);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, route };
