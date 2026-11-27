import { data } from './setup';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speak, type Lang } from '../src/lib/i18n';
import zhWords from '../src/lib/zh-Hant';
import zhData, { terms as zhTerms } from '../src/lib/zh-Hant-data';
import { handleTelegram, namesIn } from '../worker/telegram';

/* The Telegram bot, asked as Telegram asks it. */

const SECRET = 'test-secret';
const tools = {
    load: async <T>(path: string) => {
        try {
            return data<T>(path.replace(/^\/data\//, ''));
        } catch {
            return undefined;
        }
    },
    speak: (lang: Lang) => (lang === 'en' ? speak('en', null, null, null) : speak(lang, zhWords, zhData, zhTerms)),
};

async function ask(update: object, secret: string | null = SECRET, env = { TELEGRAM_SECRET: SECRET }) {
    const res = await handleTelegram(
        new Request('https://journal.mahiro.uk/api/telegram', {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {}) },
            body: JSON.stringify(update),
        }),
        env,
        tools,
    );
    const text = await res.text();
    return { status: res.status, body: res.status === 200 && text ? (JSON.parse(text) as Record<string, any>) : null };
}
const message = (text: string, type = 'private', language_code = 'en') => ({ message: { message_id: 7, text, chat: { id: 42, type }, from: { language_code } } });

test('names are read out of a question however it’s written', () => {
    assert.deepEqual(namesIn('mdma + tramadol'), ['mdma', 'tramadol']);
    assert.deepEqual(namesIn('mdma tramadol'), ['mdma', 'tramadol']);
    assert.deepEqual(namesIn('magic mushrooms, alcohol'), ['magic mushrooms', 'alcohol']);
    assert.deepEqual(namesIn('ketamine with alcohol'), ['ketamine', 'alcohol']);
    assert.deepEqual(namesIn('氯胺酮 和 酒精'), ['氯胺酮', '酒精']);
});

test('nothing answers without the secret Telegram sends', async () => {
    assert.equal((await ask(message('/help'), null)).status, 403);
    assert.equal((await ask(message('/help'), 'wrong')).status, 403);
    assert.equal((await ask(message('/help'), SECRET, { TELEGRAM_SECRET: '' })).status, 404);
});

test('/mix gives the most serious answer and links to its page', async () => {
    const { status, body } = await ask(message('/mix mdma tramadol'));
    assert.equal(status, 200);
    assert.equal(body!.method, 'sendMessage');
    assert.equal(body!.chat_id, 42);
    assert.match(body!.text, /MDMA and Tramadol: Dangerous/);
    assert.match(body!.text, /https:\/\/journal\.mahiro\.uk\/mix\/mdma\+tramadol/);
});

test('an antidepressant with DXM reads Dangerous here too', async () => {
    const { body } = await ask(message('/mix sertraline dextromethorphan'));
    assert.match(body!.text, /Dangerous/);
});

test('/dose and plain words give a substance, with its page', async () => {
    for (const q of ['/dose ketamine', 'ketamine']) {
        const { body } = await ask(message(q));
        assert.match(body!.text, /<b>Ketamine<\/b>/);
        assert.match(body!.text, /A common dose: /);
        assert.match(body!.text, /https:\/\/journal\.mahiro\.uk\/s\/ketamine/);
    }
});

test('in a group it speaks only when spoken to by a command', async () => {
    assert.equal((await ask(message('ketamine', 'supergroup'))).body, null);
    assert.match((await ask(message('/dose@OyamaJournalBot ketamine', 'supergroup'))).body!.text, /Ketamine/);
});

test('what isn’t in the catalogue is said so, and text is escaped', async () => {
    const { body } = await ask(message('/mix mdma <script>'));
    assert.match(body!.text, /Nothing called/);
    assert.ok(!body!.text.includes('<script>'));
});

test('it answers in 正體中文 to someone who reads it', async () => {
    const { body } = await ask(message('/mix mdma tramadol', 'private', 'zh-hant'));
    assert.match(body!.text, /危險/);
    tools.speak('en');
});

test('an inline question gets a mix, or the substances it could mean', async () => {
    const mix = await ask({ inline_query: { id: 'q1', query: 'mdma + tramadol', from: { language_code: 'en' } } });
    assert.equal(mix.body!.method, 'answerInlineQuery');
    assert.equal(mix.body!.results.length, 1);
    assert.match(mix.body!.results[0].title, /Dangerous/);
    const one = await ask({ inline_query: { id: 'q2', query: 'keta', from: { language_code: 'en' } } });
    assert.ok(one.body!.results.length >= 1);
    assert.equal(one.body!.results[0].title, 'Ketamine');
    assert.deepEqual((await ask({ inline_query: { id: 'q3', query: '' } })).body!.results, []);
});
