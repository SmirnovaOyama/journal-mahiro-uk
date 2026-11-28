import { useEffect, useState } from 'react';
import Choice from '../components/Choice';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { settingsSection } from '../components/SettingsListItem';
import Switch from '../components/Switch';
import { tr } from '../lib/i18n';
import { changeCode, hasOtherCode, inOtherBox, lockAfter, lockOff, lockOn, lockState, setLockAfter, setOtherCode, wipeDevice } from '../lib/kv';
import { readQuiet, setQuiet } from '../lib/quiet';

/* Settings, Lock and privacy: for a phone other people see, or may be made
   to show.

   - A lock: the journal and everything said of the person are encrypted on
     the device, and a code opens them each time (lib/kv.ts).
   - An other code, which opens an empty journal instead.
   - A plain name and icon, so the tab, the history and the Home Screen
     don't say what the site is (lib/quiet.ts).
   - Erasing everything on the device at once, leaving an account's copy.

   Each says plainly what it doesn't do. */

const muted = 'text-[var(--text-muted)]';
const label = `block text-xs font-medium ${muted} mb-1.5`;
const row = 'w-full min-h-14 flex items-center justify-between gap-4 py-3.5 text-start';
const MIN_CODE = 4;

const AFTER = [
    { id: '0', label: 'Only when the site is opened' },
    { id: '1', label: 'After 1 minute away' },
    { id: '5', label: 'After 5 minutes away' },
    { id: '30', label: 'After 30 minutes away' },
] as const;

/** Two fields for a new code, and a button. */
function NewCode({ submit, onDone, busyText, doText }: { submit: (code: string) => Promise<void>; onDone: () => void; busyText: string; doText: string }) {
    const [a, setA] = useState('');
    const [b, setB] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ok = a.length >= MIN_CODE && a === b;
    return (
        <form
            className="flex flex-col gap-4 pb-2"
            onSubmit={e => {
                e.preventDefault();
                if (!ok || busy) return;
                setBusy(true);
                setError(null);
                submit(a)
                    .then(onDone)
                    .catch((err: unknown) =>
                        setError(
                            err instanceof Error && /^Same/.test(err.message)
                                ? tr('The two codes have to differ.')
                                : err instanceof Error && err.message === 'No room'
                                  ? tr('There’s no room left in this browser’s storage.')
                                  : tr('That didn’t work. Nothing was changed.'),
                        ),
                    )
                    .finally(() => setBusy(false));
            }}
        >
            <div>
                <label className={label} htmlFor="new-code">
                    {tr('Code')}
                </label>
                <input id="new-code" type="password" autoComplete="new-password" className={`input-base w-full ${a ? 'is-inked' : ''}`} value={a} onChange={e => setA(e.target.value)} />
            </div>
            <div>
                <label className={label} htmlFor="new-code-again">
                    {tr('Confirm the code')}
                </label>
                <input
                    id="new-code-again"
                    type="password"
                    autoComplete="new-password"
                    className={`input-base w-full ${b ? 'is-inked' : ''}`}
                    value={b}
                    onChange={e => setB(e.target.value)}
                    aria-invalid={!!b && a !== b}
                />
            </div>
            {a && a.length < MIN_CODE && <p className={`text-xs ${muted}`}>{tr('At least {0} characters.', { 0: MIN_CODE })}</p>}
            {error && (
                <p className="text-sm text-[var(--danger)]" role="alert">
                    {error}
                </p>
            )}
            <div>
                <button type="submit" className="btn-primary" disabled={!ok || busy}>
                    {busy ? busyText : doText}
                </button>
            </div>
        </form>
    );
}

