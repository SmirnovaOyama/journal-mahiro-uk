import { data } from './setup';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Detail, DoseRow } from '../src/lib/data';
import { cleanPerson } from '../src/lib/person';
import { massText, mlFor, mlText, strengthOf, tooSmallToWeigh } from '../src/lib/volumetric';

const row = (id: string, roa: string): DoseRow => {
    const r = data<Detail>(`substances/${id}.json`).doseRows.find(x => x.roa === roa);
    assert.ok(r, `${id} has no ${roa} doses`);
    return r;
};

test('a dose under 10 mg, swallowed, held or snorted, is too small to weigh', () => {
    assert.equal(tooSmallToWeigh(row('clonazolam', 'Oral')), true);
    assert.equal(tooSmallToWeigh(row('lsd', 'Sublingual')), true);
    assert.equal(tooSmallToWeigh(row('25i-nbome', 'Insufflated')), true);
    assert.equal(tooSmallToWeigh(row('alprazolam', 'Oral')), true);
    // 2C-B: 15 mg swallowed is weighed; 8 mg snorted isn't.
    assert.equal(tooSmallToWeigh(row('2c-b', 'Oral')), false);
    assert.equal(tooSmallToWeigh(row('2c-b', 'Insufflated')), true);
});

test('a route a liquid isn’t taken by is left alone', () => {
    assert.equal(tooSmallToWeigh(row('alprazolam', 'Inhaled')), false);
    assert.equal(tooSmallToWeigh(row('2c-b', 'Intravenous')), false);
    assert.equal(tooSmallToWeigh(undefined), false);
});

test('a dose that a scale weighs is left alone', () => {
    assert.equal(tooSmallToWeigh(row('mdma', 'Oral')), false);
    assert.equal(tooSmallToWeigh(row('ketamine', 'Insufflated')), false);
});

test('how strong a liquid is, in the dose’s own unit', () => {
    // 10 mg in 10 mL is 1 mg, 1,000 μg, in each mL.
    assert.equal(strengthOf(10, 'mg', 10, 'μg'), 1000);
    assert.equal(strengthOf(10, 'mg', 10, 'mg'), 1);
    assert.equal(strengthOf(100, 'μg', 5, 'μg'), 20);
    assert.equal(strengthOf(0, 'mg', 10, 'mg'), null);
    assert.equal(strengthOf(10, 'mg', 0, 'mg'), null);
    assert.equal(strengthOf(NaN, 'mg', 10, 'mg'), null);
    assert.equal(strengthOf(10, 'mg', 10, 'mL'), null);
});

test('how much liquid holds a dose', () => {
    // 250 μg at 1,000 μg a mL.
    assert.equal(mlFor(250, 1000), 0.25);
    assert.equal(mlText(0.25), '0.25 mL');
    assert.equal(mlText(1.234), '1.23 mL');
    assert.equal(mlText(0.075), '0.075 mL');
});

test('an amount reads in the unit it reads best in', () => {
    assert.equal(massText(1000, 'μg'), '1 mg');
    assert.equal(massText(250, 'μg'), '250 μg');
    assert.equal(massText(0.5, 'mg'), '500 μg');
    assert.equal(massText(2500, 'mg'), '2.5 g');
});

test('a liquid kept as a product keeps the way it’s taken', () => {
    const p = cleanPerson({
        v: 1,
        medicines: {},
        limits: {},
        products: {
            a: { id: 'a', name: 'Clonazolam, 1 mg in each mL', per: 'mL', parts: [{ substance: 'clonazolam', name: 'Clonazolam', amount: 1000, unit: 'μg' }], route: 'Sublingual', at: 1 },
            b: { id: 'b', name: 'Cold medicine', per: 'tablet', parts: [{ substance: 'paracetamol', name: 'Paracetamol', amount: 500, unit: 'mg' }], route: 7, at: 1 },
        },
    });
    assert.equal(p.products.a.route, 'Sublingual');
    assert.equal(p.products.a.per, 'mL');
    assert.equal('route' in p.products.b, false);
});
