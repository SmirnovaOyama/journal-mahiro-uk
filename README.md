# Oyama Journal

A harm-reduction reference and dose journal for psychoactive substances, at
[journal.mahiro.uk](https://journal.mahiro.uk). It is built on the shell and
design system of [Oyama's HRT Tracker](https://github.com/xunxunProjects/Oyama-s-HRT-Tracker)
(hrt.mahiro.uk), in English and 正體中文 (the catalogue itself is in
English). No account needed: what you do on it stays on
your device. An account is optional, and keeps your journal the same on every
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

**Keep a journal.** Log what you take, how, how much and when.

- Doses taken within 12 hours of each other form a session, drawn on one
  timeline. The session still going sits on top, with anything in it that
  doesn't mix.
- The form warns before a redose while the last one is still working, and
  before anything that mixes badly with what you logged in the last day.
- Each session can have a name, notes, a Shulgin rating (− to ++++), and a
  star.
- Stats show sessions month by month, the most used substances, and each
  substance's own history: when you last took it, how much in all and on
  average, and every dose.
- Export the journal as a file, or import one, including PsychonautWiki
  Journal's export.

**Sync it, if you want.** Make an account with a username and a password, and
the journal and the saved list are kept the same on each device signed in to
it. They're encrypted in the browser before they're sent, so the server keeps
a copy it can't read. Two-step sign-in, with an authenticator app and backup
codes, is there to turn on. See [Accounts](#accounts).

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
for chat apps and search engines.

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

The server side is `worker/api.ts`, with its tables in `migrations/`, on
Cloudflare D1.

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
| `npm run build` | Type-check and build into `dist/` |
| `npm run data` | Every data step in turn: PsychonautWiki and TripSit, then Wikidata and Wikipedia, PubChem structures, absorption by route, and the dose check |
| `node scripts/absorption.mjs` | How much of a dose gets in, by route: PsychonautWiki's figures, and Wikipedia's drug infoboxes where the route is named |
| `node scripts/check-doses.mjs` | Checks every route's doses rise in order on their rail, mends rows whose ranges change unit, and fails on any left |
| `node scripts/sync-wikidata.mjs --write` | Rebuild the reference entries from the cache in `scripts/.cache/`, without fetching |
| `npm run og` | Draw the link preview cards into `public/og/` |
| `npm run sitemap` | Write `public/sitemap.xml` |
| `npm run deploy` | Cards, sitemap, build, and deploy to Cloudflare |
| `python3 scripts/icons.py` | Cut the favicon and app icons from `design/logo.jpg` |

The cards are drawn in Chromium through playwright-core, so it needs a
Playwright Chromium (`npx playwright install chromium`). The icons need
Pillow. Deploying needs `wrangler login` to the Cloudflare account that owns
the Worker.

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

## Code

- `src/App.tsx`: the shell, with the sidebar on a wide window and the tab bar
  on a phone.
- `src/pages/`: Search, Substance, Kind, Mix, Journal, Saved, Settings, the
  account (Account), the admin's page (Admin), and the intro (Onboarding).
- `src/components/`, among them:
  - `Odometer`: the rolling number.
  - `LevelRail` and `DoseRuler`: the dose rail.
  - `Molecule`: the drawings, loaded per first letter from `public/data/structures/`.
  - `Timeline` and `SessionChart`: the duration curve and the session timeline.
  - `IngestionForm`: logging a dose.
  - `scrub.ts`: reading the charts by touch.
  - `StackedBars`: the column charts, read by touch too.
  - `ProfileHeader`: the top of the account page.
  - `Absorption`: how much gets in, by route.
- `src/lib/`:
  - `data.ts`, `mix.ts`: the data and the mix checker.
  - `journal.ts`: the journal's store, sessions, import, export and merging.
  - `account.ts`: signing in and out, two-step sign-in, and syncing.
  - `eggs.ts`: a few things for whoever looks up estradiol.
  - `alcohol.ts`: blood alcohol, roughly, from the body weight.
  - `keys.ts`: the keys, and encrypting the journal.
  - `password.ts`: how guessable a new password is.
  - `molsvg.ts`: skeletal formulas from 2D coordinates.
  - `preview.ts`: link previews.
  - `routes.ts`, `router.ts`: the pages.
- `worker/`: the Worker; `api.ts` is the accounts.
- `migrations/`: the account tables.
- `scripts/`: the data sync, structures, cards, sitemap, icons, and the
  admin's key hash.

## Not medical advice

Doses are typical ranges. Your body, your tolerance, the medicines you take
and what is really in a pill or powder can all change them. Start low, test
what you have, and don't use alone. If someone is unresponsive or breathing
slowly, call emergency services.
