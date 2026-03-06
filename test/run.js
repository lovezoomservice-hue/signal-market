/**
 * Complete Test Suite
 * All test types for SDLC compliance
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const projectRoot = path.join(__dirname, '..');
const API_BASE = process.env.API_URL || 'https://signal-market-z14d.vercel.app';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

let totalPassed = 0;
let totalFailed = 0;

function log(color, msg) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function section(name) {
  console.log(`\n${COLORS.blue}${'='.repeat(50)}${COLORS.reset}`);
  log(COLORS.blue, `  ${name}`);
  log(COLORS.blue, `${'='.repeat(50)}${COLORS.reset}`);
}

function test(name, fn) {
  try {
    fn();
    log(COLORS.green, `  ✅ ${name}`);
    totalPassed++;
  } catch (err) {
    log(COLORS.red, `  ❌ ${name}: ${err.message}`);
    totalFailed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ==================== UNIT TESTS ====================

function runUnitTests() {
  section('UNIT TESTS: File Structure');
  
  // Test API files exist
  const apiFiles = [
    'api/health.js', 'api/signals.js', 'api/events.js',
    'api/trends.js', 'api/future-trends.js', 'api/watchlist.js', 'api/alerts.js'
  ];
  
  apiFiles.forEach(file => {
    test(`${file} exists`, () => {
      assert(fs.existsSync(path.join(projectRoot, file)), `${file} not found`);
    });
  });
  
  // Test L1 modules
  const l1Files = ['l1/topic_discovery.js', 'l1/prediction_engine.js'];
  l1Files.forEach(file => {
    test(`${file} exists`, () => {
      assert(fs.existsSync(path.join(projectRoot, file)), `${file} not found`);
    });
  });
  
  // Test config files
  test('vercel.json exists', () => {
    assert(fs.existsSync(path.join(projectRoot, 'vercel.json')), 'vercel.json not found');
  });
  
  test('vercel.json is valid JSON', () => {
    const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf-8'));
    assert(config.builds, 'Missing builds');
  });
  
  test('.github/workflows/ci.yml exists', () => {
    assert(fs.existsSync(path.join(projectRoot, '.github/workflows/ci.yml')), 'ci.yml not found');
  });
  
  // Test SDLC files
  test('SDLC_WORKFLOW.md exists', () => {
    const sdlcPath = path.join(projectRoot, '../ai_company_os/SDLC_WORKFLOW.md');
    assert(fs.existsSync(sdlcPath), 'SDLC_WORKFLOW.md not found');
  });
}

// ==================== INTEGRATION TESTS ====================

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Timeout')));
  });
}

async function runIntegrationTests() {
  section('INTEGRATION TESTS: API Endpoints');
  
  const endpoints = [
    { path: '/api/health', expectedStatus: 200, requiredFields: ['status'] },
    { path: '/api/signals', expectedStatus: 200, requiredFields: ['signals', 'count'] },
    { path: '/api/events', expectedStatus: 200, requiredFields: ['events', 'count'] },
    { path: '/api/trends', expectedStatus: 200, requiredFields: ['trends', 'count'] },
    { path: '/api/future-trends', expectedStatus: 200, requiredFields: ['predictions', 'count'] },
    { path: '/api/watchlist', expectedStatus: 200, requiredFields: ['watchlist', 'count'] },
    { path: '/api/alerts', expectedStatus: 200, requiredFields: ['alerts', 'count'] }
  ];
  
  for (const endpoint of endpoints) {
    test(`${endpoint.path} returns ${endpoint.expectedStatus}`, async () => {
      const result = await httpGet(API_BASE + endpoint.path);
      assertEquals(result.status, endpoint.expectedStatus, `Status: ${result.status}`);
    });
    
    test(`${endpoint.path} has required fields`, async () => {
      const result = await httpGet(API_BASE + endpoint.path);
      endpoint.requiredFields.forEach(field => {
        assert(result.data && field in result.data, `Missing field: ${field}`);
      });
    });
  }
}

// ==================== CONTRACT TESTS ====================

async function runContractTests() {
  section('CONTRACT TESTS: API Schemas');
  
  // Health contract
  test('/api/health has correct status values', async () => {
    const result = await httpGet(API_BASE + '/api/health');
    assert(['healthy', 'degraded', 'down'].includes(result.data.status), 'Invalid status');
  });
  
  // Signals contract
  test('/api/signals returns array', async () => {
    const result = await httpGet(API_BASE + '/api/signals');
    assert(Array.isArray(result.data.signals), 'signals not array');
  });
  
  test('/api/signals has count', async () => {
    const result = await httpGet(API_BASE + '/api/signals');
    assert(typeof result.data.count === 'number', 'count not number');
  });
  
  // Trends contract
  test('/api/trends has trend_score', async () => {
    const result = await httpGet(API_BASE + '/api/trends');
    if (result.data.trends?.length > 0) {
      assert(typeof result.data.trends[0].trend_score === 'number', 'Missing trend_score');
    }
  });
  
  // Future trends contract
  test('/api/future-trends has summary', async () => {
    const result = await httpGet(API_BASE + '/api/future-trends');
    assert(result.data.summary, 'Missing summary');
  });
}

// ==================== PERFORMANCE TESTS ====================

async function runPerformanceTests() {
  section('PERFORMANCE TESTS: Latency');
  
  const endpoints = ['/api/health', '/api/signals', '/api/events'];
  const latencyLimit = 3000; // 3 seconds
  
  for (const endpoint of endpoints) {
    test(`${endpoint} responds in <${latencyLimit}ms`, async () => {
      const start = Date.now();
      await httpGet(API_BASE + endpoint);
      const latency = Date.now() - start;
      assert(latency < latencyLimit, `Latency ${latency}ms exceeds ${latencyLimit}ms`);
    });
  }
}

// ==================== DATA VALIDATION TESTS ====================

function runDataValidationTests() {
  section('DATA VALIDATION: Freshness');
  
  const dataDir = path.join(projectRoot, 'output/raw');
  
  test('Data directory exists', () => {
    assert(fs.existsSync(dataDir), 'Data directory not found');
  });
  
  test('Has signals data files', () => {
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter(f => f.startsWith('signals_'));
      assert(files.length > 0, 'No signals data files');
    }
  });
  
  test('Data files are recent (<7 days)', () => {
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter(f => f.startsWith('signals_'));
      if (files.length > 0) {
        const latest = files.sort().pop();
        const stats = fs.statSync(path.join(dataDir, latest));
        const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        assert(ageDays < 7, `Data is ${ageDays.toFixed(1)} days old`);
      }
    }
  });
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  log(COLORS.yellow, `\n${'='.repeat(50)}`);
  log(COLORS.yellow, `  AI COMPANY OS - TEST SUITE v2.0`);
  log(COLORS.yellow, `${'='.repeat(50)}`);
  
  console.log(`\nAPI Base: ${API_BASE}`);
  
  try {
    if (testType === 'all' || testType === 'unit') {
      runUnitTests();
    }
    
    if (testType === 'all' || testType === 'integration') {
      await runIntegrationTests();
    }
    
    if (testType === 'all' || testType === 'contract') {
      await runContractTests();
    }
    
    if (testType === 'all' || testType === 'performance') {
      await runPerformanceTests();
    }
    
    if (testType === 'all' || testType === 'data') {
      runDataValidationTests();
    }
    
  } catch (err) {
    log(COLORS.red, `\n❌ Test suite error: ${err.message}`);
  }
  
  // Summary
  section('SUMMARY');
  log(totalFailed === 0 ? COLORS.green : COLORS.red, `  Total: ${totalPassed} passed, ${totalFailed} failed`);
  
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main();
