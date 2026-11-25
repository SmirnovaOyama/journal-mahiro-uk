import React, { useEffect, useState } from 'react';
import { usePixelCats, type CatStyle } from '../contexts/PixelCatContext';
import { go, useOpenedFromLink, type SettingsSub } from '../lib/router';
import { useRecent, useSaved, useTheme, type ThemeChoice } from '../lib/store';
import { exportFile, merge, parseImport, useJournal } from '../lib/journal';
import { loadIndex, resolveName } from '../lib/data';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { rowBleed, settingsSection } from '../components/SettingsListItem';
import Switch from '../components/Switch';
import Tabs, { useSwitchAnimation } from '../components/Tabs';
import Tick from '../components/Tick';
import { ChevronRight, Database, External, Info, Sliders } from '../components/icons';
import { showOnboardingAgain } from './Onboarding';
import { useAccount } from '../lib/account';
import { AccountPage, AccountTile, DeleteAccountPage, DevicesPage, PasswordPage, RecoverPage, RecoveryKeyPage } from './Account';
import { AdminPage } from './Admin';

/* Settings, laid out as hrt.mahiro.uk lays its own out (pages/Settings.tsx
   there): on a phone, the three groups as a list of tiles, each opening its
   own page; on a wide window, the same groups as tabs under the title. Rows
   are a label with its value and a chevron, or a label with a switch; a
   choice (the appearance) is a page of rows with a tick. */

type Cat = 'general' | 'data' | 'about';
const CAT_ORDER: readonly Cat[] = ['general', 'data', 'about'];

const rowBase = 'w-full min-h-14 flex items-center justify-between gap-4 py-3.5 text-start';
const rowLabel = 'text-sm text-[var(--text)]';
const rowValue = 'flex items-center gap-1 text-sm text-[var(--text-muted)]';
const muted = 'text-[var(--text-muted)]';
const on = 'text-[var(--text)]';
const section = settingsSection;

const SectionHeading: React.FC<{ title: string }> = ({ title }) => <h2 className="group-heading mb-1">{title}</h2>;

const NavRow: React.FC<{ label: string; value?: React.ReactNode; onClick: () => void }> = ({ label, value, onClick }) => (
    <button onClick={onClick} className={`${rowBase} ${rowBleed}`}>
        <span className={rowLabel}>{label}</span>
        <span className={rowValue}>
            {value}
            <ChevronRight size={18} className="opacity-70 rtl:-scale-x-100" />
        </span>
    </button>
);

