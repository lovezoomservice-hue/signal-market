CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  stage TEXT DEFAULT 'emerging',
  confidence REAL DEFAULT 0.5,
  created_at TEXT
);
