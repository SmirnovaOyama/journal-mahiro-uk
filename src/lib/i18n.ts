/* The site's words in one of its languages: English, as written in the
   code, or 正體中文 from lib/zh-Hant.ts, which is keyed by the English.

       tr('Save')                              "儲存"
       tr('{0} doses', { 0: 3 })               "3 次用藥"

   A line with no translation stays in English, so a new one can be written
   first and translated after (scripts/check-i18n.mjs lists the ones still
   missing). Nothing here touches the page or storage: the Worker reads
   lib/data.ts and lib/mix.ts too, and for it the language is always
   English. Choosing and remembering a language is lib/lang.ts. */

export type Lang = 'en' | 'zh-Hant';

let lang: Lang = 'en';
let dict: Record<string, string> | null = null;

/** The catalogue's own words (lib/zh-Hant-data.ts), keyed loosely. */
let data: Map<string, string> | null = null;

/** A line as the catalogue's words are keyed: case, hyphens, doubled
 *  spaces, a leading "Note:" and a final full stop don't count. */
const loose = (s: string) =>
    s
        .replace(/^\s*note:\s*/i, '')
        .replace(/[-‐–]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.。]$/, '')
        .toLowerCase();

/** Sets the language to speak, with its words (none for English) and the catalogue's. */
export function speak(next: Lang, words: Record<string, string> | null, catalogue?: Record<string, string> | null) {
    lang = next;
    dict = words;
    data = catalogue ? new Map(Object.entries(catalogue).map(([k, v]) => [loose(k), v])) : null;
}

/** A phrase from the catalogue (an effect, an interaction's note, a family,
 *  a note on doses) in the reader's language: whole, or each part of a
 *  list ("Stimulants, Nootropic"), or a span of time. What has no
 *  正體中文 stays as its source wrote it. */
export function dataText(raw: string): string {
    if (lang === 'en' || !raw || !data) return raw;
    const whole = data.get(loose(raw));
    if (whole) return whole;
    if (/[,;]/.test(raw)) {
        const out = raw.split(/\s*[,;]\s*/).filter(Boolean).map(p => data!.get(loose(p)));
        if (out.every(Boolean)) return out.join('、');
    }
    return /\d/.test(raw) ? spanText(raw) : raw;
}

export const currentLang = () => lang;
export const isZh = () => lang === 'zh-Hant';

/** A line in the current language, with each {name} filled in. `sense`
 *  tells apart two uses of one English word that part ways in another
 *  language ("Light", the dose and the theme): its line is "Light|theme". */
export function tr(text: string, vars?: Record<string, string | number>, sense?: string): string {
    const s = (dict && ((sense && dict[`${text}|${sense}`]) || dict[text])) || text;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** The locale dates and clock times are written in. */
export const dateLocale = () => (lang === 'zh-Hant' ? 'zh-TW' : 'en-GB');

/** A list as a phrase: "a, b and c", "a、b 和 c". */
export function phraseList(xs: string[], last: 'and' | 'or' = 'and'): string {
    if (xs.length < 2) return xs.join('');
    const word = tr(last === 'and' ? ' and ' : ' or ');
    return `${xs.slice(0, -1).join(tr(', '))}${word}${xs[xs.length - 1]}`;
}

/* ── words that come from the data ──────────────────────────────────────
   The catalogue is in English (PsychonautWiki, TripSit, Wikidata). Its
   prose stays as its sources wrote it; the small fixed vocabularies it
   uses (routes, units of time) are put in the reader's language here. */

/** A route as the data names it ("Insufflated", "Intramuscular / SubQ"). */
export function roaName(roa: string): string {
    if (lang === 'en' || !roa) return roa;
    if (dict?.[roa]) return dict[roa];
    // "Transdermal (μg/day)", "Intramuscular / SubQ": each part on its own.
    return roa
        .split(/(\s*\/\s*|\s*\(|\)|,\s*)/)
        .map(p => dict?.[p.trim()] ?? p)
        .join('');
}

/** A span of time as the data writes it ("15–30 min", "4–24+ h", "1 - 2 weeks"). */
export function spanText(raw: string): string {
    if (lang === 'en' || !raw) return raw;
    return raw.replace(/(\d\+?)\s*(seconds?|sec|s|minutes?|min|hours?|h|days?|d|weeks?|months?|years?)\b/gi, (_, n: string, u: string) => {
        const k = u.toLowerCase();
        const unit = /^s/.test(k)
            ? '秒'
            : /^mi/.test(k)
              ? '分鐘'
              : /^h/.test(k)
                ? '小時'
                : /^d/.test(k)
                  ? '天'
                  : /^w/.test(k)
                    ? '週'
                    : /^mo/.test(k)
                      ? '個月'
                      : '年';
        return `${n} ${unit}`;
    });
}