const LinkRow: React.FC<{ label: string; value?: string; href: string }> = ({ label, value, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className={`${rowBase} ${rowBleed} no-underline`}>
        <span className={rowLabel}>{label}</span>
        <span className={rowValue}>
            {value}
            <External size={18} className="opacity-70" />
        </span>
    </a>
);

const SwitchRow: React.FC<{ label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }> = ({
    label,
    desc,
    checked,
    onChange,
}) => {
    const id = React.useId();
    return (
        <div className={`${rowBase} cursor-default`}>
            <label htmlFor={id} className="cursor-pointer">
                <span className={`block ${rowLabel}`}>{label}</span>
                <span id={`${id}-desc`} className={`block text-xs ${muted} mt-0.5`}>
                    {desc}
                </span>
            </label>
            <Switch id={id} checked={checked} onChange={onChange} label={label} describedBy={`${id}-desc`} />
        </div>
    );
};

/** A row that clears something, asking first in a line under itself. */
const ClearRow: React.FC<{ label: string; count: number; countText: string; onClear: () => void; warn?: string }> = ({
    label,
    count,
    countText,
    onClear,
    warn,
}) => {
    const [asking, setAsking] = useState(false);
    return (
        <div>
            <button
                onClick={() => setAsking(a => !a)}
                disabled={!count}
                className={`${rowBase} ${count ? rowBleed : 'row-bleed opacity-45 cursor-not-allowed'}`}
            >
                <span className={`text-sm ${count ? 'text-[var(--danger)]' : rowLabel}`}>{label}</span>
                {count > 0 && <span className={`${rowValue} tabular-nums`}>{countText}</span>}
            </button>
            {asking && count > 0 && (
                <div className="m-appear flex items-center justify-between gap-3 pb-3.5">
                    <span className="text-sm">{warn ?? 'This can’t be undone.'}</span>
                    <span className="flex gap-2">
                        <button className="btn-secondary btn-sm" onClick={() => setAsking(false)} autoFocus>
                            {'Keep it'}
                        </button>
                        <button
                            className="btn-danger btn-sm"
                            onClick={() => {
                                onClear();
                                setAsking(false);
                            }}
                        >
                            {'Clear'}
                        </button>
                    </span>
                </div>
            )}
        </div>
    );
};

// Hard stops rather than a blend, in equal fifths, as hrt draws them.
const CAT_STYLE_SWATCHES: { id: CatStyle; background: string }[] = [
    {
        id: 'flag',
        background:
            'linear-gradient(180deg, var(--pixel-blue) 0 20%, var(--pixel-pink) 20% 40%, var(--pixel-white) 40% 60%, var(--pixel-pink) 60% 80%, var(--pixel-blue) 80% 100%)',
    },
    { id: 'blue', background: 'var(--pixel-blue)' },
    { id: 'pink', background: 'var(--pixel-pink)' },
];

function useWide() {
    const q = '(min-width: 768px)';
    const [wide, setWide] = useState(() => window.matchMedia(q).matches);
    useEffect(() => {
        const mq = window.matchMedia(q);
        const on = () => setWide(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return wide;
}

export function Settings({ sub }: { sub?: SettingsSub }) {
    const { choice, setChoice } = useTheme();
    const { showCats, setShowCats, catStyle, setCatStyle } = usePixelCats();
    const recent = useRecent();
    const saved = useSaved();
    const journal = useJournal();
    const { account } = useAccount();
    const fromLink = useOpenedFromLink();
    const [importNote, setImportNote] = useState<string | null>(null);
    const wide = useWide();

    const doExport = () => {
        const url = URL.createObjectURL(exportFile(journal.data));
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    const doImport = async (file: File) => {
        const text = await file.text();
        const index = await loadIndex().catch(() => []);
        const parsed = parseImport(text, name => {
            const e = resolveName(index, name);
            return e ? { id: e.id, name: e.name } : undefined;
        });
        if (!parsed) {
            setImportNote('That file isn’t a journal from here or from PsychonautWiki Journal.');
            return;
        }
        const { next, added } = merge(journal.data, parsed);
        journal.replace(next);
        setImportNote(
            added
                ? added === 1 ? 'Added 1 dose.' : `Added ${added} doses.`
                : 'Nothing new: every dose in it is already here.',
        );
    };

    useEffect(() => {
        document.title = 'Settings';
    }, []);

    const themeLabel = (c: ThemeChoice) =>
        ({
            light: 'Light',
            dark: 'Dark',
            system: 'System',
            mono: 'Black & white',
        })[c];

    const open = (s: SettingsSub) => go({ page: 'settings', sub: s });
    const cats: { id: Cat; label: string; Icon: React.ElementType; hint: string }[] = [
        {
            id: 'general',
            label: 'General',
            Icon: Sliders,
            hint: 'Appearance, pixel cats',
        },
        { id: 'data', label: 'Data', Icon: Database, hint: 'Journal, saved, looked at lately' },
        { id: 'about', label: 'About', Icon: Info, hint: 'Sources, disclaimer' },
    ];

    const renderGeneral = () => (
        <div className="space-y-8">
            <div>
                <SectionHeading title={'Display'} />
                <div className={section}>
                    <NavRow
                        label={'Appearance'}
                        value={themeLabel(choice)}
                        onClick={() => open('appearance')}
                    />
                    <SwitchRow
                        label={'Pixel cats'}
                        desc={'Show pixel cats on search and empty pages'}
                        checked={showCats}
                        onChange={setShowCats}
                    />
                    {showCats && (
                        <div className={`${rowBase} cursor-default`}>
                            <span className={rowLabel}>{'Cat colours'}</span>
                            <div className="flex items-center gap-2.5">
                                {CAT_STYLE_SWATCHES.map(({ id, background }) => {
                                    const name = {
                                        flag: 'Flag',
                                        blue: 'Blue',
                                        pink: 'Pink',
                                    }[id];
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => setCatStyle(id)}
                                            aria-label={name}
                                            title={name}
                                            aria-pressed={catStyle === id}
                                            className={`h-6 w-6 shrink-0 rounded-full border-(length:--hairline) border-[var(--border)] ${
                                                catStyle === id
                                                    ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]'
                                                    : ''
                                            }`}
                                            style={{ background }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const count = journal.data.ingestions.length;
    const renderData = () => (
        <div className="space-y-8">
            <div>
                <SectionHeading title={'Journal'} />
                <div className={section}>
                    <button onClick={doExport} disabled={!count} className={`${rowBase} ${count ? rowBleed : 'row-bleed opacity-45 cursor-not-allowed'}`}>
                        <span className={rowLabel}>{'Export the journal'}</span>
                        {count > 0 && <span className={`${rowValue} tabular-nums`}>{count === 1 ? '1 dose' : `${count} doses`}</span>}
                    </button>
                    <label className={`${rowBase} ${rowBleed} cursor-pointer`}>
                        <span>
                            <span className={`block ${rowLabel}`}>{'Import a journal'}</span>
                            <span className={`block text-xs ${muted} mt-0.5`}>
                                {'A file exported from here, or from PsychonautWiki Journal'}
                            </span>
                        </span>
                        <input
                            type="file"
                            accept="application/json,.json"
                            className="sr-only"
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void doImport(f);
                                e.target.value = '';
                            }}
                        />
                    </label>
                    <ClearRow
                        label={'Delete the journal'}
                        count={count}
                        countText={count === 1 ? '1 dose' : `${count} doses`}
                        onClear={journal.clear}
                        warn={account ? 'From every device signed in to your account too. This can’t be undone.' : undefined}
                    />
                </div>
                {importNote && (
                    <p className="m-appear text-sm mt-2" role="status">
                        {importNote}
                    </p>
                )}
                <p className={`text-xs ${muted} mt-2`}>
                    {account
                        ? 'The journal is kept in this browser and, encrypted, in your account, so it’s the same on each device you sign in on.'
                        : 'The journal is kept in this browser only. Export it to keep a copy, or make an account to keep it in sync across devices.'}
                </p>
            </div>
            <div>
                <SectionHeading title={'On this device'} />
                <div className={section}>
                    <ClearRow
                        label={'Clear what I looked at'}
                        count={recent.ids.length}
                        countText={`${recent.ids.length} substances`}
                        onClear={recent.clear}
                    />
                    <ClearRow
                        label={'Clear saved'}
                        count={saved.ids.length}
                        countText={`${saved.ids.length} substances`}
                        onClear={saved.clear}
                        warn={account ? 'On every device signed in to your account too.' : undefined}
                    />
                </div>
                <p className={`text-xs ${muted} mt-2`}>
                    {account
                        ? 'Saved substances sync with your account. What you looked at stays in this browser.'
                        : 'Everything stays in this browser. Nothing is ever sent anywhere.'}
                </p>
            </div>
        </div>
    );

    const renderAbout = () => (
        <div className="space-y-8">
            <div>
                <SectionHeading title={'About'} />
                <div className={section}>
                    <NavRow label={'Disclaimer'} onClick={() => open('disclaimer')} />
                    <NavRow label={'Show the intro again'} onClick={showOnboardingAgain} />
                </div>
            </div>
            <div>
                <SectionHeading title={'Sources'} />
                <div className={section}>
                    <LinkRow
                        label="PsychonautWiki"
                        value={'Doses, timing, effects'}
                        href="https://psychonautwiki.org"
                    />
                    <LinkRow label="TripSit" value={'Combinations'} href="https://tripsit.me" />
                    <LinkRow
                        label="Wikidata"
                        value={'Names, kinds, more substances'}
                        href="https://www.wikidata.org"
                    />
                    <LinkRow label="Wikipedia" value={'Summaries'} href="https://www.wikipedia.org" />
                    <LinkRow
                        label="PubChem"
                        value={'Chemical structures'}
                        href="https://pubchem.ncbi.nlm.nih.gov"
                    />
                </div>
            </div>
        </div>
    );

    const catContent = (id: Cat) => (id === 'general' ? renderGeneral() : id === 'data' ? renderData() : renderAbout());

    // The account and its pages (pages/Account.tsx).
    if (sub === 'account') return <AccountPage />;
    if (sub === 'password') return <PasswordPage />;
    if (sub === 'recovery-key') return <RecoveryKeyPage />;
    if (sub === 'devices') return <DevicesPage />;
    if (sub === 'delete-account') return <DeleteAccountPage />;
    if (sub === 'recover') return <RecoverPage />;
    if (sub === 'admin') return <AdminPage />;

    // A choice is its own page: the appearance.
    if (sub === 'appearance') {
        const options = (['light', 'dark', 'system', 'mono'] as ThemeChoice[]).map(c => ({ value: c as string, label: themeLabel(c) }));
        const current = choice;
        return (
            <div className="relative space-y-4 md:pb-32">
                <PageHeader backTo title={'Appearance'} />
                <div className={PAGE_COLUMN}>
                    {options.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setChoice(value as ThemeChoice)}
                            aria-pressed={current === value}
                            className="w-full flex items-center justify-between py-4 border-b-(length:--hairline) border-[var(--border)] last:border-b-0 text-start"
                        >
                            <span
                                className={`text-sm ${current === value ? 'font-semibold text-[var(--text)]' : 'text-[var(--text)]'}`}
                            >
                                {label}
                            </span>
                            <Tick on={current === value} />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (sub === 'disclaimer') {
        return (
            <div className="relative md:pb-32">
                <PageHeader backTo title={'Disclaimer'} />
                <div className={`${PAGE_COLUMN} mt-3 space-y-4 text-sm leading-relaxed`}>
                    <p>
                        {'This site gathers public harm-reduction information about psychoactive substances: doses, how long they last, and which combinations are risky. It is information, not medical advice, and it is no reason to take anything.'}
                    </p>
                    <p>
                        {'Doses and timings are typical ranges from PsychonautWiki and TripSit. Your body, your tolerance, the medicines you take and what is really in a pill or powder can all change them. Start low, test what you have, and don’t use alone.'}
                    </p>
                    <p className="text-[var(--danger)]">
                        {'If someone is unresponsive, breathing slowly or not at all, or having a seizure, call emergency services now.'}
                    </p>
                </div>
            </div>
        );
    }

    // On a wide window: the groups as tabs under the title.
    if (wide) {
        const cat: Cat = sub === 'data' || sub === 'about' ? sub : 'general';
        return <WideSettings title={'Settings'} cats={cats} cat={cat} content={catContent} backTo={fromLink} />;
    }

    // On a phone: the list of groups, or the group opened from it.
    if (sub === 'general' || sub === 'data' || sub === 'about') {
        return (
            <div className="relative">
                <PageHeader backTo title={cats.find(c => c.id === sub)?.label} />
                <div className={`${PAGE_COLUMN} mt-3 pb-8`}>{catContent(sub)}</div>
            </div>
        );
    }
    return (
        <div className="relative">
            <PageHeader title={'Settings'} backTo={fromLink} />
            <div className={`${PAGE_COLUMN} mt-3 ${section}`}>
                <AccountTile />
            </div>
            <div className={`${PAGE_COLUMN} mt-6 ${section}`}>
                {cats.map(({ id, label, Icon, hint }) => (
                    <button
                        key={id}
                        onClick={() => open(id)}
                        style={{ '--divider-inset': '3rem' } as React.CSSProperties}
                        className={`${rowBase} ${rowBleed}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--surface-muted)]">
                                <Icon size={20} strokeWidth={1.75} className={muted} />
                            </div>
                            <div className="text-start">
                                <p className={`text-sm font-medium ${on}`}>{label}</p>
                                <p className={`text-xs ${muted} mt-0.5`}>{hint}</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className={`${muted} shrink-0 opacity-70 rtl:-scale-x-100`} />
                    </button>
                ))}
            </div>
        </div>
    );
}

function WideSettings({
    title,
    cats,
    cat,
    content,
    backTo,
}: {
    title: string;
    cats: { id: Cat; label: string }[];
    cat: Cat;
    content: (c: Cat) => React.ReactNode;
    backTo?: boolean;
}) {
    const anim = useSwitchAnimation(cat, CAT_ORDER);
    return (
        <div className="md:pb-32">
            <PageHeader title={title} backTo={backTo} />
            <div className={`${PAGE_COLUMN} mt-3`}>
                <div className={`${settingsSection} mb-6`}>
                    <AccountTile />
                </div>
                <Tabs
                    tabs={cats}
                    value={cat}
                    onChange={c => go({ page: 'settings', sub: c }, { replace: true })}
                    className="mb-4"
                />
                <div key={cat} className={anim}>
                    {content(cat)}
                </div>
            </div>
        </div>
    );
}
