/**
 * L2: Event Graph
 * 
 * 事实节点→事件卡片→证据链
 * → event_registry.json + evidence_map
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  inputDir: '/home/nice005/.openclaw/workspace/signal-market/output/clean',
  outputDir: '/home/nice005/.openclaw/workspace/signal-market/output/events'
};

// 事件阶段
const STAGES = ['emerging', 'forming', 'accelerating', 'peak', 'fading', 'resolved'];

// 预定义主题关键词
const TOPIC_KEYWORDS = {
  '商业航天': ['space', '航天', 'rocket', 'satellite', 'spacex'],
  'AI算力': ['ai', 'nvidia', 'gpu', 'compute', '算力', '芯片'],
  '机器人': ['robot', '机器人', 'automation', '人形机器人'],
  '加密货币': ['crypto', 'bitcoin', 'btc', 'eth', '币'],
  '美股宏观': ['fed', 'rate', 'inflation', 'macro', '美联储']
};

function getDatePath() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

function readFacts(datePath) {
  const filepath = path.join(CONFIG.inputDir, datePath, 'facts.jsonl');
  if (!fs.existsSync(filepath)) return [];
  
  const content = fs.readFileSync(filepath, 'utf8');
  return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function clusterByTopic(facts) {
  // 简化聚类：按主题关键词分组
  const clusters = {};
  
  for (const fact of facts) {
    const dataStr = JSON.stringify(fact.data).toLowerCase();
    let matched = false;
    
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(k => dataStr.includes(k))) {
        if (!clusters[topic]) clusters[topic] = [];
        clusters[topic].push(fact);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      // 未匹配的归入 "其他"
      if (!clusters['其他']) clusters['其他'] = [];
      clusters['其他'].push(fact);
    }
  }
  
  return clusters;
}

function inferStage(facts) {
  // 简化阶段判断：基于可信度和数据新鲜度
  const avgCredibility = facts.reduce((a, b) => a + b.credibility, 0) / facts.length;
  const hoursOld = facts.length > 0 
    ? (Date.now() - new Date(facts[0].timestamp).getTime()) / (1000 * 60 * 60)
    : 24;
  
  if (hoursOld < 6) return 'emerging';
  if (hoursOld < 24) return 'forming';
  if (hoursOld < 48 && avgCredibility > 0.7) return 'accelerating';
  if (avgCredibility > 0.8) return 'peak';
  return 'fading';
}

function generateEventTitle(topic, facts) {
  // 简化：从数据中提取标题
  if (topic === '加密货币' && facts[0]?.data?.symbol) {
    return `${facts[0].data.symbol} 市场动态`;
  }
  if (topic === 'AI算力') {
    return 'AI算力需求变化';
  }
  return `${topic} 相关事件`;
}

function buildEventGraph(facts, clusters) {
  const events = [];
  
  for (const [topic, topicFacts] of Object.entries(clusters)) {
    if (topicFacts.length === 0) continue;
    
    const stage = inferStage(topicFacts);
    
    const event = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic: topic,
      title: generateEventTitle(topic, topicFacts),
      stage: stage,
      stage_probs: {
        emerging: stage === 'emerging' ? 0.6 : 0.1,
        forming: stage === 'forming' ? 0.5 : 0.15,
        accelerating: stage === 'accelerating' ? 0.6 : 0.2,
        peak: stage === 'peak' ? 0.5 : 0.2,
        fading: stage === 'fading' ? 0.5 : 0.2,
        resolved: stage === 'resolved' ? 0.8 : 0.15
      },
      facts: topicFacts.map(f => ({
        fact_id: f.fact_id,
        source: f.source,
        credibility: f.credibility,
        timestamp: f.timestamp
      })),
      evidence_refs: topicFacts.map(f => f.fact_id),
      drivers: [], // 待填充
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    events.push(event);
  }
  
  return events;
}

function buildEvidenceMap(events) {
  const map = {};
  
  for (const event of events) {
    for (const fact of event.facts) {
      map[fact.fact_id] = {
        fact_id: fact.fact_id,
        event_id: event.event_id,
        event_topic: event.topic,
        source: fact.source,
        credibility: fact.credibility,
        timestamp: fact.timestamp
      };
    }
  }
  
  return map;
}

async function runEventGraph() {
  const datePath = getDatePath();
  const outputDir = path.join(CONFIG.outputDir, datePath);
  
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('📥 Reading facts...');
  const facts = readFacts(datePath);
  console.log(`  Found ${facts.length} facts`);
  
  console.log('🔗 Clustering by topic...');
  const clusters = clusterByTopic(facts);
  console.log(`  Created ${Object.keys(clusters).length} topic clusters`);
  
  console.log('🎯 Building event graph...');
  const events = buildEventGraph(facts, clusters);
  console.log(`  Generated ${events.length} events`);
  
  console.log('📊 Building evidence map...');
  const evidenceMap = buildEvidenceMap(events);
  
  // 写入 event_registry.json
  const registryPath = path.join(outputDir, 'event_registry.json');
  fs.writeFileSync(registryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    event_count: events.length,
    events: events
  }, null, 2));
  
  // 写入 evidence_map.json
  const mapPath = path.join(outputDir, 'evidence_map.json');
  fs.writeFileSync(mapPath, JSON.stringify(evidenceMap, null, 2));
  
  console.log(`\n✅ L2 Event Graph complete:`);
  console.log(`   Events: ${events.length}`);
  console.log(`   Evidence refs: ${Object.keys(evidenceMap).length}`);
  
  return { events, evidenceMap };
}

if (require.main === module) {
  runEventGraph().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runEventGraph, CONFIG };
