# Preserve widely covered news in hourly selection

The user requires every scheduled run to discover fresh material across its
category sources and prioritize important events covered by many outlets.
Publisher attention guides selection; it does not establish truth, independent
reporting, breaking status, image suitability or permission to reuse reporting.

## Observed defects

- The completed 11:00 UTC run discovered 557 fresh items and published only five.
  Discovery collapsed repeated events without retaining their coverage count.
- Publisher rotation and freshness ordered discovery; the preparation and writer
  stages had no cross-publisher attention signal.
- The feed parser inspected only its first 100 entries even after parsing the
  complete feed. A fresh item later in that array could be missed.

## Change

- Scan every entry supplied by a fetched feed, retaining the existing time,
  category and source restrictions. This does not claim complete website crawling:
  feeds and public listings can omit articles or be unavailable.
- Before collapsing events, count distinct publisher families directly matching
  each anchor's category, strong title overlap and compatible numbered event.
  Duplicate feeds and sister outlets do not inflate the count; no transitive
  cluster joins are used. Restricted-primary feeds can signal attention without
  becoming eligible primary sources.
- Preserve counts and family URLs, and retain raw discovery metadata for audit.
  Prioritize widely covered events in discovery, substantial grounded preparation
  and the scoped writer brief. Risky or thin material still receives its existing
  lower preparation priority; no verification gate is relaxed.
- If a known published source URL belongs to the same event's coverage, keep the
  event as a lower-priority reserve and require a real new development. Final
  published-story and sibling deduplication still apply.

## Evidence

- A real read-only shadow discovery fetched 553 fresh items from the current
  configured routes. It identified 22 item-level multi-family signals; an event
  can contribute more than one such item. Coverage calculation took 1.646 seconds.
- Example direct matches included a three-family Eagle's Nest fire event and
  two-family Kosovo election/border stories. Counts are not factual approvals;
  syndicated reporting and outlet investigations remain subject to the existing
  provenance and originality checks.
- Regression cases cover a fresh item after position 100, priority over a newer
  singleton, preservation through collapse, sister/duplicate-feed counting,
  category isolation, distinct numbered developments, blocked primary eligibility,
  known published events, preparation quality ordering and the actual scoped
  writer brief.
- The production build passed. Scheduled publication acceptance remains open:
  these discovery checks do not demonstrate two to three articles in every desk.
- All 68 targeted Linux event-coverage, scoped-writer, hourly-coverage,
  evidence-priority and category-source tests passed.

## Direct review

Root inspected the complete change, tests and downstream call sites with the
requested review skills. Coverage metadata stays internal and cannot replace
source evidence or approve an article. No model/provider or billing path changes.
The active hourly worker must finish before committed-release activation.

## Photo review capacity

The same 11:00 UTC run offered 97 stories to the photo editor. Only seven chunk
contact sheets appeared before the four-minute window ended; 74 stories either
had no fitting image or were unreviewed. That aggregate is not evidence that all
74 were bad images. Fixed eight-story chunks wasted contact-sheet space when a
story had only three or four candidates.

The photo editor now packs up to 16 stories while preserving a maximum of 64
offered cells per request. Tiles remain 200×150 and retain their story/option
labels; 64 cells still occupy 1600×1200. Neither the four-minute deadline nor the
three-call concurrency limit changes. All previous native-pixel, exact-byte,
rights, subject and final publication gates remain in place.

A real 16-story / 64-cell Luna/max OAuth fixture passed all 16 exact-asset and
results-graphic checks in 22.6 seconds. It published nothing. This validates the
mapping and readability of that fixture, not the completion time or acceptance
rate of an arbitrary live batch. Regression checks cover both sparse and full
option pools and verify that packing does not reduce tile size.
All 63 targeted Linux photo-editor, contact-sheet, image-policy and preparation
overlap checks passed. Direct review found no remaining actionable regressions
in the packing change.

## News genre and announcement ordering

Feed tags were used for the category check but then discarded, so the existing
preparation warning could not recognize a feed's explicit Reviews/Opinion label.
Preserve those tags. Extend the existing discovery rank's announcement vocabulary
to English, including launches, approvals, recalls, outages, breaches and major
discovery language, with a lower rank for explicitly labelled review/gallery/
opinion material. This changes order, not eligibility or publication scores.
No keyword constitutes factual verification or a public breaking-news label.
All 32 targeted Linux event/source-policy checks passed after direct review.
