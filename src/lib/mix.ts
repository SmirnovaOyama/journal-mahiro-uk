import { squash, type ComboMatrix, type ComboStatus, type Detail, type IndexEntry } from './data';

/* Whether two substances are safe together. The answer comes from, in turn:
   each substance's own list of combinations (PsychonautWiki and TripSit, as
   synced), the TripSit matrix, and only then a cautious guess from what kind
   of drug each one is, which is always labelled as a guess. Where sources
   disagree the more serious answer wins. */

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
    meaning: 'No source covers this pair. That doesn’t make it safe: start low and don’t be alone.',
  },
};

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
  return !note || /^(documented .* interaction on|tripsit classification)/i.test(note);
}

export type Source = 'PsychonautWiki' | 'TripSit' | 'Guess';

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
      note: 'Both slow your breathing. Together they can stop it, and this is how most overdoses happen.',
    };
  if (has('Dissociative') && (has('Depressant') || has('Opioid')))
    return {
      a,
      b,
      verdict: 'Dangerous',
      source: 'Guess',
      note: 'Risk of passing out and vomiting while unable to protect your airway.',
    };
  if (both(['Stimulant', 'Empathogen']))
    return {
      a,
      b,
      verdict: 'Caution',
      source: 'Guess',
      note: 'Both push heart rate, blood pressure and body temperature up.',
    };
  return null;
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
          source: c.note?.startsWith('TripSit') ? 'TripSit' : 'PsychonautWiki',
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
  return guess(a, b) ?? { a, b, verdict: 'Unknown' };
}

export function worst(results: PairResult[]): PairResult | undefined {
  return [...results].sort((x, y) => RANK[y.verdict] - RANK[x.verdict])[0];
}
