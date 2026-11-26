import React, { useEffect, useId, useState } from 'react';
import { ApiError } from '../lib/account';
import { newPasswordLevel, type NewPasswordLevel } from '../lib/password';
import { Account as PersonIcon, CheckCircle, Copy, Download } from './icons';
import { WaitMark } from './Waiting';

/* The pieces the account's pages are made of (pages/Account.tsx,
   pages/TwoFactor.tsx, pages/Admin.tsx): fields, the strength line under a
   new password, the error line, the submit button, a name's initial, and the
   sheets of codes that are shown once. */

export const muted = 'text-[var(--text-muted)]';
export const on = 'text-[var(--text)]';
export const labelCls = 'block text-xs font-semibold text-[var(--text-muted)]';
export const inputCls = 'input-base text-sm w-full';
export const rowBase = 'w-full min-h-14 flex items-center justify-between gap-4 py-3.5 text-start';
export const USERNAME = /^[A-Za-z0-9_-]{3,30}$/;

export const message = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Try again.');

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
export function useTicking() {
    const [, setT] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setT(t => t + 1), 30_000);
        return () => window.clearInterval(id);
    }, []);
}

export function Field({
    label,
    value,
    onChange,
    type = 'text',
    autoComplete,
    describedBy,
    mono,
    autoFocus,
    placeholder,
    inputMode,
    maxLength,
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
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    maxLength?: number;
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
                inputMode={inputMode}
                maxLength={maxLength}
                required
            />
        </div>
    );
}

/** The code from an authenticator app, or a backup code instead. */
export function CodeField({ value, onChange, autoFocus = true }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
    const [backup, setBackup] = useState(false);
    return (
        <div className="space-y-1.5">
            <Field
                label={backup ? 'Backup code' : 'Code from your authenticator app'}
                value={value}
                onChange={v => onChange(backup ? v : v.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                inputMode={backup ? 'text' : 'numeric'}
                maxLength={backup ? 12 : 6}
                placeholder={backup ? 'xxxx-xxxx' : '123456'}
                autoFocus={autoFocus}
            />
            <button
                type="button"
                className={`link-button text-xs ${muted}`}
                onClick={() => {
                    setBackup(b => !b);
                    onChange('');
                }}
            >
                {backup ? 'Use the app’s code instead' : 'Use a backup code instead'}
            </button>
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
export function StrengthHint({ id, password }: { id: string; password: string }) {
    const level = newPasswordLevel(password);
    return (
        <p id={id} className={`text-xs ${level ? LEVEL_TONE[level] : muted}`} aria-live="polite">
            {level ? LEVEL_TEXT[level] : password ? 'At least 8 characters.' : ''}
        </p>
    );
}

/** Why a new password can't be used, or null. */
export function newPasswordProblem(password: string): string | null {
    const level = newPasswordLevel(password);
    if (!level) return 'A password is at least 8 characters.';
    if (level === 'tooLong' || level === 'weak') return LEVEL_TEXT[level];
    return null;
}

export function ErrorLine({ id, error }: { id?: string; error: string | null }) {
    if (!error) return null;
    return (
        <p id={id} role="alert" className="m-appear text-sm text-[var(--danger)]">
            {error}
        </p>
    );
}

export function Submit({
    busy,
    busyLabel,
    children,
    danger,
    disabled,
}: {
    busy: boolean;
    busyLabel: string;
    children: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
}) {
    return (
        <button type="submit" disabled={busy || disabled} className={`${danger ? 'btn-danger' : 'btn-primary'} w-full`}>
            {busy ? (
                <span className="inline-flex items-center gap-2">
                    <WaitMark />
                    {busyLabel}
                </span>
            ) : (
                children
            )}
        </button>
    );
}

/** A circle with the name's first letter, or a person for nobody yet. */
export function Avatar({ name, size = 'md' }: { name?: string; size?: 'md' | 'lg' }) {
    const box = size === 'lg' ? 'size-14 text-[1.5rem]' : 'size-9 text-base';
    return (
        <span className={`${box} grid shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] font-light ${muted}`} aria-hidden>
            {name ? name.charAt(0).toUpperCase() : <PersonIcon size={18} />}
        </span>
    );
}

function saveText(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Copy, and save as a file: under every sheet of codes. */
function CopySave({ text, file }: { text: string; file: () => [string, string] }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="flex gap-2">
            <button
                type="button"
                className="btn-secondary btn-sm flex-1"
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(text);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1800);
                    } catch {
                        /* it's on screen to copy by hand */
                    }
                }}
            >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => saveText(...file())}>
                <Download size={16} />
                {'Save as a file'}
            </button>
        </div>
    );
}

/** "I've kept it", then Done: a sheet of codes can't be closed unread. */
function KeptIt({ onDone, what }: { onDone: () => void; what: string }) {
    const [kept, setKept] = useState(false);
    const id = useId();
    return (
        <>
            <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input id={id} type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={kept} onChange={e => setKept(e.target.checked)} />
                <span>{what}</span>
            </label>
            <button type="button" className="btn-primary w-full" disabled={!kept} onClick={onDone}>
                {'Done'}
            </button>
        </>
    );
}

/** The recovery key, shown once. */
export function RecoveryKeyShow({ code, username, fresh, onDone }: { code: string; username: string; fresh?: boolean; onDone: () => void }) {
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
            <CopySave
                text={code}
                file={() => [
                    `oyama-journal-recovery-key-${username}.txt`,
                    [
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
                    ].join('\n'),
                ]}
            />
            <KeptIt onDone={onDone} what={'I’ve kept it somewhere safe'} />
        </div>
    );
}

/** Ten backup codes for two-step sign-in, shown once. */
export function BackupCodesShow({ codes, username, onDone }: { codes: string[]; username: string; onDone: () => void }) {
    return (
        <div className="m-appear space-y-4">
            <div>
                <h2 className={`text-base font-semibold ${on}`}>{'Your backup codes'}</h2>
                <p className={`mt-1 text-sm leading-relaxed ${muted}`}>
                    {'If your phone isn’t to hand, each of these signs you in once in place of a code. Keep them somewhere safe: they’re shown only now.'}
                </p>
            </div>
            <ol className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-5 py-4 font-mono text-[0.9375rem] font-medium tracking-[0.06em] text-[var(--text)] select-all">
                {codes.map(c => (
                    <li key={c}>{c}</li>
                ))}
            </ol>
            <CopySave
                text={codes.join('\n')}
                file={() => [
                    `oyama-journal-backup-codes-${username}.txt`,
                    ['Oyama Journal backup codes', '', `Username: ${username}`, '', ...codes, '', 'Each one signs you in once, in place of a code from your authenticator app.', ''].join('\n'),
                ]}
            />
            <KeptIt onDone={onDone} what={'I’ve kept them somewhere safe'} />
        </div>
    );
}
