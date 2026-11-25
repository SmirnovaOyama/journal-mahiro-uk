import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sessionsOf, useJournal } from '../lib/journal';
import { useAccount } from '../lib/account';
import { drawMolecule } from './Molecule';
import PixelCat from './PixelCat';
import { ago, muted, on, useTicking } from './AccountParts';
import { Cloud, Lock, Monitor, Repeat } from './icons';

/* The account as a card you'd keep in a wallet: the name, since when, and
   what's in the journal, with the structure of what's logged most drawn
   faintly across it and a cat sitting on its edge. It leans toward the
   pointer, catching a little light, and turns over to show how the journal
   is kept: the key stays with you, and the server holds a box it can't open.

   Signed out, it's the card you'd get, filling in as a name is typed. */

const FLAG_LIGHT =
    'radial-gradient(circle at var(--mx, 70%) var(--my, 20%), color-mix(in oklab, #5bcefa 22%, transparent), color-mix(in oklab, #f5a9b8 16%, transparent) 32%, transparent 62%)';

function Figure({ value, label }: { value: React.ReactNode; label: string }) {
    return (
        <div className="min-w-0">
            <div className={`font-display text-[1.375rem] font-light leading-tight tracking-[-0.02em] tabular-nums ${on}`}>{value}</div>
            <div className={`mt-0.5 truncate text-[11px] ${muted}`}>{label}</div>
        </div>
    );
}

/** The substance logged most often that has a structure to draw. */
function useWatermark(): string | null {
    const { data } = useJournal();
    const top = useMemo(() => {
        const n = new Map<string, number>();
        for (const i of data.ingestions) n.set(i.substance, (n.get(i.substance) ?? 0) + 1);
        return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    }, [data.ingestions]);
    const [markup, setMarkup] = useState<string | null>(null);
    useEffect(() => {
        let live = true;
        (async () => {
            // Down the list until one draws: something typed in isn't in the catalogue.
            for (const id of [...top.slice(0, 4), 'mdma']) {
                const m = await drawMolecule(id).catch(() => null);
                if (m) {
                    if (live) setMarkup(m);
                    return;
                }
            }
        })();
        return () => {
            live = false;
        };
    }, [top.join('|')]);
    return markup;
}