export function PrivacyPage() {
    // The lock's own state lives in lib/kv.ts; this redraws after each change to it.
    const [, redraw] = useState(0);
    const again = () => redraw(n => n + 1);
    const [open, setOpen] = useState<'on' | 'code' | 'other' | null>(null);
    const [quiet, setQuietState] = useState(() => readQuiet());
    const [name, setName] = useState(() => readQuiet()?.name ?? tr('Notes'));
    const [erasing, setErasing] = useState(false);
    useEffect(() => {
        document.title = tr('Lock and privacy');
    }, []);

    const locked = lockState() === 'open';
    const other = inOtherBox();
    const withOther = hasOtherCode();

    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={tr('Lock and privacy')} />
            <div className={`${PAGE_COLUMN} mt-3 pb-10 space-y-10`}>
                {/* ── the lock ── */}
                <section>
                    <h2 className="group-heading mb-1">{tr('Lock')}</h2>
                    <div className={settingsSection}>
                        <div className={row}>
                            <span>
                                <span className="block text-sm text-[var(--text)]">{tr('Lock the journal with a code')}</span>
                                <span className={`block text-xs ${muted} mt-0.5`}>{locked ? tr('On: you’ll be asked for the code when you open the site.') : tr('Off')}</span>
                            </span>
                            {!other && (
                                <Switch
                                    checked={locked}
                                    label={tr('Lock the journal with a code')}
                                    onChange={next => {
                                        if (next) setOpen(o => (o === 'on' ? null : 'on'));
                                        else void lockOff().then(again);
                                    }}
                                />
                            )}
                        </div>
                        {!locked && open === 'on' && (
                            <div className="m-appear pt-2">
                                <NewCode
                                    submit={lockOn}
                                    onDone={() => {
                                        setOpen(null);
                                        again();
                                    }}
                                    busyText={tr('Locking…')}
                                    doText={tr('Turn the lock on')}
                                />
                            </div>
                        )}
                        {locked && (
                            <>
                                <div className="py-3.5">
                                    <span className={label}>{tr('Require the code')}</span>
                                    <div className="flex flex-col">
                                        <Choice
                                            options={AFTER.map(o => ({ id: o.id, label: tr(o.label) }))}
                                            value={String(lockAfter()) as (typeof AFTER)[number]['id']}
                                            onChange={v => {
                                                setLockAfter(Number(v));
                                                again();
                                            }}
                                            label={tr('Require the code')}
                                        />
                                    </div>
                                </div>
                                {!other && (
                                    <>
                                        <div>
                                            <button type="button" className={`${row} row-bleed rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)]`} aria-expanded={open === 'code'} onClick={() => setOpen(o => (o === 'code' ? null : 'code'))}>
                                                <span className="text-sm text-[var(--text)]">{tr('Change the code')}</span>
                                            </button>
                                            {open === 'code' && (
                                                <div className="m-appear pt-1">
                                                    <NewCode submit={changeCode} onDone={() => setOpen(null)} busyText={tr('Changing…')} doText={tr('Change the code')} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className={row}>
                                                <span>
                                                    <span className="block text-sm text-[var(--text)]">{tr('A second code that opens an empty journal')}</span>
                                                    <span className={`block text-xs ${muted} mt-0.5`}>
                                                        {tr('Enter it instead of your code to open an empty journal, for when someone makes you open the site.')}
                                                    </span>
                                                </span>
                                                <Switch
                                                    checked={withOther}
                                                    label={tr('A second code that opens an empty journal')}
                                                    onChange={next => {
                                                        if (next) setOpen(o => (o === 'other' ? null : 'other'));
                                                        else void setOtherCode(null).then(again);
                                                    }}
                                                />
                                            </div>
                                            {!withOther && open === 'other' && (
                                                <div className="m-appear pt-1">
                                                    <NewCode
                                                        submit={setOtherCode}
                                                        onDone={() => {
                                                            setOpen(null);
                                                            again();
                                                        }}
                                                        busyText={tr('Setting…')}
                                                        doText={tr('Set the second code')}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                <button type="button" className={`${row} row-bleed rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)]`} onClick={() => window.location.reload()}>
                                    <span className="text-sm text-[var(--text)]">{tr('Lock now')}</span>
                                </button>
                            </>
                        )}
                    </div>
                    <div className={`mt-3 space-y-2 text-xs ${muted}`}>
                        <p>
                            {tr('With the lock on, your journal, saved list, medicines, limits and account sign-in are encrypted on this device and can’t be read until the code is entered.')}
                        </p>
                        <p>{tr('The code can’t be reset. If you forget it, the data on this device is lost, but your account’s copy isn’t: sign in to get it back.')}</p>
                        <p>
                            {tr('A short code stops someone who picks up your phone, not someone with time and tools; a longer one is harder to guess. The browser’s offline copies of pages aren’t locked, and they show which substances you’ve opened.')}
                        </p>
                        {locked && !other && <p>{tr('The second code fools a quick look, not a close examination of the device: both journals are stored side by side, and one is clearly larger.')}</p>}
                    </div>
                </section>

                {/* ── a plain name and icon ── */}
                <section>
                    <h2 className="group-heading mb-1">{tr('A discreet name and icon')}</h2>
                    <div className={settingsSection}>
                        <div className={row}>
                            <span>
                                <span className="block text-sm text-[var(--text)]">{tr('Use a different name for the site')}</span>
                                <span className={`block text-xs ${muted} mt-0.5`}>{tr('Shown in the tab, the browser history and on the Home Screen, with a plain grey icon.')}</span>
                            </span>
                            <Switch
                                checked={!!quiet}
                                label={tr('Use a different name for the site')}
                                onChange={next => {
                                    const q = next ? { name: name.trim() || tr('Notes') } : null;
                                    setQuiet(q);
                                    setQuietState(q);
                                    if (!next) document.title = tr('Lock and privacy');
                                }}
                            />
                        </div>
                        <div className="py-3.5">
                            <label className={label} htmlFor="quiet-name">
                                {tr('Name shown')}
                            </label>
                            <input
                                id="quiet-name"
                                className={`input-base w-full ${name ? 'is-inked' : ''}`}
                                maxLength={30}
                                autoComplete="off"
                                value={name}
                                onChange={e => {
                                    setName(e.target.value);
                                    if (quiet && e.target.value.trim()) {
                                        const q = { name: e.target.value.trim() };
                                        setQuiet(q);
                                        setQuietState(q);
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <p className={`mt-3 text-xs ${muted}`}>
                        {tr('An app already on your Home Screen keeps its old name and icon until you add it again with this on. The address still shows in the browser’s address bar.')}
                    </p>
                </section>

                {/* ── erase ── */}
                <section>
                    <h2 className="group-heading mb-1">{tr('Erase this device')}</h2>
                    <div className={settingsSection}>
                        <button type="button" className={`${row} row-bleed rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)]`} aria-expanded={erasing} onClick={() => setErasing(e => !e)}>
                            <span className="text-sm text-[var(--danger)]">{tr('Erase everything on this device')}</span>
                        </button>
                        {erasing && (
                            <div className="m-appear flex flex-wrap items-center justify-between gap-3 pb-3.5">
                                <span className="text-sm">{tr('This can’t be undone from here.')}</span>
                                <span className="flex gap-2">
                                    <button className="btn-secondary btn-sm" onClick={() => setErasing(false)} autoFocus>
                                        {tr('Keep it')}
                                    </button>
                                    <button className="btn-danger btn-sm" onClick={() => void wipeDevice().then(() => window.location.replace('/'))}>
                                        {tr('Erase')}
                                    </button>
                                </span>
                            </div>
                        )}
                    </div>
                    <p className={`mt-3 text-xs ${muted}`}>
                        {tr('Clears your journal, saved list, medicines, limits, lock, sign-in and offline data at once. Your account isn’t touched, so its encrypted copy stays and signing in brings it back.')}
                    </p>
                </section>
            </div>
        </div>
    );
}
