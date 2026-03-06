export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Try to get watchlist count
  let watchlist_count = 0;
  try {
    const fs = require('fs');
    const path = require('path');
    const WATCHLIST_FILE = path.join(process.cwd(), 'data', 'watchlist.json');
    if (fs.existsSync(WATCHLIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
      watchlist_count = Array.isArray(data) ? data.length : 0;
    }
  } catch (err) {
    console.error('Error reading watchlist:', err.message);
  }
  
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.2',
    watchlist_count
  });
}
