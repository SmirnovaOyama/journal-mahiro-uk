import React, { useCallback, useEffect, useId, useState } from 'react';
import { go, type SettingsSub } from '../lib/router';
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
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { SettingsListItem, settingsSection } from '../components/SettingsListItem';
import { SettingsTile } from '../components/SettingsTile';
import Tabs, { useSwitchAnimation } from '../components/Tabs';
import { ProfileHeader } from '../components/ProfileHeader';
import Point from '../components/Point';
import {
    CodeField,
    ErrorLine,
    Field,
    RecoveryKeyShow,
    StrengthHint,
    Submit,
    USERNAME,
    ago,
    message,
    muted,
    newPasswordProblem,
    on,
    useTicking,
} from '../components/AccountParts';
import { useWide } from '../hooks/useWide';
import {
    Account as PersonIcon,
    Alert,
    CheckCircle,
    Close,
    Cloud,
    CloudOff,
    Codes,
    Devices,
    Lock,
    Logout,
    Monitor,
    Password,
    Phone,
    Server,
    Shield,
    Trash,
} from '../components/icons';
import { WaitMark, Waiting } from '../components/Waiting';

export { ago } from '../components/AccountParts';

/* The account, laid out as Settings is: on a phone, the card and then a tile
   for each part, each opening its own page; on a wide window, the card and
   the same parts as tabs under it. Signing out, and deleting the account,
   come last. Signed out: the card it would be, filling in as a name is
   typed, and the forms. (After hrt.mahiro.uk's pages/Account.tsx.) */

const sectionLabel = 'text-xs font-semibold mb-2 block text-[var(--text-muted)]';

/** The parts of the account, as tiles on a phone and tabs on a wide window. */
type Part = 'sync' | 'security' | 'devices';
const PARTS: readonly Part[] = ['sync', 'security', 'devices'];

/** What the server says about the account: its devices, its copy, two-step sign-in. */
function useAccountInfo(token: string | undefined) {
    const [info, setInfo] = useState<AccountInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const load = useCallback(() => {
        if (!token) return Promise.resolve();
        return fetchAccount()
            .then(i => {
                setInfo(i);
                setError(null);
                refreshUser(i.user);
            })
            .catch(e => setError(message(e)));
    }, [token]);
    useEffect(() => {
        void load();
    }, [load]);
    return { info, error, reload: load };
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
            return <WaitMark size={20} className={muted} />;
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
    if (!s.account) return s.error ? 'Signed out: sign in to keep syncing' : 'Sync your journal across devices';
    if (s.status === 'synced' || s.status === 'waiting' || s.status === 'syncing')
        return s.account.synced ? `${STATUS_TITLE[s.status === 'syncing' ? 'syncing' : 'synced']}, ${ago(s.account.synced)}` : STATUS_TITLE[s.status];
    return STATUS_TITLE[s.status];
}

