/* The site's pages and their paths, with nothing that touches the browser,
   so the Worker (worker/index.ts) reads paths exactly as the app does. */

/** The language an address asks to be shared in: /s/lsd?lang=zh-Hans. A chat
 *  app that fetches a link to preview it seldom says what its reader speaks,
 *  and is answered in English; with this, whoever shares the link says. The
 *  site's own names for its languages, the tags a browser would send, and
 *  cn, tw and hk for short. `tag` is the page's language tag, which picks
 *  the Chinese typeface; `param` is how the address is written back. */
export function addressLang(value: string | null | undefined): { lang: 'en' | 'zh-Hant' | 'zh-Hans'; tag: string; param: string } | null {
    const v = (value ?? '').trim().toLowerCase().replace(/_/g, '-');
    if (!v) return null;
    if (/^en(-|$)/.test(v)) return { lang: 'en', tag: 'en', param: 'en' };
    if (/^(hk|mo)$|^zh(-hant)?-(hk|mo)$/.test(v)) return { lang: 'zh-Hant', tag: 'zh-Hant-HK', param: 'zh-HK' };
    if (/^(tw|hant)$|^zh-(hant|tw)(-|$)/.test(v)) return { lang: 'zh-Hant', tag: 'zh-Hant', param: 'zh-Hant' };
    // Chinese that says nothing of where is 简体中文, as on the device (lib/lang.ts).
    if (/^(cn|hans|zh)$|^zh-(hans|cn|sg|my)(-|$)/.test(v)) return { lang: 'zh-Hans', tag: 'zh-Hans', param: 'zh-Hans' };
    return null;
}

export type Route =
    | { page: 'home' }
    | { page: 'substance'; id: string }
    | { page: 'report'; id: string }
    | { page: 'mix'; ids: string[] }
    | { page: 'kind'; category: string }
    | { page: 'browse' }
    | { page: 'saved' }
    | { page: 'emergency' }
    /** The session going on, on one calm screen. */
    | { page: 'now' }
    /** Someone else's session, shared with a link: the key that opens it is
     *  after the #, which no server is sent. */
    | { page: 'watch'; id: string }
    /** The dose form, filled in from the address: /log/caffeine/100mg/oral.
     *  Nothing is logged until Log it is pressed. */
    | { page: 'log'; id?: string; dose?: number; unit?: string; route?: string }
    | { page: 'journal'; session?: string; view?: 'stats' | 'weight'; substance?: string }
    | { page: 'settings'; sub?: SettingsSub };

/** Settings' own pages: its three groups, the pages a row opens, and the
 *  account's. */
export type SettingsSub =
    | 'general'
    | 'data'
    | 'about'
    | 'appearance'
    | 'language'
    | 'weight'
    | 'medicines'
    | 'privacy'
    | 'features'
    | 'disclaimer'
    | 'essay'
    | 'credits'
    | 'account'
    | 'password'
    | 'recovery-key'
    | 'devices'
    | 'delete-account'
    | 'recover'
    | 'sync'
    | 'security'
    | 'two-factor'
    | 'admin'
    | 'admin-overview'
    | 'admin-accounts';
const SETTINGS_SUBS: readonly SettingsSub[] = [
    'general',
    'data',
    'about',
    'appearance',
    'language',
    'weight',
    'medicines',
    'privacy',
    'features',
    'disclaimer',
    'essay',
    'credits',
    'account',
    'password',
    'recovery-key',
    'devices',
    'delete-account',
    'recover',
    'sync',
    'security',
    'two-factor',
    'admin',
    'admin-overview',
    'admin-accounts',
];

export function parse(path: string): Route {
    const parts = path.replace(/^[#/]+/, '').split('/').map(decodeURIComponent);
    if (parts[0] === 's' && parts[1]) return { page: 'substance', id: parts[1].toLowerCase() };
    if (parts[0] === 'report' && parts[1]) return { page: 'report', id: parts[1].toLowerCase() };
    if (parts[0] === 'mix') return { page: 'mix', ids: (parts[1] || '').split('+').filter(Boolean) };
    if (parts[0] === 'kind' && parts[1]) return { page: 'kind', category: parts[1] };
    if (parts[0] === 'browse') return { page: 'browse' };
    if (parts[0] === 'saved') return { page: 'saved' };
    if (parts[0] === 'emergency') return { page: 'emergency' };
    if (parts[0] === 'now') return { page: 'now' };
    if (parts[0] === 'watch' && parts[1]) return { page: 'watch', id: parts[1] };
    if (parts[0] === 'log') {
        if (!parts[1]) return { page: 'log' };
        const m = (parts[2] ?? '').match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        const dose = m ? Number(m[1]) : NaN;
        const route = (parts[3] ?? '').trim();
        return {
            page: 'log',
            id: parts[1].toLowerCase(),
            ...(Number.isFinite(dose) ? { dose, ...(m![2] ? { unit: m![2] } : {}) } : {}),
            ...(route ? { route: route.charAt(0).toUpperCase() + route.slice(1) } : {}),
        };
    }
    if (parts[0] === 'journal') {
        if (parts[1] === 'stats') return { page: 'journal', view: 'stats' };
        if (parts[1] === 'weight') return { page: 'journal', view: 'weight' };
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
        case 'report':
            return `/report/${encodeURIComponent(r.id)}`;
        case 'mix':
            return r.ids.length ? `/mix/${r.ids.map(encodeURIComponent).join('+')}` : '/mix';
        case 'kind':
            return `/kind/${encodeURIComponent(r.category)}`;
        case 'settings':
            return r.sub ? `/settings/${r.sub}` : '/settings';
        case 'journal':
            return r.view
                ? `/journal/${r.view}`
                : r.substance
                  ? `/journal/substance/${encodeURIComponent(r.substance)}`
                  : r.session
                    ? `/journal/${encodeURIComponent(r.session)}`
                    : '/journal';
        case 'watch':
            return `/watch/${encodeURIComponent(r.id)}`;
        case 'log': {
            if (!r.id) return '/log';
            const amount = r.dose != null ? `/${encodeURIComponent(`${r.dose}${r.unit ?? ''}`)}` : '';
            // A route only after an amount: the amount's place can't be left empty.
            return `/log/${encodeURIComponent(r.id)}${amount}${amount && r.route ? `/${encodeURIComponent(r.route.toLowerCase())}` : ''}`;
        }
        case 'browse':
        case 'saved':
        case 'emergency':
        case 'now':
            return `/${r.page}`;
        default:
            return '/';
    }
}

