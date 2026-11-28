import React, { useEffect } from 'react';
import { Link } from '../components/Link';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { settingsSection } from '../components/SettingsListItem';
import Switch from '../components/Switch';
import Segmented from '../components/Segmented';
import { setPictureStyle, usePictureStyle } from '../components/PictureExport';
import { FEATURES, useFeatures, type Feature } from '../lib/features';
import { tr } from '../lib/i18n';
import { stopShare } from '../lib/watch';

/* Settings, Features: a switch for each thing the journal does beyond
   keeping doses (lib/features.ts). Off, a feature is hidden and does
   nothing; what it kept stays where it was. */

const muted = 'text-[var(--text-muted)]';

function Row({ id, label, says, checked, onChange }: { id: Feature; label: string; says: string; checked: boolean; onChange: (v: boolean) => void }) {
    const key = React.useId();
    return (
        <div className="w-full min-h-14 flex items-center justify-between gap-4 py-3.5">
            <label htmlFor={key} className="cursor-pointer">
                <span className="block text-sm text-[var(--text)]">{label}</span>
                <span id={`${key}-says`} className={`block text-xs ${muted} mt-0.5`}>
                    {says}
                </span>
            </label>
            <Switch id={key} checked={checked} onChange={onChange} label={label} describedBy={`${key}-says`} key={id} />
        </div>
    );
}

/** How a night's picture is drawn: round a dial, or along a line. */
function PictureStyleRow() {
    const style = usePictureStyle();
    return (
        <div className="w-full min-h-14 flex items-center justify-between gap-4 py-3.5">
            <span className="text-sm text-[var(--text)]">{tr('The night drawn')}</span>
            <Segmented
                options={[
                    { id: 'dial', label: tr('Clock') },
                    { id: 'lines', label: tr('Timeline') },
                ]}
                value={style}
                onChange={setPictureStyle}
                aria-label={tr('The night drawn')}
            />
        </div>
    );
}

export function FeaturesPage() {
    const features = useFeatures();
    useEffect(() => {
        document.title = tr('Features');
    }, []);
    const change = (id: Feature, on: boolean) => {
        features.set(id, on);
        // A night being shared ends with the feature: nothing goes on being sent unseen.
        if (id === 'watch' && !on) void stopShare();
    };
    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={tr('Features')} />
            <div className={`${PAGE_COLUMN} mt-3 pb-10 space-y-8`}>
                <p className={`text-sm ${muted}`}>
                    {tr('Each of these is on to begin with. Turned off, it is hidden and does nothing; what it kept (limits, medicines, products) stays, and is there again when it’s turned back on.')}
                </p>
                {FEATURES.map(g => (
                    <section key={g.group}>
                        <h2 className="group-heading mb-1">{tr(g.group)}</h2>
                        <div className={settingsSection}>
                            {g.items.map(f => (
                                <React.Fragment key={f.id}>
                                    <Row id={f.id} label={tr(f.label)} says={tr(f.says)} checked={features.on(f.id)} onChange={v => change(f.id, v)} />
                                    {f.id === 'picture' && features.on('picture') && <PictureStyleRow />}
                                </React.Fragment>
                            ))}
                        </div>
                    </section>
                ))}
                <p className={`text-xs ${muted}`}>
                    {tr('The lock, the other code and the plain name have their own switches under ')}
                    <Link to={{ page: 'settings', sub: 'privacy' }} className="underline underline-offset-[3px]">
                        {tr('Lock and privacy')}
                    </Link>
                    {tr('. The warnings about a redose too soon and about what doesn’t mix are always on.')}
                </p>
            </div>
        </div>
    );
}
