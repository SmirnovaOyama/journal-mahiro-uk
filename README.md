# Oyama Journal

A harm-reduction reference and dose journal for psychoactive substances, at
[journal.mahiro.uk](https://journal.mahiro.uk). It is built on the shell and
design system of [Oyama's HRT Tracker](https://github.com/xunxunProjects/Oyama-s-HRT-Tracker)
(hrt.mahiro.uk), in English, 正體中文 and 简体中文 (the catalogue itself is in
English). No account needed: what you do on it stays on
your device, and once opened it works without a connection. An account is optional, and keeps your journal the same on every
device you sign in on, encrypted on each before it's sent.

The same site answers on journal.mahiro.uk, n55.mahiro.uk, od.mahiro.uk and
trip.mahiro.uk.

## What it does

**Look things up.** 3,041 substances, each with its skeletal formula drawn from
PubChem's own 2D layout, and under its name its chemical formula and molar
mass (2,949: a plant or a family of drugs has none of its own).

- 702 come from PsychonautWiki and TripSit, with doses by route on a rail from
  light to heavy, how long it lasts drawn on a clock, tolerance, effects, and
  what it mustn't be mixed with.
- How much of a dose gets into the blood, by route, where it's known (110
  routes), so the same amount isn't mistaken for the same dose another way.
- Where a dose is too small for a milligram scale, which is accurate to a
  few milligrams (a common dose under 10 mg, swallowed, held in the mouth,
  snorted or taken rectally: 182 substances, 65 of them under 1 mg), the
  page says so and works it out in a liquid: how strong a liquid is from
  what was weighed and how much liquid it went into, how much of it each
  band of the rail is, and how it's made, in plain words from
  PsychonautWiki's page on volumetric dosing (`src/lib/volumetric.ts`).
- How it works, what it's used for and its side effects, each in a few
  sentences from its Wikipedia article (2,416, 2,200 and 560 substances).
  Beside the words, rows of facts: what kind of drug it is (1,022); what it
  binds to and what it does there, from the Guide to Pharmacology (214); what
  the body does with it, from how soon it works to its half-life, what breaks
  it down, what it turns into and how it leaves (787); what it's sold as
  (514) and how it's taken (1,234).
- 2,339 are reference entries from Wikidata and Wikipedia: what the substance
  is, how it works, what it's used for, its names, its structure and its
  known interactions. They have no dose, but for 16 that FreeODwiki gives
  doses and timings for (olanzapine, clozapine, amantadine, loperamide and
  others): those are shown with a line saying where they're from, and with
  the warnings FreeODwiki sets beside them.
- Search by name, street name or family, or browse by kind. Each kind lists
  the documented substances first, with the rest a tap away.

**Check a mix.** Put two or more substances together, alcohol and medicines
included, and get one answer: the most serious risk first, with the reason.
The medicines you take every day (Settings, About you) are counted in
without being asked: one substance and a daily antidepressant is already a
pair, and a substance's own page says what it does with them.

**Know what to do when it goes wrong.** One page, at `/emergency`: when to
call an ambulance, the number to call by place (the one where the device's
clock is set comes first), what to do until help comes, the recovery
position step by step, what not to do, the signs by kind of drug, and what
to do when someone may harm themselves, with crisis lines to call. Each
line puts into plain words what FRANK, the WHO, St John Ambulance, the NHS,
988 Lifeline, Samaritans or PsychonautWiki says, and they are listed at its
foot. It is one tap from
a running session, a mix's answer, Search and Settings, and a search for
"overdose" or 急救 finds it. Its tools say no advice of their own: what the
journal holds of the last 24 hours, the daily medicines and the body
weight, set out for the crew and shown large; a beat at 110 a minute to
press a chest to; the steps read aloud; and the device's position, read on
the device and sent nowhere, to say on the call.

**Keep a journal.** Log what you take, how, how much and when.

- Doses taken within 12 hours of each other form a session, drawn on one
  timeline. The session still going sits on top, with anything in it that
  doesn't mix.
- The form warns before a redose while the last one is still working, and
  before anything that mixes badly with what you logged in the last day,
  with a medicine you take every day, or with what you logged days ago and
  is still at work: five half-lives by the half-life its page gives, or the
  wait a drug's own label gives where that is longer (five weeks for
  fluoxetine, two for the MAOIs that bind for good).
