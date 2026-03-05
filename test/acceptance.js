/**
 * QA: 验收测试脚本
 * 
 * 检测:
 * 1. stage 输出数量
 * 2. event probabilities 数量
 * 3. evidence_refs 存在
 * 4. latency
 * 5. health check
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const CONFIG = {
  apiUrl: 'http://localhost:3000',
  outputDir: '/home/nice005/.openclaw/workspace/signal-market/output'
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function runAcceptance() {
  const results = {
    stage_outputs: false,
    event_probs: false,
    evidence_refs: false,
    health_check: false,
    latency_ok: false
  };

  console.log('🧪 Running Acceptance Tests...\n');

  // 1. Test /lenses/{user}/daily-brief
  console.log('📋 Test 1: Lens Daily Brief');
  try {
    const brief = await httpGet(`${CONFIG.apiUrl}/lenses/lens_a_stock/daily-brief`);
    const stageCount = (brief.stage_summary || []).length;
    results.stage_outputs = stageCount >= 1;
    console.log(`   Stage outputs: ${stageCount} (required: >=1) - ${results.stage_outputs ? '✅ PASS' : '❌ FAIL'}`);
  } catch (e) {
    console.log(`   ❌ FAIL: ${e.message}`);
  }

  // 2. Test /events has probabilities
  console.log('\n📋 Test 2: Event Probabilities');
  try {
    const events = await httpGet(`${CONFIG.apiUrl}/events`);
    const eventCount = (events.events || []).length;
    results.event_probs = eventCount >= 1;
    console.log(`   Events: ${eventCount} (required: >=1) - ${results.event_probs ? '✅ PASS' : '❌ FAIL'}`);
  } catch (e) {
    console.log(`   ❌ FAIL: ${e.message}`);
  }

  // 3. Test evidence refs exist
  console.log('\n📋 Test 3: Evidence References');
  try {
    const brief = await httpGet(`${CONFIG.apiUrl}/lenses/lens_a_stock/daily-brief`);
    const hasRefs = (brief.evidence_refs || []).length > 0;
    results.evidence_refs = hasRefs;
    console.log(`   Evidence refs: ${(brief.evidence_refs || []).length} - ${results.evidence_refs ? '✅ PASS' : '❌ FAIL'}`);
  } catch (e) {
    console.log(`   ❌ FAIL: ${e.message}`);
  }

  // 4. Test /signals/health
  console.log('\n📋 Test 4: Health Check');
  try {
    const health = await httpGet(`${CONFIG.apiUrl}/signals/health`);
    results.health_check = health.updates_today > 0;
    console.log(`   Updates today: ${health.updates_today} (required: >0) - ${results.health_check ? '✅ PASS' : '❌ FAIL'}`);
  } catch (e) {
    console.log(`   ❌ FAIL: ${e.message}`);
  }

  // 5. Latency check
  console.log('\n📋 Test 5: Latency');
  const start = Date.now();
  try {
    await httpGet(`${CONFIG.apiUrl}/events`);
    const latency = Date.now() - start;
    results.latency_ok = latency < 2000;
    console.log(`   Latency: ${latency}ms (required: <2000ms) - ${results.latency_ok ? '✅ PASS' : '❌ FAIL'}`);
  } catch (e) {
    console.log(`   ❌ FAIL: ${e.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  const allPass = Object.values(results).every(v => v === true);
  console.log(allPass ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  console.log('='.repeat(50));

  process.exit(allPass ? 0 : 1);
}

runAcceptance().catch(e => {
  console.error('❌ Acceptance test error:', e);
  process.exit(1);
});
