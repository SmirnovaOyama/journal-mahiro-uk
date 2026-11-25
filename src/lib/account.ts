import { useSyncExternalStore } from 'react';
import { applyMerged, cleanJournal, emptyJournal, getJournal, onLocalChange, syncMerge, type JournalData } from './journal';
import { applySavedLog, getSavedLog, mergeSaved, onSavedChange, type SavedLog } from './store';
import {
    forgetKeys,
    keepKey,
    keptKey,
    newJournalKey,
    newRecoveryCode,
    passwordKeys,
    recoveryKeys,
    seal,
    unseal,
    unwrap,
    wrap,
    type Wrapped,
} from './keys';

/* An account, which is optional: a username and a password, and with them
   the journal and the saved list kept the same on every device signed in.

   The account holds one copy, encrypted here first (lib/keys.ts), with a
   version number. To sync, a device fetches the copy if it has changed since
   it last looked, merges it with its own (syncMerge, mergeSaved), and if that
   adds anything, writes it back as made from that version. Another device
   writing first turns the write away, and it goes round again. Syncing
   happens on its own: a moment after a change, when the page comes back
   into view, and every two minutes while it's open. */

export interface User {
    id: string;
    username: string;
    /** When the account was made, ms. */
    created: number;
    /** The site's admin. */
    admin?: boolean;
}

interface Stored {
    token: string;
    user: User;
    /** The version of the account's copy this device last merged. */
    base: number;
    /** Changes made here that the account hasn't got yet. */
    dirty: boolean;
    /** When it last synced, ms. */
    synced: number | null;
}

export type SyncStatus =
    /** Not signed in. */
    | 'off'
    /** Signed in, but this device has lost the journal key: the password brings it back. */
    | 'locked'
    | 'waiting'
    | 'syncing'
    | 'synced'
    | 'offline'
    | 'error';

export interface AccountState {
    account: Stored | null;
    status: SyncStatus;
    /** Why, when it's 'error' or 'offline'; or, signed out by the server, a note saying so. */
    error: string | null;
}

const KEY = 'journal.account.v1';
/** Why this device was signed out, until it's read: kept, so it's still
 *  there when the page is next opened. */
const NOTE = 'journal.account.note.v1';

function readNote(): string | null {
    try {
        return localStorage.getItem(NOTE);
    } catch {
        return null;
    }
}

function writeNote(note: string | null) {
    try {
        if (note) localStorage.setItem(NOTE, note);
        else localStorage.removeItem(NOTE);
    } catch {
        /* shown for this visit only */
    }
}

function readStored(): Stored | null {
    try {
        const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
        return s && typeof s.token === 'string' && s.user && typeof s.user.id === 'string' ? s : null;
    } catch {
        return null;
    }
}

function writeStored(s: Stored | null) {
    try {
        if (s) localStorage.setItem(KEY, JSON.stringify(s));
        else localStorage.removeItem(KEY);
    } catch {
        /* kept in memory for this visit */
    }
}

const first = readStored();
let state: AccountState = { account: first, status: first ? 'waiting' : 'off', error: first ? null : readNote() };
const subs = new Set<() => void>();

function set(patch: Partial<AccountState>) {
    state = { ...state, ...patch };
    subs.forEach(f => f());
}

/** Moves the stored account on, from what's stored now: another tab may
 *  have moved it on first. */
function update(patch: Partial<Stored>) {
    const cur = readStored() ?? state.account;
    if (!cur) return;
    const next = { ...cur, ...patch };
    writeStored(next);
    set({ account: next });
}

const subscribe = (f: () => void) => {
    subs.add(f);
    return () => {
        subs.delete(f);
    };
};

export function useAccount(): AccountState {
    return useSyncExternalStore(subscribe, () => state);
}

export const accountState = () => state;

/* ── the server ─────────────────────────────────────────────────────── */

export class ApiError extends Error {
    constructor(
        public code: string,
        message: string,
        public status = 0,
        public body: Record<string, unknown> = {},
    ) {
        super(message);
    }
}

