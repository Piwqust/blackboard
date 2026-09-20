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
CREATE TRIGGER share_capacity BEFORE INSERT ON shares
WHEN NOT EXISTS (SELECT 1 FROM shares WHERE id = NEW.id)
BEGIN
  SELECT CASE WHEN (SELECT bytes + length(NEW.token) > 100000000 OR records >= 10000 FROM share_budget WHERE singleton = 1)
    THEN RAISE(ABORT, 'share_capacity') END;
END;
CREATE TRIGGER share_insert AFTER INSERT ON shares
BEGIN
  UPDATE share_budget SET bytes = bytes + length(NEW.token), records = records + 1 WHERE singleton = 1;
END;
CREATE TRIGGER share_revoke AFTER UPDATE OF token ON shares
BEGIN
  UPDATE share_budget SET bytes = bytes + coalesce(length(NEW.token), 0) - coalesce(length(OLD.token), 0) WHERE singleton = 1;
END;