- It shows what you wrote the last night you took the same thing, before
  you take it again.
- Limits, set while sober on a substance's page in the journal: the most in
  one night, and the days between nights. The form says them back when a
  dose would cross one.
- A product with several ingredients (a cold medicine) is written down once
  from its box and logged as so much of each. Nothing comes filled in: what
  is in a box differs by country. Paracetamol is added up over 24 hours
  against the NHS's 4 g, wherever it came from.
- A liquid a dose was dissolved in is kept the same way, from the
  substance's page, with the way it's taken. The dose form offers it for
  that substance, and so many mL are logged as so much of the substance.
- A drug that can't safely be stopped at once (a gabapentinoid, a
  benzodiazepine, an opioid, a Z-drug), logged seven days in a row, gets one
  note, in the NHS's words for its kind.
- Now (`/now`): the night that's going on, on one screen, in large type,
  with the screen kept on. "I don't feel right" asks first whether it's an
  emergency, then says what FRANK says for panic, with a slow breath to
  follow.
- A dose has an address, `/log/caffeine/100mg/oral`, that opens the form
  filled in and logs nothing until it's sent: for a bookmark, a phone's
  Shortcuts, or an NFC sticker on the box.
- Each session can have a name, notes, a Shulgin rating (− to ++++), and a
  star.
- Stats show sessions month by month, the most used substances, and each
  substance's own history: when you last took it, how much in all and on
  average, and every dose.
- Export the journal as a file, or import one, including PsychonautWiki
  Journal's export.

