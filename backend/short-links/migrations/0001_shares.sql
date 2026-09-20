CREATE TABLE shares (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT,
  owner_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
-- Tombstones prevent retries from resurrecting a revoked copy.
-- Bound anonymous storage independently of per-location rate limits.
CREATE TABLE share_budget (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), bytes INTEGER NOT NULL, records INTEGER NOT NULL);
INSERT INTO share_budget VALUES (1, 0, 0);