/** Settings' tile for the account, like its General, Data and About. */
export function AccountTile() {
    const s = useAccount();
    useTicking();
    const name = s.account?.user.username;
    return (
        <SettingsTile
            Icon={PersonIcon}
            label={'Account'}
            hint={name ? `${name}, ${syncLine(s).replace(/^./, c => c.toLowerCase())}` : syncLine(s)}
            hintTone={s.status === 'error' || (!s.account && s.error) ? 'text-[var(--warning)]' : undefined}
            onClick={() => go({ page: 'settings', sub: 'account' })}
        />
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

/* ── the parts ──────────────────────────────────────────────────────── */

function SyncPart({ s, info }: { s: AccountState; info: AccountInfo | null }) {
    const account = s.account!;
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
    const copy = info?.vault;
    return (
        <div className="space-y-8">
            <section>
                <div className={settingsSection}>
                    <SettingsListItem
                        icon={<SyncIcon status={status} />}
                        title={STATUS_TITLE[status]}
                        description={desc}
                        showChevron={false}
                        trailing={
                            status === 'locked' ? null : (
                                <button type="button" className="link-button shrink-0 text-xs font-medium" disabled={status === 'syncing'} onClick={() => void syncNow()}>
                                    {'Sync now'}
                                </button>
                            )
                        }
                    />
                    {status === 'locked' && <UnlockForm />}
                </div>
                <p className={`mt-2 text-xs leading-relaxed ${muted}`}>
                    {'It syncs on its own: a moment after a change, when you come back to the page, and every two minutes while it’s open.'}
                </p>
            </section>
            <section>
                <span className={sectionLabel}>{'In your account'}</span>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                    <dt className={muted}>{'What syncs'}</dt>
                    <dd className={on}>{'Your journal, its notes and ratings, and your saved substances'}</dd>
                    <dt className={muted}>{'Kept as'}</dt>
                    <dd className={on}>{copy ? `${(copy.size / 1024).toFixed(copy.size < 10240 ? 1 : 0)} KB, encrypted on this device` : 'Nothing yet'}</dd>
                    {copy && (
                        <>
                            <dt className={muted}>{'Written'}</dt>
                            <dd className={`${on} tabular-nums`}>{`${copy.version.toLocaleString('en-GB')} ${copy.version === 1 ? 'time' : 'times'}, last ${ago(copy.updated)}`}</dd>
                        </>
                    )}
                </dl>
            </section>
        </div>
    );
}

function SecurityPart({ info }: { info: AccountInfo | null }) {
    const tf = info?.twoFactor;
    return (
        <div className={settingsSection}>
            <SettingsListItem icon={Password} title={'Change password'} description={'Signs your other devices out'} onClick={() => go({ page: 'settings', sub: 'password' })} />
            <SettingsListItem
                icon={Shield}
                title={'Two-step sign-in'}
                description={tf?.on ? `On, ${tf.backupCodes} backup ${tf.backupCodes === 1 ? 'code' : 'codes'} left` : 'A code from an app as well as your password'}
                onClick={() => go({ page: 'settings', sub: 'two-factor' })}
                trailing={tf ? <span className={`shrink-0 text-xs ${tf.on ? 'text-[var(--accent-ink)] font-medium' : muted}`}>{tf.on ? 'On' : 'Off'}</span> : null}
            />
            <SettingsListItem icon={Codes} title={'Recovery key'} description={'Make a new one if yours is lost'} onClick={() => go({ page: 'settings', sub: 'recovery-key' })} />
        </div>
    );
}

function DevicesPart({ info, reload }: { info: AccountInfo | null; reload: () => Promise<void> }) {
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const run = async (what: string, f: () => Promise<void>) => {
        setBusy(what);
        try {
            await f();
            await reload();
            setError(null);
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(null);
        }
    };
    // This device first, then the rest by when they were last used.
    const sessions = [...(info?.sessions ?? [])].sort((a, b) => Number(b.current) - Number(a.current) || b.used - a.used);
    return (
        <div className="space-y-4">
            <p className={`text-sm leading-relaxed ${muted}`}>{'Every device signed in to your account. One signed out stops syncing; its journal stays on it.'}</p>
            <ErrorLine error={error} />
            {!info && !error && (
                <Waiting />
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
                                    <button type="button" className="link-button shrink-0 text-xs font-medium" disabled={!!busy} onClick={() => void run(d.id, () => signOutDevice(d.id))}>
                                        {busy === d.id ? 'Signing out…' : 'Sign out'}
                                    </button>
                                )
                            }
                        />
                    ))}
                </div>
            )}
            {sessions.length > 1 && (
                <button className="btn-secondary w-full" disabled={!!busy} onClick={() => void run('all', signOutOtherDevices)}>
                    {busy === 'all' ? 'Signing them out…' : 'Sign out every other device'}
                </button>
            )}
        </div>
    );
}

/* ── the account page ───────────────────────────────────────────────── */

const PART_INFO: Record<Part, { label: string; Icon: React.ElementType }> = {
    sync: { label: 'Sync', Icon: Cloud },
    security: { label: 'Security', Icon: Shield },
    devices: { label: 'Devices', Icon: Devices },
};

/** The account, or one part of it (`sub`): /settings/account, /settings/sync,
 *  /settings/security, /settings/devices. */
