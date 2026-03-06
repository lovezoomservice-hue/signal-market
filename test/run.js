/**
 * Test Runner - Central test execution
 * Run: npm test
 */

const { spawn } = require('child_process');
const path = require('path');

const TEST_DIR = path.join(__dirname);
const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(color, msg) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function runTest(name, command) {
  return new Promise((resolve) => {
    log(COLORS.yellow, `\n▶ Running ${name}...`);
    const start = Date.now();
    
    const proc = spawn(command, { shell: true, cwd: TEST_DIR });
    let output = '';
    
    proc.stdout.on('data', (data) => { output += data; });
    proc.stderr.on('data', (data) => { output += data; });
    
    proc.on('close', (code) => {
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      if (code === 0) {
        log(COLORS.green, `✓ ${name} passed (${duration}s)`);
        resolve({ name, passed: true, duration, output });
      } else {
        log(COLORS.red, `✗ ${name} failed (${duration}s)`);
        resolve({ name, passed: false, duration, output });
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  log(COLORS.yellow, '═══════════════════════════════════════');
  log(COLORS.yellow, '       QA Test Suite');
  log(COLORS.yellow, '═══════════════════════════════════════\n');
  
  const results = [];
  const startTime = Date.now();
  
  try {
    // Run tests based on type
    if (testType === 'all' || testType === 'unit') {
      results.push(await runTest('Unit Tests', 'node unit/api_unit.js'));
    }
    
    if (testType === 'all' || testType === 'integration') {
      results.push(await runTest('Integration Tests', 'node integration/basic.js'));
    }
    
    if (testType === 'all' || testType === 'api') {
      results.push(await runTest('API Contract Tests', 'node integration/api_contract.js'));
    }
    
  } catch (err) {
    log(COLORS.red, `Error: ${err.message}`);
  }
  
  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  log(COLORS.yellow, '\n═══════════════════════════════════════');
  log(COLORS.yellow, `       Summary (${totalTime}s)`);
  log(COLORS.yellow, '═══════════════════════════════════════');
  
  if (failed === 0) {
    log(COLORS.green, `✅ All ${passed} tests passed!`);
  } else {
    log(COLORS.red, `❌ ${passed} passed, ${failed} failed`);
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main();
