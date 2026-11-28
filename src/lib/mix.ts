import { squash, type ComboMatrix, type ComboStatus, type Detail, type IndexEntry } from './data';
import { tr } from './i18n';
import { traitsOf, type Trait } from './traits';

/* Whether two substances are safe together. The answer comes from, in turn:
   each substance's own list of combinations (PsychonautWiki and TripSit, as
   synced), the TripSit matrix, and only then a cautious guess from what kind
   of drug each one is, which is always labelled as a guess, and failing
   that what AI makes of what each one does in the body (lib/traits.ts),
   which is always labelled as AI's. Where sources disagree the more
   serious answer wins. */

export type Verdict = ComboStatus | 'Unknown';

export const RANK: Record<Verdict, number> = {
  Dangerous: 6,
  Unsafe: 5,
  Caution: 4,
  Unknown: 3,
  Synergy: 2,
  'Low risk': 1,
  Decrease: 1,
};

export type Tone = 'danger' | 'warning' | 'info' | 'positive' | 'neutral';

export const VERDICT: Record<
  Verdict,
  { label: string;tone: Tone; meaning: string;}
> = {
  Dangerous: {
    label: 'Dangerous',
    tone: 'danger',
    meaning: 'Can cause serious harm or death. Don’t combine these.',
  },
  Unsafe: {
    label: 'Unsafe',
    tone: 'danger',
    meaning: 'A real risk of physical harm. Avoid this combination.',
  },
  Caution: {
    label: 'Caution',
    tone: 'warning',
    meaning: 'Not usually harmful in itself, but it can feel bad or overwhelming. Lower both doses.',
  },
  Synergy: {
    label: 'Stronger together',
    tone: 'info',
    meaning: 'Each makes the other stronger. Low risk if you take less of both.',
  },
  'Low risk': {
    label: 'Low risk',
    tone: 'positive',
    meaning: 'No harmful interaction is known. The effects simply add up.',
  },
  Decrease: {
    label: 'Weaker together',
    tone: 'positive',
    meaning: 'One dulls the other. Don’t take more to make up for it.',
  },
  Unknown: {
    label: 'Not documented',
    tone: 'neutral',
    meaning: 'No source covers this combination. That doesn’t mean it’s safe: start low and don’t use alone.',
  },
};

/** Entries the sync gives no group (scripts/sync-wikidata.mjs gives one only
 *  to the entries it writes itself), by what they are. The harmala plants
 *  and the brew made with them are MAOIs by what's in them. */
const SSRIS = new Set(['citalopram', 'escitalopram', 'fluoxetine', 'fluvoxamine', 'paroxetine', 'sertraline', 'dapoxetine']);
const MAOIS = new Set(['moclobemide', 'tetrahydroharmine', 'peganum-harmala', 'banisteriopsis-caapi', 'ayahuasca']);

/** Every name a combination list might use for this substance: its own
 *  names, and the groups it belongs to ("Opioids", "2C-x", "MAOIs"). */
export function namesFor(e: IndexEntry): Set<string> {
  const keys = new Set<string>();
  const add = (s: string) => s && keys.add(squash(s));
  add(e.id);
  add(e.name);
  e.aliases.split(',').forEach((a) => add(a.trim()));

  const id = e.id.toLowerCase();
  const chem = (e.chemicalClass || '').toLowerCase();
  const group: Partial<Record<string, string>> = {
    Stimulant: 'stimulants',
    Depressant: 'depressants',
    Dissociative: 'dissociatives',
    Psychedelic: 'psychedelics',
    Opioid: 'opioids',
    Deliriant: 'deliriants',
  };
  if (group[e.category]) add(group[e.category]!);
  e.groups?.forEach(add);
  if (chem.includes('benzodiazepine') || chem.includes('thienodiazepine')) add('benzodiazepines');
  if (chem.includes('barbiturate')) add('barbiturates');
  if (chem.includes('amphetamine') || id.includes('amphetamine')) add('amphetamines');
  if (id.startsWith('2c-t-')) add('2c-t-x');
  else if (id.startsWith('2c-')) add('2c-x');
  if (id.startsWith('5-meo-')) add('5-meo-xxt');
  if (/nbome/.test(id)) ['nbomes', 'nbome', '25x-nbome'].forEach(add);
  if (/nboh/.test(id)) add('25x-nboh');
  if (/^do[a-z]{1,2}$/.test(id) && e.category === 'Psychedelic') add('dox');
  if (id === 'ghb' || id === 'gbl') add('ghb/gbl');
  if (id === 'dxm' || id === 'dextromethorphan') ['dxm', 'dextromethorphan'].forEach(add);
  if (id === 'mxe' || id === 'methoxetamine') ['mxe', 'methoxetamine'].forEach(add);
  if (id === 'amt') ['amt', 'αmt'].forEach(add);
  if (id === 'nitrous' || id === 'nitrous-oxide') add('nitrous');
  if (id.includes('mushroom') || id === 'psilocybin' || id === 'psilocin') add('mushrooms');
  if (id === 'diphenhydramine') add('dph');
  // The antidepressants PsychonautWiki and TripSit list by name come with
  // no group and no combinations of their own, so each read "Not
  // documented" against tramadol, DXM and MDMA: the pairs they matter most
  // in. The matrix speaks of them as "SSRIs" and "MAOIs".
  if (SSRIS.has(id)) add('ssris');
  if (MAOIS.has(id)) add('maois');
  return keys;
}

