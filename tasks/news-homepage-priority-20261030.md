# Publisher homepage priority — completion remains open

The owner requires every hourly run to prioritize the news highest on every
registered publisher homepage, across all seven desks, while retaining lower
stories. The supplied TechCrunch image includes a large lead card, smaller
cards and a top-headlines column. Correct visual ordering therefore requires
rendered-page evidence; static document order alone does not prove it.

## Implemented foundation

- Registered publisher roots are already scheduled independently of feeds.
  Preserve fresh root-page headline-link order in a separate SQLite table;
  ordinary section/pagination pages cannot overwrite it. Owned edition redirects
  retain their root-page identity.
- Replace each complete homepage observation atomically, including empty pages.
  Expire attention after one hour; do not modify article cache hints or delete
  lower/unfeatured article inventory. Explicitly hidden links and category/author
  links borrowing another card's heading cannot become prominent headlines.
- Reuse publication URL identities for www/tracking aliases, keeping original
  fetch URLs. Duplicate discovery aliases preserve the strongest observation.
- Carry the attention signal through discovery, grounded preparation and capped
  initial writer briefs. Preserve freshness, reserve genres, source warnings,
  published-event demotion and all final quality gates. Evidence is internal and
  explicitly labeled `public_html_dom_order`, never measured visual position.
- Bound homepage payloads at 8 MB after a real CNBC homepage exceeded the old
  3 MB article limit. Oversize/restricted/unavailable pages remain unavailable.

## Evidence and outstanding work

The initial five regressions failed before implementation. The ingestion fixture
still retrieves all 225 articles and preserves the twenty homepage positions.
Subsequent regressions cover owned-edition redirects, hidden/menu links, canonical
aliases, stale/future observations, reserve genres and actual writer-cap selection.
The production build passed. Windows and native Linux regression results are
recorded with the external release evidence. Independent read-only review found
and verified fixes for timestamp exclusion, edition redirects, aliases and the
writer's downstream reordering.

Final checks: 128 focused Windows tests passed; 134 native Linux tests passed,
including shell writer coordination. The last writer metadata/assertion update
passed another 30 focused native tests. The expanded Windows shell-writer run
reported four SQLite temporary-file cleanup errors; those checks pass on the
production Linux platform. They are not represented as a green Windows result.
Final independent review reports no findings in this checkpoint.

A read-only VPS probe of one publisher per desk exposed actual HTML limitations:
ESPN supplied no eligible static homepage links, and static markup can include
section headings or duplicate card links. Full public responses and the probe
JSON are retained under `/tmp/383-homepage-qa` in the worker container. This probe
uses no model, production inventory writes, publications or emails.
The final probe observed 116/54/53/9/33/89 headline links for Telegrafi, Lapsi,
TechCrunch, CNBC, Al Jazeera and Variety, respectively. ESPN yielded zero.
These are candidate headline links, not verified articles or rendered positions.

The official D4Vinci/Scrapling `scrapling-official` skill remains the recommended
Python retrieval skill under the no-paid-scraping constraint. Its official skill
page and current documentation were rechecked on 30 October:
https://skills.sh/d4vinci/scrapling/scrapling-official and
https://scrapling.readthedocs.io/en/latest/ . Adaptive parsing, public browser
rendering and resumable crawling can improve resilience; no tool can guarantee
complete, correct scraping after every possible website change. Do not enable
access-bypass features or add publisher credentials.

Required next: implement and verify rendered visual positions with bounded
public retrieval, retain explicit failures/fallbacks, test layout mutations and
real homepage cards across the registry, review the complete implementation,
then release through the authorized GitHub flow and verify actual scheduled
selection/publication. The current foundation is a local committed checkpoint,
not an activated release or fulfillment of the complete homepage requirement.

Production remains on verified `4f4322f4`. The 30 October 14:00 UTC run published
eight with exact live readback: Kosovë 2, Shqipëri 1, Sport 0, Teknologji 0,
Ekonomi 1, Botë 2, Showbiz 2. All eight final context reviews returned valid
decisions, against 154 historical articles. Twenty publications and two to three
per category remain unproven and unmet in this run.