async function api<T>(path: string, init: { method?: string; body?: unknown; signedIn?: boolean } = {}): Promise<T> {
    const signedIn = init.signedIn !== false;
    const token = state.account?.token;
    const headers: Record<string, string> = {};
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (signedIn && token) headers.authorization = `Bearer ${token}`;
    let res: Response;
    try {
        res = await fetch(path, {
            method: init.method ?? 'GET',
            headers,
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
            cache: 'no-store',
        });
    } catch {
        throw new ApiError('OFFLINE', navigator.onLine === false ? 'You’re offline.' : 'Couldn’t reach the server.');
    }
    if (res.status === 204) return undefined as T;
    if (!(res.headers.get('content-type') ?? '').includes('application/json'))
        throw new ApiError('UNAVAILABLE', 'Accounts aren’t available here.', res.status);
    let body: Record<string, unknown> = {};
    try {
        body = await res.json();
    } catch {
        /* an empty answer */
    }
    if (!res.ok) {
        const err = new ApiError(String(body.error ?? `HTTP_${res.status}`), String(body.message ?? 'Something went wrong. Try again.'), res.status, body);
        if (err.code === 'SIGNED_OUT' && signedIn && token && token === state.account?.token) void lostSession();
        throw err;
    }
    return body as T;
}

/** The server no longer knows this device (signed out elsewhere, or by a
 *  new password). The journal stays; it just stops syncing. */
async function lostSession() {
    const note = 'This device was signed out of your account. Your journal is still here: sign in again to keep it in sync.';
    await forgetKeys();
    writeStored(null);
    writeNote(note);
    set({ account: null, status: 'off', error: note });
}

function need(): Stored {
    const a = state.account;
    if (!a) throw new ApiError('SIGNED_OUT', 'Sign in first.');
    return a;
}

const wrongPassword = (current = false) => new ApiError('WRONG_PASSWORD', current ? 'That isn’t the current password.' : 'That isn’t the password.', 403);

/* ── signing up, in and out ─────────────────────────────────────────── */

async function begin(token: string, user: User, key: CryptoKey) {
    await forgetKeys();
    await keepKey(user.id, key);
    const s: Stored = { token, user, base: 0, dirty: true, synced: null };
    writeStored(s);
    writeNote(null);
    set({ account: s, status: 'waiting', error: null });
    void syncNow();
}

/** Makes an account and signs in to it. Returns its recovery key, which
 *  is shown once and kept nowhere. */
export async function signUp(username: string, password: string): Promise<string> {
    const pk = await passwordKeys(username, password);
    const journalKey = await newJournalKey();
    const code = newRecoveryCode();
    const rk = (await recoveryKeys(code))!;
    const [key, recoveryKey] = await Promise.all([wrap(journalKey, pk.kek), wrap(journalKey, rk.kek)]);
    const res = await api<{ token: string; user: User }>('/api/signup', {
        method: 'POST',
        signedIn: false,
        body: { username: username.trim(), auth: pk.auth, key, recovery: { auth: rk.auth, key: recoveryKey } },
    });
    await begin(res.token, res.user, await unwrap(key, pk.kek));
    return code;
}

export async function signIn(username: string, password: string): Promise<void> {
    const pk = await passwordKeys(username, password);
    const res = await api<{ token: string; user: User; key: Wrapped }>('/api/login', {
        method: 'POST',
        signedIn: false,
        body: { username: username.trim(), auth: pk.auth },
    });
    let key: CryptoKey;
    try {
        key = await unwrap(res.key, pk.kek);
    } catch {
        throw new ApiError('KEY', 'Signed in, but the journal key wouldn’t open. Try again.');
    }
    await begin(res.token, res.user, key);
}

/** Brings back a journal key this device lost (its storage was cleared). */
export async function unlock(password: string): Promise<void> {
    const a = need();
    const [pk, info] = await Promise.all([passwordKeys(a.user.username, password), api<{ key: Wrapped }>('/api/account')]);
    let key: CryptoKey;
    try {
        key = await unwrap(info.key, pk.kek);
    } catch {
        throw wrongPassword();
    }
    await keepKey(a.user.id, key);
    set({ status: 'waiting', error: null });
    void syncNow();
}

