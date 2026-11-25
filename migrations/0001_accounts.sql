-- Accounts, their sessions, and each account's journal as one encrypted copy.
--
-- The server never sees a password or anything in a journal. The browser
-- stretches the password (PBKDF2, 600,000 rounds) into two keys: one it
-- sends to sign in with, which is stored here only as a salted hash, and
-- one it keeps, which unlocks the account's journal key. That journal key is
-- stored here wrapped (encrypted) by the password's key, and again by the
-- recovery key's, so either one opens it and the server opens neither.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    -- As typed when the account was made.
    username TEXT NOT NULL,
    -- Lowercased: "Alice" and "alice" are one account.
    username_key TEXT NOT NULL UNIQUE,
    -- SHA-256 of salt and the key the browser signs in with, both base64url.
    auth_salt TEXT NOT NULL,
    auth_hash TEXT NOT NULL,
    -- The journal key, wrapped by the password's key: JSON {iv, data}.
    wrapped_key TEXT NOT NULL,
    -- The same for the recovery key, which sets a new password.
    recovery_salt TEXT NOT NULL,
    recovery_hash TEXT NOT NULL,
    recovery_wrapped_key TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    password_changed_at INTEGER
);

-- One row per signed-in device. The token itself is never stored, only its
-- SHA-256, so a copy of this table signs nobody in.
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    -- "Safari on iPhone", read from the User-Agent when it signed in.
    device TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- The journal, encrypted in the browser. `version` goes up by one with each
-- write; a write says which version it was made from, and one made from an
-- older version is turned away so the browser merges first.
CREATE TABLE IF NOT EXISTS vaults (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    data TEXT NOT NULL,
    size INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Failed sign-ins per account name, kept in the database so no restart or
-- other server resets them. The fifth miss in a row locks the name for 15
-- minutes, and each one after that doubles it, up to an hour.
CREATE TABLE IF NOT EXISTS login_backoff (
    account TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER
);
