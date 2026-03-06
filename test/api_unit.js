/**
 * API Unit Tests - Direct Module Testing
 * No server required
 */

const fs = require('fs');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('🧪 Running API Unit Tests...\n');

// Test 1: Health API
test('Health API returns status', () => {
  const health = require(path.join(projectRoot, 'api/health.js'));
  const mockReq = { method: 'GET' };
  let result = null;
  const mockRes = {
    statusCode: 200,
    data: null,
    setHeader: () => {},
    json: (d) => { result = d; }
  };
  health.default(mockReq, mockRes);
  assert(result.status === 'healthy', 'Health status should be healthy');
  assert(result.version === '1.2', 'Version should be 1.2');
});

// Test 2: Signals API
test('Signals API returns signals array', () => {
  const signals = require(path.join(projectRoot, 'api/signals.js'));
  const mockReq = { method: 'GET' };
  let result = null;
  const mockRes = {
    statusCode: 200,
    data: null,
    setHeader: () => {},
    json: (d) => { result = d; }
  };
  signals.default(mockReq, mockRes);
  assert(Array.isArray(result.signals), 'Should return signals array');
  assert(result.count > 0, 'Should have signals count');
});

// Test 3: Events API
test('Events API returns events array', () => {
  const events = require(path.join(projectRoot, 'api/events.js'));
  const mockReq = { method: 'GET' };
  let result = null;
  const mockRes = {
    statusCode: 200,
    data: null,
    setHeader: () => {},
    json: (d) => { result = d; }
  };
  events.default(mockReq, mockRes);
  assert(Array.isArray(result.events), 'Should return events array');
  assert(result.count > 0, 'Should have events count');
});

// Test 4: Trends API (with fallback data)
test('Trends API returns trends', () => {
  const trends = require(path.join(projectRoot, 'api/trends.js'));
  const mockReq = { method: 'GET' };
  let result = null;
  const mockRes = {
    statusCode: 200,
    data: null,
    setHeader: () => {},
    json: (d) => { result = d; }
  };
  trends.default(mockReq, mockRes);
  assert(Array.isArray(result.trends), 'Should return trends array');
  assert(result.count >= 0, 'Should have trends count');
});

// Test 5: Future Trends API
test('Future Trends API returns predictions', () => {
  const futureTrends = require(path.join(projectRoot, 'api/future-trends.js'));
  const mockReq = { method: 'GET' };
  let result = null;
  const mockRes = {
    statusCode: 200,
    data: null,
    setHeader: () => {},
    json: (d) => { result = d; }
  };
  futureTrends.default(mockReq, mockRes);
  assert(Array.isArray(result.predictions), 'Should return predictions array');
  assert(result.count >= 0, 'Should have predictions count');
});

// Test 6: Watchlist API
test('Watchlist API can load watchlist', () => {
  const watchlist = require(path.join(projectRoot, 'api/watchlist.js'));
  const mockReq = { method: 'GET' };
  let result = null;
  const mockRes = {
    statusCode: 200,
    data: null,
    setHeader: () => {},
    json: (d) => { result = d; }
  };
  watchlist.default(mockReq, mockRes);
  assert(Array.isArray(result.watchlist), 'Should return watchlist array');
  assert(typeof result.count === 'number', 'Should have count');
});

// Test 7: Alerts API
test('Alerts API returns alerts', () => {
  const alerts = require(path.join(projectRoot, 'api/alerts.js'));
  const mockReq = { method: 'GET' };
  let result = null;
  const mockRes = {
    statusCode: 200,
    data: null,
    setHeader: () => {},
    json: (d) => { result = d; }
  };
  alerts.default(mockReq, mockRes);
  assert(Array.isArray(result.alerts), 'Should return alerts array');
  assert(result.count >= 0, 'Should have alerts count');
});

// Test 8: L1 Module - Topic Discovery
test('Topic Discovery module loads', () => {
  const td = require(path.join(projectRoot, 'l1/topic_discovery.js'));
  assert(typeof td.processTrendGraph === 'function', 'Should have processTrendGraph');
});

// Test 9: L1 Module - Prediction Engine
test('Prediction Engine module loads', () => {
  const pe = require(path.join(projectRoot, 'l1/prediction_engine.js'));
  assert(typeof pe.predictTrends === 'function', 'Should have predictTrends');
});

// Test 10: Vercel config exists
test('Vercel config is valid', () => {
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));
  assert(Array.isArray(config.builds), 'Should have builds array');
});

console.log(`\n==================================================`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`==================================================`);

process.exit(failed > 0 ? 1 : 0);