/** Signs this device out. The account keeps its copy either way; `keepHere`
 *  says whether this browser keeps its own. */
export async function signOut(keepHere: boolean): Promise<void> {
    try {
        await api('/api/logout', { method: 'POST' });
    } catch {
        /* signed out here whatever the server says */
    }
    await forgetKeys();
    writeStored(null);
    set({ account: null, status: 'off', error: null });
    if (!keepHere) {
        applyMerged(emptyJournal());
        applySavedLog({});
    }
}

/** The journal key, readable for a moment, from the password: for wrapping it again. */
async function journalKeyFrom(password: string, current = false) {
    const a = need();
    const [pk, info] = await Promise.all([passwordKeys(a.user.username, password), api<{ key: Wrapped }>('/api/account')]);
    try {
        return { pk, key: await unwrap(info.key, pk.kek, true) };
    } catch {
        throw wrongPassword(current);
    }
}

/** A new password. Every other device is signed out; this one stays in. */
export async function changePassword(current: string, next: string): Promise<void> {
    const a = need();
    const [{ pk, key }, nk] = await Promise.all([journalKeyFrom(current, true), passwordKeys(a.user.username, next)]);
    await api('/api/password', { method: 'POST', body: { auth: pk.auth, newAuth: nk.auth, key: await wrap(key, nk.kek) } });
}

/** A new recovery key in place of the old one, which stops working. */
export async function newRecoveryKey(password: string): Promise<string> {
    const { pk, key } = await journalKeyFrom(password);
    const code = newRecoveryCode();
    const rk = (await recoveryKeys(code))!;
    await api('/api/recovery', { method: 'POST', body: { auth: pk.auth, recovery: { auth: rk.auth, key: await wrap(key, rk.kek) } } });
    return code;
}

/** A forgotten password: the recovery key sets a new one and signs in.
 *  Returns a new recovery key; the one used stops working. */
export async function recover(username: string, code: string, password: string): Promise<string> {
    const rk = await recoveryKeys(code);
    if (!rk) throw new ApiError('BAD_CODE', 'A recovery key is 32 letters and digits.');
    const start = await api<{ key: Wrapped }>('/api/recover/start', {
        method: 'POST',
        signedIn: false,
        body: { username: username.trim(), recoveryAuth: rk.auth },
    });
    let journalKey: CryptoKey;
    try {
        journalKey = await unwrap(start.key, rk.kek, true);
    } catch {
        throw new ApiError('INVALID_RECOVERY', 'That username and recovery key don’t go together.');
    }
    const pk = await passwordKeys(username, password);
    const next = newRecoveryCode();
    const nk = (await recoveryKeys(next))!;
    const [key, recoveryKey] = await Promise.all([wrap(journalKey, pk.kek), wrap(journalKey, nk.kek)]);
    const res = await api<{ token: string; user: User }>('/api/recover/finish', {
        method: 'POST',
        signedIn: false,
        body: { username: username.trim(), recoveryAuth: rk.auth, auth: pk.auth, key, recovery: { auth: nk.auth, key: recoveryKey } },
    });
    await begin(res.token, res.user, await unwrap(key, pk.kek));
    return next;
}

/** Deletes the account and its copy. The journal on this device stays. */
export async function deleteAccount(password: string): Promise<void> {
    const a = need();
    const pk = await passwordKeys(a.user.username, password);
    await api('/api/account', { method: 'DELETE', body: { auth: pk.auth } });
    await forgetKeys();
    writeStored(null);
    set({ account: null, status: 'off', error: null });
}

export interface DeviceSession {
    id: string;
    device: string;
    created: number;
    used: number;
    current: boolean;
}

export interface AccountInfo {
    user: User;
    sessions: DeviceSession[];
    vault: { version: number; size: number; updated: number } | null;
}

