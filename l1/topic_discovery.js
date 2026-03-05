/**
 * Signal Intelligence Engine v3
 * Technology Trend Graph
 */

const https = require('https');

// Source weights
const SOURCE_WEIGHTS = {
  github: 0.9, hackernews: 0.7, arxiv: 0.95, techcrunch: 0.8, reddit: 0.4, twitter: 0.3
};

// Topic clusters / keywords
const TOPIC_CLUSTERS = {
  'ai-coding': ['code', 'coding', 'devin', 'cursor', 'roocode', 'v0', 'bolt', 'replit', 'powermode', 'cline', 'continue'],
  'ai-agent': ['agent', 'agentic', 'autonomous', 'crewai', 'langchain', 'autogen', 'swarms', 'agentops'],
  'video-generation': ['video', 'sora', 'runway', 'pika', 'kling', 'luma', 'runwayml'],
  'image-generation': ['image', 'stable-diffusion', 'midjourney', 'flux', 'dalle', 'imagen', 'playground'],
  'speech-tts': ['tts', 'speech', 'voice', 'audio', 'elevenlabs', 'coqui', 'bark', 'kokoro'],
  'llm-models': ['llm', 'gpt', 'claude', 'gemini', 'mistral', 'llama', 'qwen', 'gemma', 'phi', 'mixtral'],
  'robotics': ['robot', 'humanoid', 'figure', 'tesla-bot', 'unitree', 'boston'],
  'quantum': ['quantum', 'qubit', 'qpu', 'ibmq', 'ionq'],
  'biotech': ['crispr', 'protein', 'drug', 'biology', 'alphafold'],
  'security': ['security', 'hack', 'vulnerability', 'exploit', 'penetration'],
  'web3': ['blockchain', 'crypto', 'bitcoin', 'ethereum', 'defi', 'nft'],
  'infrastructure': ['kubernetes', 'docker', 'cloud', 'aws', 'azure', 'terraform']
};

// Build topic graph
function buildTrendGraph(rawData) {
  const nodes = {};
  const edges = [];
  
  // Process each item
  rawData.forEach(item => {
    const topic = (item.topic || item.title || '').toLowerCase();
    if (!topic) return;
    
    // Find cluster
    let cluster = 'uncategorized';
    for (const [name, keywords] of Object.entries(TOPIC_CLUSTERS)) {
      if (keywords.some(k => topic.includes(k))) {
        cluster = name;
        break;
      }
    }
    
    // Create or update node
    if (!nodes[cluster]) {
      nodes[cluster] = {
        id: cluster,
        name: cluster.replace('-', ' '),
        topics: new Set(),
        sources: new Set(),
        metrics: { stars: 0, forks: 0, score: 0 },
        evidence: [],
        timestamps: [],
        connections: new Set(),
        first_seen: item.timestamp,
        last_updated: item.timestamp
      };
    }
    
    const node = nodes[cluster];
    node.topics.add(topic);
    node.sources.add(item.source);
    node.evidence.push(item);
    node.timestamps.push(new Date(item.timestamp).getTime());
    node.last_updated = item.timestamp;
    
    if (item.stars) node.metrics.stars += item.stars;
    if (item.forks) node.metrics.forks += item.forks;
    if (item.score) node.metrics.score += item.score;
  });
  
  // Build edges (connections between clusters)
  const nodeList = Object.values(nodes);
  nodeList.forEach((node1, i) => {
    nodeList.slice(i + 1).forEach(node2 => {
      // Check for shared topics
      const shared = [...node1.topics].filter(t => node2.topics.has(t));
      if (shared.length > 0) {
        edges.push({ source: node1.id, target: node2.id, weight: shared.length });
        node1.connections.add(node2.id);
        node2.connections.add(node1.id);
      }
    });
  });
  
  return { nodes: Object.values(nodes), edges };
}

