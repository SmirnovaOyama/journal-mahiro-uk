import { useEffect, useLayoutEffect, useRef } from 'react';
import { PixelCatProvider } from './contexts/PixelCatContext';
import { go, useRoute, type Route } from './lib/router';
import { useIndex } from './lib/useIndex';
import { useLang } from './lib/lang';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Doodle, { NAV_DOODLES } from './components/Doodle';
import { Browse } from './pages/Browse';
import { Emergency } from './pages/Emergency';
import { Home } from './pages/Home';
import { Journal } from './pages/Journal';
import { Kind } from './pages/Kind';
import { Mix } from './pages/Mix';
import { Saved } from './pages/Saved';
import { Onboarding, useOnboarding } from './pages/Onboarding';
import { Settings } from './pages/Settings';
import { Substance } from './pages/Substance';
import { Xunxun } from './pages/Xunxun';
import { XUNXUN_ID } from './lib/xunxun';
import { Report } from './pages/Report';
import { Now } from './pages/Now';
import { Watch } from './pages/Watch';
import { LogFromAddress } from './components/DoseLink';
import { tr } from './lib/i18n';

/* Oyama's app shell, as hrt.mahiro.uk has it: the sidebar on a wide window,
   the page area that scrolls on its own (and is what moves between pages),
   and the floating island of tabs on a phone. */

type Tab = 'search' | 'journal' | 'mix' | 'saved' | 'settings';

const TAB_ROUTE: Record<Tab, Route> = {
    search: { page: 'home' },
    journal: { page: 'journal' },
    mix: { page: 'mix', ids: [] },
    saved: { page: 'saved' },
    settings: { page: 'settings' },
};

/* Browsing by kind lives under Search (its page lists the kinds); the
   journal has the notebook, as PsychonautWiki Journal puts the log first. */
function tabOf(r: Route): Tab {
    switch (r.page) {
        case 'journal':
        case 'now':
        case 'log':
            return 'journal';
        case 'mix':
            return 'mix';
        case 'saved':
            return 'saved';
        case 'settings':
            return 'settings';
        default:
            return 'search';
    }
}

/** A tab's doodle, sized for the bottom bar's 30px mark. */
const doodleTab = (id: string) => {
    const DoodleTab = () => <Doodle name={NAV_DOODLES[id]} size={1.875} className="-my-1" />;
    DoodleTab.displayName = `DoodleTab(${id})`;
    return DoodleTab;
};
const TAB_DOODLES: Record<Tab, () => JSX.Element> = {
    search: doodleTab('search'),
    journal: doodleTab('journal'),
    mix: doodleTab('mix'),
    saved: doodleTab('saved'),
    settings: doodleTab('settings'),
};

function AppContent() {
    const route = useRoute();
    const { index, byId, failed } = useIndex();
    const tab = tabOf(route);
    const intro = useOnboarding();
    const scroller = useRef<HTMLDivElement>(null);

    // A new page remounts and starts at its top; adding to the mix keeps the
    // same page, so it stays where it is with the cursor in its field. The
    // Journal's tabs (Log, Stats, Weight) are panels of one page too: keyed
    // apart, choosing one rebuilt the page, so the underline was redrawn under
    // the new tab instead of sliding there and the panel never slid in.
    const key =
        route.page === 'substance'
            ? `s:${route.id}`
            : route.page === 'report'
            ? `r:${route.id}`
            : route.page === 'kind'
              ? `k:${route.category}`
              : route.page === 'settings'
                ? `settings:${route.sub ?? ''}`
                : route.page === 'journal'
                  ? `journal:${route.session ?? route.substance ?? ''}`
                  : route.page;
    useLayoutEffect(() => {
        scroller.current?.scrollTo(0, 0);
    }, [key]);
    useEffect(() => {
        if (route.page === 'home') document.title = 'Oyama Journal';
    }, [key, route.page]);

    // Each tab is one of the hand-drawn doodles, the same the sidebar shows.
    const navItems = (
        [
            ['journal', tr('Journal')],
            ['search', tr('Search')],
            ['mix', tr('Mix')],
            ['saved', tr('Saved')],
            ['settings', tr('Settings')],
        ] as const
    ).map(([id, label]) => ({ id, label, icon: TAB_DOODLES[id] }));
    const select = (id: string) => go(TAB_ROUTE[id as Tab], { move: 'none', via: 'tab' });

    return (
        <div className="h-[100dvh] w-full bg-[var(--bg)] flex flex-col md:flex-row font-sans text-[var(--text)] overflow-hidden">
            <Sidebar navItems={navItems} currentView={tab} onViewChange={select} />
            <div className="flex-1 flex flex-col overflow-hidden w-full bg-[var(--bg)] relative">
                {/* The site's name over the page on a phone, as hrt.mahiro.uk shows
                    its host; its top padding keeps the page clear of a notch. */}
                <div className="md:hidden shrink-0 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-1 text-center text-xs font-medium tracking-wide text-[var(--text-muted)] select-none">
                    {window.location.hostname}
                </div>

                <div
                    ref={scroller}
                    key={key}
                    className="main-view flex-1 flex flex-col overflow-y-auto scrollbar-hide scroll-pb-nav bg-[var(--bg)]"
                >
                    <div className="flex-1">
                        {route.page === 'emergency' ? (
                            // First, and whatever else failed: it needs nothing but itself.
                            <Emergency byId={byId} />
                        ) : failed ? (
                            <div className="mx-auto w-full max-w-2xl px-6 md:px-8 py-16">
                                <p className="text-sm font-semibold">
                                    {tr('Couldn’t load the substance list')}
                                </p>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {tr('Check your connection and reload the page.')}
                                </p>
                            </div>
                        ) : route.page === 'substance' && route.id === XUNXUN_ID ? (
                            <Xunxun />
                        ) : route.page === 'substance' ? (
                            <Substance id={route.id} index={index} byId={byId} />
                        ) : route.page === 'report' ? (
                            <Report id={route.id} />
                        ) : route.page === 'mix' ? (
                            <Mix ids={route.ids} index={index} byId={byId} />
                        ) : route.page === 'kind' ? (
                            <Kind category={route.category} index={index} />
                        ) : route.page === 'browse' ? (
                            <Browse index={index} />
                        ) : route.page === 'now' ? (
                            <Now byId={byId} />
                        ) : route.page === 'watch' ? (
                            <Watch id={route.id} byId={byId} />
                        ) : route.page === 'log' ? (
                            <LogFromAddress route={route} index={index} byId={byId} />
                        ) : route.page === 'journal' ? (
                            <Journal index={index} byId={byId} session={route.session} view={route.view} substance={route.substance} />
                        ) : route.page === 'saved' ? (
                            <Saved byId={byId} />
                        ) : route.page === 'settings' ? (
                            <Settings sub={route.sub} />
                        ) : (
                            <Home index={index} byId={byId} />
                        )}
                    </div>
                </div>

                <BottomNav tabs={navItems} activeTab={tab} onSelect={select} pageKey={key} />
            </div>
            {/* Never over the emergency page: whoever opens that first has no
                time for an introduction. It waits for the next page. Nor over
                a night someone shared, opened by a person who came to watch. */}
            {intro && route.page !== 'emergency' && route.page !== 'watch' && <Onboarding />}
        </div>
    );
}

export default function App() {
    // Keyed by the language: changing it draws every page again, in its words.
    const { lang } = useLang();
    return (
        <PixelCatProvider>
            <AppContent key={lang} />
        </PixelCatProvider>
    );
}
