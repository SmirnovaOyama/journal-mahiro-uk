import { useCallback, useSyncExternalStore } from 'react';
import { go } from './router';

/* The journal: what was taken, how much, how and when. Kept in this
   browser (localStorage). With an account it's also kept there, encrypted
   here before it's sent (lib/account.ts), and the copies on each device are
   merged: every dose and every session's notes carry when they last
   changed, and a deleted dose leaves its id behind in `gone`, so a merge
   keeps the newest of each and never brings a deleted one back.

   Ingestions are the record. Sessions are read from them: doses taken
   within SESSION_GAP of the one before are one session (an evening, a
   night), which is what the timeline, the interactions and the redose
   warnings are worked out over. */

export interface Ingestion {
    id: string;
    /** The catalogue id ("mdma"), or for something not in it, its name as typed. */
    substance: string;
    /** The name shown, as it was when logged. */
    name: string;
    route: string;
    /** null: the amount isn't known. */
    dose: number | null;
    unit: string;
    /** The amount is a guess. */
    estimate: boolean;
    /** When it was taken, ms since 1970. */
    time: number;
    note?: string;
    /** When it was logged or last changed, ms; for merging copies. */
    at?: number;
}

/** What's said of a session as a whole, keyed by the session's id (its first dose's). */
export interface SessionMeta {
    title?: string;
    note?: string;
    favorite?: boolean;
    /** On Shulgin's scale: '-', '±', '+', '++', '+++', '++++'. */
    rating?: string;
    /** When it last changed, ms. Kept when everything else is cleared, so
     *  the clearing reaches the other devices too. */
    at?: number;
}

/** One weighing. Always kept in kilograms; shown in what Settings picks. */
export interface WeightEntry {
    id: string;
    kg: number;
    /** When it was weighed, ms since 1970. */
    time: number;
    note?: string;
    /** When it was logged or last changed, ms; for merging copies. */
    at?: number;
}

export interface JournalData {
    v: 1;
    ingestions: Ingestion[];
    /** Body weight, oldest first. Deleted ones go in `gone` like doses. */
    weights?: WeightEntry[];
    /** Each substance's colour, kept so it never changes once given. */
    colors: Record<string, string>;
    meta?: Record<string, SessionMeta>;
    /** Deleted doses: id to when, ms. */
    gone?: Record<string, number>;
}

export const RATINGS = ['-', '±', '+', '++', '+++', '++++'] as const;

const KEY = 'journal.log.v1';
export const SESSION_GAP = 12 * 3600_000;

/** Colours for substances, in the order they're handed out: the site's clay
 *  and the hues around it, each readable on white and on the dark page. */
export const PALETTE = [
    'oklch(62% 0.13 40)', // terracotta
    'oklch(60% 0.12 250)', // sky
    'oklch(62% 0.12 150)', // sage
    'oklch(70% 0.13 80)', // sand
    'oklch(58% 0.14 330)', // plum
    'oklch(62% 0.11 195)', // teal
    'oklch(58% 0.15 20)', // rose
    'oklch(64% 0.12 110)', // olive
    'oklch(55% 0.13 285)', // indigo
    'oklch(66% 0.12 60)', // amber
];

function empty(): JournalData {
    return { v: 1, ingestions: [], colors: {} };
}

/** An empty journal, with nothing deleted. */
export const emptyJournal = (): JournalData => ({ v: 1, ingestions: [], colors: {}, meta: {}, gone: {} });

/** A journal read from storage or from the account, with anything that
 *  isn't a dose dropped. */
export function cleanJournal(raw: unknown): JournalData {
    const d = raw as JournalData;
    if (!d || typeof d !== 'object' || !Array.isArray(d.ingestions)) return emptyJournal();
    const obj = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
    return {
        v: 1,
        ingestions: d.ingestions.filter(valid),
        weights: Array.isArray(d.weights) ? d.weights.filter(validWeight) : [],
        colors: obj(d.colors) as Record<string, string>,
        meta: obj(d.meta) as Record<string, SessionMeta>,
        gone: obj(d.gone) as Record<string, number>,
    };
}

