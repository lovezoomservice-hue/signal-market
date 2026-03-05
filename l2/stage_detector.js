/**
 * Stage Detection Engine
 * 
 * A股/美股/币圈通用的阶段判定器
 * 最小特征集：价格/成交/波动、资金流、事件概率曲线、热度变化率
 */

const STAGE_DEFINITIONS = {
  emerging: {
    name: '启动',
    description: '早期迹象出现，趋势刚刚形成',
    indicators: ['价格开始上涨', '成交量放大', '关注度上升']
  },
  forming: {
    name: '形成',
    description: '趋势确认，更多参与者进入',
    indicators: ['持续上涨', '成交量稳定放大', '趋势线形成']
  },
  accelerating: {
    name: '主升',
    description: '趋势加速，动能最强',
    indicators: ['快速上涨', '成交量显著放大', '市场情绪高涨']
  },
  peaking: {
    name: '高潮',
    description: '接近顶部，波动加大',
    indicators: ['波动加大', '成交量异常', '出现分歧']
  },
  fading: {
    name: '退潮',
    description: '趋势结束，开始下跌',
    indicators: ['价格开始下跌', '成交量萎缩', '情绪转弱']
  },
  resolved: {
    name: '结束',
    description: '趋势完全结束',
    indicators: ['趋势反转', '新趋势形成', '盘整']
  }
};

function calculateStage(features) {
  const {
    priceMomentum = 0,      // 价格动量 (-1 ~ 1)
    volumeChange = 0,      // 成交量变化 (-1 ~ 1)
    volatility = 0,        // 波动率 (0 ~ 1)
    capitalFlow = 0,       // 资金流 (-1 ~ 1)
    eventProbability = 0,   // 事件概率 (0 ~ 1)
    heatChange = 0          // 热度变化 (-1 ~ 1)
  } = features;
  
  // 权重
  const weights = {
    priceMomentum: 0.30,
    volumeChange: 0.20,
    volatility: 0.15,
    capitalFlow: 0.20,
    eventProbability: 0.10,
    heatChange: 0.05
  };
  
  // 计算综合得分
  const score = 
    priceMomentum * weights.priceMomentum +
    volumeChange * weights.volumeChange +
    volatility * weights.volatility +
    capitalFlow * weights.capitalFlow +
    eventProbability * weights.eventProbability +
    heatChange * weights.heatChange;
  
  // 判断阶段
  let stage, confidence;
  
  if (score < -0.3) {
    stage = 'fading';
    confidence = Math.min(0.9, 0.6 + Math.abs(score));
  } else if (score < 0) {
    stage = 'forming';
    confidence = 0.6 + score * 0.5;
  } else if (score < 0.3) {
    stage = 'emerging';
    confidence = 0.5 + score;
  } else if (score < 0.6) {
    stage = 'accelerating';
    confidence = 0.7 + score * 0.3;
  } else {
    stage = 'peaking';
    confidence = 0.8 + (score - 0.6) * 0.2;
  }
  
  confidence = Math.min(0.95, Math.max(0.5, confidence));
  
  // 计算各阶段概率
  const stageProbs = calculateStageProbs(stage, score);
  
  return {
    stage,
    stageName: STAGE_DEFINITIONS[stage].name,
    confidence: Math.round(confidence * 100) / 100,
    score: Math.round(score * 100) / 100,
    stageProbs,
    indicators: STAGE_DEFINITIONS[stage].indicators,
    drivers: calculateDrivers(features)
  };
}

function calculateStageProbs(currentStage, score) {
  const base = {
    emerging: 0.1,
    forming: 0.15,
    accelerating: 0.25,
    peaking: 0.25,
    fading: 0.15,
    resolved: 0.1
  };
  
  // 根据当前得分调整
  const adjustment = score * 0.3;
  
  const probs = { ...base };
  
  if (score < -0.3) {
    probs.fading += adjustment;
    probs.accelerating -= adjustment;
  } else if (score > 0.3) {
    probs.peaking += adjustment;
    probs.emerging -= adjustment;
  } else if (score > 0) {
    probs.accelerating += adjustment * 0.5;
    probs.emerging += adjustment * 0.5;
  }
  
  // 归一化
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  for (const key in probs) {
    probs[key] = Math.round(probs[key] / total * 100) / 100;
  }
  
  return probs;
}

function calculateDrivers(features) {
  const drivers = [];
  
  if (features.priceMomentum > 0.3) {
    drivers.push({ factor: '价格动量强劲', impact: '+' + (features.priceMomentum * 0.15).toFixed(2) });
  } else if (features.priceMomentum < -0.3) {
    drivers.push({ factor: '价格动能减弱', impact: (features.priceMomentum * 0.15).toFixed(2) });
  }
  
  if (features.volumeChange > 0.3) {
    drivers.push({ factor: '成交量放大', impact: '+' + (features.volumeChange * 0.1).toFixed(2) });
  }
  
  if (features.capitalFlow > 0.3) {
    drivers.push({ factor: '资金流入', impact: '+' + (features.capitalFlow * 0.1).toFixed(2) });
  } else if (features.capitalFlow < -0.3) {
    drivers.push({ factor: '资金流出', impact: (features.capitalFlow * 0.1).toFixed(2) });
  }
  
  if (features.eventProbability > 0.5) {
    drivers.push({ factor: '事件概率支撑', impact: '+' + (features.eventProbability * 0.1).toFixed(2) });
  }
  
  if (features.heatChange > 0.3) {
    drivers.push({ factor: '热度上升', impact: '+' + (features.heatChange * 0.05).toFixed(2) });
  }
  
  return drivers;
}

// 从市场数据提取特征
function extractFeatures(marketData, eventProb = 0.5) {
  const { priceChange = 0, volumeChange = 0, volatility = 0.2, capitalFlow = 0 } = marketData;
  
  // 标准化到 -1 ~ 1
  const priceMomentum = Math.max(-1, Math.min(1, priceChange / 10));
  const volChange = Math.max(-1, Math.min(1, volumeChange / 50));
  const capFlow = Math.max(-1, Math.min(1, capitalFlow / 100));
  
  return {
    priceMomentum,
    volumeChange: volChange,
    volatility,
    capitalFlow: capFlow,
    eventProbability: eventProb,
    heatChange: volChange * 0.5 // 简化：用成交量变化近似热度
  };
}

module.exports = { calculateStage, extractFeatures, STAGE_DEFINITIONS };

if (require.main === module) {
  // 测试
  const testCases = [
    { priceChange: 5, volumeChange: 30, capitalFlow: 20 },
    { priceChange: -3, volumeChange: -20, capitalFlow: -30 },
    { priceChange: 1, volumeChange: 5, capitalFlow: 5 }
  ];
  
  for (const tc of testCases) {
    const features = extractFeatures(tc, 0.6);
    const result = calculateStage(features);
    console.log(`\nInput:`, tc);
    console.log(`Stage: ${result.stageName} (${result.confidence})`);
    console.log(`Drivers:`, result.drivers.map(d => d.factor).join(', '));
  }
}
