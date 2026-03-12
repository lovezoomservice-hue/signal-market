/**
 * Signal Subscription Manager — Persistent Implementation
 *
 * Allows users and agents to register signal topic subscriptions.
 * Uses KV persistence layer: Vercel KV in production, in-memory fallback for demo.
 *
 * Endpoints:
 *   POST /api/v2/subscribe — Create subscription
 *   GET /api/v2/subscribe?topic=AI+Agents — Get subscription by topic
 *   GET /api/v2/subscribe?subscription_id=sub_xxxxx — Get subscription by ID
 *   DELETE /api/v2/subscribe?subscription_id=sub_xxxxx — Cancel subscription
 */

import persistence from '../lib/kv.js';

function generateSubscriptionId() {
  return 'sub_' + crypto.randomUUID().slice(0, 8);
}

// Key patterns:
// sub:{subscription_id} → stores full subscription object
// sub_topic:{topic} → stores subscription_id for lookup by topic

// ── Handlers ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ── POST: Create subscription ───────────────────────────────────────────
    if (req.method === 'POST') {
      const { topic, urgency_threshold, webhook_url, email } = req.body || {};

      if (!topic) {
        return res.status(400).json({ error: 'Missing required field: topic' });
      }

      const subscription_id = generateSubscriptionId();
      const created_at = new Date().toISOString();

      const subscription = {
        subscription_id,
        topic,
        urgency_threshold: urgency_threshold || 'medium',
        webhook_url: webhook_url || null,
        email: email || null,
        status: 'active',
        created_at,
        note: 'Webhook/email delivery via notify endpoint',
        persistence_mode: persistence.mode,
      };

      // Store by subscription_id (primary key)
      await persistence.set(`sub:${subscription_id}`, JSON.stringify(subscription));

      // Also store index by topic for lookup (append to list)
      const topicKey = `sub_topic:${topic.toLowerCase()}`;
      let topicIds = await persistence.get(topicKey);
      topicIds = topicIds ? JSON.parse(topicIds) : [];
      topicIds.push(subscription_id);
      await persistence.set(topicKey, JSON.stringify(topicIds));

      return res.status(201).json(subscription);
    }

    // ── GET: Get subscription by topic or subscription_id ───────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const topic = url.searchParams.get('topic');
      const subscription_id = url.searchParams.get('subscription_id');

      if (subscription_id) {
        // Direct lookup by ID
        const subData = await persistence.get(`sub:${subscription_id}`);
        if (!subData) {
          return res.status(404).json({ error: 'Subscription not found' });
        }
        const subscription = JSON.parse(subData);
        return res.status(200).json(subscription);
      }

      if (topic) {
        // Lookup by topic index
        const topicKey = `sub_topic:${topic.toLowerCase()}`;
        const topicIdsData = await persistence.get(topicKey);
        const subscriptionIds = topicIdsData ? JSON.parse(topicIdsData) : [];

        const subs = [];
        for (const id of subscriptionIds) {
          const subData = await persistence.get(`sub:${id}`);
          if (subData) {
            const sub = JSON.parse(subData);
            if (sub && sub.status === 'active') {
              subs.push(sub);
            }
          }
        }

        if (subs.length === 0) {
          return res.status(404).json({ error: 'No active subscriptions found for topic' });
        }

        return res.status(200).json({
          topic,
          subscription_count: subs.length,
          subscriptions: subs,
          persistence_mode: persistence.mode,
        });
      }

      // No params — return all active subscriptions (for admin/debug)
      const allKeys = await persistence.keys('sub:');
      const allSubs = [];
      for (const key of allKeys) {
        if (!key.startsWith('sub_topic:')) {
          const subData = await persistence.get(key);
          if (subData) {
            const sub = JSON.parse(subData);
            if (sub && sub.subscription_id && sub.status === 'active') {
              allSubs.push(sub);
            }
          }
        }
      }

      return res.status(200).json({
        total_active: allSubs.length,
        subscriptions: allSubs,
        persistence_mode: persistence.mode,
      });
    }

    // ── DELETE: Cancel subscription ─────────────────────────────────────────
    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const subscription_id = url.searchParams.get('subscription_id');

      if (!subscription_id) {
        return res.status(400).json({ error: 'Missing required parameter: subscription_id' });
      }

      const subData = await persistence.get(`sub:${subscription_id}`);
      if (!subData) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      const subscription = JSON.parse(subData);

      // Mark as cancelled (don't delete to preserve audit trail)
      subscription.status = 'cancelled';
      subscription.cancelled_at = new Date().toISOString();
      await persistence.set(`sub:${subscription_id}`, JSON.stringify(subscription));

      // Remove from topic index
      const topicKey = `sub_topic:${subscription.topic.toLowerCase()}`;
      const topicIdsData = await persistence.get(topicKey);
      if (topicIdsData) {
        const topicIds = JSON.parse(topicIdsData);
        const updatedIndex = topicIds.filter(id => id !== subscription_id);
        if (updatedIndex.length === 0) {
          await persistence.delete(topicKey);
        } else {
          await persistence.set(topicKey, JSON.stringify(updatedIndex));
        }
      }

      return res.status(200).json({
        subscription_id,
        status: 'cancelled',
        cancelled_at: subscription.cancelled_at,
        persistence_mode: persistence.mode,
      });
    }

    // ── Method not allowed ──────────────────────────────────────────────────
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[subscribe] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