export const fetchAccount = () => api<AccountInfo>('/api/account');
export const signOutDevice = (id: string) => api<void>(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const signOutOtherDevices = () => api<void>('/api/sessions', { method: 'DELETE' });

/** The account as the server has it now (an admin's flag, say), kept. */
export function refreshUser(user: User) {
    const a = state.account;
    if (!a || a.user.id !== user.id) return;
    if (a.user.username !== user.username || !!a.user.admin !== !!user.admin) update({ user });
}

/* ── the admin's ────────────────────────────────────────────────────── */

export interface AdminStats {
    accounts: number;
    newWeek: number;
    activeWeek: number;
    devices: number;
    copies: number;
    bytes: number;
    locked: number;
    deletedSelf: number;
    deletedAdmin: number;
    /** Sign-ups a day ("2026-11-25", UTC), for the last 30 days. */
    signups: { day: string; n: number }[];
    now: number;
}

export interface AdminUser {
    id: string;
    username: string;
    created: number;
    seen: number | null;
    devices: number;
    copy: { version: number; size: number; updated: number } | null;
    /** Seconds left on a lock from wrong passwords. */
    locked: number;
    misses: number;
    admin: boolean;
}

export const adminStats = () => api<AdminStats>('/api/admin/stats');
export const adminUsers = (q = '') => api<{ users: AdminUser[] }>(`/api/admin/users${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`).then(r => r.users);
export const adminSignOut = (id: string) => api<void>(`/api/admin/users/${id}/sign-out`, { method: 'POST' });
export const adminUnlock = (id: string) => api<void>(`/api/admin/users/${id}/unlock`, { method: 'POST' });

/** Deletes another account, with the admin's own password again. */
export async function adminDelete(id: string, password: string): Promise<void> {
    const a = need();
    const pk = await passwordKeys(a.user.username, password);
    await api<void>(`/api/admin/users/${id}`, { method: 'DELETE', body: { auth: pk.auth } });
}

/** Clears a note left by being signed out. */
export function dismissNote() {
    writeNote(null);
    if (!state.account) set({ error: null });
}

/* ── syncing ────────────────────────────────────────────────────────── */

interface Vault {
    v: 1;
    journal: JournalData;
    saved: SavedLog;
}

function readVault(text: string): Vault {
    const raw = JSON.parse(text) as Partial<Vault>;
    const saved = raw.saved && typeof raw.saved === 'object' && !Array.isArray(raw.saved) ? raw.saved : {};
    return { v: 1, journal: cleanJournal(raw.journal), saved };
}

/** JSON with every object's keys in order, to tell whether two copies are alike. */
function canonical(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return `{${Object.keys(o)
            .filter(k => o[k] !== undefined)
            .sort()
            .map(k => `${JSON.stringify(k)}:${canonical(o[k])}`)
            .join(',')}}`;
    }
    return JSON.stringify(v) ?? 'null';
}

/** The largest copy the account takes (as stored, encrypted). */
const MAX_SEALED = 1_500_000;

let running: Promise<void> | null = null;
let again = false;
/** Changes made on this device since the page opened. */
let changes = 0;
let timer = 0;
let failures = 0;

/** Syncs now, or once more after the sync already running. */
export function syncNow(): Promise<void> {
    if (running) {
        again = true;
        return running;
    }
    running = (async () => {
        try {
            do {
                again = false;
                await oneAtATime(syncOnce);
            } while (again);
        } finally {
            running = null;
        }
    })();
    return running;
}

/** One sync at a time across this browser's tabs, where it can tell. */
async function oneAtATime(f: () => Promise<void>) {
    const locks = navigator.locks;
    if (locks?.request) await locks.request('oyama-journal-sync', f);
    else await f();
}

function schedule(ms: number) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void syncNow(), ms);
}

/** Puts the merged copy in here, merged again with anything changed while
 *  it was on its way. */
function apply(m: Vault, j0: JournalData, s0: SavedLog) {
    const j = getJournal();
    const s = getSavedLog();
    const journal = j === j0 ? m.journal : syncMerge(j, m.journal);
    const saved = s === s0 ? m.saved : mergeSaved(s, m.saved);
    if (canonical(journal) !== canonical(j)) applyMerged(journal);
    if (canonical(saved) !== canonical(s)) applySavedLog(saved);
}

