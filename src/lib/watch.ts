import { useSyncExternalStore } from 'react';
import { nightOf } from './advice';
import { getJournal, onLocalChange, type Ingestion } from './journal';
import { b64url, pack, unb64url, unpack } from './keys';
import { kv } from './kv';
import { getPerson, medicinesOf, onPersonChange } from './person';
import { getWeight } from './store';

/* A night shared with someone trusted: "don't use alone", for someone who
   is alone.

   This device makes a key, encrypts what it shares with it (the night's
   doses, the medicines taken every day, the body weight, and when a
   check-in was last answered), and keeps the sealed copy on the server
   (worker/api.ts, /api/watch) for a day at most. The link it hands out
   ends in the key, after a #, which a browser never sends to a server: so
   whoever has the link can read the night, and the server can't.

   The copy is sent again when the journal changes, when a check-in is
   answered, and every two minutes while the site is open, so the watcher
   also sees how long it has been since this device last spoke. Nothing is
   sent from a closed page: a phone that has gone quiet looks exactly like
   that to the watcher, which is the point of telling them the time. */

const KEY = 'journal.watch.v1';
const HOUR = 3600_000;
const BEAT = 2 * 60_000;

/** What this device keeps of the night it is sharing. */
export interface Share {
    id: string;
    /** Lets this device, and only it, replace or end the copy. */
    token: string;
    /** The key, as it goes in the link. */
    key: string;
    expires: number;
    /** Minutes between check-ins; 0 for none. */
    every: number;
    /** When a check-in was last answered (or the share was made). */
    checked: number;
    /** What the sharer is called, for the watcher. */
    name?: string;
    /** When the copy last reached the server. */
    sent?: number;
}

/** What the watcher reads. */
export interface Watched {
    v: 1;
    name?: string;
    /** When the sharing device wrote this. */
    sent: number;
    every: number;
    checked: number;
    expires: number;
    doses: Pick<Ingestion, 'id' | 'substance' | 'name' | 'route' | 'dose' | 'unit' | 'estimate' | 'time'>[];
    medicines: { id: string; name: string }[];
    weightKg?: number;
}

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const aad = (id: string) => enc.encode(`oyama-journal/v1/watch/${id}`);
const aesKey = (key: string) => subtle().importKey('raw', unb64url(key) as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function sealWatch(w: Watched, id: string, key: string): Promise<string> {
    const iv = random(12);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(id) }, await aesKey(key), (await pack(JSON.stringify(w))) as BufferSource);
    return `w1.${b64url(iv)}.${b64url(new Uint8Array(ct))}`;
}

/** The night inside a sealed copy; throws when the key isn't its key. */
export async function openWatch(sealed: string, id: string, key: string): Promise<Watched> {
    const [v, iv, ct] = sealed.split('.');
    if (v !== 'w1' || !iv || !ct) throw new Error('Not a shared night');
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64url(iv) as BufferSource, additionalData: aad(id) }, await aesKey(key), unb64url(ct) as BufferSource);
    const w = JSON.parse(await unpack(new Uint8Array(plain))) as Watched;
    if (!w || w.v !== 1 || !Array.isArray(w.doses)) throw new Error('Not a shared night');
    return w;
}

/* ── the share kept on this device ──────────────────────────────────── */

function read(): Share | null {
    try {
        const s = JSON.parse(kv.get(KEY) ?? 'null') as Share | null;
        return s && typeof s.id === 'string' && typeof s.token === 'string' && typeof s.key === 'string' && s.expires > Date.now() ? s : null;
    } catch {
        return null;
    }
}

let share = read();
const subs = new Set<() => void>();
function set(next: Share | null) {
    share = next;
    kv.set(KEY, next ? JSON.stringify(next) : null);
    subs.forEach(f => f());
}
kv.on(KEY, () => {
    share = read();
    subs.forEach(f => f());
});

export function useShare(): Share | null {
    return useSyncExternalStore(
        f => {
            subs.add(f);
            return () => {
                subs.delete(f);
            };
        },
        () => share,
    );
}

/** The link to hand out. Its key is after the #. */
export const shareLink = (s: Share) => `${window.location.origin}/watch/${s.id}#${s.key}`;

/** When the next check-in is due, or null when none is asked for. */
export const dueAt = (s: Pick<Share, 'every' | 'checked'>) => (s.every > 0 ? s.checked + s.every * 60_000 : null);

/** What is shared: the night a dose taken now would belong to, and
 *  anything else from the last 24 hours. */
