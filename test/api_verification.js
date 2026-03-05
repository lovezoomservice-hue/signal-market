/**
 * API Verification Tests
 * Tests all endpoints for functional correctness
 */

const API_BASE = 'https://signal-market-z14d.vercel.app';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('=== API Verification Tests ===\n');
  let passed = 0;
  let failed = 0;
  
  for (const t of tests) {
    try {
      await t.fn();
      console.log('✅ ' + t.name);
      passed++;
    } catch (e) {
      console.log('❌ ' + t.name + ': ' + e.message);
      failed++;
    }
  }
  
  console.log('\n=== Results ===');
  console.log('Passed:', passed);
  console.log('Failed:', failed);
  console.log('Total:', tests.length);
  
  return failed === 0;
}

// Test 1: Health
test('GET /health returns 200', async () => {
  const res = await fetch(API_BASE + '/health');
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!data.status) throw new Error('No status field');
});

// Test 2: Signals
test('GET /signals returns array', async () => {
  const res = await fetch(API_BASE + '/signals');
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.signals)) throw new Error('No signals array');
  if (data.signals.length === 0) throw new Error('Empty signals');
});

// Test 3: Events
test('GET /events returns array', async () => {
  const res = await fetch(API_BASE + '/events');
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.events)) throw new Error('No events array');
});

// Test 4: Weak Signals
test('GET /weak-signals returns array', async () => {
  const res = await fetch(API_BASE + '/weak-signals');
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.weak_signals)) throw new Error('No weak_signals array');
});

// Test 5: Trends
test('GET /trends returns array', async () => {
  const res = await fetch(API_BASE + '/trends');
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.trends)) throw new Error('No trends array');
});

// Test 6: Future Trends
test('GET /future-trends returns array', async () => {
  const res = await fetch(API_BASE + '/future-trends');
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.predictions)) throw new Error('No predictions array');
});

// Test 7: Watchlist
test('GET /watchlist returns array', async () => {
  const res = await fetch(API_BASE + '/watchlist');
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.watchlist)) throw new Error('No watchlist array');
});

// Test 8: Alerts
test('GET /alerts returns array', async () => {
  const res = await fetch(API_BASE + '/alerts');
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.alerts)) throw new Error('No alerts array');
});

// Test 9: POST Watchlist
test('POST /watchlist adds item', async () => {
  const res = await fetch(API_BASE + '/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'Test Signal', stage: 'emerging', confidence: 0.8 })
  });
  if (res.status !== 200) throw new Error('Status: ' + res.status);
  const data = await res.json();
  if (!data.success) throw new Error('Not successful');
});

// Run tests
runTests();
