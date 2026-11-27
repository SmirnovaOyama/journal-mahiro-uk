import { convertAmount, type Detail, type IndexEntry } from './data';
import { SESSION_GAP, sessionsOf, type Ingestion, type JournalData, type Session } from './journal';

/* What the journal says back, worked out from what's in it. Nothing here
   draws anything: the dose form, the journal's pages and the page for the
   crew read these and word them. */

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/* ── how long a drug stays ──────────────────────────────────────────────
   The dose form warns about what was logged in the last day. Some drugs
   are still at work long after that: an antidepressant with a half-life of
   days, an MAOI whose effect outlasts the drug itself. So a dose stays in
   reckoning for five half-lives (after which about 3% is left), by the
   half-life its page gives, for a day at the least and three weeks at the
   most. Where a drug's label gives a longer wait than its half-life would,
   the label's is used. */

const SPAN = /(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\)?\s*(minutes?|mins?|hours?|hrs?|h|days?|d|weeks?)\b/i;
const IN_HOURS: Record<string, number> = { m: 1 / 60, h: 1, d: 24, w: 168 };

/** The first half-life a line gives, at its upper end, in hours:
 *  "1–3 days (acute); 4–6 days (chronic)" is 72. */
export function halfLifeHours(says?: string): number | null {
    const m = says?.match(SPAN);
    if (!m) return null;
    const v = parseFloat(m[2] ?? m[1]);
    const u = m[3].toLowerCase();
    const k = IN_HOURS[u.startsWith('min') ? 'm' : u[0]];
    return Number.isFinite(v) && k ? v * k : null;
}

/** Waits a label gives that the half-life wouldn't, in days. Fluoxetine:
 *  five weeks before an MAOI, for its metabolite (the Prozac label). The
 *  MAOIs that bind for good: fourteen days, until the enzyme is made again
 *  (the Nardil, Marplan, Parnate and Emsam labels). */
const WAITS: Record<string, number> = {
    fluoxetine: 35,
    phenelzine: 14,
    isocarboxazid: 14,
    tranylcypromine: 14,
    selegiline: 14,
    iproniazid: 14,
    nialamide: 14,
    pargyline: 14,
};

/** How far back the journal is read for what may still be at work. */
export const LINGER_DAYS = 35;
const MOST_FROM_HALF_LIFE = 21 * 24;

/** For how many hours after a dose it is still reckoned with. */
export function lingerHours(id: string, detail?: Detail): number {
    const wait = WAITS[id];
    if (wait) return wait * 24;
    const says = detail?.pharmacology?.body?.find(b => b.what === 'halfLife')?.says ?? detail?.halfLife;
    const half = halfLifeHours(says);
    return half ? Math.min(MOST_FROM_HALF_LIFE, Math.max(24, half * 5)) : 24;
}

/** The doses logged more than a day before `time` whose drug may still be
 *  at work then: the latest of each substance. */
export function lingering(ingestions: Ingestion[], details: Record<string, Detail | undefined>, time: number, skipId?: string): Ingestion[] {
    const latest = new Map<string, Ingestion>();
    for (const i of ingestions) {
        if (i.id === skipId) continue;
        const ago = time - i.time;
        if (ago <= DAY || ago > LINGER_DAYS * DAY) continue;
        if (ago >= lingerHours(i.substance, details[i.substance]) * HOUR) continue;
        const had = latest.get(i.substance);
        if (!had || had.time < i.time) latest.set(i.substance, i);
    }
    return [...latest.values()];
}

/* ── last time ──────────────────────────────────────────────────────── */

export interface LastTime {
    session: Session;
    /** What was written of the session as a whole. */
    note?: string;
    rating?: string;
    title?: string;
    /** What was written beside this substance's own doses that night. */
    doseNotes: string[];
    doses: Ingestion[];
}

/** The last night `substance` was taken that has something written about
 *  it, before the night a dose at `time` would belong to. */
export function lastTime(data: JournalData, substance: string, time: number): LastTime | null {
    for (const s of sessionsOf(data.ingestions)) {
        if (s.end >= time - SESSION_GAP) continue;
        const doses = s.ingestions.filter(i => i.substance === substance);
        if (!doses.length) continue;
        const meta = data.meta?.[s.id] ?? {};
        const doseNotes = doses.map(i => i.note?.trim()).filter((n): n is string => !!n);
        const note = meta.note?.trim();
        if (!note && !doseNotes.length) continue;
        return { session: s, ...(note ? { note } : {}), ...(meta.rating ? { rating: meta.rating } : {}), ...(meta.title ? { title: meta.title } : {}), doseNotes, doses };
    }
    return null;
}

/* ── limits ─────────────────────────────────────────────────────────── */

/** The doses that are one night with a dose taken at `time`: within twelve
 *  hours of one another, in a chain, either side of it. */
export function nightOf(ingestions: Ingestion[], time: number, skipId?: string): Ingestion[] {
    const probe: Ingestion = { id: '\u0000probe', substance: '', name: '', route: '', dose: null, unit: '', estimate: false, time };
    const s = sessionsOf([...ingestions.filter(i => i.id !== skipId), probe]).find(x => x.ingestions.includes(probe));
    return (s?.ingestions ?? []).filter(i => i !== probe);
}

/** How much of `substance` the night already holds, in `unit`. `unknown`
 *  counts the doses that can't be added up: no amount, or another kind of unit. */