// Calculate metrics
function calculateMetrics(node) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  // Velocity
  const last7d = node.timestamps.filter(t => now - t < 7 * day).length;
  const last30d = node.timestamps.filter(t => now - t < 30 * day).length;
  const velocity = last30d > 0 ? (last7d / 7) / (last30d / 30) : 0;
  
  // Momentum
  const momentum = velocity;
  
  // Trend break
  const prev30d = node.timestamps.filter(t => now - t < 60 * day && now - t >= 30 * day).length;
  const trendBreak = prev30d > 0 ? (last7d / 7) / (prev30d / 30) : last7d > 0 ? last7d : 0;
  
  // Connectivity
  const connectivity = node.connections?.size || 0;
  
  // Cross source
  const crossSource = node.sources?.size / Math.sqrt(node.evidence?.length || 1);
  
  // Impact
  const m = node.metrics || {};
  const engagement = (m.stars || 0) + (m.forks || 0) * 2 + (m.score || 0) * 3;
  const impact = Math.log10(engagement + 1) / 5;
  
  // Recency
  const lastUpdated = node.last_updated ? new Date(node.last_updated).getTime() : now;
  const hoursSince = (now - lastUpdated) / 36e5;
  const recency = hoursSince < 1 ? 1 : hoursSince < 6 ? 0.9 : hoursSince < 24 ? 0.7 : hoursSince < 72 ? 0.5 : hoursSince < 168 ? 0.3 : 0.1;
  
  // Stability
  const firstSeen = node.first_seen ? new Date(node.first_seen).getTime() : now;
  const stability = Math.min((now - firstSeen) / (30 * day), 1);
  
  // Confidence
  let confidence = 0;
  node.sources?.forEach(s => confidence += SOURCE_WEIGHTS[s.toLowerCase()] || 0.5);
  confidence = node.sources?.size ? confidence / node.sources.size : 0;
  confidence += Math.min((node.evidence?.length || 0) / 30, 0.4);
  
  return {
    velocity: Math.min(velocity, 3),
    momentum: Math.min(momentum, 3),
    trendBreak: Math.min(trendBreak, 5),
    connectivity: Math.min(connectivity, 10),
    crossSource: Math.min(crossSource, 1),
    impact: Math.min(impact, 1),
    recency,
    stability,
    confidence: Math.min(confidence, 1)
  };
}

// Determine lifecycle
function determineLifecycle(metrics, ageDays) {
  const { velocity, momentum, trendBreak, confidence } = metrics;
  
  if (velocity < 0.1 && ageDays > 14) return 'dead';
  if (trendBreak > 3 && momentum > 2.5 && confidence > 0.7 && ageDays > 7) return 'peak';
  if (trendBreak > 2 && momentum > 1.8 && confidence > 0.6) return 'accelerating';
  if (trendBreak > 1.5 && momentum > 1.3 && confidence > 0.5) return 'forming';
  if (confidence > 0.4 && velocity > 0.6) return 'emerging';
  return 'weak';
}

// Calculate trend score
function calculateTrendScore(impact, velocity, momentum, crossSource, connectivity) {
  return (
    0.30 * impact +
    0.20 * velocity +
    0.15 * momentum +
    0.15 * crossSource +
    0.20 * Math.min(connectivity / 5, 1)
  );
}

// Detect clusters
function detectTrendClusters(nodes) {
  const clusters = [];
  const processed = new Set();
  
  // Group by similarity
  nodes.forEach(node => {
    if (processed.has(node.id)) return;
    
    const cluster = {
      name: node.name,
      nodes: [node.id],
      totalEvidence: node.evidence?.length || 0,
      totalConnections: node.connections?.size || 0
    };
    
    // Find related nodes
    nodes.forEach(other => {
      if (other.id === node.id || processed.has(other.id)) return;
      if (other.connections?.has(node.id)) {
        cluster.nodes.push(other.id);
        cluster.totalEvidence += other.evidence?.length || 0;
        cluster.totalConnections += other.connections?.size || 0;
        processed.add(other.id);
      }
    });
    
    processed.add(node.id);
    clusters.push(cluster);
  });
  
  return clusters.sort((a, b) => b.totalEvidence - a.totalEvidence);
}

// Main processing
function processTrendGraph(rawData) {
  const { nodes, edges } = buildTrendGraph(rawData);
  
  // Process nodes
  const trends = nodes.map(node => {
    const metrics = calculateMetrics(node);
    const ageDays = (Date.now() - new Date(node.first_seen).getTime()) / (24 * 60 * 60 * 1000);
    
    const trendScore = calculateTrendScore(
      metrics.impact,
      metrics.velocity,
      metrics.momentum,
      metrics.crossSource,
      metrics.connectivity
    );
    
    return {
      id: node.id,
      topic: node.name,
      stage: determineLifecycle(metrics, ageDays),
      trend_score: Math.round(trendScore * 100) / 100,
      connectivity: metrics.connectivity,
      velocity: Math.round(metrics.velocity * 100) / 100,
      momentum: Math.round(metrics.momentum * 100) / 100,
      trend_break: Math.round(metrics.trendBreak * 100) / 100,
      impact_score: Math.round(metrics.impact * 100) / 100,
      cross_source: Math.round(metrics.crossSource * 100) / 100,
      evidence_count: node.evidence?.length || 0,
      topics_count: node.topics?.size || 0,
      sources: Array.from(node.sources || []),
      connections: Array.from(node.connections || []),
      first_seen: node.first_seen,
      last_updated: node.last_updated
    };
  }).sort((a, b) => b.trend_score - a.trend_score);
  
  // Detect clusters
  const clusters = detectTrendClusters(nodes);
  
  return {
    trends,
    clusters,
    edges: edges.map(e => ({ source: e.source, target: e.target, weight: e.weight })),
    summary: {
      total_trends: trends.length,
      total_clusters: clusters.length,
      total_connections: edges.length,
      avg_trend_score: trends.length > 0 ? Math.round(trends.reduce((a, b) => a + b.trend_score, 0) / trends.length * 100) / 100 : 0
    }
  };
}

module.exports = { processTrendGraph };
