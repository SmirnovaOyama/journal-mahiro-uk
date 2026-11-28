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
    | 'volumetric'
    | 'picture'
    | 'report';

/** Every feature, grouped as Settings lists them, with what its switch says. */
export const FEATURES: { group: string; items: { id: Feature; label: string; says: string }[] }[] = [
    {
        group: 'In the dose form',
        items: [
            { id: 'lastTime', label: 'Notes from last time', says: 'Before you log a substance again, your notes from the last time are shown.' },
            { id: 'limits', label: 'Limits', says: 'A maximum per night and a minimum gap between nights, set for each substance. The dose form warns you when a dose would go over.' },
            { id: 'medicines', label: 'Medicines I take every day', says: 'They’re treated as already taken in the mix checker, on substance pages and in the dose form.' },
            { id: 'lingering', label: 'Drugs still active', says: 'A dose from a few days ago is still checked against new doses while it’s in your body.' },
            { id: 'products', label: 'Products with several ingredients', says: 'A product’s ingredients are entered once from the box. After that, logging how many you took counts each ingredient.' },
            { id: 'paracetamol', label: 'Paracetamol’s total', says: 'Paracetamol is added up over 24 hours, with a warning past 4 g.' },
        ],
    },
    {
        group: 'In the journal',
        items: [
            { id: 'now', label: 'The Now screen', says: 'Shows the current session on one screen, in large type.' },
            { id: 'patterns', label: 'Days in a row', says: 'Drugs that shouldn’t be stopped suddenly get a note after seven days in a row.' },
            { id: 'doseLink', label: 'Dose links', says: 'Each dose has a link that opens the dose form already filled in.' },
            { id: 'watch', label: 'Someone to watch over a night', says: 'Share a night with someone through a link, with check-ins. Turning this off stops sharing; links others send you still open.' },
        ],
    },
    {
        group: 'On the emergency page',
        items: [
            { id: 'crewCard', label: 'What was taken', says: 'Shows paramedics your doses from the last 24 hours, your daily medicines and your body weight.' },
            { id: 'emergencyTools', label: 'The beat, reading aloud and position', says: 'A beat for chest compressions, steps read aloud, and your location.' },
        ],
    },
    {
        group: 'On a substance’s page',
        items: [
            {
                id: 'volumetric',
                label: 'Measuring in a liquid',
                says: 'When a dose is too small to weigh, the substance page works out the liquid’s strength and how much liquid each dose is.',
            },
            { id: 'report', label: 'Reporting a mistake', says: 'Each page has a link at the bottom to report a mistake on GitHub.' },
        ],
    },
    {
        group: 'Images',
        items: [
            {
                id: 'picture',
                label: 'Save as image',
                says: 'Save a night from your journal as an image in one tap, as a timeline or a clock. It’s made on your device and isn’t uploaded.',
            },
        ],
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