function fromMatrix(raw: string): ComboStatus {
  const s = raw.toLowerCase();
  if (s.includes('dangerous')) return 'Dangerous';
  if (s.includes('unsafe')) return 'Unsafe';
  if (s.includes('caution')) return 'Caution';
  if (s.includes('decrease')) return 'Decrease';
  if (s.includes('no synergy')) return 'Low risk';
  if (s.includes('synergy')) return 'Synergy';
  return 'Low risk';
}

/** Notes the sync wrote when it had nothing to say ("Documented unsafe
 *  interaction on PsychonautWiki.") say less than the verdict's own words. */
function isBoilerplate(note?: string) {
  return !note || /^(documented .* interaction on|tripsit classification|listed as a significant drug interaction on wikidata)/i.test(note);
}

export type Source = 'PsychonautWiki' | 'TripSit' | 'Wikidata' | 'Guess' | 'AI';

export interface PairResult {
  a: IndexEntry;
  b: IndexEntry;
  verdict: Verdict;
  note?: string;source?: Source;
}

function guess(a: IndexEntry, b: IndexEntry): PairResult | null {
  const has = (c: string) => a.category === c || b.category === c;
  const both = (cs: string[]) => cs.includes(a.category) && cs.includes(b.category);
  if (both(['Depressant', 'Opioid']))
    return {
      a,
      b,
      verdict: 'Dangerous',
      source: 'Guess',
      note: tr('Both slow your breathing. Together they can stop it, and this is how most overdoses happen.'),
    };
  if (has('Dissociative') && (has('Depressant') || has('Opioid')))
    return {
      a,
      b,
      verdict: 'Dangerous',
      source: 'Guess',
      note: tr('Risk of passing out and vomiting while unable to protect your airway.'),
    };
  if (both(['Stimulant', 'Empathogen']))
    return {
      a,
      b,
      verdict: 'Caution',
      source: 'Guess',
      note: tr('Both push heart rate, blood pressure and body temperature up.'),
    };
  return null;
}

/* What AI makes of a pair no source covers, from what each one does
   (lib/traits.ts). The first rule that fits is the most serious. */