export function AccountPage({ sub = 'account' }: { sub?: SettingsSub }) {
    const s = useAccount();
    // Making an account signs in before its recovery key is shown: the form
    // stays until the key is in hand, then the key, then the account.
    const [making, setMaking] = useState(false);
    const [made, setMade] = useState<{ code: string; username: string } | null>(null);
    if (made)
        return (
            <div className="relative md:pb-32">
                <PageHeader backTo title={'Recovery key'} />
                <div className={`${PAGE_COLUMN} mt-3 [&>*]:mx-auto [&>*]:max-w-sm`}>
                    <RecoveryKeyShow
                        code={made.code}
                        username={made.username}
                        onDone={() => {
                            setMade(null);
                            // The admin's account goes on to its second step.
                            if (s.account?.user.admin) go({ page: 'settings', sub: 'two-factor' });
                        }}
                    />
                </div>
            </div>
        );
    if (!s.account || making)
        return (
            <div className="relative md:pb-32">
                <PageHeader backTo title={'Account'} />
                <SignedOut note={s.error} onMaking={setMaking} onMade={setMade} />
            </div>
        );
    return <SignedIn s={s} sub={sub} />;
}

function SignedIn({ s, sub }: { s: AccountState; sub: SettingsSub }) {
    const account = s.account!;
    const wide = useWide();
    const { info, reload } = useAccountInfo(account.token);
    useTicking();
    const part: Part | null = (PARTS as readonly string[]).includes(sub) ? (sub as Part) : null;
    const anim = useSwitchAnimation(part ?? 'sync', PARTS);

    const content = (p: Part) =>
        p === 'sync' ? <SyncPart s={s} info={info} /> : p === 'security' ? <SecurityPart info={info} /> : <DevicesPart info={info} reload={reload} />;

    // A phone opened on one part: that part, as its own page.
    if (!wide && part)
        return (
            <div className="relative md:pb-32">
                <PageHeader backTo title={PART_INFO[part].label} />
                <div className={`${PAGE_COLUMN} mt-3 pb-8`}>{content(part)}</div>
            </div>
        );

    const devices = info?.sessions.length;
    // The admin page opens only with two-step sign-in on.
    const adminLocked = info ? !info.twoFactor.on : false;
    const adminHint = adminLocked ? 'Turn on two-step sign-in first' : 'Accounts, devices, storage and sign-ups';
    const adminTone = adminLocked ? 'text-[var(--warning)]' : undefined;
    const hints: Record<Part, string> = {
        sync: syncLine(s),
        security: info?.twoFactor.on ? 'Two-step sign-in is on' : 'Password, two-step sign-in',
        devices: devices ? `${devices} signed in` : 'Where you’re signed in',
    };

    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={'Account'} />
            <div className={`${PAGE_COLUMN} mt-3 space-y-8 pb-8`}>
                <ProfileHeader name={account.user.username} since={account.user.created} devices={devices} />

                {wide ? (
                    <div>
                        <Tabs
                            tabs={PARTS.map(id => ({ id, label: PART_INFO[id].label }))}
                            value={part ?? 'sync'}
                            onChange={p => go({ page: 'settings', sub: p }, { replace: true })}
                            className="mb-4"
                        />
                        <div key={part ?? 'sync'} className={anim}>
                            {content(part ?? 'sync')}
                        </div>
                    </div>
                ) : (
                    <div className={settingsSection}>
                        {PARTS.map(id => (
                            <SettingsTile
                                key={id}
                                Icon={PART_INFO[id].Icon}
                                label={PART_INFO[id].label}
                                hint={hints[id]}
                                hintTone={id === 'sync' && s.status === 'error' ? 'text-[var(--warning)]' : undefined}
                                onClick={() => go({ page: 'settings', sub: id })}
                            />
                        ))}
                        {account.user.admin && (
                            <SettingsTile Icon={Server} label={'Admin'} hint={adminHint} hintTone={adminTone} onClick={() => go({ page: 'settings', sub: 'admin' })} />
                        )}
                    </div>
                )}

                {/* On a wide window the parts are tabs; the admin's is a tile of its own. */}
                {wide && account.user.admin && (
                    <div className={settingsSection}>
                        <SettingsTile Icon={Server} label={'Admin'} hint={adminHint} hintTone={adminTone} onClick={() => go({ page: 'settings', sub: 'admin' })} />
                    </div>
                )}

                <LeaveTiles />
            </div>
        </div>
    );
}

/** Signing out, and deleting the account: the last tiles, as Settings would
 *  have them. Signing out asks, under its tile, what to do with the journal
 *  on this device. */
