/**
 * /api/auth — Register, Login, Key Management with KV Persistence
 *
 * P0-2 Auth Persistence Strategy:
 *   - KV persistence layer: Vercel KV in production, in-memory fallback for demo
 *   - Seed accounts from data/auth_store.json still load for backwards compatibility
 *
 * Storage design:
 * - auth:users → hset with email as field, user object as value
 * - auth:keys → hset with api_key as field, {email, plan, created_at} as value
 */

import { readFileSync, existsSync } from 'fs';
import crypto from 'crypto';
import { join } from 'path';
import persistence from '../lib/kv.js';

// ── Storage paths for seed data (backwards compatibility) ──────────────────
const STORE_PATH = join(process.cwd(), 'data', 'auth_store.json');
const SUBS_PATH = join(process.cwd(), 'data', 'subscribers.json');

// ── Load seed store for backwards compatibility ────────────────────────────
function loadSeedStore() {
  try {
    if (!existsSync(STORE_PATH)) return { users: {}, api_keys: {} };
    const data = readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return { users: {}, api_keys: {} };
  }
}

// ── KV-backed user/key storage ─────────────────────────────────────────────
async function getUserByEmail(email) {
  const userData = await persistence.hget('auth:users', email);
  if (userData) return JSON.parse(userData);
  // Fallback to seed store
  const seed = loadSeedStore();
  return Object.values(seed.users).find(u => u.email === email) || null;
}

async function createUser(user) {
  await persistence.hset('auth:users', user.email, JSON.stringify(user));
}

async function getApiUserByKey(apiKey) {
  const keyData = await persistence.hget('auth:keys', apiKey);
  if (keyData) return JSON.parse(keyData);
  // Fallback to seed store
  const seed = loadSeedStore();
  return seed.api_keys[apiKey] || null;
}

async function createApiKey(keyObj) {
  await persistence.hset('auth:keys', keyObj.key, JSON.stringify(keyObj));
}

async function deleteApiKey(apiKey) {
  await persistence.hdel('auth:keys', apiKey);
}

async function getAllUsers() {
  const usersData = await persistence.hgetall('auth:users');
  const users = usersData ? Object.values(usersData).map(u => JSON.parse(u)) : [];
  // Merge with seed store
  const seed = loadSeedStore();
  const seedUsers = Object.values(seed.users);
  // Dedupe by email
  const emailSet = new Set(users.map(u => u.email));
  for (const su of seedUsers) {
    if (!emailSet.has(su.email)) users.push(su);
  }
  return users;
}

// ── Plans ─────────────────────────────────────────────────────────────────
const PLANS = {
  free: { name: 'Free', price: 0, req_per_day: 100, currency: 'usd', features: ['基础信号', '每日简报'] },
  basic: { name: 'Basic', price: 9.99, req_per_day: 1000, currency: 'usd', features: ['完整信号', '实时推送', '证据详情'] },
  pro: { name: 'Pro', price: 49.99, req_per_day: 10000, currency: 'usd', features: ['全量信号', 'Signal Graph', 'API 访问', 'Webhook'] },
  enterprise: { name: 'Enterprise', price: null, req_per_day: null, currency: 'usd', features: ['无限制', '专属支持', '定制集成'] },
};

// ── Handlers ────────────────────────────────────────────────────────────────
async function handleRegister(req, res) {
  const body = req.body || {};
  const { email, name, plan = 'free' } = body;
  if (!email) return res.status(400).json({ error: 'email required' });

  // Check existing
  const existing = await getUserByEmail(email);
  if (existing) {
    const keyObj = await getApiUserByKey(existing.userId);
    const allKeys = await persistence.hgetall('auth:keys');
    let foundKey = null;
    if (allKeys) {
      for (const k of Object.values(allKeys)) {
        const parsed = JSON.parse(k);
        if (parsed.userId === existing.userId) {
          foundKey = parsed;
          break;
        }
      }
    }
    return res.status(200).json({
      message: 'Account already exists',
      api_key: foundKey?.key || keyObj?.key,
      user_id: existing.userId,
      plan: existing.plan,
      plan_info: PLANS[existing.plan] || PLANS.free,
      persistence_mode: persistence.mode,
    });
  }

  const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
  const apiKey = 'sm_' + crypto.randomBytes(20).toString('hex');
  const now = new Date().toISOString();

  const user = { userId, email, name: name || email.split('@')[0], plan, createdAt: now, emailVerified: false, lastLogin: null };
  const keyObj = { key: apiKey, userId, plan, name: 'Default Key', createdAt: now, lastUsedAt: null, requestsCount: 0, expiresAt: null };

  // Store in KV
  await createUser(user);
  await createApiKey(keyObj);

  return res.status(201).json({
    message: 'Account created',
    api_key: apiKey,
    user_id: userId,
    plan,
    plan_info: PLANS[plan] || PLANS.free,
    note: 'Accounts persisted via KV layer. In demo mode, resets on cold start.',
    persistence_mode: persistence.mode,
  });
}

