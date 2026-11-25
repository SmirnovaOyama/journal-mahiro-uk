import { useCallback, useSyncExternalStore } from 'react';
import { go } from './router';

/* The journal: what was taken, how much, how and when. Kept in this browser
   only (localStorage), never sent anywhere; it leaves the device only when
   exported from Settings, as a file the person keeps.

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
}

/** What's said of a session as a whole, keyed by the session's id (its first dose's). */
export interface SessionMeta {
    title?: string;
    note?: string;
    favorite?: boolean;
    /** On Shulgin's scale: '-', '±', '+', '++', '+++', '++++'. */
    rating?: string;
}

export interface JournalData {
    v: 1;
    ingestions: Ingestion[];
    /** Each substance's colour, kept so it never changes once given. */
    colors: Record<string, string>;
    meta?: Record<string, SessionMeta>;
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

function read(): JournalData {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return empty();
        const d = JSON.parse(raw) as JournalData;
        if (!d || !Array.isArray(d.ingestions)) return empty();
        return { v: 1, ingestions: d.ingestions.filter(valid), colors: d.colors ?? {}, meta: d.meta ?? {} };
    } catch {
        return empty();
    }
}

function valid(i: unknown): i is Ingestion {
    const x = i as Ingestion;
    return !!x && typeof x.id === 'string' && typeof x.substance === 'string' && typeof x.time === 'number' && Number.isFinite(x.time);
}

let data = read();
const subs = new Set<() => void>();

function commit(next: JournalData) {
    data = next;
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* storage full or off: the change still holds until the page closes */
    }
    subs.forEach(f => f());
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
        const entry: Ingestion = { ...i, id: i.id ?? newId() };
        commit({ ...data, ingestions: [...data.ingestions, entry], colors: withColor(data, entry.substance) });
        return entry;
    }, []);
    const update = useCallback((i: Ingestion) => {
        commit({
            ...data,
            ingestions: data.ingestions.map(x => (x.id === i.id ? i : x)),
            colors: withColor(data, i.substance),
        });
    }, []);
    const remove = useCallback((id: string) => {
        commit({ ...data, ingestions: data.ingestions.filter(x => x.id !== id) });
    }, []);
    const setColor = useCallback((substance: string, color: string) => {
        commit({ ...data, colors: { ...data.colors, [substance]: color } });
    }, []);
    const setMeta = useCallback((session: string, patch: SessionMeta) => {
        const prev = data.meta?.[session] ?? {};
        const next = { ...prev, ...patch };
        for (const k of Object.keys(next) as (keyof SessionMeta)[]) if (!next[k]) delete next[k];
        const meta = { ...(data.meta ?? {}) };
        if (Object.keys(next).length) meta[session] = next;
        else delete meta[session];
        commit({ ...data, meta });
    }, []);
    const clear = useCallback(() => commit(empty()), []);
    const replace = useCallback((next: JournalData) => commit(next), []);
    return { data: snapshot, add, update, remove, setColor, setMeta, clear, replace };
}

export const colorOf = (d: JournalData, substance: string) => d.colors[substance] ?? PALETTE[0];

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
        return { v: 1, ingestions, colors: (r.colors as Record<string, string>) ?? {}, meta: (r.meta as Record<string, SessionMeta>) ?? {} };
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

/** Adds imported ingestions to the journal, skipping ones already in it
 *  (same substance, same minute, same amount). */
export function merge(into: JournalData, from: JournalData): { next: JournalData; added: number } {
    const seen = new Set(into.ingestions.map(i => `${i.substance}|${Math.round(i.time / 60000)}|${i.dose}`));
    let next = { ...into, ingestions: [...into.ingestions], colors: { ...into.colors, ...from.colors }, meta: { ...(from.meta ?? {}), ...(into.meta ?? {}) } };
    let added = 0;
    for (const i of from.ingestions) {
        const key = `${i.substance}|${Math.round(i.time / 60000)}|${i.dose}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.ingestions.push(i);
        next = { ...next, colors: withColor(next, i.substance) };
        added++;
    }
    return { next, added };
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
