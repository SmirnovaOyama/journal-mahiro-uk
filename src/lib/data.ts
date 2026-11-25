import type { DosageForm } from '../components/doodles';

/* What public/data holds: written by scripts/sync-substances.mjs from
   PsychonautWiki and TripSit, then by scripts/sync-wikidata.mjs, which adds
   what Wikidata and Wikipedia know (Chinese names, summaries, and the
   substances the first two don't cover, as reference entries without
   doses). index.json is the light list every page needs; one
   substances/<id>.json is fetched when a substance is opened. */

export type Category =
  | 'Psychedelic'
  | 'Dissociative'
  | 'Stimulant'
  | 'Empathogen'
  | 'Depressant'
  | 'Opioid'
  | 'Endocrine'
  | 'Cannabinoid'
  | 'Nootropic'
  | 'Deliriant'
  | 'Antidepressant'
  | 'Antipsychotic'
  | 'Other';

/** Each kind in the order people look for them, with a plain line on what it does. */
export const CATEGORIES: readonly { id: Category; plural: string; blurb: string;}[] = [
  { id: 'Psychedelic', plural: 'Psychedelics', blurb: 'Change how you see, feel and think',},
  { id: 'Stimulant', plural: 'Stimulants', blurb: 'Speed body and mind up',},
  { id: 'Depressant', plural: 'Depressants', blurb: 'Slow body and mind down',},
  { id: 'Empathogen', plural: 'Empathogens', blurb: 'Bring warmth and closeness',},
  { id: 'Dissociative', plural: 'Dissociatives', blurb: 'Detach you from body and surroundings',},
  { id: 'Opioid', plural: 'Opioids', blurb: 'Relieve pain, with a high risk of overdose',},
  { id: 'Cannabinoid', plural: 'Cannabinoids', blurb: 'Act like cannabis',},
  { id: 'Deliriant', plural: 'Deliriants', blurb: 'Cause confusion and hallucinations that seem real',},
  { id: 'Nootropic', plural: 'Nootropics', blurb: 'Taken for focus and memory',},
  { id: 'Antidepressant', plural: 'Antidepressants', blurb: 'Prescribed for depression and anxiety',},
  { id: 'Antipsychotic', plural: 'Antipsychotics', blurb: 'Prescribed for psychosis, mania and agitation',},
  { id: 'Endocrine', plural: 'Hormones', blurb: 'Hormones and what acts on them',},
  { id: 'Other', plural: 'Everything else', blurb: 'Substances that fit no group above',},
];

export function categoryInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export interface IndexEntry {
  id: string;
  name: string;aliases: string;
  category: Category;
  form: DosageForm;
  status: string;
  chemicalClass: string;
  primaryBand: { low: number; high: number; unit: string; roa: string } | null;
  primaryDuration: { onset: string; peak: string; offset: string; total: string } | null;
  richness: number;
  /** The groups combination lists speak of ("opioids", "ssris"), for entries from Wikidata. */
  groups?: string[];
  /** 'wd': a reference entry from Wikidata, with no doses. */
  src?: 'wd';
}

export interface DoseRow {
  roa: string;
  bioavailability?: string;
  source?: string;
  unit: string;
  threshold?: string;
  light?: string;
  common?: string;
  strong?: string;
  heavy?: string;
  commonEstimate?: number;
  band?: { low: number; high: number };
  domain?: [number, number];
  segments?: Partial<Record<'light' | 'common' | 'strong' | 'heavy', [number, number]>>;
}

export interface DurationRow {
  roa: string;
  onset?: string;
  comeup?: string;
  peak?: string;
  offset?: string;
  afterEffects?: string;
  total?: string;
}

export type ComboStatus = 'Dangerous' | 'Unsafe' | 'Caution' | 'Synergy' | 'Low risk' | 'Decrease';

export interface Combination {
  substance: string;
  status: ComboStatus;
  note?: string;
}

export interface Detail {
  id: string;
  name: string;/** 'Wikidata' for a reference entry: what it is, no doses. */
  source?: string;
  wikidata?: string;
  atc?: string[];
  groups?: string[];
  summaryZh?: string;
  form: DosageForm;
  status: string;
  aliases: string;
  category: Category;
  chemicalClass?: string;
  psychoactiveClass?: string;
  halfLife?: string;
  marquis?: string;
  addictionPotential?: string;
  toxicity?: string[];
  summarySources?: string;
  summary: string;
  advisory?: string;
  doseBasis?: string;
  doseUnit: string;
  doseRows: DoseRow[];
  durationSources?: string;
  durationRows: DurationRow[];
  tolerance?: {
    buildUp?: string;
    reset?: string;
    crossTolerances?: { group: string; items: string[] }[];
  };
  subjectiveEffects: { name: string; url?: string }[];
  combinations: Combination[];
  citations: { title: string; url?: string }[];
  helpfulLinks: { title: string; description: string; url: string }[];
}

