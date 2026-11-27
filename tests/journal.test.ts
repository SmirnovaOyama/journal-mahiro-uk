import './setup';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SESSION_GAP, emptyJournal, merge, parseImport, sessionsOf, syncMerge, type Ingestion, type JournalData } from '../src/lib/journal';
import { cleanPerson, emptyPerson, medicinesOf, mergePerson, productsOf } from '../src/lib/person';
import { href, parse } from '../src/lib/routes';

/* The journal's merging: what two devices signed in to one account end up
   with. A mistake here loses a dose or brings a deleted one back. */

const HOUR = 3600_000;
const dose = (id: string, time: number, over: Partial<Ingestion> = {}): Ingestion => ({
    id,
    substance: 'caffeine',
    name: 'Caffeine',
    route: 'Oral',
    dose: 100,
    unit: 'mg',
    estimate: false,
    time,
    at: time,
    ...over,
});
const journal = (ingestions: Ingestion[], over: Partial<JournalData> = {}): JournalData => ({ ...emptyJournal(), ingestions, ...over });

test('a dose on either device is kept', () => {
    const m = syncMerge(journal([dose('a', 1000)]), journal([dose('b', 2000)]));
    assert.deepEqual(m.ingestions.map(i => i.id), ['a', 'b']);
});

test('a dose on both is the version changed last, the account’s on a tie', () => {
    const local = journal([dose('a', 1000, { dose: 200, at: 5000 })]);
    const remote = journal([dose('a', 1000, { dose: 150, at: 4000 })]);
    assert.equal(syncMerge(local, remote).ingestions[0].dose, 200);
    assert.equal(syncMerge(remote, local).ingestions[0].dose, 200);
    const tie = syncMerge(journal([dose('a', 1000, { dose: 1, at: 7 })]), journal([dose('a', 1000, { dose: 2, at: 7 })]));
    assert.equal(tie.ingestions[0].dose, 2);
});

test('a dose deleted on one device never comes back from the other', () => {
    const here = journal([], { gone: { a: 9000 } });
    const there = journal([dose('a', 1000, { at: 99_000 })]);
    assert.equal(syncMerge(here, there).ingestions.length, 0);
    assert.equal(syncMerge(there, here).ingestions.length, 0);
    assert.equal(syncMerge(here, there).gone?.a, 9000);
});

test('merging is the same whichever device does it, and settles', () => {
    const a = journal([dose('a', 1000), dose('c', 3000, { substance: 'lsd', name: 'LSD' })], { meta: { a: { title: 'Mine', at: 10 } }, gone: { x: 5 } });
    const b = journal([dose('b', 2000), dose('a', 1000, { note: 'theirs', at: 2000 })], { meta: { a: { title: 'Theirs', at: 20 } }, gone: { c: 8000 } });
    const ab = syncMerge(a, b);
    const ba = syncMerge(b, a);
    assert.deepEqual(ab.ingestions, ba.ingestions);
    assert.deepEqual(ab.meta, ba.meta);
    assert.deepEqual(ab.gone, ba.gone);
    assert.equal(ab.meta?.a.title, 'Theirs');
    assert.deepEqual(ab.ingestions.map(i => i.id), ['a', 'b']);
    // Merged again with either side, nothing changes.
    assert.deepEqual(syncMerge(ab, b).ingestions, ab.ingestions);
    assert.deepEqual(syncMerge(a, ab).ingestions, ab.ingestions);
});

test('every substance in the merged journal has a colour, and no two share the account’s', () => {
    const a = journal([dose('a', 1000)], { colors: { caffeine: 'red' } });
    const b = journal([dose('b', 2000, { substance: 'lsd' })], { colors: { lsd: 'red' } });
    const m = syncMerge(a, b);
    assert.equal(m.colors.lsd, 'red');
    assert.ok(m.colors.caffeine && m.colors.caffeine !== 'red');
});

test('doses within twelve hours of the one before are one session', () => {
    const t = Date.UTC(2026, 10, 20, 20);
    const list = [dose('a', t), dose('b', t + 11 * HOUR), dose('c', t + 11 * HOUR + SESSION_GAP), dose('d', t + 11 * HOUR + 2 * SESSION_GAP + 1)];
    const s = sessionsOf(list);
    assert.equal(s.length, 2);
    assert.deepEqual(s[0].ingestions.map(i => i.id), ['d']);
    assert.deepEqual(s[1].ingestions.map(i => i.id), ['a', 'b', 'c']);
    assert.equal(s[1].id, 'a');
});

