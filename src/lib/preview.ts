import {
    CATEGORIES,
    categoryInfo,
    describe,
    nameOf,
    squash,
    type ComboStatus,
    type Detail,
    type DoseRow,
    type IndexEntry,
} from './data';
import { dataText, isZh, phraseList, roaName, tr } from './i18n';
import { RANK, VERDICT, type Verdict } from './mix';
import { formatSpan, parseSpan } from './time';

/* What a link to each page says about itself when it's shared: the title,
   the line under it and the picture, as a chat app or a search engine shows
   them. The Worker (worker/index.ts) writes these into the HTML it serves;
   the picture cards (scripts/og/render.mjs) are drawn from the same facts.

   The title is the page's own name and nothing else ("LSD"); the facts go
   in the line under it, short, in the language the visitor's browser asked
   for: the Worker settles that before it words any of this (lib/i18n.ts).
   The picture cards are drawn in English, as the catalogue writes the
   names. */

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
        description: tr('{0}, for {1} psychoactive substances. Log what you take, on your device only. No sign-up.', {
            0: tagline(),
            1: count ? thousands(count) : '3,000',
        }),
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

/** What kind of drug it is, as a short phrase: "A psychedelic in the lysergamide family". */
export function kindLine(d: Pick<Detail, 'category' | 'chemicalClass'>, entry?: IndexEntry): string {
    return describe({ category: d.category, chemicalClass: d.chemicalClass ?? entry?.chemicalClass ?? '' }).replace(/\.$/, '');
}

export function substancePreview(d: Detail, entry?: IndexEntry): Preview {
    const { roa, dose } = primaryRoute(d);
    const total = totalTime(d, roa);
    // Chinese keeps each name as the catalogue writes it, in its own case.
    const avoid = avoidList(d, 3).map(s => (isZh() ? dataText(s) : s.toLowerCase()));
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
    return {
        title: nameOf(d),
        description: parts.join(' '),
        image: `/og/s/${encodeURIComponent(d.id)}.png`,
        imageAlt: d.name,
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
        title: who,
        description: `${tr(v.label)}${tr('. ')}${tr(v.meaning)}${note ? ` ${dataText(note)}` : ''}`,
        image: verdictCard(verdict),
        imageAlt: `${who}: ${v.label.toLowerCase()}`,
    };
}

export function kindPreview(category: string, count: number): Preview {
    const info = categoryInfo(category);
    return {
        title: tr(info.plural),
        description: tr('{0}. All {1}, A to Z, each with its doses, durations and what not to mix.', { 0: tr(info.blurb), 1: count }),
        image: '/og/site.png',
        imageAlt: info.plural,
    };
}

export function pagePreview(page: 'browse' | 'saved' | 'settings' | 'journal', count?: number): Preview {
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
    if (page === 'saved') return { ...base, title: tr('Saved') };
    return { ...base, title: tr('Settings') };
}
