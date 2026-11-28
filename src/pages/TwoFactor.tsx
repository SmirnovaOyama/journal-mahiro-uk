import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { disableTwoFactor, enableTwoFactor, fetchAccount, renewBackupCodes, setupTwoFactor, useAccount, type AccountInfo } from '../lib/account';
import { NeedsAccount } from './Account';
import { BackupCodesShow, CodeField, ErrorLine, Field, Submit, message, muted, on } from '../components/AccountParts';
import Doodle from '../components/Doodle';
import { CheckCircle, Copy, External, Shield } from '../components/icons';
import { Waiting } from '../components/Waiting';
import { tr } from '../lib/i18n';

/* Two-step sign-in, as hrt.mahiro.uk has it (pages/TwoFactor.tsx there): a
   code from an authenticator app, as well as the password, to sign in on a
   new device or set a new password with the recovery key. Turning it on goes
   in three steps: scan the secret, confirm with its first code (and the
   password), keep the backup codes. */

type Step = 'intro' | 'scan' | 'confirm' | 'codes';

function Steps({ step }: { step: Exclude<Step, 'intro'> }) {
    const order: Exclude<Step, 'intro'>[] = ['scan', 'confirm', 'codes'];
    const names = { scan: tr('Scan'), confirm: tr('Confirm'), codes: tr('Keep the codes') } as const;
    const at = order.indexOf(step);
    return (
        <ol className="mb-6 flex items-center gap-2 text-xs" aria-label={tr('Steps')}>
            {order.map((s, i) => (
                <li key={s} className="flex items-center gap-2" aria-current={s === step ? 'step' : undefined}>
                    <span
                        className={`grid size-5 place-items-center rounded-full text-[11px] font-semibold tabular-nums ${
                            i < at ? 'bg-[var(--accent)] text-[var(--bg)]' : i === at ? 'bg-[var(--text)] text-[var(--bg)]' : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                        }`}
                    >
                        {i < at ? '✓' : i + 1}
                    </span>
                    <span className={i === at ? `font-medium ${on}` : muted}>{names[s]}</span>
                    {i < order.length - 1 && <span className="mx-1 h-px w-4 bg-[var(--border)]" aria-hidden="true" />}
                </li>
            ))}
        </ol>
    );
}