export function MemberCard({ name, since, devices, preview }: { name?: string; since?: number; devices?: number; preview?: boolean }) {
    const { data } = useJournal();
    const s = useAccount();
    useTicking();
    const [flipped, setFlipped] = useState(false);
    const card = useRef<HTMLDivElement>(null);
    const mark = useWatermark();

    const sessions = useMemo(() => sessionsOf(data.ingestions).length, [data.ingestions]);
    const substances = useMemo(() => new Set(data.ingestions.map(i => i.substance)).size, [data.ingestions]);

    // It leans a little toward the pointer, and the light follows it.
    const lean = (e: React.PointerEvent) => {
        const el = card.current;
        if (!el || e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', `${((0.5 - py) * 6).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((px - 0.5) * 8).toFixed(2)}deg`);
        el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    };
    const rest = () => {
        const el = card.current;
        if (!el) return;
        for (const k of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(k);
    };

    const syncing = s.status === 'syncing' || s.status === 'waiting';
    const status = preview
        ? 'Kept on this device'
        : s.status === 'locked'
          ? 'Locked: enter your password to sync'
          : s.status === 'offline'
            ? 'Offline: it syncs when you’re back'
            : s.status === 'error'
              ? 'Sync failed: it’ll try again'
              : s.account?.synced
                ? `In sync, ${ago(s.account.synced)}`
                : 'Syncing for the first time';
    const sinceText = since ? new Date(since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null;

    return (
        <div ref={card} className="member-card relative" data-flipped={flipped} onPointerMove={lean} onPointerLeave={rest}>
            {/* The cat sits on the card's top edge. */}
            <span className="pointer-events-none absolute -top-[26px] right-6 z-10" aria-hidden="true">
                <PixelCat pose="loaf" size={44} />
            </span>
            <div className="member-tilt">
                <div className="member-flip">
                    {/* The front */}
                    <section className="member-face member-front" aria-hidden={flipped}>
                        {mark && <span className="member-mark" dangerouslySetInnerHTML={{ __html: mark }} />}
                        <span className="member-light" style={{ background: FLAG_LIGHT }} />
                        <div className="relative flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                                <img src="/logo.png" alt="" className="size-6 rounded-[7px]" />
                                <span className="font-display text-sm">
                                    <span className="font-normal">{'Oyama'}</span> <span className={`font-light ${muted}`}>{'Journal'}</span>
                                </span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--bg)]/60 px-2 py-0.5 text-[11px] font-medium text-[var(--accent-ink)] backdrop-blur-sm">
                                <Lock size={11} />
                                <span className="sm:hidden">{'Encrypted'}</span>
                                <span className="max-sm:hidden">{'End-to-end encrypted'}</span>
                            </span>
                        </div>
                        <div className="relative mt-6 min-w-0">
                            <p className={`truncate font-display text-[1.875rem] font-normal leading-tight tracking-[-0.02em] ${name ? on : muted}`}>
                                {name || 'Your name here'}
                            </p>
                            <p className={`mt-1 text-xs ${muted}`}>{sinceText ? `Journaling since ${sinceText}` : preview ? 'A journal that follows you, and only you' : ''}</p>
                        </div>
                        <div className="relative mt-6 grid grid-cols-3 gap-3">
                            <Figure value={sessions.toLocaleString('en-GB')} label={sessions === 1 ? 'session' : 'sessions'} />
                            <Figure value={substances.toLocaleString('en-GB')} label={substances === 1 ? 'substance' : 'substances'} />
                            <Figure value={devices ?? 1} label={devices && devices > 1 ? 'devices' : 'device'} />
                        </div>
                        <div className="relative mt-5 flex items-center justify-between gap-3">
                            <span className={`flex min-w-0 items-center gap-2 text-xs ${muted}`} aria-live="polite">
                                <span className={`member-pulse ${syncing ? 'is-on' : ''} ${s.status === 'error' ? 'is-bad' : ''}`} />
                                <span className="truncate">{status}</span>
                            </span>
                            <button type="button" className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${muted} hover:text-[var(--text)]`} onClick={() => setFlipped(true)}>
                                <Repeat size={13} />
                                {'How it’s kept'}
                            </button>
                        </div>
                    </section>

                    {/* The back */}
                    <section className="member-face member-back" aria-hidden={!flipped}>
                        <span className="member-light" style={{ background: FLAG_LIGHT }} />
                        <p className={`relative font-display text-lg ${on}`}>{'Only you hold the key'}</p>
                        <div className="relative mt-4 flex items-center justify-between gap-1 text-center text-[11px]" aria-hidden="true">
                            <span className="flex w-20 flex-col items-center gap-1.5">
                                <span className="member-node">
                                    <Monitor size={18} />
                                </span>
                                <span className={muted}>{'Your device'}</span>
                            </span>
                            <span className="member-wire">
                                <span className="member-packet">
                                    <Lock size={11} />
                                </span>
                            </span>
                            <span className="flex w-20 flex-col items-center gap-1.5">
                                <span className="member-node">
                                    <Cloud size={18} />
                                </span>
                                <span className={muted}>{'The server'}</span>
                            </span>
                        </div>
                        <ul className={`relative mt-4 space-y-1.5 text-xs leading-relaxed ${on}`}>
                            <li>{'Your password never leaves your device.'}</li>
                            <li>{'Your journal is locked before it’s sent.'}</li>
                            <li>{'The server keeps a copy it can’t open. Only your password, or your recovery key, can.'}</li>
                        </ul>
                        <button type="button" className={`relative mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 -ms-2 text-xs font-medium ${muted} hover:text-[var(--text)]`} onClick={() => setFlipped(false)}>
                            <Repeat size={13} />
                            {'Turn it back'}
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}
