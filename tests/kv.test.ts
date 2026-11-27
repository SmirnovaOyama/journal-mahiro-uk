import './setup';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changeCode, forgetOpen, hasOtherCode, inOtherBox, kv, lockOff, lockOn, lockState, setOtherCode, settled, unlock } from '../src/lib/kv';
import { openWatch, sealWatch, type Watched } from '../src/lib/watch';

/* The lock on the journal. A mistake here loses someone's journal, or
   leaves it readable when they were told it wasn't. One test, in order:
   each step starts from what the one before left. */

const store = globalThis.localStorage;
const JOURNAL = 'journal.log.v1';
const plainKeys = () => Array.from({ length: store.length }, (_, i) => store.key(i)!);

test('the lock, from on to off', async () => {
    store.clear();
    store.setItem(JOURNAL, '{"v":1,"ingestions":[{"id":"a"}]}');
    store.setItem('journal.saved.log.v1', '{"lsd":{"on":true,"at":1}}');
    store.setItem('journal.theme.v2', '"dark"');
    assert.equal(lockState(), 'off');

    // On: the journal's lines leave plain storage; what the page needs
    // before the code is typed stays.
    await lockOn('correct horse');
    assert.equal(lockState(), 'open');
    assert.equal(store.getItem(JOURNAL), null);
    assert.equal(store.getItem('journal.saved.log.v1'), null);
    assert.equal(store.getItem('journal.theme.v2'), '"dark"');
    assert.equal(kv.get(JOURNAL), '{"v":1,"ingestions":[{"id":"a"}]}');
    for (const k of plainKeys()) assert.ok(!store.getItem(k)!.includes('ingestions'), `${k} holds nothing readable`);
    assert.equal(inOtherBox(), false);

    // A change while open is written into the box, not beside it.
    kv.set(JOURNAL, '{"v":1,"ingestions":[{"id":"a"},{"id":"b"}]}');
    await settled();
    assert.equal(store.getItem(JOURNAL), null);

    // Closed: nothing reads until the code is typed, and a wrong one opens nothing.
    forgetOpen();
    assert.equal(lockState(), 'locked');
    assert.equal(kv.get(JOURNAL), null);
    assert.equal(await unlock('wrong'), false);
    assert.equal(lockState(), 'locked');
    assert.equal(await unlock('correct horse'), true);
    assert.equal(kv.get(JOURNAL), '{"v":1,"ingestions":[{"id":"a"},{"id":"b"}]}');

    // The other code opens an empty journal, and what's written there
    // never reaches the journal's own box.
    await assert.rejects(setOtherCode('correct horse'), /Same/);
    await setOtherCode('1234');
    assert.equal(hasOtherCode(), true);
    forgetOpen();
    assert.equal(await unlock('1234'), true);
    assert.equal(inOtherBox(), true);
    assert.equal(kv.get(JOURNAL), null);
    assert.equal(hasOtherCode(), false, 'the empty box doesn’t say there is another');
    kv.set(JOURNAL, '{"v":1,"ingestions":[]}');
    await settled();
    // From the empty box the lock can't be changed or turned off.
    await assert.rejects(lockOff(), /Not the journal/);
    await assert.rejects(changeCode('new'), /Not the journal/);
    await assert.rejects(setOtherCode(null), /Not the journal/);
    forgetOpen();
    assert.equal(await unlock('correct horse'), true);
    assert.equal(kv.get(JOURNAL), '{"v":1,"ingestions":[{"id":"a"},{"id":"b"}]}');

    // A new code: the old one stops working, the other code still does.
    await assert.rejects(changeCode('1234'), /Same/);
    await changeCode('battery staple');
    forgetOpen();
    assert.equal(await unlock('correct horse'), false);
    assert.equal(await unlock('1234'), true);
    forgetOpen();
    assert.equal(await unlock('battery staple'), true);

    // The other code taken away: its box goes with it.
    await setOtherCode(null);
    assert.equal(hasOtherCode(), false);
    forgetOpen();
    assert.equal(await unlock('1234'), false);
    assert.equal(await unlock('battery staple'), true);

    // Off: the lines are plain again, and nothing of the lock is left.
    await lockOff();
    assert.equal(lockState(), 'off');
    assert.equal(store.getItem(JOURNAL), '{"v":1,"ingestions":[{"id":"a"},{"id":"b"}]}');
    assert.equal(store.getItem('journal.saved.log.v1'), '{"lsd":{"on":true,"at":1}}');
    assert.deepEqual(plainKeys().filter(k => k.startsWith('journal.lock') || k.startsWith('journal.box')), []);
});

test('a shared night opens with its key and its id, and with nothing else', async () => {
    const night: Watched = {
        v: 1,
        sent: 1,
        every: 30,
        checked: 1,
        expires: 2,
        doses: [{ id: 'a', substance: 'mdma', name: 'MDMA', route: 'Oral', dose: 100, unit: 'mg', estimate: false, time: 1 }],
        medicines: [],
    };
    const key = 'A'.repeat(43);
    const other = 'B'.repeat(43);
    const sealed = await sealWatch(night, 'id-one', key);
    assert.match(sealed, /^w1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/);
    assert.ok(!sealed.includes('mdma'));
    assert.deepEqual(await openWatch(sealed, 'id-one', key), night);
    await assert.rejects(openWatch(sealed, 'id-one', other));
    await assert.rejects(openWatch(sealed, 'id-two', key));
});