test('an import skips what is already there and renames what was deleted', () => {
    const into = journal([dose('a', 60_000)], { gone: { z: 1 } });
    const from = journal([dose('other-id', 60_000), dose('z', 120_000), dose('n', 180_000, { dose: 50 })]);
    const { next, added } = merge(into, from);
    assert.equal(added, 2);
    assert.equal(next.ingestions.length, 3);
    assert.ok(!next.ingestions.some(i => i.id === 'z'), 'the deleted id is not reused');
});

test('a PsychonautWiki Journal export is read', () => {
    const file = JSON.stringify({
        experiences: [
            {
                title: 'A night',
                text: 'Fine.',
                ratings: [{ option: 'TWO_PLUS' }],
                ingestions: [{ substanceName: 'MDMA', time: 1_700_000_000_000, dose: 100, units: 'mg', administrationRoute: 'ORAL', isDoseAnEstimate: true }],
            },
        ],
    });
    const j = parseImport(file, n => (n === 'MDMA' ? { id: 'mdma', name: 'MDMA' } : undefined));
    assert.ok(j);
    assert.equal(j.ingestions[0].substance, 'mdma');
    assert.equal(j.ingestions[0].estimate, true);
    assert.equal(Object.values(j.meta ?? {})[0].rating, '++');
    assert.equal(parseImport('not json', () => undefined), null);
    assert.equal(parseImport('{"something":"else"}', () => undefined), null);
});

/* ── the person: medicines, limits, products ── */

test('two devices’ medicines, limits and products merge to the later of each', () => {
    const a = { ...emptyPerson(), medicines: { sertraline: { on: true, at: 10, name: 'Sertraline' }, lithium: { on: true, at: 5, name: 'Lithium' } } };
    const b = { ...emptyPerson(), medicines: { lithium: { on: false, at: 9, name: 'Lithium' } }, limits: { mdma: { max: 120, unit: 'mg', at: 3 } } };
    const m = mergePerson(a, b);
    assert.deepEqual(medicinesOf(m), [{ id: 'sertraline', name: 'Sertraline' }]);
    assert.equal(m.limits.mdma.max, 120);
    assert.deepEqual(mergePerson(b, a), m);
    assert.deepEqual(mergePerson(null, undefined), emptyPerson());
});

test('a malformed person is cleaned, not trusted', () => {
    const p = cleanPerson({
        medicines: { a: { on: 1, at: 5 }, b: 'nope', c: { on: true } },
        limits: { x: { max: -4, unit: 'mg', gap: 30, at: 1 }, y: { max: 5, at: 2 } },
        products: { p: { name: 'Cold tablets', per: 'tablet', at: 4, parts: [{ substance: 'apap', name: 'Paracetamol', amount: 325, unit: 'mg' }, { substance: 'x', name: 'X', amount: 0, unit: 'mg' }] }, q: { at: 1 } },
    });
    assert.deepEqual(Object.keys(p.medicines), ['a']);
    assert.equal(p.medicines.a.name, 'a');
    assert.deepEqual(p.limits.x, { at: 1, gap: 30 });
    assert.deepEqual(p.limits.y, { at: 2 });
    assert.equal(productsOf(p).length, 1);
    assert.equal(productsOf(p)[0].parts.length, 1);
});

/* ── the pages' paths ── */

test('every page’s path reads back as the same page', () => {
    const routes = [
        { page: 'home' },
        { page: 'substance', id: 'lsd' },
        { page: 'mix', ids: ['mdma', 'tramadol'] },
        { page: 'mix', ids: [] },
        { page: 'kind', category: 'Stimulant' },
        { page: 'journal' },
        { page: 'journal', view: 'stats' },
        { page: 'journal', session: 'abc' },
        { page: 'journal', substance: '2c-b' },
        { page: 'settings', sub: 'medicines' },
        { page: 'settings', sub: 'privacy' },
        { page: 'settings', sub: 'features' },
        { page: 'emergency' },
        { page: 'now' },
        { page: 'watch', id: 'AbC_-123' },
        { page: 'log' },
        { page: 'log', id: 'caffeine', dose: 100, unit: 'mg', route: 'Oral' },
        { page: 'log', id: 'lsd', dose: 0.1, unit: 'mg' },
    ] as const;
    for (const r of routes) assert.deepEqual(parse(href(r as never)), r, href(r as never));
    assert.equal(href({ page: 'log', id: 'caffeine', dose: 100, unit: 'mg', route: 'Oral' }), '/log/caffeine/100mg/oral');
    assert.deepEqual(parse('/log/Estradiol-Valerate/5mg/intramuscular'), { page: 'log', id: 'estradiol-valerate', dose: 5, unit: 'mg', route: 'Intramuscular' });
    assert.deepEqual(parse('/log/caffeine/2tabs'), { page: 'log', id: 'caffeine', dose: 2, unit: 'tabs' });
    assert.deepEqual(parse('/nowhere'), { page: 'home' });
});
