import type { DosageForm } from '../components/doodles';
import { currentLang, dataText, dateLocale, isZh, tr } from './i18n';

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
  name: string;
  aliases: string;
  /** Its name in 正體中文 and in 简体中文, where Wikidata or zh.wikipedia
   *  has a short one (scripts/zh-data.mjs). */
  zh?: string;
  zhHans?: string;
  /** Other Chinese names, in traditional and simplified writing, to search by. */
  zhAliases?: string;
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
  /** What its row says instead of its kind and family (lib/xunxun.ts). */
  says?: string;
  /** To read about, not to log (oxygen, air): the journal's forms and the
   *  mix checker don't offer it. */
  learn?: true;
}

export interface DoseRow {
  roa: string;
  /** How much of a dose taken this way gets into the blood, in percent
   *  (scripts/absorption.mjs). A `min` of 0 means "up to `max`". */
  absorbed?: { min: number; max: number; source?: string; page?: string; note?: string };
  /** Anything else known about this route ("higher unmetabolized serum P4"). */
  note?: string;
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
  /** AI's estimate from what each one does (lib/traits.ts), not a source's:
   *  written by hand for an entry no source covers (metformin). */
  ai?: true;
}

/** A few sentences quoted from an article, and where they are in it. */
export interface Quoted {
  text?: string;
  /** 'Wikipedia' or 'PsychonautWiki'. */
  source?: string;
  page?: string;
  url?: string;
}

/** How a substance acts on something it binds to, as the Guide to Pharmacology records it. */
export type ActHow =
  | 'agonist'
  | 'partial agonist'
  | 'activator'
  | 'positive modulator'
  | 'inhibitor'
  | 'antagonist'
  | 'inverse agonist'
  | 'negative modulator'
  | 'blocker'
  | 'modulator'
  | 'ligand';

/** What the body does with a dose, in the order it happens. */
export type BodyStep = 'absorbed' | 'onset' | 'lasts' | 'halfLife' | 'brokenDown' | 'turnsInto' | 'leaves';

/** One piece of AI-written text in each language: `zh` in 正體中文,
 *  `zhHans` the same in 简体中文 (converted with OpenCC). */
export interface AiText { en: string; zh: string; zhHans?: string }
export interface AiWritten {
  by: string;
  date: string;
  summary?: AiText;
  pharmacology?: AiText;
  uses?: AiText;
  sideEffects?: AiText;
  /** A true and curious fact: its history, its name, its chemistry. */
  fact?: AiText;
  /** For a plant, brew or mixture with no formula of its own: its main
   *  active compounds as the AI named them, with each one's formula as the
   *  catalogue has it from PubChem. */
  contains?: { id: string; name: string; zh?: string; formula: string }[];
}

