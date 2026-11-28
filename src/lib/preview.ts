import {
    CATEGORIES,
    categoryInfo,
    describe,
    nameOf,
    resolveName,
    squash,
    type ComboStatus,
    type Detail,
    type DoseRow,
    type IndexEntry,
} from './data';
import { currentLang, dataText, dataWhole, isZh, phraseList, roaName, spaced, termText, tr } from './i18n';
import { RANK, VERDICT, type Verdict } from './mix';
import { formatSpan, parseSpan } from './time';
import { XUNXUN_ID, xunxunName, xunxunWhat } from './xunxun';

/* What a link to each page says about itself when it's shared: the title,
   the line under it and the picture, as a chat app or a search engine shows
   them. The Worker (worker/index.ts) writes these into the HTML it serves;
   the picture cards (scripts/og/render.mjs) are drawn from the same facts.

   The title is the page's own name and nothing else ("LSD"); the facts go
   in the line under it, short, in the language the visitor's browser asked
   for: the Worker settles that before it words any of this (lib/i18n.ts).
   The picture cards are drawn in English, as the catalogue writes the
   names, in Inter and Source Han Sans (scripts/og/fonts), which is not the
   face the site itself is read in: that is the reader's system's. */

export const SITE = {
    name: 'Oyama Journal',
    host: 'journal.mahiro.uk',
    origin: 'https://journal.mahiro.uk',
    tagline: 'Doses, durations and what not to mix',
};

/** The site's name and its line, in the visitor's language. */
const siteName = () => tr('Oyama Journal');
const tagline = () => tr(SITE.tagline);

export interface Preview {
    title: string;
    description: string;
    /** The card, as a path on this site. */
    image: string;
    imageAlt: string;
}

