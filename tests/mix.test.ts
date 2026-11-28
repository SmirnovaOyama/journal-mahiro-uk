import { data } from './setup';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ComboMatrix, Detail, IndexEntry } from '../src/lib/data';
import { RANK, checkPair, worst, type Verdict } from '../src/lib/mix';

/* The mix checker, against the catalogue as it is in the repository. A
   wrong answer here is the kind that hurts someone, so each pair below is
   one whose danger no source disputes. They are floors: the checker may
   call a pair worse than this, never milder. */

const index = data<IndexEntry[]>('index.json');
const byId = new Map(index.map(e => [e.id, e]));
const matrix = data<ComboMatrix>('combos.json');
const detail = (id: string) => data<Detail>(`substances/${id}.json`);

function check(a: string, b: string, withDetails = true) {
    const A = byId.get(a);
    const B = byId.get(b);
    assert.ok(A, `${a} is in the catalogue`);
    assert.ok(B, `${b} is in the catalogue`);
    return checkPair(A, B, withDetails ? detail(a) : undefined, withDetails ? detail(b) : undefined, matrix);
}

const AT_LEAST: [string, string, Verdict][] = [
    // Two things that slow breathing.
    ['alprazolam', 'oxycodone', 'Dangerous'],
    ['alcohol', 'ghb', 'Dangerous'],
    ['heroin', 'alcohol', 'Dangerous'],
    ['diazepam', 'methadone', 'Dangerous'],
    ['alcohol', 'ketamine', 'Dangerous'],
    // The sleeping pills, once filed as psychedelics for the hallucinations
    // they can bring, which left zolpidem with alcohol "Not documented".
    ['zolpidem', 'alcohol', 'Dangerous'],
    ['zopiclone', 'alcohol', 'Dangerous'],
    ['eszopiclone', 'alcohol', 'Dangerous'],
    ['zolpidem', 'oxycodone', 'Dangerous'],
    ['zopiclone', 'heroin', 'Dangerous'],
    ['zolpidem', 'ghb', 'Dangerous'],
    ['zolpidem', 'diazepam', 'Dangerous'],
    ['gaboxadol', 'alcohol', 'Dangerous'],
    // Serotonin: an MAOI with a releaser, tramadol or DXM with either.
    ['mdma', 'moclobemide', 'Dangerous'],
    ['mdma', 'tramadol', 'Dangerous'],
    ['dextromethorphan', 'mdma', 'Dangerous'],
    ['tramadol', 'dextromethorphan', 'Unsafe'],
    // An antidepressant taken every day, with what's taken on a night out.
    ['sertraline', 'tramadol', 'Unsafe'],
    ['sertraline', 'dextromethorphan', 'Unsafe'],
    ['fluoxetine', 'dextromethorphan', 'Unsafe'],
    ['escitalopram', 'tramadol', 'Unsafe'],
    ['lithium', 'lsd', 'Dangerous'],
    ['tramadol', 'alcohol', 'Dangerous'],
    ['cocaine', 'alcohol', 'Caution'],
];

for (const [a, b, floor] of AT_LEAST)
    test(`${a} with ${b} is at least ${floor}`, () => {
        const r = check(a, b);
        assert.ok(RANK[r.verdict] >= RANK[floor], `${a} + ${b}: ${r.verdict} (${r.source ?? 'no source'})`);
    });

test('the answer is the same whichever is named first', () => {
    for (const [a, b] of AT_LEAST) assert.equal(check(a, b).verdict, check(b, a).verdict, `${a} + ${b}`);
});

test('a pair no source covers is Unknown, never a kind of safe', () => {
    const r = check('caffeine', 'estradiol-valerate');
    assert.ok(RANK[r.verdict] >= RANK['Unknown'] || r.source !== undefined, `caffeine + estradiol valerate: ${r.verdict}`);
    // Two entries with nothing documented and no kind to guess from.
    const wd = index.filter(e => e.src === 'wd' && e.category === 'Other' && !e.groups?.length).slice(0, 2);
    assert.equal(wd.length, 2);
    assert.equal(checkPair(wd[0], wd[1], undefined, undefined, matrix).verdict, 'Unknown');
});

test('without the substances’ own pages, a depressant with an opioid is still Dangerous', () => {
    assert.equal(check('alprazolam', 'oxycodone', false).verdict, 'Dangerous');
});

test('a sleeping pill is a depressant, whatever else its classes say', () => {
    for (const id of ['zolpidem', 'zopiclone', 'eszopiclone', 'gaboxadol']) assert.equal(byId.get(id)?.category, 'Depressant', id);
    // Without either page, the kind alone still says it.
    assert.equal(check('zolpidem', 'alcohol', false).verdict, 'Dangerous');
});

test('worst picks the most serious', () => {
    const rs = [check('cocaine', 'alcohol'), check('alprazolam', 'oxycodone'), check('cannabis', 'lsd')];
    assert.equal(worst(rs)?.verdict, 'Dangerous');
});

/* Pairs no source covers, which AI works out from what each one does
   (lib/traits.ts). Each is always labelled as AI's, never as a source. */
const BY_AI: [string, string, Verdict][] = [
    ['amantadine', 'pregabalin', 'Caution'],
    ['sertraline', 'trazodone', 'Caution'],
    ['viagra', 'poppers', 'Dangerous'],
    ['disulfiram', 'alcohol', 'Unsafe'],
    ['citalopram', 'quetiapine', 'Unsafe'],
    ['lithium', 'ibuprofen', 'Unsafe'],
    ['diphenhydramine', 'trihexyphenidyl', 'Caution'],
    ['risperidone', 'pramipexole', 'Decrease'],
    ['aspirin', 'fluoxetine', 'Caution'],
    // Metformin, taken every day: a binge, a hot night on MDMA, or a drug
    // that turns the blood acidic too all make lactic acidosis more likely.
    ['metformin', 'alcohol', 'Caution'],
    ['metformin', 'mdma', 'Caution'],
    ['metformin', 'topiramate', 'Caution'],
    // And with what it isn't known to touch, low risk, with what to watch.
    ['metformin', 'cannabis', 'Low risk'],
    ['metformin', 'sertraline', 'Low risk'],
];

test('a pair no source covers gets AI’s estimate, labelled as AI’s', () => {
    for (const [a, b, v] of BY_AI) {
        const r = check(a, b);
        assert.equal(r.verdict, v, `${a} with ${b}`);
        assert.equal(r.source, 'AI', `${a} with ${b} is AI’s`);
        assert.ok(r.note, `${a} with ${b} says why`);
    }
});

test('AI never stands in for a source', () => {
    for (const [a, b] of AT_LEAST) assert.notEqual(check(a, b).source, 'AI', `${a} with ${b}`);
});
