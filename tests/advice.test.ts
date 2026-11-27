import { data } from './setup';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    daysInARow,
    halfLifeHours,
    lastNightOf,
    lastTime,
    lingerHours,
    lingering,
    nightTotal,
    paracetamolMg,
    runs,
    stopKind,
} from '../src/lib/advice';
import type { Detail, IndexEntry } from '../src/lib/data';
import { emptyJournal, type Ingestion } from '../src/lib/journal';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const index = data<IndexEntry[]>('index.json');
const byId = new Map(index.map(e => [e.id, e]));
const detail = (id: string) => data<Detail>(`substances/${id}.json`);

let n = 0;
const dose = (substance: string, time: number, over: Partial<Ingestion> = {}): Ingestion => ({
    id: `d${n++}`,
    substance,
    name: substance,
    route: 'Oral',
    dose: 100,
    unit: 'mg',
    estimate: false,
    time,
    ...over,
});

test('a half-life is read from the first figure, at its upper end', () => {
    assert.equal(halfLifeHours('1–3 days (acute); 4–6 days (chronic)'), 72);
    assert.equal(halfLifeHours('11.6 hours'), 11.6);
    assert.equal(halfLifeHours('4.5–7 hours (mean 6.3 hours)'), 7);
    assert.equal(halfLifeHours('MDMA: 8.7 (range 4.6–16) hours'), 16);
    assert.equal(halfLifeHours('(50 hours); 20–100 hours'), 50);
    assert.equal(halfLifeHours('30 min'), 0.5);
    assert.equal(halfLifeHours('unknown'), null);
    assert.equal(halfLifeHours(undefined), null);
});

test('a drug is reckoned with for five half-lives, a day at least, and a label’s wait where it is longer', () => {
    assert.equal(lingerHours('fluoxetine', detail('fluoxetine')), 35 * 24);
    assert.equal(lingerHours('phenelzine', detail('phenelzine')), 14 * 24);
    assert.equal(lingerHours('sertraline', detail('sertraline')), 26 * 5);
    assert.equal(lingerHours('pregabalin', detail('pregabalin')), 35);
    assert.equal(lingerHours('nothing-known'), 24);
    // Never past three weeks on a half-life alone.
    assert.ok(lingerHours('diazepam', detail('diazepam')) <= 21 * 24);
});

test('what was logged days ago and is still at work is found; what has left is not', () => {
    const now = Date.UTC(2026, 10, 27, 20);
    const details = { fluoxetine: detail('fluoxetine'), pregabalin: detail('pregabalin'), sertraline: detail('sertraline') };
    const list = [dose('fluoxetine', now - 20 * DAY), dose('fluoxetine', now - 30 * DAY), dose('pregabalin', now - 3 * DAY), dose('sertraline', now - 4 * DAY), dose('sertraline', now - 2 * HOUR)];
    const still = lingering(list, details, now);
    assert.deepEqual(still.map(i => i.substance).sort(), ['fluoxetine', 'sertraline']);
    assert.equal(still.find(i => i.substance === 'fluoxetine')!.time, now - 20 * DAY);
});

test('last time is the last night with something written, never tonight', () => {
    const now = Date.UTC(2026, 10, 27, 22);
    const a = dose('mdma', now - 60 * DAY);
    const b = dose('mdma', now - 30 * DAY, { note: 'second half an hour too soon' });
    const c = dose('mdma', now - 10 * DAY);
    const tonight = dose('mdma', now - 2 * HOUR, { note: 'tonight' });
    const j = { ...emptyJournal(), ingestions: [a, b, c, tonight], meta: { [a.id]: { note: 'Too much. 80 mg would have done.', rating: '+++' } } };
    const last = lastTime(j, 'mdma', now);
    assert.ok(last);
    assert.deepEqual(last.doseNotes, ['second half an hour too soon']);
    assert.equal(last.session.id, b.id);
    assert.equal(lastTime({ ...j, ingestions: [a, tonight] }, 'mdma', now)?.note, 'Too much. 80 mg would have done.');
    assert.equal(lastTime(j, 'lsd', now), null);
    assert.equal(lastTime({ ...emptyJournal(), ingestions: [tonight] }, 'mdma', now), null);
});

test('a night’s total adds what converts and counts what doesn’t', () => {
    const now = Date.UTC(2026, 10, 27, 23);
    const list = [
        dose('mdma', now - 3 * HOUR, { dose: 80 }),
        dose('mdma', now - 1 * HOUR, { dose: 0.04, unit: 'g' }),
        dose('mdma', now - 2 * HOUR, { dose: null }),
        dose('mdma', now - 2 * HOUR, { dose: 1, unit: 'tabs' }),
        dose('lsd', now - 2 * HOUR, { dose: 100, unit: 'μg' }),
        dose('mdma', now - 40 * DAY, { dose: 500 }),
    ];
    assert.deepEqual(nightTotal(list, 'mdma', now, 'mg'), { total: 120, unknown: 2 });
    assert.equal(lastNightOf(list, 'mdma', now), now - 40 * DAY);
    assert.equal(lastNightOf(list, 'lsd', now), null);
});

test('paracetamol is added up over 24 hours, whatever it was logged in', () => {
    const now = Date.UTC(2026, 10, 27, 23);
    const list = [
        dose('apap', now - 2 * HOUR, { dose: 1, unit: 'g' }),
        dose('apap', now - 20 * HOUR, { dose: 650 }),
        dose('apap', now - 25 * HOUR, { dose: 1000 }),
        dose('apap', now - 3 * HOUR, { dose: 2, unit: 'tabs' }),
        dose('dextromethorphan', now - 2 * HOUR, { dose: 300 }),
    ];
    assert.deepEqual(paracetamolMg(list, now), { mg: 1650, unknown: 1 });
    assert.ok(byId.has('apap'), 'paracetamol is in the catalogue as apap');
});

test('days in a row are calendar days, up to today or yesterday', () => {
    const noon = new Date(2026, 10, 27, 12).getTime();
    const list = [0, 1, 2, 3, 5].map(k => dose('pregabalin', noon - k * DAY));
    assert.equal(daysInARow(list, 'pregabalin', noon), 4);
    assert.equal(daysInARow(list.slice(1), 'pregabalin', noon), 3);
    assert.equal(daysInARow(list.slice(2), 'pregabalin', noon), 0);
    // Two doses a day are one day.
    assert.equal(daysInARow([...list, dose('pregabalin', noon - HOUR)], 'pregabalin', noon), 4);
});

test('a week of pregabalin every day is noticed; a week of caffeine is not', () => {
    const noon = new Date(2026, 10, 27, 12).getTime();
    const week = (id: string, days = 8) => Array.from({ length: days }, (_, k) => dose(id, noon - k * DAY));
    const found = runs([...week('pregabalin'), ...week('caffeine'), ...week('diazepam', 3), ...week('tramadol', 9)], byId, noon);
    assert.deepEqual(found, [
        { id: 'tramadol', days: 9, kind: 'opioid' },
        { id: 'pregabalin', days: 8, kind: 'gabapentinoid' },
    ]);
    assert.equal(stopKind(byId.get('alprazolam')!), 'benzodiazepine');
    assert.equal(stopKind(byId.get('etizolam')!), 'benzodiazepine');
    assert.equal(stopKind(byId.get('zolpidem')!), 'z-drug');
    assert.equal(stopKind(byId.get('lsd')!), null);
});
