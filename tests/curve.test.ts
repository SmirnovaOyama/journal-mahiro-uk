import './setup';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockTimes, curvePieces, nightSpan, type CurveDose } from '../src/lib/curve';

/* The shape of a night, as the session chart and the night's picture both
   draw it (lib/curve.ts). */

const MIN = 60_000;
const t0 = new Date('2026-11-21T21:10:00').getTime();
const course = { firstEffects: 30, peakStart: 75, peakEnd: 180, over: 300 };
const dose = (at: number, over: Partial<CurveDose> = {}): CurveDose => ({ time: at, course, strength: 1, ...over });

test('a night runs from a quarter of an hour before its first dose to a little after its last curve', () => {
    const { first, start, end } = nightSpan([dose(t0), dose(t0 + 60 * MIN)], null);
    assert.equal(first, t0);
    assert.equal(start, t0 - 15 * MIN);
    const landed = t0 + 60 * MIN + 300 * MIN;
    assert.equal(end, landed + (landed - start) * 0.06);
});

test('"now" stretches the night only when it is in it or just after', () => {
    const night = nightSpan([dose(t0)], null);
    const later = nightSpan([dose(t0)], night.end + 60 * MIN);
    assert.equal(later.end, night.end + 80 * MIN);
    const weeksOn = nightSpan([dose(t0)], t0 + 21 * 24 * 60 * MIN);
    assert.equal(weeksOn.end, night.end);
});

test('a curve starts and ends on the baseline, and a strong dose stands taller', () => {
    const x = (t: number) => (t - t0) / MIN;
    const y = (level: number) => 100 - level * 100;
    const pieces = curvePieces(dose(t0), x, y);
    const firstPoint = 'line' in pieces[0] ? pieces[0].line[0] : pieces[0].cubic[0];
    const last = pieces[pieces.length - 1];
    const lastPoint = 'line' in last ? last.line[1] : last.cubic[3];
    assert.deepEqual(firstPoint, [0, 100]);
    assert.deepEqual(lastPoint, [300, 100]);
    const peak = (d: CurveDose) => {
        const p = curvePieces(d, x, y)[2];
        return 'line' in p ? p.line[0][1] : NaN;
    };
    assert.ok(peak(dose(t0, { strength: 1.1 })) < peak(dose(t0, { strength: 0.5 })));
});

test('the clock times begin with when the night began', () => {
    const span = nightSpan([dose(t0)], null);
    const x = (t: number) => ((t - span.start) / (span.end - span.start)) * 800;
    const times = clockTimes(span, 800, x, 150, 120);
    assert.equal(times[0], t0);
    for (const t of times.slice(1)) assert.equal(new Date(t).getMinutes(), 0);
});

/* Doses of one thing, added up; different drugs of one kind, together. */

test('a second dose of the same thing is one curve, taller where they overlap', async () => {
    const { stacks, stackPieces, levelAt, stackTop } = await import('../src/lib/curve');
    const a = { ...dose(t0), id: 'a', group: 'water' };
    const b = { ...dose(t0 + 5 * MIN), id: 'b', group: 'water' };
    const other = { ...dose(t0 + MIN), id: 'c', group: 'caffeine' };
    const groups = stacks([b, other, a]);
    assert.deepEqual(groups.map(g => g.map(d => d.id)), [['a', 'b'], ['c']]);
    const at = t0 + 100 * MIN;
    assert.ok(Math.abs(levelAt(a, at) + levelAt(b, at) - 2 * levelAt(a, at)) < 0.05);
    assert.ok(stackTop([a, b]) > 1.7); // two doses, each 0.87 tall
    // One curve, from the first dose to the last one's landing.
    const ps = stackPieces([a, b], t => t, l => l);
    const first = 'line' in ps[0] ? ps[0].line[0] : ps[0].cubic[0];
    const last = ps[ps.length - 1];
    assert.equal(first[0], t0);
    assert.equal('line' in last ? last.line[1][0] : last.cubic[3][0], t0 + 305 * MIN);
});

test('doses of one thing are where the furthest along of them is', async () => {
    const { stackStage } = await import('../src/lib/curve');
    const water = { firstEffects: 10, peakStart: 25, peakEnd: 55, over: 145 };
    const a = { time: t0, course: water, strength: 1 };
    const b = { time: t0 + 11 * MIN, course: water, strength: 1 };
    // 13 minutes after the first glass, 2 after the second: coming up, not starting.
    assert.equal(stackStage([a, b], t0 + 13 * MIN), 'coming up');
    assert.equal(stackStage([a, b], t0 + 30 * MIN), 'peak');
    assert.equal(stackStage([a, b], t0 - MIN), 'none');
    assert.equal(stackStage([a, b], t0 + 200 * MIN), 'over');
});

test('two different depressants at work together have a load; one alone, or a psychedelic pair, has none', async () => {
    const { loads, loadKindOf } = await import('../src/lib/curve');
    assert.equal(loadKindOf('Opioid'), 'depressant');
    assert.equal(loadKindOf('Psychedelic'), undefined);
    const alcohol = { ...dose(t0), id: 'a', group: 'alcohol', load: loadKindOf('Depressant') };
    const gaba = { ...dose(t0 + 60 * MIN), id: 'g', group: 'gabapentin', load: loadKindOf('Depressant') };
    const again = { ...dose(t0 + 30 * MIN), id: 'a2', group: 'alcohol', load: loadKindOf('Depressant') };
    assert.deepEqual(loads([alcohol, again]), []);
    const l = loads([alcohol, gaba, again]);
    assert.equal(l.length, 1);
    assert.equal(l[0].kind, 'depressant');
    assert.equal(l[0].ds.length, 3);
    // Never meeting: none.
    const late = { ...gaba, time: t0 + 24 * 60 * MIN };
    assert.deepEqual(loads([alcohol, late]), []);
});
