/* The keys behind an account, all made and used in this browser (Web Crypto).

   A password is stretched (PBKDF2-SHA256, 600,000 rounds, salted with the
   lowercased username) and split with HKDF into two keys that can't be
   worked back to each other: a sign-in key, the only thing the server is
   sent, and a key that wraps the journal key. The journal key is random,
   made when the account is, and encrypts the journal (AES-GCM) before it
   leaves. It's stored on the server wrapped twice: by the password's key and
   by a recovery key, 160 random bits shown once as 32 letters and digits.
   Changing the password rewraps the journal key; nothing else changes.

   On a signed-in device the journal key is kept in IndexedDB as a key that
   can be used but not read out (non-extractable). */

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

/* ── bytes ──────────────────────────────────────────────────────────── */

export function b64url(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(s: string): Uint8Array {
    const b = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/* ── from a password, from a recovery key ───────────────────────────── */

const ROUNDS = 600_000;

/** One account per name, whatever its case. */
export const nameKey = (username: string) => username.trim().toLowerCase();

export interface Keys {
    /** Sent to the server to sign in; it opens nothing. */
    auth: string;
    /** Wraps and unwraps the journal key. Never leaves this browser. */
    kek: CryptoKey;
}

async function split(material: ArrayBuffer | Uint8Array, label: string): Promise<Keys> {
    const base = await subtle().importKey('raw', material as BufferSource, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const hkdf = (what: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(`${label}/${what}`) });
    const auth = new Uint8Array(await subtle().deriveBits(hkdf('auth'), base, 256));
    const kek = await subtle().deriveKey(hkdf('key'), base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
    return { auth: b64url(auth), kek };
}

/** The keys a username and password make. Takes a moment: that's the point. */
export async function passwordKeys(username: string, password: string): Promise<Keys> {
    const pw = await subtle().importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle().deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`oyama-journal/v1/${nameKey(username)}`), iterations: ROUNDS },
        pw,
        256,
    );
    return split(bits, 'oyama-journal/v1/password');
}

/* A recovery key: 20 random bytes in Crockford's base 32, no I, L, O or U,
   so it reads aloud and copies by hand without mix-ups; grouped in fours. */

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newRecoveryCode(): string {
    const bytes = random(20);
    let bits = 0;
    let value = 0;
    let out = '';
    for (const b of bytes) {
        value = (value << 8) | b;
        bits += 8;
        while (bits >= 5) {
            out += B32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    return out.match(/.{4}/g)!.join('-');
}

/** The 20 bytes a recovery key stands for, however it was typed (any case,
 *  spaces or dashes, I and L for 1, O for 0), or null if it isn't one. */
export function parseRecoveryCode(text: string): Uint8Array | null {
    const clean = text
        .toUpperCase()
        .replace(/[\s-]+/g, '')
        .replace(/[IL]/g, '1')
        .replace(/O/g, '0');
    if (clean.length !== 32 || [...clean].some(c => !B32.includes(c))) return null;
    const out = new Uint8Array(20);
    let bits = 0;
    let value = 0;
    let i = 0;
    for (const c of clean) {
        value = (value << 5) | B32.indexOf(c);
        bits += 5;
        if (bits >= 8) {
            out[i++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return out;
}

export async function recoveryKeys(code: string): Promise<Keys | null> {
    const bytes = parseRecoveryCode(code);
    return bytes ? split(bytes, 'oyama-journal/v1/recovery') : null;
}

/* ── the journal key ────────────────────────────────────────────────── */

export interface Wrapped {
    iv: string;
    data: string;
}

/** A new journal key, readable once so it can be wrapped. */
export const newJournalKey = () => subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as Promise<CryptoKey>;

export async function wrap(key: CryptoKey, kek: CryptoKey): Promise<Wrapped> {
    const iv = random(12);
    const data = await subtle().wrapKey('raw', key, kek, { name: 'AES-GCM', iv });
    return { iv: b64url(iv), data: b64url(new Uint8Array(data)) };
}

/** The journal key inside `w`; throws if `kek` isn't the one that wrapped it.
 *  Readable only when it's about to be wrapped again. */
export function unwrap(w: Wrapped, kek: CryptoKey, readable = false): Promise<CryptoKey> {
    return subtle().unwrapKey('raw', unb64url(w.data) as BufferSource, kek, { name: 'AES-GCM', iv: unb64url(w.iv) as BufferSource }, { name: 'AES-GCM', length: 256 }, readable, [
        'encrypt',
        'decrypt',
    ]);
}

/* ── the journal, sealed ────────────────────────────────────────────── */

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
    const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
}

/** Compressed when the browser can (a first byte of 1), plain if not (0). */
async function pack(text: string): Promise<Uint8Array> {
    const raw = enc.encode(text);
    if (typeof CompressionStream === 'undefined') return new Uint8Array([0, ...raw]);
    const z = await through(raw, new CompressionStream('gzip'));
    const out = new Uint8Array(z.length + 1);
    out[0] = 1;
    out.set(z, 1);
    return out;
}

async function unpack(bytes: Uint8Array): Promise<string> {
    const body = bytes.subarray(1);
    if (bytes[0] === 0) return new TextDecoder().decode(body);
    return new TextDecoder().decode(await through(body, new DecompressionStream('gzip')));
}

/** Bound to the account, so a copy can't be passed off as another's. */
const aad = (userId: string) => enc.encode(`oyama-journal/v1/vault/${userId}`);

export async function seal(text: string, key: CryptoKey, userId: string): Promise<string> {
    const iv = random(12);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(userId) }, key, (await pack(text)) as BufferSource);
    return `v1.${b64url(iv)}.${b64url(new Uint8Array(ct))}`;
}

export async function unseal(sealed: string, key: CryptoKey, userId: string): Promise<string> {
    const [v, iv, ct] = sealed.split('.');
    if (v !== 'v1' || !iv || !ct) throw new Error('Not a sealed journal');
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64url(iv) as BufferSource, additionalData: aad(userId) }, key, unb64url(ct) as BufferSource);
    return unpack(new Uint8Array(plain));
}

/* ── kept on this device ────────────────────────────────────────────── */

const DB = 'oyama-journal';
const STORE = 'keys';
/** Where IndexedDB isn't there (some private windows): for this visit only. */
const inMemory = new Map<string, CryptoKey>();

function idb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await idb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const req = run(db.transaction(STORE, mode).objectStore(STORE));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
}

export async function keepKey(userId: string, key: CryptoKey): Promise<void> {
    inMemory.set(userId, key);
    try {
        await tx('readwrite', s => s.put(key, userId));
    } catch {
        /* kept for this visit only */
    }
}

export async function keptKey(userId: string): Promise<CryptoKey | null> {
    const mem = inMemory.get(userId);
    if (mem) return mem;
    try {
        const key = await tx<CryptoKey | undefined>('readonly', s => s.get(userId) as IDBRequest<CryptoKey | undefined>);
        if (key) inMemory.set(userId, key);
        return key ?? null;
    } catch {
        return null;
    }
}

export async function forgetKeys(): Promise<void> {
    inMemory.clear();
    try {
        await tx('readwrite', s => s.clear());
    } catch {
        /* nothing kept */
    }
}
