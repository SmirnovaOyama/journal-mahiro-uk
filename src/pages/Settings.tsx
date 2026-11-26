import React, { useEffect, useState } from 'react';
import { usePixelCats, type CatStyle } from '../contexts/PixelCatContext';
import { go, useOpenedFromLink, type SettingsSub } from '../lib/router';
import { formatWeight, useRecent, useSaved, useTheme, useWeight, type ThemeChoice } from '../lib/store';
import { exportFile, merge, parseImport, useJournal, useWeights } from '../lib/journal';
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
import { TwoFactorPage } from './TwoFactor';
import { WeightPage } from './Weight';
import { EssayPage } from './Essay';
import { useWide } from '../hooks/useWide';
import { LANG_NAMES, useLang, type LangChoice } from '../lib/lang';
import { SettingsTile } from '../components/SettingsTile';
import { phraseList, tr } from '../lib/i18n';

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
                    <span className="text-sm">{warn ?? tr('This can’t be undone.')}</span>
                    <span className="flex gap-2">
                        <button className="btn-secondary btn-sm" onClick={() => setAsking(false)} autoFocus>
                            {tr('Keep it')}
                        </button>
                        <button
                            className="btn-danger btn-sm"
                            onClick={() => {
                                onClear();
                                setAsking(false);
                            }}
                        >
                            {tr('Clear')}
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

