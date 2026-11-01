# 383 Lajme — Albanian newsroom contract (Topic Selection v2)

This document is authoritative for the hosted writer and deterministic gates. It amends older wording about “Kosovo audience fit” and the competitor-source rule. `scripts/editorial_rules_v2.py` and `scripts/topic_selection_gate.py` enforce the machine-checkable parts.

## Hourly source policy v3

The hourly worker targets 20 distinct new articles: Kosovë 3; Shqipëri 3;
Botë 3; Teknologji 3; Ekonomi 3; Sport 3; Showbiz 2. Follow the prepared
publication_plan: cover every available category before taking extra stories
from a busy desk. Use backup candidates if a draft fails. Unused slots in a
quiet desk can be redistributed only up to three articles per category; give
every available desk two places before third places and report shortages honestly. Prioritize
interesting, well-supported news for Kosovo readers without inventing a local
connection to world news.

`scripts/news_sources.json` is the authoritative source registry. Every primary
and corroborating publisher belongs to exactly one desk. Reject off-topic stories
instead of changing category. Local public controversies belong to Kosovë or
Shqipëri. These local desks also cover verified entertainment, public personalities
and company news with an explicit Kosovo/Albania connection. International
celebrity entertainment belongs to Showbiz. Ekonomi includes US stocks,
Wall Street, crypto, business and finance. Technology product and AI reporting
belongs to Teknologji. Never use a world publisher as technology or markets
corroboration, or a local general portal as entertainment or sports corroboration.
Routine reports may use one readable registered publisher as factual evidence. Internal source URLs and names remain mandatory, but no publisher is ever named in public copy: every article reads as 383's own reporting.
Sensitive allegations, crime accusations, corruption, abuse, lawsuits and private-life
rumours require two readable independent publishers supporting the central claim.
When two URLs are supplied, they must be from different ownership families. Availability is checked anew every run. Blocked/paid sources do not supply
facts from previews. Never copy another outlet's wording.

## Showbiz audience and daily research

Prioritize Albanian artists and personalities at home and abroad. Dua Lipa,
Rita Ora and Bebe Rexha are the first watchlist tier, followed by the researched
roster in `scripts/showbiz_artists.json`. Public statements, new Instagram
posts/reels, fashion, beauty, glamorous adult photo shoots, beach/swimwear
photos, performances, relationship announcements and documented public exchanges
are valid entertainment topics. They do not need political/economic consequences
or a new album to merit a story. Use an engaging factual hook and natural Albanian;
avoid generic hype, moralizing or padding. An artist name mentioned in passing
does not establish the story's subject.

Use `showbiz-research/current.md` and its JSON coverage report as discovery
context. The hourly pipeline checks for a fresh report each run and refreshes
research every four hours and on a new Kosovo calendar day. Daily research
includes an artist-name search restricted to every registered Showbiz
publisher, alongside broader discovery searches and public official feeds. These
searches supplement the normal collection of all fourteen publisher inventories.
Official profile links have provenance; never guess handles. A profile alone is not a new post,
and an updated timestamp is not a new upload. Exact posts require accessible
author/date/content evidence. Public posts can establish what the artist said
or shared, not inferred motives, relationships, pregnancy, intimate details or
imagined fan reactions. Private-life rumours and sensitive allegations still
require independent corroboration. Unavailable evidence stays unavailable.

Keep existing primary-source and photo-rights checks. Use appropriately labelled
archive imagery only when permitted; do not pass it off as the current post or
copy an unlicensed social photograph. Search snippets and artist feeds do not
automatically become publication-ready facts. Do not invent a fresh artist story
to meet a preferred share or category target.

## Hard bans — never publish

- Anime, manga, K-pop/J-pop fandom news, gaming and esports.
- In legacy daily mode: women’s sports and niche foreign stories without a
  Kosovo/Balkans/diaspora/EU/US angle. Hourly Sport and Botë use their dedicated desks.
