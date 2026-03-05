/**
 * Trend Prediction Engine v4
 * Forecasting future technology trends
 */

const https = require('https');

// Source weights
const SOURCE_WEIGHTS = {
  github: 0.9, hackernews: 0.7, arxiv: 0.95, 
  producthunt: 0.8, crunchbase: 0.85, reddit: 0.4
};

// Topic clusters
const TOPIC_CLUSTERS = {
  'ai-coding': ['code', 'coding', 'devin', 'cursor', 'roocode', 'v0', 'bolt', 'replit', 'cline'],
  'ai-agent': ['agent', 'autonomous', 'crewai', 'langchain', 'autogen', 'swarms'],
  'video-gen': ['video', 'sora', 'runway', 'pika', 'kling'],
  'image-gen': ['image', 'stable-diffusion', 'midjourney', 'flux'],
  'llm': ['llm', 'gpt', 'claude', 'gemini', 'mistral', 'llama', 'qwen'],
  'robotics': ['robot', 'humanoid', 'figure'],
  'quantum': ['quantum', 'qubit']
};

// Build trend graph from data
function buildTrendGraph(rawData) {
  const nodes = {};
  
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
    
    if (!nodes[cluster]) {
      nodes[cluster] = {
        id: cluster,
        topics: new Set(),
        sources: new Set(),
        metrics: { stars: 0, forks: 0, score: 0, funding: 0 },
        evidence: [],
        timestamps: [],
        connections: new Set(),
        first_seen: item.timestamp,
        last_updated: item.timestamp
      };
    }
    
    const n = nodes[cluster];
    n.topics.add(topic);
    n.sources.add(item.source);
    n.evidence.push(item);
    n.timestamps.push(new Date(item.timestamp).getTime());
    n.last_updated = item.timestamp;
    
    if (item.stars) n.metrics.stars += item.stars;
    if (item.forks) n.metrics.forks += item.forks;
    if (item.score) n.metrics.score += item.score;
    if (item.amount) n.metrics.funding += item.amount;
  });
  
  return Object.values(nodes);
}

// ========== PREDICTION METRICS ==========

// 1. Growth Acceleration
function calculateGrowthAcceleration(node) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  const last7d = node.timestamps.filter(t => now - t < 7 * day).length;
  const last30d = node.timestamps.filter(t => now - t < 30 * day).length;
  
  const velocity7d = last7d / 7;
  const velocity30d = last30d / 30;
  
  if (velocity30d === 0) return last7d > 0 ? 3 : 0;
  
  return velocity7d / velocity30d;
}

// 2. Cross Source Expansion
function calculateCrossSourceExpansion(node) {
  const sources = Array.from(node.sources || []);
  const evidence = node.evidence?.length || 1;
  
  // Count unique platforms
  const platforms = new Set();
  sources.forEach(s => {
    if (['github', 'hackernews', 'reddit', 'producthunt'].includes(s)) platforms.add(s);
  });
  
  return Math.min(platforms.size / 4, 1);
}

// 3. Developer Activity
function calculateDeveloperActivity(node) {
  const m = node.metrics || {};
  const stars = m.stars || 0;
  const forks = m.forks || 0;
  
  // Normalize using log scale
  const activity = Math.log10(stars + forks * 2 + 1) / 5;
  return Math.min(activity, 1);
}

// 4. Research Activity
function calculateResearchActivity(node) {
  const sources = Array.from(node.sources || []);
  const hasResearch = sources.includes('arxiv') || sources.includes('huggingface');
  
  if (hasResearch) {
    return 0.8 + Math.min((node.evidence?.length || 0) / 20, 0.2);
  }
  return 0.2;
}

// 5. Capital Signal
function calculateCapitalSignal(node) {
  const m = node.metrics || {};
  const funding = m.funding || 0;
  
  // Normalize funding
  if (funding === 0) return 0.1;
  if (funding > 1000000000) return 1.0;
  if (funding > 100000000) return 0.8;
  if (funding > 10000000) return 0.6;
  if (funding > 1000000) return 0.4;
  return 0.2;
}

// Calculate connectivity
function calculateConnectivity(nodes) {
  const connections = {};
  
  nodes.forEach(n1 => {
    nodes.forEach(n2 => {
      if (n1.id === n2.id) return;
      const shared = [...n1.topics].filter(t => n2.topics.has(t));
      if (shared.length > 0) {
        connections[n1.id] = (connections[n1.id] || 0) + 1;
        connections[n2.id] = (connections[n2.id] || 0) + 1;
      }
    });
  });
  
  return connections;
}

// Lifecycle
function determineLifecycle(growthAccel, velocity) {
  if (growthAccel > 2.5 && velocity > 2) return 'exploding';
  if (growthAccel > 2) return 'accelerating';
  if (growthAccel > 1.5) return 'forming';
  if (velocity > 0.8) return 'emerging';
  return 'weak';
}

// Predict future trends
function predictTrends(rawData) {
  console.log('🔮 Building prediction model...');
  
  const nodes = buildTrendGraph(rawData);
  const connectivity = calculateConnectivity(nodes);
  
  console.log(`   Nodes: ${nodes.length}`);
  
  // Calculate predictions
  const predictions = nodes.map(node => {
    const growthAccel = calculateGrowthAcceleration(node);
    const crossSource = calculateCrossSourceExpansion(node);
    const devActivity = calculateDeveloperActivity(node);
    const researchActivity = calculateResearchActivity(node);
    const capital = calculateCapitalSignal(node);
    
    // PREDICTION SCORE
    const predictionScore = (
      0.30 * Math.min(growthAccel / 3, 1) +
      0.20 * crossSource +
      0.20 * devActivity +
      0.15 * researchActivity +
      0.15 * capital
    );
    
    const velocity = (node.timestamps?.length || 0) / 30;
    const lifecycle = determineLifecycle(growthAccel, velocity);
    
    // Forecast (simple extrapolation)
    const forecast = {
      next_30_days: predictionScore > 0.6 ? 'likely_accelerate' : predictionScore > 0.4 ? 'stable' : 'declining',
      confidence: Math.round(predictionScore * 100) / 100
    };
    
    return {
      id: node.id,
      topic: node.id.replace('-', ' '),
      prediction_score: Math.round(predictionScore * 100) / 100,
      growth_acceleration: Math.round(growthAccel * 100) / 100,
      cross_source_expansion: Math.round(crossSource * 100) / 100,
      developer_activity: Math.round(devActivity * 100) / 100,
      research_activity: Math.round(researchActivity * 100) / 100,
      capital_signal: Math.round(capital * 100) / 100,
      connectivity: connectivity[node.id] || 0,
      lifecycle: lifecycle,
      evidence_count: node.evidence?.length || 0,
      sources: Array.from(node.sources || []),
      forecast: forecast,
      first_seen: node.first_seen,
      last_updated: node.last_updated
    };
  });
  
  // Sort by prediction score
  predictions.sort((a, b) => b.prediction_score - a.prediction_score);
  
  return {
    predictions: predictions.slice(0, 20),
    summary: {
      total_trends: predictions.length,
      exploding: predictions.filter(p => p.lifecycle === 'exploding').length,
      accelerating: predictions.filter(p => p.lifecycle === 'accelerating').length,
      forming: predictions.filter(p => p.lifecycle === 'forming').length,
      emerging: predictions.filter(p => p.lifecycle === 'emerging').length,
      weak: predictions.filter(p => p.lifecycle === 'weak').length
    }
  };
}

module.exports = { predictTrends };
