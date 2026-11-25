-- Two-step sign-in: a code from an authenticator app (TOTP, RFC 6238) after
-- the password, or one of ten single-use backup codes instead.

-- The app's shared secret (base32) once it's on; the one being set up until
-- its first code confirms it; and the last 30-second step a code was used
-- for, so a code can't be used twice.
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_pending TEXT;
ALTER TABLE users ADD COLUMN totp_pending_at INTEGER;
ALTER TABLE users ADD COLUMN totp_last_step INTEGER;

-- Setting a new password with the recovery key goes in two steps. The first
-- proves the key (and the second step, when it's on) and gets a ticket; only
-- that ticket, within ten minutes, lets the second set the password. Kept
-- as SHA-256.
ALTER TABLE users ADD COLUMN recovery_ticket TEXT;
ALTER TABLE users ADD COLUMN recovery_ticket_until INTEGER;

-- Backup codes, as SHA-256 of the code. Each works once.
CREATE TABLE IF NOT EXISTS backup_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON backup_codes(user_id);
