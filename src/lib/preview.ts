import {
    CATEGORIES,
    categoryInfo,
    describe,
    squash,
    type ComboStatus,
    type Detail,
    type DoseRow,
    type IndexEntry,
} from './data';
import { RANK, VERDICT, type Verdict } from './mix';
import { formatSpan, parseSpan } from './time';

/* What a link to each page says about itself when it's shared: the title,
   the line under it and the picture, as a chat app or a search engine shows
   them. The Worker (worker/index.ts) writes these into the HTML it serves;
   the picture cards (scripts/og/render.mjs) are drawn from the same facts.

   The title is the page's own name and nothing else ("LSD"); the facts go
   in the line under it, in English, short. */

export const SITE = {
    name: 'Oyama Journal',
    host: 'journal.mahiro.uk',
    origin: 'https://journal.mahiro.uk',
    tagline: 'Doses, durations and what not to mix',
};

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
        title: SITE.name,
        description: `${SITE.tagline}, for ${count ? thousands(count) : '3,000'} psychoactive substances. Log what you take, on your device only. No sign-up.`,
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

/** "a, b or c" */
const orList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

/** What kind of drug it is, as a short phrase: "A psychedelic in the lysergamide family". */
export function kindLine(d: Pick<Detail, 'category' | 'chemicalClass'>, entry?: IndexEntry): string {
    return describe({ category: d.category, chemicalClass: d.chemicalClass ?? entry?.chemicalClass ?? '' }).replace(/\.$/, '');
}

export function substancePreview(d: Detail, entry?: IndexEntry): Preview {
    const { roa, dose } = primaryRoute(d);
    const total = totalTime(d, roa);
    const avoid = avoidList(d, 3).map(s => s.toLowerCase());
    const parts = [`${kindLine(d, entry)}.`];
    if (dose?.common) parts.push(`Common dose ${dose.common}${roa ? ` ${roa.toLowerCase()}` : ''}${total ? `, lasting ${total}` : ''}.`);
    else if (total) parts.push(`Lasts ${total}.`);
    if (avoid.length) parts.push(`Don’t mix with ${orList(avoid)}.`);
    if (d.status === 'Limited data') parts.push('Little is known about it: take extra care with any amount.');
    return {
        title: d.name,
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
            title: 'Mix',
            description: 'Add everything you plan to take together, alcohol and medicines included, to see whether the mix is safe.',
            image: verdictCard('Unknown'),
            imageAlt: 'Mix checker',
        };
    }
    const v = VERDICT[verdict];
    const who = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return {
        title: who,
        description: `${v.label}. ${v.meaning}${note ? ` ${note}` : ''}`,
        image: verdictCard(verdict),
        imageAlt: `${who}: ${v.label.toLowerCase()}`,
    };
}

export function kindPreview(category: string, count: number): Preview {
    const info = categoryInfo(category);
    return {
        title: info.plural,
        description: `${info.blurb}. All ${count}, A to Z, each with its doses, durations and what not to mix.`,
        image: '/og/site.png',
        imageAlt: info.plural,
    };
}

export function pagePreview(page: 'browse' | 'saved' | 'settings' | 'journal', count?: number): Preview {
    const base = sitePreview(count);
    if (page === 'browse')
        return {
            ...base,
            title: 'Browse',
            description: `${CATEGORIES.map(c => c.plural.toLowerCase()).join(', ')}: every kind of drug, A to Z.`,
        };
    if (page === 'journal')
        return {
            ...base,
            title: 'Journal',
            description: 'Log what you take and when. Kept on your device only, never uploaded.',
        };
    if (page === 'saved') return { ...base, title: 'Saved' };
    return { ...base, title: 'Settings' };
}
