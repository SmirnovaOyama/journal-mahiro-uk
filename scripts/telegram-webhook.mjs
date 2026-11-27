// Points a Telegram bot at the site, once, after the bot is made with
// @BotFather and the Worker has its secret:
//
//   npx wrangler secret put TELEGRAM_SECRET        any long random string
//   TELEGRAM_BOT_TOKEN=… TELEGRAM_SECRET=… node scripts/telegram-webhook.mjs
//
// It tells Telegram where to post updates (https://journal.mahiro.uk/api/telegram,
// or the address given as the first argument), the secret to send with each,
// and the bot's commands in each language. The token is used here and
// nowhere else: the Worker answers inside the request Telegram makes, so it
// never needs it (worker/telegram.ts). For inline answers, turn inline mode
// on for the bot with @BotFather (/setinline).

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_SECRET;
const url = process.argv[2] ?? 'https://journal.mahiro.uk/api/telegram';
if (!token || !secret) {
    console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_SECRET in the environment.');
    process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    console.error('TELEGRAM_SECRET may hold only letters, digits, _ and -, up to 256 of them.');
    process.exit(1);
}

async function call(method, body) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json();
    if (!out.ok) throw new Error(`${method}: ${out.description}`);
    return out.result;
}

const COMMANDS = {
    en: [
        ['mix', 'What are the risks of taking these together?'],
        ['dose', 'A common dose, and how long it lasts'],
        ['emergency', 'When to call, and what to do until help comes'],
    ],
    zh: [
        ['mix', '這些一起用有什麼風險？'],
        ['dose', '常見劑量，以及持續多久'],
        ['emergency', '何時該叫救護車，以及等待時該做什麼'],
    ],
};

await call('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'inline_query'], drop_pending_updates: true });
for (const [lang, list] of Object.entries(COMMANDS))
    await call('setMyCommands', { commands: list.map(([command, description]) => ({ command, description })), ...(lang === 'en' ? {} : { language_code: lang }) });
const me = await call('getMe', {});
console.log(`@${me.username} now answers from ${url}.`);
