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
   for failed sign-ins, and the Workers rate limiter in front.

   One account is the admin's, by its name (ADMIN_USERNAME). Nobody else can
   take that name: it can only be made with the password it was set up
   with, which the server knows only as SHA-256 of the sign-in key it makes
   (ADMIN_KEY_HASH), never as the password, and its admin page works only
   with two-step sign-in on. The admin sees accounts, devices
   and sizes, and can sign an account out, lift a lock or delete it; no
   journal can be read here, the admin's included. */

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
    /** The admin's username (a secret). */
    ADMIN_USERNAME?: string;
    /** base64url SHA-256 of the sign-in key the admin's password makes, which
     *  is what lets that name be made (a secret). */
    ADMIN_KEY_HASH?: string;
}

/** A session lasts this long after it was last used. */
const SESSION_DAYS = 60;
/** At most this many devices signed in at once; the longest unused goes. */
const MAX_SESSIONS = 30;
/** The encrypted journal, as stored. D1 holds up to 2 MB a row. */
const MAX_VAULT = 1_500_000;
const MAX_BODY = MAX_VAULT + 4_096;

/** A shared night (migrations/0004_watch.sql): its sealed copy is small,
 *  and it lasts a day at most. */
const MAX_WATCH = 64_000;
const MAX_WATCH_HOURS = 24;
const WATCH_ID = /^[A-Za-z0-9_-]{22}$/;
const WATCH_DATA = /^w1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

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

