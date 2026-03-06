/**
 * API Contract Tests
 * Validates API responses match expected schemas
 */

const http = require('http');

// Test config
const API_BASE = process.env.API_URL || 'http://localhost:3000';

// Schemas
const SCHEMAS = {
  health: {
    required: ['status', 'timestamp'],
    optional: ['version', 'watchlist_count']
  },
  signals: {
    required: ['signals', 'count', 'timestamp'],
    optional: []
  },
  events: {
    required: ['events', 'count', 'timestamp'],
    optional: []
  },
  trends: {
    required: ['trends', 'count', 'timestamp'],
    optional: []
  },
  'future-trends': {
    required: ['predictions', 'count', 'timestamp', 'summary'],
    optional: []
  },
  watchlist: {
    required: ['watchlist', 'count'],
    optional: []
  },
  alerts: {
    required: ['alerts', 'count'],
    optional: []
  }
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const url = API_BASE + path;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: null });
        }
      });
    }).on('error', reject);
  });
}

async function validateContract(endpoint, schema) {
  const result = await httpGet(endpoint);
  
  // Check status
  if (result.status !== 200) {
    throw new Error(`Status ${result.status}`);
  }
  
  // Check data exists
  if (!result.data) {
    throw new Error('No response data');
  }
  
  // Check required fields
  for (const field of schema.required) {
    if (!(field in result.data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  return result.data;
}

async function runTests() {
  console.log('\n📋 API Contract Tests\n');
  console.log(`  API Base: ${API_BASE}\n`);
  
  // Test each endpoint contract
  for (const [endpoint, schema] of Object.entries(SCHEMAS)) {
    test(`${endpoint} contract valid`, async () => {
      await validateContract(`/api/${endpoint}`, schema);
    });
  }
  
  // Test specific data shapes
  test('/api/signals signal has topic', async () => {
    const result = await validateContract('/api/signals', SCHEMAS.signals);
    if (result.signals.length > 0) {
      if (!result.signals[0].topic) throw new Error('Signal missing topic');
    }
  });
  
  test('/api/trends trend has score', async () => {
    const result = await validateContract('/api/trends', SCHEMAS.trends);
    if (result.trends.length > 0) {
      if (typeof result.trends[0].trend_score !== 'number') {
        throw new Error('Trend missing trend_score');
      }
    }
  });
  
  test('/api/future-trends has summary', async () => {
    const result = await validateContract('/api/future-trends', SCHEMAS['future-trends']);
    if (!result.summary) throw new Error('No summary');
  });
  
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(`\n  ❌ Test error: ${err.message}\n`);
  process.exit(1);
});
