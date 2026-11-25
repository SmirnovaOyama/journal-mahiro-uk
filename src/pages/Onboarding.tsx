import { useState, useSyncExternalStore } from 'react';
import DoseRings from '../components/DoseRings';
import PixelCat from '../components/PixelCat';
import Point from '../components/Point';

/* The intro, on hrt.mahiro.uk's own (pages/Onboarding.tsx there): a page of
   its own over the app, Skip at the top, one step at a time, and at the foot
   Back, the rings for how far along you are, and Next. Its steps are this
   site's: say hello, what the site is for, and what stays
   on this device. Shown once; Settings can bring it back. */

const SEEN_KEY = 'journal-onboarding-seen';

let showing = (() => {
    try {
        return localStorage.getItem(SEEN_KEY) !== 'true';
    } catch {
        return false;
    }
})();
const subs = new Set<() => void>();

function setShowing(v: boolean) {
    showing = v;
    subs.forEach(f => f());
}

export function useOnboarding(): boolean {
    return useSyncExternalStore(
        f => {
            subs.add(f);
            return () => {
                subs.delete(f);
            };
        },
        () => showing,
    );
}

export function showOnboardingAgain() {
    setShowing(true);
}

function finish() {
    try {
        localStorage.setItem(SEEN_KEY, 'true');
    } catch {
        /* fine: it just shows again next time */
    }
    setShowing(false);
}

export function Onboarding() {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

    const steps = [
        <div key="welcome" className="flex flex-col pt-6 text-center">
            <div className="flex justify-center">
                <PixelCat pose="donut" size={176} />
            </div>
            <h1 className="mt-6 text-[1.625rem] font-semibold text-body">{'Hello there'}</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
                {'This little site looks up substances: how much, how long, and what not to mix, and keeps a journal of what you take.'}
            </p>
        </div>,
        <div key="what" className="pt-8">
            <h1 className="text-[1.625rem] font-semibold text-body">{'What it’s for'}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
                {'Information from PsychonautWiki, TripSit, Wikidata and Wikipedia, for over 3,000 substances, laid out so the answer comes first. And a journal of what you take, kept on your device.'}
            </p>
            <div className="mt-4">
                <Point
                    mark="vial"
                    title={'How much'}
                    desc={'Slide along the doses, light to heavy, and read what each means.'}
                />
                <Point
                    mark="chart"
                    title={'How long'}
                    desc={'Turn the clock to when you’d take it and see when it peaks and ends.'}
                />
                <Point
                    mark="caution"
                    title={'What not to mix'}
                    desc={'Put two or more together and get one answer, most serious first.'}
                />
                <Point
                    mark="notebook"
                    title={'A journal'}
                    desc={'Log what you take and when; it warns you before a redose or a bad mix.'}
                />
            </div>
        </div>,
        <div key="privacy" className="pt-8">
            <h1 className="text-[1.625rem] font-semibold text-body">{'Stays with you'}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
                {'No account, nothing to sign up for, and nothing you look at leaves this device.'}
            </p>
            <div className="mt-4">
                <Point
                    mark="lock"
                    title={'On this device'}
                    desc={'What you save, look at and log is kept in this browser only.'}
                />
                <Point
                    mark="heart"
                    title={'Information, not advice'}
                    desc={'It reduces harm; it doesn’t make anything safe. Start low and don’t use alone.'}
                />
                <Point
                    mark="caution"
                    title={'In an emergency'}
                    desc={'If someone is unresponsive or breathing slowly, call emergency services.'}
                />
            </div>
        </div>,
    ];

    const isLast = step === steps.length - 1;
    const goTo = (next: number) => {
        setDirection(next > step ? 'forward' : 'backward');
        setStep(next);
    };

    return (
        <div className="fixed inset-0 z-50 flex h-[100dvh] w-full select-none flex-col bg-[var(--bg)] font-sans text-[var(--text)]">
            <div className="flex shrink-0 justify-end px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
                <button
                    onClick={finish}
                    className={`rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-[var(--surface-hover)] ${isLast ? 'invisible' : ''}`}
                    tabIndex={isLast ? -1 : 0}
                >
                    {'Skip'}
                </button>
            </div>

            <div className="onboarding-steps flex flex-1 overflow-y-auto scrollbar-hide px-6">
                <div
                    key={step}
                    className={`mx-auto w-full max-w-md pb-8 ${direction === 'backward' ? 'view-enter-backward' : 'view-enter-forward'}`}
                >
                    {steps[step]}
                </div>
            </div>

            <div className="shrink-0 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t-(length:--hairline) border-[var(--border)] max-[360px]:px-4">
                <div className="mx-auto grid w-full max-w-md grid-cols-[1fr_auto_1fr] items-center gap-4 max-[360px]:gap-2">
                    <div className="justify-self-start">
                        {step > 0 && (
                            <button onClick={() => goTo(step - 1)} className="btn-secondary whitespace-nowrap">
                                {'Back'}
                            </button>
                        )}
                    </div>
                    <DoseRings count={steps.length} at={step} />
                    <div className="justify-self-end">
                        <button onClick={() => (isLast ? finish() : goTo(step + 1))} className="btn-primary whitespace-nowrap">
                            {isLast ? 'Get started' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
