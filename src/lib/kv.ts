import { b64url, pack, unb64url, unpack } from './keys';

/* Where the journal and everything said of the person is kept on this
   device, and the lock on it.

   Without a lock it is the browser's own storage (localStorage), one line a
   key, as before. With one, those lines are kept together in a box that is
   encrypted (AES-GCM) with a random key, and that key is stored wrapped by
   the one a code makes (PBKDF2-SHA256, 600,000 rounds). Nothing of the
   journal is readable on the device until the code is typed; once it is,
   the lines live in memory and every change is written back into the box.

   A second code can open a second, empty box (the "other code"): someone
   made to open the site opens that one. The two boxes are stored the same
   way and either code is simply a code that works. It is no defence against
   someone who examines the device: the boxes differ in size.

   What is never in the box: the theme, the language and the other things
   the page needs before the code is typed, and what the browser keeps so
   pages open offline (public/sw.js), which names the substances opened. */

const META = 'journal.lock.v1';
const BOX = (i: number) => `journal.box.${i}`;
const ROUNDS = 600_000;

/** Every line that goes in the box when the lock is turned on. */
export const LOCKED_KEYS = [
    'journal.log.v1',
    'journal.saved.v2',
    'journal.saved.log.v1',
    'journal.recent.v2',
    'journal.weight.v1',
    'journal.account.v1',
    'journal.account.note.v1',
    'journal.person.v1',
    'journal.watch.v1',
];

interface Wrapped {
    iv: string;
    data: string;
}
interface Meta {
    v: 1;
    salt: string;
    /** One wrapped key per box. Which is the journal's and which the empty
     *  one's isn't written anywhere. */
    slots: (Wrapped | null)[];
    /** Minutes out of sight before the code is asked for again; 0: only when the site is opened. */
    after?: number;
}

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

function ls(): Storage | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}
const rawGet = (key: string): string | null => {
    try {
        return ls()?.getItem(key) ?? null;
    } catch {
        return null;
    }
};
const rawSet = (key: string, value: string | null): boolean => {
    try {
        if (value == null) ls()?.removeItem(key);
        else ls()?.setItem(key, value);
        return true;
    } catch {
        return false;
    }
};

function readMeta(): Meta | null {
    try {
        const m = JSON.parse(rawGet(META) ?? 'null') as Meta | null;
        return m && m.v === 1 && typeof m.salt === 'string' && Array.isArray(m.slots) ? m : null;
    } catch {
        return null;
    }
}

/* ── the box, open ──────────────────────────────────────────────────── */

let mem: Map<string, string> | null = null;
let slot = -1;
let boxKey: CryptoKey | null = null;
/** The key the code made, kept while the box is open so the code or the
 *  other code can be changed without asking for it again. */
let codeKey: CryptoKey | null = null;

const subs = new Map<string, Set<() => void>>();
const emit = (key: string) => subs.get(key)?.forEach(f => f());

async function codeKeyFrom(code: string, salt: string): Promise<CryptoKey> {
    const pw = await subtle().importKey('raw', enc.encode(code.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt: unb64url(salt) as BufferSource, iterations: ROUNDS },
        pw,
        { name: 'AES-GCM', length: 256 },
        false,
        ['wrapKey', 'unwrapKey'],
    );
}

const newBoxKey = () => subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as Promise<CryptoKey>;

async function wrapKey(key: CryptoKey, by: CryptoKey): Promise<Wrapped> {
    const iv = random(12);
    const data = await subtle().wrapKey('raw', key, by, { name: 'AES-GCM', iv });
    return { iv: b64url(iv), data: b64url(new Uint8Array(data)) };
}

/** The key inside `w`, or null when `by` isn't what wrapped it. Kept
 *  readable: it is wrapped again when a code changes. */
async function unwrapKey(w: Wrapped, by: CryptoKey): Promise<CryptoKey | null> {
    try {
        return await subtle().unwrapKey('raw', unb64url(w.data) as BufferSource, by, { name: 'AES-GCM', iv: unb64url(w.iv) as BufferSource }, { name: 'AES-GCM', length: 256 }, true, [
            'encrypt',
            'decrypt',
        ]);
    } catch {
        return null;
    }
}

async function sealBox(lines: Map<string, string>, key: CryptoKey, n: number): Promise<string> {
    const iv = random(12);
    const plain = await pack(JSON.stringify(Object.fromEntries(lines)));
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(BOX(n)) }, key, plain as BufferSource);
    return `b1.${b64url(iv)}.${b64url(new Uint8Array(ct))}`;
}

