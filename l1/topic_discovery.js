/**
 * L1: Topic Discovery & Signal Engine
 * Transform raw data into structured signals
 */

const https = require('https');

// Signal stages
const STAGES = ['weak', 'emerging', 'forming', 'accelerating', 'peak', 'fading'];

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
        evidence: [],
        signals: [],
        first_seen: item.timestamp,
        last_updated: item.timestamp
      });
    }
    
    const t = topics.get(normalized);
    t.sources.add(item.source);
    t.evidence.push(item);
    t.last_updated = item.timestamp;
    
    // Calculate signal metrics
    if (item.stars) t.signals.push({ type: 'stars', value: item.stars, timestamp: item.timestamp });
    if (item.score) t.signals.push({ type: 'score', value: item.score, timestamp: item.timestamp });
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

// Calculate confidence score
function calculateConfidence(topic) {
  const sourceCount = topic.sources.size;
  const evidenceCount = topic.evidence.length;
  
  // Base confidence from evidence
  let confidence = Math.min(evidenceCount / 10, 1) * 0.4;
  
  // Add source diversity bonus
  confidence += (sourceCount / 5) * 0.3;
  
  // Recent activity bonus
  const hoursSinceUpdate = (Date.now() - new Date(topic.last_updated).getTime()) / 36e5;
  if (hoursSinceUpdate < 24) confidence += 0.3;
  else if (hoursSinceUpdate < 72) confidence += 0.15;
  
  return Math.min(confidence, 1);
}

// Calculate velocity (momentum)
function calculateVelocity(signals) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  const last7days = signals.filter(s => now - new Date(s.timestamp).getTime() < 7 * day);
  const last30days = signals.filter(s => now - new Date(s.timestamp).getTime() < 30 * day);
  
  const avg7 = last7days.length / 7;
  const avg30 = last30days.length / 30;
  
  if (avg30 === 0) return 1;
  return avg7 / avg30;
}

// Calculate impact score
function calculateImpact(topic) {
  const evidenceCount = topic.evidence.length;
  const sourcesCount = topic.sources.size;
  
  // More sources = higher impact
  let impact = Math.min(sourcesCount / 5, 1) * 0.5;
  
  // More evidence = higher impact  
  impact += Math.min(evidenceCount / 50, 1) * 0.5;
  
  return Math.min(impact, 1);
}

// Determine stage based on metrics
function determineStage(velocity, confidence, ageDays) {
  if (ageDays < 3 || velocity > 2) return 'weak';
  if (velocity > 1.5 && confidence > 0.5) return 'accelerating';
  if (velocity > 1.2 && confidence > 0.4) return 'forming';
  if (confidence > 0.3) return 'emerging';
  return 'weak';
}

// Calculate final signal priority
function calculatePriority(impact, confidence, velocity, recency) {
  return (
    0.30 * impact +
    0.25 * confidence +
    0.20 * velocity +
    0.15 * recency +
    0.10 * Math.min(1, recency * 2)
  );
}

// Topic merge using similarity
function mergeSimilarTopics(topics) {
  const merged = [];
  const processed = new Set();
  
  topics.forEach(topic => {
    if (processed.has(topic.topic)) return;
    
    // Find similar topics
    const similar = topics.filter(t => {
      if (t.topic === topic.topic || processed.has(t.topic)) return false;
      return calculateSimilarity(topic.topic, t.topic) > 0.7;
    });
    
    // Merge into main topic
    similar.forEach(s => {
      topic.evidence.push(...s.evidence);
      s.sources.forEach(src => topic.sources.add(src));
      topic.signals.push(...s.signals);
      processed.add(s.topic);
    });
    
    merged.push(topic);
    processed.add(topic.topic);
  });
  
  return merged;
}

// Calculate topic similarity
function calculateSimilarity(t1, t2) {
  const words1 = new Set(t1.split(' '));
  const words2 = new Set(t2.split(' '));
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  
  return union > 0 ? intersection / union : 0;
}

// Main signal processing
function processSignals(rawData) {
  // Extract topics
  let topics = extractTopics(rawData);
  
  // Merge similar topics
  topics = mergeSimilarTopics(topics);
  
  // Calculate metrics for each topic
  return topics.map(topic => {
    const confidence = calculateConfidence(topic);
    const velocity = calculateVelocity(topic.signals);
    const impact = calculateImpact(topic);
    
    const ageDays = (Date.now() - new Date(topic.first_seen).getTime()) / (24 * 60 * 60 * 1000);
    const recency = Math.max(0, 1 - ageDays / 30);
    
    const stage = determineStage(velocity, confidence, ageDays);
    const priority = calculatePriority(impact, confidence, velocity, recency);
    
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
