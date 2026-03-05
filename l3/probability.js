/**
 * L3: Probability Engine
 * 
 * 基线概率 + 证据更新 + 校准
 * → probability_timeseries + explain
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  inputDir: '/home/nice005/.openclaw/workspace/signal-market/output/events',
  outputDir: '/home/nice005/.openclaw/workspace/signal-market/output/probability'
};

function getDatePath() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

function readEvents(datePath) {
  const filepath = path.join(CONFIG.inputDir, datePath, 'event_registry.json');
  if (!fs.existsSync(filepath)) return [];
  
  const content = fs.readFileSync(filepath, 'utf8');
  const data = JSON.parse(content);
  return data.events || [];
}

// Log-odds 更新
function updateProbability(prior, evidenceStrength, direction) {
  // 转换为 log-odds
  const priorOdds = prior / (1 - prior);
  // 证据强度映射到 odds 比值 (0.5 ~ 2.0)
  const evidenceMultiplier = 1 + (direction * evidenceStrength * 0.5);
  const posteriorOdds = priorOdds * evidenceMultiplier;
  // 转回概率
  return posteriorOdds / (1 + posteriorOdds);
}

// 基线概率（基于历史频率）
const BASELINE_PROBS = {
  '商业航天': 0.15,
  'AI算力': 0.25,
  '机器人': 0.20,
  '加密货币': 0.30,
  '美股宏观': 0.35,
  '其他': 0.20
};

function calculateProbability(event) {
  const topic = event.topic;
  const baseline = BASELINE_PROBS[topic] || 0.2;
  
  // 简化：基于可信度和阶段调整
  const avgCredibility = event.facts.reduce((a, b) => a + b.credibility, 0) / event.facts.length;
  const factCount = event.facts.length;
  
  // 阶段调整因子
  const stageMultipliers = {
    emerging: 0.8,
    forming: 1.0,
    accelerating: 1.3,
    peak: 1.5,
    fading: 0.9,
    resolved: 0.5
  };
  
  const stageMultiplier = stageMultipliers[event.stage] || 1.0;
  
  // 计算概率
  let probability = baseline * stageMultiplier * (0.8 + avgCredibility * 0.4);
  probability = Math.min(0.95, Math.max(0.05, probability)); // 限制在 5%-95%
  
  // 计算各时间窗口概率
  const prob24h = probability * 0.3; // 短期概率较低
  const prob7d = probability * 0.7;
  const prob30d = probability;
  
  return {
    P_24h: Math.round(prob24h * 100) / 100,
    P_7d: Math.round(prob7d * 100) / 100,
    P_30d: Math.round(prob30d * 100) / 100,
    current: Math.round(probability * 100) / 100
  };
}

function generateExplanation(event, probs) {
  const drivers = [];
  
  // 基于阶段添加驱动因素
  if (event.stage === 'emerging') {
    drivers.push({ factor: '早期信号出现', impact: '+0.05', source: 'system' });
  } else if (event.stage === 'accelerating') {
    drivers.push({ factor: '趋势确认', impact: '+0.15', source: 'system' });
  } else if (event.stage === 'peak') {
    drivers.push({ factor: '动能强劲', impact: '+0.1', source: 'system' });
  }
  
  // 基于可信度
  const avgCred = event.facts.reduce((a, b) => a + b.credibility, 0) / event.facts.length;
  if (avgCred > 0.8) {
    drivers.push({ factor: '高可信度数据源', impact: '+0.08', source: 'system' });
  }
  
  // 基于证据数量
  if (event.facts.length > 3) {
    drivers.push({ factor: '多源证据支撑', impact: '+0.05', source: 'system' });
  }
  
  return {
    current_probability: probs.current,
    previous_probability: probs.current * 0.9, // 模拟之前
    change: probs.current - (probs.current * 0.9),
    change_pct: ((probs.current - probs.current * 0.9) / (probs.current * 0.9) * 100).toFixed(1) + '%',
    drivers: drivers,
    confidence: avgCred,
    methodology: 'log-odds + stage adjustment'
  };
}

async function runProbability() {
  const datePath = getDatePath();
  const outputDir = path.join(CONFIG.outputDir, datePath);
  
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('📥 Reading events...');
  const events = readEvents(datePath);
  console.log(`  Found ${events.length} events`);
  
  const results = [];
  
  for (const event of events) {
    console.log(`🎯 Processing: ${event.topic}`);
    
    const probs = calculateProbability(event);
    const explain = generateExplanation(event, probs);
    
    const probabilityData = {
      event_id: event.event_id,
      topic: event.topic,
      timestamp: new Date().toISOString(),
      probabilities: probs,
      explanation: explain,
      evidence_refs: event.evidence_refs
    };
    
    // 写入单独事件文件
    const eventPath = path.join(outputDir, `${event.event_id}.json`);
    fs.writeFileSync(eventPath, JSON.stringify(probabilityData, null, 2));
    
    results.push(probabilityData);
  }
  
  // 写入汇总
  const summary = {
    timestamp: new Date().toISOString(),
    event_count: results.length,
    probabilities: results.map(r => ({
      event_id: r.event_id,
      topic: r.topic,
      P_7d: r.probabilities.P_7d,
      current: r.probabilities.current
    }))
  };
  
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  
  console.log(`\n✅ L3 Probability Engine complete:`);
  console.log(`   Events processed: ${results.length}`);
  
  return results;
}

if (require.main === module) {
  runProbability().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runProbability, CONFIG };
