import React from 'react';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { rowBleed, settingsSection } from '../components/SettingsListItem';
import { External } from '../components/icons';
import { tr } from '../lib/i18n';

/* Who and what the site is made of, opened from Settings, About, and laid
   out as hrt.mahiro.uk lays its own out (pages/Credits.tsx there): a list
   written into the page, so opening it asks GitHub, or anyone else, nothing.
   Names stay as their owners write them; what each one gave is said in the
   reader's language. */

export const REPO = 'https://github.com/SmirnovaOyama/journal-mahiro-uk';
const AUTHOR = { name: 'Smirnova', login: 'SmirnovaOyama' };

const muted = 'text-[var(--text-muted)]';
const row = `w-full min-h-14 flex items-center justify-between gap-4 py-3.5 text-start no-underline ${rowBleed}`;

/** The site's author: the picture, the name, and the way to their GitHub.
 *
 *  The picture (public/smirnova.webp) is cut so that the circle it's shown in
 *  passes through the tips of both cat ears: of the circles that do, the
 *  widest the drawing has room for, centred at (456.6, 424) with a radius of
 *  428.2 on the 886px original. It has to be shown as a full circle, uncropped,
 *  or the ears leave the edge. */
export function AuthorRow() {
    return (
        <a
            href={`https://github.com/${AUTHOR.login}`}
            target="_blank"
            rel="noopener noreferrer"
            className={row}
            style={{ '--divider-inset': '4.5rem' } as React.CSSProperties}
        >
            <span className="flex min-w-0 items-center gap-4">
                <img
                    src="/smirnova.webp"
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-full ring-1 ring-[var(--border)]"
                />
                <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--text)]">{AUTHOR.name}</span>
                    <span className={`mt-0.5 block text-xs ${muted} [overflow-wrap:anywhere]`}>@{AUTHOR.login}</span>
                </span>
            </span>
            <span className={`flex shrink-0 items-center gap-1 text-sm ${muted}`}>
                GitHub
                <External size={18} className="opacity-70" />
            </span>
        </a>
    );
}

interface Entry {
    name: string;
    href: string;
    /** What it gave, in a few words. */
    desc?: string;
}

const EntryRow: React.FC<{ entry: Entry }> = ({ entry }) => (
    <a href={entry.href} target="_blank" rel="noopener noreferrer" className={row}>
        <span className="min-w-0">
            <span className="block text-sm text-[var(--text)]">{entry.name}</span>
            {entry.desc && <span className={`mt-0.5 block text-xs ${muted}`}>{entry.desc}</span>}
        </span>
        <External size={18} className={`shrink-0 ${muted} opacity-70`} />
    </a>
);

/** What the site runs on and is built with, each under its own licence. */
const SOFTWARE: { name: string; href: string; licence: string }[] = [
    { name: 'React', href: 'https://react.dev', licence: 'MIT' },
    { name: 'Vite', href: 'https://vite.dev', licence: 'MIT' },
    { name: 'Tailwind CSS', href: 'https://tailwindcss.com', licence: 'MIT' },
    { name: 'TypeScript', href: 'https://www.typescriptlang.org', licence: 'Apache-2.0' },
    { name: 'qrcode.react', href: 'https://github.com/zpao/qrcode.react', licence: 'ISC' },
    { name: 'Wrangler', href: 'https://github.com/cloudflare/workers-sdk', licence: 'MIT / Apache-2.0' },
    { name: 'Playwright', href: 'https://playwright.dev', licence: 'Apache-2.0' },
    // The link preview cards: what draws them, what measures their lines, and their type.
    { name: 'resvg', href: 'https://github.com/linebender/resvg', licence: 'MIT / Apache-2.0' },
    { name: 'resvg-js', href: 'https://github.com/thx/resvg-js', licence: 'MPL-2.0' },
    { name: 'fontkit', href: 'https://github.com/foliojs/fontkit', licence: 'MIT' },
    { name: 'Inter', href: 'https://rsms.me/inter/', licence: 'OFL-1.1' },
    { name: 'Source Han Sans', href: 'https://github.com/adobe-fonts/source-han-sans', licence: 'OFL-1.1' },
];

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => <h2 className="group-heading mb-1">{children}</h2>;

export function CreditsPage() {
    const builtOn: Entry[] = [
        {
            name: 'Oyama’s HRT Tracker',
            href: 'https://github.com/xunxunProjects/Oyama-s-HRT-Tracker',
            desc: tr('The shell and the design system'),
        },
    ];
    const data: Entry[] = [
        { name: 'PsychonautWiki', href: 'https://psychonautwiki.org', desc: tr('Doses, timing, effects') },
        { name: 'TripSit', href: 'https://tripsit.me', desc: tr('Combinations') },
        { name: 'Wikidata', href: 'https://www.wikidata.org', desc: tr('Names, kinds, more substances') },
        { name: 'Wikipedia', href: 'https://www.wikipedia.org', desc: tr('Summaries, how it works, uses') },
        { name: 'PubChem', href: 'https://pubchem.ncbi.nlm.nih.gov', desc: tr('Chemical structures, formulas') },
        { name: 'Guide to Pharmacology', href: 'https://www.guidetopharmacology.org', desc: tr('What a substance binds to') },
        { name: 'FreeODwiki', href: 'https://freeodwiki.org', desc: tr('Doses that other sources lack') },
    ];
    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={tr('Credits')} />
            <div className={`${PAGE_COLUMN} mt-3 space-y-8 pb-8`}>
                <p className={`text-sm ${muted}`}>{tr('This site is built on the work of many people. Thank you.')}</p>
                <div>
                    <Heading>{tr('Made by')}</Heading>
                    <div className={settingsSection}>
                        <AuthorRow />
                    </div>
                </div>
                <div>
                    <Heading>{tr('Built on')}</Heading>
                    <div className={settingsSection}>
                        {builtOn.map(e => (
                            <EntryRow key={e.href} entry={e} />
                        ))}
                    </div>
                </div>
                <div>
                    <Heading>{tr('Data')}</Heading>
                    <div className={settingsSection}>
                        {data.map(e => (
                            <EntryRow key={e.href} entry={e} />
                        ))}
                    </div>
                </div>
                <div>
                    <Heading>{tr('Open source software')}</Heading>
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 pt-2 text-sm">
                        {SOFTWARE.map(s => (
                            <li key={s.href} className="min-w-0">
                                <a
                                    href={s.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline underline-offset-[3px] [overflow-wrap:anywhere]"
                                >
                                    {s.name}
                                </a>
                                <span className={`block text-xs ${muted}`}>{s.licence}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <Heading>{tr('How it was made')}</Heading>
                    <p className={`text-sm leading-relaxed ${muted}`}>
                        {tr('The code was written with Claude, by Anthropic. Where no source covers a substance, a few sentences on its page were also written by Claude, and they’re labelled.')}
                    </p>
                </div>
            </div>
        </div>
    );
}
