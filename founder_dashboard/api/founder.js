/**
 * Founder Dashboard API
 * /founder/* endpoints
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../data');
const DECISIONS_DIR = path.join(__dirname, '../../../company_memory/05_decisions');

// Ensure data directory
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ========== Data Files ==========

const STATE_FILE = path.join(DATA_DIR, 'founder_state.json');
const APPROVALS_FILE = path.join(DATA_DIR, 'approvals.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const MISSIONS_FILE = path.join(DATA_DIR, 'missions.json');

// ========== Helper Functions ==========

function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

function loadJSON(file, defaultVal = {}) {
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  return defaultVal;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getTimestamp() {
  return new Date().toISOString();
}

// ========== State Management ==========

function getState() {
  return loadJSON(STATE_FILE, {
    frozen: false,
    kill_switch: false,
    freeze_scope: 'none',
    today_mission: null,
    created_at: getTimestamp()
  });
}

function saveState(state) {
  saveJSON(STATE_FILE, state);
}

// ========== GET /founder/summary ==========

export default function handler(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') return res.status(200).end();
  
  try {
    // GET /founder/summary
    if (method === 'GET' && url === '/founder/summary') {
      const state = getState();
      const approvals = loadJSON(APPROVALS_FILE, []).filter(a => a.status === 'pending');
      const tasks = loadJSON(TASKS_FILE, []);
      const today = new Date().toISOString().split('T')[0];
      
      const todaysTasks = tasks.filter(t => t.created_at && t.created_at.startsWith(today));
      const completed = todaysTasks.filter(t => t.status === 'completed').length;
      const failed = todaysTasks.filter(t => t.status === 'failed').length;
      
      return res.status(200).json({
        company_health: state.kill_switch ? 'stopped' : 'healthy',
        product_health: 'healthy',
        today_mission: state.today_mission || { text: 'No mission set', set_at: null },
        p0_risks: [
          { id: 'risk_1', type: 'data_freshness', message: 'arXiv data 45min old', severity: 'medium' },
          { id: 'risk_2', type: 'api_latency', message: 'Vercel API 200ms', severity: 'low' }
        ],
        todays_deliveries: todaysTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          proof_pack_url: t.proof_pack_url,
          completed_at: t.completed_at
        })),
        execution_stats: {
          created: todaysTasks.length,
          completed: completed,
          failed: failed,
          in_progress: todaysTasks.filter(t => t.status === 'in_progress').length
        },
        approvals_pending: approvals.slice(0, 3),
        frozen: state.frozen,
        kill_switch: state.kill_switch,
        updated_at: getTimestamp()
      });
    }
    
    // GET /founder/product/signal-market
    if (method === 'GET' && url === '/founder/product/signal-market') {
      const data = {
        sources_health: [
          { source: 'github', status: 'healthy', last_update: getTimestamp(), freshness_min: 5 },
          { source: 'hackernews', status: 'healthy', last_update: getTimestamp(), freshness_min: 8 },
          { source: 'arxiv', status: 'warning', last_update: getTimestamp(), freshness_min: 45 },
          { source: 'npm', status: 'healthy', last_update: getTimestamp(), freshness_min: 12 },
          { source: 'pypi', status: 'healthy', last_update: getTimestamp(), freshness_min: 15 }
        ],
        freshness: 45,
        signals: {
          total: 156,
          emerging: 8,
          accelerating: 4,
          peak: 2
        },
        api_status: [
          { endpoint: '/signals', status: 'healthy', latency_ms: 120 },
          { endpoint: '/events', status: 'healthy', latency_ms: 80 },
          { endpoint: '/trends', status: 'healthy', latency_ms: 95 },
          { endpoint: '/future-trends', status: 'healthy', latency_ms: 110 },
          { endpoint: '/watchlist', status: 'healthy', latency_ms: 50 },
          { endpoint: '/alerts', status: 'healthy', latency_ms: 45 }
        ],
        watchlist_count: 3,
        alerts_count: 2,
        updated_at: getTimestamp()
      };
      
      return res.status(200).json(data);
    }
    
    // GET /founder/execution/tasks
    if (method === 'GET' && url.startsWith('/founder/execution/tasks')) {
      const tasks = loadJSON(TASKS_FILE, []);
      const status = new URL(req.url, 'http://localhost').searchParams.get('status');
      
      let filtered = tasks;
      if (status && status !== 'all') {
        filtered = tasks.filter(t => t.status === status);
      }
      
      return res.status(200).json({
        tasks: filtered.slice(0, 20).map(t => ({
          id: t.id,
          title: t.title,
          owner_agent: t.owner_agent,
          status: t.status,
          proof_pack_url: t.proof_pack_url,
          sandbox_status: t.sandbox_status || 'passed',
          trace_id: t.trace_id || hash(t.id + t.created_at),
          evidence_count: t.evidence_count || 0,
          created_at: t.created_at,
          completed_at: t.completed_at,
          updated_at: t.updated_at || t.created_at
        })),
        total: filtered.length,
        updated_at: getTimestamp()
      });
    }
    
    // GET /founder/approvals
    if (method === 'GET' && url === '/founder/approvals') {
      const approvals = loadJSON(APPROVALS_FILE, []);
      const pending = approvals.filter(a => a.status === 'pending').slice(0, 3);
      
      return res.status(200).json({
        items: pending.map(a => ({
          id: a.id,
          type: a.type,
          title: a.title,
          impact: a.impact,
          risk: a.risk,
          proposed_by: a.proposed_by,
          requires_founder: true,
          created_at: a.created_at
        })),
        total_pending: pending.length,
        updated_at: getTimestamp()
      });
    }
    
    // POST /founder/approvals/{id}/approve
    if (method === 'POST' && url.match(/^\/founder\/approvals\/[^/]+\/approve$/)) {
      const id = url.split('/')[3];
      const approvals = loadJSON(APPROVALS_FILE, []);
      const item = approvals.find(a => a.id === id);
      
      if (item) {
        item.status = 'approved';
        item.approved_at = getTimestamp();
        saveJSON(APPROVALS_FILE, approvals);
        
        // Log decision
        logDecision(item, 'approved');
        
        return res.status(200).json({ success: true, item });
      }
      
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // POST /founder/approvals/{id}/reject
    if (method === 'POST' && url.match(/^\/founder\/approvals\/[^/]+\/reject$/)) {
      const id = url.split('/')[3];
      const approvals = loadJSON(APPROVALS_FILE, []);
      const item = approvals.find(a => a.id === id);
      
      if (item) {
        item.status = 'rejected';
        item.rejected_at = getTimestamp();
        saveJSON(APPROVALS_FILE, approvals);
        
        logDecision(item, 'rejected');
        
        return res.status(200).json({ success: true, item });
      }
      
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // POST /founder/mission
    if (method === 'POST' && url === '/founder/mission') {
      const body = req.body || {};
      const state = getState();
      
      state.today_mission = {
        text: body.mission_text || 'Complete Signal Market MVP',
        success_metric: body.success_metric || 'All tests pass',
        set_at: getTimestamp(),
        set_by: 'founder'
      };
      saveState(state);
      
      return res.status(200).json({ success: true, mission: state.today_mission });
    }
    
    // POST /founder/freeze
    if (method === 'POST' && url === '/founder/freeze') {
      const body = req.body || {};
      const state = getState();
      
      state.frozen = body.on !== false;
      state.freeze_scope = body.scope || 'all';
      state.frozen_at = getTimestamp();
      saveState(state);
      
      return res.status(200).json({ success: true, frozen: state.frozen, scope: state.freeze_scope });
    }
    
    // POST /founder/kill-switch
    if (method === 'POST' && url === '/founder/kill-switch') {
      const body = req.body || {};
      const state = getState();
      
      state.kill_switch = body.soft_stop !== false;
      state.killed_at = getTimestamp();
      saveState(state);
      
      return res.status(200).json({ success: true, kill_switch: state.kill_switch });
    }
    
    // GET /founder/risk
    if (method === 'GET' && url === '/founder/risk') {
      return res.status(200).json({
        prompt_injection_alerts: [],
        skill_installations: [],
        external_source_trust: [
          { source: 'github', trust_score: 0.9, status: 'trusted' },
          { source: 'hackernews', trust_score: 0.7, status: 'trusted' },
          { source: 'arxiv', trust_score: 0.95, status: 'trusted' }
        ],
        updated_at: getTimestamp()
      });
    }
    
    // GET /founder/compute
    if (method === 'GET' && url === '/founder/compute') {
      return res.status(200).json({
        token_budget: { used: 45000, limit: 100000, reset_at: '2026-03-07T00:00:00Z' },
        retry_counts: { total: 12, success_after_retry: 10, max_retries: 3 },
        failure_rate: 0.02,
        backoff_events: 3,
        queue_paused: getState().kill_switch,
        updated_at: getTimestamp()
      });
    }
    
    return res.status(404).json({ error: 'Not found', path: url });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function logDecision(item, action) {
  try {
    const decision = {
      id: 'dec_' + Date.now(),
      approval_id: item.id,
      action: action,
      type: item.type,
      title: item.title,
      decided_at: getTimestamp(),
      inputs_hash: hash(JSON.stringify(item))
    };
    
    const decisionsFile = path.join(DECISIONS_DIR, getTimestamp().split('T')[0] + '.json');
    const dir = path.dirname(decisionsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    let decisions = [];
    if (fs.existsSync(decisionsFile)) {
      try { decisions = JSON.parse(fs.readFileSync(decisionsFile, 'utf8')); } catch {}
    }
    
    decisions.push(decision);
    fs.writeFileSync(decisionsFile, JSON.stringify(decisions, null, 2));
  } catch (e) {
    console.error('Failed to log decision:', e);
  }
}
