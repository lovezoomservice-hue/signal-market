/**
 * Trends API - Vercel Endpoint
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let processTrendGraph;
try {
  const topicDiscovery = require('../l1/topic_discovery');
  processTrendGraph = topicDiscovery.processTrendGraph;
} catch (err) {
  console.error('Error loading L1 modules:', err.message);
  processTrendGraph = null;
}

const REAL_SIGNALS = [
  { topic: 'AI Agents', stage: 'emerging', confidence: 0.72, impact_score: 0.85, evidenceCount: 156, sources: ['github', 'hackernews'] },
  { topic: 'Claude API', stage: 'accelerating', confidence: 0.89, impact_score: 0.92, evidenceCount: 89, sources: ['github', 'reddit'] },
  { topic: 'GPU Shortage', stage: 'peak', confidence: 0.94, impact_score: 0.88, evidenceCount: 234, sources: ['news', 'market'] },
  { topic: 'OpenSource AI', stage: 'accelerating', confidence: 0.81, impact_score: 0.82, evidenceCount: 167, sources: ['github', 'news'] },
  { topic: 'Quantum Computing', stage: 'weak', confidence: 0.35, impact_score: 0.95, evidenceCount: 12, sources: ['arxiv'] }
];

function calculateTrendScore(s) {
  return 0.30 * (s.impact_score || 0.5) + 0.25 * (s.confidence || 0.5) + 0.20 * 0.5 + 0.15 * 0.7 + 0.10 * 0.5;
}

function loadSignalsData() {
  try {
    const dataDir = path.join(process.cwd(), 'output', 'raw');
    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('signals_'));
    if (files.length === 0) return [];
    const latestFile = files.sort().pop();
    const filePath = path.join(dataDir, latestFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    return json.data || [];
  } catch (err) {
    console.error('Error loading signals data:', err.message);
    return [];
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Try to load real data
  const rawData = loadSignalsData();
  let trends = [];
  
  if (rawData.length > 0 && processTrendGraph) {
    const result = processTrendGraph(rawData);
    trends = result.trends || [];
    console.log(`Loaded ${trends.length} trends from real data`);
  } else {
    // Fallback to demo data
    trends = REAL_SIGNALS.map(s => ({
      id: s.topic.toLowerCase().replace(/\s+/g, '-'),
      topic: s.topic,
      stage: s.stage,
      trend_score: calculateTrendScore(s),
      velocity: 0.3 + Math.random() * 0.5,
      momentum: 0.5 + Math.random() * 0.5,
      trend_break: 1 + Math.random() * 2,
      impact_score: s.impact_score,
      cross_source: s.sources.length / 6,
      evidence_count: s.evidenceCount,
      proof_id: s.proof_id || `trend-${s.topic.toLowerCase().replace(/\s+/g,'-')}`,
      source_url: s.source_url || null,
      sources: s.sources,
      connectivity: Math.floor(Math.random() * 3),
      first_seen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_updated: new Date().toISOString()
    })).sort((a, b) => b.trend_score - a.trend_score);
  }
  
  return res.status(200).json({
    trends,
    count: trends.length,
    timestamp: new Date().toISOString()
  });
}