export function Settings({ sub }: { sub?: SettingsSub }) {
    const { choice, setChoice } = useTheme();
    const { showCats, setShowCats, catStyle, setCatStyle } = usePixelCats();
    const recent = useRecent();
    const saved = useSaved();
    const journal = useJournal();
    const weights = useWeights();
    const { account } = useAccount();
    const weight = useWeight();
    const fromLink = useOpenedFromLink();
    const [importNote, setImportNote] = useState<string | null>(null);
    const wide = useWide();
    const language = useLang();

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
            setImportNote(tr('That file isn’t a journal from here or from PsychonautWiki Journal.'));
            return;
        }
        const { next, added, addedWeights } = merge(journal.data, parsed);
        journal.replace(next);
        const parts = [
            added ? (added === 1 ? tr('1 dose') : tr('{0} doses', { 0: added })) : '',
            addedWeights ? (addedWeights === 1 ? tr('1 weight') : tr('{0} weights', { 0: addedWeights })) : '',
        ].filter(Boolean);
        setImportNote(parts.length ? tr('Added {0}.', { 0: phraseList(parts) }) : tr('Nothing new: everything in it is already here.'));
    };

    useEffect(() => {
        document.title = tr('Settings');
    }, []);

    const themeLabel = (c: ThemeChoice) =>
        ({
            light: tr('Light', undefined, 'theme'),
            dark: tr('Dark'),
            system: tr('System'),
            mono: tr('Black & white'),
        })[c];

    const open = (s: SettingsSub) => go({ page: 'settings', sub: s });
    const cats: { id: Cat; label: string; Icon: React.ElementType; hint: string }[] = [
        {
            id: 'general',
            label: tr('General'),
            Icon: Sliders,
            hint: tr('Language, appearance, body weight, pixel cats'),
        },
        { id: 'data', label: tr('Data'), Icon: Database, hint: tr('Journal, saved, looked at lately') },
        { id: 'about', label: tr('About'), Icon: Info, hint: tr('Sources, disclaimer') },
    ];

    const renderGeneral = () => (
        <div className="space-y-8">
            <div>
                <SectionHeading title={tr('Display')} />
                <div className={section}>
                    {/* Each language under its own name, so it can be found from the other. */}
                    <NavRow
                        label={tr('Language')}
                        value={LANG_NAMES[language.lang]}
                        onClick={() => open('language')}
                    />
                    <NavRow
                        label={tr('Appearance')}
                        value={themeLabel(choice)}
                        onClick={() => open('appearance')}
                    />
                    <NavRow
                        label={tr('Body weight')}
                        value={weight.kg ? formatWeight(weight.kg, weight.unit) : tr('Not set')}
                        onClick={() => open('weight')}
                    />
                    <SwitchRow
                        label={tr('Pixel cats')}
                        desc={tr('Show pixel cats on search and empty pages')}
                        checked={showCats}
                        onChange={setShowCats}
                    />
                    {showCats && (
                        <div className={`${rowBase} cursor-default`}>
                            <span className={rowLabel}>{tr('Cat colours')}</span>
                            <div className="flex items-center gap-2.5">
                                {CAT_STYLE_SWATCHES.map(({ id, background }) => {
                                    const name = {
                                        flag: tr('Flag'),
                                        blue: tr('Blue'),
                                        pink: tr('Pink'),
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
    const wCount = weights.weights.length;
    const anything = count + wCount;
    const exportText = [count ? (count === 1 ? tr('1 dose') : tr('{0} doses', { 0: count })) : '', wCount ? (wCount === 1 ? tr('1 weight') : tr('{0} weights', { 0: wCount })) : '']
        .filter(Boolean)
        .join(tr(', '));
    const renderData = () => (
        <div className="space-y-8">
            <div>
                <SectionHeading title={tr('Journal')} />
                <div className={section}>
                    <button onClick={doExport} disabled={!anything} className={`${rowBase} ${anything ? rowBleed : 'row-bleed opacity-45 cursor-not-allowed'}`}>
                        <span className={rowLabel}>{tr('Export the journal')}</span>
                        {anything > 0 && <span className={`${rowValue} tabular-nums`}>{exportText}</span>}
                    </button>
                    <label className={`${rowBase} ${rowBleed} cursor-pointer`}>
                        <span>
                            <span className={`block ${rowLabel}`}>{tr('Import a journal')}</span>
                            <span className={`block text-xs ${muted} mt-0.5`}>
                                {tr('A file exported from here, or from PsychonautWiki Journal')}
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
                        label={tr('Delete the journal')}
                        count={count}
                        countText={count === 1 ? tr('1 dose') : tr('{0} doses', { 0: count })}
                        onClear={journal.clear}
                        warn={account ? tr('From every device signed in to your account too. This can’t be undone.') : undefined}
                    />
                    <ClearRow
                        label={tr('Delete body weight')}
                        count={wCount}
                        countText={wCount === 1 ? tr('1 weight') : tr('{0} weights', { 0: wCount })}
                        onClear={weights.clear}
                        warn={account ? tr('From every device signed in to your account too. This can’t be undone.') : undefined}
                    />
                </div>
                {importNote && (
                    <p className="m-appear text-sm mt-2" role="status">
                        {importNote}
                    </p>
                )}
                <p className={`text-xs ${muted} mt-2`}>
                    {account
                        ? tr('The journal is kept in this browser and, encrypted, in your account, so it’s the same on each device you sign in on.')
                        : tr('The journal is kept in this browser only. Export it to keep a copy, or make an account to keep it in sync across devices.')}
                </p>
            </div>
            <div>
                <SectionHeading title={tr('On this device')} />
                <div className={section}>
                    <ClearRow
                        label={tr('Clear what I looked at')}
                        count={recent.ids.length}
                        countText={tr('{0} substances', { 0: recent.ids.length })}
                        onClear={recent.clear}
                    />
                    <ClearRow
                        label={tr('Clear saved')}
                        count={saved.ids.length}
                        countText={tr('{0} substances', { 0: saved.ids.length })}
                        onClear={saved.clear}
                        warn={account ? tr('On every device signed in to your account too.') : undefined}
                    />
                </div>
                <p className={`text-xs ${muted} mt-2`}>
                    {account
                        ? tr('Saved substances sync with your account. What you looked at stays in this browser.')
                        : tr('Everything stays in this browser. Nothing is ever sent anywhere.')}
                </p>
            </div>
        </div>
    );

    const renderAbout = () => (
        <div className="space-y-8">
            <div>
                <SectionHeading title={tr('About')} />
                <div className={section}>
                    <NavRow label={tr('Disclaimer')} onClick={() => open('disclaimer')} />
                    <NavRow label={tr('Show the intro again')} onClick={showOnboardingAgain} />
                    <NavRow label={tr('A Borrowed Spring')} value={tr('Essay')} onClick={() => open('essay')} />
                </div>
            </div>
            <div>
                <SectionHeading title={tr('Sources')} />
                <div className={section}>
                    <LinkRow
                        label="PsychonautWiki"
                        value={tr('Doses, timing, effects')}
                        href="https://psychonautwiki.org"
                    />
                    <LinkRow label="TripSit" value={tr('Combinations')} href="https://tripsit.me" />
                    <LinkRow
                        label="Wikidata"
                        value={tr('Names, kinds, more substances')}
                        href="https://www.wikidata.org"
                    />
                    <LinkRow label="Wikipedia" value={tr('Summaries')} href="https://www.wikipedia.org" />
                    <LinkRow
                        label="PubChem"
                        value={tr('Chemical structures')}
                        href="https://pubchem.ncbi.nlm.nih.gov"
                    />
                </div>
            </div>
        </div>
    );

    const catContent = (id: Cat) => (id === 'general' ? renderGeneral() : id === 'data' ? renderData() : renderAbout());

    // The account and its pages (pages/Account.tsx), two-step sign-in
    // (pages/TwoFactor.tsx), and the admin's (pages/Admin.tsx).
    if (sub === 'account' || sub === 'sync' || sub === 'security') return <AccountPage sub={sub} />;
    if (sub === 'devices') return <DevicesPage />;
    if (sub === 'password') return <PasswordPage />;
    if (sub === 'recovery-key') return <RecoveryKeyPage />;
    if (sub === 'two-factor') return <TwoFactorPage />;
    if (sub === 'weight') return <WeightPage />;
    if (sub === 'essay') return <EssayPage />;
    if (sub === 'delete-account') return <DeleteAccountPage />;
    if (sub === 'recover') return <RecoverPage />;
    if (sub === 'admin' || sub === 'admin-overview' || sub === 'admin-accounts') return <AdminPage sub={sub} />;

    // A choice is its own page: the appearance.
    if (sub === 'appearance') {
        const options = (['light', 'dark', 'system', 'mono'] as ThemeChoice[]).map(c => ({ value: c as string, label: themeLabel(c) }));
        const current = choice;
        return (
            <div className="relative space-y-4 md:pb-32">
                <PageHeader backTo title={tr('Appearance')} />
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

    // And the language: the browser's, or one of the site's own.
    if (sub === 'language') {
        const options: { value: LangChoice; label: string }[] = [
            { value: 'system', label: tr('Follow the browser') },
            { value: 'en', label: LANG_NAMES.en },
            { value: 'zh-Hant', label: LANG_NAMES['zh-Hant'] },
        ];
        return (
            <div className="relative space-y-4 md:pb-32">
                <PageHeader backTo title={tr('Language')} />
                <div className={PAGE_COLUMN}>
                    {options.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => void language.setChoice(value)}
                            aria-pressed={language.choice === value}
                            lang={value === 'system' ? undefined : value}
                            className="w-full flex items-center justify-between py-4 border-b-(length:--hairline) border-[var(--border)] last:border-b-0 text-start"
                        >
                            <span className={`text-sm ${language.choice === value ? 'font-semibold text-[var(--text)]' : 'text-[var(--text)]'}`}>{label}</span>
                            <Tick on={language.choice === value} />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (sub === 'disclaimer') {
        return (
            <div className="relative md:pb-32">
                <PageHeader backTo title={tr('Disclaimer')} />
                <div className={`${PAGE_COLUMN} mt-3 space-y-4 text-sm leading-relaxed`}>
                    <p>
                        {tr('This site gathers public harm-reduction information about psychoactive substances: doses, how long they last, and which combinations are risky. It is information, not medical advice, and it is no reason to take anything.')}
                    </p>
                    <p>
                        {tr('Doses and timings are typical ranges from PsychonautWiki and TripSit. Your body, your tolerance, the medicines you take and what is really in a pill or powder can all change them. Start low, test what you have, and don’t use alone.')}
                    </p>
                    <p className="text-[var(--danger)]">
                        {tr('If someone is unresponsive, breathing slowly or not at all, or having a seizure, call emergency services now.')}
                    </p>
                </div>
            </div>
        );
    }

    // On a wide window: the groups as tabs under the title.
    if (wide) {
        const cat: Cat = sub === 'data' || sub === 'about' ? sub : 'general';
        return <WideSettings title={tr('Settings')} cats={cats} cat={cat} content={catContent} backTo={fromLink} />;
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
            <PageHeader title={tr('Settings')} backTo={fromLink} />
            {/* The account first, then the groups: one list of the same tiles. */}
            <div className={`${PAGE_COLUMN} mt-3 ${section}`}>
                <AccountTile />
                {cats.map(({ id, label, Icon, hint }) => (
                    <SettingsTile key={id} Icon={Icon} label={label} hint={hint} onClick={() => open(id)} />
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
