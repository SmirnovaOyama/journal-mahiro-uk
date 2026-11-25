import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
    ApiError,
    adminDelete,
    adminSignOut,
    adminStats,
    adminUnlock,
    adminUsers,
    useAccount,
    type AdminStats,
    type AdminUser,
} from '../lib/account';
import PageHeader, { PAGE_COLUMN, headerAction } from '../components/PageHeader';
import { StackedBars, type Bucket } from '../components/StackedBars';
import { rowBleed, settingsSection } from '../components/SettingsListItem';
import { Busy, ChevronDown, Lock, Retry, Search } from '../components/icons';
import { ago } from './Account';

/* The admin's page, after hrt.mahiro.uk's (pages/Admin.tsx there), for the
   one account named as the admin's (worker/api.ts). It shows what the
   server knows: accounts, devices, the size of each encrypted copy, sign-ups
   and locks. It can't show what's in a journal: every one is encrypted on
   its owner's devices with a key that never reaches the server. */

const muted = 'text-[var(--text-muted)]';
const on = 'text-[var(--text)]';
const rowBase = 'w-full min-h-14 flex items-center justify-between gap-4 py-3.5 text-start';

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

const shortDate = (t: number) =>
    new Date(t).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        ...(new Date(t).getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
    });

/** A column a day for the last 30 days (UTC days, as the server counts them). */
function signupBuckets(st: AdminStats): Bucket[] {
    const byDay = new Map(st.signups.map(d => [d.day, d.n]));
    const today = new Date(st.now);
    const out: Bucket[] = [];
    for (let k = 29; k >= 0; k--) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - k));
        const n = byDay.get(d.toISOString().slice(0, 10)) ?? 0;
        out.push({
            label: String(d.getUTCDate()),
            span: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
            parts: n ? [{ key: 'signups', value: n, color: 'var(--accent)' }] : [],
            total: n,
            counts: [],
        });
    }
    return out;
}

function Figure({ value, label, note }: { value: string; label: string; note?: string }) {
    return (
        <div>
            <div className={`font-display text-[1.5rem] font-light leading-tight tracking-[-0.02em] tabular-nums ${on}`}>{value}</div>
            <div className={`mt-0.5 text-xs ${muted}`}>{label}</div>
            {note && <div className={`text-xs ${muted} opacity-80`}>{note}</div>}
        </div>
    );
}

