import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressLang } from '../src/lib/routes';

/* The language a shared link asks for in its own address (?lang=…). */

test('the site\'s own names for its languages', () => {
    assert.deepEqual(addressLang('en'), { lang: 'en', tag: 'en', param: 'en' });
    assert.deepEqual(addressLang('zh-Hans'), { lang: 'zh-Hans', tag: 'zh-Hans', param: 'zh-Hans' });
    assert.deepEqual(addressLang('zh-Hant'), { lang: 'zh-Hant', tag: 'zh-Hant', param: 'zh-Hant' });
});

test('short for them, as someone types by hand', () => {
    assert.equal(addressLang('cn')?.lang, 'zh-Hans');
    assert.equal(addressLang('tw')?.lang, 'zh-Hant');
    assert.equal(addressLang('hk')?.tag, 'zh-Hant-HK');
    assert.equal(addressLang('CN')?.lang, 'zh-Hans');
});

test('the tags a browser sends', () => {
    assert.equal(addressLang('zh-CN')?.lang, 'zh-Hans');
    assert.equal(addressLang('zh_TW')?.lang, 'zh-Hant');
    assert.equal(addressLang('zh-HK')?.param, 'zh-HK');
    assert.equal(addressLang('zh-Hant-MO')?.tag, 'zh-Hant-HK');
    assert.equal(addressLang('en-GB')?.lang, 'en');
});

test('Chinese that says nothing of where is 简体中文', () => {
    assert.equal(addressLang('zh')?.lang, 'zh-Hans');
});

test('anything else is no language at all, and the request\'s own is used', () => {
    for (const v of ['', null, undefined, 'fr', 'japanese', 'c', 'zhx', 'english-please', '1']) assert.equal(addressLang(v), null, String(v));
});
