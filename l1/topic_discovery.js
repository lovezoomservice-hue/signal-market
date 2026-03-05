/**
 * L1: Topic Discovery & Signal Engine
 * Real signal processing with authentic metrics
 */

const https = require('https');

// Signal stages
const STAGES = ['weak', 'emerging', 'forming', 'accelerating', 'peak', 'fading'];

// Source trust weights
const SOURCE_WEIGHTS = {
  github: 0.9,      // High trust - verified data
  hackernews: 0.7,  // Medium-high trust - community
  arxiv: 0.95,      // Very high trust - academic
  techcrunch: 0.8,  // High trust - verified news
  reddit: 0.4,      // Lower trust - variable
  twitter: 0.3     // Low trust - unverified
};

// Extract topics from raw data
function extractTopics(rawData) {
  const topics = new Map();
  
  rawData.forEach(item => {
    const topic = item.topic || item.title;
    if (!topic) return;
    
    // Normalize topic
    const normalized = normalizeTopic(topic);
    
    if (!topics.has(normalized)) {
      topics.set(normalized, {
        topic: normalized,
        original: topic,
        sources: new Set(),
        metrics: {
          stars: 0,
          forks: 0,
          score: 0,
          citations: 0,
          funding: 0
        },
        evidence: [],
        first_seen: item.timestamp,
        last_updated: item.timestamp
      });
    }
    
    const t = topics.get(normalized);
    t.sources.add(item.source);
    t.evidence.push(item);
    t.last_updated = item.timestamp;
    
    // Accumulate real metrics
    if (item.stars) t.metrics.stars += item.stars;
    if (item.forks) t.metrics.forks += item.forks;
    if (item.score) t.metrics.score += item.score;
  });
  
  return Array.from(topics.values());
}

// Normalize topic names
function normalizeTopic(topic) {
  if (!topic) return '';
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}

// Calculate REAL impact score
function calculateImpact(topic) {
  const m = topic.metrics;
  
  // Impact = log of total engagement
  const totalEngagement = m.stars + (m.forks * 2) + (m.score * 3);
  
  // Log scale to prevent outliers from dominating
  const impact = Math.log10(totalEngagement + 1) / 4; // Normalize to 0-1
  
  // Source diversity bonus
  const sourceBonus = Math.min(topic.sources.size * 0.1, 0.2);
  
  return Math.min(impact + sourceBonus, 1);
}

// Calculate REAL velocity (growth rate)
function calculateVelocity(topic) {
  const evidence = topic.evidence;
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  // Count evidence in last 7 days vs 30 days
  const last7days = evidence.filter(e => now - new Date(e.timestamp).getTime() < 7 * day).length;
  const last30days = evidence.filter(e => now - new Date(e.timestamp).getTime() < 30 * day).length;
  
  if (last30days === 0) return 1;
  
  // Velocity = ratio of recent to historical activity
  const velocity = (last7days / 7) / (last30days / 30);
  
  return Math.min(velocity, 3); // Cap at 3x
}

// Calculate REAL confidence score
function calculateConfidence(topic) {
  let confidence = 0;
  
  // Source trust weighted by presence
  topic.sources.forEach(source => {
    confidence += SOURCE_WEIGHTS[source.toLowerCase()] || 0.5;
  });
  
  // Normalize by number of sources
  confidence = confidence / topic.sources.size;
  
  // Evidence count bonus
  confidence += Math.min(topic.evidence.length / 20, 0.3);
  
  return Math.min(confidence, 1);
}

// Calculate recency score
function calculateRecency(topic) {
  const hoursSinceUpdate = (Date.now() - new Date(topic.last_updated).getTime()) / 36e5;
  
  if (hoursSinceUpdate < 1) return 1;
  if (hoursSinceUpdate < 6) return 0.9;
  if (hoursSinceUpdate < 24) return 0.7;
  if (hoursSinceUpdate < 72) return 0.5;
  if (hoursSinceUpdate < 168) return 0.3; // 1 week
  return 0.1;
}