function Initial({ name }: { name: string }) {
    return (
        <span className={`grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-base font-light ${muted}`} aria-hidden>
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

/* ── one account ────────────────────────────────────────────────────── */

function AccountRow({ u, me, open, onToggle, onChanged }: { u: AdminUser; me: string; open: boolean; onToggle: () => void; onChanged: (gone?: boolean) => void }) {
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [password, setPassword] = useState('');
    const pwId = useId();
    const self = u.id === me;

    const run = async (what: string, f: () => Promise<void>, gone = false) => {
        setBusy(what);
        setError(null);
        try {
            await f();
            onChanged(gone);
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(null);
        }
    };

    const line = u.locked
        ? `Locked for ${Math.ceil(u.locked / 60)} min after wrong passwords`
        : `Joined ${shortDate(u.created)}, ${u.seen ? `seen ${ago(u.seen)}` : 'not seen since'}`;

    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                style={{ '--divider-inset': '3rem' } as React.CSSProperties}
                className={`${rowBase} ${rowBleed}`}
            >
                <span className="flex min-w-0 items-center gap-3">
                    <Initial name={u.username} />
                    <span className="min-w-0">
                        <span className={`flex items-center gap-1.5 text-sm font-medium ${on}`}>
                            <span className="truncate">{u.username}</span>
                            {u.admin && (
                                <span className="shrink-0 rounded-full bg-[var(--accent-subtle)] px-1.5 py-px text-[10px] font-semibold text-[var(--accent-ink)]">{'Admin'}</span>
                            )}
                        </span>
                        <span className={`mt-0.5 block truncate text-xs ${u.locked ? 'text-[var(--warning)]' : muted}`}>{line}</span>
                    </span>
                </span>
                <span className={`flex shrink-0 items-center gap-1 text-xs tabular-nums ${muted}`}>
                    {u.copy ? formatBytes(u.copy.size) : 'No copy'}
                    <ChevronDown size={16} className={`opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {open && (
                <div className="m-appear space-y-4 ps-12 pb-5">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                        <dt className={muted}>{'Devices'}</dt>
                        <dd className={`${on} tabular-nums`}>{u.devices ? plural(u.devices, 'device') + ' signed in' : 'Signed in nowhere'}</dd>
                        <dt className={muted}>{'Journal'}</dt>
                        <dd className={`${on} tabular-nums`}>
                            {u.copy ? `${formatBytes(u.copy.size)} encrypted, written ${plural(u.copy.version, 'time')}, last ${ago(u.copy.updated)}` : 'Nothing kept yet'}
                        </dd>
                        {u.misses > 0 && (
                            <>
                                <dt className={muted}>{'Wrong passwords'}</dt>
                                <dd className={`${on} tabular-nums`}>{`${u.misses} in a row`}</dd>
                            </>
                        )}
                    </dl>

                    {error && (
                        <p role="alert" className="m-appear text-sm text-[var(--danger)]">
                            {error}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={!!busy || !u.devices || (self && u.devices <= 1)}
                            onClick={() => void run('out', () => adminSignOut(u.id))}
                        >
                            {busy === 'out' ? 'Signing out…' : self ? 'Sign out my other devices' : 'Sign out everywhere'}
                        </button>
                        {(u.locked > 0 || u.misses > 0) && (
                            <button type="button" className="btn-secondary btn-sm" disabled={!!busy} onClick={() => void run('unlock', () => adminUnlock(u.id))}>
                                {busy === 'unlock' ? 'Lifting it…' : u.locked ? 'Lift the lock' : 'Forget the wrong passwords'}
                            </button>
                        )}
                        {!self && (
                            <button type="button" className="btn-danger btn-sm" disabled={!!busy} onClick={() => setDeleting(d => !d)} aria-expanded={deleting}>
                                {'Delete account'}
                            </button>
                        )}
                    </div>
                    {self && <p className={`text-xs ${muted}`}>{'Your own account is deleted from your account page.'}</p>}

                    {deleting && !self && (
                        <form
                            className="m-appear space-y-3 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-4"
                            onSubmit={e => {
                                e.preventDefault();
                                void run('delete', () => adminDelete(u.id, password), true);
                            }}
                        >
                            <p className="text-sm leading-relaxed">
                                {`Deletes ${u.username} and the encrypted copy it keeps, for good. Their devices keep their own journals and stop syncing.`}
                            </p>
                            <div className="space-y-1.5">
                                <label htmlFor={pwId} className="block text-xs font-semibold text-[var(--text-muted)]">
                                    {'Your password, to be sure it’s you'}
                                </label>
                                <input
                                    id={pwId}
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="input-base w-full text-sm"
                                    style={{ fontSize: '16px' }}
                                    autoComplete="current-password"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="submit" className="btn-danger btn-sm" disabled={!!busy || !password}>
                                    {busy === 'delete' ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Busy size={14} className="animate-spin" />
                                            {'Deleting…'}
                                        </span>
                                    ) : (
                                        `Delete ${u.username}`
                                    )}
                                </button>
                                <button type="button" className="link-button btn-sm text-sm" onClick={() => setDeleting(false)}>
                                    {'Cancel'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── the page ───────────────────────────────────────────────────────── */

export function AdminPage() {
    const s = useAccount();
    const me = s.account?.user;
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUser[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const searchId = useId();

    const load = useCallback(
        async (q: string) => {
            setLoading(true);
            try {
                const [st, us] = await Promise.all([adminStats(), adminUsers(q)]);
                setStats(st);
                setUsers(us);
                setError(null);
            } catch (e) {
                if (e instanceof ApiError && e.status === 403) setForbidden(true);
                else setError(message(e));
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    // A moment after typing stops, so each letter isn't a request.
    useEffect(() => {
        if (!me?.admin) return;
        const id = window.setTimeout(() => void load(query), query ? 300 : 0);
        return () => window.clearTimeout(id);
    }, [query, me?.admin, load]);

    const buckets = useMemo(() => (stats ? signupBuckets(stats) : []), [stats]);

    if (!me?.admin || forbidden)
        return (
            <div className="relative md:pb-32">
                <PageHeader backTo title={'Admin'} />
                <div className={`${PAGE_COLUMN} mt-3`}>
                    <p className="text-sm">{'This page is for the site’s admin.'}</p>
                </div>
            </div>
        );

    return (
        <div className="relative md:pb-32">
            <PageHeader
                backTo
                title={'Admin'}
                actions={
                    <button type="button" className={`${headerAction} tap-target`} onClick={() => void load(query)} disabled={loading}>
                        <Retry size={16} className={loading ? 'animate-spin' : ''} />
                        <span className="max-sm:hidden">{'Refresh'}</span>
                    </button>
                }
            />
            <div className={`${PAGE_COLUMN} mt-3 space-y-9 pb-10`}>
                <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--accent-ink)]">
                        <Lock size={13} />
                        {'End-to-end encrypted'}
                    </span>
                    <p className={`text-sm leading-relaxed ${muted}`}>
                        {'Every journal is encrypted on its owner’s devices, with a key that never reaches the server. This page sees accounts, devices and sizes. Nobody here can read what’s in a journal, the admin included, or reset a password: only an account’s recovery key does that.'}
                    </p>
                </div>

                {error && (
                    <p role="alert" className="m-appear text-sm text-[var(--danger)]">
                        {error}
                    </p>
                )}

                {stats ? (
                    <>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
                            <Figure value={stats.accounts.toLocaleString('en-GB')} label={'accounts'} note={`${stats.newWeek} new this week`} />
                            <Figure value={stats.activeWeek.toLocaleString('en-GB')} label={'seen this week'} />
                            <Figure value={stats.devices.toLocaleString('en-GB')} label={'devices signed in'} />
                            <Figure value={formatBytes(stats.bytes)} label={'stored, encrypted'} note={plural(stats.copies, 'journal')} />
                        </div>

                        <section>
                            <h2 className="group-heading mb-3">{'Sign-ups in the last 30 days'}</h2>
                            <StackedBars
                                buckets={buckets}
                                names={() => 'Sign-ups'}
                                idle={'A bar a day. Tap one to read it.'}
                                count={n => (n === 1 ? '1 sign-up' : `${n} sign-ups`)}
                                what={'Sign-ups a day'}
                                empty={''}
                            />
                            <p className={`mt-4 text-xs leading-relaxed ${muted}`}>
                                {`Deleted in the last 30 days: ${stats.deletedSelf} by their owners, ${stats.deletedAdmin} here.`}
                                {stats.locked > 0 && ` ${plural(stats.locked, 'account')} locked by wrong passwords now.`}
                            </p>
                        </section>
                    </>
                ) : (
                    !error && (
                        <p className={`flex items-center gap-2 text-sm ${muted}`}>
                            <Busy size={16} className="animate-spin" />
                            {'Loading…'}
                        </p>
                    )
                )}

                <section>
                    <h2 className="group-heading mb-3">{'Accounts'}</h2>
                    <label htmlFor={searchId} className="sr-only">
                        {'Find an account'}
                    </label>
                    <div className="relative mb-2">
                        <Search size={16} className={`pointer-events-none absolute start-0 top-1/2 -translate-y-1/2 ${muted}`} />
                        <input
                            id={searchId}
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={'Find by username'}
                            className="input-base w-full ps-6 text-sm"
                            style={{ fontSize: '16px' }}
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                        />
                    </div>
                    {users && users.length === 0 && <p className={`py-4 text-sm ${muted}`}>{query ? `No username has “${query}” in it.` : 'No accounts yet.'}</p>}
                    {users && users.length > 0 && (
                        <div className={settingsSection}>
                            {users.map(u => (
                                <AccountRow
                                    key={u.id}
                                    u={u}
                                    me={me.id}
                                    open={open === u.id}
                                    onToggle={() => setOpen(o => (o === u.id ? null : u.id))}
                                    onChanged={gone => {
                                        if (gone) setOpen(null);
                                        void load(query);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                    {users && users.length === 200 && <p className={`mt-3 text-xs ${muted}`}>{'The newest 200. Search to find others.'}</p>}
                </section>
            </div>
        </div>
    );
}
