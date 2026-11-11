# Reliable World, Showbiz and Economy output

Implementation base: `9a8e4438b5a6314ebf75fbb76e8578c1766af0a6`.
The preceding Claude audit covered `2e746ef0` through that base.

Target five confirmed publications per desk/hour; minimum three when eligible
stories and services are available. Keep Luna/max core writing/reviews, the
eight-call shared fair pool, and the separate post-publication Gemini enrichment
job. Preserve unrelated work and the other four desks. AP/Bloomberg access stays
public or already authorized; blocked access never counts as successful scraping.

## Implementation and verification checkpoints

- Completed: unusable/empty ranking decisions fall back to the original queue
  and suppress further ranking model calls for that hour (regression red/green).
- Completed: ranking receives its own 240-second window, independently of visual
  review, while retaining the absolute model deadline (regression red/green).
- Pending: bounded pending-review retries and publisher rotation.
- Pending: preparation/draft/approval recovery across all three desks.
- Pending: early, hash-bound published-event triage with final context review.
- Pending: complete fallback-note context on all three desks; World headline
  allowance and minimum-count reporting.
- Pending: AP/Bloomberg discovery/extraction validation and honest source funnel.
- Pending: per-run provenance/timing, captured replay, real Luna validation,
  independent reviews, Linux checks/build, committed GitHub release, and three
  scheduled production observations with visual article reports.

Tests use the agreed public boundaries: discovery/readability, ranking/eligibility,
category-run outcomes, and publication/readback. Test-double output is not evidence
of Luna latency, writing quality or actual publication. No publication target has
yet been established by this implementation.
