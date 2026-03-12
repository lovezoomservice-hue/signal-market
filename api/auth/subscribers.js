/**
 * GET /api/auth/subscribers
 * Management endpoint — list active subscribers
 * Requires: Authorization: Bearer <founder_api_key>
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const STORE  = join(__dir, '../../data/subscribers.json');
const AUTH_STORE = join(__dir, '../../data/auth_store.json');
const FOUNDER_KEY = 'sm_founder_95d12139a6c22bd5bdd33720462ad743';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Auth check — Founder key only
  const auth = req.headers.authorization || '';
  const key  = auth.replace('Bearer ', '').trim();
  if (key !== FOUNDER_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!existsSync(STORE)) {
    return res.status(200).json({ subscribers: [], total: 0, active: 0 });
  }

  const data = JSON.parse(readFileSync(STORE, 'utf8'));
  const all  = data.subscribers || [];
  const active   = all.filter(s => s.status === 'active');
  const inactive = all.filter(s => s.status !== 'active');

  return res.status(200).json({
    total:       all.length,
    active:      active.length,
    unsubscribed: inactive.length,
    subscribers: active.map(s => ({
      id:           s.id,
      email:        s.email,
      subscribed_at: s.subscribed_at,
      plan:         s.plan || 'free',
    })),
    unsubscribed_list: inactive.map(s => ({
      id:    s.id,
      email: s.email,
      unsubscribed_at: s.unsubscribed_at,
    })),
    retrieved_at: new Date().toISOString(),
  });
}
