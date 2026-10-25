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
