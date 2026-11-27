/* A plain name and a plain icon, for a phone other people see: with it on,
   the tab, the browser's history and an app added to the Home Screen are
   called what the reader chose ("Notes"), under an icon that is a grey
   page, and nothing of the site's own name shows outside the page.

   Kept outside the lock (lib/kv.ts), since it's needed before the code is
   typed. index.html applies it before anything is drawn; this file is the
   same thing for the running app, and where Settings turns it on.

   An app already on the Home Screen keeps the name it was added under:
   turn this on first, then add it. */

const KEY = 'journal.quiet.v1';

export interface Quiet {
    name: string;
}

export function readQuiet(): Quiet | null {
    try {
        const q = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Quiet | null;
        return q && typeof q.name === 'string' && q.name.trim() ? { name: q.name.trim().slice(0, 30) } : null;
    } catch {
        return null;
    }
}

/** The manifest an installed app is named by, plain: the Worker writes the
 *  name into it (worker/index.ts). */
export const quietManifest = (name: string) => `/manifest.webmanifest?plain=${encodeURIComponent(name)}`;

let observer: MutationObserver | null = null;

/** Makes the page wear the plain name, or its own again. */
export function applyQuiet(q: Quiet | null) {
    const set = (selector: string, attr: string, value: string) => document.querySelector(selector)?.setAttribute(attr, value);
    observer?.disconnect();
    observer = null;
    if (!q) {
        set('link[rel="manifest"]', 'href', '/manifest.webmanifest');
        set('link[rel="apple-touch-icon"]', 'href', '/apple-touch-icon.png');
        set('link[rel="icon"][sizes="64x64"]', 'href', '/favicon.png?v=2');
        set('link[rel="icon"][sizes="32x32"]', 'href', '/favicon-32.png?v=2');
        set('meta[name="application-name"]', 'content', 'Oyama Journal');
        set('meta[name="apple-mobile-web-app-title"]', 'content', 'Journal');
        return;
    }
    set('link[rel="manifest"]', 'href', quietManifest(q.name));
    set('link[rel="apple-touch-icon"]', 'href', '/plain-180.png');
    set('link[rel="icon"][sizes="64x64"]', 'href', '/plain-64.png');
    set('link[rel="icon"][sizes="32x32"]', 'href', '/plain-64.png');
    set('meta[name="application-name"]', 'content', q.name);
    set('meta[name="apple-mobile-web-app-title"]', 'content', q.name);
    // Every page sets its own title as it opens; each time, it's put back.
    const pin = () => {
        if (document.title !== q.name) document.title = q.name;
    };
    pin();
    const title = document.querySelector('title');
    if (title && typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(pin);
        observer.observe(title, { childList: true, characterData: true, subtree: true });
    }
}

export function setQuiet(q: Quiet | null) {
    try {
        if (q) localStorage.setItem(KEY, JSON.stringify(q));
        else localStorage.removeItem(KEY);
    } catch {
        /* for this visit only */
    }
    applyQuiet(q);
}
