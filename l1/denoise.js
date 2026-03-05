/**
 * L1: Noise Control
 * 
 * 去重聚合 + 可信度评分 + 信息增量过滤
 * → clean_facts.jsonl
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  inputDir: '/home/nice005/.openclaw/workspace/signal-market/output/raw',
  outputDir: '/home/nice005/.openclaw/workspace/signal-market/output/clean'
};

// 源可信度权重
const SOURCE_CREDIBILITY = {
  binance: 0.95,      // 官方API，高可信
  hackernews: 0.7,    // 社区投票
  a_stock: 0.6,      // 模拟数据
  us_stock: 0.6,     // 模拟数据
  macro: 0.8         // 官方数据
};

function getDatePath() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

function readRawEvents(datePath) {
  const dir = path.join(CONFIG.inputDir, datePath);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  
  let events = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        events.push(JSON.parse(line));
      } catch (e) { /* skip */ }
    }
  }
  return events;
}

function deduplicate(events) {
  // 按source+type去重，保留最新
  const seen = new Map();
  
  for (const event of events) {
    const key = `${event.source}_${event.type}`;
    if (!seen.has(key) || new Date(event.timestamp) > new Date(seen.get(key).timestamp)) {
      seen.set(key, event);
    }
  }
  
  return Array.from(seen.values());
}

function scoreCredibility(event) {
  const base = SOURCE_CREDIBILITY[event.source] || 0.5;
  
  // 时间衰减：超过24小时的可信度降低
  const hoursOld = (Date.now() - new Date(event.timestamp).getTime()) / (1000 * 60 * 60);
  const decay = Math.max(0.5, 1 - hoursOld / 168); // 7天后最低0.5
  
  return Math.min(1, base * decay);
}

function filterNovelty(events) {
  // 简化：保留所有事件作为"事实"
  return events;
}

function transformToFacts(event) {
  const credibility = scoreCredibility(event);
  
  return {
    fact_id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source: event.source,
    type: event.type,
    timestamp: event.timestamp,
    data: event.data,
    credibility: credibility,
    // 信息增量（简化：所有事件都有价值）
    novelty_score: 0.8,
    // 影响范围（简化：基于数据类型）
    impact_scope: event.type === 'market' ? 'asset' : 'sector',
    // 原始路径
    raw_proof_path: event.proof_path || null,
    raw_event_id: event.event_id
  };
}

async function runDenoise() {
  const datePath = getDatePath();
  const outputDir = path.join(CONFIG.outputDir, datePath);
  
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('📥 Reading raw events...');
  const rawEvents = readRawEvents(datePath);
  console.log(`  Found ${rawEvents.length} raw events`);
  
  console.log('🔧 Deduplicating...');
  const deduped = deduplicate(rawEvents);
  console.log(`  ${deduped.length} unique events`);
  
  console.log('🎯 Scoring credibility...');
  const scored = deduped.map(e => ({ ...e, credibility: scoreCredibility(e) }));
  
  console.log('📦 Filtering novelty...');
  const filtered = filterNovelty(scored);
  
  console.log('✨ Transforming to facts...');
  const facts = filtered.map(transformToFacts);
  
  // 写入 clean_facts.jsonl
  const outputPath = path.join(outputDir, 'facts.jsonl');
  for (const fact of facts) {
    fs.appendFileSync(outputPath, JSON.stringify(fact) + '\n');
  }
  
  // 写入摘要
  const summary = {
    timestamp: new Date().toISOString(),
    input_count: rawEvents.length,
    output_count: facts.length,
    sources: {},
    avg_credibility: facts.reduce((a, b) => a + b.credibility, 0) / facts.length
  };
  
  for (const fact of facts) {
    summary.sources[fact.source] = (summary.sources[fact.source] || 0) + 1;
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  console.log(`\n✅ L1 Denoise complete: ${facts.length} facts written`);
  console.log(`   Average credibility: ${summary.avg_credibility.toFixed(2)}`);
  
  return summary;
}

if (require.main === module) {
  runDenoise().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runDenoise, CONFIG };
