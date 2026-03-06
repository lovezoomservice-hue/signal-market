/**
 * Watchlist API - Vercel Endpoint
 */

const fs = require('fs');
const path = require('path');

const WATCHLIST_FILE = path.join(process.cwd(), 'data', 'watchlist.json');

function loadWatchlist() {
  try {
    if (fs.existsSync(WATCHLIST_FILE)) {
      return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading watchlist:', err.message);
  }
  return [];
}

function saveWatchlist(watchlist) {
  try {
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(watchlist, null, 2));
  } catch (err) {
    console.error('Error saving watchlist:', err.message);
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET
  if (req.method === 'GET') {
    const watchlist = loadWatchlist();
    return res.status(200).json({ watchlist, count: watchlist.length });
  }
  
  // POST
  if (req.method === 'POST') {
    const data = req.body || {};
    const watchlist = loadWatchlist();
    const id = 'watch_' + Date.now();
    const item = {
      id,
      topic: data.topic,
      stage: data.stage || 'emerging',
      confidence: data.confidence || 0.5,
      created_at: new Date().toISOString()
    };
    watchlist.push(item);
    saveWatchlist(watchlist);
    return res.status(200).json({ success: true, watch_id: id, item });
  }
  
  // DELETE
  if (req.method === 'DELETE') {
    const id = req.query.id;
    let watchlist = loadWatchlist();
    const idx = watchlist.findIndex(w => w.id === id);
    if (idx > -1) {
      watchlist.splice(idx, 1);
      saveWatchlist(watchlist);
    }
    return res.status(200).json({ success: true });
  }
  
  return res.status(404).json({ error: 'Not found' });
}