const RULES: { when: (x: Set<Trait>, y: Set<Trait>) => boolean; verdict: ComboStatus; note: () => string }[] = [
  {
    when: (x, y) => (x.has('maoi') && (y.has('serotonin') || y.has('maoi'))) || (y.has('maoi') && x.has('serotonin')),
    verdict: 'Dangerous',
    note: () => tr('Together they can cause serotonin syndrome: fever, shaking, confusion and a racing heart. It can kill.'),
  },
  {
    when: (x, y) => (x.has('maoi') && (y.has('stimulant') || y.has('dopamine'))) || (y.has('maoi') && (x.has('stimulant') || x.has('dopamine'))),
    verdict: 'Dangerous',
    note: () => tr('The MAOI stops the body clearing the other one, and blood pressure can climb to a dangerous level.'),
  },
  {
    when: (x, y) => (x.has('nitrate') && y.has('pde5')) || (y.has('nitrate') && x.has('pde5')),
    verdict: 'Dangerous',
    note: () => tr('Both widen blood vessels. Together blood pressure can fall far enough to faint, or to cause a heart attack or stroke.'),
  },
  {
    when: (x, y) => x.has('breathing') && y.has('breathing'),
    verdict: 'Dangerous',
    note: () => tr('Both slow your breathing. Together they can stop it, and this is how most overdoses happen.'),
  },
  {
    when: (x, y) => (x.has('antabuse') && y.has('ethanol')) || (y.has('antabuse') && x.has('ethanol')),
    verdict: 'Unsafe',
    note: () => tr('With alcohol it causes flushing, vomiting, a pounding heart and a sharp fall in blood pressure.'),
  },
  {
    when: (x, y) => x.has('qt') && y.has('qt'),
    verdict: 'Unsafe',
    note: () => tr('Both change the heart’s rhythm in the same way. Together they can bring on a dangerous irregular heartbeat.'),
  },
  {
    when: (x, y) => (x.has('lithium') && y.has('nsaid')) || (y.has('lithium') && x.has('nsaid')),
    verdict: 'Unsafe',
    note: () => tr('The painkiller keeps lithium in the body, and lithium can build up to a poisonous level.'),
  },
  {
    when: (x, y) => x.has('serotonin') && y.has('serotonin'),
    verdict: 'Caution',
    note: () => tr('Both raise serotonin. Too much can cause serotonin syndrome: watch for shaking, sweating, fever and confusion.'),
  },
  {
    when: (x, y) => x.has('seizure') && y.has('seizure'),
    verdict: 'Caution',
    note: () => tr('Both make a seizure more likely.'),
  },
  {
    when: (x, y) => x.has('anticholinergic') && y.has('anticholinergic'),
    verdict: 'Caution',
    note: () => tr('Both block acetylcholine. Together they can cause confusion, overheating, a racing heart and trouble passing urine.'),
  },
  {
    when: (x, y) => x.has('stimulant') && y.has('stimulant'),
    verdict: 'Caution',
    note: () => tr('Both push heart rate, blood pressure and body temperature up.'),
  },
  {
    when: (x, y) => x.has('sedating') && y.has('sedating'),
    verdict: 'Caution',
    note: () => tr('Both make you drowsy. Together you may be slower and clumsier than you expect, so don’t drive.'),
  },
  {
    when: (x, y) => {
      const foggy = (t: Set<Trait>) => t.has('sedating') || t.has('dizzy') || t.has('anticholinergic');
      return foggy(x) && foggy(y);
    },
    verdict: 'Caution',
    note: () => tr('Both can make you dizzy, drowsy or confused. Together that adds up and falls are more likely, so start low and don’t drive.'),
  },
  {
    when: (x, y) => (x.has('dopamine') && y.has('antidopamine')) || (y.has('dopamine') && x.has('antidopamine')),
    verdict: 'Decrease',
    note: () => tr('One raises dopamine and the other blocks it, so each can undo what the other is for.'),
  },
  // What kind of drug each one is, as TripSit's chart has the kinds.
  {
    when: (x, y) => (x.has('psychedelic') && y.has('stimulant')) || (y.has('psychedelic') && x.has('stimulant')),
    verdict: 'Caution',
    note: () => tr('A stimulant can tip a trip into anxiety or paranoia, and both strain the heart.'),
  },
  {
    when: (x, y) => (x.has('psychedelic') && y.has('dissociative')) || (y.has('psychedelic') && x.has('dissociative')),
    verdict: 'Caution',
    note: () => tr('Together the trip can get much stronger and more confusing than either alone.'),
  },
  {
    when: (x, y) => (x.has('psychedelic') && y.has('cannabinoid')) || (y.has('psychedelic') && x.has('cannabinoid')),
    verdict: 'Caution',
    note: () => tr('Cannabis can make a trip much stronger and harder to predict, sometimes frightening.'),
  },
  {
    when: (x, y) => (x.has('breathing') && y.has('stimulant')) || (y.has('breathing') && x.has('stimulant')),
    verdict: 'Caution',
    note: () => tr('The stimulant can hide how much the depressant is doing. When it wears off, the depressant can hit harder.'),
  },
  {
    when: (x, y) => x.has('psychedelic') && y.has('psychedelic'),
    verdict: 'Synergy',
    note: () => tr('Both are psychedelics, so each makes the other stronger. Take much less of both.'),
  },
  {
    when: (x, y) => (x.has('psychedelic') && y.has('sedating')) || (y.has('psychedelic') && x.has('sedating')),
    verdict: 'Decrease',
    note: () => tr('A depressant dulls a trip. Don’t take more of either to make up for it.'),
  },
  {
    when: (x, y) => x.has('lowbp') && y.has('lowbp'),
    verdict: 'Caution',
    note: () => tr('Both lower blood pressure. Standing up quickly can make you dizzy or faint.'),
  },
  {
    when: (x, y) => x.has('bleeding') && y.has('bleeding'),
    verdict: 'Caution',
    note: () => tr('Both make bleeding more likely. Watch for easy bruising, nosebleeds or black stools.'),
  },
  {
    when: (x, y) => x.has('liver') && y.has('liver'),
    verdict: 'Caution',
    note: () => tr('Both are hard on the liver.'),
  },
  // Metformin, which touches little but the kidneys and the blood's acid:
  // the few things that push the same way, and for the rest, what to watch.
  {
    when: (x, y) => (x.has('lactic') && y.has('ethanol')) || (y.has('lactic') && x.has('ethanol')),
    verdict: 'Caution',
    note: () => tr('Alcohol makes lactic acidosis from metformin more likely, and a lot of it without food can drop blood sugar. A drink or two with a meal is usually fine: don’t binge, and skip metformin if you’ve been sick.'),
  },
  {
    when: (x, y) => (x.has('lactic') && y.has('acidosis')) || (y.has('lactic') && x.has('acidosis')),
    verdict: 'Caution',
    note: () => tr('Both can make the blood more acidic, and together that adds up. Watch for fast deep breathing, unusual tiredness or stomach pain.'),
  },
  {
    when: (x, y) => (x.has('lactic') && y.has('overheat')) || (y.has('lactic') && x.has('overheat')),
    verdict: 'Caution',
    note: () => tr('A long night on it, in the heat with little water, dries the body out and strains the kidneys, and metformin builds up when they slow. Eat, sip water steadily, and skip metformin if you’re vomiting.'),
  },
  {
    when: (x, y) => x.has('lactic') || y.has('lactic'),
    verdict: 'Low risk',
    note: () => tr('Metformin doesn’t act on the brain and isn’t broken down by the liver, so it isn’t known to change how this one works. If either makes you vomit or stop eating and drinking, skip metformin until you’re eating again.'),
  },
];

