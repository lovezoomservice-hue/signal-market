/**
 * API Unit Tests
 * Tests API module files exist and are valid
 */

const fs = require('fs');
const path = require('path');
const projectRoot = path.resolve(__dirname, '../..');

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

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function fileExists(filepath) {
  return fs.existsSync(path.join(projectRoot, filepath));
}

function fileHasContent(filepath) {
  const content = fs.readFileSync(path.join(projectRoot, filepath), 'utf-8');
  return content.length > 0;
}

console.log('\n📦 API Unit Tests\n');

// Test API files exist
test('api/health.js exists', () => {
  assert(fileExists('api/health.js'), 'health.js not found');
});

test('api/signals.js exists', () => {
  assert(fileExists('api/signals.js'), 'signals.js not found');
});

test('api/events.js exists', () => {
  assert(fileExists('api/events.js'), 'events.js not found');
});

test('api/trends.js exists', () => {
  assert(fileExists('api/trends.js'), 'trends.js not found');
});

test('api/future-trends.js exists', () => {
  assert(fileExists('api/future-trends.js'), 'future-trends.js not found');
});

test('api/watchlist.js exists', () => {
  assert(fileExists('api/watchlist.js'), 'watchlist.js not found');
});

test('api/alerts.js exists', () => {
  assert(fileExists('api/alerts.js'), 'alerts.js not found');
});

// Test L1 modules exist
test('l1/topic_discovery.js exists', () => {
  assert(fileExists('l1/topic_discovery.js'), 'topic_discovery.js not found');
});

test('l1/prediction_engine.js exists', () => {
  assert(fileExists('l1/prediction_engine.js'), 'prediction_engine.js not found');
});

// Test config files
test('vercel.json exists', () => {
  assert(fileExists('vercel.json'), 'vercel.json not found');
});

test('vercel.json is valid JSON', () => {
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));
  assert(config.builds, 'vercel.json missing builds');
});

test('.github/workflows/ci.yml exists', () => {
  assert(fileExists('.github/workflows/ci.yml'), 'ci.yml not found');
});

// Test AutoOps exists (relative to workspace)
test('autoops/core.js exists', () => {
  assert(fs.existsSync('/home/nice005/.openclaw/workspace/ai_company_os/autoops/core.js'), 'autoops/core.js not found');
});

test('autoops/problem_detection.js exists', () => {
  assert(fs.existsSync('/home/nice005/.openclaw/workspace/ai_company_os/autoops/problem_detection.js'), 'problem_detection.js not found');
});

test('autoops/monitoring_engine.js exists', () => {
  assert(fs.existsSync('/home/nice005/.openclaw/workspace/ai_company_os/autoops/monitoring_engine.js'), 'monitoring_engine.js not found');
});

// Test departments
test('departments/qa_department.md exists', () => {
  assert(fs.existsSync('/home/nice005/.openclaw/workspace/ai_company_os/departments/qa_department.md'), 'qa_department.md not found');
});

test('departments/devops_department.md exists', () => {
  assert(fs.existsSync('/home/nice005/.openclaw/workspace/ai_company_os/departments/devops_department.md'), 'devops_department.md not found');
});

test('departments/monitoring_department.md exists', () => {
  assert(fs.existsSync('/home/nice005/.openclaw/workspace/ai_company_os/departments/monitoring_department.md'), 'monitoring_department.md not found');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