async function openBox(sealed: string | null, key: CryptoKey, n: number): Promise<Map<string, string>> {
    if (!sealed) return new Map();
    const [v, iv, ct] = sealed.split('.');
    if (v !== 'b1' || !iv || !ct) throw new Error('Not a box');
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64url(iv) as BufferSource, additionalData: enc.encode(BOX(n)) }, key, unb64url(ct) as BufferSource);
    const obj = JSON.parse(await unpack(new Uint8Array(plain))) as Record<string, string>;
    return new Map(Object.entries(obj).filter(([, v]) => typeof v === 'string'));
}

let writing: Promise<void> | null = null;
let dirty = false;
/** Whether the last write of the box got in (storage can be full). */
let wrote = true;

/** Writes the open box back, once more after a write already under way. */
function persist(): Promise<void> {
    dirty = true;
    writing ??= (async () => {
        try {
            while (dirty && mem && boxKey) {
                dirty = false;
                wrote = rawSet(BOX(slot), await sealBox(mem, boxKey, slot));
            }
        } finally {
            writing = null;
        }
    })();
    return writing;
}

/** Resolves once every change so far is in storage. */
export const settled = () => writing ?? Promise.resolve();

/* ── reading and writing a line ─────────────────────────────────────── */

export const kv = {
    get(key: string): string | null {
        return mem ? (mem.get(key) ?? null) : rawGet(key);
    },
    set(key: string, value: string | null) {
        if (!mem) {
            rawSet(key, value);
            return;
        }
        if (value == null) mem.delete(key);
        else mem.set(key, value);
        void persist();
    },
    /** Calls `f` when another tab changes this line. */
    on(key: string, f: () => void): () => void {
        if (!subs.has(key)) subs.set(key, new Set());
        subs.get(key)!.add(f);
        return () => {
            subs.get(key)?.delete(f);
        };
    },
};

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', e => {
        // The lock was turned on, off or changed in another tab: start again.
        if (e.key === META) {
            window.location.reload();
            return;
        }
        if (!mem) {
            if (e.key) emit(e.key);
            return;
        }
        if (e.key !== BOX(slot) || !boxKey) return;
        void openBox(e.newValue, boxKey, slot)
            .then(next => {
                if (!mem) return;
                const keys = new Set([...mem.keys(), ...next.keys()]);
                const before = mem;
                mem = next;
                for (const k of keys) if (before.get(k) !== next.get(k)) emit(k);
            })
            .catch(() => {});
    });
}

/* ── the lock ───────────────────────────────────────────────────────── */

/** 'off': no lock. 'locked': a code is needed. 'open': the code was typed. */
export function lockState(): 'off' | 'locked' | 'open' {
    if (mem) return 'open';
    return readMeta() ? 'locked' : 'off';
}

/** Minutes out of sight before the code is asked for again. */
export const lockAfter = () => readMeta()?.after ?? 0;

/** Whether an other code is set: one that opens an empty journal. */
export const hasOtherCode = () => (readMeta()?.slots.filter(Boolean).length ?? 0) > 1;

/** Tries a code. True when it opened a box, the journal's or the empty one's. */
export async function unlock(code: string): Promise<boolean> {
    const meta = readMeta();
    if (!meta) return true;
    const by = await codeKeyFrom(code, meta.salt);
    for (let n = 0; n < meta.slots.length; n++) {
        const w = meta.slots[n];
        const key = w && (await unwrapKey(w, by));
        if (!key) continue;
        let lines: Map<string, string>;
        try {
            lines = await openBox(rawGet(BOX(n)), key, n);
        } catch {
            continue;
        }
        mem = lines;
        slot = n;
        boxKey = key;
        codeKey = by;
        return true;
    }
    return false;
}

/** Turns the lock on: every line the journal keeps goes into a box only
 *  `code` opens. The plain lines are taken away only once the box has been
 *  written and read back. */
