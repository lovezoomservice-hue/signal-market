/**
 * Integration Tests
 * Tests API endpoints and data flows
 */

const http = require('http');

// Test config
const API_BASE = process.env.API_URL || 'http://localhost:3000';
const ENDPOINTS = [
  '/api/health',
  '/api/signals',
  '/api/events',
  '/api/trends',
  '/api/future-trends',
  '/api/watchlist',
  '/api/alerts'
];

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
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('\n🔗 Integration Tests\n');
  console.log(`  API Base: ${API_BASE}\n`);
  
  // Test each endpoint
  for (const endpoint of ENDPOINTS) {
    test(`${endpoint} returns 200`, async () => {
      const result = await httpGet(endpoint);
      if (result.status !== 200) throw new Error(`Status ${result.status}`);
    });
    
    test(`${endpoint} returns JSON`, async () => {
      const result = await httpGet(endpoint);
      if (!result.data || typeof result.data !== 'object') {
        throw new Error('Not JSON');
      }
    });
  }
  
  // Test data structure
  test('/api/health has status field', async () => {
    const result = await httpGet('/api/health');
    if (!result.data.status) throw new Error('No status field');
  });
  
  test('/api/signals has signals array', async () => {
    const result = await httpGet('/api/signals');
    if (!Array.isArray(result.data.signals)) throw new Error('No signals array');
  });
  
  test('/api/events has events array', async () => {
    const result = await httpGet('/api/events');
    if (!Array.isArray(result.data.events)) throw new Error('No events array');
  });
  
  test('/api/trends has trends array', async () => {
    const result = await httpGet('/api/trends');
    if (!Array.isArray(result.data.trends)) throw new Error('No trends array');
  });
  
  test('/api/future-trends has predictions array', async () => {
    const result = await httpGet('/api/future-trends');
    if (!Array.isArray(result.data.predictions)) throw new Error('No predictions array');
  });
  
  test('/api/watchlist has watchlist array', async () => {
    const result = await httpGet('/api/watchlist');
    if (!Array.isArray(result.data.watchlist)) throw new Error('No watchlist array');
  });
  
  test('/api/alerts has alerts array', async () => {
    const result = await httpGet('/api/alerts');
    if (!Array.isArray(result.data.alerts)) throw new Error('No alerts array');
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