- Youth tournaments, lower leagues, or friendlies with no Kosovar interest.
- Unreadable sources, unsupported claims, or sensitive allegations without independent corroboration.
- A pure copy of one source with no added value, even if a quota is short.

## Title rules v2 — hooks, not labels

1. Name the WHO and the STAKE. No exceptions.
2. For hourly local stories, include the verified location naturally in the headline's sentence, wherever it reads best. Do not prepend labels such as `Kosovë:`, `Prishtinë:` or `Pejë —`. For example, `Komuna hap pesë rrugë të reja në Prishtinë`. Never invent a location. Legacy daily titles retain their first-three-words location rule.
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

Use the prepared evidence and ready story IDs only. Use unpublished stories
from the rolling last 24 hours. The queue supplies verified image URLs and
dimensions; do not repeat web/image research. Registry feeds and bounded
public listing fallbacks are attempted each hour. Consult
`docs/hourly-news-pipeline.md` for desks and operations. Never add unrelated news
to fill a quiet lane.

## Batch article contract

Every article must include `id`, `slug`, `url`, `title`, `excerpt`, `body`, `source`, `category`, `published_at`, `reading_time`, `featured`, `engagement_score`, `score_reason`, `score_breakdown`, `score_formula`, `image_url`, `image_width`, `image_height`, `city`, `corroborating_sources`, and `created_at` and `dispatch` (UTC slot YYYY-MM-DDTHH). Hourly photos must depict a specific subject of the story, not merely its category. Writers leave image fields out of drafts; the normalizer restores the prepared image_* record (subject, caption, rights) by source URL, unchanged. Preparation searches Wikimedia Commons for a named person, place, institution, product or physical object supported by the story. Eligible photographs are independently checked CC0, explicit public domain, or CC BY/BY-SA with a named creator and an exact matching licence URL; the article page credits creator and licence under the photo. NC/ND photographs are never used. The photo appears only on the article page: Telegram and social cards carry no photo, so the credit is never separated from it. A source article using an image does not establish permission. For Sport, Teknologji, Ekonomi, Botë and Showbiz, prefer the source image when the pipeline independently verifies that exact photo through Wikimedia Commons with the permitted licence and creator credit. Such a prepared photo may match the source URL or bytes; its provenance records source_image_reuse=true and distinct_from_source=false. Kosovë and Shqipëri retain the distinct-photo rule, with the existing official institutional press-photo exception. Unlicensed outlet images and arbitrary image-search URLs remain prohibited. The image's decoded size must be at least 1200×630. Writer and editor must verify the subject and file description against the story; reject unrelated images. Use the short Albanian archival/illustrative caption and never claim an archive photo depicts the current event. Relevant rights-cleared photos may be reused across different hourly batches with accurate archive captions. Photos must remain distinct within each batch. If no contextual, rights-cleared photo satisfying the category rules is available, try another verified story. Legacy daily images retain their existing policy until migrated; do not use the legacy publisher-photo fallback for hourly publication.

For Ekonomi market news whose headline is about Bitcoin, Ethereum or the euro itself, the reviewed physical-asset photo inventory is an allowed final fallback. Each original file is visually reviewed and bound to its Commons SHA1, creator, exact licence and actual capture date. Use only the matching asset's photograph, with the unchanged Albanian “Foto ilustruese” caption and capture month/year; physical crypto tokens are symbols, not circulating cryptocurrency coins or photographs of today's market event. These stable illustrations may be up to ten years old. Never use a generic money image for an unrelated company story, a different asset, a chart, a render or a standalone logo. The photo editor, source-image comparison, batch uniqueness, immutable provenance and final title/category match remain required.

Write at least 140 supported Albanian words in three HTML paragraphs. Prefer
220+ words in four paragraphs when sources support that depth; never pad a brief.

`corroborating_sources` may be empty for routine attributed news; sensitive claims
require independently verified objects such as:

```json
[
  {"source": "BBC", "url": "https://www.bbc.com/news/..."}
]
```