function LeaveTiles() {
    const [asking, setAsking] = useState(false);
    const [busy, setBusy] = useState(false);
    const out = async (keepHere: boolean) => {
        setBusy(true);
        await signOut(keepHere);
        setBusy(false);
    };
    return (
        <div className={settingsSection}>
            <SettingsTile
                Icon={Logout}
                label={'Sign out'}
                hint={'Your journal stays in your account'}
                onClick={() => setAsking(a => !a)}
                chevron={false}
                expanded={asking}
            />
            {asking && (
                <div className="m-appear space-y-3 ps-12 pb-4">
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
            <SettingsTile
                Icon={Trash}
                label={'Delete account'}
                hint={'It and the copy it keeps, for good'}
                onClick={() => go({ page: 'settings', sub: 'delete-account' })}
                danger
            />
        </div>
    );
}

/* ── signed out ─────────────────────────────────────────────────────── */

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
    const [code, setCode] = useState('');
    const [needCode, setNeedCode] = useState(false);
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
        if (needCode && !code.trim()) return setError('Enter the code from your authenticator app.');
        setBusy(true);
        if (!isLogin) onMaking(true);
        try {
            if (isLogin) await signIn(name, password, needCode ? code : undefined);
            else onMade({ code: await signUp(name, password), username: name });
            dismissNote();
        } catch (err) {
            if (err instanceof ApiError && err.code === 'CODE_REQUIRED') {
                // The password was right: now the second step.
                setNeedCode(true);
                setCode('');
            } else if (err instanceof ApiError && err.code === 'ADMIN_NOT_MADE') {
                // The admin's first sign-in makes the admin's account: its
                // recovery key, then two-step sign-in.
                onMaking(true);
                try {
                    onMade({ code: await signUp(name, password), username: name });
                    dismissNote();
                } catch (e) {
                    setError(message(e));
                }
            } else setError(message(err));
        } finally {
            setBusy(false);
            onMaking(false);
        }
    };

    return (
        <div className={`${PAGE_COLUMN} mt-3 [&>*]:mx-auto [&>*]:max-w-sm`}>
            {note && (
                <div className="callout m-appear mb-6 flex items-start gap-2" role="status">
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
                    setNeedCode(false);
                }}
                className="mb-5"
            />
            <div key={tab} className={anim}>
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <ErrorLine id={`${formId}-error`} error={error} />
                    <Field
                        label={'Username'}
                        value={username}
                        onChange={v => {
                            setUsername(v);
                            setNeedCode(false);
                        }}
                        autoComplete="username"
                        describedBy={error ? `${formId}-error` : undefined}
                    />
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
                    {isLogin && needCode && (
                        <div className="m-appear space-y-3">
                            <p className="callout">{'Two-step sign-in is on for this account.'}</p>
                            <CodeField value={code} onChange={setCode} />
                        </div>
                    )}
                    {isLogin ? (
                        !needCode && <p className={`text-xs leading-relaxed ${muted}`}>{'What’s in this browser’s journal is added to your account’s.'}</p>
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

/* ── its own pages ──────────────────────────────────────────────────── */

/** A page that needs an account: signed out, it says so. */
export function NeedsAccount({ title, hold, children }: { title: string; hold?: boolean; children: React.ReactNode }) {
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
                    <button className="btn-primary w-full" onClick={() => go({ page: 'settings', sub: 'security' }, { replace: true })}>
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
                <RecoveryKeyShow code={code} username={s.account?.user.username ?? ''} fresh onDone={() => go({ page: 'settings', sub: 'security' }, { replace: true })} />
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

/** /settings/devices on a phone is the Devices part as its own page. */
export function DevicesPage() {
    return <AccountPage sub="devices" />;
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
    const [otp, setOtp] = useState('');
    const [needOtp, setNeedOtp] = useState(false);
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
        if (needOtp && !otp.trim()) return setError('Enter the code from your authenticator app, or a backup code.');
        setBusy(true);
        try {
            setMade({ code: await recover(username.trim(), code, password, needOtp ? otp : undefined), username: username.trim() });
        } catch (err) {
            if (err instanceof ApiError && err.code === 'CODE_REQUIRED') setNeedOtp(true);
            else setError(message(err));
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
                        {needOtp && (
                            <div className="m-appear space-y-3">
                                <p className="callout">{'Two-step sign-in is on for this account: the code from your app, or a backup code, as well.'}</p>
                                <CodeField value={otp} onChange={setOtp} />
                            </div>
                        )}
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
