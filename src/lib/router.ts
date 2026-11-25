import { useSyncExternalStore } from 'react';
import { runViewMove, type ViewMove } from '../motion/viewMove';

/* Every page has a real path, so a shared link names the page and a link
   preview can be made for it (worker/index.ts writes each page's title,
   description and picture into the HTML it serves):
   /                  search
   /s/lsd             a substance
   /mix/lsd+mdma      the mix checker
   /kind/Stimulant    one kind of substance
   /browse            every kind
   /saved             the ones saved on this device
   /settings          settings, and /settings/language and so on under it
   Links from before, in the hash (#/s/lsd), are moved to their path on load.

   Moving between pages goes through Oyama's view moves (motion/viewMove.ts):
   into a page from the one above it slides it in (push), back slides it away
   (pop), and a tab chosen from the bar simply shows its page.

   Each page in the site's history remembers how it was opened: by a link
   from another page, or from the tab bar. A tab's own page (Search, Journal,
   Mix, Saved, Settings) opened by a link, say a mix from a substance's
   warnings or the journal from Log, has a page to go back to and says so
   with a back arrow; opened from the bar, or straight from outside, it's
   where you are and has none (useOpenedFromLink). */

import { href, parse, type Route } from './routes';
export { href, parse };
export type { Route, SettingsSub } from './routes';

/* ── the current route, as a store ── */

function migrateLegacy() {
    // Links from before: ?substance=lsd, and the hash routes (#/s/lsd).
    const q = new URLSearchParams(location.search).get('substance');
    if (q) {
        history.replaceState(null, '', `/s/${encodeURIComponent(q)}`);
        return;
    }
    if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1) || '/');
}
migrateLegacy();

const here = () => location.pathname;
let current: Route = parse(here());
let currentPath = here();
const subs = new Set<() => void>();
const notify = () => subs.forEach(f => f());
const subscribe = (f: () => void) => {
    subs.add(f);
    return () => {
        subs.delete(f);
    };
};

/** How a page was opened: by a link from another page here, or from the tab bar. */
export type Via = 'link' | 'tab';
/** What each history entry keeps: how it was opened, and how deep it is. */
interface Entry {
    via?: Via;
    depth?: number;
}
const entry = (): Entry => (history.state && typeof history.state === 'object' ? (history.state as Entry) : {});

/** How deep in the site's own history the visitor is, so Back can leave the
 *  site's history rather than the browser's. Kept in each entry, so it's
 *  right after a reload, and going forward as well as back. */
let depth = entry().depth ?? 0;
let via: Via | null = entry().via ?? null;
let navKey = `${via}:${depth}`;

function sync() {
    if (here() === currentPath) return;
    currentPath = here();
    current = parse(currentPath);
    navKey = `${via}:${depth}`;
    notify();
}

window.addEventListener('popstate', () => {
    if (here() === currentPath) return;
    const e = entry();
    depth = e.depth ?? 0;
    via = e.via ?? null;
    runViewMove('pop', sync);
});

/** Opens a page. A tab chosen from the bar passes `via: 'tab'`; anything
 *  else is a link, unless it only shows another tab's page (`move: 'none'`).
 *  A replace changes the address of the page showing and keeps how it was
 *  opened (a mix with one more substance is still the mix opened from there). */
export function go(r: Route, opts: { replace?: boolean; move?: ViewMove; via?: Via } = {}) {
    const next = href(r);
    if (next === here()) {
        // The tab of the page already showing: it's that tab's own page now,
        // with no way back, as a tab bar does when its tab is tapped again.
        if (opts.via === 'tab' && via === 'link') {
            via = 'tab';
            history.replaceState({ ...entry(), via }, '', next);
            navKey = `${via}:${depth}`;
            notify();
        }
        return;
    }
    const apply = () => {
        if (opts.replace) history.replaceState(history.state, '', next);
        else {
            depth += 1;
            via = opts.via ?? (opts.move === 'none' ? 'tab' : 'link');
            history.pushState({ via, depth } satisfies Entry, '', next);
        }
        sync();
    };
    runViewMove(opts.replace ? 'none' : (opts.move ?? 'push'), apply);
}

/** Whether the page showing was opened by a link from another page here,
 *  so it has one to go back to. For the tabs' own pages, which otherwise
 *  have no back arrow. */
export function useOpenedFromLink(): boolean {
    const key = useSyncExternalStore(subscribe, () => navKey);
    const [how, deep] = key.split(':');
    return how === 'link' && Number(deep) > 0;
}

export function back() {
    if (depth > 0) history.back();
    else go({ page: 'home' }, { replace: true });
}

export function useRoute(): Route {
    return useSyncExternalStore(subscribe, () => current);
}
