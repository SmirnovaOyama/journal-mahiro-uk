import React, { useEffect, useId, useState } from 'react';
import { ApiError } from '../lib/account';
import { newPasswordLevel, type NewPasswordLevel } from '../lib/password';
import { Account as PersonIcon, CheckCircle, Copy, Download } from './icons';
import { WaitMark } from './Waiting';
import { dateLocale, tr } from '../lib/i18n';

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

export const message = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : tr('Something went wrong. Try again.'));

/** "just now", "5 min ago", "3 h ago", "on 4 Nov". */
export function ago(t: number, now = Date.now()): string {
    const s = Math.max(0, (now - t) / 1000);
    if (s < 45) return tr('just now');
    if (s < 3600) return tr('{0} min ago', { 0: Math.max(1, Math.round(s / 60)) });
    if (s < 86400) return tr('{0} h ago', { 0: Math.round(s / 3600) });
    const d = new Date(t);
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return tr('on {0}', { 0: d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }) });
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
                label={backup ? tr('Backup code') : tr('Code from your authenticator app')}
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
                {backup ? tr('Use the app’s code instead') : tr('Use a backup code instead')}
            </button>
        </div>
    );
}

const LEVEL_TEXT: Record<NewPasswordLevel, string> = {
    tooLong: 'Too long: at most 256 letters and digits.',
    weak: 'Easy to guess. Try something longer or less predictable.',
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
            {level ? tr(LEVEL_TEXT[level]) : password ? tr('At least 8 characters.') : ''}
        </p>
    );
}

/** Why a new password can't be used, or null. */
export function newPasswordProblem(password: string): string | null {
    const level = newPasswordLevel(password);
    if (!level) return tr('A password is at least 8 characters.');
    if (level === 'tooLong' || level === 'weak') return tr(LEVEL_TEXT[level]);
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
                {copied ? tr('Copied') : tr('Copy')}
            </button>
            <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => saveText(...file())}>
                <Download size={16} />
                {tr('Save as a file')}
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
                {tr('Done')}
            </button>
        </>
    );
}

/** The recovery key, shown once. */
export function RecoveryKeyShow({ code, username, fresh, onDone }: { code: string; username: string; fresh?: boolean; onDone: () => void }) {
    return (
        <div className="m-appear space-y-4">
            <div>
                <h2 className={`text-base font-semibold ${on}`}>{fresh ? tr('Your new recovery key') : tr('Your recovery key')}</h2>
                <p className={`mt-1 text-sm leading-relaxed ${muted}`}>
                    {tr('If you forget your password, use this to set a new one. Keep it somewhere safe, not on this device. It’s only shown once.')}
                    {fresh && tr(' Your old one no longer works.')}
                </p>
            </div>
            <p
                className="grid grid-cols-4 gap-x-3 gap-y-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-4 py-4 text-center font-mono text-[1.0625rem] font-medium tracking-[0.08em] text-[var(--text)] select-all max-[360px]:grid-cols-2"
                aria-label={tr('Recovery key: {0}', { 0: code.split('-').join(' ') })}
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
                        tr('Oyama Journal recovery key'),
                        '',
                        tr('Username: {0}', { 0: username }),
                        tr('Recovery key: {0}', { 0: code }),
                        '',
                        tr('If you forget your password, this sets a new one at journal.mahiro.uk, in'),
                        tr('Settings, Account, Forgot your password. Keep it somewhere safe and private.'),
                        tr('Without your password or this key, nobody can open your journal, not even'),
                        tr('the server.'),
                        '',
                    ].join('\n'),
                ]}
            />
            <KeptIt onDone={onDone} what={tr('I’ve kept it somewhere safe')} />
        </div>
    );
}

/** Ten backup codes for two-step sign-in, shown once. */
export function BackupCodesShow({ codes, username, onDone }: { codes: string[]; username: string; onDone: () => void }) {
    return (
        <div className="m-appear space-y-4">
            <div>
                <h2 className={`text-base font-semibold ${on}`}>{tr('Your backup codes')}</h2>
                <p className={`mt-1 text-sm leading-relaxed ${muted}`}>
                    {tr('If you don’t have your phone, each of these can be used once instead of a code. Keep them somewhere safe. They’re only shown once.')}
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
                    [tr('Oyama Journal backup codes'), '', tr('Username: {0}', { 0: username }), '', ...codes, '', tr('Each one can be used once instead of a code from your authenticator app.'), ''].join('\n'),
                ]}
            />
            <KeptIt onDone={onDone} what={tr('I’ve kept them somewhere safe')} />
        </div>
    );
}