export type ComboMatrix = Record<string, Record<string, { status: string; note?: string }>>;

let indexPromise: Promise<IndexEntry[]> | null = null;
let combosPromise: Promise<ComboMatrix> | null = null;
const details = new Map<string, Promise<Detail>>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<IndexEntry[]> {
  indexPromise ??= getJson<IndexEntry[]>('/data/index.json').catch((e) => {
    indexPromise = null;
    throw e;
  });
  return indexPromise;
}

export function loadCombos(): Promise<ComboMatrix> {
  combosPromise ??= getJson<ComboMatrix>('/data/combos.json').catch((e) => {
    combosPromise = null;
    throw e;
  });
  return combosPromise;
}

export function loadDetail(id: string): Promise<Detail> {
  let p = details.get(id);
  if (!p) {
    p = getJson<Detail>(`/data/substances/${encodeURIComponent(id)}.json`);
    p.catch(() => details.delete(id));
    details.set(id, p);
  }
  return p;
}

/* ── search ───────────────────────────────────────────────────────────── */

/** Lower case, letters and digits only, so "2C-B", "2c b" and "2cb" are one. */
export function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9À-￿]+/g, '');
}

function aliasList(e: IndexEntry): string[] {
  return e.aliases
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

export interface Hit {
  entry: IndexEntry;
  /** The alias that matched, when the name itself didn't. */
  via?: string;
}

/** Ranked: exact name, then name prefix, then alias, then anywhere in the
 *  name, then the chemical family. Better-documented entries win ties. */
export function search(index: IndexEntry[], query: string, limit = 50): Hit[] {
  const q = squash(query);
  if (!q) return [];
  const scored: { hit: Hit; score: number }[] = [];
  for (const entry of index) {
    const name = squash(entry.name);
    let score = 0;
    let via: string | undefined;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else {
      for (const a of aliasList(entry)) {
        const sa = squash(a);
        if (sa === q) {
          score = 70;
          via = a;
          break;
        }
        if (sa.startsWith(q) && score < 55) {
          score = 55;
          via = a;
        }
      }
      if (!score && name.includes(q)) score = 40;
      if (!score && q.length >= 3 && squash(entry.chemicalClass).includes(q)) score = 15;
    }
    if (score) scored.push({ hit: { entry, via }, score: score + entry.richness / 100 });
  }
  scored.sort((a, b) => b.score - a.score || a.hit.entry.name.localeCompare(b.hit.entry.name));
  return scored.slice(0, limit).map((s) => s.hit);
}

/** A combination names a substance ("Tramadol") or a group ("Opioids");
 *  find the catalog entry it means, if there is exactly one. */
export function resolveName(index: IndexEntry[], name: string): IndexEntry | undefined {
  const q = squash(name);
  return (
    index.find((e) => e.id === name.toLowerCase()) ??
    index.find((e) => squash(e.name) === q) ??
    index.find((e) => aliasList(e).some((a) => squash(a) === q))
  );
}

/** "A psychedelic in the lysergamide family." */
export function describe(e: Pick<IndexEntry, 'category' | 'chemicalClass'>): string {
  // Some list several families ("Amphetamine, MDxx, Substituted
  // amphetamines"); name the broadest one, the "substituted" family if given.
  const fams = (e.chemicalClass || '').split(',').map((f) => f.trim()).filter(Boolean);
  const fam = fams.find((f) => /^substituted /i.test(f)) ?? fams[0] ?? '';
  const family = fam.replace(/s$/i, '').toLowerCase();
  // An acronym keeps its capitals: "the SSRI family", not "the ssri family".
  const familyText = /^[A-Z]{3,}s?$/.test(fam) ? fam.replace(/s$/, '') : family;
  const word = e.category.toLowerCase();
  const kind = e.category === 'Other' ? 'A substance' : `${/^[aeiou]/.test(word) ? 'An' : 'A'} ${word}`;
  if (!family) return `${kind}.`;
  return `${kind} in the ${familyText} family.`;
}
