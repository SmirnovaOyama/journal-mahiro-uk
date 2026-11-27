/* The site as a Telegram bot: the same catalogue and the same mix checker,
   asked from a chat.

       /mix mdma tramadol          one answer, the most serious pair first
       /dose ketamine              what it is, a common dose, how long it lasts
       ketamine                    the same, in a chat with the bot alone
       @thebot mdma + tramadol     in any chat, as an inline answer

   Telegram posts each message to /api/telegram, and the answer goes back
   as the reply to that very request, so the Worker never calls Telegram
   and holds no bot token: only TELEGRAM_SECRET, which Telegram sends with
   each update (set with the webhook, scripts/telegram-webhook.mjs) and
   without which nothing here answers. Nothing is kept or logged: a
   question is answered and forgotten.

   It speaks the language Telegram says the asker uses, with the site's
   own words (src/lib/i18n.ts), and every answer links to its page. */

import { describe, nameOf, resolveName, search, type ComboMatrix, type Detail, type IndexEntry } from '../src/lib/data';
import { phraseList, roaName, spanText, tr, type Lang } from '../src/lib/i18n';
import { RANK, VERDICT, checkPair, type PairResult } from '../src/lib/mix';
import { SITE } from '../src/lib/preview';

export interface TelegramEnv {
    /** What Telegram sends with every update, so no one else can ask as it. */
    TELEGRAM_SECRET?: string;
}

/** What this file needs of the Worker: a file of the catalogue, and its words in a language. */
export interface TelegramTools {
    load<T>(path: string): Promise<T | undefined>;
    speak(lang: Lang): void;
}