export interface Detail {
  id: string;
  name: string;/** 'Wikidata' for a reference entry: what it is, no doses. */
  source?: string;
  wikidata?: string;
  atc?: string[];
  groups?: string[];
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
  /** Its chemical formula ("C8H10N4O2") and molar mass in g/mol, from PubChem
   *  (scripts/formulas.mjs): only where the drawing is of the substance itself. */
  formula?: string;
  molarMass?: number;
  summarySources?: string;
  summary: string;
  /** Its name in each Chinese writing, and the opening of its zh.wikipedia
   *  article as Wikipedia writes it for Taiwan and for the mainland
   *  (scripts/zh-data.mjs). */
  zh?: string;
  zhHans?: string;
  summaryZh?: string;
  summaryZhHans?: string;
  /** The other names it goes by in Chinese, in each writing, for the page
   *  to name under the one it leads with ("氯胺酮, K他命"). */
  zhOther?: string;
  zhHansOther?: string;
  /** How it works (scripts/pharmacology.mjs): the opening of what its article
   *  says of its mechanism; the receptors, transporters and channels the
   *  IUPHAR/BPS Guide to Pharmacology records it binding to, by what it does
   *  to them (`guide` is its number there); and, from the article's infobox,
   *  what kind of drug it is and what the body does with it. `figures` is the
   *  Wikipedia article the infobox rows are from. */
  pharmacology?: Quoted & {
    acts?: { how: ActHow; on: string[] }[];
    guide?: number;
    kind?: string;
    body?: { what: BodyStep; says: string }[];
    figures?: string;
  };
  /** What it's used for: the opening of the article's section on its use,
   *  and of the one on recreational use if it has both; what it's sold as
   *  and how it's taken, from the infobox. `treats` is what Wikidata lists it
   *  for, kept only where there are no words. */
  uses?: Quoted & { recreational?: string; treats?: string[]; brands?: string; routes?: string; figures?: string };
  /** Its side effects, as the article sums them up, and how likely it is to
   *  be habit-forming, from the infobox. */
  sideEffects?: Quoted & { addiction?: string; dependence?: string; figures?: string };
  /** What an AI wrote where no source had anything (scripts/ai-fill.mjs):
   *  each part only where the section is otherwise empty, every one shown
   *  with a line saying it was written by AI. Kept apart from the sourced
   *  data so it can be reviewed, or taken out whole by deleting the key. */
  ai?: AiWritten;
  advisory?: string;
  /** 'FreeODwiki' where the advisory is its warning, brought along with its doses (scripts/freeodwiki.mjs). */
  advisorySource?: string;
  /** Warnings added by hand from a case report, each with where it comes from. */
  warnings?: { text: string; source: string; url: string; report?: string }[];
  /** How it's sold in a place, added by hand from that place's own rule. */
  availability?: { where: string; rule: string; source: string; url: string }[];
  doseBasis?: string;
  doseUnit: string;
  doseRows: DoseRow[];
  durationSources?: string;
  durationRows: DurationRow[];
  tolerance?: {
    buildUp?: string;
    reset?: string;
    /** "Full tolerance", "Half tolerance", "Baseline", each with when. */
    milestones?: { label: string; value: string; tone?: string }[];
    crossTolerances?: { group: string; items: string[] }[];
  };
  subjectiveEffects: { name: string; url?: string }[];
  combinations: Combination[];
  citations: { title: string; url?: string }[];
  helpfulLinks: { title: string; description: string; url: string }[];
  /** To read about, not to log (oxygen, air): no doses, timing or mixing. */
  learn?: true;
  /** For a mixture with no one structure (air): what it's made of, by
   *  volume, in percent, written by hand. `id` where the part has a page. */
  parts?: { id?: string; name: string; zh?: string; zhHans?: string; formula: string; share: number }[];
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

/** A substance's name as the reader's language has it: its Chinese name in
 *  the writing being read, where it has one, else the catalogue's. */
export function nameOf(e: Pick<IndexEntry, 'name' | 'zh' | 'zhHans'>): string {
  if (!isZh()) return e.name;
  return (currentLang() === 'zh-Hans' ? e.zhHans ?? e.zh : e.zh) || e.name;
}

/** Every Chinese name an entry goes by, in either writing: a search finds
 *  the substance whichever one the reader types. */
function zhNames(e: IndexEntry): string[] {
  return [e.zh, e.zhHans, ...(e.zhAliases ? e.zhAliases.split(',') : [])].map((a) => (a ?? '').trim()).filter(Boolean);
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
      // Chinese names, in either script. Chinese has no spaces between
      // words, so a name found anywhere in one counts: 酮 finds 氯胺酮.
      if (!score && /[\u3400-\u9fff]/.test(q)) {
        for (const a of zhNames(entry)) {
          const sa = squash(a);
          const s = sa === q ? 90 : sa.startsWith(q) ? 75 : sa.includes(q) ? 45 : 0;
          if (s > score) {
            score = s;
            via = a === entry.zh ? undefined : a;
          }
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
    index.find((e) => aliasList(e).some((a) => squash(a) === q)) ??
    index.find((e) => zhNames(e).some((a) => squash(a) === q))
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
  let familyText = /^[A-Z]{3,}s?$/.test(fam) ? fam.replace(/s$/, '') : family;
  // In Chinese the family has its own name ("取代色胺"), with no plural to strip.
  if (isZh() && fam) {
    const zh = dataText(fam);
    if (zh !== fam) familyText = zh;
  }
  const word = e.category.toLowerCase();
  // Chinese has no article and names the kind as the lists do.
  const kind = e.category === 'Other' ? tr('A substance') : isZh() ? tr(e.category) : `${/^[aeiou]/.test(word) ? 'An' : 'A'} ${word}`;
  if (!family) return tr('{kind}.', { kind });
  return tr('{kind} in the {family} family.', { kind, family: familyText });
}

/** Units of mass, in micrograms. */
const MASS: Record<string, number> = { g: 1e6, mg: 1e3, μg: 1, µg: 1, ug: 1, mcg: 1, ng: 1e-3 };

/** A unit per kilogram of body weight ("mg/kg of body weight"). */
export const isPerKg = (unit: string) => /\/\s*kg\b|kg of body weight/i.test(unit);
const massOf = (unit: string) => unit.split('/')[0].trim();

/** An amount in another unit: the same number in the same unit, converted
 *  between units of mass (0.1 mg is 100 µg), or null when they don't
 *  convert (mL to mg). With a body weight, an amount and so much a
 *  kilogram convert too (75 mg at 50 kg is 1.5 mg/kg). */
export function convertAmount(value: number, from: string, to: string, kg?: number | null): number | null {
  const a = from.trim().replace('µ', 'μ');
  const b = to.trim().replace('µ', 'μ');
  if (a === b) return value;
  if (isPerKg(a) || isPerKg(b)) {
    if (isPerKg(a) && isPerKg(b)) return convertAmount(value, massOf(a), massOf(b));
    if (!kg) return null;
    if (isPerKg(b)) {
      const m = convertAmount(value, a, massOf(b));
      return m == null ? null : m / kg;
    }
    return convertAmount(value * kg, massOf(a), b);
  }
  const f = MASS[a];
  const t = MASS[b];
  return f && t ? (value * f) / t : null;
}

/** "1.6", "0.42", "1,050": an amount as it reads best. */
export function fmtAmount(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString(dateLocale());
  if (v >= 10) return String(Math.round(v * 10) / 10);
  if (v >= 1) return String(Math.round(v * 100) / 100);
  return String(Number(v.toPrecision(2)));
}
