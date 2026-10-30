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

## Rendered geometry implementation checkpoint

The common production root-listing path now uses the existing Chromium and
playwright-core stack to measure headline/card geometry at 1440×1000. No new
scraping account, provider or dependency was added. Public HTTP remains routed
through `fetch_public`, including its pinned public-address checks and access
failures. CSS must load successfully with a CSS MIME type; a transport error,
soft block or timeout records an explicit HTML fallback rather than approving
unstyled geometry.

Visible headline cards rank by their actual top edge, then headline size/card
area for ties. Dynamic, hidden, horizontal-offscreen and below-fold headline
links remain a separate retrieval inventory. Geometry stays solely in homepage
metadata, outside article cache hints. Successful geometry can be reused for
fifteen minutes with its original capture timestamp; attention still expires
after one hour. The collector report exposes each page's method, age and error.

Bounds: two simultaneous browsers per collector; four simultaneous resource
fetches per render; 256 requests; 32 MB of body allocations reserved before
parallel retrieval; a spawned renderer/bridge process with a 42-second parent
deadline. Linux cleanup captures descendant PID identities before the wrapper
exits and forces remaining children down independently of wrapper liveness or
Chromium's detached group. Windows uses the preserved wrapper process tree.

Native checks prove CSS order over document order, dynamic wrapper changes,
lower/hidden/offscreen retention through the production root path, unchanged
article-cache keys, cache timestamp preservation, parallel body limits, slow
fetch termination and a detached child ignoring normal termination. The 137-test
native suite passes; the final HTTP200/HTML-as-CSS regression passes separately.
The 137-test Windows run passes with seven native-browser tests skipped. The
production build passes. Independent review found these defects and their
regressions before the checkpoint was committed.

The real seven-publisher geometry probe returned candidates from TechCrunch,
Telegrafi, Lapsi, Al Jazeera and Variety, zero from ESPN and a CNBC deadline.
These initial counts precede the stricter CSS guard, so they are not proof that
all those sites pass the final implementation. A subsequent strict-CSS native
TechCrunch probe found 76 candidates, with the same large lead, DoorDash card
and top-headlines column shown in the owner's image. The saved screenshot was
inspected against that image. Noncritical resource failures remain reported.
The final independent review reports no findings after all identified fixes.

The 15:00 UTC production slot on the unchanged `4f4322f4` worker completed with
five articles (Kosovë 2, Shqipëri 0, Sport 1, Teknologji 1, Ekonomi 0, Botë 0,
Showbiz 1). The independent read-only audit at 15:49 UTC verified 162 historical
comparisons, source/copy hashes, native image attestations at publication,
distinct current photo bytes and exact database/public content for all five.
This is another verified shortfall, not production evidence for unreleased code.

Still required: registry-wide shadow evidence and scheduling/capacity checks,
verify top-homepage stories get early retrieval as well as editorial priority,
complete review of any follow-up changes, release and scheduled production
verification. This remains an unreleased checkpoint and does not establish
complete coverage of every website or the publication/category target.
