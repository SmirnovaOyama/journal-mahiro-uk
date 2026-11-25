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
   (pop), and a tab chosen from the bar simply shows its page. */

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

function sync() {
    if (here() === currentPath) return;
    currentPath = here();
    current = parse(currentPath);
    notify();
}

/** How deep in the site's own history the visitor is, so Back can leave the
 *  site's history rather than the browser's. */
let depth = 0;

window.addEventListener('popstate', () => {
    if (here() === currentPath) return;
    depth = Math.max(0, depth - 1);
    runViewMove('pop', sync);
});

export function go(r: Route, opts: { replace?: boolean; move?: ViewMove } = {}) {
    const next = href(r);
    if (next === here()) return;
    const apply = () => {
        if (opts.replace) history.replaceState(null, '', next);
        else {
            history.pushState(null, '', next);
            depth += 1;
        }
        sync();
    };
    runViewMove(opts.replace ? 'none' : (opts.move ?? 'push'), apply);
}

export function back() {
    if (depth > 0) history.back();
    else go({ page: 'home' }, { replace: true });
}

export function useRoute(): Route {
    return useSyncExternalStore(
        (f) => {
            subs.add(f);
            return () => {
                subs.delete(f);
            };
        },
        () => current
    );
}
