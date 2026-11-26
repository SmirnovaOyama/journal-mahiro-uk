import { useEffect, useState } from 'react';
import { useOpenedFromLink } from '../lib/router';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import Doodle, { type DoodleName } from '../components/Doodle';
import { Linked } from '../components/Linked';
import { isZh, tr } from '../lib/i18n';

export type CaseReport = {
    id: string;
    title: string;
    summary: string;
    /** A line of dedication, set under the picture. */
    epigraph?: string;
    /** Last words, set after the sections: each a few lines kept together. */
    closing?: string[][];
    /** A picture set above the last words. */
    closingPicture?: { src: string; alt: string; width: number; height: number };
    source: string;
    url: string;
    picture?: { src: string; alt: string; credit?: string };
    sections: { heading: string; icon?: DoodleName; paragraphs: string[] }[];
};

const cache = new Map<string, Promise<CaseReport | null>>();
/** A report in the reader's language: its 正體中文 telling
 *  (<id>.zh-Hant.json) where there is one, else the English. */
export function loadReport(id: string) {
    const zh = isZh();
    const key = `${id}|${zh ? 'zh' : 'en'}`;
    let p = cache.get(key);
    if (!p) {
        const get = (name: string) =>
            fetch(`/data/reports/${encodeURIComponent(name)}.json`).then(r => (r.ok ? (r.json() as Promise<CaseReport>) : null));
        p = (zh ? get(`${id}.zh-Hant`).catch(() => null).then(r => r ?? get(id)) : get(id)).catch(() => null);
        cache.set(key, p);
    }
    return p;
}

/** A case report a warning rests on, read in full on its own page. */
export function Report({ id }: { id: string }) {
    const fromLink = useOpenedFromLink();
    const [report, setReport] = useState<CaseReport | null | undefined>(undefined);
    useEffect(() => {
        let live = true;
        loadReport(id).then(r => live && setReport(r));
        return () => { live = false; };
    }, [id]);
    useEffect(() => {
        if (report) document.title = report.title;
    }, [report]);

    return (
        <>
            <PageHeader title={report ? report.title.replace(/[:：].*$/, '') : tr('Report')} backTo={fromLink} subtitle={report?.title.replace(/^[^:：]*[:：]\s*/, '')} />
            <div className={`${PAGE_COLUMN} pb-10`}>
                {report === null ? (
                    <p className="pt-8 text-sm text-[var(--text-muted)]">{tr('There’s no report here.')}</p>
                ) : report ? (
                    <article className="space-y-6 text-sm leading-relaxed max-w-prose">
                        {report.picture && (
                            <figure className="pt-2">
                                {/* Line art drawn in the doodles' ink: the picture is the mask. */}
                                <div
                                    role="img"
                                    aria-label={report.picture.alt}
                                    className="w-full bg-[var(--illustration-line)]"
                                    style={{
                                        aspectRatio: '2217 / 1173',
                                        WebkitMaskImage: `url(${report.picture.src})`,
                                        maskImage: `url(${report.picture.src})`,
                                        WebkitMaskSize: 'contain',
                                        maskSize: 'contain',
                                        WebkitMaskRepeat: 'no-repeat',
                                        maskRepeat: 'no-repeat',
                                    }}
                                />
                                {report.picture.credit && (
                                    <figcaption className="mt-2 text-xs text-[var(--text-muted)]">{report.picture.credit}</figcaption>
                                )}
                            </figure>
                        )}
                        {report.epigraph && <p className="text-base text-[var(--text)]">{report.epigraph}</p>}
                        <p className="text-[var(--text-muted)]">{report.source}</p>
                        {report.sections.map(s => (
                            <section key={s.heading} className="space-y-2">
                                <h2 className="flex items-center gap-2 font-medium text-[var(--text)]">
                                    {s.icon && <Doodle name={s.icon} size={2} />}
                                    {s.heading}
                                </h2>
                                {s.paragraphs.map((p, i) => <p key={i} className="text-[var(--text)]"><Linked text={p} /></p>)}
                            </section>
                        ))}
                        {report.closingPicture && (
                            // Drawn on white: in the light theme the white melts into the page,
                            // in the dark one the picture stays a round-cornered card.
                            <img
                                src={report.closingPicture.src}
                                alt={report.closingPicture.alt}
                                width={report.closingPicture.width}
                                height={report.closingPicture.height}
                                loading="lazy"
                                className="mx-auto h-auto w-full max-w-sm rounded-2xl mix-blend-multiply dark:mix-blend-normal"
                            />
                        )}
                        {report.closing && (
                            <div className="space-y-4 text-base text-[var(--text)]">
                                {report.closing.map((lines, i) => (
                                    <div key={i} className="space-y-1">
                                        {lines.map((line, j) => <p key={j}>{line}</p>)}
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-[var(--text-muted)]">
                            {tr('Original, in Chinese: ')}
                            <a href={report.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">FreeODwiki RP-74</a>
                        </p>
                    </article>
                ) : null}
            </div>
        </>
    );
}
