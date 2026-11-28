import { useCallback, useSyncExternalStore } from 'react';
import { kv } from './kv';

/* What the journal knows of the person besides their doses, kept on this
   device and, with an account, in its encrypted copy:

   - the medicines taken every day, which every mix check, every substance's
     page and the dose form read as already taken;
   - the limits set while sober: the most of a substance in one night, and
     the days to leave between two nights of it, which the dose form says
     back when a dose would cross one;
   - products with more than one ingredient (a cold medicine), as read off
     the box, so so many tablets are logged as so much of each; and liquids
     a dose too small to weigh was dissolved in (components/Volumetric.tsx),
     a product of one part taken by the mL.

   Each entry carries when it last changed, and one taken away stays as a
   mark that it was, so two devices merge to the later of the two. */

export interface Medicine {
    on: boolean;
    at: number;
    /** Its name as it was when added, shown where the catalogue isn't loaded. */
    name: string;
}

export interface Limit {
    /** The most in one night, in `unit`. */
    max?: number;
    unit?: string;
    /** Days to leave between two nights of it. */
    gap?: number;
    at: number;
}

export interface ProductPart {
    /** The catalogue id, or the name as typed. */
    substance: string;
    name: string;
    /** How much is in one tablet (or one mL, one sachet). */
    amount: number;
    unit: string;
}

export interface Product {
    id: string;
    name: string;
    /** What one of it is: 'tablet', 'capsule', 'mL', 'sachet'. */
    per: string;
    parts: ProductPart[];
    /** How it's taken, where that isn't swallowed: a liquid held under the
     *  tongue is logged as sublingual. */
    route?: string;
    at: number;
    gone?: boolean;
}

export interface Person {
    v: 1;
    medicines: Record<string, Medicine>;
    limits: Record<string, Limit>;
    products: Record<string, Product>;
}

const KEY = 'journal.person.v1';

export const emptyPerson = (): Person => ({ v: 1, medicines: {}, limits: {}, products: {} });

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A person read from storage or from the account, with anything malformed dropped. */
export function cleanPerson(raw: unknown): Person {
    const r = obj(raw);
    const out = emptyPerson();
    for (const [id, m] of Object.entries(obj(r.medicines))) {
        const x = m as Medicine;
        if (x && num(x.at)) out.medicines[id] = { on: !!x.on, at: x.at, name: typeof x.name === 'string' ? x.name : id };
    }
    for (const [id, l] of Object.entries(obj(r.limits))) {
        const x = l as Limit;
        if (!x || !num(x.at)) continue;
        out.limits[id] = {
            at: x.at,
            ...(num(x.max) && x.max > 0 && typeof x.unit === 'string' ? { max: x.max, unit: x.unit } : {}),
            ...(num(x.gap) && x.gap > 0 ? { gap: x.gap } : {}),
        };
    }
    for (const [id, p] of Object.entries(obj(r.products))) {
        const x = p as Product;
        if (!x || !num(x.at) || typeof x.name !== 'string') continue;
        const parts = (Array.isArray(x.parts) ? x.parts : []).filter(
            q => q && typeof q.substance === 'string' && typeof q.name === 'string' && num(q.amount) && q.amount > 0 && typeof q.unit === 'string',
        );
        out.products[id] = {
            id,
            name: x.name,
            per: typeof x.per === 'string' ? x.per : 'tablet',
            parts,
            ...(typeof x.route === 'string' && x.route ? { route: x.route } : {}),
            at: x.at,
            ...(x.gone ? { gone: true } : {}),
        };
    }
    return out;
}

function read(): Person {
    try {
        const raw = kv.get(KEY);
        return raw ? cleanPerson(JSON.parse(raw)) : emptyPerson();
    } catch {
        return emptyPerson();
    }
}

let person = read();
const subs = new Set<() => void>();
const localSubs = new Set<() => void>();

function commit(next: Person, merged = false) {
    person = next;
    kv.set(KEY, JSON.stringify(next));
    subs.forEach(f => f());
    if (!merged) localSubs.forEach(f => f());
}

kv.on(KEY, () => {
    person = read();
    subs.forEach(f => f());
});

export const getPerson = () => person;
export const applyPerson = (next: Person) => commit(next, true);
/** Puts in a copy read from a file, merged with what's here: a change made
 *  on this device, so it reaches the account. */
export const importPerson = (from: Person) => commit(mergePerson(from, person));
export function onPersonChange(f: () => void): () => void {
    localSubs.add(f);
    return () => {
        localSubs.delete(f);
    };
}

/** Whether there's anything in it worth sending to the account. */
export const personIsEmpty = (p: Person) => !Object.keys(p.medicines).length && !Object.keys(p.limits).length && !Object.keys(p.products).length;

function later<T extends { at: number }>(local: Record<string, T>, remote: Record<string, T>): Record<string, T> {
    const out: Record<string, T> = { ...remote };
    for (const [id, e] of Object.entries(local)) if (!out[id] || e.at > out[id].at) out[id] = e;
    return out;
}

/** Two devices' copies as one: for each medicine, limit and product, the
 *  one changed last (the account's on a tie). */
export function mergePerson(local: Person | null | undefined, remote: Person | null | undefined): Person {
    const l = local ?? emptyPerson();
    const r = remote ?? emptyPerson();
    return { v: 1, medicines: later(l.medicines, r.medicines), limits: later(l.limits, r.limits), products: later(l.products, r.products) };
}

/** The medicines taken every day, newest first. */
export const medicinesOf = (p: Person): { id: string; name: string }[] =>
    Object.entries(p.medicines)
        .filter(([, m]) => m.on)
        .sort((a, b) => b[1].at - a[1].at)
        .map(([id, m]) => ({ id, name: m.name }));

/** The products kept, by name. */
export const productsOf = (p: Person): Product[] =>
    Object.values(p.products)
        .filter(x => !x.gone)
        .sort((a, b) => a.name.localeCompare(b.name));

const subscribe = (f: () => void) => {
    subs.add(f);
    return () => {
        subs.delete(f);
    };
};

export function usePerson() {
    const snapshot = useSyncExternalStore(subscribe, () => person);
    const setMedicine = useCallback((id: string, name: string, on: boolean) => {
        commit({ ...person, medicines: { ...person.medicines, [id]: { on, at: Date.now(), name } } });
    }, []);
    /** Sets, changes or (with nothing in it) takes away a substance's limits. */
    const setLimit = useCallback((id: string, limit: Omit<Limit, 'at'>) => {
        commit({ ...person, limits: { ...person.limits, [id]: { ...limit, at: Date.now() } } });
    }, []);
    const saveProduct = useCallback((p: Omit<Product, 'at'>) => {
        commit({ ...person, products: { ...person.products, [p.id]: { ...p, at: Date.now() } } });
    }, []);
    const removeProduct = useCallback((id: string) => {
        const p = person.products[id];
        if (p) commit({ ...person, products: { ...person.products, [id]: { ...p, parts: [], gone: true, at: Date.now() } } });
    }, []);
    return { person: snapshot, setMedicine, setLimit, saveProduct, removeProduct };
}
