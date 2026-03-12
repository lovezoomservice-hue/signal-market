/**
 * Signal Subscription Manager — Stateles Demo Implementation
 *
 * Allows users and agents to register signal topic subscriptions.
 * In-memory storage (resets on cold start) — acceptable for MVP.
 *
 * Endpoints:
 *   POST /api/v2/subscribe — Create subscription
 *   GET /api/v2/subscribe?topic=AI+Agents — Get subscription by topic
 *   DELETE /api/v2/subscribe?subscription_id=sub_xxxxx — Cancel subscription
 */

// In-memory subscription store (resets on cold start)
const subscriptions = new Map();

function generateSubscriptionId() {
  return 'sub_' + crypto.randomUUID().slice(0, 8);
}

// ── Handlers ────────────────────────────────────────────────────────────────
export default function handler(req, res) {
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
      };

      // Store by subscription_id (primary key)
      subscriptions.set(subscription_id, subscription);

      // Also store index by topic for lookup
      const topicIndexKey = `topic:${topic}`;
      if (!subscriptions.has(topicIndexKey)) {
        subscriptions.set(topicIndexKey, []);
      }
      subscriptions.get(topicIndexKey).push(subscription_id);

      return res.status(201).json(subscription);
    }

    // ── GET: Get subscription by topic or subscription_id ───────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const topic = url.searchParams.get('topic');
      const subscription_id = url.searchParams.get('subscription_id');

      if (subscription_id) {
        // Direct lookup by ID
        const subscription = subscriptions.get(subscription_id);
        if (!subscription || subscription.subscription_id) {
          // Check if it's actually a subscription (not a topic index)
          const sub = subscriptions.get(subscription_id);
          if (!sub || sub.topic === undefined) {
            return res.status(404).json({ error: 'Subscription not found' });
          }
          return res.status(200).json(sub);
        }
        return res.status(200).json(subscription);
      }

      if (topic) {
        // Lookup by topic index
        const topicIndexKey = `topic:${topic}`;
        const subscriptionIds = subscriptions.get(topicIndexKey) || [];
        const subs = subscriptionIds
          .map(id => subscriptions.get(id))
          .filter(s => s && s.status === 'active');

        if (subs.length === 0) {
          return res.status(404).json({ error: 'No active subscriptions found for topic' });
        }

        return res.status(200).json({
          topic,
          subscription_count: subs.length,
          subscriptions: subs,
        });
      }

      // No params — return all active subscriptions (for admin/debug)
      const allSubs = Array.from(subscriptions.values())
        .filter(s => s.subscription_id && s.status === 'active');

      return res.status(200).json({
        total_active: allSubs.length,
        subscriptions: allSubs,
      });
    }

    // ── DELETE: Cancel subscription ─────────────────────────────────────────
    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const subscription_id = url.searchParams.get('subscription_id');

      if (!subscription_id) {
        return res.status(400).json({ error: 'Missing required parameter: subscription_id' });
      }

      const subscription = subscriptions.get(subscription_id);
      if (!subscription || subscription.topic === undefined) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      // Mark as cancelled (don't delete to preserve audit trail)
      subscription.status = 'cancelled';
      subscription.cancelled_at = new Date().toISOString();

      // Remove from topic index
      const topicIndexKey = `topic:${subscription.topic}`;
      const topicIndex = subscriptions.get(topicIndexKey) || [];
      const updatedIndex = topicIndex.filter(id => id !== subscription_id);
      if (updatedIndex.length === 0) {
        subscriptions.delete(topicIndexKey);
      } else {
        subscriptions.set(topicIndexKey, updatedIndex);
      }

      return res.status(200).json({
        subscription_id,
        status: 'cancelled',
        cancelled_at: subscription.cancelled_at,
      });
    }

    // ── Method not allowed ──────────────────────────────────────────────────
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[subscribe] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
