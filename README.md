# Oyama Journal

A harm-reduction reference and dose journal for psychoactive substances, at
[journal.mahiro.uk](https://journal.mahiro.uk). It is built on the shell and
design system of [Oyama's HRT Tracker](https://github.com/xunxunProjects/Oyama-s-HRT-Tracker)
(hrt.mahiro.uk), in English. No account needed: what you do on it stays on
your device. An account is optional, and keeps your journal the same on every
device you sign in on, encrypted on each before it's sent.

The same site answers on journal.mahiro.uk, n55.mahiro.uk, od.mahiro.uk,
od.gdmu.net and trip.mahiro.uk.

## What it does

**Look things up.** 3,041 substances, each with its skeletal formula drawn from
PubChem's own 2D layout.

- 702 come from PsychonautWiki and TripSit, with doses by route on a rail from
  light to heavy, how long it lasts drawn on a clock, tolerance, effects, and
  what it mustn't be mixed with.
- 2,339 are reference entries from Wikidata and Wikipedia: what the substance
  is, its names, its structure and its known interactions. They never have a
  dose.
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
a copy it can't read. See [Accounts](#accounts).

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
| `/journal` | The journal; `/journal/stats` for its stats |
| `/journal/<session>` | One session |
| `/journal/substance/<id>` | One substance's history in the journal |
| `/saved`, `/settings` | Saved substances; settings |
| `/settings/account` | The account: sign in or make one, sync, devices, password, recovery key |

## Data

| Source | What it gives | Licence |
| --- | --- | --- |
| [PsychonautWiki](https://psychonautwiki.org) | Doses, durations, effects, tolerance, interactions | CC BY-SA 4.0 |
| [TripSit](https://tripsit.me) | Combinations, factsheets | See [TripSit/drugs](https://github.com/TripSit/drugs) |
| [Wikidata](https://www.wikidata.org) | Kinds, interactions, and the substances the two above don't cover | CC0 |
| [Wikipedia](https://www.wikipedia.org) | Summaries, linked from each page | CC BY-SA 4.0 |
| [PubChem](https://pubchem.ncbi.nlm.nih.gov) | 2D structures | Public domain (NCBI) |

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
- **Limits.** Ten sign-in tries a minute per address and per account name,
  and five wrong passwords in a row lock the name for 15 minutes, doubling
  up to an hour. A device stays signed in for 60 days after it was last
  used. A new password signs every other device out.

The server side is `worker/api.ts`, with its tables in `migrations/`, on
Cloudflare D1.

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
| `npm run build` | Type-check and build into `dist/` |
| `npm run data` | Every data step in turn: PsychonautWiki and TripSit, then Wikidata and Wikipedia, then PubChem structures |
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
  account (Account), and the intro (Onboarding).
- `src/components/`, among them:
  - `Odometer`: the rolling number.
  - `LevelRail` and `DoseRuler`: the dose rail.
  - `Molecule`: the drawings, loaded per first letter from `public/data/structures/`.
  - `Timeline` and `SessionChart`: the duration curve and the session timeline.
  - `IngestionForm`: logging a dose.
  - `scrub.ts`: reading the charts by touch.
- `src/lib/`:
  - `data.ts`, `mix.ts`: the data and the mix checker.
  - `journal.ts`: the journal's store, sessions, import, export and merging.
  - `account.ts`: signing in and out, and syncing.
  - `keys.ts`: the keys, and encrypting the journal.
  - `password.ts`: how guessable a new password is.
  - `molsvg.ts`: skeletal formulas from 2D coordinates.
  - `preview.ts`: link previews.
  - `routes.ts`, `router.ts`: the pages.
- `worker/`: the Worker; `api.ts` is the accounts.
- `migrations/`: the account tables.
- `scripts/`: the data sync, structures, cards, sitemap and icons.

## Not medical advice

Doses are typical ranges. Your body, your tolerance, the medicines you take
and what is really in a pill or powder can all change them. Start low, test
what you have, and don't use alone. If someone is unresponsive or breathing
slowly, call emergency services.
