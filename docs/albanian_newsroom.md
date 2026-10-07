# 383 Lajme — Albanian newsroom contract (Topic Selection v2)

This document is authoritative for the hosted writer and deterministic gates. It amends older wording about “Kosovo audience fit” and the competitor-source rule. `scripts/editorial_rules_v2.py` and `scripts/topic_selection_gate.py` enforce the machine-checkable parts.

## Hourly source policy v3

The hourly worker has no category minimum and publishes at most ten verified
articles. The supplied source-ready target is a ceiling, never a quota. A quiet
hour can publish none. Every category is checked on every run. Prioritize
interesting, well-supported news for Kosovo readers without inventing a local
connection to world news.

`scripts/news_sources.json` is the authoritative source registry. Every primary
and corroborating publisher belongs to exactly one desk. Reject off-topic stories
instead of changing category. Local public controversies belong to Kosovë or
Shqipëri; celebrity entertainment belongs to Showbiz. Ekonomi includes US stocks,
Wall Street, crypto, business and finance. Technology product and AI reporting
belongs to Teknologji. Never use a world publisher as technology or markets
corroboration, or a local general portal as entertainment or sports corroboration.
Two URLs must be from different ownership families and support the same central
claim. Availability is checked anew every run. Blocked/paid sources do not supply
facts from previews. Never copy another outlet's wording.

## Hard bans — never publish

- Anime, manga, K-pop/J-pop fandom news, gaming and esports.
- Women’s football and women’s sports.
- Niche foreign domestic stories with no Kosovo/Balkans/diaspora/EU/US angle.
- Youth tournaments, lower leagues, or friendlies with no Kosovar interest.
- Any story that cannot be verified from at least two independent sources.
- A pure copy of one source with no added value, even if a quota is short.

## Title rules v2 — hooks, not labels

1. Name the WHO and the STAKE. No exceptions.
2. For local stories, put `Kosovë`, `Prishtinë`, or the relevant city in the first three words.
3. Prefer concrete nouns and specifics: numbers, dates, minute marks (`5 ndryshime`, `nga 1 tetori`, `minuta e 89-të`).
4. Curiosity is allowed; lying is not. The body must deliver exactly what the title promises.
5. Keep titles to approximately 65 characters so mobile does not truncate them.
6. Do not use `zhvillime`, `ngjarje`, `reagime`, `detaje`, or `situatë` as standalone title nouns. Name the subject beside them or drop them.
7. Read every title aloud before writing the batch file. If it could describe five different stories, rewrite it.

Examples:

- Bad: `Zhvillime të reja në dialog`
- Good: `Kurti–Vuçiç takohen të enjten në Bruksel: ja çfarë pritet`
- Bad: `Reagime pas ndeshjes së mbrëmshme`
- Good: `Drita shënon në minutën e 89-të, kalon tutje në Evropë`
- Bad: `Detaje të reja nga ekonomia`
- Good: `Banesat në Prishtinë u shtrenjtuan 12%: ja lagjet më të shtrenjta`

## City tagging

Every `Kosovë` and `Shqipëri` article must have `city`. Infer it from the title plus the first 200 words of the body, in the priority order below. If multiple cities match, use the first city in this list, not a guessed location. If none matches, use the national fallback (`Kosovë` or `Shqipëri`). Never invent a city.

Kosovo priority: Prishtinë/Prishtina, Prizren, Pejë/Peja, Mitrovicë/Mitrovica, Gjilan, Ferizaj, Gjakovë, Podujevë, Vushtrri, Skenderaj, Drenas, Lipjan, Suharekë, Rahovec, Deçan, Istog, Klinë, Malishevë, Kaçanik, Shtime, Obiliq, Fushë Kosovë, Graçanicë, Dragash, Junik, Mamushë, Hani i Elezit, Zveçan, Leposaviq, Zubin Potok, Shtërpcë, Novobërdë, Kllokot, Ranillug, Partesh.

Albania priority: Tiranë, Durrës, Shkodër, Vlorë, Elbasan, Fier, Korçë, Berat, Lezhë, Kavajë, Lushnjë, Pogradec, Gjirokastër, Sarandë, Kukës, Dibër, Krujë, Kurbin, Mirditë, Mat, Bulqizë, Tropojë, Has, Pukë, Devoll, Kolonjë, Përmet, Tepelenë, Mallakastër, Skrapar, Gramsh, Librazhd, Peqin, Rrogozhinë, Divjakë, Himarë, Delvinë, Vorë, Kamëz, Shijak.

Non-local articles carry `city: null`.

## Discovery lanes

Use the prepared evidence and verified pair IDs only. Registry feeds and bounded
public listing fallbacks are attempted each hour. Consult
`docs/hourly-news-pipeline.md` for desks and operations. Never add unrelated news
to fill a quiet lane.

## Batch article contract

Every article must include `id`, `slug`, `url`, `title`, `excerpt`, `body`, `source`, `category`, `published_at`, `reading_time`, `featured`, `engagement_score`, `score_reason`, `score_breakdown`, `score_formula`, `image_url`, `image_width`, `image_height`, `city`, `corroborating_sources`, and `created_at` and `dispatch` (UTC slot YYYY-MM-DDTHH). Images must decode at 1200×675 or larger. If the first image is inadequate, retain the story and try publisher-declared images from its primary and corroborating pages. If those fail, web-search up to three reputable publisher pages covering the exact event and record them as optional `{source, url}` objects in `image_source_pages`. Never use raw image-search results, galleries, stock-photo pages, social profiles, or broad topic matches; the validator independently checks headline overlap, metadata, dimensions, and placeholder exclusions.

`corroborating_sources` is a non-empty list of objects such as:

```json
[
  {"source": "BBC", "url": "https://www.bbc.com/news/..."}
]
```

The second URL must resolve to a different ownership family in the same category from the primary URL. The source-evidence stage fetches both URLs; inaccessible evidence is rejected before publication.

## Originality

Use sources as evidence, not as copy. Never copy sentences from source articles. A paraphrased rewrite or short excerpt plus a link must add context and be written in 383 Lajme’s own words. Drop a story that cannot meet this standard rather than padding the batch.

## Ranking metadata

Use 0–10 values for every score_breakdown key: relevance, urgency, public_impact, local_depth, controversy_interest, credibility, corroboration, editorial_safety. The normalizer calculates the weighted score. Incomplete ranking metadata receives an explicitly labelled neutral baseline; it never counts as evidence.
