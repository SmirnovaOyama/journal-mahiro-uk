import { useEffect, useState } from 'react';
import { useOpenedFromLink } from '../lib/router';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import Doodle, { type DoodleName } from '../components/Doodle';

export type CaseReport = {
    id: string;
    title: string;
    summary: string;
    source: string;
    url: string;
    sections: { heading: string; icon?: DoodleName; paragraphs: string[] }[];
};

const cache = new Map<string, Promise<CaseReport | null>>();
export function loadReport(id: string) {
    let p = cache.get(id);
    if (!p) {
        p = fetch(`/data/reports/${encodeURIComponent(id)}.json`)
            .then(r => (r.ok ? (r.json() as Promise<CaseReport>) : null))
            .catch(() => null);
        cache.set(id, p);
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
            <PageHeader title={report ? report.title.replace(/:.*$/, '') : 'Report'} backTo={fromLink} subtitle={report?.title.replace(/^[^:]*:\s*/, '')} />
            <div className={`${PAGE_COLUMN} pb-10`}>
                {report === null ? (
                    <p className="pt-8 text-sm text-[var(--text-muted)]">{'There’s no report here.'}</p>
                ) : report ? (
                    <article className="space-y-6 text-sm leading-relaxed max-w-prose">
                        <p className="text-[var(--text-muted)]">{report.source}</p>
                        {report.sections.map(s => (
                            <section key={s.heading} className="space-y-2">
                                <h2 className="flex items-center gap-2 font-medium text-[var(--text)]">
                                    {s.icon && <Doodle name={s.icon} size={2} />}
                                    {s.heading}
                                </h2>
                                {s.paragraphs.map((p, i) => <p key={i} className="text-[var(--text)]">{p}</p>)}
                            </section>
                        ))}
                        <p className="text-xs text-[var(--text-muted)]">
                            {'Original, in Chinese: '}
                            <a href={report.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">FreeODwiki RP-74</a>
                        </p>
                    </article>
                ) : null}
            </div>
        </>
    );
}
