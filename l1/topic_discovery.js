/**
 * Signal Intelligence Engine v2
 * Advanced trend detection with real metrics
 */

const https = require('https');

// Signal lifecycle stages
const STAGES = ['weak', 'emerging', 'forming', 'accelerating', 'peak', 'fading', 'dead'];

// Source trust weights
const SOURCE_WEIGHTS = {
  github: 0.9,
  hackernews: 0.7,
  arxiv: 0.95,
  techcrunch: 0.8,
  reddit: 0.4,
  twitter: 0.3
};

// Extract topics from raw data
function extractTopics(rawData) {
  const topics = new Map();
  
  rawData.forEach(item => {
    const topic = item.topic || item.title;
    if (!topic) return;
    
    const normalized = normalizeTopic(topic);
    
    if (!topics.has(normalized)) {
      topics.set(normalized, {
        topic: normalized,
        original: topic,
        sources: new Set(),
        metrics: { stars: 0, forks: 0, score: 0, citations: 0, funding: 0 },
        evidence: [],
        timestamps: [],
        first_seen: item.timestamp,
        last_updated: item.timestamp
      });
    }
    
    const t = topics.get(normalized);
    t.sources.add(item.source);
    t.evidence.push(item);
    t.timestamps.push(new Date(item.timestamp).getTime());
    t.last_updated = item.timestamp;
    
    if (item.stars) t.metrics.stars += item.stars;
    if (item.forks) t.metrics.forks += item.forks;
    if (item.score) t.metrics.score += item.score;
  });
  
  return Array.from(topics.values());
}

function normalizeTopic(topic) {
  if (!topic) return '';
  return topic.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().substring(0, 50);
}

// ========== V2 METRICS ==========

// SECTION 1: TREND BREAK DETECTION
function calculateTrendBreak(topic) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  // Get timestamps in sorted order
  const timestamps = topic.timestamps.sort((a, b) => a - b);
  
  // Calculate velocity for different periods
  const last7d = timestamps.filter(t => now - t < 7 * day).length;
  const last30d = timestamps.filter(t => now - t < 30 * day).length;
  const prev30d = timestamps.filter(t => now - t < 60 * day && now - t >= 30 * day).length;
  
  // Trend break = recent velocity vs previous velocity
  const velocity7d = last7d / 7;
  const velocity30d = last30d / 30;
  const velocityPrev30d = prev30d / 30 || 0.01;
  
  // Trend break score
  const trendBreak = velocity7d / velocityPrev30d;
  
  return Math.min(trendBreak, 5); // Cap at 5x
}

// SECTION 2: SIGNAL MOMENTUM
function calculateMomentum(topic) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  const mentions7d = topic.timestamps.filter(t => now - t < 7 * day).length;
  const mentions30d = topic.timestamps.filter(t => now - t < 30 * day).length;
  
  if (mentions30d === 0) return 0;
  
  // Momentum = recent activity vs historical
  return (mentions7d / 7) / (mentions30d / 30);
}

// SECTION 3: CROSS SOURCE VALIDATION
function calculateCrossSourceScore(topic) {
  const uniqueSources = topic.sources.size;
  const totalEvidence = topic.evidence.length;
  
  if (totalEvidence === 0) return 0;
  
  // Cross source score = unique sources / total evidence
  // Higher score = more validation across sources
  return Math.min((uniqueSources / Math.sqrt(totalEvidence)), 1);
}

// SECTION 4: IMPACT
function calculateImpact(topic) {
  const m = topic.metrics;
  const totalEngagement = m.stars + (m.forks * 2) + (m.score * 3);
  
  // Log scale impact
  const impact = Math.log10(totalEngagement + 1) / 4;
  const sourceBonus = Math.min(topic.sources.size * 0.1, 0.2);
  
  return Math.min(impact + sourceBonus, 1);
}

// RECENCY
function calculateRecency(topic) {
  const hours = (Date.now() - new Date(topic.last_updated).getTime()) / 36e5;
  if (hours < 1) return 1;
  if (hours < 6) return 0.9;
  if (hours < 24) return 0.7;
  if (hours < 72) return 0.5;
  if (hours < 168) return 0.3;
  return 0.1;
}

// STABILITY
function calculateStability(topic) {
  const days = (Date.now() - new Date(topic.first_seen).getTime()) / (24 * 60 * 60 * 1000);
  return Math.min(days / 30, 1);
}

// SECTION 4: SIGNAL STRENGTH (NEW FORMULA)
function calculateSignalStrength(impact, velocity, recency, stability, crossSource, trendBreak) {
  return (
    0.25 * impact +
    0.20 * velocity +
    0.15 * recency +
    0.15 * stability +
    0.15 * crossSource +
    0.10 * Math.min(trendBreak / 3, 1) // Normalize trend break
  );
}

