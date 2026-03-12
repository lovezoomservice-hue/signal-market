const fs = require('fs');
const path = require('path');

const WATCHLIST_FILE = path.join(__dirname, 'watchlist.json');

// Load watchlist from file
function loadWatchlist() {
  if (fs.existsSync(WATCHLIST_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Save watchlist to file
function saveWatchlist(watchlist) {
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(watchlist, null, 2));
}

// Get all items
function getWatchlist() {
  return loadWatchlist();
}

// Add item
function addToWatchlist(item) {
  const watchlist = loadWatchlist();
  const id = 'watch_' + Date.now();
  const newItem = {
    id,
    topic: item.topic,
    stage: item.stage || 'emerging',
    confidence: item.confidence || 0.5,
    created_at: new Date().toISOString()
  };
  watchlist.push(newItem);
  saveWatchlist(watchlist);
  return newItem;
}

// Remove item
function removeFromWatchlist(id) {
  let watchlist = loadWatchlist();
  const idx = watchlist.findIndex(w => w.id === id);
  if (idx > -1) {
    watchlist.splice(idx, 1);
    saveWatchlist(watchlist);
    return true;
  }
  return false;
}

module.exports = { getWatchlist, addToWatchlist, removeFromWatchlist, loadWatchlist, saveWatchlist };