// Calculate stability
function calculateStability(topic) {
  const daysActive = (Date.now() - new Date(topic.first_seen).getTime()) / (24 * 60 * 60 * 1000);
  return Math.min(daysActive / 30, 1); // Cap at 30 days
}

// Determine stage based on REAL metrics
function determineStage(velocity, confidence, impact, ageDays) {
  // Very new topics
  if (ageDays < 3) return 'weak';
  
  // High velocity + high confidence = accelerating
  if (velocity > 1.5 && confidence > 0.6) return 'accelerating';
  
  // Strong signals forming
  if (velocity > 1.2 && confidence > 0.5) return 'forming';
  
  // Emerging patterns
  if (confidence > 0.4) return 'emerging';
  
  return 'weak';
}

// Calculate FINAL signal priority
function calculatePriority(impact, confidence, velocity, recency, stability) {
  return (
    0.30 * impact +
    0.25 * confidence +
    0.20 * velocity +
    0.15 * recency +
    0.10 * stability
  );
}

// Topic merge using keyword similarity
function mergeSimilarTopics(topics) {
  const merged = [];
  const processed = new Set();
  
  // Keywords that indicate same topic
  const keywordGroups = {
    'ai': ['ai', 'llm', 'gpt', 'chatgpt', 'claude', 'gemini', 'model'],
    'agent': ['agent', 'autonomous', 'agentic'],
    'video': ['video', 'video generation', 'sora', 'runway'],
    'image': ['image', 'image generation', 'stable diffusion', 'midjourney'],
    'speech': ['speech', 'tts', 'voice', 'audio'],
    'code': ['code', 'coding', 'devin', 'programming']
  };
  
  topics.forEach(topic => {
    if (processed.has(topic.topic)) return;
    
    // Find similar topics
    const similar = topics.filter(t => {
      if (t.topic === topic.topic || processed.has(t.topic)) return false;
      
      // Check keyword groups
      for (const [group, keywords] of Object.entries(keywordGroups)) {
        const t1Matches = keywords.some(k => topic.topic.includes(k));
        const t2Matches = keywords.some(k => t.topic.includes(k));
        if (t1Matches && t2Matches) return true;
      }
      
      // Also check word overlap
      const words1 = new Set(topic.topic.split(' '));
      const words2 = new Set(t.topic.split(' '));
      const overlap = [...words1].filter(w => words2.has(w)).length;
      return overlap > 0;
    });
    
    // Merge into main topic
    similar.forEach(s => {
      topic.evidence.push(...s.evidence);
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

// Main signal processing
function processSignals(rawData) {
  // Extract topics
  let topics = extractTopics(rawData);
  
  // Merge similar topics
  topics = mergeSimilarTopics(topics);
  
  // Calculate metrics for each topic
  return topics.map(topic => {
    const impact = calculateImpact(topic);
    const confidence = calculateConfidence(topic);
    const velocity = calculateVelocity(topic);
    const recency = calculateRecency(topic);
    const stability = calculateStability(topic);
    
    const ageDays = (Date.now() - new Date(topic.first_seen).getTime()) / (24 * 60 * 60 * 1000);
    const stage = determineStage(velocity, confidence, impact, ageDays);
    const priority = calculatePriority(impact, confidence, velocity, recency, stability);
    
    return {
      topic: topic.topic,
      original_topics: [topic.original],
      stage,
      confidence: Math.round(confidence * 100) / 100,
      velocity: Math.round(velocity * 100) / 100,
      impact_score: Math.round(impact * 100) / 100,
      priority: Math.round(priority * 100) / 100,
      evidence_count: topic.evidence.length,
      sources: Array.from(topic.sources),
      metrics: topic.metrics,
      first_seen: topic.first_seen,
      last_updated: topic.last_updated
    };
  }).sort((a, b) => b.priority - a.priority);
}

module.exports = {
  processSignals,
  calculatePriority,
  determineStage
};
