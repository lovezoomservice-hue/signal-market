/**
 * L0: Raw Signal Ingestion
 * 
 * 所有源入 raw_events.jsonl
 * 统一格式 + proof 路径
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置
const CONFIG = {
  outputDir: '/home/nice005/.openclaw/workspace/signal-market/output',
  sources: {
    crypto: {
      name: 'binance',
      endpoint: 'https://api.binance.us/api/v3/ticker/price',
      format: 'price'
    },
    a_stock: {
      name: 'mock_a_stock',
      endpoint: null,
      format: 'mock'
    },
    us_stock: {
      name: 'mock_us_stock',
      endpoint: null,
      format: 'mock'
    },
    macro: {
      name: 'fred',
      endpoint: null,
      format: 'mock'
    },
    sentiment: {
      name: 'hackernews',
      endpoint: 'https://hacker-news.firebaseio.com/v0/topstories.json',
      format: 'hn'
    }
  }
};

function getDatePath() {
  const now = new Date();
  return now.toISOString().split('T')[0].replace(/-/g, '');
}

function createRawEvent(source, data, type = 'market') {
  return {
    event_id: `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source: source,
    type: type,
    timestamp: new Date().toISOString(),
    data: data,
    proof_path: null // 后续填充
  };
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchCrypto() {
  try {
    const data = await httpsGet(CONFIG.sources.crypto.endpoint);
    const json = JSON.parse(data);
    const symbols = ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT'];
    const filtered = json.filter(x => symbols.includes(x.symbol))
      .map(x => ({
        symbol: x.symbol.replace('USDT', ''),
        price: parseFloat(x.price)
      }));
    return { name: 'binance', data: filtered, success: true };
  } catch (e) {
    return { name: 'binance', error: e.message, success: false };
  }
}

async function fetchSentiment() {
  try {
    const data = await httpsGet(CONFIG.sources.sentiment.endpoint);
    const ids = JSON.parse(data).slice(0, 20);
    const stories = [];
    
    for (const id of ids.slice(0, 5)) {
      try {
        const storyData = await httpsGet(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const story = JSON.parse(storyData);
        if (story && story.title) {
          stories.push({
            title: story.title,
            url: story.url,
            score: story.score,
            by: story.by
          });
        }
      } catch (e) { /* skip */ }
    }
    
    return { name: 'hackernews', data: stories, success: true };
  } catch (e) {
    return { name: 'hackernews', error: e.message, success: false };
  }
}

function fetchMockAStock() {
  // 模拟A股板块数据
  return {
    name: 'a_stock',
    data: [
      { sector: '商业航天', change: 2.5, volume: 1500000000 },
      { sector: 'AI算力', change: 1.8, volume: 2200000000 },
      { sector: '机器人', change: -0.5, volume: 800000000 }
    ],
    success: true
  };
}

function fetchMockUSStock() {
  return {
    name: 'us_stock',
    data: [
      { symbol: 'NVDA', price: 192.5, change: 1.2 },
      { symbol: 'TSLA', price: 175.0, change: -0.8 },
      { symbol: 'AAPL', price: 185.0, change: 0.5 }
    ],
    success: true
  };
}

function fetchMockMacro() {
  return {
    name: 'macro',
    data: [
      { indicator: 'FED_RATE', value: 4.5, date: '2026-03' },
      { indicator: 'CPI', value: 3.2, date: '2026-02' }
    ],
    success: true
  };
}

async function runIngest() {
  const datePath = getDatePath();
  const outputDir = path.join(CONFIG.outputDir, 'raw', datePath);
  
  fs.mkdirSync(outputDir, { recursive: true });
  
  const results = {
    timestamp: new Date().toISOString(),
    sources: {}
  };
  
  // Fetch all sources
  console.log('📡 Fetching signals...');
  
  const [crypto, sentiment, aStock, usStock, macro] = await Promise.all([
    fetchCrypto(),
    fetchSentiment(),
    Promise.resolve(fetchMockAStock()),
    Promise.resolve(fetchMockUSStock()),
    Promise.resolve(fetchMockMacro())
  ]);
  
  const sources = [crypto, sentiment, aStock, usStock, macro];
  
  // Write each source to raw JSONL
  for (const source of sources) {
    const filename = `${source.name}_${datePath}.jsonl`;
    const filepath = path.join(outputDir, filename);
    
    const rawEvent = createRawEvent(source.name, source.data || { error: source.error });
    fs.appendFileSync(filepath, JSON.stringify(rawEvent) + '\n');
    
    results.sources[source.name] = {
      success: source.success,
      filepath: filepath,
      record_count: source.data ? (Array.isArray(source.data) ? source.data.length : 1) : 0
    };
    
    console.log(`  ✅ ${source.name}: ${source.success ? 'OK' : 'FAILED'}`);
  }
  
  // Write summary
  const summaryPath = path.join(CONFIG.outputDir, 'raw', `summary_${datePath}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📊 Ingest complete: ${Object.values(results.sources).filter(s => s.success).length}/${sources.length} sources`);
  
  return results;
}

// Run if called directly
if (require.main === module) {
  runIngest().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runIngest, CONFIG };
