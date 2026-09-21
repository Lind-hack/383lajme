# 383 Lajme — Albanian newsroom contract (Topic Selection v2)

This document is authoritative for the hosted writer and deterministic gates. It amends older wording about “Kosovo audience fit” and the competitor-source rule. `scripts/editorial_rules_v2.py` and `scripts/topic_selection_gate.py` enforce the machine-checkable parts.

## Core rule: relevance first

Apply the Prishtina test to every candidate: *Would a reader in Pristina stop scrolling for this headline?* If the honest answer is no, do not write it. Relevance beats volume; 15 strong stories are better than 20 filler stories.

The social-discovery/last30days engine remains useful for finding leads, but it never decides the run alone. The quota table below is mandatory. If a feed is quiet, use the browser fallback lanes; never use a banned topic to fill a quota.

## Mandatory run quotas

The final batch contains 13–20 articles, subject to all of these lane limits:

- `Kosovë`: minimum 6. Politics, economy, prices, everyday life, Prishtina and other cities. This is the core lane and must never be under-filled.
- `Shqipëri`: minimum 3.
- `Botë`: 3–4, only with a Kosovo/Balkans/diaspora/EU/US angle: EU integration, dialogue, visas, migration, KFOR/NATO, or major global events with a clear local stake. Never foreign domestic news with no Kosovo angle.
- `Sport`: 2–3, only Kosovo national teams; Kosovar clubs in Europe (`Drita`, `Ballkani`, `Prishtina`, `Llapi`); Champions League; Premier League; La Liga; Serie A; transfers involving Albanian/Kosovar players; or global superstars.
- `Showbiz`: 1–2, only people a 19-year-old in Pristina would recognize: Albanian/Kosovar stars (`Dua Lipa`, `Rita Ora`, `Bebe Rexha`, `Era Istrefi`, etc.), A-list global celebrities, Netflix or major-film mega-hits.

The quotas imply an effective minimum of 15 when all mandatory lanes are populated, even though the outer contract is 13–20.

## Source policy v2

For `KOSOVË` and `SHQIPËRI` discovery, these local outlets may be used as discovery/primary reporting sources:

- Kosovo: Telegrafi, Koha, Gazeta Express, Indeksonline, Kallxo, Gazeta Blic.
- Albania: News24, BalkanWeb, Euronews Albania, ABC News.

They must never be copied. Rewrite in 383 Lajme’s own words, add context/value, and verify every article against at least one independent second source. A same-publisher URL is not independent.

The exception is lane-specific. Those publishers remain prohibited as the primary source for `BOTË`, `SPORT`, and `SHOWBIZ` (and for any other non-local lane). Telegrafi Sport and Telegrafi Showbiz items can be discovery leads only; use the wire/international/official source for a final Sport/Showbiz article. Kosovo-originating outlets not listed above remain prohibited as primary sources.

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

Verified feed inventory (checked 2026-09-21):

- KOSOVË: `https://telegrafi.com/feed/`, `https://www.koha.net/rss`, `https://www.gazetaexpress.com/feed/`, `https://indeksonline.net/feed/`, `https://kallxo.com/feed/`, `https://gazetablic.com/feed/`; RTK Live and Klan Kosova use the browser lane because server fetches are blocked.
- SHQIPËRI: `https://www.news24.al/feed/`, `https://www.balkanweb.com/feed/`, `https://euronews.al/feed/`, `https://abcnews.al/feed/`.
- BOTË: `https://news.google.com/rss?hl=en&gl=US&ceid=US:en` (wire substitute), `http://feeds.bbci.co.uk/news/world/rss.xml`, `https://www.aljazeera.com/xml/rss/all.xml`, `https://www.euronews.com/rss?format=mrss`, `https://balkaninsight.com/feed/`, `https://www.politico.eu/feed/`.
- `SPORT`: `http://feeds.bbci.co.uk/sport/rss.xml`, `https://www.skysports.com/rss/12040`, and Telegrafi Sport as discovery-only.
- `SHOWBIZ`: Telegrafi main feed for discovery; Prive uses the browser lane.
- Browser/no-feed fallbacks: RTK Live, Top Channel, Klan Kosova, JOQ Albania, SuperSport Albania, Shqiptarja, Prive and Gazeta Olle. Do not substitute banned topics when one of these lanes is unavailable.

If a feed is quiet for more than a day, re-check its path. Blocked/no-feed sources belong in the browser lane, not in a filler quota.

## Batch article contract

Every article must include `id`, `slug`, `url`, `title`, `excerpt`, `body`, `source`, `category`, `published_at`, `reading_time`, `featured`, `engagement_score`, `score_reason`, `score_breakdown`, `score_formula`, `image_url`, `image_width`, `image_height`, `city`, `corroborating_sources`, and `created_at`.

`corroborating_sources` is a non-empty list of objects such as:

```json
[
  {"source": "BBC", "url": "https://www.bbc.com/news/..."}
]
```

The second URL must resolve to a different publisher from the primary URL. The source-evidence stage fetches both URLs; inaccessible evidence is rejected before publication.

## Originality

Use sources as evidence, not as copy. Never copy sentences from source articles. A paraphrased rewrite or short excerpt plus a link must add context and be written in 383 Lajme’s own words. Drop a story that cannot meet this standard rather than padding the batch.
