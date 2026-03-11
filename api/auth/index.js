/**
 * Auth API - Vercel Endpoint
 * POST /api/auth/register  → create account + API key
 * POST /api/auth/login     → validate email+key
 * GET  /api/auth/me        → get account info (needs x-api-key header)
 * POST /api/auth/keys      → generate new API key
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const crypto = require('crypto');

// /tmp storage (Vercel serverless — resets on cold start, use DB in prod)
const USERS_FILE  = '/tmp/sm_users.json';
const KEYS_FILE   = '/tmp/sm_apikeys.json';
const fs = require('fs');

function loadJSON(p, def={}) {
  try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,'utf8')) : def; } catch { return def; }
}
function saveJSON(p, d) { try { fs.writeFileSync(p, JSON.stringify(d,null,2)); } catch {} }

function generateKey() {
  return 'sm_' + crypto.randomBytes(24).toString('hex');
}

const PLANS = {
  free:       { name:'Free',       price:0,      req_per_day:100,   features:['基础事件','每日简报'] },
  basic:      { name:'Basic',      price:9.99,   req_per_day:1000,  features:['完整事件','实时推送','优先级支持'] },
  pro:        { name:'Pro',        price:49.99,  req_per_day:10000, features:['预测曲线','API访问','Slack集成'] },
  enterprise: { name:'Enterprise', price:299.99, req_per_day:null,  features:['无限量','专属客服','SLA保证'] },
};

function authenticate(req) {
  const key = req.headers['x-api-key'] || req.query?.api_key;
  if (!key) return null;
  const keys = loadJSON(KEYS_FILE, {});
  return keys[key] || null;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlParts = (req.url||'').replace(/\?.*$/,'').split('/').filter(Boolean);
  const action = urlParts[2]; // register | login | me | keys

  // POST /api/auth/register
  if (req.method === 'POST' && action === 'register') {
    const { email, name } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    const users = loadJSON(USERS_FILE, {});
    if (users[email]) return res.status(409).json({ error: 'Email already registered' });

    const userId  = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const apiKey  = generateKey();
    const now     = new Date().toISOString();

    users[email] = { id: userId, email, name: name||email, plan: 'free', created_at: now };
    saveJSON(USERS_FILE, users);

    const keys = loadJSON(KEYS_FILE, {});
    keys[apiKey] = { user_id: userId, email, plan: 'free', created_at: now, req_count: 0 };
    saveJSON(KEYS_FILE, keys);

    return res.status(201).json({
      success: true,
      user:    { id: userId, email, plan: 'free', created_at: now },
      api_key: apiKey,
      plan:    PLANS['free'],
      message: 'Account created. Keep your API key safe.',
    });
  }

  // GET /api/auth/me
  if (req.method === 'GET' && action === 'me') {
    const session = authenticate(req);
    if (!session) return res.status(401).json({ error: 'Invalid or missing API key' });
    const plan = PLANS[session.plan] || PLANS['free'];
    return res.status(200).json({
      user_id:    session.user_id,
      email:      session.email,
      plan:       session.plan,
      plan_info:  plan,
      req_count:  session.req_count || 0,
      created_at: session.created_at,
    });
  }

  // POST /api/auth/keys  → rotate API key
  if (req.method === 'POST' && action === 'keys') {
    const session = authenticate(req);
    if (!session) return res.status(401).json({ error: 'Invalid or missing API key' });

    const oldKey = req.headers['x-api-key'] || req.query?.api_key;
    const newKey = generateKey();
    const keys   = loadJSON(KEYS_FILE, {});
    keys[newKey] = { ...keys[oldKey], created_at: new Date().toISOString() };
    delete keys[oldKey];
    saveJSON(KEYS_FILE, keys);

    return res.status(200).json({ success: true, new_api_key: newKey, message: 'Old key revoked.' });
  }

  // GET /api/auth  → list plans
  if (req.method === 'GET' && !action) {
    return res.status(200).json({ plans: PLANS, auth_header: 'x-api-key', docs: '/api/docs' });
  }

  return res.status(404).json({ error: 'Not found', available: ['register','me','keys'] });
}