/* ── two-step sign-in ───────────────────────────────────────────────── */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(bytes: Uint8Array): string {
    let out = '';
    let value = 0;
    let bits = 0;
    for (const b of bytes) {
        value = (value << 8) | b;
        bits += 8;
        while (bits >= 5) {
            out += B32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    return bits > 0 ? out + B32[(value << (5 - bits)) & 31] : out;
}

function unbase32(text: string): Uint8Array {
    const out: number[] = [];
    let value = 0;
    let bits = 0;
    for (const c of text.toUpperCase().replace(/[\s=]/g, '')) {
        const v = B32.indexOf(c);
        if (v < 0) throw new Error('not base32');
        value = (value << 5) | v;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return new Uint8Array(out);
}

/** The six digits an authenticator app shows for 30-second step `step` (RFC 6238). */
async function totpAt(secret: string, step: number): Promise<string> {
    const key = await crypto.subtle.importKey('raw', unbase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const msg = new DataView(new ArrayBuffer(8));
    msg.setUint32(0, Math.floor(step / 2 ** 32));
    msg.setUint32(4, step >>> 0);
    const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg.buffer));
    const o = h[h.length - 1] & 15;
    const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 1_000_000).padStart(6, '0');
}

/** The step `code` is for, now or a step either side (a phone's clock may be
 *  off by a little), or null. */
async function totpStep(secret: string, code: string): Promise<number | null> {
    const t = Math.floor(Date.now() / 30_000);
    for (const step of [t, t - 1, t + 1]) if (same(await totpAt(secret, step), code)) return step;
    return null;
}

/** Backup codes read aloud and copy by hand: no 0/o, 1/l/i. */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const plainCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const codeHash = async (s: string) => b64url(await sha256(utf8(plainCode(s))));

function newBackupCode(): string {
    let out = '';
    while (out.length < 8)
        for (const b of random(16)) {
            // Only bytes that fall evenly on the alphabet, so no letter comes up more.
            if (b < 248 && out.length < 8) out += CODE_ALPHABET[b % 31];
        }
    return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Ten new backup codes in place of any before; returned once, kept as hashes. */
async function freshBackupCodes(db: D1Database, userId: string): Promise<string[]> {
    const codes = Array.from({ length: 10 }, newBackupCode);
    const hashes = await Promise.all(codes.map(codeHash));
    await db.batch([
        db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(userId),
        ...hashes.map(h => db.prepare('INSERT INTO backup_codes (id, user_id, code_hash) VALUES (?, ?, ?)').bind(crypto.randomUUID(), userId, h)),
    ]);
    return codes;
}

/** The second step: six digits from the app, or a backup code. Either works
 *  once: an app code's step is remembered, and a backup code is crossed off. */
async function secondStep(db: D1Database, user: UserRow, code: unknown, secret = user.totp_secret, appOnly = false): Promise<boolean> {
    if (typeof code !== 'string' || !secret) return false;
    const digits = code.replace(/\s/g, '');
    if (/^\d{6}$/.test(digits)) {
        const step = await totpStep(secret, digits);
        if (step === null) return false;
        const used = await db
            .prepare('UPDATE users SET totp_last_step = ? WHERE id = ? AND (totp_last_step IS NULL OR totp_last_step < ?)')
            .bind(step, user.id, step)
            .run();
        return !!used.meta?.changes;
    }
    if (appOnly || plainCode(code).length !== 8) return false;
    const used = await db
        .prepare('UPDATE backup_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL')
        .bind(now(), user.id, await codeHash(code))
        .run();
    return !!used.meta?.changes;
}

const CODE_REQUIRED = () => fail('CODE_REQUIRED', 'Enter the code from your authenticator app, or a backup code.', 401);
const WRONG_CODE = () => fail('WRONG_CODE', 'That code isn’t right, or it’s been used.', 401);

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
    totp_secret: string | null;
    totp_pending: string | null;
    totp_pending_at: number | null;
    totp_last_step: number | null;
    recovery_ticket: string | null;
    recovery_ticket_until: number | null;
}

const now = () => Math.floor(Date.now() / 1000);
const publicUser = (u: Pick<UserRow, 'id' | 'username' | 'created_at'>, admin = false) => ({
    id: u.id,
    username: u.username,
    created: u.created_at * 1000,
    ...(admin ? { admin: true } : {}),
});

const adminName = (env: ApiEnv) => env.ADMIN_USERNAME?.trim().toLowerCase() || null;
const isAdmin = (env: ApiEnv, u: Pick<UserRow, 'username_key'>) => u.username_key === adminName(env);

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
        db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(t, userId),
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
        await db.batch([
            db.prepare('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?').bind(t, t + SESSION_DAYS * 86400, row.sid),
            db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(t, row.id),
        ]);
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
            if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const username = typeof b.username === 'string' ? b.username.trim() : '';
            if (!USERNAME.test(username))
                return fail('BAD_USERNAME', 'A username is 3 to 30 letters, digits, - or _.', 400);
            if (RESERVED.has(username.toLowerCase())) return fail('USERNAME_TAKEN', 'That username is taken.', 409);
            const recovery = recoveryOf(b);
            if (!isKey(b.auth, 32) || !isWrapped(b.key) || !recovery) return fail('BAD_REQUEST', 'Invalid request.', 400);
            // The admin's name, made only with the admin's password: anyone
            // else is told it's taken.
            const admin = username.toLowerCase() === adminName(env);
            if (admin) {
                const expected = env.ADMIN_KEY_HASH?.trim() ?? '';
                if (!expected || !same(b64url(await sha256(unb64url(b.auth))), expected))
                    return fail('USERNAME_TAKEN', 'That username is taken.', 409);
            }

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
            return ok({ token, user: publicUser({ id, username, created_at: t }, admin) }, 201);
        }

        // Sign in.
        if (path === '/api/login' && method === 'POST') {
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const username = typeof b.username === 'string' ? b.username.trim() : '';
            const account = username.toLowerCase();
            if (!(await allowed(env.RL_AUTH, `login-ip:${ipOf(request)}`))) return TOO_MANY();
            if (!(await allowed(env.RL_AUTH, `login-user:${account}`))) return TOO_MANY();
            if (!USERNAME.test(username)) return WRONG();
            const locked = await lockedFor(db, account);
            if (locked) return LOCKED(locked);
            const user = await db.prepare('SELECT * FROM users WHERE username_key = ?').bind(account).first<UserRow>();
            // The admin's name before its account is made, with the admin's own
            // password: that sign-in makes it (the browser goes on to sign up),
            // so there's no separate step to find. Anything else is a wrong try.
            if (!user && account === adminName(env) && env.ADMIN_KEY_HASH && isKey(b.auth, 32)) {
                if (same(b64url(await sha256(unb64url(b.auth))), env.ADMIN_KEY_HASH.trim()))
                    return fail('ADMIN_NOT_MADE', 'The admin’s account isn’t made yet: making it now.', 409);
            }
            if (!user || !(await matches(user, b.auth))) {
                if (user) await miss(db, account);
                return WRONG();
            }
            // The password was right; with two-step sign-in on, the code too.
            if (user.totp_secret) {
                if (b.code == null || b.code === '') return CODE_REQUIRED();
                if (!(await secondStep(db, user, b.code))) {
                    await miss(db, account);
                    return WRONG_CODE();
                }
            }
            await clearMisses(db, account);
            const token = await newSession(db, user.id, request);
            return ok({ token, user: publicUser(user, isAdmin(env, user)), key: JSON.parse(user.wrapped_key) });
        }

        // Set a new password with the recovery key: first prove the key (and
        // the second step, when it's on) and get the journal key it wraps and
        // a ticket, then, with the ticket, set the password.
        if ((path === '/api/recover/start' || path === '/api/recover/finish') && method === 'POST') {
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const username = typeof b.username === 'string' ? b.username.trim() : '';
            const account = username.toLowerCase();
            if (!(await allowed(env.RL_AUTH, `recover-ip:${ipOf(request)}`))) return TOO_MANY();
            if (!(await allowed(env.RL_AUTH, `recover-user:${account}`))) return TOO_MANY();
            const badKey = () => fail('INVALID_RECOVERY', 'That username and recovery key don’t match.', 401);
            if (!USERNAME.test(username)) return badKey();
            const locked = await lockedFor(db, account);
            if (locked) return LOCKED(locked);
            const user = await db.prepare('SELECT * FROM users WHERE username_key = ?').bind(account).first<UserRow>();
            if (!user || !(await matches(user, b.recoveryAuth, true))) {
                if (user) await miss(db, account);
                return badKey();
            }
            if (path === '/api/recover/start') {
                if (user.totp_secret) {
                    if (b.code == null || b.code === '') return CODE_REQUIRED();
                    if (!(await secondStep(db, user, b.code))) {
                        await miss(db, account);
                        return WRONG_CODE();
                    }
                }
                const ticket = b64url(random(32));
                await db
                    .prepare('UPDATE users SET recovery_ticket = ?, recovery_ticket_until = ? WHERE id = ?')
                    .bind(b64url(await sha256(utf8(ticket))), now() + 600, user.id)
                    .run();
                return ok({ key: JSON.parse(user.recovery_wrapped_key), ticket });
            }

            // Only with the ticket from the first step, and within ten minutes.
            const ticketOk =
                typeof b.ticket === 'string' &&
                !!user.recovery_ticket &&
                (user.recovery_ticket_until ?? 0) > now() &&
                same(b64url(await sha256(utf8(b.ticket))), user.recovery_ticket);
            if (!ticketOk) return fail('TICKET', 'That took too long. Start again.', 401);
            const recovery = recoveryOf(b);
            if (!isKey(b.auth, 32) || !isWrapped(b.key) || !recovery) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const pw = await credentials(b.auth, b.key);
            const rc = await credentials(recovery.auth, recovery.key);
            await db.batch([
                db
                    .prepare(
                        `UPDATE users SET auth_salt = ?, auth_hash = ?, wrapped_key = ?,
                                          recovery_salt = ?, recovery_hash = ?, recovery_wrapped_key = ?,
                                          password_changed_at = ?, recovery_ticket = NULL, recovery_ticket_until = NULL
                          WHERE id = ?`,
                    )
                    .bind(pw.salt, pw.hash, pw.wrapped, rc.salt, rc.hash, rc.wrapped, now(), user.id),
                // A new password signs every device out.
                db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
            ]);
            await clearMisses(db, account);
            const token = await newSession(db, user.id, request);
            return ok({ token, user: publicUser(user, isAdmin(env, user)) });
        }

        // A night shared with a link. Neither side needs an account.
        if (path === '/api/watch' || path.startsWith('/api/watch/')) return await watchRoute(db, env, request, path, method);

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
            const [sessions, vault, codes] = await Promise.all([
                db
                    .prepare('SELECT id, device, created_at, last_used_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_used_at DESC')
                    .bind(user.id, now())
                    .all<{ id: string; device: string; created_at: number; last_used_at: number }>(),
                db.prepare('SELECT version, size, updated_at FROM vaults WHERE user_id = ?').bind(user.id).first<{ version: number; size: number; updated_at: number }>(),
                db.prepare('SELECT count(*) AS n FROM backup_codes WHERE user_id = ? AND used_at IS NULL').bind(user.id).first<{ n: number }>(),
            ]);
            return ok({
                user: publicUser(user, isAdmin(env, user)),
                key: JSON.parse(user.wrapped_key),
                sessions: sessions.results.map(s => ({
                    id: s.id,
                    device: s.device,
                    created: s.created_at * 1000,
                    used: s.last_used_at * 1000,
                    current: s.id === sid,
                })),
                vault: vault ? { version: vault.version, size: vault.size, updated: vault.updated_at * 1000 } : null,
                twoFactor: { on: !!user.totp_secret, backupCodes: user.totp_secret ? (codes?.n ?? 0) : 0 },
            });
        }

        // Two-step sign-in. Setting it up: a new secret for the app to scan,
        // kept aside until a code from it, with the password, turns it on.
        if (path === '/api/2fa/setup' && method === 'POST') {
            if (user.totp_secret) return fail('ALREADY_ON', 'Two-step sign-in is already on.', 409);
            const secret = base32(random(20));
            await db.prepare('UPDATE users SET totp_pending = ?, totp_pending_at = ? WHERE id = ?').bind(secret, now(), user.id).run();
            const issuer = 'Oyama Journal';
            const label = encodeURIComponent(`${issuer}:${user.username}`);
            return ok({ secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30` });
        }

        if (path.startsWith('/api/2fa/') && method === 'POST') {
            if (!(await allowed(env.RL_AUTH, `password:${user.id}`))) return TOO_MANY();
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const locked = await lockedFor(db, user.username_key);
            if (locked) return LOCKED(locked);
            if (!(await matches(user, b.auth))) {
                await miss(db, user.username_key);
                return fail('WRONG_PASSWORD', 'That isn’t the password.', 403);
            }

            // On: the first code from the app confirms it scanned the secret.
            if (path === '/api/2fa/enable') {
                if (user.totp_secret) return fail('ALREADY_ON', 'Two-step sign-in is already on.', 409);
                if (!user.totp_pending || now() - (user.totp_pending_at ?? 0) > 1800) return fail('NO_SETUP', 'That setup ran out of time. Start again.', 409);
                if (!(await secondStep(db, user, b.code, user.totp_pending, true)))
                    return fail('WRONG_CODE', 'That code isn’t right. Check your phone’s clock, and try the next one.', 400);
                await db.prepare('UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_pending_at = NULL WHERE id = ?').bind(user.id).run();
                await clearMisses(db, user.username_key);
                return ok({ backupCodes: await freshBackupCodes(db, user.id) });
            }

            // Off, or new backup codes: the password and a code.
            if (path === '/api/2fa/disable' || path === '/api/2fa/backup-codes') {
                if (!user.totp_secret) return fail('NOT_ON', 'Two-step sign-in isn’t on.', 409);
                if (!(await secondStep(db, user, b.code))) {
                    await miss(db, user.username_key);
                    return WRONG_CODE();
                }
                await clearMisses(db, user.username_key);
                if (path === '/api/2fa/backup-codes') return ok({ backupCodes: await freshBackupCodes(db, user.id) });
                await db.batch([
                    db.prepare('UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_pending_at = NULL, totp_last_step = NULL WHERE id = ?').bind(user.id),
                    db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(user.id),
                ]);
                return ok({});
            }
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
                return fail('BAD_REQUEST', 'Invalid request.', 400);
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
            if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const locked = await lockedFor(db, user.username_key);
            if (locked) return LOCKED(locked);
            if (!(await matches(user, b.auth))) {
                await miss(db, user.username_key);
                return fail('WRONG_PASSWORD', 'That isn’t the current password.', 403);
            }
            if (!isKey(b.newAuth, 32) || !isWrapped(b.key)) return fail('BAD_REQUEST', 'Invalid request.', 400);
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
            if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const locked = await lockedFor(db, user.username_key);
            if (locked) return LOCKED(locked);
            if (!(await matches(user, b.auth))) {
                await miss(db, user.username_key);
                return fail('WRONG_PASSWORD', 'That isn’t the current password.', 403);
            }
            const recovery = recoveryOf(b);
            if (!recovery) return fail('BAD_REQUEST', 'Invalid request.', 400);
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
            if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const locked = await lockedFor(db, user.username_key);
            if (locked) return LOCKED(locked);
            if (!(await matches(user, b.auth))) {
                await miss(db, user.username_key);
                return fail('WRONG_PASSWORD', 'That isn’t the password.', 403);
            }
            await db.batch(deleteAccount(db, user, 'self'));
            return ok(null, 204);
        }

        // The admin's, and only the admin's.
        if (path.startsWith('/api/admin/')) {
            if (!isAdmin(env, user)) return fail('FORBIDDEN', 'This is for the site’s admin.', 403);
            return await adminRoute(path, method, url, request, env, db, user, sid);
        }

        return fail('NOT_FOUND', 'Nothing here.', 404);
    } catch (e) {
        console.error('api', path, e);
        return fail('SERVER_ERROR', 'Something went wrong on the server. Try again in a moment.', 500);
    }
}

/** Everything an account keeps, deleted, and a line saying one was, and by whom. */
/* ── a night shared with a link ─────────────────────────────────────── */

/** The sealed copy of a shared night: made, replaced, read and ended. What
 *  it holds is encrypted on the sharing device with a key this server is
 *  never sent, so all it can do is keep the copy and hand it over. Only the
 *  device with the token can replace or end it; anyone with the id can
 *  read the sealed copy, which says nothing without the key. */
async function watchRoute(db: D1Database, env: ApiEnv, request: Request, path: string, method: string): Promise<Response> {
    const ip = ipOf(request);
    const t = now();
    const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const tokenHash = async () => b64url(await sha256(utf8(bearer)));
    const GONE = () => fail('NOT_FOUND', 'This link has ended.', 404);

    if (path === '/api/watch' && method === 'POST') {
        if (!(await allowed(env.RL_AUTH, `watch:${ip}`))) return TOO_MANY();
        const b = await body(request);
        if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
        const { id, token, data } = b;
        const hours = typeof b.hours === 'number' && b.hours > 0 ? Math.min(MAX_WATCH_HOURS, b.hours) : 12;
        if (typeof id !== 'string' || !WATCH_ID.test(id) || !isKey(token, 32) || typeof data !== 'string' || !WATCH_DATA.test(data)) return fail('BAD_REQUEST', 'Invalid request.', 400);
        if (data.length > MAX_WATCH) return fail('TOO_LARGE', 'That is too much to share.', 413);
        // The ones that have run out go as new ones come.
        await db.prepare('DELETE FROM watches WHERE expires_at < ?').bind(t).run();
        const expires = t + Math.round(hours * 3600);
        const made = await db
            .prepare('INSERT INTO watches (id, token_hash, data, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
            .bind(id, b64url(await sha256(utf8(token))), data, t, t, expires)
            .run();
        if (!made.meta?.changes) return fail('CONFLICT', 'Try again.', 409);
        return ok({ id, expires: expires * 1000 }, 201);
    }

    const id = path.slice('/api/watch/'.length);
    if (!WATCH_ID.test(id)) return GONE();

    if (method === 'GET') {
        if (!(await allowed(env.RL_SYNC, `watch:${ip}`))) return TOO_MANY();
        const row = await db.prepare('SELECT data, updated_at, expires_at FROM watches WHERE id = ? AND expires_at >= ?').bind(id, t).first<{ data: string; updated_at: number; expires_at: number }>();
        if (!row) return GONE();
        return ok({ data: row.data, updated: row.updated_at * 1000, expires: row.expires_at * 1000 });
    }

    if (method === 'PUT') {
        if (!(await allowed(env.RL_SYNC, `watch:${ip}`))) return TOO_MANY();
        const b = await body(request);
        const data = b?.data;
        if (typeof data !== 'string' || !WATCH_DATA.test(data)) return fail('BAD_REQUEST', 'Invalid request.', 400);
        if (data.length > MAX_WATCH) return fail('TOO_LARGE', 'That is too much to share.', 413);
        const wrote = await db.prepare('UPDATE watches SET data = ?, updated_at = ? WHERE id = ? AND token_hash = ? AND expires_at >= ?').bind(data, t, id, await tokenHash(), t).run();
        return wrote.meta?.changes ? ok({ updated: t * 1000 }) : GONE();
    }

    if (method === 'DELETE') {
        await db.prepare('DELETE FROM watches WHERE id = ? AND token_hash = ?').bind(id, await tokenHash()).run();
        return ok(null, 204);
    }
    return fail('NOT_FOUND', 'Nothing here.', 404);
}

function deleteAccount(db: D1Database, user: UserRow, by: 'self' | 'admin'): D1PreparedStatement[] {
    return [
        db.prepare('DELETE FROM vaults WHERE user_id = ?').bind(user.id),
        db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
        db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(user.id),
        db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
        db.prepare('DELETE FROM login_backoff WHERE account = ?').bind(user.username_key),
        db.prepare('INSERT INTO deletion_log (reason, user_created_at) VALUES (?, ?)').bind(by, user.created_at),
    ];
}

/* ── the admin's ────────────────────────────────────────────────────── */

async function adminRoute(
    path: string,
    method: string,
    url: URL,
    request: Request,
    env: ApiEnv,
    db: D1Database,
    me: UserRow,
    sid: string,
): Promise<Response> {
    const t = now();

    // The admin's account opens every other: it needs its second step on.
    if (!me.totp_secret) return fail('TWO_FACTOR_REQUIRED', 'Turn on two-step sign-in to use the admin page.', 403);

    // The numbers: accounts, who's been around this week, devices, the
    // encrypted copies, locks, deletions, and sign-ups a day for 30 days.
    if (path === '/api/admin/stats' && method === 'GET') {
        const week = t - 7 * 86400;
        const month = t - 30 * 86400;
        const [row, days] = await Promise.all([
            db
                .prepare(
                    `SELECT
                        (SELECT count(*) FROM users) AS accounts,
                        (SELECT count(*) FROM users WHERE created_at > ?1) AS newWeek,
                        (SELECT count(*) FROM users WHERE last_seen_at > ?1) AS activeWeek,
                        (SELECT count(*) FROM sessions WHERE expires_at > ?2) AS devices,
                        (SELECT count(*) FROM vaults) AS copies,
                        (SELECT COALESCE(SUM(size), 0) FROM vaults) AS bytes,
                        (SELECT count(*) FROM login_backoff WHERE locked_until > ?2) AS locked,
                        (SELECT count(*) FROM users WHERE totp_secret IS NOT NULL) AS twoFactor,
                        (SELECT count(*) FROM deletion_log WHERE reason = 'self' AND deleted_at > ?3) AS deletedSelf,
                        (SELECT count(*) FROM deletion_log WHERE reason = 'admin' AND deleted_at > ?3) AS deletedAdmin`,
                )
                .bind(week, t, month)
                .first<Record<string, number>>(),
            db
                .prepare(`SELECT date(created_at, 'unixepoch') AS day, count(*) AS n FROM users WHERE created_at > ? GROUP BY day`)
                .bind(t - 31 * 86400)
                .all<{ day: string; n: number }>(),
        ]);
        return ok({ ...row, signups: days.results, now: t * 1000 });
    }

    // The accounts, newest first, or those whose name has `q` in it.
    if (path === '/api/admin/users' && method === 'GET') {
        const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 30);
        const like = `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
        const rows = await db
            .prepare(
                `SELECT u.id, u.username, u.username_key, u.created_at, u.last_seen_at, u.totp_secret IS NOT NULL AS two_factor,
                        (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?1) AS devices,
                        v.version, v.size, v.updated_at, b.locked_until, b.failed_attempts
                   FROM users u
                   LEFT JOIN vaults v ON v.user_id = u.id
                   LEFT JOIN login_backoff b ON b.account = u.username_key
                  WHERE u.username_key LIKE ?2 ESCAPE '\\'
                  ORDER BY u.created_at DESC
                  LIMIT 200`,
            )
            .bind(t, like)
            .all<{
                id: string;
                username: string;
                username_key: string;
                created_at: number;
                last_seen_at: number | null;
                devices: number;
                version: number | null;
                size: number | null;
                updated_at: number | null;
                locked_until: number | null;
                failed_attempts: number | null;
                two_factor: number;
            }>();
        const admin = adminName(env);
        return ok({
            users: rows.results.map(r => ({
                id: r.id,
                username: r.username,
                created: r.created_at * 1000,
                seen: r.last_seen_at ? r.last_seen_at * 1000 : null,
                devices: r.devices,
                copy: r.version ? { version: r.version, size: r.size ?? 0, updated: (r.updated_at ?? 0) * 1000 } : null,
                locked: Math.max(0, (r.locked_until ?? 0) - t),
                misses: r.failed_attempts ?? 0,
                twoFactor: !!r.two_factor,
                admin: r.username_key === admin,
            })),
        });
    }

    const m = /^\/api\/admin\/users\/([0-9a-f-]{36})(?:\/(sign-out|unlock|2fa))?$/.exec(path);
    if (m) {
        const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(m[1]).first<UserRow>();
        if (!target) return fail('NOT_FOUND', 'There’s no such account.', 404);

        // Every device it's signed in on (but this one, for the admin's own).
        if (m[2] === 'sign-out' && method === 'POST') {
            await db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(target.id, sid).run();
            return ok({});
        }

        // Lifts a lock from too many wrong passwords.
        if (m[2] === 'unlock' && method === 'POST') {
            await clearMisses(db, target.username_key);
            return ok({});
        }

        // Deleting it, or turning its two-step sign-in off for someone who
        // lost their phone and their backup codes, take the admin's password
        // again: a session left open on some browser shouldn't be enough.
        if (method === 'DELETE' && (!m[2] || m[2] === '2fa')) {
            if (target.id === me.id) return fail('BAD_REQUEST', 'Change your own account from your account page.', 400);
            if (!(await allowed(env.RL_AUTH, `admin:${me.id}`))) return TOO_MANY();
            const b = await body(request);
            if (!b) return fail('BAD_REQUEST', 'Invalid request.', 400);
            const locked = await lockedFor(db, me.username_key);
            if (locked) return LOCKED(locked);
            if (!(await matches(me, b.auth))) {
                await miss(db, me.username_key);
                return fail('WRONG_PASSWORD', 'That isn’t your password.', 403);
            }
            await clearMisses(db, me.username_key);
            if (m[2] === '2fa') {
                await db.batch([
                    db.prepare('UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_pending_at = NULL, totp_last_step = NULL WHERE id = ?').bind(target.id),
                    db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(target.id),
                ]);
                return ok({});
            }
            await db.batch(deleteAccount(db, target, 'admin'));
            return ok(null, 204);
        }
    }

    return fail('NOT_FOUND', 'Nothing here.', 404);
}