export function nightTotal(ingestions: Ingestion[], substance: string, time: number, unit: string, skipId?: string): { total: number; unknown: number } {
    let total = 0;
    let unknown = 0;
    for (const i of nightOf(ingestions, time, skipId)) {
        if (i.substance !== substance) continue;
        const v = i.dose == null ? null : convertAmount(i.dose, i.unit, unit);
        if (v == null) unknown++;
        else total += v;
    }
    return { total, unknown };
}

/** When `substance` was last taken on a night before the one a dose at
 *  `time` belongs to, or null if never. */
export function lastNightOf(ingestions: Ingestion[], substance: string, time: number, skipId?: string): number | null {
    const tonight = new Set(nightOf(ingestions, time, skipId).map(i => i.id));
    let last: number | null = null;
    for (const i of ingestions)
        if (i.substance === substance && i.id !== skipId && !tonight.has(i.id) && i.time < time && (last == null || i.time > last)) last = i.time;
    return last;
}

/* ── paracetamol ────────────────────────────────────────────────────────
   Cold medicines carry it beside what they're taken for, and it is the
   part that does the lasting harm. The NHS's limit for an adult is eight
   500 mg tablets, 4 g, in 24 hours, and it says to avoid taking it at the
   same time as other medicines that contain it. */

export const PARACETAMOL = 'apap';
export const PARACETAMOL_DAY_MG = 4000;
export const PARACETAMOL_SOURCE = {
    name: 'NHS',
    title: 'How and when to take paracetamol for adults',
    href: 'https://www.nhs.uk/medicines/paracetamol-for-adults/how-and-when-to-take-paracetamol-for-adults/',
};

/** Paracetamol logged in the 24 hours up to `time`, in mg. `unknown`
 *  counts doses of it with no amount that can be read as a weight. */
export function paracetamolMg(ingestions: Ingestion[], time: number, skipId?: string): { mg: number; unknown: number } {
    let mg = 0;
    let unknown = 0;
    for (const i of ingestions) {
        if (i.substance !== PARACETAMOL || i.id === skipId || i.time > time || i.time <= time - DAY) continue;
        const v = i.dose == null ? null : convertAmount(i.dose, i.unit, 'mg');
        if (v == null) unknown++;
        else mg += v;
    }
    return { mg, unknown };
}

/* ── days in a row ──────────────────────────────────────────────────────
   Some drugs, taken every day, can't safely be stopped all at once. When
   the journal shows one of them logged day after day, it says so, once,
   in the NHS's words for that kind of drug. Seven days is the journal's
   own mark for "every day", not a clinical one. */

export type StopKind = 'gabapentinoid' | 'benzodiazepine' | 'opioid' | 'z-drug';

const GABAPENTINOIDS = new Set(['pregabalin', 'gabapentin', 'gabapentin-enacarbil']);
const Z_DRUGS = new Set(['zolpidem', 'zopiclone', 'eszopiclone', 'zaleplon']);

/** The kind of drug whose page at the NHS says not to stop it suddenly. */
export function stopKind(e: Pick<IndexEntry, 'id' | 'category' | 'chemicalClass' | 'groups'>): StopKind | null {
    const chem = (e.chemicalClass || '').toLowerCase();
    if (GABAPENTINOIDS.has(e.id)) return 'gabapentinoid';
    if (Z_DRUGS.has(e.id)) return 'z-drug';
    if (chem.includes('benzodiazepine') || chem.includes('thienodiazepine') || e.groups?.includes('benzodiazepines')) return 'benzodiazepine';
    if (e.category === 'Opioid' || e.groups?.includes('opioids')) return 'opioid';
    return null;
}

export const STOP_SOURCES: Record<StopKind, { name: string; title: string; href: string }> = {
    gabapentinoid: { name: 'NHS', title: 'How and when to take pregabalin', href: 'https://www.nhs.uk/medicines/pregabalin/how-and-when-to-take-pregabalin/' },
    benzodiazepine: { name: 'NHS', title: 'Lorazepam', href: 'https://www.nhs.uk/medicines/lorazepam/' },
    opioid: { name: 'NHS', title: 'How and when to take codeine', href: 'https://www.nhs.uk/medicines/codeine/how-and-when-to-take-codeine/' },
    'z-drug': { name: 'NHS', title: 'Zolpidem', href: 'https://www.nhs.uk/medicines/zolpidem/' },
};

export const RUN_DAYS = 7;

const dayOf = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** On how many days in a row, up to today or yesterday, `substance` was
 *  logged. A day is the device's own calendar day. */
export function daysInARow(ingestions: Ingestion[], substance: string, now: number): number {
    const days = new Set(ingestions.filter(i => i.substance === substance && i.time <= now).map(i => dayOf(i.time)));
    let at = new Date(dayOf(now));
    if (!days.has(at.getTime())) at = new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1);
    let n = 0;
    while (days.has(at.getTime())) {
        n++;
        at = new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1);
    }
    return n;
}

export interface Run {
    id: string;
    days: number;
    kind: StopKind;
}

/** Every drug of those kinds logged seven days or more in a row, longest first. */
export function runs(ingestions: Ingestion[], byId: Map<string, IndexEntry>, now: number): Run[] {
    const out: Run[] = [];
    const recent = new Set(ingestions.filter(i => now - i.time < 2 * DAY && i.time <= now).map(i => i.substance));
    for (const id of recent) {
        const e = byId.get(id);
        const kind = e && stopKind(e);
        if (!kind) continue;
        const days = daysInARow(ingestions, id, now);
        if (days >= RUN_DAYS) out.push({ id, days, kind });
    }
    return out.sort((a, b) => b.days - a.days);
}