function read(): JournalData {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? cleanJournal(JSON.parse(raw)) : empty();
    } catch {
        return empty();
    }
}

function validWeight(w: unknown): w is WeightEntry {
    const x = w as WeightEntry;
    return (
        !!x &&
        typeof x.id === 'string' &&
        typeof x.kg === 'number' &&
        Number.isFinite(x.kg) &&
        x.kg > 0 &&
        x.kg < 1000 &&
        typeof x.time === 'number' &&
        Number.isFinite(x.time)
    );
}

function valid(i: unknown): i is Ingestion {
    const x = i as Ingestion;
    return !!x && typeof x.id === 'string' && typeof x.substance === 'string' && typeof x.time === 'number' && Number.isFinite(x.time);
}

let data = read();
const subs = new Set<() => void>();
/** Told of changes made here, not of ones merged in from the account. */
const localSubs = new Set<() => void>();

function commit(next: JournalData, merged = false) {
    data = next;
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* storage full or off: the change still holds until the page closes */
    }
    subs.forEach(f => f());
    if (!merged) localSubs.forEach(f => f());
}

/** The journal as it is now. */
export const getJournal = () => data;

/** Puts in the journal merged with the account's copy. */
export const applyMerged = (next: JournalData) => commit(next, true);

/** Calls `f` after each change made on this device. */
export function onLocalChange(f: () => void): () => void {
    localSubs.add(f);
    return () => {
        localSubs.delete(f);
    };
}

// Another tab changed it: take theirs.
window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    data = read();
    subs.forEach(f => f());
});

const subscribe = (f: () => void) => {
    subs.add(f);
    return () => {
        subs.delete(f);
    };
};

