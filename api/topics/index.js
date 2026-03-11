/**
 * /api/topics/:id and /api/topics/:id/stage
 * Vercel routing: /api/topics/(.+) → /api/topics/index.js?id=$1
 *                 /api/topics/(.+)/stage → /api/topics/index.js?id=$1&action=stage
 *
 * Data source: unified _data.js — NO local constants
 */

import { getTopics, DATA_META } from '../_data.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query || {};
  const topics = getTopics();

  // /api/topics — list all
  if (!id) {
    return res.status(200).json({
      topics,
      count:       topics.length,
      updated_at:  DATA_META.updated_at,
      inputs_hash: DATA_META.inputs_hash,
    });
  }

  // find by id (slug)
  const topic = topics.find(t => t.id === id || t.id === id.split('/')[0]);

  if (!topic) {
    return res.status(404).json({ error: 'Topic not found', id });
  }

  // /api/topics/:id/stage
  if (action === 'stage' || id.endsWith('/stage')) {
    return res.status(200).json({
      id:         topic.id,
      topic:      topic.name,
      stage:      topic.stage,
      confidence: topic.confidence,
      proof_id:   topic.proof_id,
      source_url: topic.source_url,
      updated_at: DATA_META.updated_at,
    });
  }

  // /api/topics/:id — full detail
  return res.status(200).json({
    ...topic,
    updated_at: DATA_META.updated_at,
  });
}
