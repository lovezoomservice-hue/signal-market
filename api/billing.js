/**
 * Billing API - Vercel Endpoint
 * GET  /api/billing          → plans list
 * GET  /api/billing/usage    → current user usage
 * POST /api/billing/checkout → create Stripe checkout session
 * POST /api/billing/webhook  → Stripe webhook handler
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const PLANS = {
  free:       { name:'Free',       price:0,      price_id:null,             req_per_day:100,   currency:'usd' },
  basic:      { name:'Basic',      price:9.99,   price_id:'price_basic',    req_per_day:1000,  currency:'usd' },
  pro:        { name:'Pro',        price:49.99,  price_id:'price_pro',      req_per_day:10000, currency:'usd' },
  enterprise: { name:'Enterprise', price:299.99, price_id:'price_enterprise',req_per_day:null, currency:'usd' },
};

function getStripeKey() {
  // Runtime: from env var (set in Vercel dashboard)
  return process.env.STRIPE_SECRET_KEY || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const subpath = url.replace(/\?.*$/,'').split('/').slice(3).join('/');

  // GET /api/billing  → plans
  // GET /api/billing/plans → plans (alternate route)
  if (req.method === 'GET' && (!subpath || subpath === 'plans')) {
    return res.status(200).json({
      plans: Object.entries(PLANS).map(([id,p]) => ({ id, ...p })),
      currency: 'usd',
      payment_provider: 'stripe',
    });
  }

  // GET /api/billing/usage
  if (req.method === 'GET' && subpath === 'usage') {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'x-api-key required' });
    return res.status(200).json({
      plan: 'free',
      req_today: 0,
      req_limit: 100,
      reset_at: new Date(Date.now() + 86400000).toISOString(),
      usage_pct: 0,
    });
  }

  // POST /api/billing/checkout
  if (req.method === 'POST' && subpath === 'checkout') {
    const { plan_id, email, success_url, cancel_url } = req.body || {};
    if (!plan_id || !email) return res.status(400).json({ error: 'plan_id and email required' });
    const plan = PLANS[plan_id];
    if (!plan) return res.status(404).json({ error: 'Plan not found', available: Object.keys(PLANS) });
    if (plan.price === 0) return res.status(400).json({ error: 'Free plan does not require checkout' });

    const stripeKey = getStripeKey();
    if (!stripeKey) {
      // Stripe not configured — return demo checkout URL
      return res.status(200).json({
        checkout_url: `https://buy.stripe.com/demo?plan=${plan_id}&email=${encodeURIComponent(email)}`,
        session_id:   'demo_session_' + Date.now(),
        plan:         plan,
        mode:         'demo',
        note:         'Set STRIPE_SECRET_KEY in Vercel environment variables to enable live checkout',
      });
    }

    // Real Stripe checkout (when key is configured)
    try {
      const Stripe = require('stripe');
      const stripe = Stripe(stripeKey);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: plan.price_id, quantity: 1 }],
        customer_email: email,
        success_url: success_url || 'https://signal-market.pages.dev?checkout=success',
        cancel_url:  cancel_url  || 'https://signal-market.pages.dev?checkout=cancel',
        metadata: { plan_id, email },
      });
      return res.status(200).json({ checkout_url: session.url, session_id: session.id, plan });
    } catch(e) {
      return res.status(500).json({ error: 'Stripe error', message: e.message });
    }
  }

  return res.status(404).json({ error: 'Not found', available: ['','usage','checkout'] });
}
