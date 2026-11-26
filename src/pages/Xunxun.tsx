import { useEffect, useRef } from 'react';
import { sparkleFrom } from '../lib/eggs';
import { pushRecent, useSaved } from '../lib/store';
import { PICTURES, XUNXUN_ID, xunxunAliases, xunxunName, xunxunSections, xunxunWhat } from '../lib/xunxun';
import PageHeader, { PAGE_COLUMN, headerAction, headerActionAccent } from '../components/PageHeader';
import { Heart } from '../components/icons';
import { tr } from '../lib/i18n';

/* 寻寻's page, set out as a substance's is (pages/Substance.tsx): the name
   as the title with the heart to save it, the reading block with the
   picture where the structure is drawn, what it is and what else it's
   called, then the sections a substance has, each holding a stanza
   (lib/xunxun.ts), in the reader's language. No dose and nothing to log. A second picture closes it:
   asleep under a cherry tree, in the light of dusk (graded into the file).
   Hearts the first time it opens on a visit, and again at a tap on the
   picture. */

let burst = false;

export function Xunxun() {
    const saved = useSaved();
    const isSaved = saved.ids.includes(XUNXUN_ID);
    const picture = useRef<HTMLImageElement>(null);
    const name = xunxunName();
    const muted = 'text-[var(--text-muted)]';

    useEffect(() => {
        pushRecent(XUNXUN_ID);
        document.title = xunxunName();
        if (burst) return;
        burst = true;
        const id = window.setTimeout(() => sparkleFrom(picture.current), 350);
        return () => window.clearTimeout(id);
    }, []);

    return (
        <>
            <PageHeader
                title={name}
                backTo
                actions={
                    <button
                        type="button"
                        className={`${isSaved ? headerActionAccent : headerAction} tap-target max-sm:w-9 max-sm:justify-center max-sm:px-0`}
                        aria-pressed={isSaved}
                        aria-label={isSaved ? tr('Saved', undefined, 'bookmark') : tr('Save', undefined, 'bookmark')}
                        onClick={() => saved.toggle(XUNXUN_ID)}
                    >
                        <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
                        <span className="max-sm:hidden">{isSaved ? tr('Saved', undefined, 'bookmark') : tr('Save', undefined, 'bookmark')}</span>
                    </button>
                }
            />

            <header className="pt-2 pb-5 border-b-(length:--hairline) border-[var(--border)]">
                <div className={PAGE_COLUMN}>
                    <div className="flex items-center gap-4">
                        <img
                            ref={picture}
                            src={PICTURES[XUNXUN_ID]}
                            alt=""
                            width={112}
                            height={112}
                            decoding="async"
                            draggable={false}
                            className="block size-28 flex-none rounded-3xl cursor-pointer select-none"
                            onClick={e => sparkleFrom(e.currentTarget)}
                        />
                        <div className="min-w-0">
                            <p className="text-sm text-[var(--text)]">{xunxunWhat()}</p>
                            <p className={`text-xs ${muted} mt-1`}>
                                {tr('Also called ')}
                                {xunxunAliases()}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className={`${PAGE_COLUMN} pt-5 pb-10 md:pb-32 flex flex-col gap-10`}>
                {xunxunSections().map(s => (
                    <section key={s.title}>
                        <h2 className="text-sm font-medium text-[var(--text)] mb-1">{tr(s.title)}</h2>
                        <p className="text-sm leading-loose text-[var(--text)]">
                            {s.lines.map(l => (
                                <span key={l} className="block">{l}</span>
                            ))}
                        </p>
                    </section>
                ))}
                <img
                    src="/xunxun-dusk.webp"
                    alt=""
                    width={960}
                    height={536}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="block w-full h-auto rounded-3xl select-none"
                />
            </main>
        </>
    );
}
