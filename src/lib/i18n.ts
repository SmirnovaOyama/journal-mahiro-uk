/* The site's words in one of its languages: English, as written in the
   code, or 正體中文 from lib/zh-Hant.ts and 简体中文 from lib/zh-Hans.ts,
   both keyed by the English.

       tr('Save')                              "儲存"
       tr('{0} doses', { 0: 3 })               "3 次用藥"

   A line with no translation stays in English, so a new one can be written
   first and translated after (scripts/check-i18n.mjs lists the ones still
   missing). Nothing here touches the page or storage: the Worker reads
   lib/data.ts and lib/mix.ts too, and for it the language is always
   English. Choosing and remembering a language is lib/lang.ts. */

export type Lang = 'en' | 'zh-Hant' | 'zh-Hans';

let lang: Lang = 'en';
let dict: Record<string, string> | null = null;

/** The catalogue's own words (lib/zh-Hant-data.ts or lib/zh-Hans-data.ts),
 *  keyed loosely. */
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

/** The words an infobox phrase is put into Chinese with, longest first
 *  (lib/zh-Hant-data.ts). */
let terms: [RegExp, string][] | null = null;

/** Sets the language to speak, with its words (none for English), the
 *  catalogue's, and the words an infobox phrase is taken apart with. */
export function speak(
    next: Lang,
    words: Record<string, string> | null,
    catalogue?: Record<string, string> | null,
    vocabulary?: [string, string][] | null,
) {
    lang = next;
    dict = words;
    data = catalogue ? new Map(Object.entries(catalogue).map(([k, v]) => [loose(k), v])) : null;
    terms = vocabulary
        ? [...vocabulary]
              .sort((a, b) => b[0].length - a[0].length)
              .map(([en, zh]) => [new RegExp(`(^|[^A-Za-z])${en.replace(/[-\s]/g, '[-\\s]')}(s|es)?(?![A-Za-z])`, 'gi'), zh])
        : null;
}

/** An infobox phrase word by word: "Serotonin 5-HT2A receptor agonist"
 *  becomes "血清素 5-HT2A 受體促效劑", and whatever has no word here stays
 *  in English. Nothing is translated unless at least one word was. */
export function termText(raw: string): string {
    if (lang === 'en' || !raw || !terms) return raw;
    // A phrase the catalogue's own words already have, whole or as a list.
    const whole = data?.get(loose(raw));
    if (whole) return whole;
    let out = raw;
    let hit = false;
    for (const [re, zh] of terms) {
        out = out.replace(re, (_m, before: string) => {
            hit = true;
            return `${before}${zh}`;
        });
    }
    // "3–7 hours" inside it reads as a span of time either way.
    const timed = spanText(out);
    if (timed !== out) {
        out = timed;
        hit = true;
    }
    if (!hit) return raw;
    // Chinese punctuation, and no space where the English left one between
    // two words that are now both Chinese ("受體 拮抗劑"). A phrase that
    // names its parts ("Common: Oral") keeps its spaces: they hold it apart.
    const named = out.includes(':');
    return spaced(
        (named ? out : out.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1'))
            .replace(/;\s*/g, '；')
            .replace(/:\s*/g, '：')
            .replace(/,\s*(?=[\u3400-\u9fff])/g, '、')
            .replace(/\s{2,}/g, ' ')
            .trim(),
    );
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

/** A whole line of the catalogue's in the reader's language, or '' where
 *  its words have none: for a passage written by hand in English (a
 *  summary), which mustn't be taken apart a phrase at a time. */
export function dataWhole(raw: string): string {
    if (lang === 'en' || !raw || !data) return '';
    return data.get(loose(raw)) ?? '';
}

export const currentLang = () => lang;
export const isZh = () => lang === 'zh-Hant' || lang === 'zh-Hans';

/** A line in the current language, with each {name} filled in. `sense`
 *  tells apart two uses of one English word that part ways in another
 *  language ("Light", the dose and the theme): its line is "Light|theme". */
export function tr(text: string, vars?: Record<string, string | number>, sense?: string): string {
    const s = (dict && ((sense && dict[`${text}|${sense}`]) || dict[text])) || text;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** A line with a space where Chinese meets Latin letters or digits, as the
 *  site's Chinese is set ("不要與 GBL 混用"). Nothing is added inside a
 *  word, or next to full-width punctuation, which carries its own space. */
export function spaced(text: string): string {
    if (lang === 'en') return text;
    return text
        .replace(/([\u3400-\u9fff])([A-Za-z0-9(])/g, '$1 $2')
        .replace(/([A-Za-z0-9)%])([\u3400-\u9fff])/g, '$1 $2');
}

/** The locale dates and clock times are written in. */
export const dateLocale = () => (lang === 'zh-Hant' ? 'zh-TW' : lang === 'zh-Hans' ? 'zh-CN' : 'en-GB');

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

/** The units of time, in each writing: 正體中文 first, 简体中文 second. */
const UNITS: Record<string, [string, string]> = {
    s: ['秒', '秒'],
    mi: ['分鐘', '分钟'],
    h: ['小時', '小时'],
    d: ['天', '天'],
    w: ['週', '周'],
    mo: ['個月', '个月'],
    y: ['年', '年'],
};

/** A span of time as the data writes it ("15–30 min", "4–24+ h", "1 - 2 weeks"). */
export function spanText(raw: string): string {
    if (lang === 'en' || !raw) return raw;
    const k = lang === 'zh-Hans' ? 1 : 0;
    return raw.replace(/(\d\+?)\s*(seconds?|sec|s|minutes?|min|hours?|h|days?|d|weeks?|months?|years?)\b/gi, (_, n: string, u: string) => {
        const w = u.toLowerCase();
        // "mo" before "mi" before "m" is why these are tested in this order.
        const key = /^s/.test(w) ? 's' : /^mi/.test(w) ? 'mi' : /^h/.test(w) ? 'h' : /^d/.test(w) ? 'd' : /^w/.test(w) ? 'w' : /^mo/.test(w) ? 'mo' : 'y';
        return `${n} ${UNITS[key][k]}`;
    });
}