// SECTION 5: SIGNAL LIFECYCLE
function determineLifecycle(velocity, confidence, momentum, trendBreak, ageDays) {
  // Dead: no recent activity
  if (velocity < 0.1 && ageDays > 14) return 'dead';
  
  // Peak: maximum velocity, high momentum
  if (trendBreak > 3 && momentum > 2) return 'peak';
  
  // Accelerating: strong growth
  if (velocity > 1.5 && momentum > 1.3) return 'accelerating';
  
  // Forming: consistent activity
  if (velocity > 1.2 && confidence > 0.5) return 'forming';
  
  // Emerging: some validation
  if (confidence > 0.4 && velocity > 0.8) return 'emerging';
  
  return 'weak';
}

// TOPIC MERGE
function mergeSimilarTopics(topics) {
  const merged = [];
  const processed = new Set();
  
  const keywordGroups = {
    'ai': ['ai', 'llm', 'gpt', 'chatgpt', 'claude', 'gemini', 'model', 'gemma'],
    'agent': ['agent', 'autonomous', 'agentic', 'agentic workflow'],
    'video': ['video', 'video generation', 'sora', 'runway', 'pika'],
    'image': ['image', 'image generation', 'stable diffusion', 'midjourney', 'flux'],
    'speech': ['speech', 'tts', 'voice', 'audio', 'wav'],
    'code': ['code', 'coding', 'devin', 'programming', 'cursor'],
    'robot': ['robot', 'robotics', 'humanoid'],
    'quantum': ['quantum', 'qubit', 'qpu']
  };
  
  topics.forEach(topic => {
    if (processed.has(topic.topic)) return;
    
    const similar = topics.filter(t => {
      if (t.topic === topic.topic || processed.has(t.topic)) return false;
      
      for (const [group, keywords] of Object.entries(keywordGroups)) {
        const t1 = keywords.some(k => topic.topic.includes(k));
        const t2 = keywords.some(k => t.topic.includes(k));
        if (t1 && t2) return true;
      }
      
      const words1 = new Set(topic.topic.split(' '));
      const words2 = new Set(t.topic.split(' '));
      const overlap = [...words1].filter(w => words2.has(w)).length;
      return overlap > 0;
    });
    
    similar.forEach(s => {
      topic.evidence.push(...s.evidence);
      topic.timestamps.push(...s.timestamps);
      s.sources.forEach(src => topic.sources.add(src));
      topic.metrics.stars += s.metrics.stars;
      topic.metrics.forks += s.metrics.forks;
      topic.metrics.score += s.metrics.score;
      processed.add(s.topic);
    });
    
    merged.push(topic);
    processed.add(topic.topic);
  });
  
  return merged;
}

// MAIN PROCESSING
function processSignals(rawData) {
  let topics = extractTopics(rawData);
  topics = mergeSimilarTopics(topics);
  
  return topics.map(topic => {
    const impact = calculateImpact(topic);
    const velocity = calculateMomentum(topic);
    const recency = calculateRecency(topic);
    const stability = calculateStability(topic);
    const crossSource = calculateCrossSourceScore(topic);
    const trendBreak = calculateTrendBreak(topic);
    
    // Confidence based on sources
    let confidence = 0;
    topic.sources.forEach(s => confidence += SOURCE_WEIGHTS[s.toLowerCase()] || 0.5);
    confidence = (confidence / topic.sources.size) + Math.min(topic.evidence.length / 20, 0.3);
    confidence = Math.min(confidence, 1);
    
    const ageDays = (Date.now() - new Date(topic.first_seen).getTime()) / (24 * 60 * 60 * 1000);
    const lifecycle = determineLifecycle(velocity, confidence, calculateMomentum(topic), trendBreak, ageDays);
    
    const signalStrength = calculateSignalStrength(
      impact, velocity, recency, stability, crossSource, trendBreak
    );
    
    return {
      topic: topic.topic,
      stage: lifecycle,
      signal_strength: Math.round(signalStrength * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      velocity: Math.round(velocity * 100) / 100,
      momentum: Math.round(calculateMomentum(topic) * 100) / 100,
      trend_break: Math.round(trendBreak * 100) / 100,
      impact_score: Math.round(impact * 100) / 100,
      cross_source: Math.round(crossSource * 100) / 100,
      evidence_count: topic.evidence.length,
      sources: Array.from(topic.sources),
      metrics: topic.metrics,
      first_seen: topic.first_seen,
      last_updated: topic.last_updated
    };
  }).sort((a, b) => b.signal_strength - a.signal_strength);
}

module.exports = { processSignals };
