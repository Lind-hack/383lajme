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
- Completed: incomplete visual reviews remain retryable on every desk; persist at
  most two review dispatches per candidate/run and rotate fresh alternatives first.
- Completed: approved-receipt recovery includes serial, parallel and context-refresh
  layouts for all three desks. Partial preparation/draft recovery remains pending.
- Pending: early, hash-bound published-event triage with final context review.
- Completed: complete fallback source context reaches all three composers, and World
  reports the agreed three-article minimum. World headline allowance remains pending.
- Pending: AP/Bloomberg discovery/extraction validation and honest source funnel.
- Pending: per-run provenance/timing, captured replay, real Luna validation,
  independent reviews, Linux checks/build, committed GitHub release, and three
  scheduled production observations with visual article reports.

Tests use the agreed public boundaries: discovery/readability, ranking/eligibility,
category-run outcomes, and publication/readback. Test-double output is not evidence
of Luna latency, writing quality or actual publication. No publication target has
yet been established by this implementation.
