import { getUnifiedEvents, getUnifiedEvent, getUnifiedMeta } from './_unified.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/events/{id} via query param from vercel.json routing
  const { id, topic, limit } = req.query || {};

  if (id) {
    const event = getUnifiedEvent(id);
    if (!event) return res.status(404).json({ error: 'Event not found', event_id: id });
    return res.status(200).json(event);
  }

  const events = getUnifiedEvents({ topic, limit });
  return res.status(200).json({
    events,
    count:      events.length,
    updated_at: getUnifiedMeta().updated_at,
    inputs_hash: getUnifiedMeta().inputs_hash,
  });
}
