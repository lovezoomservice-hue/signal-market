/**
 * Prediction Market Support
 * 
 * 支持预测市场事件概率
 * 接入 Polymarket, Manifold 等预测市场 API
 */

const https = require('https');

// 预测市场 API (免费)
const PREDICTION_APIS = {
  // Polymarket (需要 API key，这里用模拟)
  polymarket: null,
  
  // Omen (DAO)
  omen: 'https://api.omen.ethereum.link/markets',
  
  // Novi (预测市场)
  novi: null
};

function httpsGet(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

// 预定义事件列表（用于 MVP）
const ACTIVE_EVENTS = [
  {
    id: 'evt_iran_conflict',
    topic: 'Iran-Israel Conflict',
    description: '伊以冲突升级',
    horizon: '7d',
    base_probability: 0.35
  },
  {
    id: 'evt_fed_rate',
    topic: 'Fed Rate Cut',
    description: '美联储降息',
    horizon: '30d',
    base_probability: 0.25
  },
  {
    id: 'evt_ai_breakthrough',
    topic: 'AI Breakthrough',
    description: 'AI 重大突破',
    horizon: '90d',
    base_probability: 0.45
  },
  {
    id: 'evt_btc_100k',
    topic: 'BTC $100k',
    description: 'BTC 突破 10 万美元',
    horizon: '180d',
    base_probability: 0.30
  },
  {
    id: 'evt_recession',
    topic: 'US Recession',
    description: '美国经济衰退',
    horizon: '90d',
    base_probability: 0.20
  }
];

// 模拟预测市场概率（真实实现需要接入 API）
function getMarketProbability(eventId) {
  const event = ACTIVE_EVENTS.find(e => e.id === eventId);
  if (!event) return null;
  
  // 添加随机波动 (±5%)
  const fluctuation = (Math.random() - 0.5) * 0.1;
  const probability = Math.max(0.05, Math.min(0.95, event.base_probability + fluctuation));
  
  return {
    event_id: eventId,
    topic: event.topic,
    description: event.description,
    horizon: event.horizon,
    probability: Math.round(probability * 100) / 100,
    probability_pct: Math.round(probability * 100) + '%',
    source: 'synthetic',
    timestamp: new Date().toISOString()
  };
}

// 获取所有预测市场事件
function getAllPredictions() {
  return ACTIVE_EVENTS.map(e => {
    const prob = getMarketProbability(e.id);
    return {
      event_id: e.id,
      topic: e.topic,
      description: e.description,
      horizon: e.horizon,
      probability: prob.probability,
      probability_pct: prob.probability_pct,
      timestamp: prob.timestamp
    };
  });
}

// 生成概率曲线（历史模拟）
function getProbabilityCurve(eventId, days = 30) {
  const event = ACTIVE_EVENTS.find(e => e.id === eventId);
  if (!event) return null;
  
  const curve = [];
  let prob = event.base_probability;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // 添加随机波动
    prob += (Math.random() - 0.5) * 0.05;
    prob = Math.max(0.05, Math.min(0.95, prob));
    
    curve.push({
      date: date.toISOString().split('T')[0],
      probability: Math.round(prob * 100) / 100,
      probability_pct: Math.round(prob * 100) + '%'
    });
  }
  
  return {
    event_id: eventId,
    topic: event.topic,
    horizon: event.horizon,
    curve: curve,
    current: curve[curve.length - 1].probability,
    change_7d: curve[curve.length - 1].probability - curve[curve.length - 8]?.probability || 0,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  ACTIVE_EVENTS,
  getMarketProbability,
  getAllPredictions,
  getProbabilityCurve
};

if (require.main === module) {
  console.log('=== Active Prediction Events ===');
  console.log(getAllPredictions());
  
  console.log('\n=== Probability Curve (Iran Conflict) ===');
  console.log(getProbabilityCurve('evt_iran_conflict', 7));
}