Every supplied second URL must resolve to a different ownership family in the
same category. The source-evidence stage fetches all supplied URLs. Preserve uncertainty.
Lead with the verified event, not “according to outlet X”. Name the original speaker, institution or document when evidence supports that attribution. Never name a publisher in the title, excerpt or body. Quote only public statements (press conferences, official posts, documents) and attribute them to the speaker or institution, never to the outlet that carried them. Drop any story that rests on another outlet's exclusive reporting, own interview, eyewitness work or unconfirmed claim: it cannot be told without naming that outlet, and must never be passed off as 383's. The editor must
reject sensitive single-source claims even when discovery missed them.

## Originality

Draft a fact outline first, then build a new lead, ordering and explanation for 383 readers. Use plain Albanian, short sentences and verified context; do not add unsupported background to appear original. Do not closely translate or lightly rearrange a source article. Use sources as evidence, not as copy. Never copy sentences from source articles. Develop a new article from a verified fact outline; a close paraphrase or short excerpt plus a link does not qualify as independent composition. Drop a story that cannot meet this standard rather than padding the batch.

The independent reviewer rejects, and so must the writer avoid: (1) mirroring the source sentence by sentence, even in new words — write 383's own lead and sentences (a natural what/who/when/what-next order of public facts is fine); (2) a headline that translates or keeps the source headline's framing — name the subject and the verified action in a different construction; (3) any claim the evidence does not state, including negative ones such as "no deadline was given" or "no details were announced"; (4) anecdotes, scene-setting or quotes lifted from one outlet's own reporting. Prefer a shorter article in 383's structure over a longer one in the source's. Never pad: no sentences about what an announcement or report did not say, no "this does not mean…" or "this is not proof…" disclaimers, and no repeating a fact already given. Each paragraph adds a new verified fact or concrete context (who is affected, what happens next, the numbers).

## Ranking metadata

Use 0–10 values for every score_breakdown key: relevance, urgency, public_impact, local_depth, controversy_interest, credibility, corroboration, editorial_safety. The normalizer calculates the weighted score. Incomplete ranking metadata receives an explicitly labelled neutral baseline for legacy drafts; hourly publication rejects that fallback until the editor supplies individual ratings.

## Individual editorial ranking

Read `docs/news-ranking-rubric.md`. Assign all eight factors individually from
verified evidence, timeliness and audience stakes. Explain the specific reason
in Albanian. Never copy a neutral all-5 template, inflate every story into breaking
news, or compute the weighted total. The independent editor reassesses ranking;
the normalizer calculates engagement_score, reading_time and city.
The old Prishtina score floor applies only to legacy daily mode.


## Mandatory independent composition review

Before publication, a separate GPT-6 Luna/max OAuth reviewer compares every
final article against all original evidence, including foreign-language sources.
Reject close translations, line-by-line rewrites, copied expressive framing or
structure, borrowed exclusive interviews/analysis, unsupported context and false
firsthand reporting. A changed publisher name or a source link is not originality.
Prefer new organization and explanation of independently verified public facts.
Never invent facts to make a short source look original or satisfy the word floor.

Substantive direct quotations are excluded from automated output. Report verified
statements through independently composed indirect speech, retaining necessary
attribution. Short quoted names/product titles remain subject to review; there
is no automatic word-count permission exception.
Write verified song, album and film titles as proper names in running text,
without quotation marks. Preserve their exact official spelling. This concerns
names only: never remove quotation marks from a borrowed statement to hide a
quotation; report its supported facts in independently composed indirect speech.
All exact-overlap and independent originality checks still apply to work titles.

`scripts/news_copyright_review.py` records individual approval/rejection and
binds approved prose, source evidence and image rights by hash. Incomplete,
expired or changed reviews block publication. The publication entry point
rechecks these approvals, deterministic originality, journalism, source policy,
evidence and photo rights before any database operation, including CLI/legacy
entry points. Never hand-create approval receipts. Rejected stories are skipped;
quality and rights take priority over the target of 20.

These checks screen risk and cannot establish legal certainty. They must never
label automated aggregation as original interviews or eyewitness reporting.