export function TwoFactorPage() {
    const s = useAccount();
    const username = s.account?.user.username ?? '';
    const [info, setInfo] = useState<AccountInfo | null>(null);
    const [step, setStep] = useState<Step>('intro');
    const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
    const [codes, setCodes] = useState<string[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [acting, setActing] = useState<'off' | 'renew' | null>(null);
    const [copied, setCopied] = useState(false);

    const load = useCallback(() => {
        if (!s.account) return;
        fetchAccount()
            .then(setInfo)
            .catch(e => setError(message(e)));
    }, [s.account?.token]);
    useEffect(load, [load]);

    const run = async (f: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await f();
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    };

    const tf = info?.twoFactor;
    const done = () => {
        setCodes(null);
        setStep('intro');
        setActing(null);
        setPassword('');
        setCode('');
        load();
    };

    let body: React.ReactNode;
    if (!info) {
        body = error ? (
            <ErrorLine error={error} />
        ) : (
            <Waiting />
        );
    } else if (codes) {
        body = <BackupCodesShow codes={codes} username={username} onDone={done} />;
    } else if (tf?.on) {
        body = (
            <div className="space-y-6">
                <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent-ink)]">
                        <Shield size={20} />
                    </span>
                    <div>
                        <p className={`text-sm font-semibold ${on}`}>{tr('Two-step sign-in is on')}</p>
                        <p className={`mt-0.5 text-xs leading-relaxed ${muted}`}>
                            {tr('Signing in on a new device asks for a code from your app. {0} backup {1} left.', { 0: tf.backupCodes, 1: tf.backupCodes === 1 ? 'code is' : 'codes are' })}
                        </p>
                    </div>
                </div>
                {tf.backupCodes <= 3 && <p className="callout">{tr('You’re running low on backup codes. Create new ones while you have your phone.')}</p>}
                <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary btn-sm" aria-expanded={acting === 'renew'} onClick={() => setActing(a => (a === 'renew' ? null : 'renew'))}>
                        {tr('New backup codes')}
                    </button>
                    <button type="button" className="btn-danger btn-sm" aria-expanded={acting === 'off'} onClick={() => setActing(a => (a === 'off' ? null : 'off'))}>
                        {tr('Turn it off')}
                    </button>
                </div>
                {acting && (
                    <form
                        className="m-appear space-y-4 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-4"
                        onSubmit={e => {
                            e.preventDefault();
                            void run(async () => {
                                if (acting === 'renew') setCodes(await renewBackupCodes(password, code));
                                else {
                                    await disableTwoFactor(password, code);
                                    done();
                                }
                            });
                        }}
                        noValidate
                    >
                        <p className="text-sm leading-relaxed">
                            {acting === 'renew'
                                ? tr('You get ten new backup codes, and your current ones stop working.')
                                : tr('Signing in will ask for your password only. Your backup codes stop working.')}
                        </p>
                        <ErrorLine error={error} />
                        <Field label={tr('Password')} type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
                        <CodeField value={code} onChange={setCode} autoFocus={false} />
                        <Submit busy={busy} busyLabel={acting === 'renew' ? tr('Creating…') : tr('Turning it off…')} danger={acting === 'off'} disabled={!password || !code}>
                            {acting === 'renew' ? tr('Create new backup codes') : tr('Turn two-step sign-in off')}
                        </Submit>
                    </form>
                )}
            </div>
        );
    } else if (step === 'intro') {
        body = (
            <div className="space-y-6">
                <div className="flex flex-col items-center text-center">
                    <Doodle name="lock" size={4} />
                    <p className={`mt-4 text-base font-semibold ${on}`}>{tr('Extra protection for your account')}</p>
                    <p className={`mt-1.5 text-sm leading-relaxed ${muted}`}>
                        {tr('With two-step sign-in, a new device needs a six-digit code from an app on your phone as well as your password. Someone who learns your password still can’t get in.')}
                    </p>
                </div>
                <p className={`text-xs leading-relaxed ${muted}`}>
                    {tr('Any authenticator app works: Apple Passwords, Google Authenticator, 1Password, Bitwarden, Aegis, Ente Auth.')}
                </p>
                <ErrorLine error={error} />
                <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={busy}
                    onClick={() =>
                        void run(async () => {
                            setSetup(await setupTwoFactor());
                            setStep('scan');
                        })
                    }
                >
                    {busy ? tr('Starting…') : tr('Set it up')}
                </button>
            </div>
        );
    } else if (step === 'scan' && setup) {
        const grouped = setup.secret.match(/.{1,4}/g)!.join(' ');
        body = (
            <div className="space-y-5">
                <Steps step="scan" />
                <p className="text-sm leading-relaxed">{tr('Scan this with your authenticator app, or if you’re on your phone, open it in the app.')}</p>
                {/* Dark on white whatever the theme: some cameras won't read a light-on-dark code. */}
                <div className="mx-auto w-fit rounded-[var(--radius-md)] bg-white p-3 shadow-[inset_0_0_0_var(--hairline)_var(--border)]">
                    <QRCodeSVG value={setup.uri} size={176} bgColor="#ffffff" fgColor="#1a1714" level="M" marginSize={0} />
                </div>
                <a href={setup.uri} className="btn-secondary btn-sm w-full no-underline">
                    <External size={15} />
                    {tr('Open in an authenticator app')}
                </a>
                <div className="space-y-1.5">
                    <p className={`text-xs ${muted}`}>{tr('Or type in this key:')}</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 select-all rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-sm tracking-wide text-[var(--text)]">{grouped}</code>
                        <button
                            type="button"
                            className="btn-secondary btn-sm"
                            aria-label={tr('Copy the key')}
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(setup.secret);
                                    setCopied(true);
                                    window.setTimeout(() => setCopied(false), 1800);
                                } catch {
                                    /* it's on screen */
                                }
                            }}
                        >
                            {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                        </button>
                    </div>
                </div>
                <button type="button" className="btn-primary w-full" onClick={() => setStep('confirm')}>
                    {tr('Next')}
                </button>
            </div>
        );
    } else {
        body = (
            <form
                className="space-y-5"
                onSubmit={e => {
                    e.preventDefault();
                    void run(async () => {
                        setCodes(await enableTwoFactor(password, code));
                        setStep('codes');
                    });
                }}
                noValidate
            >
                <Steps step="confirm" />
                <p className="text-sm leading-relaxed">{tr('Enter the code your app shows now, and your password, to turn it on.')}</p>
                <ErrorLine error={error} />
                <Field
                    label={tr('Code from your authenticator app')}
                    value={code}
                    onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    autoFocus
                />
                <Field label={tr('Password')} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
                <Submit busy={busy} busyLabel={tr('Turning it on…')} disabled={code.length !== 6 || !password}>
                    {tr('Turn it on')}
                </Submit>
                <button type="button" className="link-button w-full text-center text-sm" onClick={() => setStep('scan')}>
                    {tr('Back to the QR code')}
                </button>
            </form>
        );
    }

    return (
        <NeedsAccount title={tr('Two-step sign-in')}>
            {body}
            {info && !codes && (
                <p className={`mt-8 text-xs leading-relaxed ${muted}`}>
                    {tr('Lost your phone? A backup code signs you in instead, once each. Lost those too? The site’s admin can turn two-step sign-in off for you, once they know it’s you.')}
                </p>
            )}
        </NeedsAccount>
    );
}
