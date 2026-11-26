import { useEffect, useState } from 'react';
import { Fold } from './Fold';

type Report = {
    id: string;
    title: string;
    source: string;
    url: string;
    sections: { heading: string; paragraphs: string[] }[];
};

const cache = new Map<string, Promise<Report | null>>();
function load(id: string) {
    let p = cache.get(id);
    if (!p) {
        p = fetch(`/data/reports/${encodeURIComponent(id)}.json`)
            .then(r => (r.ok ? (r.json() as Promise<Report>) : null))
            .catch(() => null);
        cache.set(id, p);
    }
    return p;
}

/** A case report behind a warning, read in place on the page. */
export function CaseReport({ id }: { id: string }) {
    const [report, setReport] = useState<Report | null | undefined>(undefined);
    useEffect(() => {
        let live = true;
        load(id).then(r => live && setReport(r));
        return () => { live = false; };
    }, [id]);
    if (report === null) return null;
    return (
        <Fold title={report ? `Read the report: ${report.title.replace(/^Report /, '')}` : 'Read the report'} hint={report?.source}>
            {report && (
                <div className="space-y-4 text-sm leading-relaxed max-w-prose">
                    {report.sections.map(s => (
                        <section key={s.heading} className="space-y-2">
                            <h3 className="font-medium text-[var(--text)]">{s.heading}</h3>
                            {s.paragraphs.map((p, i) => <p key={i} className="text-[var(--text-muted)]">{p}</p>)}
                        </section>
                    ))}
                    <p className="text-xs text-[var(--text-muted)]">
                        {'Original, in Chinese: '}
                        <a href={report.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">FreeODwiki RP-74</a>
                    </p>
                </div>
            )}
        </Fold>
    );
}