export function inferred(a: IndexEntry, b: IndexEntry): PairResult | null {
  if (a.id === b.id) return null;
  const x = traitsOf(a);
  const y = traitsOf(b);
  const rule = RULES.find((r) => r.when(x, y));
  return rule ? { a, b, verdict: rule.verdict, source: 'AI', note: rule.note() } : null;
}

export function checkPair(
  a: IndexEntry,
  b: IndexEntry,
  detailA: Detail | undefined,
  detailB: Detail | undefined,
  matrix: ComboMatrix | undefined
): PairResult {
  const found: PairResult[] = [];
  const keysA = namesFor(a);
  const keysB = namesFor(b);

  const scan = (d: Detail | undefined, other: Set<string>) => {
    for (const c of d?.combinations ?? []) {
      if (other.has(squash(c.substance)))
        found.push({
          a,
          b,
          verdict: c.status,
          note: isBoilerplate(c.note) ? undefined : c.note,
          source: c.note?.startsWith('TripSit') ? 'TripSit' : c.note?.includes('on Wikidata') ? 'Wikidata' : 'PsychonautWiki',
        });
    }
  };
  scan(detailA, keysB);
  scan(detailB, keysA);

  if (matrix) {
    for (const [rk, row] of Object.entries(matrix)) {
      if (!keysA.has(squash(rk))) continue;
      for (const [ck, cell] of Object.entries(row)) {
        if (keysB.has(squash(ck)))
          found.push({ a, b, verdict: fromMatrix(cell.status), note: cell.note, source: 'TripSit' });
      }
    }
  }

  if (found.length) {
    found.sort((x, y) => RANK[y.verdict] - RANK[x.verdict] || Number(!x.note) - Number(!y.note));
    const top = found[0];
    // Borrow a note from an agreeing source if the winner has none.
    const note = top.note ?? found.find((f) => f.verdict === top.verdict && f.note)?.note;
    return { ...top, note };
  }
  const g = guess(a, b);
  const i = inferred(a, b);
  if (g && (!i || RANK[g.verdict] >= RANK[i.verdict])) return g;
  return i ?? { a, b, verdict: 'Unknown' };
}

export function worst(results: PairResult[]): PairResult | undefined {
  return [...results].sort((x, y) => RANK[y.verdict] - RANK[x.verdict])[0];
}