export async function lockOn(code: string): Promise<void> {
    if (readMeta()) throw new Error('Already locked');
    const salt = b64url(random(16));
    const by = await codeKeyFrom(code, salt);
    const key = await newBoxKey();
    // Which of the two places the journal's box takes is left to chance.
    const n = random(1)[0] & 1;
    const lines = new Map<string, string>();
    for (const k of LOCKED_KEYS) {
        const v = rawGet(k);
        if (v != null) lines.set(k, v);
    }
    const sealed = await sealBox(lines, key, n);
    if (!rawSet(BOX(n), sealed) || rawGet(BOX(n)) !== sealed) {
        rawSet(BOX(n), null);
        throw new Error('No room');
    }
    await openBox(sealed, key, n);
    const slots: (Wrapped | null)[] = [null, null];
    slots[n] = await wrapKey(key, by);
    const meta: Meta = { v: 1, salt, slots, after: 5 };
    if (!rawSet(META, JSON.stringify(meta))) {
        rawSet(BOX(n), null);
        throw new Error('No room');
    }
    for (const k of LOCKED_KEYS) rawSet(k, null);
    mem = lines;
    slot = n;
    boxKey = key;
    codeKey = by;
}

/** Turns the lock off: the open box's lines go back as plain ones, and
 *  both boxes are taken away. */
export async function lockOff(): Promise<void> {
    if (!mem) return;
    await settled();
    const lines = mem;
    for (const [k, v] of lines) if (!rawSet(k, v)) throw new Error('No room');
    mem = null;
    boxKey = null;
    codeKey = null;
    slot = -1;
    rawSet(META, null);
    rawSet(BOX(0), null);
    rawSet(BOX(1), null);
}

/** A new code for the box that's open. */
export async function changeCode(code: string): Promise<void> {
    const meta = readMeta();
    if (!meta || !mem || !boxKey) throw new Error('Not open');
    const other = meta.slots[1 - slot];
    // The other box's key is wrapped by the other code, salted the same:
    // a new salt would shut it. So the salt stays while there is one.
    const salt = other ? meta.salt : b64url(random(16));
    const by = await codeKeyFrom(code, salt);
    if (other && (await unwrapKey(other, by))) throw new Error('Same as the other code');
    const slots = [...meta.slots];
    slots[slot] = await wrapKey(boxKey, by);
    if (!rawSet(META, JSON.stringify({ ...meta, salt, slots }))) throw new Error('No room');
    codeKey = by;
}

/** Sets the other code, which opens an empty journal, or takes it away
 *  (and its box with it) when `code` is null. From the journal's own box
 *  only. */
export async function setOtherCode(code: string | null): Promise<void> {
    const meta = readMeta();
    if (!meta || !mem || !codeKey) throw new Error('Not open');
    const n = 1 - slot;
    const slots = [...meta.slots];
    if (code == null) {
        slots[n] = null;
        rawSet(META, JSON.stringify({ ...meta, slots }));
        rawSet(BOX(n), null);
        return;
    }
    const by = await codeKeyFrom(code, meta.salt);
    if (await unwrapKey(meta.slots[slot]!, by)) throw new Error('Same as the code');
    const key = await newBoxKey();
    const sealed = await sealBox(new Map(), key, n);
    slots[n] = await wrapKey(key, by);
    if (!rawSet(BOX(n), sealed) || !rawSet(META, JSON.stringify({ ...meta, slots }))) throw new Error('No room');
}

export function setLockAfter(minutes: number) {
    const meta = readMeta();
    if (meta) rawSet(META, JSON.stringify({ ...meta, after: minutes }));
}

/** Whether the last change made it into storage. */
export const lastWriteHeld = () => wrote;

/** Everything this site keeps on this device, gone: the journal, the lock,
 *  the account's sign-in and keys, and what was kept for offline. Nothing
 *  is said to the account, so its encrypted copy stays as it is. */
export async function wipeDevice(): Promise<void> {
    mem = null;
    boxKey = null;
    codeKey = null;
    try {
        const store = ls();
        if (store) {
            const keys: string[] = [];
            for (let i = 0; i < store.length; i++) {
                const k = store.key(i);
                if (k && (k.startsWith('journal.') || k.startsWith('journal-') || k.startsWith('pixel') || k.startsWith('oyama'))) keys.push(k);
            }
            keys.forEach(k => store.removeItem(k));
        }
    } catch {
        /* nothing to clear */
    }
    try {
        await new Promise<void>(done => {
            const req = indexedDB.deleteDatabase('oyama-journal');
            req.onsuccess = req.onerror = req.onblocked = () => done();
        });
    } catch {
        /* no database */
    }
    try {
        for (const name of await caches.keys()) if (name.startsWith('journal-')) await caches.delete(name);
    } catch {
        /* no caches */
    }
}
