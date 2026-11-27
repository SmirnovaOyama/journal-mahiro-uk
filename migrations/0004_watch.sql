-- A night shared with someone trusted, for as long as it lasts.
--
-- The device that shares it encrypts what it shares (the doses of the
-- night, and whether a check-in was answered) with a key it makes itself,
-- and gives that key to the watcher inside the link, after the #, which
-- browsers never send to a server. So a row here is a sealed copy this
-- server can't open, the hash of the token that may replace or end it, and
-- when it expires: a day at most. No account is needed for either side,
-- and none is recorded.

CREATE TABLE IF NOT EXISTS watches (
    -- Made by the sharing device: 16 random bytes, base64url.
    id TEXT PRIMARY KEY,
    -- SHA-256 of the token only the sharing device has.
    token_hash TEXT NOT NULL,
    -- The sealed copy, as the device sent it.
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watches_expires ON watches(expires_at);