**Have someone watch over a night.** From Now, a link for someone you
trust. They see what you log that night, where each thing is on its course,
how long since your device last spoke, and whether you answered your
check-in or missed it. Neither of you needs an account. See
[Watching over a night](#watching-over-a-night).

**Lock it.** A code on the journal, an other code that opens an empty one,
a plain name and icon, and erasing the device at once. See
[Lock and privacy](#lock-and-privacy).

**Ask it from Telegram.** `/mix mdma tramadol`, `/dose ketamine`, or the
bot's name and a question in any chat. See [Telegram](#telegram).

**Turn any of it off.** Settings, Features has a switch for each of these:
the notes from last time, limits, the daily medicines, drugs still at work,
products, paracetamol's total, the Now screen, days in a row, a dose's
address, watching over a night, the card for the crew, the emergency
page's beat, reading aloud and position, measuring in a liquid, a night's picture,
and the link to report a mistake.
All are on to begin with. Off, a feature is hidden and does nothing, and
what it kept stays for when it's turned back on (`src/lib/features.ts`).
The lock, the other code and the plain name have their own switches under
Lock and privacy. The warnings about a redose too soon and about what
doesn't mix are always on, and the Telegram bot is the site's, on for
everyone once its secret is set.

**Sync it, if you want.** Make an account with a username and a password, and
the journal and the saved list are kept the same on each device signed in to
it. They're encrypted in the browser before they're sent, so the server keeps
a copy it can't read. Two-step sign-in, with an authenticator app and backup
codes, is there to turn on. See [Accounts](#accounts).

**Use it without a connection.** After the first visit the site opens with
no signal: search, the mix checker, the journal and the emergency page, and
every substance that was opened, saved or logged, whether or not it was
opened on this device. A substance that isn't kept says so. A mix read
without one of its substances' pages still shows a warning it finds, and
says "Not checked" rather than call anything milder safe. See
[Offline](#offline).

**Body weight.** Set once in Settings (kg or lb, 20 to 400 kg), as hrt.mahiro.uk
keeps it, or log each weighing under the journal's Weight tab, which keeps
the history (synced and exported with the journal) and sets the newest one. With it, a dose given per kilogram (ibogaine's) reads as an amount,
an amount reads per kilogram on the dose rail and in the journal, and a
session with alcohol in it shows blood alcohol, roughly: how high it went,
where it is now, and about when it's back to none (Widmark's formula, as a
range, since it doesn't know your sex). It syncs with an account, encrypted.

**Read any chart by touch.** Press and slide along a timeline or a duration
curve to read any moment. Tap a bar to read its month.

**Share a link.** Every page has its own title, description and preview card
for chat apps and search engines. A chat app fetching a link seldom says what
its reader speaks, and is answered in English; `?lang=` on the address says
it instead: `/s/ketamine?lang=zh-Hans`, `zh-Hant`, `zh-HK` or `en`, or `cn`,
`tw`, `hk` for short. The page itself still opens in its reader's own
language.

**Keep a night as a picture.** On a night in the journal, Save as a
picture is one tap: on a phone the share sheet opens with it (to keep it
in Photos or send it), elsewhere it's saved as a file. It is 1080 by 1440,
drawn on the device, in the reader's language (`src/lib/picture.ts`), in
the design system's tokens at twice their size. The night is drawn one of
two ways, chosen in Settings, Features:

- **Timeline**, the default. The session chart just as the app draws it,
  in the light theme and as flat as on a phone, under the date as a
  reading: each dose's curve in its colour over a faint fill, a hollow ring
  where it was taken, the clock times under, "now" a dotted upright.
- **Clock.** In the dark theme, a dial that runs through the night alone,
  from its start at the top round to its end. Each dose has its own ring,
  the first innermost, and along it from the time it was taken a ribbon in
  its substance's colour as wide as the effect is strong. Each dose's name,
  time and amount stand in one of two columns beside the dial, a hairline
  from where it was taken. The date is in the middle.

Both are the session chart's curve (`src/lib/curve.ts`). Under the night,
each substance is drawn as its structure in the brand's terracotta, its
name in its curve's colour and what it came to; then what didn't mix, each
status in words; the rating; and at the foot the logo and the site.
Never the notes. The night isn't uploaded to draw it: the picture is drawn
quietly while the page is open, so the tap can hand it over at once.

## Pages

| Path | Page |
| --- | --- |
| `/` | Search, and the kinds to browse |
| `/s/lsd` | A substance |
| `/kind/Stimulant` | One kind, A to Z |
| `/mix/mdma+tramadol` | The mix checker |
| `/journal` | The journal; `/journal/stats` for its stats, `/journal/weight` for body weight |
| `/journal/<session>` | One session |
| `/journal/substance/<id>` | One substance's history in the journal |
| `/saved`, `/settings` | Saved substances; settings |
| `/emergency` | What to do in an emergency, until help comes |
| `/now` | The night that's going on, on one screen |
| `/watch/<id>#<key>` | A night someone shared, for the person watching over it |
| `/log/<substance>/<amount>/<route>` | The dose form, filled in from the address |
| `/settings/medicines` | The medicines taken every day |
| `/settings/privacy` | The lock, the other code, a plain name and icon, erasing the device |
| `/settings/features` | A switch for each feature |
| `/settings/account` | The account: sign in or make one; on a phone, its parts as tiles (`/settings/sync`, `/settings/security`, `/settings/devices`), on a wide window as tabs |
| `/settings/two-factor` | Two-step sign-in |
| `/settings/weight` | Body weight |
| `/settings/credits` | Credits: who made it, what it's built on, where the data is from |
| `/settings/admin` | The admin's page: `/settings/admin-overview`, `/settings/admin-accounts` |

## Data

| Source | What it gives | Licence |
| --- | --- | --- |
| [PsychonautWiki](https://psychonautwiki.org) | Doses, durations, effects, tolerance, interactions, and how a substance works where Wikipedia doesn't say | CC BY-SA 4.0 |
| [TripSit](https://tripsit.me) | Combinations, factsheets | See [TripSit/drugs](https://github.com/TripSit/drugs) |
| [FreeODwiki](https://freeodwiki.org) | Doses and timings for substances the two above give none for | CC BY-SA 4.0 |
| [Wikidata](https://www.wikidata.org) | Kinds, interactions, and the substances the two above don't cover | CC0 |
| [Wikipedia](https://www.wikipedia.org) | Summaries; how each works, what it's used for and its side effects; the drug infobox's figures. Linked from each page | CC BY-SA 4.0 |
| [IUPHAR/BPS Guide to Pharmacology](https://www.guidetopharmacology.org) | What a drug binds to, and what it does there | CC BY-SA 4.0 |
| [PubChem](https://pubchem.ncbi.nlm.nih.gov) | 2D structures, chemical formulas and molar masses | Public domain (NCBI) |

A substance's Wikidata item is matched by structure, then checked by name:
an isomer, a salt or a labelled copy of it (esketamine for ketamine, 4-D for
mescaline) isn't linked, and no link is better than a wrong one. Absorption
figures from Wikipedia are only taken from the substance's own article, with
the route named, and never from animal studies.

How a substance works, what it's used for and its side effects are quoted,
not written (`scripts/pharmacology.mjs`): the opening sentences of its
article's sections on them, or, where the article is too short to have
them, the sentences of its opening lines that say so. A sentence is quoted
whole or not at all. The quote stops at one that can't be read as plain
words (a formula, a table, a template the script doesn't know), and at one
that gives a dose. The rows beside the words are the article's infobox,
field by field, read the same way. Each names its article and links to the
place. 202 substances say nothing of how they work or what they're for,
because no source does: no line is better than a made-up one.

What a drug binds to is the Guide to Pharmacology's record, and only for
the drugs whose primary target the Guide marks. Its other rows can be stray
findings (lorazepam's only row there is an orphan receptor), and Wikidata's
copy of them gets the kind of action wrong (olanzapine an agonist of the
receptors it blocks), so neither is used.

FreeODwiki's doses (`scripts/freeodwiki.mjs`) are taken only for a substance
with none of its own, only as figures (a route's ladder and its timings),
and only from its pages laid out as PsychonautWiki's are, most of which are
PsychonautWiki's drafts in translation. Its "OverdoseWiki" archive isn't
read for doses: by its own account those ladders are partly guesses, and for
several medicines it declines to give any. A page is a substance's only by
the name it gives itself, in English or (through Wikidata) in Chinese.

A reference entry comes from Wikidata's classes of psychoactive drugs, from
nervous-system ATC codes, or from Wikipedia's lists of drugs (PiHKAL, TiHKAL,
the investigational drug lists and others). A compound that is only mentioned
somewhere must still read as a drug: by its description, its kind, the family
its name belongs to (…PINACA, NBOMe, …azolam), or what it does (μ-opioid,
NMDA, GABA-A). Plain chemicals stay out. The sorting into kinds is automatic,
so the odd entry may be filed wrongly.

## Accounts

An account is a username and a password, laid out as hrt.mahiro.uk's are.
The server never sees the password, the journal, or the saved list.

- **Keys.** The browser stretches the password (PBKDF2-SHA256, 600,000
  rounds, salted with the lowercased username) and splits the result with
  HKDF into a sign-in key and a key-wrapping key. Only the sign-in key is
  sent; the server stores SHA-256 of it with a random salt. The account's
  journal key is random, made in the browser when the account is, and stored
  on the server wrapped twice (AES-GCM): by the password's key, and by a
  recovery key.
- **Recovery key.** 160 random bits, shown once at sign-up as 32 letters and
  digits. It sets a new password if the old one is forgotten, and is then
  replaced. Without the password or the recovery key, nobody can open the
  journal, the server included.
- **Sync.** The account keeps one copy, gzipped then encrypted with the
  journal key, with a version number. A device fetches the copy if it has
  changed, merges it with its own, and writes the result back as made from
  that version; if another device wrote first, the write is turned away, and
  it merges again. Every dose and every session's notes carry when they last
  changed, and a deleted dose leaves its id behind, so a merge keeps the
  newest of each and never brings a deleted one back. Syncing happens on its
  own: after a change, when the page comes back into view, and every two
  minutes while it's open.
- **On a device.** The journal key is kept in IndexedDB as a key that can be
  used but not read out. The session is a random token; the server keeps
  only its SHA-256. Signing out asks whether to keep the journal on the
  device.
- **Two-step sign-in.** A six-digit code from an authenticator app (TOTP,
  RFC 6238) after the password, or one of ten single-use backup codes. A code
  works once. Setting a new password with the recovery key asks for one too,
  and goes in two steps: the first proves the key and the code and gets a
  ticket good for ten minutes; only that ticket lets the second set the
  password.
- **Limits.** Ten sign-in tries a minute per address and per account name,
  and five wrong passwords in a row lock the name for 15 minutes, doubling
  up to an hour. A device stays signed in for 60 days after it was last
  used. A new password signs every other device out.

What syncs: the journal with its body weights, the saved list, the body
weight set in Settings, and what the journal knows of the person besides
doses (`src/lib/person.ts`): the medicines taken every day, the limits, and
the products written down from their boxes. Each merges to whichever
device changed it last.

The server side is `worker/api.ts`, with its tables in `migrations/`, on
Cloudflare D1.

## Watching over a night

"Don't use alone", for someone who is alone (`src/lib/watch.ts`).

- The sharing device makes a random key and encrypts what it shares with it
  (AES-GCM): the night's doses, the daily medicines, the body weight, and
  when a check-in was last answered.
- The server keeps that sealed copy for 12 hours (`/api/watch`, the
  `watches` table), with the hash of a token only the sharing device has,
  which is what lets it replace or end the copy. No account is asked of
  either side, and none is recorded.
- The link is `/watch/<id>#<key>`. The key is after the `#`, which a browser
  never sends to a server: whoever has the link can read the night, and the
  server can't.
- The copy is sent again when the journal changes, when a check-in is
  answered, and every two minutes while the site is open on the sharing
  device. A closed page sends nothing, so the watcher's page also says how
  long it has been since that device last spoke, and treats silence as
  something to act on.
- A check-in, if asked for, is one large button on Now. Missed, the
  watcher's page says so, sounds a tone, and (if allowed) raises a
  notification, for as long as that page stays open.

## Lock and privacy

For a phone other people see, or may be made to show (Settings, About you,
Lock and privacy; `src/lib/kv.ts`).

- **A lock.** The journal, the saved list, the medicines and limits, and the
  account's sign-in are kept together in a box encrypted with a random key
  (AES-GCM), which is stored wrapped by the key a code makes
  (PBKDF2-SHA256, 600,000 rounds). With it on, none of the app is loaded
  until the code is typed: `src/main.tsx` asks for it on a screen that names
  nothing, then loads the rest (`src/boot.tsx`). It can ask again after so
  long out of sight. There is no way to reset the code.
- **An other code** opens a second, empty journal, for someone made to open
  the site. From inside it the lock can't be changed or turned off, and it
  doesn't say there is another. It deceives a look, not an examination: the
  two boxes sit side by side in storage, and one is larger.
- **A plain name and icon.** The tab, the browser's history and an app added
  to the Home Screen are called what the reader chose, under a grey page
  (`src/lib/quiet.ts`; the icons are drawn by `scripts/plain-icons.mjs`).
- **Erase this device**: everything the site keeps on it, at once, from
  Settings or from the lock screen. Nothing is said to an account, so its
  copy stays.

What isn't locked: the theme and the language, which the page needs before
the code is typed, and what the service worker keeps for offline, which
names the substances that were opened.

## Telegram

The same catalogue and the same mix checker, asked from a chat
(`worker/telegram.ts`): `/mix mdma tramadol`, `/dose ketamine`,
`/emergency`, plain words in a chat with the bot alone, or its name and a
question in any chat (inline mode). It answers in English, 正體中文 or
简体中文 by the language Telegram says the asker uses, and every answer
links to its page. Nothing is kept or logged.

Telegram posts each message to `/api/telegram`, and the answer goes back as
the reply to that request, so the Worker never calls Telegram and holds no
bot token: only a secret that Telegram sends with each update. To set it up:

```bash
# 1. Make a bot with @BotFather, and turn inline mode on (/setinline).
# 2. Give the Worker a secret of your own: any long random string.
npx wrangler secret put TELEGRAM_SECRET
# 3. Point the bot at the site, once.
TELEGRAM_BOT_TOKEN=… TELEGRAM_SECRET=… node scripts/telegram-webhook.mjs
```

Without `TELEGRAM_SECRET` the address answers 404.

### Admin

One account is the admin's, by its username. The admin page (Settings,
Account, Admin) shows what the server knows: accounts, when each was last
seen, devices, the size of each encrypted copy, two-step sign-in, sign-ups a
day, locks, and how many accounts were deleted and by whom. From it the
admin can sign an account out everywhere, lift a lock, turn off two-step
sign-in for someone who lost their phone and backup codes, or delete an
account; the last two ask for the admin's password again. It can't read any
journal, the admin's included, or reset anyone's password. The admin page opens only once the
admin's account has two-step sign-in on; a new admin account goes straight
from its recovery key to setting it up.

The admin's name can't be taken by anyone else: it can only be made with
the admin's password, which the server never has. It keeps two secrets, the
username and the SHA-256 of the sign-in key that password makes:

```bash
node scripts/admin-key.mjs <username>      # asks for the password, prints the hash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_KEY_HASH
```

Then make the account on the site with that username and password, as any
other. For `wrangler dev`, the same two go in `.dev.vars`.

## Running it

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | The site at localhost:5173 |
| `npx wrangler dev` | The Worker with the account API and a local database, at localhost:8787; `npm run dev` sends `/api/` to it |
| `npx wrangler d1 migrations apply oyama-journal --local` | Make the account tables in the local database (`--remote` for the real one) |
| `node scripts/admin-key.mjs <username>` | The admin's key hash, from its password (see [Admin](#admin)) |
| `npm run build` | Type-check and build into `dist/`, drawing the link preview cards first if there are none |
| `npm test` | The tests in `tests/`: the mix checker against the catalogue, the journal's merging, what the journal says back, the lock, the Telegram bot, measuring in a liquid |
| `node scripts/data-diff.mjs` | Every dose, timing and combination a data sync changed, against the last commit |
| `node scripts/plain-icons.mjs` | Draw the plain icon into `public/` |
| `node scripts/telegram-webhook.mjs` | Point a Telegram bot at the site (see [Telegram](#telegram)) |
| `npm run data` | Every data step in turn: PsychonautWiki and TripSit, then Wikidata and Wikipedia, PubChem structures, absorption by route, and the dose check |
| `node scripts/absorption.mjs` | How much of a dose gets in, by route: PsychonautWiki's figures, and Wikipedia's drug infoboxes where the route is named |
| `node scripts/check-doses.mjs` | Checks every route's doses rise in order on their rail, mends rows whose ranges change unit, and fails on any left |
| `node scripts/sync-wikidata.mjs --write` | Rebuild the reference entries from the cache in `scripts/.cache/`, without fetching |
| `npm run og` | Draw the link preview cards into `public/og/`, one per substance, and list any whose name doesn't fit its card (`-- --out=<folder>` draws them elsewhere to look at first). About half a minute |
| `npm run sitemap` | Write `public/sitemap.xml` |
| `npm run deploy` | Cards, sitemap, build, and deploy to Cloudflare, by hand: a push to main does all of it (see [Who deploys](#who-deploys)) |
| `python3 scripts/icons.py` | Cut the favicon and app icons from `design/logo.jpg` |

The cards need nothing of the machine: each is an SVG (`scripts/og/card.mjs`)
that resvg draws in the fonts kept in `scripts/og/fonts/` (Inter and Source
Han Sans, both under the SIL Open Font License, their licences beside them),
its lines measured from those same fonts (`scripts/og/type.mjs`). No browser
and no system font, so they come out the same on any machine. A picture a
card holds has to be a PNG, JPEG or GIF: one kept as WebP needs a PNG of the
same name in `scripts/og/pictures/`, and the script stops if there is none.
The plain icon is drawn in Chromium through playwright-core
(`npx playwright install chromium`). The icons need Pillow. Deploying needs
`wrangler login` to the Cloudflare account that owns the Worker.

## How it's deployed

A Cloudflare Worker with static assets (`wrangler.jsonc`). The built files are
served as they are. For pages, the Worker (`worker/index.ts`) runs first and
writes each page's title, description and card into the HTML, so a link
shared to a chat app shows what that page is. Unknown pages answer 404, and
journal pages are kept out of search engines.

Accounts are under `/api/` on the same Worker (`worker/api.ts`), with a D1
database (`oyama-journal`) and two Workers rate limiters. A change to the
tables is a new file in `migrations/`, applied with
`npx wrangler d1 migrations apply oyama-journal --remote` before deploying.
Shared nights are in the same database (`migrations/0004_watch.sql`).

### Who deploys

A push to main is built and deployed by Cloudflare (Workers Builds), and
what it deploys is whole. The link preview cards and a sitemap dated today
aren't in the repository; the build makes them itself (`vite.config.ts`
runs `scripts/og/render.mjs` and `scripts/sitemap.mjs` before the files are
gathered), which it can because the cards are drawn from fonts kept in the
repository rather than a machine's own.

That build takes about three minutes, two of them drawing the cards. Until
it has finished the site is as it was, cards and all; if it fails, nothing
is deployed. No machine of ours follows a push: for a while a Mac that was
left on did, because the cards were drawn in its own fonts and Cloudflare's
build went without them.

Tables are still changed by hand, before the push that needs them.

Cloudflare also builds every other branch, as a preview
(`npx wrangler preview`). A preview has none of production's bindings
(`previews` in `wrangler.jsonc` is empty on purpose): the site works in
one, accounts and shared nights don't, and it can't reach a real account.

### Tests, and the data kept fresh

`npm test` bundles each `tests/*.test.ts` with the esbuild Vite brings and
runs it with Node's test runner, against the catalogue as it is in the
repository. The mix checker's tests are floors: pairs whose danger no source
disputes, which the checker may call worse but never milder.

Once a week a workflow (`.github/workflows/data.yml`) runs `npm run data`
and the tests and, if anything differs, opens a pull request that lists
every dose, timing and combination that changed. Nothing reaches the site
until that list has been read and merged. It needs "Allow GitHub Actions to
create and approve pull requests" under the repository's Actions settings.

Each substance's page ends with a link that opens a GitHub issue about it,
for the reader who notices something wrong.

## Offline

A service worker (`public/sw.js`), registered on the built site only
(`src/lib/offline.ts`). With a connection nothing changes: every request is
answered by the network, and what's kept is only what the network last said.
A kept copy answers when the network doesn't, or takes more than four
seconds to. The build's own scripts and stylesheets are the exception: their
names change when they do, so a kept one is served straight away.

It keeps the page, every file the build made (Vite lists them in
`build.json`, so the languages' words are kept too), the search index and
the mix table, each substance as it's opened, and pictures as they're shown.
`src/lib/offline.ts` adds the substances that were saved, logged or looked
at lately, one file at a time once the page is idle. Accounts (`/api/`) are
never kept. A new deploy is picked up on the next visit with a connection,
and the files of the build before it are let go.

## Code

- `src/App.tsx`: the shell, with the sidebar on a wide window and the tab bar
  on a phone.
- `src/main.tsx` asks for the lock's code when there is one, then loads
  `src/boot.tsx`, which starts the app.
- `src/pages/`: Search, Substance, Kind, Mix, Journal, Saved, Settings, the
  emergency page (Emergency), the night on one screen (Now), a night someone
  shared (Watch), the daily medicines (Medicines), the lock (Privacy), the
  account (Account), the admin's page (Admin), and the intro (Onboarding).
- `src/components/`, among them:
  - `Odometer`: the rolling number.
  - `LevelRail` and `DoseRuler`: the dose rail.
  - `Molecule`: the drawings, loaded per first letter from `public/data/structures/`.
  - `Timeline` and `SessionChart`: the duration curve and the session timeline.
  - `IngestionForm`: logging a dose; `ProductForm`: logging a product with
    several ingredients.
  - `JournalNotes`: last time, paracetamol's total, days in a row, limits.
  - `EmergencyTools`: the card for the crew, the beat, reading aloud, the
    position.
  - `ShareNight`: sharing a night, and answering its check-ins.
  - `DoseLink`: a dose's own address.
  - `scrub.ts`: reading the charts by touch.
  - `StackedBars`: the column charts, read by touch too.
  - `ProfileHeader`: the top of the account page.
  - `Absorption`: how much gets in, by route.
  - `Volumetric`: measuring a dose too small to weigh in a liquid.
  - `PictureExport`: a night's Save as a picture button.
- `src/lib/`:
  - `data.ts`, `mix.ts`: the data and the mix checker.
  - `journal.ts`: the journal's store, sessions, import, export and merging.
  - `person.ts`: the medicines taken every day, the limits, the products.
  - `advice.ts`: what the journal says back: how long a drug stays, the
    last night's notes, a night's total, paracetamol over 24 hours, days in
    a row.
  - `kv.ts`: where all of that is kept on the device, and the lock on it;
    `lockscreen.ts`: the screen that asks for the code; `quiet.ts`: the
    plain name and icon.
  - `watch.ts`: a night shared with someone, sealed on the device.
  - `features.ts`: which features are on, by the switches in Settings.
  - `account.ts`: signing in and out, two-step sign-in, and syncing.
  - `eggs.ts`: a few things for whoever looks up estradiol.
  - `alcohol.ts`: blood alcohol, roughly, from the body weight.
  - `volumetric.ts`: which doses are too small to weigh, and a liquid's
    strength.
  - `picture.ts`: a night drawn as a picture on a canvas, loaded only when
    one is first drawn; `curve.ts`: the shape of a night, for the chart and
    the picture alike.
  - `keys.ts`: the keys, and encrypting the journal.
  - `password.ts`: how guessable a new password is.
  - `molsvg.ts`: skeletal formulas from 2D coordinates.
  - `preview.ts`: link previews.
  - `routes.ts`, `router.ts`: the pages.
  - `offline.ts`: starts the service worker, and keeps the reader's own
    substances for when there's no connection.
  - `care.ts`: the searches that are answered with a check-in, or with the
    way to the emergency page.
- `worker/`: the Worker; `api.ts` is the accounts and shared nights,
  `telegram.ts` the Telegram bot.
- `tests/`: the tests, and `setup.ts`, the little of a browser they need.
- `migrations/`: the account tables.
- `scripts/`: the data sync, structures, cards, sitemap, icons, and the
  admin's key hash.

## Not medical advice

Doses are typical ranges. Your body, your tolerance, the medicines you take
and what is really in a pill or powder can all change them. Start low, test
what you have, and don't use alone. If someone is unresponsive or breathing
slowly, call emergency services; the site's [emergency page](https://journal.mahiro.uk/emergency)
says what to do until they come.
