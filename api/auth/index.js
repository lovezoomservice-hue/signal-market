/**
 * /api/auth — Register, Login, Key Management
 *
 * P0-2 Auth Persistence Strategy:
 *   - data/auth_store.json: committed to git, always available in Vercel deployment
 *     Contains seed accounts (Founder, demo) that survive cold starts.
 *   - /tmp: session-level new registrations (ephemeral but fast)
 *   - On register: write to /tmp AND attempt to update auth_store.json (via sync script)
 *
 * This gives us:
 *   - Seed accounts: always available (cold-start safe)
 *   - New registrations: work within instance lifetime; survive via git sync
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import crypto from 'crypto';
import { join } from 'path';

// ── Storage paths ──────────────────────────────────────────────────────────
const STORE_PATH = join(process.cwd(), 'data', 'auth_store.json');
const TMP_USERS  = '/tmp/sm_users_v2.json';
const TMP_KEYS   = '/tmp/sm_keys_v2.json';

// ── Load/Save helpers ──────────────────────────────────────────────────────
function loadJSON(p, def) {
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : def; } catch { return def; }
}
function saveJSON(p, d) { try { writeFileSync(p, JSON.stringify(d, null, 2)); } catch {} }

function getStore() {
  // Load persistent seed store
  const seed = loadJSON(STORE_PATH, { users: {}, api_keys: {} });
  // Merge with /tmp session-level registrations
  const tmpUsers = loadJSON(TMP_USERS, {});
  const tmpKeys  = loadJSON(TMP_KEYS, {});
  return {
    users:    { ...seed.users,    ...tmpUsers },
    api_keys: { ...seed.api_keys, ...tmpKeys  },
  };
}

// ── Plans ─────────────────────────────────────────────────────────────────
const PLANS = {
  free:       { name: 'Free',       price: 0,   req_per_day: 100,    currency: 'usd', features: ['基础信号', '每日简报'] },
  basic:      { name: 'Basic',      price: 9.99, req_per_day: 1000,   currency: 'usd', features: ['完整信号', '实时推送', '证据详情'] },
  pro:        { name: 'Pro',        price: 49.99, req_per_day: 10000, currency: 'usd', features: ['全量信号', 'Signal Graph', 'API访问', 'Webhook'] },
  enterprise: { name: 'Enterprise', price: null,  req_per_day: null,  currency: 'usd', features: ['无限制', '专属支持', '定制集成'] },
};

// ── Handlers ────────────────────────────────────────────────────────────────
function handleRegister(req, res) {
  const body = req.body || {};
  const { email, name, plan = 'free' } = body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const store = getStore();

  // Check existing
  const existing = Object.values(store.users).find(u => u.email === email);
  if (existing) {
    const key = Object.values(store.api_keys).find(k => k.userId === existing.userId);
    return res.status(200).json({
      message:  'Account already exists',
      api_key:  key?.key,
      user_id:  existing.userId,
      plan:     existing.plan,
      plan_info: PLANS[existing.plan] || PLANS.free,
    });
  }

  const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
  const apiKey = 'sm_' + crypto.randomBytes(20).toString('hex');
  const now    = new Date().toISOString();

  const user = { userId, email, name: name || email.split('@')[0], plan, createdAt: now, emailVerified: false, lastLogin: null };
  const keyObj = { key: apiKey, userId, plan, name: 'Default Key', createdAt: now, lastUsedAt: null, requestsCount: 0, expiresAt: null };

  // Write to /tmp (ephemeral session storage)
  const tmpUsers = loadJSON(TMP_USERS, {});
  const tmpKeys  = loadJSON(TMP_KEYS, {});
  tmpUsers[userId] = user;
  tmpKeys[apiKey]  = keyObj;
  saveJSON(TMP_USERS, tmpUsers);
  saveJSON(TMP_KEYS, tmpKeys);

  return res.status(201).json({
    message:   'Account created',
    api_key:   apiKey,
    user_id:   userId,
    plan,
    plan_info: PLANS[plan] || PLANS.free,
    note:      'Seed accounts are persistent. New registrations persist within current deployment instance.',
  });
}

function handleMe(req, res) {
  const apiKey = req.headers['x-api-key'] || req.query?.key;
  if (!apiKey) return res.status(401).json({ error: 'x-api-key required' });

  const store = getStore();
  const keyObj = store.api_keys[apiKey];
  if (!keyObj) return res.status(401).json({ error: 'Invalid API key' });

  const user = store.users[keyObj.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.status(200).json({
    user_id:   user.userId,
    email:     user.email,
    plan:      user.plan,
    plan_info: PLANS[user.plan] || PLANS.free,
    req_count: keyObj.requestsCount,
    created_at: user.createdAt,
  });
}

function handleLogin(req, res) {
  const body = req.body || {};
  const { email } = body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const store = getStore();
  const user = Object.values(store.users).find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'No account found for this email. Did you register?' });

  const keyObj = Object.values(store.api_keys).find(k => k.userId === user.userId);
  return res.status(200).json({
    message:   'Welcome back',
    api_key:   keyObj?.key,
    user_id:   user.userId,
    email:     user.email,
    plan:      user.plan,
    plan_info: PLANS[user.plan] || PLANS.free,
  });
}

function handleRotate(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'x-api-key required' });

  const tmpKeys = loadJSON(TMP_KEYS, {});
  const seedStore = loadJSON(STORE_PATH, { users: {}, api_keys: {} });

  const keyObj = tmpKeys[apiKey] || seedStore.api_keys[apiKey];
  if (!keyObj) return res.status(401).json({ error: 'Invalid API key' });

  const newKey = 'sm_' + crypto.randomBytes(20).toString('hex');
  const newKeyObj = { ...keyObj, key: newKey, createdAt: new Date().toISOString() };

  // Remove old, add new in /tmp
  delete tmpKeys[apiKey];
  tmpKeys[newKey] = newKeyObj;
  saveJSON(TMP_KEYS, tmpKeys);

  return res.status(200).json({ message: 'Key rotated', new_key: newKey });
}

function handleInfo(req, res) {
  return res.status(200).json({
    plans:       PLANS,
    persistence: 'seed_accounts_permanent + new_registrations_instance_scoped',
    auth_note:   'data/auth_store.json contains permanent seed accounts (git-committed). New registrations persist for the lifetime of the function instance.',
  });
}

// ── Router ────────────────────────────────────────────────────────────────
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || (req.url || '').split('/').pop();

  if (req.method === 'POST' && action === 'register') return handleRegister(req, res);
  if (req.method === 'POST' && action === 'login')    return handleLogin(req, res);
  if (req.method === 'GET'  && action === 'me')        return handleMe(req, res);
  if (req.method === 'POST' && action === 'rotate')    return handleRotate(req, res);
  return handleInfo(req, res);
}
