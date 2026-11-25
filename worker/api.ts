/* Accounts, under /api/. An account keeps one encrypted copy of a journal so
   it can be the same on every device signed in to it.

   Nothing the server holds can be read by it. The browser stretches the
   password (PBKDF2-SHA256, 600,000 rounds, salted with the account name) and
   splits the result in two: a sign-in key, sent here, and a key it keeps,
   which unwraps the account's journal key. The sign-in key is stored only as
   SHA-256 of it with a random salt. The stretching already happened in the
   browser, so a stolen table still costs 600,000 rounds a guess, and the
   sign-in key opens nothing even if it's seen. The journal key is stored
   wrapped twice, by the password's key and by a recovery key the person
   keeps, and the journal itself is stored encrypted by it (AES-GCM).

   Laid out after hrt.mahiro.uk's own accounts (src/server/routes/auth.ts
   there): a name and a password, a session per device, a persistent backoff
   for failed sign-ins, and the Workers rate limiter in front. */

/* The runtime's own types, declared here so the Worker type-checks without
   all of @cloudflare/workers-types. */
interface D1Result {
    results?: unknown[];
    meta?: { changes?: number };
}
interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
    run(): Promise<D1Result>;
}
interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
interface RateLimit {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ApiEnv {
    DB?: D1Database;
    /** Ten a minute: signing up, signing in, passwords, recovery. */
    RL_AUTH?: RateLimit;
    /** Sixty a minute: syncing and the account page. */
    RL_SYNC?: RateLimit;
}

/** A session lasts this long after it was last used. */
const SESSION_DAYS = 60;
/** At most this many devices signed in at once; the longest unused goes. */
const MAX_SESSIONS = 30;
/** The encrypted journal, as stored. D1 holds up to 2 MB a row. */
const MAX_VAULT = 1_500_000;
const MAX_BODY = MAX_VAULT + 4_096;

const USERNAME = /^[A-Za-z0-9_-]{3,30}$/;
const RESERVED = new Set(['admin', 'administrator', 'root', 'system', 'support', 'help', 'staff', 'owner', 'official', 'api', 'www', 'me', 'user', 'users', 'security', 'null', 'undefined', 'oyama', 'journal', 'mahiro']);

/* ── answers ────────────────────────────────────────────────────────── */

const HEADERS = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex',
    'referrer-policy': 'no-referrer',
};

const ok = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: HEADERS });
const fail = (error: string, message: string, status: number, extra: Record<string, string> = {}, more: object = {}) =>
    new Response(JSON.stringify({ error, message, ...more }), { status, headers: { ...HEADERS, ...extra } });

const WRONG = () => fail('INVALID_CREDENTIALS', 'Wrong username or password.', 401);
const SIGNED_OUT = () => fail('SIGNED_OUT', 'Signed out. Sign in again.', 401);
const TOO_MANY = () => fail('RATE_LIMITED', 'Too many tries. Wait a minute and try again.', 429, { 'retry-after': '60' });

/* ── bytes ──────────────────────────────────────────────────────────── */

const utf8 = (s: string) => new TextEncoder().encode(s);

function b64url(bytes: Uint8Array): string {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
    const b = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
}

/** base64url of exactly `bytes` bytes. */
function isKey(s: unknown, bytes: number): s is string {
    return typeof s === 'string' && s.length === Math.ceil((bytes * 4) / 3) && /^[A-Za-z0-9_-]+$/.test(s);
}

async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
    const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        all.set(p, at);
        at += p.length;
    }
    return new Uint8Array(await crypto.subtle.digest('SHA-256', all));
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** The stored form of a sign-in key. */
async function keyHash(salt: string, key: string): Promise<string> {
    return b64url(await sha256(unb64url(salt), unb64url(key)));
}

