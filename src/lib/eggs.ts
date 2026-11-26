/* Estradiol, the good stuff: a few small things for whoever looks it up here.
   This site comes from the same hands as Oyama's HRT Tracker (hrt.mahiro.uk),
   and the hormones in the catalogue are a nod to it. Nothing here is advice,
   and none of it touches a dose or a warning. */

/** The catalogue's hormone entries. */
const HRT_IDS = new Set([
    'estradiol-valerate',
    'estradiol-cypionate',
    'estradiol-enanthate',
    'estradiol-gel',
    'estradiol-patch',
    'estradiol-spray',
    'progesterone',
    'cyproterone-acetate',
]);

export const isHrt = (id: string) => HRT_IDS.has(id) || /estradiol|oestradiol/i.test(id);

/** A line for each ester, form and friend, as people who take them say them. */
const LINES: [RegExp, string][] = [
    [/titty skittles|girl ?pills|girl juice|bloobs/i, 'We know exactly what you mean.'],
    [/\b(ev|valerate|progynova|delestrogen)\b/i, 'Valerate: the classic.'],
    [/\b(ec|cypionate|depo-?estradiol)\b/i, 'Cypionate: slow and steady.'],
    [/\b(een|enanthate)\b/i, 'Enanthate: weekly, and iconic.'],
    [/\b(eun|undecylate)\b/i, 'Undecylate: in it for the long haul.'],
    [/\b(eb|benzoate)\b/i, 'Benzoate: in and out in a hurry.'],
    [/\bgel\b/i, 'Gel: rub it in, let it dry, wash your hands.'],
    [/\bpatch(es)?\b/i, 'Patches: stick one on and get on with your day.'],
    [/\bspray\b/i, 'Spray: psst.'],
    [/\bspiro(nolactone)?\b/i, 'Spiro: the reason you know where every bathroom is.'],
    [/\b(cypro(terone)?|cpa|androcur)\b/i, 'Cyproterone: a little goes a long way.'],
    [/\bbica(lutamide)?\b/i, 'Bicalutamide: the quiet one.'],
    [/\b(prog(esterone)?|prometrium|utrogestan)\b/i, 'Progesterone: sleepy, in the best way.'],
];

/** The line for a search, or a substance's id. */
export function hrtLine(text: string): string | null {
    const t = text.replace(/-/g, ' ');
    for (const [re, line] of LINES) if (re.test(t)) return line;
    return null;
}

/** Whether a search is about hormones. Two-letter ester names count only
 *  as the whole search ("ec" is in too many other words). */
export function isHrtSearch(q: string): boolean {
    const t = q.trim().toLowerCase();
    if (!t) return false;
    if (/^(ev|ec|een|eun|eb|e2)$/.test(t)) return true;
    return /estradiol|oestradiol|estrogen|oestrogen|\bhrt\b|titty skittles|girl ?pills|girl juice|\bspiro|\bcypro|\bbica(lutamide)?\b|progesterone|transfem|\bmtf\b/.test(t);
}

/* ── a little burst, in the flag's colours ──────────────────────────── */

const FLAG = ['#5bcefa', '#f5a9b8', '#ffffff', '#f5a9b8', '#5bcefa'];

/** Hearts and confetti from a point on the screen. Not with reduced motion. */
export function sparkle(x: number, y: number, n = 26) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = document.createElement('div');
    host.className = 'sparkle-host';
    host.setAttribute('aria-hidden', 'true');
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    for (let i = 0; i < n; i++) {
        const p = document.createElement('span');
        p.className = i % 4 === 0 ? 'sparkle-heart' : 'sparkle-bit';
        if (i % 4 === 0) p.textContent = '♥';
        const angle = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 50 + Math.random() * 90;
        p.style.setProperty('--dx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
        p.style.setProperty('--dy', `${(Math.sin(angle) * dist - 30).toFixed(1)}px`);
        p.style.setProperty('--c', FLAG[i % FLAG.length]);
        p.style.setProperty('--r', `${Math.round(Math.random() * 540 - 270)}deg`);
        p.style.animationDelay = `${Math.round(Math.random() * 90)}ms`;
        host.appendChild(p);
    }
    document.body.appendChild(host);
    window.setTimeout(() => host.remove(), 1500);
}

/** From the middle of an element. */
export function sparkleFrom(el: Element | null) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height / 2);
}

/** A line that shows for a moment above the tab bar, with the flag down its side. */
export function toast(text: string) {
    document.querySelector('.trans-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'trans-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2800);
}
