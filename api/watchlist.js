const WATCHLIST = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET
  if (req.method === 'GET') {
    return res.status(200).json({ watchlist: WATCHLIST, count: WATCHLIST.length });
  }
  
  // POST
  if (req.method === 'POST') {
    const data = req.body || {};
    const id = 'watch_' + Date.now();
    const item = {
      id,
      topic: data.topic,
      stage: data.stage || 'emerging',
      confidence: data.confidence || 0.5,
      created_at: new Date().toISOString()
    };
    WATCHLIST.push(item);
    return res.status(200).json({ success: true, watch_id: id, item });
  }
  
  // DELETE
  if (req.method === 'DELETE') {
    const id = req.query.id;
    const idx = WATCHLIST.findIndex(w => w.id === id);
    if (idx > -1) WATCHLIST.splice(idx, 1);
    return res.status(200).json({ success: true });
  }
  
  return res.status(404).json({ error: 'Not found' });
}