interface From {
    language_code?: string;
}
interface Update {
    message?: { message_id: number; text?: string; chat: { id: number; type: string }; from?: From };
    inline_query?: { id: string; query: string; from?: From };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b = (s: string) => `<b>${esc(s)}</b>`;
const link = (path: string, text: string) => `<a href="${SITE.origin}${path}">${esc(text)}</a>`;

function langOf(from?: From): Lang {
    const code = (from?.language_code ?? '').toLowerCase();
    if (!code.startsWith('zh')) return 'en';
    return /hant|tw|hk|mo/.test(code) ? 'zh-Hant' : 'zh-Hans';
}

function same(a: string, c: string): boolean {
    if (a.length !== c.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ c.charCodeAt(i);
    return diff === 0;
}

/** The names in a question: "mdma + tramadol", "mdma, tramadol", "mdma tramadol", "mdma with tramadol". */
export function namesIn(text: string): string[] {
    const t = text.trim();
    const parts = /[+,，、＋]|\s(with|and|和|與|与|加)\s/i.test(t) ? t.split(/\s*[+,，、＋]\s*|\s+(?:with|and|和|與|与|加)\s+/i) : t.split(/\s+/);
    return parts.map(p => p.trim()).filter(Boolean);
}

const find = (index: IndexEntry[], name: string) => resolveName(index, name) ?? search(index, name, 1)[0]?.entry;

/* ── the answers, worded ────────────────────────────────────────────── */

function help(): string {
    return [
        b('Oyama Journal'),
        tr(SITE.tagline),
        '',
        `/mix mdma tramadol — ${tr('What are the risks of taking these together?')}`,
        `/dose ketamine — ${tr('A common dose, and how long it lasts')}`,
        `/emergency — ${tr('When to call, the number, and what to do until help comes')}`,
        '',
        tr('Information, not medical advice.'),
        SITE.origin,
    ].join('\n');
}

function emergency(): string {
    return [
        b(tr('In an emergency')),
        tr('Call an ambulance now if someone:'),
        `• ${tr('can’t be woken')}`,
        `• ${tr('is struggling to breathe, breathing very slowly, or not breathing')}`,
        `• ${tr('has blue or grey lips or fingertips')}`,
        `• ${tr('is having a seizure')}`,
        '',
        link('/emergency', tr('What to do until help comes')),
    ].join('\n');
}

function substanceText(e: IndexEntry): string {
    const lines = [b(nameOf(e)), esc(e.says ?? describe(e))];
    if (e.primaryBand) lines.push(esc(tr('A common dose: {0}–{1} {2}, {3}', { 0: e.primaryBand.low, 1: e.primaryBand.high, 2: e.primaryBand.unit, 3: roaName(e.primaryBand.roa).toLowerCase() })));
    else if (e.src === 'wd') lines.push(esc(tr('No doses are given for it here.')));
    if (e.primaryDuration?.total) lines.push(esc(tr('Lasts {0} in all', { 0: spanText(e.primaryDuration.total) })));
    lines.push(link(`/s/${encodeURIComponent(e.id)}`, tr('Doses by route, timing, and what not to mix it with')));
    return lines.join('\n');
}

function mixText(chosen: IndexEntry[], pairs: PairResult[]): string {
    const top = pairs[0];
    const v = VERDICT[top.verdict];
    const lines = [b(`${phraseList(chosen.map(e => nameOf(e)))}: ${tr(v.label)}`), esc(tr(v.meaning))];
    for (const p of pairs) {
        if (pairs.length > 1) lines.push('', `${esc(nameOf(p.a))} + ${esc(nameOf(p.b))}: ${b(tr(VERDICT[p.verdict].label))}`);
        if (p.note && p.note.length < 400) lines.push(esc(p.note));
    }
    lines.push('', link(`/mix/${chosen.map(e => encodeURIComponent(e.id)).join('+')}`, tr('Where this comes from, and the rest')), esc(tr('Information, not medical advice.')));
    return lines.join('\n');
}

/** A question read into something to answer: a mix, one substance, or the names that weren't found. */
async function answer(tools: TelegramTools, index: IndexEntry[], names: string[], lang: Lang, mix: boolean): Promise<{ text: string; title: string; says: string } | null> {
    if (!names.length) return null;
    const found = names.map(n => ({ n, e: find(index, n) }));
    const missing = found.filter(f => !f.e).map(f => f.n);
    const chosen = [...new Map(found.filter(f => f.e).map(f => [f.e!.id, f.e!])).values()].slice(0, 6);

    if ((mix || chosen.length > 1) && chosen.length >= 2 && !missing.length) {
        const [matrix, ...details] = await Promise.all([
            tools.load<ComboMatrix>('/data/combos.json'),
            ...chosen.map(e => tools.load<Detail>(`/data/substances/${encodeURIComponent(e.id)}.json`)),
        ]);
        const pairs: PairResult[] = [];
        for (let i = 0; i < chosen.length; i++)
            for (let j = i + 1; j < chosen.length; j++) pairs.push(checkPair(chosen[i], chosen[j], details[i] as Detail | undefined, details[j] as Detail | undefined, matrix as ComboMatrix | undefined));
        pairs.sort((x, y) => RANK[y.verdict] - RANK[x.verdict]);
        tools.speak(lang);
        return { text: mixText(chosen, pairs), title: `${phraseList(chosen.map(e => nameOf(e)))}: ${tr(VERDICT[pairs[0].verdict].label)}`, says: tr(VERDICT[pairs[0].verdict].meaning) };
    }
    tools.speak(lang);
    if (missing.length) {
        const text = tr('Nothing called “{0}”.', { 0: missing.join(', ') });
        return { text: esc(text), title: text, says: '' };
    }
    if (mix) {
        const text = tr('Add one more to see how they mix.');
        return { text: esc(text), title: text, says: '' };
    }
    const e = chosen[0];
    return { text: substanceText(e), title: nameOf(e), says: e.says ?? describe(e) };
}

/* ── an update, answered ────────────────────────────────────────────── */

const reply = (body: object) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const nothing = () => new Response(null, { status: 200 });

export async function handleTelegram(request: Request, env: TelegramEnv, tools: TelegramTools): Promise<Response> {
    const secret = env.TELEGRAM_SECRET;
    if (!secret || request.method !== 'POST') return new Response('Not found', { status: 404 });
    if (!same(request.headers.get('x-telegram-bot-api-secret-token') ?? '', secret)) return new Response('Forbidden', { status: 403 });
    let update: Update;
    try {
        update = (await request.json()) as Update;
    } catch {
        return nothing();
    }
    const index = (await tools.load<IndexEntry[]>('/data/index.json')) ?? [];

    // Typed after the bot's name in any chat.
    if (update.inline_query) {
        const q = update.inline_query.query.trim();
        const lang = langOf(update.inline_query.from);
        const names = namesIn(q);
        const results: object[] = [];
        const article = (id: string, a: { text: string; title: string; says: string }) => ({
            type: 'article',
            id,
            title: a.title,
            description: a.says,
            input_message_content: { message_text: a.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
        });
        if (names.length > 1) {
            const a = await answer(tools, index, names, lang, true);
            if (a) results.push(article('mix', a));
        } else if (q) {
            tools.speak(lang);
            for (const h of search(index, q, 8)) results.push(article(h.entry.id.slice(0, 60), { text: substanceText(h.entry), title: nameOf(h.entry), says: h.entry.says ?? describe(h.entry) }));
        }
        return reply({ method: 'answerInlineQuery', inline_query_id: update.inline_query.id, results, cache_time: 300 });
    }

    const m = update.message;
    const text = m?.text?.trim();
    if (!m || !text) return nothing();
    const lang = langOf(m.from);
    const send = (body: string) =>
        reply({ method: 'sendMessage', chat_id: m.chat.id, text: body, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } });

    const cmd = text.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
    if (cmd) {
        const name = cmd[1].toLowerCase();
        const rest = (cmd[2] ?? '').trim();
        if (name === 'start' || name === 'help') {
            tools.speak(lang);
            return send(help());
        }
        if (name === 'emergency') {
            tools.speak(lang);
            return send(emergency());
        }
        if (name === 'mix' || name === 'dose' || name === 's') {
            const a = await answer(tools, index, name === 'mix' ? namesIn(rest) : rest ? [rest] : [], lang, name === 'mix');
            if (a) return send(a.text);
            tools.speak(lang);
            return send(help());
        }
        return nothing();
    }
    // Plain words are answered only in a chat with the bot alone: in a
    // group it speaks when spoken to, by a command.
    if (m.chat.type !== 'private') return nothing();
    const names = namesIn(text);
    const whole = find(index, text);
    const a = await answer(tools, index, whole ? [text] : names, lang, false);
    return a ? send(a.text) : nothing();
}
