-- For the admin page: when each account was last seen, and a count of
-- deleted accounts that says nothing about whose they were.

-- A request from one of the account's devices, to the hour.
ALTER TABLE users ADD COLUMN last_seen_at INTEGER;
UPDATE users SET last_seen_at = (SELECT MAX(last_used_at) FROM sessions WHERE sessions.user_id = users.id);

-- One row per deleted account: who deleted it (its owner, or the admin),
-- when it was made and when it went. No id, no name.
CREATE TABLE IF NOT EXISTS deletion_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reason TEXT NOT NULL,
    user_created_at INTEGER,
    deleted_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_deletion_log_deleted ON deletion_log(deleted_at);
