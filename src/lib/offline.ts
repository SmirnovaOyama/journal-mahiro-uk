/* The site without a connection. public/sw.js does the keeping: the page,
   its script and stylesheet, the search index, the mix table, and each
   substance as it's opened. This file starts it, and adds the substances
   the reader would miss most whether or not they were ever opened on this
   device: the ones saved, the ones in the journal (which an account may
   have brought from another device), and the ones looked at lately.

   Only on the built site: the dev server's files change under it. */

import { structureUrl } from '../components/Molecule';
import { loadIndex } from './data';
import { getJournal, onLocalChange } from './journal';
import { getRecent, getSavedLog, onSavedChange } from './store';

/** The cache public/sw.js keeps the catalogue in, by the same name. */
const DATA = 'journal-data-v1';

/** A substance's own file, as lib/data.ts asks for it. */
const detailUrl = (id: string) => `/data/substances/${encodeURIComponent(id)}.json`;

/** Whether the site can be kept on this device at all. */
export const keepsOffline = () => import.meta.env.PROD && 'serviceWorker' in navigator && 'caches' in window;

/** One pass: whatever of the reader's substances isn't kept yet is fetched
 *  and kept, one file at a time. Stops at the first that fails, since the
 *  rest would too; the next pass picks up where it left off. */
async function pass() {
    if (!navigator.onLine) return;
    // Asked to save data: nothing is fetched that the reader didn't open.
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    // A journal can name what the catalogue doesn't have: a typed-in name.
    const known = new Set((await loadIndex()).map(e => e.id));
    const ids = new Set<string>();
    for (const [id, e] of Object.entries(getSavedLog())) if (e.on) ids.add(id);
    for (const i of getJournal().ingestions) ids.add(i.substance);
    for (const id of getRecent()) ids.add(id);
    const urls = new Set<string>();
    for (const id of ids) {
        if (!known.has(id)) continue;
        urls.add(detailUrl(id));
        urls.add(structureUrl(id));
    }
    const cache = await caches.open(DATA);
    for (const url of urls) {
        if (await cache.match(url)) continue;
        const res = await fetch(url);
        if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) await cache.put(url, res);
    }
}

let running = false;
let again = false;
async function keepMine() {
    if (running) {
        again = true;
        return;
    }
    running = true;
    try {
        do {
            again = false;
            await pass();
        } while (again);
    } catch {
        /* offline, or out of room: what's kept so far stays */
    } finally {
        running = false;
    }
}

/** After the page has settled: this is never what the reader is waiting for. */
const soon = () => {
    const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => void keepMine(), { timeout: 5000 });
    else window.setTimeout(() => void keepMine(), 2000);
};

export function startOffline() {
    if (!keepsOffline()) return;
    const begin = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
        soon();
    };
    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', begin, { once: true });
    // Saved or logged just now, or back in range: keep what's new.
    onSavedChange(soon);
    onLocalChange(soon);
    window.addEventListener('online', soon);
}
