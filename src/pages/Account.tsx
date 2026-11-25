import React, { useEffect, useId, useState } from 'react';
import { go } from '../lib/router';
import {
    ApiError,
    changePassword,
    deleteAccount,
    dismissNote,
    fetchAccount,
    newRecoveryKey,
    recover,
    refreshUser,
    signIn,
    signOut,
    signOutDevice,
    signOutOtherDevices,
    signUp,
    syncNow,
    unlock,
    useAccount,
    type AccountInfo,
    type AccountState,
    type SyncStatus,
} from '../lib/account';
import { newPasswordLevel, type NewPasswordLevel } from '../lib/password';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import Point from '../components/Point';
import { SettingsListItem, rowBleed, settingsSection } from '../components/SettingsListItem';
import Tabs, { useSwitchAnimation } from '../components/Tabs';
import {
    Account as PersonIcon,
    Alert,
    Busy,
    CheckCircle,
    ChevronRight,
    Cloud,
    Close,
    CloudOff,
    Codes,
    Copy,
    Devices,
    Download,
    Lock,
    Logout,
    Monitor,
    Password,
    Phone,
    Server,
    Trash,
} from '../components/icons';

/* The account, laid out as hrt.mahiro.uk lays out its own (pages/Account.tsx
   there). Signed out: why one might want an account, then the forms to sign
   in or make one. Signed in: the sync line, the security rows, signing out,
   and deleting it last. Each of the rest is its own page under Settings. */

const muted = 'text-[var(--text-muted)]';
const on = 'text-[var(--text)]';
const sectionLabel = 'text-xs font-semibold mb-2 block text-[var(--text-muted)]';
const labelCls = 'block text-xs font-semibold text-[var(--text-muted)]';
const inputCls = 'input-base text-sm w-full';
const USERNAME = /^[A-Za-z0-9_-]{3,30}$/;

const message = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Try again.');

/** "just now", "5 min ago", "3 h ago", "on 4 Nov". */
export function ago(t: number, now = Date.now()): string {
    const s = Math.max(0, (now - t) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = new Date(t);
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return `on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}`;
}

/** Re-renders every half minute, so "5 min ago" moves on. */
function useTicking() {
    const [, setT] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setT(t => t + 1), 30_000);
        return () => window.clearInterval(id);
    }, []);
}

/* ── pieces ─────────────────────────────────────────────────────────── */

function Field({
    label,
    value,
    onChange,
    type = 'text',
    autoComplete,
    describedBy,
    mono,
    autoFocus,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: 'text' | 'password';
    autoComplete?: string;
    describedBy?: string;
    mono?: boolean;
    autoFocus?: boolean;
    placeholder?: string;
}) {
    const id = useId();
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className={labelCls}>
                {label}
            </label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                className={`${inputCls} ${mono ? 'font-mono tracking-wide uppercase' : ''}`}
                style={{ fontSize: '16px' }}
                autoComplete={autoComplete}
                autoCapitalize={mono ? 'characters' : 'none'}
                autoCorrect="off"
                spellCheck={false}
                aria-describedby={describedBy}
                autoFocus={autoFocus}
                placeholder={placeholder}
                required
            />
        </div>
    );
}

const LEVEL_TEXT: Record<NewPasswordLevel, string> = {
    tooLong: 'Too long: at most 256 letters and digits.',
    weak: 'Easy to guess: try something longer or less regular.',
    fair: 'Okay. A little longer would be safer.',
    strong: 'Strong password.',
};
const LEVEL_TONE: Record<NewPasswordLevel, string> = {
    tooLong: 'text-[var(--danger)]',
    weak: 'text-[var(--danger)]',
    fair: muted,
    strong: 'text-[var(--accent-ink)]',
};

/** The line under a new password. Mounted all along, so a screen reader
 *  hears it change. */
function StrengthHint({ id, password }: { id: string; password: string }) {
    const level = newPasswordLevel(password);
    return (
        <p id={id} className={`text-xs ${level ? LEVEL_TONE[level] : muted}`} aria-live="polite">
            {level ? LEVEL_TEXT[level] : password ? 'At least 8 characters.' : ''}
        </p>
    );
}