const thousands = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000).toLocaleString('en')},${String(n % 1000).padStart(3, '0')}` : String(n));

export function sitePreview(count?: number): Preview {
    return {
        title: siteName(),
        description: spaced(
            tr('{0}, for {1} psychoactive substances. Log what you take, on your device only. No sign-up.', {
                0: tagline(),
                1: count ? thousands(count) : '3,000',
            }),
        ),
        image: '/og/site.png',
        imageAlt: `${SITE.name}: ${SITE.tagline.toLowerCase()}`,
    };
}

/** The route a substance's numbers are given for first, and its dose row. */
export function primaryRoute(d: Detail): { roa?: string; dose?: DoseRow } {
    const dose = d.doseRows[0];
    return { roa: dose?.roa ?? d.durationRows[0]?.roa, dose };
}

/** The names it must never be mixed with, most-documented first, one each. */
export function avoidList(d: Detail, max = 4): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const bad = d.combinations
        .filter(c => c.status === 'Dangerous' || c.status === 'Unsafe')
        .sort((a, b) => RANK[b.status as ComboStatus] - RANK[a.status as ComboStatus]);
    for (const c of bad) {
        const k = squash(c.substance);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(c.substance);
        if (out.length >= max) break;
    }
    return out;
}

export function totalTime(d: Detail, roa?: string): string | undefined {
    const row = d.durationRows.find(r => r.roa === roa) ?? d.durationRows[0];
    const span = parseSpan(row?.total);
    return span ? formatSpan(span) : undefined;
}

/** "a, b or c", "a、b 或 c" */
const orList = (xs: string[]) => phraseList(xs, 'or');

/** What kind of drug it is, as a short phrase: "A psychedelic in the
 *  lysergamide family". One the catalogue files under no kind is said as its
 *  article's infobox says it, where it does ("Nonsteroidal anti-inflammatory
 *  drug (NSAID)" for aspirin, not "A substance"): the first of the kinds
 *  listed there, as its page gives them under How it works. In Chinese only
 *  where all of it has been put into Chinese (a code such as 5-HT1A aside):
 *  half a phrase in English is no better than "物質". */
export function kindLine(d: Pick<Detail, 'category' | 'chemicalClass' | 'pharmacology'>, entry?: IndexEntry): string {
    const said = d.category === 'Other' ? termText(d.pharmacology?.kind?.split(';')[0].trim() ?? '') : '';
    if (said && !(isZh() && /[a-z]{3}/.test(said))) return said;
    return describe({ category: d.category, chemicalClass: d.chemicalClass ?? entry?.chemicalClass ?? '' }).replace(/[.。]$/, '');
}

/** The start of a passage, no longer than `max` letters: whole sentences
 *  where one ends in time, else cut at a word and closed with an ellipsis. */
export function opening(text: string, max: number): string {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    let end = -1;
    // A full stop ends a sentence before a space and a capital; "3.54 nM" and "5-HT2A" don't.
    for (const m of t.slice(0, max + 1).matchAll(/[.!?](?=\s+[A-Z0-9(“"α-ω])|[。！？]/g)) if (m.index < max) end = m.index;
    if (end >= max * 0.4) return t.slice(0, end + 1);
    const cut = t.slice(0, max - 1);
    return `${/[\u3400-\u9fff]/.test(cut) ? cut : cut.replace(/[\s,;:(–-]+[^\s]*$/, '')}…`;
}

/** A passage that says something of the substance: not a line that only
 *  restates its kind ("X is a documented other compound on PsychonautWiki"),
 *  nor one the sync cut in mid-sentence ("2 nM at CB2 as the active…"). */
const saysSomething = (text?: string): text is string =>
    !!text &&
    text.length >= 12 &&
    !/ is a documented [\w\s-]*(?:compound|substance)(?: on PsychonautWiki)?\.?$| substance belonging to the .+ chemical class\.?$/.test(text) &&
    !/^[a-z]+[\s.,]|^[\d.,]+\s?(?:%|x\b|[nμµm]M\b|mg\b)|^\d+, /.test(text);

/** What the sources say it is, as its page opens: in Chinese its
 *  zh.wikipedia opening in the writing being read, else the English
 *  sources' summary, else the opening of how it works or what it's used
 *  for. Only what a source wrote: what an AI wrote for a page is shown
 *  there with a line saying so, and a shared link has no room for that
 *  line, so it stays on the page. */
function whatItIs(d: Detail): string {
    const zh = isZh() ? (currentLang() === 'zh-Hans' ? d.summaryZhHans ?? d.summaryZh : d.summaryZh) || dataWhole(d.summary) : '';
    return [zh, d.summary, d.pharmacology?.text, d.uses?.text].find(saysSomething) ?? '';
}

/* How long the line under a card may run before an app cuts it, in
   letters; a Chinese character takes the room of two. */
const LINE = 220;
const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
const widthOf = (s: string) => [...s].reduce((n, c) => n + (CJK.test(c) ? 2 : 1), 0);

export function substancePreview(d: Detail, entry?: IndexEntry, index?: IndexEntry[]): Preview {
    const { roa, dose } = primaryRoute(d);
    const total = totalTime(d, roa);
    /* What not to mix it with: each under the name the catalogue has for it
       in the reader's language ("酒精"), or, for a group the catalogue has no
       entry for ("MAOIs"), the one lib/zh-Hant-data.ts gives. */
    const avoid = avoidList(d, 3).map(s => {
        if (!isZh()) return s.toLowerCase();
        const found = index && resolveName(index, s);
        return found ? nameOf(found) : dataText(s);
    });
    const parts = [tr('{0}.', { 0: kindLine(d, entry) })];
    const way = roa ? (isZh() ? roaName(roa) : roa.toLowerCase()) : '';
    if (dose?.common)
        parts.push(
            total
                ? tr('Common dose {0}{1}, lasting {2}.', { 0: dose.common, 1: way ? tr(' {0}', { 0: way }) : '', 2: total })
                : tr('Common dose {0}{1}.', { 0: dose.common, 1: way ? tr(' {0}', { 0: way }) : '' }),
        );
    else if (total) parts.push(tr('Lasts {0}.', { 0: total }));
    if (avoid.length) parts.push(tr('Don’t mix with {0}.', { 0: orList(avoid) }));
    if (d.status === 'Limited data') parts.push(tr('Little is known about it: take extra care with any amount.'));
    /* Four in five of the catalogue have no dose and no duration to give:
       Wikidata's entries, which say what a thing is and nothing of how much.
       Their line says that, as their page opens, in the room the rest leaves. */
    if (!dose?.common && !total) {
        const room = LINE - widthOf(parts.join(' ')) - 1;
        const says = room >= 60 ? whatItIs(d) : '';
        if (says) parts.splice(1, 0, opening(says, CJK.test(says) ? Math.floor(room / 2) : room));
    }
    return {
        title: nameOf(d),
        description: spaced(parts.join(' ')),
        image: substanceCard(d.id),
        imageAlt: d.name,
    };
}

/** A substance's card. The number is the cards' drawing: raise it when they
 *  are redrawn, so an app that kept the old picture fetches the new one. */
export const substanceCard = (id: string, variant = '') => `/og/s/${encodeURIComponent(id)}${variant}.png?v=3`;

/** 寻寻's page (lib/xunxun.ts), shared as a substance's is: its name, the
 *  line that says what it is, and its own card with its picture where a
 *  structure is drawn. One language to a reader, as its page: the card is
 *  drawn once in each (scripts/og/render.mjs). */
export function xunxunPreview(): Preview {
    return {
        title: xunxunName(),
        description: xunxunWhat(),
        image: substanceCard(XUNXUN_ID, isZh() ? '.zh' : ''),
        imageAlt: xunxunName(),
    };
}

/** The verdict card for a mix: the cards are drawn one per verdict. */
export const verdictCard = (v: Verdict) => `/og/mix/${v.toLowerCase().replace(/\s+/g, '-')}.png`;

export function mixPreview(names: string[], verdict?: Verdict, note?: string): Preview {
    if (names.length < 2 || !verdict) {
        return {
            title: tr('Mix'),
            description: tr('What are the risks of taking these together? Add everything you plan to take, alcohol and medicines included.'),
            image: verdictCard('Unknown'),
            imageAlt: 'Mix checker',
        };
    }
    const v = VERDICT[verdict];
    const who = phraseList(names);
    return {
        title: spaced(who),
        description: spaced(`${tr(v.label)}${tr('. ')}${tr(v.meaning)}${note ? ` ${dataText(note)}` : ''}`),
        image: verdictCard(verdict),
        imageAlt: `${who}: ${v.label.toLowerCase()}`,
    };
}

export function kindPreview(category: string, count: number): Preview {
    const info = categoryInfo(category);
    return {
        title: tr(info.plural),
        description: spaced(tr('{0}. All {1}, A to Z, with doses, durations and combinations to avoid.', { 0: tr(info.blurb), 1: count })),
        image: '/og/site.png',
        imageAlt: info.plural,
    };
}

/** The essay under Settings, About: a page of its own to share. */
export function essayPreview(count?: number): Preview {
    return {
        ...sitePreview(count),
        title: tr('A Borrowed Spring'),
        description: tr('An essay on using, in four seasons: spring wind, cherry blossom, cicada song and autumn leaves.'),
    };
}

export function pagePreview(page: 'browse' | 'saved' | 'settings' | 'journal' | 'emergency', count?: number): Preview {
    const base = sitePreview(count);
    if (page === 'browse')
        return {
            ...base,
            title: tr('Browse'),
            description: tr('{0}: every kind of drug, A to Z.', {
                0: CATEGORIES.map(c => (isZh() ? tr(c.plural) : c.plural.toLowerCase())).join(tr(', ')),
            }),
        };
    if (page === 'journal')
        return {
            ...base,
            title: tr('Journal'),
            description: tr('Log what you take and when. Kept on your device, and synced encrypted if you want.'),
        };
    if (page === 'emergency')
        return {
            ...base,
            title: tr('In an emergency'),
            description: tr('What to do until help arrives: when to call, which number, the recovery position, and warning signs by type of drug.'),
        };
    if (page === 'saved') return { ...base, title: tr('Saved') };
    return { ...base, title: tr('Settings') };
}