/** Equal strings, in time that doesn't depend on where they differ. */
function same(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

/** A journal key wrapped by another key: AES-GCM, a 12-byte nonce and 32
 *  bytes with their 16-byte tag. */
interface Wrapped {
    iv: string;
    data: string;
}
function isWrapped(w: unknown): w is Wrapped {
    const x = w as Wrapped;
    return !!x && typeof x === 'object' && isKey(x.iv, 12) && isKey(x.data, 48);
}

/** The encrypted journal: "v1.", the nonce, ".", the ciphertext. */
const VAULT = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

/* ── requests ───────────────────────────────────────────────────────── */

async function body(request: Request): Promise<Record<string, unknown> | null> {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BODY) return null;
    try {
        const text = await request.text();
        if (text.length > MAX_BODY) return null;
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

const ipOf = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'local';

async function allowed(limiter: RateLimit | undefined, key: string): Promise<boolean> {
    if (!limiter) return true;
    try {
        return (await limiter.limit({ key })).success;
    } catch {
        return true;
    }
}

/** "Safari on iPhone", for the list of signed-in devices. */
export function deviceName(ua: string): string {
    const browser = /EdgiOS|Edg\//.test(ua)
        ? 'Edge'
        : /OPR\//.test(ua)
          ? 'Opera'
          : /FxiOS|Firefox\//.test(ua)
            ? 'Firefox'
            : /SamsungBrowser/.test(ua)
              ? 'Samsung Internet'
              : /CriOS|Chrome\//.test(ua)
                ? 'Chrome'
                : /Safari\//.test(ua)
                  ? 'Safari'
                  : 'A browser';
    const os = /iPhone/.test(ua)
        ? 'iPhone'
        : /iPad/.test(ua)
          ? 'iPad'
          : /Android/.test(ua)
            ? 'Android'
            : /Macintosh|Mac OS X/.test(ua)
              ? 'Mac'
              : /Windows/.test(ua)
                ? 'Windows'
                : /CrOS/.test(ua)
                  ? 'ChromeOS'
                  : /Linux/.test(ua)
                    ? 'Linux'
                    : '';
    return os ? `${browser} on ${os}` : browser;
}

/* ── accounts ───────────────────────────────────────────────────────── */

interface UserRow {
    id: string;
    username: string;
    username_key: string;
    auth_salt: string;
    auth_hash: string;
    wrapped_key: string;
    recovery_salt: string;
    recovery_hash: string;
    recovery_wrapped_key: string;
    created_at: number;
}

const now = () => Math.floor(Date.now() / 1000);
const publicUser = (u: Pick<UserRow, 'id' | 'username' | 'created_at'>) => ({ id: u.id, username: u.username, created: u.created_at * 1000 });

async function newSession(db: D1Database, userId: string, request: Request): Promise<string> {
    const token = b64url(random(32));
    const hash = b64url(await sha256(utf8(token)));
    const t = now();
    await db.batch([
        db
            .prepare('INSERT INTO sessions (id, user_id, token_hash, device, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(crypto.randomUUID(), userId, hash, deviceName(request.headers.get('user-agent') ?? ''), t, t, t + SESSION_DAYS * 86400),
        // Gone stale, or one too many: the longest unused goes.
        db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(userId, t),
        db
            .prepare(
                `DELETE FROM sessions WHERE user_id = ? AND id NOT IN
                    (SELECT id FROM sessions WHERE user_id = ? ORDER BY last_used_at DESC LIMIT ?)`,
            )
            .bind(userId, userId, MAX_SESSIONS),
    ]);
    return token;
}

interface Signed {
    user: UserRow;
    sid: string;
}

/** The account a request's bearer token belongs to, or null. */
async function signedIn(db: D1Database, request: Request): Promise<Signed | null> {
    const m = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization') ?? '');
    if (!m) return null;
    const hash = b64url(await sha256(utf8(m[1])));
    const row = await db
        .prepare(
            `SELECT s.id AS sid, s.last_used_at, s.expires_at, u.*
               FROM sessions s JOIN users u ON u.id = s.user_id
              WHERE s.token_hash = ?`,
        )
        .bind(hash)
        .first<UserRow & { sid: string; last_used_at: number; expires_at: number }>();
    const t = now();
    if (!row || row.expires_at < t) return null;
    // Used again: it lasts another SESSION_DAYS. Written at most hourly.
    if (t - row.last_used_at > 3600)
        await db.prepare('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?').bind(t, t + SESSION_DAYS * 86400, row.sid).run();
    return { user: row, sid: row.sid };
}

/* Failed sign-ins, per account name: see login_backoff in migrations/. */

async function lockedFor(db: D1Database, account: string): Promise<number> {
    const row = await db.prepare('SELECT locked_until FROM login_backoff WHERE account = ?').bind(account).first<{ locked_until: number | null }>();
    const left = (row?.locked_until ?? 0) - now();
    return left > 0 ? left : 0;
}

async function miss(db: D1Database, account: string) {
    await db
        .prepare(
            `INSERT INTO login_backoff (account, failed_attempts, locked_until) VALUES (?, 1, NULL)
             ON CONFLICT(account) DO UPDATE SET
                failed_attempts = failed_attempts + 1,
                locked_until = CASE
                    WHEN failed_attempts + 1 >= 5
                    THEN MAX(COALESCE(locked_until, 0), ? + MIN(900 * (1 << MIN(failed_attempts - 4, 2)), 3600))
                    ELSE locked_until
                END`,
        )
        .bind(account, now())
        .run();
}

const clearMisses = (db: D1Database, account: string) => db.prepare('DELETE FROM login_backoff WHERE account = ?').bind(account).run();

const LOCKED = (seconds: number) =>
    fail('ACCOUNT_LOCKED', `Too many wrong tries for this account. Try again in ${Math.ceil(seconds / 60)} min.`, 429, {
        'retry-after': String(seconds),
    });

/** Whether `key` is this account's sign-in key (or, with `recovery`, its recovery key). */
async function matches(user: UserRow, key: unknown, recovery = false): Promise<boolean> {
    if (!isKey(key, 32)) return false;
    const salt = recovery ? user.recovery_salt : user.auth_salt;
    const stored = recovery ? user.recovery_hash : user.auth_hash;
    return same(await keyHash(salt, key), stored);
}

/** A sign-in key and its journal key, ready to store. */
async function credentials(key: string, wrapped: Wrapped) {
    const salt = b64url(random(16));
    return { salt, hash: await keyHash(salt, key), wrapped: JSON.stringify({ iv: wrapped.iv, data: wrapped.data }) };
}

function recoveryOf(b: Record<string, unknown>): { auth: string; key: Wrapped } | null {
    const r = b.recovery as { auth?: unknown; key?: unknown } | undefined;
    return r && isKey(r.auth, 32) && isWrapped(r.key) ? { auth: r.auth, key: r.key } : null;
}

/* ── the routes ─────────────────────────────────────────────────────── */

export async function handleApi(request: Request, env: ApiEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const method = request.method;
    const db = env.DB;
    if (!db) return fail('UNAVAILABLE', 'Accounts aren’t available here.', 503);

    try {
        // Make an account.
        if (path === '/api/signup' && method === 'POST') {
            if (!(await allowed(env.RL_AUTH, `signup:${ipOf(request)}`))) return TOO_MANY();
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const username = typeof b.username === 'string' ? b.username.trim() : '';
            if (!USERNAME.test(username))
                return fail('BAD_USERNAME', 'A name is 3 to 30 letters, digits, - or _.', 400);
            if (RESERVED.has(username.toLowerCase())) return fail('USERNAME_TAKEN', 'That username is taken.', 409);
            const recovery = recoveryOf(b);
            if (!isKey(b.auth, 32) || !isWrapped(b.key) || !recovery) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);

            const id = crypto.randomUUID();
            const account = username.toLowerCase();
            const pw = await credentials(b.auth, b.key);
            const rc = await credentials(recovery.auth, recovery.key);
            const t = now();
            const made = await db
                .prepare(
                    `INSERT INTO users (id, username, username_key, auth_salt, auth_hash, wrapped_key,
                                        recovery_salt, recovery_hash, recovery_wrapped_key, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(username_key) DO NOTHING`,
                )
                .bind(id, username, account, pw.salt, pw.hash, pw.wrapped, rc.salt, rc.hash, rc.wrapped, t)
                .run();
            if (!made.meta?.changes) return fail('USERNAME_TAKEN', 'That username is taken.', 409);
            // A deleted account's misses would otherwise lock out the name's new owner.
            await clearMisses(db, account);
            const token = await newSession(db, id, request);
            return ok({ token, user: publicUser({ id, username, created_at: t }) }, 201);
        }

        // Sign in.
        if (path === '/api/login' && method === 'POST') {
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const username = typeof b.username === 'string' ? b.username.trim() : '';
            const account = username.toLowerCase();
            if (!(await allowed(env.RL_AUTH, `login-ip:${ipOf(request)}`))) return TOO_MANY();
            if (!(await allowed(env.RL_AUTH, `login-user:${account}`))) return TOO_MANY();
            if (!USERNAME.test(username)) return WRONG();
            const locked = await lockedFor(db, account);
            if (locked) return LOCKED(locked);
            const user = await db.prepare('SELECT * FROM users WHERE username_key = ?').bind(account).first<UserRow>();
            if (!user || !(await matches(user, b.auth))) {
                if (user) await miss(db, account);
                return WRONG();
            }
            await clearMisses(db, account);
            const token = await newSession(db, user.id, request);
            return ok({ token, user: publicUser(user), key: JSON.parse(user.wrapped_key) });
        }

        // Set a new password with the recovery key: first prove the key and
        // get the journal key it wraps, then set the password.
        if ((path === '/api/recover/start' || path === '/api/recover/finish') && method === 'POST') {
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const username = typeof b.username === 'string' ? b.username.trim() : '';
            const account = username.toLowerCase();
            if (!(await allowed(env.RL_AUTH, `recover-ip:${ipOf(request)}`))) return TOO_MANY();
            if (!(await allowed(env.RL_AUTH, `recover-user:${account}`))) return TOO_MANY();
            const badKey = () => fail('INVALID_RECOVERY', 'That username and recovery key don’t go together.', 401);
            if (!USERNAME.test(username)) return badKey();
            const locked = await lockedFor(db, account);
            if (locked) return LOCKED(locked);
            const user = await db.prepare('SELECT * FROM users WHERE username_key = ?').bind(account).first<UserRow>();
            if (!user || !(await matches(user, b.recoveryAuth, true))) {
                if (user) await miss(db, account);
                return badKey();
            }
            if (path === '/api/recover/start') return ok({ key: JSON.parse(user.recovery_wrapped_key) });

            const recovery = recoveryOf(b);
            if (!isKey(b.auth, 32) || !isWrapped(b.key) || !recovery) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const pw = await credentials(b.auth, b.key);
            const rc = await credentials(recovery.auth, recovery.key);
            await db.batch([
                db
                    .prepare(
                        `UPDATE users SET auth_salt = ?, auth_hash = ?, wrapped_key = ?,
                                          recovery_salt = ?, recovery_hash = ?, recovery_wrapped_key = ?,
                                          password_changed_at = ?
                          WHERE id = ?`,
                    )
                    .bind(pw.salt, pw.hash, pw.wrapped, rc.salt, rc.hash, rc.wrapped, now(), user.id),
                // A new password signs every device out.
                db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
            ]);
            await clearMisses(db, account);
            const token = await newSession(db, user.id, request);
            return ok({ token, user: publicUser(user) });
        }

        // Everything after this is for a signed-in device.
        if (!path.startsWith('/api/')) return fail('NOT_FOUND', 'Nothing here.', 404);
        const me = await signedIn(db, request);
        if (!me) return SIGNED_OUT();
        const { user, sid } = me;
        if (!(await allowed(env.RL_SYNC, `user:${user.id}`))) return TOO_MANY();

        if (path === '/api/logout' && method === 'POST') {
            await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
            return ok(null, 204);
        }

        if (path === '/api/account' && method === 'GET') {
            const [sessions, vault] = await Promise.all([
                db
                    .prepare('SELECT id, device, created_at, last_used_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_used_at DESC')
                    .bind(user.id, now())
                    .all<{ id: string; device: string; created_at: number; last_used_at: number }>(),
                db.prepare('SELECT version, size, updated_at FROM vaults WHERE user_id = ?').bind(user.id).first<{ version: number; size: number; updated_at: number }>(),
            ]);
            return ok({
                user: publicUser(user),
                key: JSON.parse(user.wrapped_key),
                sessions: sessions.results.map(s => ({
                    id: s.id,
                    device: s.device,
                    created: s.created_at * 1000,
                    used: s.last_used_at * 1000,
                    current: s.id === sid,
                })),
                vault: vault ? { version: vault.version, size: vault.size, updated: vault.updated_at * 1000 } : null,
            });
        }

        // Sign out one other device, or (with no id) every other one.
        if (path.startsWith('/api/sessions') && method === 'DELETE') {
            const id = path.slice('/api/sessions/'.length);
            if (path === '/api/sessions') await db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(user.id, sid).run();
            else await db.prepare('DELETE FROM sessions WHERE user_id = ? AND id = ?').bind(user.id, id).run();
            return ok(null, 204);
        }

        // The journal. `have` is the version this device last saw; when that's
        // still the latest, the copy isn't sent again.
        if (path === '/api/vault' && method === 'GET') {
            const row = await db.prepare('SELECT version, data, updated_at FROM vaults WHERE user_id = ?').bind(user.id).first<{ version: number; data: string; updated_at: number }>();
            if (!row) return ok({ version: 0 });
            const have = Number(url.searchParams.get('have'));
            if (have === row.version) return ok({ version: row.version, updated: row.updated_at * 1000, same: true });
            return ok({ version: row.version, updated: row.updated_at * 1000, data: row.data });
        }

        // A new copy of the journal, made from version `base`. Made from an
        // older one, it's turned away with the latest version number: the
        // device fetches that, merges, and writes again.
        if (path === '/api/vault' && method === 'PUT') {
            const b = await body(request);
            if (!b) return fail('TOO_LARGE', 'The journal is too large to keep in an account.', 413);
            const base = b.base;
            const data = b.data;
            if (typeof base !== 'number' || !Number.isSafeInteger(base) || base < 0 || typeof data !== 'string' || !VAULT.test(data))
                return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            if (data.length > MAX_VAULT) return fail('TOO_LARGE', 'The journal is too large to keep in an account.', 413);
            const t = now();
            const wrote =
                base === 0
                    ? await db
                          .prepare('INSERT INTO vaults (user_id, version, data, size, updated_at) VALUES (?, 1, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING')
                          .bind(user.id, data, data.length, t)
                          .run()
                    : await db
                          .prepare('UPDATE vaults SET version = version + 1, data = ?, size = ?, updated_at = ? WHERE user_id = ? AND version = ?')
                          .bind(data, data.length, t, user.id, base)
                          .run();
            if (!wrote.meta?.changes) {
                const cur = await db.prepare('SELECT version FROM vaults WHERE user_id = ?').bind(user.id).first<{ version: number }>();
                return fail('CONFLICT', 'The journal changed on another device.', 409, {}, { version: cur?.version ?? 0 });
            }
            return ok({ version: base + 1, updated: t * 1000 });
        }

        // A new password: the old sign-in key, the new one, and the journal
        // key wrapped by the new password. Every other device is signed out.
        if (path === '/api/password' && method === 'POST') {
            if (!(await allowed(env.RL_AUTH, `password:${user.id}`))) return TOO_MANY();
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const locked = await lockedFor(db, user.username_key);
            if (locked) return LOCKED(locked);
            if (!(await matches(user, b.auth))) {
                await miss(db, user.username_key);
                return fail('WRONG_PASSWORD', 'That isn’t the current password.', 403);
            }
            if (!isKey(b.newAuth, 32) || !isWrapped(b.key)) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const pw = await credentials(b.newAuth, b.key);
            await db.batch([
                db
                    .prepare('UPDATE users SET auth_salt = ?, auth_hash = ?, wrapped_key = ?, password_changed_at = ? WHERE id = ?')
                    .bind(pw.salt, pw.hash, pw.wrapped, now(), user.id),
                db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(user.id, sid),
            ]);
            await clearMisses(db, user.username_key);
            return ok({});
        }

        // A new recovery key, in place of the old one.
        if (path === '/api/recovery' && method === 'POST') {
            if (!(await allowed(env.RL_AUTH, `password:${user.id}`))) return TOO_MANY();
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const locked = await lockedFor(db, user.username_key);
            if (locked) return LOCKED(locked);
            if (!(await matches(user, b.auth))) {
                await miss(db, user.username_key);
                return fail('WRONG_PASSWORD', 'That isn’t the current password.', 403);
            }
            const recovery = recoveryOf(b);
            if (!recovery) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const rc = await credentials(recovery.auth, recovery.key);
            await db
                .prepare('UPDATE users SET recovery_salt = ?, recovery_hash = ?, recovery_wrapped_key = ? WHERE id = ?')
                .bind(rc.salt, rc.hash, rc.wrapped, user.id)
                .run();
            await clearMisses(db, user.username_key);
            return ok({});
        }

        // Delete the account and everything it keeps here.
        if (path === '/api/account' && method === 'DELETE') {
            if (!(await allowed(env.RL_AUTH, `password:${user.id}`))) return TOO_MANY();
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'That request couldn’t be read.', 400);
            const locked = await lockedFor(db, user.username_key);
            if (locked) return LOCKED(locked);
            if (!(await matches(user, b.auth))) {
                await miss(db, user.username_key);
                return fail('WRONG_PASSWORD', 'That isn’t the password.', 403);
            }
            await db.batch([
                db.prepare('DELETE FROM vaults WHERE user_id = ?').bind(user.id),
                db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
                db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
                db.prepare('DELETE FROM login_backoff WHERE account = ?').bind(user.username_key),
            ]);
            return ok(null, 204);
        }

        return fail('NOT_FOUND', 'Nothing here.', 404);
    } catch (e) {
        console.error('api', path, e);
        return fail('SERVER_ERROR', 'Something went wrong on the server. Try again in a moment.', 500);
    }
}