/** Why a new password can't be used, or null. */
function newPasswordProblem(password: string): string | null {
    const level = newPasswordLevel(password);
    if (!level) return 'A password is at least 8 characters.';
    if (level === 'tooLong' || level === 'weak') return LEVEL_TEXT[level];
    return null;
}

function ErrorLine({ id, error }: { id?: string; error: string | null }) {
    if (!error) return null;
    return (
        <p id={id} role="alert" className="m-appear text-sm text-[var(--danger)]">
            {error}
        </p>
    );
}

function Submit({ busy, busyLabel, children, danger, disabled }: { busy: boolean; busyLabel: string; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
    return (
        <button type="submit" disabled={busy || disabled} className={`${danger ? 'btn-danger' : 'btn-primary'} w-full`}>
            {busy ? (
                <span className="inline-flex items-center gap-2">
                    <Busy size={16} className="animate-spin" />
                    {busyLabel}
                </span>
            ) : (
                children
            )}
        </button>
    );
}

/** A circle with the name's first letter. */
function Avatar({ name, size = 'md' }: { name?: string; size?: 'md' | 'lg' }) {
    const box = size === 'lg' ? 'size-14 text-[1.5rem]' : 'size-9 text-base';
    return (
        <span className={`${box} grid shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] font-light ${muted}`} aria-hidden>
            {name ? name.charAt(0).toUpperCase() : <PersonIcon size={18} />}
        </span>
    );
}

/* ── the recovery key, shown once ───────────────────────────────────── */

function RecoveryKeyShow({ code, username, fresh, onDone }: { code: string; username: string; fresh?: boolean; onDone: () => void }) {
    const [copied, setCopied] = useState(false);
    const [kept, setKept] = useState(false);
    const checkId = useId();
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            /* the key is on screen to copy by hand */
        }
    };
    const save = () => {
        const text = [
            'Oyama Journal recovery key',
            '',
            `Username: ${username}`,
            `Recovery key: ${code}`,
            '',
            'If you forget your password, this sets a new one at journal.mahiro.uk, in',
            'Settings, Account, Forgot your password. Keep it somewhere safe and private.',
            'Without your password or this key, nobody can open your journal, not even',
            'the server.',
            '',
        ].join('\n');
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `oyama-journal-recovery-key-${username}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    return (
        <div className="m-appear space-y-4">
            <div>
                <h2 className={`text-base font-semibold ${on}`}>{fresh ? 'Your new recovery key' : 'Your recovery key'}</h2>
                <p className={`mt-1 text-sm leading-relaxed ${muted}`}>
                    {'If you forget your password, this sets a new one. Keep it somewhere safe, away from this device: it’s shown only now.'}
                    {fresh && ' The one before it no longer works.'}
                </p>
            </div>
            <p
                className="grid grid-cols-4 gap-x-3 gap-y-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-4 py-4 text-center font-mono text-[1.0625rem] font-medium tracking-[0.08em] text-[var(--text)] select-all max-[360px]:grid-cols-2"
                aria-label={`Recovery key: ${code.split('-').join(' ')}`}
            >
                {code.split('-').map((g, i) => (
                    <span key={i}>{g}</span>
                ))}
            </p>
            <div className="flex gap-2">
                <button type="button" className="btn-secondary btn-sm flex-1" onClick={copy}>
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" className="btn-secondary btn-sm flex-1" onClick={save}>
                    <Download size={16} />
                    {'Save as a file'}
                </button>
            </div>
            <label htmlFor={checkId} className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input id={checkId} type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={kept} onChange={e => setKept(e.target.checked)} />
                <span>{'I’ve kept it somewhere safe'}</span>
            </label>
            <button type="button" className="btn-primary w-full" disabled={!kept} onClick={onDone}>
                {'Done'}
            </button>
        </div>
    );
}

/* ── the sync line ──────────────────────────────────────────────────── */

const STATUS_TITLE: Record<SyncStatus, string> = {
    off: 'Not signed in',
    locked: 'Enter your password to sync',
    waiting: 'Waiting to sync',
    syncing: 'Syncing…',
    synced: 'Up to date',
    offline: 'Offline',
    error: 'Sync failed',
};

function SyncIcon({ status }: { status: SyncStatus }) {
    const cls = `${muted} shrink-0`;
    switch (status) {
        case 'syncing':
            return <Busy size={20} className={`${cls} animate-spin`} />;
        case 'synced':
            return <CheckCircle size={20} className={cls} />;
        case 'locked':
            return <Lock size={20} className={cls} />;
        case 'error':
            return <Alert size={20} className="shrink-0 text-[var(--warning)]" />;
        case 'offline':
            return <CloudOff size={20} className={cls} />;
        default:
            return <Cloud size={20} className={cls} />;
    }
}

/** What the sync is doing, in a few words: for the row in Settings. */
export function syncLine(s: AccountState): string {
    if (!s.account) return s.error ? 'Signed out: sign in to keep syncing' : 'Keep your journal in sync across devices';
    if (s.status === 'synced' || s.status === 'waiting' || s.status === 'syncing')
        return s.account.synced ? `${STATUS_TITLE[s.status === 'syncing' ? 'syncing' : 'synced']}, ${ago(s.account.synced)}` : STATUS_TITLE[s.status];
    return STATUS_TITLE[s.status];
}

/** The account's row at the top of Settings. */
export function AccountTile() {
    const s = useAccount();
    useTicking();
    const name = s.account?.user.username;
    return (
        <button
            onClick={() => go({ page: 'settings', sub: 'account' })}
            style={{ '--divider-inset': '3rem' } as React.CSSProperties}
            className={`w-full min-h-14 flex items-center justify-between gap-4 py-3.5 text-start ${rowBleed}`}
        >
            <div className="flex min-w-0 items-center gap-3">
                <Avatar name={name} />
                <div className="min-w-0 text-start">
                    <p className={`truncate text-sm font-medium ${on}`}>{name ?? 'Account'}</p>
                    <p className={`mt-0.5 truncate text-xs ${s.status === 'error' || (!s.account && s.error) ? 'text-[var(--warning)]' : muted}`}>{syncLine(s)}</p>
                </div>
            </div>
            <ChevronRight size={18} className={`${muted} shrink-0 opacity-70 rtl:-scale-x-100`} />
        </button>
    );
}

function UnlockForm() {
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await unlock(password);
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };
    return (
        <form onSubmit={submit} className="m-appear space-y-3 ps-8 pb-4">
            <p className={`text-xs leading-relaxed ${muted}`}>
                {'This device no longer has the key to your journal’s copy, maybe because its storage was cleared. Your password brings it back.'}
            </p>
            <ErrorLine error={error} />
            <Field label={'Password'} type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
            <Submit busy={busy} busyLabel={'Unlocking…'}>
                {'Unlock'}
            </Submit>
        </form>
    );
}

/* ── the account page ───────────────────────────────────────────────── */

export function AccountPage() {
    const s = useAccount();
    // Making an account signs in before its recovery key is shown: the form
    // stays until the key is in hand, then the key, then the account.
    const [making, setMaking] = useState(false);
    const [made, setMade] = useState<{ code: string; username: string } | null>(null);
    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={made ? 'Recovery key' : 'Account'} />
            {made ? (
                <div className={`${PAGE_COLUMN} mt-3 [&>*]:mx-auto [&>*]:max-w-sm`}>
                    <RecoveryKeyShow code={made.code} username={made.username} onDone={() => setMade(null)} />
                </div>
            ) : s.account && !making ? (
                <SignedIn s={s} />
            ) : (
                <SignedOut note={s.error} onMaking={setMaking} onMade={setMade} />
            )}
        </div>
    );
}

type AuthTab = 'sign-in' | 'sign-up';
const AUTH_TABS: readonly AuthTab[] = ['sign-in', 'sign-up'];

function SignedOut({
    note,
    onMaking,
    onMade,
}: {
    note: string | null;
    onMaking: (v: boolean) => void;
    onMade: (m: { code: string; username: string }) => void;
}) {
    const [tab, setTab] = useState<AuthTab>('sign-in');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const anim = useSwitchAnimation(tab, AUTH_TABS);
    const formId = useId();
    const isLogin = tab === 'sign-in';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const name = username.trim();
        if (!USERNAME.test(name)) return setError(isLogin ? 'Wrong username or password.' : 'A username is 3 to 30 letters, digits, - or _.');
        if (!isLogin) {
            const problem = newPasswordProblem(password);
            if (problem) return setError(problem);
        }
        setBusy(true);
        if (!isLogin) onMaking(true);
        try {
            if (isLogin) await signIn(name, password);
            else onMade({ code: await signUp(name, password), username: name });
            dismissNote();
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
            onMaking(false);
        }
    };

    return (
        <div className={`${PAGE_COLUMN} mt-3 [&>*]:mx-auto [&>*]:max-w-sm`}>
            {note && (
                <div className="callout m-appear mb-4 flex items-start gap-2" role="status">
                    <p className="flex-1">{note}</p>
                    <button type="button" className="-m-1 p-1 opacity-70 hover:opacity-100" aria-label={'Dismiss'} onClick={dismissNote}>
                        <Close size={16} />
                    </button>
                </div>
            )}
            <div className="mb-4">
                <Point mark="lock" title={'It stays on this device'} desc={'Your journal is kept in this browser. Without an account, nothing is sent anywhere.'} />
                <Point
                    mark="cloud"
                    title={'An account is optional'}
                    desc={'With one, your journal and saved list are the same on every device you sign in on, encrypted on each before it’s sent.'}
                />
            </div>
            <Tabs
                tabs={[
                    { id: 'sign-in', label: 'Sign in' },
                    { id: 'sign-up', label: 'Create an account' },
                ]}
                value={tab}
                onChange={t => {
                    setTab(t);
                    setError(null);
                }}
                className="mb-5"
            />
            <div key={tab} className={anim}>
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <ErrorLine id={`${formId}-error`} error={error} />
                    <Field label={'Username'} value={username} onChange={setUsername} autoComplete="username" describedBy={error ? `${formId}-error` : undefined} />
                    <div className="space-y-1.5">
                        <Field
                            label={'Password'}
                            type="password"
                            value={password}
                            onChange={setPassword}
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                            describedBy={isLogin ? undefined : `${formId}-strength ${formId}-key`}
                        />
                        {!isLogin && <StrengthHint id={`${formId}-strength`} password={password} />}
                    </div>
                    {isLogin ? (
                        <p className={`text-xs leading-relaxed ${muted}`}>{'What’s in this browser’s journal is added to your account’s.'}</p>
                    ) : (
                        <p id={`${formId}-key`} className="callout">
                            {'Your password is also the key to your journal’s copy in the account. If you forget it, only your recovery key opens it again: the server can’t.'}
                        </p>
                    )}
                    <Submit busy={busy} busyLabel={isLogin ? 'Signing in…' : 'Making your account…'}>
                        {isLogin ? 'Sign in' : 'Create account'}
                    </Submit>
                    {isLogin && (
                        <p className="text-center">
                            <button type="button" className="link-button text-sm" onClick={() => go({ page: 'settings', sub: 'recover' })}>
                                {'Forgot your password?'}
                            </button>
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}

function SignedIn({ s }: { s: AccountState }) {
    const account = s.account!;
    const [info, setInfo] = useState<AccountInfo | null>(null);
    const [asking, setAsking] = useState(false);
    const [busy, setBusy] = useState(false);
    useTicking();
    useEffect(() => {
        let live = true;
        fetchAccount()
            .then(i => {
                if (!live) return;
                setInfo(i);
                refreshUser(i.user);
            })
            .catch(() => {});
        return () => {
            live = false;
        };
    }, [account.token]);

    const out = async (keepHere: boolean) => {
        setBusy(true);
        await signOut(keepHere);
        setBusy(false);
    };
    const since = new Date(account.user.created).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const status = s.status;
    const desc =
        status === 'error' ? (
            <span className="text-[var(--danger)]">{s.error}</span>
        ) : status === 'offline' ? (
            'It syncs when you’re back online.'
        ) : status === 'locked' ? undefined : account.synced ? (
            `Last synced ${ago(account.synced)}`
        ) : (
            'Not synced yet'
        );
    const devices = info?.sessions.length;

    return (
        <div className={`${PAGE_COLUMN} mt-3 space-y-8`}>
            <div className="flex items-center gap-4 pt-2">
                <Avatar name={account.user.username} size="lg" />
                <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${on}`}>{account.user.username}</p>
                    <p className={`mt-0.5 text-xs ${muted}`}>{`Account since ${since}`}</p>
                </div>
            </div>

            {account.user.admin && (
                <section>
                    <span className={sectionLabel}>{'Admin'}</span>
                    <div className={settingsSection}>
                        <SettingsListItem
                            icon={Server}
                            title={'Admin'}
                            description={'Accounts, devices, storage and sign-ups'}
                            onClick={() => go({ page: 'settings', sub: 'admin' })}
                        />
                    </div>
                </section>
            )}

            <section>
                <span className={sectionLabel}>{'Sync'}</span>
                <div className={settingsSection}>
                    <SettingsListItem
                        icon={<SyncIcon status={status} />}
                        title={STATUS_TITLE[status]}
                        description={desc}
                        showChevron={false}
                        trailing={
                            status === 'locked' ? null : (
                                <button
                                    type="button"
                                    className="link-button shrink-0 text-xs font-medium"
                                    disabled={status === 'syncing'}
                                    onClick={() => void syncNow()}
                                >
                                    {'Sync now'}
                                </button>
                            )
                        }
                    />
                    {status === 'locked' && <UnlockForm />}
                </div>
                <p className={`mt-2 text-xs leading-relaxed ${muted}`}>
                    {'Your journal and saved list are encrypted on this device before they’re sent. The server keeps a copy it can’t read.'}
                </p>
            </section>

            <section>
                <span className={sectionLabel}>{'Security'}</span>
                <div className={settingsSection}>
                    <SettingsListItem
                        icon={Password}
                        title={'Change password'}
                        description={'Signs your other devices out'}
                        onClick={() => go({ page: 'settings', sub: 'password' })}
                    />
                    <SettingsListItem
                        icon={Codes}
                        title={'Recovery key'}
                        description={'Make a new one if yours is lost'}
                        onClick={() => go({ page: 'settings', sub: 'recovery-key' })}
                    />
                    <SettingsListItem
                        icon={Devices}
                        title={'Devices'}
                        description={'Where you’re signed in'}
                        onClick={() => go({ page: 'settings', sub: 'devices' })}
                        trailing={devices ? <span className={`shrink-0 text-xs tabular-nums ${muted}`}>{devices === 1 ? '1 device' : `${devices} devices`}</span> : null}
                    />
                </div>
            </section>

            <div className={settingsSection}>
                <SettingsListItem icon={Logout} title={'Sign out'} onClick={() => setAsking(a => !a)} showChevron={false} />
                {asking && (
                    <div className="m-appear space-y-3 ps-8 pb-4">
                        <p className="text-sm">{'Your journal stays in your account. And on this device?'}</p>
                        <div className="flex flex-wrap gap-2">
                            <button className="btn-secondary btn-sm" disabled={busy} onClick={() => void out(true)} autoFocus>
                                {'Keep it here'}
                            </button>
                            <button className="btn-danger btn-sm" disabled={busy} onClick={() => void out(false)}>
                                {'Remove it from this device'}
                            </button>
                            <button className="link-button btn-sm text-sm" onClick={() => setAsking(false)}>
                                {'Cancel'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <section>
                <span className={`${sectionLabel} !text-[var(--danger)]`}>{'Danger zone'}</span>
                <div className={settingsSection}>
                    <SettingsListItem
                        icon={Trash}
                        title={'Delete account'}
                        description={'Deletes the account and the copy it keeps'}
                        onClick={() => go({ page: 'settings', sub: 'delete-account' })}
                        danger
                    />
                </div>
            </section>
        </div>
    );
}

/* ── its own pages ──────────────────────────────────────────────────── */

/** A page that needs an account: signed out, it says so. */
function NeedsAccount({ title, hold, children }: { title: string; hold?: boolean; children: React.ReactNode }) {
    const s = useAccount();
    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={title} />
            <div className={`${PAGE_COLUMN} mt-3 [&>*]:mx-auto [&>*]:max-w-sm`}>
                {s.account || hold ? (
                    children
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm">{'You’re signed out.'}</p>
                        <button className="btn-primary w-full" onClick={() => go({ page: 'settings', sub: 'account' }, { replace: true })}>
                            {'Sign in'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export function PasswordPage() {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [again, setAgain] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const id = useId();
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const problem = newPasswordProblem(next);
        if (problem) return setError(problem);
        if (next !== again) return setError('The new password and its repeat aren’t the same.');
        if (next === current) return setError('That’s the password you have now.');
        setBusy(true);
        try {
            await changePassword(current, next);
            setDone(true);
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };
    return (
        <NeedsAccount title={'Change password'}>
            {done ? (
                <div className="m-appear space-y-4">
                    <p className="flex items-center gap-2 text-sm">
                        <CheckCircle size={18} className="text-[var(--accent-ink)]" />
                        {'Password changed. Your other devices were signed out.'}
                    </p>
                    <button className="btn-primary w-full" onClick={() => go({ page: 'settings', sub: 'account' }, { replace: true })}>
                        {'Done'}
                    </button>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <ErrorLine error={error} />
                    <Field label={'Current password'} type="password" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
                    <div className="space-y-1.5">
                        <Field label={'New password'} type="password" value={next} onChange={setNext} autoComplete="new-password" describedBy={`${id}-strength`} />
                        <StrengthHint id={`${id}-strength`} password={next} />
                    </div>
                    <Field label={'New password again'} type="password" value={again} onChange={setAgain} autoComplete="new-password" />
                    <p className="callout">{'Your other devices are signed out and need the new password to sign in again. Your recovery key still works.'}</p>
                    <Submit busy={busy} busyLabel={'Changing it…'}>
                        {'Change password'}
                    </Submit>
                </form>
            )}
        </NeedsAccount>
    );
}

export function RecoveryKeyPage() {
    const s = useAccount();
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [code, setCode] = useState<string | null>(null);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            setCode(await newRecoveryKey(password));
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };
    return (
        <NeedsAccount title={'Recovery key'}>
            {code ? (
                <RecoveryKeyShow code={code} username={s.account?.user.username ?? ''} fresh onDone={() => go({ page: 'settings', sub: 'account' }, { replace: true })} />
            ) : (
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <p className="text-sm leading-relaxed">
                        {'Your recovery key sets a new password if you forget yours. Make a new one if you’ve lost it, or someone else may have seen it: the old one stops working.'}
                    </p>
                    <ErrorLine error={error} />
                    <Field label={'Password'} type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
                    <Submit busy={busy} busyLabel={'Making it…'}>
                        {'Make a new recovery key'}
                    </Submit>
                </form>
            )}
        </NeedsAccount>
    );
}

export function DevicesPage() {
    const s = useAccount();
    const [info, setInfo] = useState<AccountInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    useTicking();
    const load = () =>
        fetchAccount()
            .then(i => {
                setInfo(i);
                setError(null);
            })
            .catch(e => setError(message(e)));
    useEffect(() => {
        if (s.account) void load();
    }, [s.account?.token]);
    const outOne = async (id: string) => {
        setBusy(id);
        try {
            await signOutDevice(id);
            await load();
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(null);
        }
    };
    const outOthers = async () => {
        setBusy('all');
        try {
            await signOutOtherDevices();
            await load();
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(null);
        }
    };
    // This device first, then the rest by when they were last used.
    const sessions = [...(info?.sessions ?? [])].sort((a, b) => Number(b.current) - Number(a.current) || b.used - a.used);
    return (
        <NeedsAccount title={'Devices'}>
            <div className="space-y-4">
                <p className={`text-sm leading-relaxed ${muted}`}>
                    {'Every device signed in to your account. One signed out stops syncing; its journal stays on it.'}
                </p>
                <ErrorLine error={error} />
                {!info && !error && (
                    <p className={`flex items-center gap-2 text-sm ${muted}`}>
                        <Busy size={16} className="animate-spin" />
                        {'Loading…'}
                    </p>
                )}
                {sessions.length > 0 && (
                    <div className={settingsSection}>
                        {sessions.map(d => (
                            <SettingsListItem
                                key={d.id}
                                icon={/iPhone|Android|iPad/.test(d.device) ? Phone : Monitor}
                                title={d.device}
                                description={d.current ? 'This device' : `Last used ${ago(d.used)}`}
                                showChevron={false}
                                trailing={
                                    d.current ? null : (
                                        <button type="button" className="link-button shrink-0 text-xs font-medium" disabled={!!busy} onClick={() => void outOne(d.id)}>
                                            {busy === d.id ? 'Signing out…' : 'Sign out'}
                                        </button>
                                    )
                                }
                            />
                        ))}
                    </div>
                )}
                {sessions.length > 1 && (
                    <button className="btn-secondary w-full" disabled={!!busy} onClick={() => void outOthers()}>
                        {busy === 'all' ? 'Signing them out…' : 'Sign out every other device'}
                    </button>
                )}
            </div>
        </NeedsAccount>
    );
}

export function DeleteAccountPage() {
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await deleteAccount(password);
            setDone(true);
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };
    if (done)
        return (
            <div className="relative md:pb-32">
                <PageHeader backTo title={'Delete account'} />
                <div className={`${PAGE_COLUMN} mt-3 [&>*]:mx-auto [&>*]:max-w-sm`}>
                    <div className="m-appear space-y-4">
                        <p className="text-sm">{'Your account and its copy are deleted. Your journal is still on this device.'}</p>
                        <button className="btn-primary w-full" onClick={() => go({ page: 'settings' }, { replace: true })}>
                            {'Done'}
                        </button>
                    </div>
                </div>
            </div>
        );
    return (
        <NeedsAccount title={'Delete account'} hold={busy}>
            <form onSubmit={submit} className="space-y-4" noValidate>
                <p className="text-sm leading-relaxed">
                    {'This deletes your account and the copy of your journal it keeps, for good. The journal on this device stays, and you can still export it.'}
                </p>
                <p className={`text-sm leading-relaxed ${muted}`}>{'Other devices signed in to it stop syncing. Their journals stay on them.'}</p>
                <ErrorLine error={error} />
                <Field label={'Password'} type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
                <Submit busy={busy} busyLabel={'Deleting…'} danger>
                    {'Delete my account'}
                </Submit>
            </form>
        </NeedsAccount>
    );
}

export function RecoverPage() {
    const s = useAccount();
    const [username, setUsername] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [made, setMade] = useState<{ code: string; username: string } | null>(null);
    const id = useId();
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!USERNAME.test(username.trim())) return setError('That username and recovery key don’t go together.');
        const problem = newPasswordProblem(password);
        if (problem) return setError(problem);
        setBusy(true);
        try {
            setMade({ code: await recover(username.trim(), code, password), username: username.trim() });
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={'Forgot your password'} />
            <div className={`${PAGE_COLUMN} mt-3 [&>*]:mx-auto [&>*]:max-w-sm`}>
                {made ? (
                    <RecoveryKeyShow code={made.code} username={made.username} fresh onDone={() => go({ page: 'settings', sub: 'account' }, { replace: true })} />
                ) : s.account && !busy ? (
                    <div className="space-y-4">
                        <p className="text-sm">{`You’re signed in as ${s.account.user.username}. To set a new password, change it from your account.`}</p>
                        <button className="btn-primary w-full" onClick={() => go({ page: 'settings', sub: 'password' }, { replace: true })}>
                            {'Change password'}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4" noValidate>
                        <p className="text-sm leading-relaxed">{'Your recovery key sets a new password. It was shown when you made your account.'}</p>
                        <ErrorLine error={error} />
                        <Field label={'Username'} value={username} onChange={setUsername} autoComplete="username" autoFocus />
                        <Field label={'Recovery key'} value={code} onChange={setCode} autoComplete="off" mono placeholder="XXXX-XXXX-XXXX-XXXX-…" />
                        <div className="space-y-1.5">
                            <Field label={'New password'} type="password" value={password} onChange={setPassword} autoComplete="new-password" describedBy={`${id}-strength`} />
                            <StrengthHint id={`${id}-strength`} password={password} />
                        </div>
                        <p className="callout">{'Every device signed in to your account is signed out. You get a new recovery key, and this one stops working.'}</p>
                        <Submit busy={busy} busyLabel={'Setting it…'}>
                            {'Set the new password'}
                        </Submit>
                    </form>
                )}
            </div>
        </div>
    );
}