async function handleMe(req, res) {
  const apiKey = req.headers['x-api-key'] || req.query?.key;
  if (!apiKey) return res.status(401).json({ error: 'x-api-key required' });

  const keyObj = await getApiUserByKey(apiKey);
  if (!keyObj) return res.status(401).json({ error: 'Invalid API key' });

  // Find user by userId
  const allUsers = await getAllUsers();
  const user = allUsers.find(u => u.userId === keyObj.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.status(200).json({
    user_id: user.userId,
    email: user.email,
    plan: user.plan,
    plan_info: PLANS[user.plan] || PLANS.free,
    req_count: keyObj.requestsCount,
    created_at: user.createdAt,
    persistence_mode: persistence.mode,
  });
}

async function handleLogin(req, res) {
  const body = req.body || {};
  const { email } = body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const user = await getUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'No account found for this email. Did you register?' });

  // Find key for this user
  const allKeys = await persistence.hgetall('auth:keys');
  let keyObj = null;
  if (allKeys) {
    for (const k of Object.values(allKeys)) {
      const parsed = JSON.parse(k);
      if (parsed.userId === user.userId) {
        keyObj = parsed;
        break;
      }
    }
  }
  // Fallback to seed store
  if (!keyObj) {
    const seed = loadSeedStore();
    keyObj = Object.values(seed.api_keys).find(k => k.userId === user.userId);
  }

  return res.status(200).json({
    message: 'Welcome back',
    api_key: keyObj?.key,
    user_id: user.userId,
    email: user.email,
    plan: user.plan,
    plan_info: PLANS[user.plan] || PLANS.free,
    persistence_mode: persistence.mode,
  });
}

async function handleRotate(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'x-api-key required' });

  const keyObj = await getApiUserByKey(apiKey);
  if (!keyObj) return res.status(401).json({ error: 'Invalid API key' });

  const newKey = 'sm_' + crypto.randomBytes(20).toString('hex');
  const newKeyObj = { ...keyObj, key: newKey, createdAt: new Date().toISOString() };

  // Remove old, add new
  await deleteApiKey(apiKey);
  await createApiKey(newKeyObj);

  return res.status(200).json({
    message: 'Key rotated',
    new_key: newKey,
    persistence_mode: persistence.mode,
  });
}

// ── Subscriber management (uses file-based storage for simplicity) ─────────
async function handleSubscribe(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { email, plan = 'free', source = 'web' } = JSON.parse(body || '{}');
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
      }

      // Use KV for subscribers too
      let store = await persistence.get('auth:subscribers');
      store = store ? JSON.parse(store) : { subscribers: {} };

      const existing = Object.values(store.subscribers).find(s => s.email === email);
      if (existing) {
        return res.status(200).json({
          message: 'Already subscribed',
          email,
          subscribed_at: existing.subscribed_at,
          digest_time: '09:00 GMT+8',
          persistence_mode: persistence.mode,
        });
      }

      const id = 'sub_' + crypto.randomBytes(8).toString('hex');
      store.subscribers[id] = { id, email, plan, source, subscribed_at: new Date().toISOString(), active: true };
      store._updated = new Date().toISOString();
      await persistence.set('auth:subscribers', JSON.stringify(store));

      return res.status(200).json({
        message: 'Subscribed',
        email,
        digest_time: '09:00 GMT+8',
        note: 'Daily AI intelligence brief. Unsubscribe anytime.',
        persistence_mode: persistence.mode,
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid request body' });
    }
  });
}

