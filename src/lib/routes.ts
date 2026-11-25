/* The site's pages and their paths, with nothing that touches the browser,
   so the Worker (worker/index.ts) reads paths exactly as the app does. */

export type Route =
    | { page: 'home' }
    | { page: 'substance'; id: string }
    | { page: 'mix'; ids: string[] }
    | { page: 'kind'; category: string }
    | { page: 'browse' }
    | { page: 'saved' }
    | { page: 'journal'; session?: string; view?: 'stats'; substance?: string }
    | { page: 'settings'; sub?: SettingsSub };

/** Settings' own pages: its three groups, the pages a row opens, and the
 *  account's. */
export type SettingsSub =
    | 'general'
    | 'data'
    | 'about'
    | 'appearance'
    | 'disclaimer'
    | 'account'
    | 'password'
    | 'recovery-key'
    | 'devices'
    | 'delete-account'
    | 'recover'
    | 'admin';
const SETTINGS_SUBS: readonly SettingsSub[] = [
    'general',
    'data',
    'about',
    'appearance',
    'disclaimer',
    'account',
    'password',
    'recovery-key',
    'devices',
    'delete-account',
    'recover',
    'admin',
];

export function parse(path: string): Route {
    const parts = path.replace(/^[#/]+/, '').split('/').map(decodeURIComponent);
    if (parts[0] === 's' && parts[1]) return { page: 'substance', id: parts[1].toLowerCase() };
    if (parts[0] === 'mix') return { page: 'mix', ids: (parts[1] || '').split('+').filter(Boolean) };
    if (parts[0] === 'kind' && parts[1]) return { page: 'kind', category: parts[1] };
    if (parts[0] === 'browse') return { page: 'browse' };
    if (parts[0] === 'saved') return { page: 'saved' };
    if (parts[0] === 'journal') {
        if (parts[1] === 'stats') return { page: 'journal', view: 'stats' };
        if (parts[1] === 'substance' && parts[2]) return { page: 'journal', substance: parts[2] };
        return parts[1] ? { page: 'journal', session: parts[1] } : { page: 'journal' };
    }
    if (parts[0] === 'settings') {
        const sub = SETTINGS_SUBS.find(x => x === parts[1]);
        return sub ? { page: 'settings', sub } : { page: 'settings' };
    }
    return { page: 'home' };
}

export function href(r: Route): string {
    switch (r.page) {
        case 'substance':
            return `/s/${encodeURIComponent(r.id)}`;
        case 'mix':
            return r.ids.length ? `/mix/${r.ids.map(encodeURIComponent).join('+')}` : '/mix';
        case 'kind':
            return `/kind/${encodeURIComponent(r.category)}`;
        case 'settings':
            return r.sub ? `/settings/${r.sub}` : '/settings';
        case 'journal':
            return r.view === 'stats'
                ? '/journal/stats'
                : r.substance
                  ? `/journal/substance/${encodeURIComponent(r.substance)}`
                  : r.session
                    ? `/journal/${encodeURIComponent(r.session)}`
                    : '/journal';
        case 'browse':
        case 'saved':
            return `/${r.page}`;
        default:
            return '/';
    }
}

