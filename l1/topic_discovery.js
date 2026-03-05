/**
 * Signal Intelligence Engine v2.1
 * Normalized scoring, lifecycle logic, topic clustering
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

// Topic clusters
const TOPIC_CLUSTERS = {
  'ai-coding': ['code', 'coding', 'devin', 'cursor', 'roocode', 'v0', 'bolt', 'replit', 'lovable', 'powermode', 'cline', 'continue'],
  'ai-agent': ['agent', 'agentic', 'autonomous', 'crewai', 'langchain', 'autogen', 'swarms'],
  'video-generation': ['video', 'sora', 'runway', 'pika', 'kling', 'luma', 'pika', 'runway'],
  'image-generation': ['image', 'stable-diffusion', 'midjourney', 'flux', 'dalle', 'imagen', ' Playground'],
  'speech-tts': ['tts', 'speech', 'voice', 'audio', 'elevenlabs', 'coqui', 'bark'],
  'llm-models': ['llm', 'gpt', 'claude', 'gemini', 'mistral', 'llama', 'qwen', 'gemma', 'phi'],
  'robotics': ['robot', 'humanoid', 'figure', 'tesla-bot', 'unitree', 'boston'],
  'quantum': ['quantum', 'qubit', 'qpu', 'ibmq', 'ionq'],
  'biotech': ['crispr', 'protein', 'drug', 'biology', 'alphafold']
};

// Extract and cluster topics
function extractAndCluster(rawData) {
  // Group by cluster
  const clusters = {};
  const unclustered = [];
  
  rawData.forEach(item => {
    const topic = (item.topic || item.title || '').toLowerCase();
    let clustered = false;
    
    // Try to find cluster
    for (const [clusterName, keywords] of Object.entries(TOPIC_CLUSTERS)) {
      if (keywords.some(k => topic.includes(k))) {
        if (!clusters[clusterName]) {
          clusters[clusterName] = {
            name: clusterName,
            topics: [],
            sources: new Set(),
            metrics: { stars: 0, forks: 0, score: 0 },
            evidence: [],
            timestamps: [],
            first_seen: item.timestamp,
            last_updated: item.timestamp
          };
        }
        
        clusters[clusterName].topics.push(topic);
        clusters[clusterName].sources.add(item.source);
        clusters[clusterName].evidence.push(item);
        clusters[clusterName].timestamps.push(new Date(item.timestamp).getTime());
        
        if (item.stars) clusters[clusterName].metrics.stars += item.stars;
        if (item.forks) clusters[clusterName].metrics.forks += item.forks;
        if (item.score) clusters[clusterName].metrics.score += item.score;
        
        clusters[clusterName].last_updated = item.timestamp;
        
        clustered = true;
        break;
      }
    }
    
    if (!clustered) {
      unclustered.push(item);
    }
  });
  
  return { clusters, unclustered };
}

// ========== METRICS ==========

function calculateMetrics(topic) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  const timestamps = topic.timestamps || [];
  const timestampsSorted = timestamps.sort((a, b) => a - b);
  
  // Velocity (recent activity rate)
  const last7d = timestamps.filter(t => now - t < 7 * day).length;
  const last30d = timestamps.filter(t => now - t < 30 * day).length;
  const prev30d = timestamps.filter(t => now - t < 60 * day && now - t >= 30 * day).length;
  
  const velocity = last30d > 0 ? (last7d / 7) / (last30d / 30) : 0;
  
  // Momentum
  const momentum = last30d > 0 ? (last7d / 7) / (last30d / 30) : 0;
  
  // Trend break
  const prevRate = prev30d > 0 ? prev30d / 30 : 0.01;
  const trendBreak = last7d / 7 / prevRate;
  
  // Cross source
  const uniqueSources = topic.sources?.size || 0;
  const totalEvidence = topic.evidence?.length || 1;
  const crossSource = uniqueSources / Math.sqrt(totalEvidence);
  
  // Impact (log engagement)
  const m = topic.metrics || {};
  const engagement = (m.stars || 0) + (m.forks || 0) * 2 + (m.score || 0) * 3;
  const impact = Math.log10(engagement + 1) / 5;
  
  // Recency
  const lastUpdated = topic.last_updated ? new Date(topic.last_updated).getTime() : now;
  const hoursSince = (now - lastUpdated) / 36e5;
  const recency = hoursSince < 1 ? 1 : hoursSince < 6 ? 0.9 : hoursSince < 24 ? 0.7 : hoursSince < 72 ? 0.5 : hoursSince < 168 ? 0.3 : 0.1;
  
  // Stability
  const firstSeen = topic.first_seen ? new Date(topic.first_seen).getTime() : now;
  const daysActive = (now - firstSeen) / (day);
  const stability = Math.min(daysActive / 30, 1);
  
  // Confidence
  let confidence = 0;
  topic.sources?.forEach(s => confidence += SOURCE_WEIGHTS[s.toLowerCase()] || 0.5);
  confidence = topic.sources?.size ? confidence / topic.sources.size : 0;
  confidence += Math.min((topic.evidence?.length || 0) / 30, 0.4);
  
  return {
    velocity: Math.min(velocity, 3),
    momentum: Math.min(momentum, 3),
    trendBreak: Math.min(trendBreak, 5),
    crossSource: Math.min(crossSource, 1),
    impact: Math.min(impact, 1),
    recency,
    stability,
    confidence: Math.min(confidence, 1)
  };
}

// ========== LIFECYCLE LOGIC ==========

function determineLifecycle(metrics, ageDays) {
  const { velocity, momentum, trendBreak, confidence } = metrics;
  
  // Dead: no activity
  if (velocity < 0.1 && ageDays > 14) return 'dead';
  
  // Peak: very rare, must have strong signals
  // Only ~5% of signals should be peak
  if (trendBreak > 3 && momentum > 2.5 && confidence > 0.7 && ageDays > 7) return 'peak';
  
  // Accelerating: strong growth but not peak
  // ~15% of signals
  if (trendBreak > 2 && momentum > 1.8 && confidence > 0.6) return 'accelerating';
  
  // Forming: consistent growth
  // ~20% of signals  
  if (trendBreak > 1.5 && momentum > 1.3 && confidence > 0.5) return 'forming';
  
  // Emerging: some validation
  // ~25% of signals
  if (confidence > 0.4 && velocity > 0.6) return 'emerging';
  
  // Most signals should be weak (35%)
  return 'weak';
}

// ========== NORMALIZATION ==========

function normalizeScores(signals) {
  if (signals.length === 0) return signals;
  
  // Find min/max for each metric
  const getValues = (key) => signals.map(s => s.rawMetrics?.[key] || 0);
  
  const minMax = {
    signal_strength: { min: Math.min(...signals.map(s => s.signal_strength)), max: Math.max(...signals.map(s => s.signal_strength)) },
    velocity: { min: 0, max: 3 },
    momentum: { min: 0, max: 3 },
    trendBreak: { min: 0, max: 5 },
    confidence: { min: 0, max: 1 },
    impact: { min: 0, max: 1 },
    crossSource: { min: 0, max: 1 }
  };
  
  // Normalize
  return signals.map(s => {
    const raw = s.rawMetrics;
    const nm = minMax;
    
    return {
      ...s,
      normalized: {
        signal_strength: (s.signal_strength - nm.signal_strength.min) / (nm.signal_strength.max - nm.signal_strength.min + 0.001),
        velocity: raw.velocity / 3,
        momentum: raw.momentum / 3,
        trendBreak: raw.trendBreak / 5,
        confidence: raw.confidence,
        impact: raw.impact,
        crossSource: raw.crossSource
      }
    };
  });
}

// ========== MAIN PROCESSING ==========

function processSignals(rawData) {
  const { clusters, unclustered } = extractAndCluster(rawData);
  
  // Process each cluster as a topic signal
  let signals = Object.values(clusters).map(cluster => {
    const metrics = calculateMetrics(cluster);
    const ageDays = (Date.now() - new Date(cluster.first_seen).getTime()) / (24 * 60 * 60 * 1000);
    
    // Calculate signal strength (raw, before normalization)
    const signalStrength = (
      0.25 * metrics.impact +
      0.20 * metrics.velocity +
      0.15 * metrics.recency +
      0.15 * metrics.stability +
      0.15 * metrics.crossSource +
      0.10 * Math.min(metrics.trendBreak / 3, 1)
    );
    
    return {
      topic: cluster.name.replace('-', ' '),
      topic_cluster: cluster.name,
      stage: determineLifecycle(metrics, ageDays),
      signal_strength: Math.round(signalStrength * 100) / 100,
      confidence: Math.round(metrics.confidence * 100) / 100,
      velocity: Math.round(metrics.velocity * 100) / 100,
      momentum: Math.round(metrics.momentum * 100) / 100,
      trend_break: Math.round(metrics.trendBreak * 100) / 100,
      impact_score: Math.round(metrics.impact * 100) / 100,
      cross_source: Math.round(metrics.crossSource * 100) / 100,
      evidence_count: cluster.evidence?.length || 0,
      sources: Array.from(cluster.sources || []),
      rawMetrics: metrics,
      first_seen: cluster.first_seen,
      last_updated: cluster.last_updated
    };
  });
  
  // Add unclustered as individual signals
  const unclusteredSignals = unclustered.slice(0, 20).map(item => {
    const singleTopic = {
      name: item.topic || item.title,
      sources: new Set([item.source]),
      metrics: { stars: item.stars || 0, forks: item.forks || 0, score: item.score || 0 },
      evidence: [item],
      timestamps: [new Date(item.timestamp).getTime()],
      first_seen: item.timestamp,
      last_updated: item.timestamp
    };
    
    const metrics = calculateMetrics(singleTopic);
    const ageDays = (Date.now() - new Date(singleTopic.first_seen).getTime()) / (24 * 60 * 60 * 1000);
    
    const signalStrength = (
      0.25 * metrics.impact +
      0.20 * metrics.velocity +
      0.15 * metrics.recency +
      0.15 * metrics.stability +
      0.15 * metrics.crossSource +
      0.10 * Math.min(metrics.trendBreak / 3, 1)
    );
    
    return {
      topic: item.topic || item.title,
      topic_cluster: 'uncategorized',
      stage: determineLifecycle(metrics, ageDays),
      signal_strength: Math.round(signalStrength * 100) / 100,
      confidence: Math.round(metrics.confidence * 100) / 100,
      velocity: Math.round(metrics.velocity * 100) / 100,
      momentum: Math.round(metrics.momentum * 100) / 100,
      trend_break: Math.round(metrics.trendBreak * 100) / 100,
      impact_score: Math.round(metrics.impact * 100) / 100,
      cross_source: Math.round(metrics.crossSource * 100) / 100,
      evidence_count: 1,
      sources: [item.source],
      rawMetrics: metrics,
      first_seen: item.timestamp,
      last_updated: item.timestamp
    };
  });
  
  signals = [...signals, ...unclusteredSignals];
  
  // Normalize scores
  signals = normalizeScores(signals);
  
  // Sort by signal strength
  return signals.sort((a, b) => b.signal_strength - a.signal_strength);
}

module.exports = { processSignals };