export const newId = () =>
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`).slice(0, 36);

function withColor(d: JournalData, substance: string): Record<string, string> {
    if (d.colors[substance]) return d.colors;
    const used = new Set(Object.values(d.colors));
    const color = PALETTE.find(c => !used.has(c)) ?? PALETTE[Object.keys(d.colors).length % PALETTE.length];
    return { ...d.colors, [substance]: color };
}

export function useJournal() {
    const snapshot = useSyncExternalStore(subscribe, () => data);
    const add = useCallback((i: Omit<Ingestion, 'id'> & { id?: string }) => {
        const entry: Ingestion = { ...i, id: i.id ?? newId(), at: Date.now() };
        commit({ ...data, ingestions: [...data.ingestions, entry], colors: withColor(data, entry.substance) });
        return entry;
    }, []);
    const update = useCallback((i: Ingestion) => {
        commit({
            ...data,
            ingestions: data.ingestions.map(x => (x.id === i.id ? { ...i, at: Date.now() } : x)),
            colors: withColor(data, i.substance),
        });
    }, []);
    const remove = useCallback((id: string) => {
        commit({ ...data, ingestions: data.ingestions.filter(x => x.id !== id), gone: { ...(data.gone ?? {}), [id]: Date.now() } });
    }, []);
    const setColor = useCallback((substance: string, color: string) => {
        commit({ ...data, colors: { ...data.colors, [substance]: color } });
    }, []);
    const setMeta = useCallback((session: string, patch: SessionMeta) => {
        const prev = data.meta?.[session] ?? {};
        const next: SessionMeta = { ...prev, ...patch };
        for (const k of Object.keys(next) as (keyof SessionMeta)[]) if (!next[k]) delete next[k];
        next.at = Date.now();
        commit({ ...data, meta: { ...(data.meta ?? {}), [session]: next } });
    }, []);
    // Everything goes, and says so, so it goes from the account's copy too.
    // Weights stay: they're cleared on their own (clearWeights).
    const clear = useCallback(() => {
        const t = Date.now();
        const gone = { ...(data.gone ?? {}) };
        for (const i of data.ingestions) gone[i.id] = t;
        const meta: Record<string, SessionMeta> = {};
        for (const k of Object.keys(data.meta ?? {})) meta[k] = { at: t };
        commit({ ...empty(), weights: data.weights, meta, gone });
    }, []);
    const replace = useCallback((next: JournalData) => commit(next), []);
    return { data: snapshot, add, update, remove, setColor, setMeta, clear, replace };
}

const byTime = <T extends { time: number; id: string }>(a: T, b: T) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Body weight: logged, changed and deleted like doses, in the same record,
 *  so it syncs, exports and imports with the rest of the journal. */
export function useWeights() {
    const snapshot = useSyncExternalStore(subscribe, () => data);
    const add = useCallback((w: Omit<WeightEntry, 'id' | 'at'>) => {
        const entry: WeightEntry = { ...w, id: newId(), at: Date.now() };
        commit({ ...data, weights: [...(data.weights ?? []), entry].sort(byTime) });
        return entry;
    }, []);
    const update = useCallback((w: WeightEntry) => {
        commit({ ...data, weights: (data.weights ?? []).map(x => (x.id === w.id ? { ...w, at: Date.now() } : x)).sort(byTime) });
    }, []);
    const remove = useCallback((id: string) => {
        commit({ ...data, weights: (data.weights ?? []).filter(x => x.id !== id), gone: { ...(data.gone ?? {}), [id]: Date.now() } });
    }, []);
    const clear = useCallback(() => {
        const t = Date.now();
        const gone = { ...(data.gone ?? {}) };
        for (const w of data.weights ?? []) gone[w.id] = t;
        commit({ ...data, weights: [], gone });
    }, []);
    return { weights: snapshot.weights ?? [], add, update, remove, clear };
}

export const colorOf = (d: JournalData, substance: string) => d.colors[substance] ?? PALETTE[0];

/** This device's journal and the account's, as one. The same two give the
 *  same result on any device, so every copy ends up alike:
 *  - a dose in either is kept, unless either deleted it;
 *  - one in both is the version changed last (the account's on a tie);
 *  - so is each session's name, notes, rating and star;
 *  - the account's colours stay, and a colour this device gave that the
 *    account already uses for something else is handed out afresh. */
export function syncMerge(local: JournalData, remote: JournalData): JournalData {
    const gone: Record<string, number> = { ...(remote.gone ?? {}) };
    for (const [id, t] of Object.entries(local.gone ?? {})) gone[id] = Math.max(gone[id] ?? 0, t);

    const byId = new Map<string, Ingestion>();
    for (const i of remote.ingestions) byId.set(i.id, i);
    for (const i of local.ingestions) {
        const r = byId.get(i.id);
        if (!r || (i.at ?? 0) > (r.at ?? 0)) byId.set(i.id, i);
    }
    const ingestions = [...byId.values()]
        .filter(i => !(i.id in gone))
        .sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const weightById = new Map<string, WeightEntry>();
    for (const w of remote.weights ?? []) weightById.set(w.id, w);
    for (const w of local.weights ?? []) {
        const r = weightById.get(w.id);
        if (!r || (w.at ?? 0) > (r.at ?? 0)) weightById.set(w.id, w);
    }
    const weights = [...weightById.values()].filter(w => !(w.id in gone)).sort(byTime);

    const meta: Record<string, SessionMeta> = { ...(remote.meta ?? {}) };
    for (const [k, m] of Object.entries(local.meta ?? {})) {
        const r = meta[k];
        if (!r || (m.at ?? 0) > (r.at ?? 0)) meta[k] = m;
    }

    let next: JournalData = { v: 1, ingestions, weights, colors: { ...remote.colors }, meta, gone };
    const taken = new Set(Object.values(next.colors));
    for (const [sub, color] of Object.entries(local.colors)) {
        if (next.colors[sub]) continue;
        if (!taken.has(color)) {
            next = { ...next, colors: { ...next.colors, [sub]: color } };
            taken.add(color);
        } else {
            next = { ...next, colors: withColor(next, sub) };
            taken.add(next.colors[sub]);
        }
    }
    for (const i of ingestions) if (!next.colors[i.substance]) next = { ...next, colors: withColor(next, i.substance) };
    return next;
}

/* ── sessions ───────────────────────────────────────────────────────── */

export interface Session {
    id: string;
    start: number;
    end: number;
    ingestions: Ingestion[];
}

/** Newest first; each session's doses in the order they were taken. */
export function sessionsOf(list: Ingestion[]): Session[] {
    const sorted = [...list].sort((a, b) => a.time - b.time);
    const out: Session[] = [];
    for (const i of sorted) {
        const cur = out[out.length - 1];
        if (cur && i.time - cur.end <= SESSION_GAP) {
            cur.ingestions.push(i);
            cur.end = i.time;
        } else out.push({ id: i.id, start: i.time, end: i.time, ingestions: [i] });
    }
    return out.reverse();
}

/** The doses of one substance, newest first. */
export function historyOf(list: Ingestion[], substance: string): Ingestion[] {
    return list.filter(i => i.substance === substance).sort((a, b) => b.time - a.time);
}

/* ── moving it in and out ───────────────────────────────────────────── */

export function exportFile(d: JournalData): Blob {
    const body = { app: 'journal.mahiro.uk', exported: new Date().toISOString(), ...d };
    return new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
}

const ROUTE_NAMES: Record<string, string> = {
    ORAL: 'Oral',
    SUBLINGUAL: 'Sublingual',
    BUCCAL: 'Buccal',
    INSUFFLATED: 'Insufflated',
    RECTAL: 'Rectal',
    TRANSDERMAL: 'Transdermal',
    SUBCUTANEOUS: 'Subcutaneous',
    INTRAMUSCULAR: 'Intramuscular',
    INTRAVENOUS: 'Intravenous',
    SMOKED: 'Smoked',
    INHALED: 'Inhaled',
};

/** Reads a file exported from here, or from PsychonautWiki Journal, into
 *  ingestions; `resolve` maps a substance name to a catalogue id. Returns
 *  null for a file that is neither. */
export function parseImport(text: string, resolve: (name: string) => { id: string; name: string } | undefined): JournalData | null {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return null;
    }
    const r = raw as Record<string, unknown>;
    // Ours.
    if (Array.isArray(r.ingestions)) {
        const ingestions = (r.ingestions as unknown[]).filter(valid);
        const weights = Array.isArray(r.weights) ? (r.weights as unknown[]).filter(validWeight) : [];
        return { v: 1, ingestions, weights, colors: (r.colors as Record<string, string>) ?? {}, meta: (r.meta as Record<string, SessionMeta>) ?? {} };
    }
    // PsychonautWiki Journal: experiences, each with its ingestions.
    if (Array.isArray(r.experiences)) {
        const ingestions: Ingestion[] = [];
        const meta: Record<string, SessionMeta> = {};
        const SHULGIN: Record<string, string> = { MINUS: '-', PLUS_MINUS: '±', PLUS: '+', TWO_PLUS: '++', THREE_PLUS: '+++', FOUR_PLUS: '++++' };
        for (const e of r.experiences as Record<string, unknown>[]) {
            const title = typeof e.title === 'string' ? e.title : '';
            const text = typeof e.text === 'string' ? e.text : '';
            const ratings = Array.isArray(e.ratings) ? (e.ratings as Record<string, unknown>[]) : [];
            const rating = ratings.length ? SHULGIN[String(ratings[ratings.length - 1].option ?? '')] : undefined;
            const firstOfThis = ingestions.length;
            (Array.isArray(e.ingestions) ? (e.ingestions as Record<string, unknown>[]) : []).forEach(x => {
                const named = String(x.substanceName ?? '').trim();
                const time = typeof x.time === 'number' ? x.time : Date.parse(String(x.time ?? ''));
                if (!named || !Number.isFinite(time)) return;
                const hit = resolve(named);
                const notes = String(x.notes ?? '').trim();
                ingestions.push({
                    id: newId(),
                    substance: hit?.id ?? named,
                    name: hit?.name ?? named,
                    route: ROUTE_NAMES[String(x.administrationRoute ?? '').toUpperCase()] ?? 'Oral',
                    dose: typeof x.dose === 'number' && Number.isFinite(x.dose) ? x.dose : null,
                    unit: String(x.units ?? 'mg'),
                    estimate: !!x.isDoseAnEstimate,
                    time,
                    ...(notes ? { note: notes } : {}),
                });
            });
            // The experience's own words go on the session its first dose opens.
            const mine = ingestions.slice(firstOfThis).sort((a, b) => a.time - b.time)[0];
            if (mine && (title || text || rating)) meta[mine.id] = { ...(title && { title }), ...(text && { note: text }), ...(rating && { rating }) };
        }
        return { v: 1, ingestions, colors: {}, meta };
    }
    return null;
}

/** Adds imported ingestions and weights to the journal, skipping ones
 *  already in it (same substance, same minute, same amount; a weight on the
 *  same minute with the same kilograms). */
export function merge(into: JournalData, from: JournalData): { next: JournalData; added: number; addedWeights: number } {
    const seen = new Set(into.ingestions.map(i => `${i.substance}|${Math.round(i.time / 60000)}|${i.dose}`));
    const ids = new Set(into.ingestions.map(i => i.id));
    // A dose deleted here and brought back from a file is a new dose, with
    // a new id, or the deletion would win again at the next sync.
    const renamed = new Map<string, string>();
    const t = Date.now();
    let next = { ...into, ingestions: [...into.ingestions], colors: { ...into.colors, ...from.colors } };
    let added = 0;
    for (const i of from.ingestions) {
        const key = `${i.substance}|${Math.round(i.time / 60000)}|${i.dose}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const id = ids.has(i.id) || into.gone?.[i.id] ? newId() : i.id;
        if (id !== i.id) renamed.set(i.id, id);
        ids.add(id);
        next.ingestions.push({ ...i, id, at: t });
        next = { ...next, colors: withColor(next, i.substance) };
        added++;
    }
    const meta: Record<string, SessionMeta> = {};
    for (const [k, m] of Object.entries(from.meta ?? {})) meta[renamed.get(k) ?? k] = { ...m, at: t };

    const wKey = (w: WeightEntry) => `${Math.round(w.time / 60000)}|${Math.round(w.kg * 100)}`;
    const wSeen = new Set((into.weights ?? []).map(wKey));
    const wIds = new Set((into.weights ?? []).map(w => w.id));
    const weights = [...(into.weights ?? [])];
    let addedWeights = 0;
    for (const w of from.weights ?? []) {
        const key = wKey(w);
        if (wSeen.has(key)) continue;
        wSeen.add(key);
        const id = wIds.has(w.id) || into.gone?.[w.id] ? newId() : w.id;
        wIds.add(id);
        weights.push({ ...w, id, at: t });
        addedWeights++;
    }
    weights.sort(byTime);
    return { next: { ...next, weights, meta: { ...meta, ...(into.meta ?? {}) } }, added, addedWeights };
}

/* ── logging from elsewhere ─────────────────────────────────────────── */

/** What the add form starts with when opened from a substance's page. */
export interface Prefill {
    id?: string;
    name?: string;
    route?: string;
    dose?: number;
    unit?: string;
    time?: number;
}

let pending: Prefill | null = null;

/** Opens the journal with the add form filled in. */
export function logFrom(p: Prefill) {
    pending = p;
    go({ page: 'journal' });
}

/** The prefill waiting for the journal. Read in a state initialiser (which
 *  may run twice), cleared after mounting, so it's used once either way. */
export function peekPrefill(): Prefill | null {
    return pending;
}
export function clearPrefill() {
    pending = null;
}