function snapshot(s: Share): Watched {
    const now = Date.now();
    const all = getJournal().ingestions;
    const night = new Map<string, Ingestion>();
    for (const i of nightOf(all, now)) night.set(i.id, i);
    for (const i of all) if (now - i.time < 24 * HOUR && i.time <= now + HOUR) night.set(i.id, i);
    const weight = getWeight();
    return {
        v: 1,
        ...(s.name ? { name: s.name } : {}),
        sent: now,
        every: s.every,
        checked: s.checked,
        expires: s.expires,
        doses: [...night.values()]
            .sort((a, b) => a.time - b.time)
            .map(({ id, substance, name, route, dose, unit, estimate, time }) => ({ id, substance, name, route, dose, unit, estimate, time })),
        medicines: medicinesOf(getPerson()),
        ...(weight?.kg ? { weightKg: weight.kg } : {}),
    };
}

export class WatchError extends Error {
    constructor(
        public code: 'OFFLINE' | 'GONE' | 'UNAVAILABLE' | 'KEY',
        message = code,
    ) {
        super(message);
    }
}

async function call(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<Record<string, unknown>> {
    let res: Response;
    try {
        res = await fetch(path, {
            method: init.method ?? 'GET',
            headers: { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
            cache: 'no-store',
        });
    } catch {
        throw new WatchError('OFFLINE');
    }
    if (res.status === 204) return {};
    if (res.status === 404) throw new WatchError('GONE');
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) throw new WatchError('UNAVAILABLE');
    return (await res.json()) as Record<string, unknown>;
}

/** Starts sharing tonight, for `hours`, asking for a check-in every `every` minutes (0: never). */
export async function startShare(opts: { hours: number; every: number; name?: string }): Promise<Share> {
    const now = Date.now();
    const s: Share = {
        id: b64url(random(16)),
        token: b64url(random(32)),
        key: b64url(random(32)),
        expires: now + opts.hours * HOUR,
        every: opts.every,
        checked: now,
        ...(opts.name?.trim() ? { name: opts.name.trim().slice(0, 40) } : {}),
    };
    const made = await call('/api/watch', { method: 'POST', body: { id: s.id, token: s.token, hours: opts.hours, data: await sealWatch(snapshot(s), s.id, s.key) } });
    const next = { ...s, expires: typeof made.expires === 'number' ? made.expires : s.expires, sent: now };
    set(next);
    return next;
}

let pushing: Promise<void> | null = null;
let again = false;

/** Sends the copy again, as it is now. */
export function pushShare(): Promise<void> {
    if (pushing) {
        again = true;
        return pushing;
    }
    pushing = (async () => {
        try {
            do {
                again = false;
                const s = read();
                if (!s) {
                    if (share) set(null);
                    return;
                }
                try {
                    await call(`/api/watch/${s.id}`, { method: 'PUT', token: s.token, body: { data: await sealWatch(snapshot(s), s.id, s.key) } });
                    if (share?.id === s.id) set({ ...share, sent: Date.now() });
                } catch (e) {
                    // Ended on the server (it ran out): nothing left to share.
                    if (e instanceof WatchError && e.code === 'GONE') set(null);
                    return;
                }
            } while (again);
        } finally {
            pushing = null;
        }
    })();
    return pushing;
}

/** "I'm okay": the next check-in is counted from now. */
export function checkIn() {
    if (!share) return;
    set({ ...share, checked: Date.now() });
    void pushShare();
}

export async function stopShare(): Promise<void> {
    const s = share;
    if (!s) return;
    set(null);
    try {
        await call(`/api/watch/${s.id}`, { method: 'DELETE', token: s.token });
    } catch {
        /* it runs out on its own within the day */
    }
}

/** A shared night, read by the watcher. */
export async function fetchWatch(id: string, key: string): Promise<{ night: Watched; updated: number }> {
    const got = await call(`/api/watch/${encodeURIComponent(id)}`);
    try {
        return { night: await openWatch(String(got.data), id, key), updated: Number(got.updated) };
    } catch {
        throw new WatchError('KEY');
    }
}

let started = false;

/** Keeps a night that's being shared up to date, for as long as the page is open. */
export function startWatchSharing() {
    if (started) return;
    started = true;
    const changed = () => share && void pushShare();
    onLocalChange(changed);
    onPersonChange(changed);
    window.setInterval(() => {
        if (share && document.visibilityState === 'visible') void pushShare();
    }, BEAT);
    document.addEventListener('visibilitychange', () => {
        if (share && document.visibilityState === 'visible') void pushShare();
    });
    window.addEventListener('online', changed);
    if (share) void pushShare();
}
