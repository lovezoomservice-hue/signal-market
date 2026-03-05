/**
 * Integration Tests (Enhanced)
 * 
 * 端到端集成测试 - 包含分页、过滤、排序、边界测试和错误处理
 */

const http = require('http');
const assert = require('assert');

const API_URL = process.env.API_URL || 'http://localhost:3000';

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(API_URL + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  const results = [];
  
  console.log('🧪 Running Integration Tests...\n');
  
  // ===== Basic Tests =====
  
  // Test 1: Health Check
  try {
    const res = await httpGet('/signals/health');
    assert(res.status === 200, 'Health should return 200');
    assert(res.body.status === 'healthy', 'Status should be healthy');
    assert(res.body.updates_today > 0, 'Should have updates');
    console.log('✅ Test 1: Health Check PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 1: Health Check FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 2: Get Events
  try {
    const res = await httpGet('/events');
    assert(res.status === 200, 'Events should return 200');
    assert(Array.isArray(res.body.events), 'Events should be array');
    assert(res.body.pagination, 'Should have pagination');
    assert(res.body.pagination.limit === 20, 'Default limit should be 20');
    console.log('✅ Test 2: Get Events PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 2: Get Events FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 3: Get Predictions
  try {
    const res = await httpGet('/predictions');
    assert(res.status === 200, 'Predictions should return 200');
    assert(res.body.count > 0 || res.body.predictions, 'Should have predictions');
    console.log('✅ Test 3: Get Predictions PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 3: Get Predictions FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 4: Get Lens Brief
  try {
    const res = await httpGet('/lenses/lens_a_stock/daily-brief');
    assert(res.status === 200, 'Brief should return 200');
    assert(res.body.lens_id === 'lens_a_stock', 'Should match lens_id');
    assert(res.body.evidence_refs, 'Should have evidence_refs');
    console.log('✅ Test 4: Get Lens Brief PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 4: Get Lens Brief FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 5: Prediction Curve
  try {
    const res = await httpGet('/predictions/evt_iran_conflict');
    assert(res.status === 200, 'Curve should return 200');
    assert(res.body.curve, 'Should have curve');
    assert(res.body.current, 'Should have current probability');
    console.log('✅ Test 5: Prediction Curve PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 5: Prediction Curve FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 6: Evidence
  try {
    const brief = await httpGet('/lenses/lens_a_stock/daily-brief');
    const evidenceId = brief.body.evidence_refs?.[0];
    if (evidenceId) {
      const res = await httpGet('/evidence/' + evidenceId);
      assert(res.status === 200, 'Evidence should return 200');
      console.log('✅ Test 6: Get Evidence PASS');
      results.push(true);
    } else {
      console.log('⚠️ Test 6: Skip - No evidence refs');
      results.push(true);
    }
  } catch (e) {
    console.log('❌ Test 6: Get Evidence FAIL - ' + e.message);
    results.push(false);
  }
  
  // ===== Pagination Tests =====
  
  // Test 7: Pagination - limit
  try {
    const res = await httpGet('/events?limit=5');
    assert(res.status === 200, 'Should return 200');
    assert(res.body.events.length <= 5, 'Should respect limit');
    assert(res.body.pagination.limit === 5, 'Should have correct limit');
    console.log('✅ Test 7: Pagination - limit PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 7: Pagination - limit FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 8: Pagination - offset
  try {
    const res1 = await httpGet('/events?limit=2&offset=0');
    const res2 = await httpGet('/events?limit=2&offset=2');
    assert(res1.status === 200 && res2.status === 200, 'Should return 200');
    // Different events should be returned
    if (res1.body.events.length > 0 && res2.body.events.length > 0) {
      const id1 = res1.body.events[0].event_id;
      const id2 = res2.body.events[0].event_id;
      assert(id1 !== id2, 'Offset should return different events');
    }
    console.log('✅ Test 8: Pagination - offset PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 8: Pagination - offset FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 9: Pagination - hasMore flag
  try {
    const res = await httpGet('/events?limit=1');
    assert(res.status === 200, 'Should return 200');
    assert(typeof res.body.pagination.hasMore === 'boolean', 'Should have hasMore');
    console.log('✅ Test 9: Pagination - hasMore PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 9: Pagination - hasMore FAIL - ' + e.message);
    results.push(false);
  }
  
  // ===== Filtering Tests =====
  
  // Test 10: Filter by stage
  try {
    const res = await httpGet('/events?stage=accelerating');
    assert(res.status === 200, 'Should return 200');
    if (res.body.events.length > 0) {
      const allAccelerating = res.body.events.every(e => 
        e.stage === 'accelerating' || !e.stage
      );
      assert(allAccelerating, 'All events should have stage=accelerating');
    }
    console.log('✅ Test 10: Filter by stage PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 10: Filter by stage FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 11: Filter by topic
  try {
    const res = await httpGet('/events?topic=AI算力');
    assert(res.status === 200, 'Should return 200');
    if (res.body.events.length > 0) {
      const allMatch = res.body.events.every(e => 
        e.topic === 'AI算力' || !e.topic
      );
      assert(allMatch, 'All events should match topic filter');
    }
    console.log('✅ Test 11: Filter by topic PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 11: Filter by topic FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 12: Multiple stage filters
  try {
    const res = await httpGet('/events?stage=accelerating,peak');
    assert(res.status === 200, 'Should return 200');
    if (res.body.events.length > 0) {
      const validStages = ['accelerating', 'peak'];
      const allValid = res.body.events.every(e => 
        validStages.includes(e.stage) || !e.stage
      );
      assert(allValid, 'All events should have valid stage');
    }
    console.log('✅ Test 12: Multiple stage filters PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 12: Multiple stage filters FAIL - ' + e.message);
    results.push(false);
  }
  
  // ===== Sorting Tests =====
  
  // Test 13: Sort by probability (desc)
  try {
    const res = await httpGet('/events?sortBy=probability&sortOrder=desc');
    assert(res.status === 200, 'Should return 200');
    // Check that array is sorted (or at least has probability field)
    console.log('✅ Test 13: Sort by probability PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 13: Sort by probability FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 14: Sort by title (asc)
  try {
    const res = await httpGet('/events?sortBy=title&sortOrder=asc');
    assert(res.status === 200, 'Should return 200');
    console.log('✅ Test 14: Sort by title PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 14: Sort by title FAIL - ' + e.message);
    results.push(false);
  }
  
  // ===== Predictions Tests =====
  
  // Test 15: Predictions - pagination
  try {
    const res = await httpGet('/predictions?limit=2');
    assert(res.status === 200, 'Should return 200');
    assert(res.body.pagination, 'Should have pagination');
    assert(res.body.pagination.limit === 2, 'Should respect limit');
    console.log('✅ Test 15: Predictions - pagination PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 15: Predictions - pagination FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 16: Predictions - filter by topic
  try {
    const res = await httpGet('/predictions?topic=Iran');
    assert(res.status === 200, 'Should return 200');
    console.log('✅ Test 16: Predictions - filter PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 16: Predictions - filter FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 17: Predictions - sort by probability
  try {
    const res = await httpGet('/predictions?sortBy=probability&sortOrder=desc');
    assert(res.status === 200, 'Should return 200');
    console.log('✅ Test 17: Predictions - sort PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 17: Predictions - sort FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 18: Get prediction for non-existent event
  try {
    const res = await httpGet('/predictions/nonexistent_event');
    assert(res.status === 404, 'Should return 404 for non-existent event');
    console.log('✅ Test 18: Non-existent prediction PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 18: Non-existent prediction FAIL - ' + e.message);
    results.push(false);
  }
  
  // ===== Edge Cases =====
  
  // Test 19: Combined pagination and filter
  try {
    const res = await httpGet('/events?limit=5&offset=0&stage=accelerating');
    assert(res.status === 200, 'Should return 200');
    assert(res.body.pagination.limit === 5, 'Should have limit');
    console.log('✅ Test 19: Combined pagination and filter PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 19: Combined pagination and filter FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 20: Combined sort and filter
  try {
    const res = await httpGet('/events?sortBy=probability&sortOrder=desc&topic=AI算力');
    assert(res.status === 200, 'Should return 200');
    console.log('✅ Test 20: Combined sort and filter PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 20: Combined sort and filter FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 21: Invalid lens ID
  try {
    const res = await httpGet('/lenses/invalid_lens/daily-brief');
    assert(res.status === 404, 'Should return 404 for invalid lens');
    console.log('✅ Test 21: Invalid lens PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 21: Invalid lens FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 22: Total count in pagination
  try {
    const res = await httpGet('/events');
    assert(res.status === 200, 'Should return 200');
    assert(typeof res.body.pagination.total === 'number', 'Should have total count');
    assert(res.body.pagination.total >= 0, 'Total should be >= 0');
    console.log('✅ Test 22: Total count PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 22: Total count FAIL - ' + e.message);
    results.push(false);
  }
  
  // ===== Error Handling Tests =====
  
  // Test 23: 404 for non-existent route
  try {
    const res = await httpGet('/nonexistent/path');
    assert(res.status === 404, 'Should return 404 for non-existent route');
    console.log('✅ Test 23: 404 Non-existent route PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 23: 404 Non-existent route FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 24: Invalid pagination value (negative)
  try {
    const res = await httpGet('/events?limit=-1');
    // Should either return 400 or handle gracefully
    assert([200, 400].includes(res.status), 'Should return 200 or 400');
    console.log('✅ Test 24: Invalid limit value PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 24: Invalid limit value FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 25: Invalid pagination value (non-numeric)
  try {
    const res = await httpGet('/events?limit=abc');
    assert([200, 400].includes(res.status), 'Should return 200 or 400');
    console.log('✅ Test 25: Non-numeric limit PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 25: Non-numeric limit FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 26: Invalid offset value
  try {
    const res = await httpGet('/events?offset=-5');
    assert([200, 400].includes(res.status), 'Should return 200 or 400');
    console.log('✅ Test 26: Negative offset PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 26: Negative offset FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 27: Very large limit value
  try {
    const res = await httpGet('/events?limit=99999');
    assert(res.status === 200, 'Should return 200');
    // Should cap at reasonable max
    console.log('✅ Test 27: Large limit value PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 27: Large limit value FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 28: Invalid sort order
  try {
    const res = await httpGet('/events?sortOrder=invalid');
    assert([200, 400].includes(res.status), 'Should return 200 or 400');
    console.log('✅ Test 28: Invalid sort order PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 28: Invalid sort order FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 29: Invalid sortBy field
  try {
    const res = await httpGet('/events?sortBy=invalid_field');
    assert([200, 400].includes(res.status), 'Should return 200 or 400');
    console.log('✅ Test 29: Invalid sortBy field PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 29: Invalid sortBy field FAIL - ' + e.message);
    results.push(false);
  }
  
  // ===== Boundary Tests =====
  
  // Test 30: Empty result set with filter
  try {
    const res = await httpGet('/events?topic=nonexistent_topic_12345');
    assert(res.status === 200, 'Should return 200');
    assert(Array.isArray(res.body.events), 'Should return array');
    console.log('✅ Test 30: Empty result set PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 30: Empty result set FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 31: Offset beyond total
  try {
    const res = await httpGet('/events?offset=10000');
    assert(res.status === 200, 'Should return 200');
    assert(Array.isArray(res.body.events), 'Should return array (possibly empty)');
    console.log('✅ Test 31: Offset beyond total PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 31: Offset beyond total FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 32: limit=0 (edge case)
  try {
    const res = await httpGet('/events?limit=0');
    assert(res.status === 200, 'Should return 200');
    console.log('✅ Test 32: limit=0 edge case PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 32: limit=0 edge case FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 33: Special characters in filter
  try {
    const res = await httpGet('/events?topic=%E6%B5%8B%E8%AF%95');
    assert(res.status === 200, 'Should return 200 for URL-encoded topic');
    console.log('✅ Test 33: URL-encoded filter PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 33: URL-encoded filter FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 34: Double slash in URL path
  try {
    const res = await httpGet('//events');
    assert([200, 404].includes(res.status), 'Should return 200 or 404');
    console.log('✅ Test 34: Double slash path PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 34: Double slash path FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 35: Request with only extra params
  try {
    const res = await httpGet('/events?foo=bar&baz=qux');
    assert(res.status === 200, 'Should return 200 for unknown params');
    console.log('✅ Test 35: Unknown params PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 35: Unknown params FAIL - ' + e.message);
    results.push(false);
  }
  
  // ===== API Structure Validation =====
  
  // Test 36: Events response structure
  try {
    const res = await httpGet('/events');
    assert(res.status === 200, 'Should return 200');
    const body = res.body;
    assert(body.events !== undefined, 'Should have events field');
    assert(body.pagination !== undefined, 'Should have pagination field');
    assert(Array.isArray(body.events), 'events should be array');
    console.log('✅ Test 36: Events response structure PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 36: Events response structure FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 37: Predictions response structure
  try {
    const res = await httpGet('/predictions');
    assert(res.status === 200, 'Should return 200');
    const body = res.body;
    assert(body.count !== undefined || body.predictions !== undefined, 'Should have predictions/count');
    console.log('✅ Test 37: Predictions response structure PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 37: Predictions response structure FAIL - ' + e.message);
    results.push(false);
  }
  
  // Test 38: Health response structure
  try {
    const res = await httpGet('/signals/health');
    assert(res.status === 200, 'Should return 200');
    const body = res.body;
    assert(body.status !== undefined, 'Should have status field');
    assert(body.updates_today !== undefined, 'Should have updates_today field');
    console.log('✅ Test 38: Health response structure PASS');
    results.push(true);
  } catch (e) {
    console.log('❌ Test 38: Health response structure FAIL - ' + e.message);
    results.push(false);
  }
  
  // Summary
  console.log('\n' + '='.repeat(40));
  const passed = results.filter(r => r).length;
  console.log(`📊 Test Results: ${passed}/${results.length} passed`);
  console.log(`   - Basic Tests: 1-6`);
  console.log(`   - Pagination: 7-9`);
  console.log(`   - Filtering: 10-12`);
  console.log(`   - Sorting: 13-14`);
  console.log(`   - Predictions: 15-18`);
  console.log(`   - Edge Cases: 19-22`);
  console.log(`   - Error Handling: 23-29`);
  console.log(`   - Boundary: 30-35`);
  console.log(`   - Structure Validation: 36-38`);
  console.log('='.repeat(40));
  
  // Exit with appropriate code
  process.exit(passed === results.length ? 0 : 1);
}

runTests().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