async function syncOnce() {
    const a = readStored();
    if (!a) {
        if (state.account) set({ account: null, status: 'off' });
        return;
    }
    if (a.token !== state.account?.token) set({ account: a });
    const key = await keptKey(a.user.id);
    if (!key) {
        set({ status: 'locked', error: null });
        return;
    }
    set({ status: 'syncing', error: null });
    const gen = changes;
    const finish = (version: number) => {
        const clean = changes === gen;
        update({ base: version, synced: Date.now(), ...(clean ? { dirty: false } : {}) });
        failures = 0;
        set({ status: 'synced', error: null });
        if (!clean) schedule(800);
    };

    try {
        for (let tries = 0; tries < 4; tries++) {
            const cur = readStored();
            if (!cur || cur.token !== a.token) return;
            const got = await api<{ version: number; data?: string; same?: boolean }>(`/api/vault?have=${cur.base}`);
            const j0 = getJournal();
            const s0 = getSavedLog();
            let merged: Vault;
            let theirs: string | null = null;
            if (got.data) {
                let remote: Vault;
                try {
                    remote = readVault(await unseal(got.data, key, a.user.id));
                } catch {
                    throw new ApiError('UNREADABLE', 'The copy in your account couldn’t be opened on this device.');
                }
                merged = { v: 1, journal: syncMerge(j0, remote.journal), saved: mergeSaved(s0, remote.saved) };
                theirs = canonical(remote);
            } else {
                // Nothing there yet, or nothing new since this device last
                // merged it: this device's copy is the whole of it.
                if (got.same && !cur.dirty && changes === gen) return finish(got.version);
                merged = { v: 1, journal: syncMerge(j0, emptyJournal()), saved: s0 };
            }
            apply(merged, j0, s0);
            if (theirs !== null && canonical(merged) === theirs) return finish(got.version);

            const sealed = await seal(JSON.stringify(merged), key, a.user.id);
            if (sealed.length > MAX_SEALED) throw new ApiError('TOO_LARGE', 'The journal is too large to keep in an account.');
            try {
                const put = await api<{ version: number }>('/api/vault', { method: 'PUT', body: { base: got.version, data: sealed } });
                return finish(put.version);
            } catch (e) {
                // Another device wrote first: fetch theirs and merge again.
                if (e instanceof ApiError && e.code === 'CONFLICT') continue;
                throw e;
            }
        }
        throw new ApiError('BUSY', 'Another device kept syncing at the same time. Trying again soon.');
    } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError('ERROR', 'Sync failed.');
        if (err.code === 'SIGNED_OUT') return;
        failures++;
        set({ status: err.code === 'OFFLINE' ? 'offline' : 'error', error: err.message });
        schedule(Math.min(300_000, 15_000 * 2 ** (failures - 1)));
    }
}

let started = false;
let lastWake = 0;

/** Starts syncing on its own, for as long as the page is open. */
export function startSync() {
    if (started) return;
    started = true;
    const changed = () => {
        changes++;
        if (!readStored()) return;
        update({ dirty: true });
        schedule(1500);
    };
    onLocalChange(changed);
    onSavedChange(changed);
    const wake = () => {
        if (document.visibilityState !== 'visible' || !state.account || Date.now() - lastWake < 10_000) return;
        lastWake = Date.now();
        void syncNow();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', () => state.account && void syncNow());
    window.setInterval(() => {
        if (document.visibilityState === 'visible' && state.account) void syncNow();
    }, 2 * 60_000);
    // Another tab signed in or out, or synced.
    window.addEventListener('storage', e => {
        if (e.key !== KEY) return;
        const s = readStored();
        if (!s) set({ account: null, status: 'off' });
        else if (s.token !== state.account?.token) {
            set({ account: s, status: 'waiting', error: null });
            void syncNow();
        } else set({ account: s, ...(state.status === 'waiting' && s.synced ? { status: 'synced' } : {}) });
    });
    if (state.account) {
        lastWake = Date.now();
        void syncNow();
    }
}
