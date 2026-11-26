import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PHONE_TAB_ICONS } from './PhoneTabIcons';

interface NavTab {
    id: string;
    label: string;
    icon: React.ElementType;
}

/**
 * The bottom bar on a phone: a frosted floating island that content scrolls
 * visibly beneath, drawn with the same hairline as the rest of the page and
 * no shadow. The current tab is terracotta and the others grey: that is the whole
 * difference. The colour eases over, icon and label as one, since the icon
 * takes its ink from the label's (app.css, .nav-tab); a tab pressed sinks a
 * little under the finger. (A tinted pill used to glide to the new tab while
 * its label turned bold at once, so the two arrived at different moments.)
 * The icons are the hand-drawn doodles, in one ink like the label under them.
 *
 * Labels stay on one line: a wrapped one raised its icon above the rest and
 * grew the island past the scroller's bottom padding. Below 340px they drop to
 * 10px rather than being cut off, and the packs keep them short enough for
 * that. Each tab is rounded so the focus ring nests in the island.
 *
 * Reading down a long page, the bar slides out of the way so it no longer
 * sits over what's being read; a short scroll back up, the top of the page or
 * its end brings it back, and so does every new page. `pageKey` is the page
 * being shown, so the bar knows when that happens.
 *
 * It also stays out of the way for as long as something on the page holds it
 * there (useNavHeldAway): the form a dose is logged in, whose warnings and
 * Log it would otherwise open under the bar.
 */
const BottomNav: React.FC<{
    tabs: NavTab[];
    activeTab: string;
    onSelect: (id: string) => void;
    pageKey?: string;
}> = ({ tabs, activeTab, onSelect, pageKey }) => {
    const navRef = useRef<HTMLElement>(null);

    // The bar's real height, for the page's bottom clearance (--nav-clearance):
    // larger text or a longer label makes it taller than any fixed figure.
    useLayoutEffect(() => {
        const nav = navRef.current;
        if (!nav) return;
        const root = document.documentElement;
        const measure = () => {
            const h = nav.offsetHeight;
            if (h > 0) root.style.setProperty('--nav-h', `${h}px`);
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(measure);
        ro.observe(nav);
        return () => {
            ro.disconnect();
            root.style.removeProperty('--nav-h');
        };
    }, []);

    const scrolledAway = useScrollAway(pageKey);
    const held = useSyncExternalStore(watchHolds, () => holds > 0);
    const hidden = scrolledAway || held;

    return (
        <nav
            ref={navRef}
            data-hidden={hidden ? '' : undefined}
            className="bottom-nav fixed bg-[var(--surface)] left-4 right-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 md:hidden rounded-[var(--radius-xl)] border-(length:--hairline) border-[var(--border)]"
        >
            <div className="flex items-stretch p-1.5 gap-0.5">
                {tabs.map(({ id, icon, label }) => {
                    // Journal draws its own tab icons; the borrowed line set is only a fallback.
                    const TabIcon = icon ?? PHONE_TAB_ICONS[id];
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onSelect(id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`nav-tab flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-[var(--radius-lg)] ${isActive ? 'text-[var(--accent-ink)]' : 'text-[var(--text-muted)]'}`}
                        >
                            <span className="nav-ico grid h-[30px] w-[52px] place-items-center">
                                <TabIcon size={22} />
                            </span>
                            <span className="whitespace-nowrap text-xs leading-4 font-medium">{label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

// How many things on the page are holding the bar away just now.
let holds = 0;
const holdWatchers = new Set<() => void>();
const watchHolds = (fn: () => void) => {
    holdWatchers.add(fn);
    return () => {
        holdWatchers.delete(fn);
    };
};
const setHolds = (by: number) => {
    holds += by;
    holdWatchers.forEach(fn => fn());
};

/**
 * Keeps the phone's bottom bar out of the way for as long as the component
 * calling it is on the page, wherever the page is scrolled: for a task that
 * needs the whole screen and is closed by its own buttons. The bar comes back
 * the moment the last one holding it is gone.
 */
export function useNavHeldAway() {
    useEffect(() => {
        setHolds(1);
        return () => setHolds(-1);
    }, []);
}

/** How far the page must move one way before the bar follows, so a finger
 * resting on the glass or a small correction doesn't make it flicker. */
const TRAVEL = 24;
/** Near the top of a page the bar always shows. */
const TOP = 48;

/**
 * Whether the bar should be out of the way: true once the page has been
 * scrolled down a little, false again after a little scroll up, at the top,
 * at the end, or on a new page. Any scroller counts, the page area or one
 * inside it, since scroll events are caught on their way down.
 */
function useScrollAway(pageKey?: string): boolean {
    // Hidden on the page it was hidden on; a new page starts with it shown.
    const [hiddenOn, setHiddenOn] = useState<string | undefined | null>(null);

    useEffect(() => {
        const setHidden = (hide: boolean) => setHiddenOn(hide ? pageKey : null);
        const last = new WeakMap<EventTarget, number>();
        let travel = 0;
        const onScroll = (e: Event) => {
            const el = e.target instanceof Element ? e.target : (document.scrollingElement ?? document.documentElement);
            const top = el.scrollTop;
            const prev = last.get(el);
            last.set(el, top);
            // A sideways scroller (a chart, a row of chips) moves no rows.
            if (prev === undefined || top === prev) return;
            const max = el.scrollHeight - el.clientHeight;
            if (top <= TOP || top >= max - 2) {
                travel = 0;
                setHidden(false);
                return;
            }
            const delta = top - prev;
            // Start counting again whenever the direction turns.
            travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
            if (travel > TRAVEL) setHidden(true);
            else if (travel < -TRAVEL) setHidden(false);
        };
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => document.removeEventListener('scroll', onScroll, { capture: true });
    }, [pageKey]);

    return hiddenOn !== null && hiddenOn === pageKey;
}

export default BottomNav;
