import { useSyncExternalStore } from 'react';
import { speak, type Lang } from './i18n';

/* Which language the site speaks on this device: the one chosen in
   Settings, or else the browser's. The choice is kept in this browser, like
   the theme. 正體中文's words are fetched only when it's the one in use. */

/** What the visitor picked in Settings: a language, or to follow the browser. */
export type LangChoice = Lang | 'system';

const KEY = 'journal.lang.v1';

/** Each language under its own name, whichever one the page is in. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', 'zh-Hant': '正體中文' };

function readChoice(): LangChoice {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
        return raw === 'en' || raw === 'zh-Hant' ? raw : 'system';
    } catch {
        return 'system';
    }
}

/** The first of the browser's languages the site has. Any Chinese gets
 *  正體中文: it is the only Chinese here, and nearer than English. */
function systemLang(): Lang {
    const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const p of prefs) {
        if (/^zh\b/i.test(p)) return 'zh-Hant';
        if (/^en\b/i.test(p)) return 'en';
    }
    return 'en';
}

/** The page's language tag, which picks the Chinese typeface (index.css):
 *  Hong Kong's and Macau's forms for readers there, Taiwan's otherwise. */
function pageTag(l: Lang): string {
    if (l === 'en') return 'en';
    const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
    return prefs.some(p => /^zh\b.*-(HK|MO)\b/i.test(p)) ? 'zh-Hant-HK' : 'zh-Hant';
}

let choice: LangChoice = readChoice();
let lang: Lang = 'en';
let snap = `${choice}|${lang}`;
const subs = new Set<() => void>();

let words: Record<string, string> | null = null;
let catalogue: Record<string, string> | null = null;
let vocabulary: [string, string][] | null = null;
async function wordsFor(l: Lang): Promise<Record<string, string> | null> {
    if (l === 'en') return null;
    if (!words) {
        const [w, c] = await Promise.all([import('./zh-Hant'), import('./zh-Hant-data')]);
        words = w.default;
        catalogue = c.default;
        vocabulary = c.terms;
    }
    return words;
}

async function apply() {
    const next = choice === 'system' ? systemLang() : choice;
    let w: Record<string, string> | null = null;
    try {
        w = await wordsFor(next);
    } catch {
        // Offline before its words were ever fetched: the page stays as it is.
        if (next !== 'en') return;
    }
    lang = next;
    speak(lang, w, w ? catalogue : null, w ? vocabulary : null);
    document.documentElement.lang = pageTag(lang);
    snap = `${choice}|${lang}`;
    subs.forEach(f => f());
}

/** Settles the language before the first page is drawn. */
export const initLang = () => apply();

export async function setLangChoice(next: LangChoice) {
    choice = next;
    try {
        if (next === 'system') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* private mode or full: it lasts until the page is closed */
    }
    await apply();
}

function subscribe(f: () => void) {
    subs.add(f);
    return () => {
        subs.delete(f);
    };
}

/** The language in use and the choice behind it. The app is drawn again
 *  from the top when the language changes (App.tsx). */
export function useLang() {
    const s = useSyncExternalStore(subscribe, () => snap);
    const [c, l] = s.split('|') as [LangChoice, Lang];
    return { lang: l, choice: c, setChoice: setLangChoice };
}
