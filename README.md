# Oyama Journal

A harm-reduction reference and dose journal for psychoactive substances, on
[journal.mahiro.uk](https://journal.mahiro.uk). Built on the shell and design
system of [Oyama's HRT Tracker](https://github.com/xunxunProjects/Oyama-s-HRT-Tracker)
(hrt.mahiro.uk). English only.

- **Look up** over 3,000 substances: what each is, its structure, doses by
  route on a dose rail, how long it lasts on a clock, and what it mustn't be
  mixed with.
- **Mix**: put two or more together and get one answer, the most serious first.
- **Journal**: log what you take and when. Sessions are drawn on one
  timeline; the form warns before a redose or a bad combination with anything
  logged in the last day. Titles, notes and Shulgin ratings per session, stats,
  and export and import (including PsychonautWiki Journal's export file).
  Kept in the browser only: nothing is uploaded, there are no accounts.

## Data

| Source | What | Licence |
| --- | --- | --- |
| [PsychonautWiki](https://psychonautwiki.org) | doses, durations, effects, tolerance, interactions | CC BY-SA 4.0 |
| [TripSit](https://tripsit.me) | combinations, factsheets | see [TripSit/drugs](https://github.com/TripSit/drugs) |
| [Wikidata](https://www.wikidata.org) | kinds, interactions, the substances the above don't cover | CC0 |
| [Wikipedia](https://www.wikipedia.org) | summaries, linked from each page | CC BY-SA 4.0 |
| [PubChem](https://pubchem.ncbi.nlm.nih.gov) | 2D structures (standard depiction) | public domain (NCBI) |

Entries that come only from Wikidata are reference entries: names, what they
are, their structure and known interactions, never a dose.

```bash
npm run data      # PsychonautWiki/TripSit, then Wikidata/Wikipedia, then PubChem structures
npm run og        # link preview cards into public/og/ (Playwright + Chromium)
npm run deploy    # cards, sitemap, build, and wrangler deploy (Cloudflare Workers)
```

`scripts/.cache/` keeps the raw Wikidata and Wikipedia answers between runs.

## Code

- `src/` the app: React 18, Vite, Tailwind 4, Oyama's tokens and components.
- `src/lib/molsvg.ts` draws skeletal formulas from PubChem's 2D coordinates.
- `src/lib/journal.ts` the journal's store, sessions, import and export.
- `worker/index.ts` writes each page's title, description and card for link previews.
- `scripts/` the data sync, structures, cards and sitemap.

Not medical advice. Doses are typical ranges; your body, tolerance, other
medicines and what is really in a pill change them. Start low, test what you
have, don't use alone.