async function handleUnsubscribe(req, res) {
  const email = req.query?.email || '';
  const token = req.query?.token || '';
  if (!email || !token) return res.status(400).json({ error: 'email and token required' });

  let store = await persistence.get('auth:subscribers');
  store = store ? JSON.parse(store) : { subscribers: {} };

  const entry = Object.entries(store.subscribers).find(([, s]) => s.email === email);
  if (!entry) return res.status(404).json({ error: 'Subscriber not found' });

  // Verify token (same derivation as send_digest.py)
  const vaultPath = join(process.cwd(), 'security', 'vault', 'store.json');
  let secret = 'fallback-secret';
  if (existsSync(vaultPath)) {
    try {
      const vault = JSON.parse(readFileSync(vaultPath, 'utf8'));
      const vaultItem = vault.items?.['sec_smtp_pass'];
      if (vaultItem) {
        secret = Buffer.from(vaultItem.ciphertext_b64, 'base64').toString();
      }
    } catch {}
  }
  const expected = crypto.createHash('sha256').update(`${email}:${secret}:unsubscribe`).digest('hex').slice(0, 32);

  if (token !== expected) return res.status(403).json({ error: 'Invalid unsubscribe token' });

  store.subscribers[entry[0]].active = false;
  store.subscribers[entry[0]].unsubscribed_at = new Date().toISOString();
  store._updated = new Date().toISOString();
  await persistence.set('auth:subscribers', JSON.stringify(store));

  // If HTML request (browser link), redirect to a confirmation page
  const accept = req.headers?.accept || '';
  if (accept.includes('text/html')) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unsubscribed</title><style>body{font-family:system-ui;background:#0d1117;color:#e6edf3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style></head><body><div style="text-align:center"><div style="font-size:32px;margin-bottom:16px">✓</div><h2>Unsubscribed</h2><p style="color:#8b949e">${email} has been removed from Signal Market digest.</p><a href="https://signal-market.pages.dev" style="color:#2d7dd2">← Back to Signal Market</a></div></body></html>`);
  }
  return res.status(200).json({
    message: 'Unsubscribed',
    email,
    persistence_mode: persistence.mode,
  });
}

async function handleSubscriberList(req, res) {
  // Accept: x-api-key (enterprise) OR Authorization: Bearer <founder_key>
  const FOUNDER_KEY = 'sm_founder_95d12139a6c22bd5bdd33720462ad743';
  const apiKey = req.headers['x-api-key'] || '';
  const bearer = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  const isFounder = bearer === FOUNDER_KEY;

  if (!isFounder) {
    const keyObj = await getApiUserByKey(apiKey);
    if (!keyObj || keyObj.plan !== 'enterprise') {
      return res.status(403).json({ error: 'Enterprise plan required' });
    }
  }

  let subs = await persistence.get('auth:subscribers');
  subs = subs ? JSON.parse(subs) : { subscribers: {} };

  const all = Object.values(subs.subscribers);
  const active = all.filter(s => s.active !== false && s.status !== 'unsubscribed');
  const unsubscribed = all.filter(s => s.active === false || s.status === 'unsubscribed');

  return res.status(200).json({
    total: all.length,
    active: active.length,
    unsubscribed: unsubscribed.length,
    subscribers: active.map(s => ({
      id: s.id,
      email: s.email,
      subscribed_at: s.subscribed_at,
      plan: s.plan || 'free',
    })),
    unsubscribed_list: unsubscribed.map(s => ({
      id: s.id,
      email: s.email,
      unsubscribed_at: s.unsubscribed_at,
    })),
    retrieved_at: new Date().toISOString(),
    persistence_mode: persistence.mode,
  });
}

async function handleInfo(req, res) {
  return res.status(200).json({
    plans: PLANS,
    persistence: `kv_layer_${persistence.mode}`,
    auth_note: 'KV persistence layer active. Seed accounts from data/auth_store.json merged for backwards compatibility.',
    persistence_mode: persistence.mode,
  });
}

// ── Router ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawSegment = (req.url || '').split('/').pop() || '';
  const action = req.query?.action || rawSegment.split('?')[0];

  if (req.method === 'POST' && action === 'register') return handleRegister(req, res);
  if (req.method === 'POST' && action === 'login') return handleLogin(req, res);
  if (req.method === 'GET' && action === 'me') return handleMe(req, res);
  if (req.method === 'POST' && action === 'rotate') return handleRotate(req, res);
  if (req.method === 'POST' && action === 'subscribe') return handleSubscribe(req, res);
  if ((req.method === 'GET' || req.method === 'POST') && action === 'unsubscribe') return handleUnsubscribe(req, res);
  if (req.method === 'GET' && action === 'subscribers') return handleSubscriberList(req, res);
  return handleInfo(req, res);
}
