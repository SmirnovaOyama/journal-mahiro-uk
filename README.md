# Oyama Journal

A harm-reduction reference and dose journal for psychoactive substances, at
[journal.mahiro.uk](https://journal.mahiro.uk). It is built on the shell and
design system of [Oyama's HRT Tracker](https://github.com/xunxunProjects/Oyama-s-HRT-Tracker)
(hrt.mahiro.uk), in English. Nothing to sign up for, and nothing you do on it
leaves your device.

The same site answers on journal.mahiro.uk, n55.mahiro.uk, od.mahiro.uk and
trip.mahiro.uk.

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

## Running it

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | The site at localhost:5173 |
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

## Code

- `src/App.tsx`: the shell, with the sidebar on a wide window and the tab bar
  on a phone.
- `src/pages/`: Search, Substance, Kind, Mix, Journal, Saved, Settings, and
  the intro (Onboarding).
- `src/components/`, among them:
  - `Odometer`: the rolling number.
  - `LevelRail` and `DoseRuler`: the dose rail.
  - `Molecule`: the drawings, loaded per first letter from `public/data/structures/`.
  - `Timeline` and `SessionChart`: the duration curve and the session timeline.
  - `IngestionForm`: logging a dose.
  - `scrub.ts`: reading the charts by touch.
- `src/lib/`:
  - `data.ts`, `mix.ts`: the data and the mix checker.
  - `journal.ts`: the journal's store, sessions, import and export.
  - `molsvg.ts`: skeletal formulas from 2D coordinates.
  - `preview.ts`: link previews.
  - `routes.ts`, `router.ts`: the pages.
- `scripts/`: the data sync, structures, cards, sitemap and icons.

## Not medical advice

Doses are typical ranges. Your body, your tolerance, the medicines you take
and what is really in a pill or powder can all change them. Start low, test
what you have, and don't use alone. If someone is unresponsive or breathing
slowly, call emergency services.
