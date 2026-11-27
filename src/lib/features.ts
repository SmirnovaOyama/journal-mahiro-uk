import { useCallback, useSyncExternalStore } from 'react';

/* The things the journal does beyond keeping doses, each of which can be
   turned off in Settings, Features. All are on to begin with. Turning one
   off hides it and stops what it does; nothing it kept is deleted, so
   turning it back on finds the limits, the medicines and the products as
   they were.

   Kept on this device, like the theme, and outside the lock: the page
   needs it as it's drawn, and it says nothing of what was taken.

   Not here: the lock, the other code and the plain name, which have their
   own switches under Lock and privacy; and the warnings the journal always
   gave (a redose too soon, a bad mix in the last day), which stay. */

export type Feature =
    | 'lastTime'
    | 'limits'
    | 'medicines'
    | 'lingering'
    | 'patterns'
    | 'products'
    | 'paracetamol'
    | 'now'
    | 'doseLink'
    | 'watch'
    | 'crewCard'
    | 'emergencyTools'
    | 'report';

/** Every feature, grouped as Settings lists them, with what its switch says. */
export const FEATURES: { group: string; items: { id: Feature; label: string; says: string }[] }[] = [
    {
        group: 'In the dose form',
        items: [
            { id: 'lastTime', label: 'Notes from last time', says: 'What was written the last night a substance was taken is shown before it’s taken again.' },
            { id: 'limits', label: 'Limits', says: 'The most in one night and the days between nights, set on a substance’s page in the journal and said back when a dose would cross one.' },
            { id: 'medicines', label: 'Medicines I take every day', says: 'They are counted as already taken in the mix checker, on each substance’s page and in the dose form.' },
            { id: 'lingering', label: 'Drugs still at work', says: 'A dose logged days ago is checked against a new one for as long as its drug stays in the body.' },
            { id: 'products', label: 'Products with several ingredients', says: 'A product is written down once from its box, and so many of it are logged as so much of each ingredient.' },
            { id: 'paracetamol', label: 'Paracetamol’s total', says: 'Paracetamol is added up over 24 hours, with a warning past 4 g.' },
        ],
    },
    {
        group: 'In the journal',
        items: [
            { id: 'now', label: 'The Now screen', says: 'The night going on is shown on one screen, in large type.' },
            { id: 'patterns', label: 'Days in a row', says: 'A drug that can’t safely be stopped at once gets a note after seven days in a row.' },
            { id: 'doseLink', label: 'A dose’s own address', says: 'Each dose has a link that opens the form filled in, and such links are followed when opened.' },
            { id: 'watch', label: 'Someone to watch over a night', says: 'A night can be shared with a link, with check-ins. Turning this off ends a night being shared. A link someone else sent still opens.' },
        ],
    },
    {
        group: 'On the emergency page',
        items: [
            { id: 'crewCard', label: 'What was taken', says: 'The journal’s last 24 hours, the daily medicines and the body weight are set out for the crew.' },
            { id: 'emergencyTools', label: 'The beat, reading aloud and position', says: 'A beat for chest compressions, the steps read aloud, and where this device is.' },
        ],
    },
    {
        group: 'On a substance’s page',
        items: [{ id: 'report', label: 'Reporting a mistake', says: 'Each page ends with a link that opens a GitHub issue about it.' }],
    },
];

const KEY = 'journal.features.v1';
type Off = Partial<Record<Feature, true>>;

function read(): Off {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Off;
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
        return {};
    }
}

let off = read();
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
    subs.add(f);
    return () => {
        subs.delete(f);
    };
};

/** Whether a feature is on. For code outside a component. */
export const featureOn = (f: Feature) => !off[f];

/** How many features are off. */
export const featuresOff = () => Object.keys(off).length;

export function setFeature(f: Feature, on: boolean) {
    const next = { ...off };
    if (on) delete next[f];
    else next[f] = true;
    off = next;
    try {
        if (Object.keys(next).length) localStorage.setItem(KEY, JSON.stringify(next));
        else localStorage.removeItem(KEY);
    } catch {
        /* for this visit only */
    }
    subs.forEach(s => s());
}

/** The features, for a component: it is drawn again when one changes. */
export function useFeatures() {
    const snapshot = useSyncExternalStore(subscribe, () => off);
    const on = useCallback((f: Feature) => !snapshot[f], [snapshot]);
    return { on, set: setFeature, off: Object.keys(snapshot).length };
}

/** One feature, for a component. */
export function useFeature(f: Feature): boolean {
    return !useSyncExternalStore(subscribe, () => off)[f];
}
